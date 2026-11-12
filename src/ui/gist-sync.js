import { $ } from '../core/dom.js';
import { GestorModales } from './gestor-modales.js';
import { UIBase } from './base.js';
import { SincronizacionGist } from '../services/sincronizacion-gist.js';
import { TarjetaFichaje } from './tarjeta-fichaje.js';
import { EstadoApp } from '../services/estado-app.js';
import { ImportarExportar } from '../services/importar-exportar.js';
import { mostrarToast } from './toast.js';
import { GistResumenMerge } from './gist-resumen-merge.js';
import { FraseModal } from './frase-modal.js';
import { FraseCifrado } from '../services/frase-cifrado.js';
import { RespaldoCifrado } from '../services/respaldo-cifrado.js';

// ====================================================================
// GIST: SUBIR Y BAJAR — los flujos de sincronización (manual y automática), el cifrado y el resumen al bajar
// ====================================================================
// El modal de configuración (gist-respaldo.js) es otra cosa: acá están los flujos, que también corren sin el modal abierto
// (botones de la barra del histórico y sincronización automática al abrir la app). Lo que necesitan del modal lo reciben
// por `conectarModal`, así este módulo no depende de él.
const { _flashCampo } = UIBase;

/**
 * Lo que el modal de Gist aporta a los flujos:
 * - `guardarAntes`: guarda lo escrito en el modal (si está abierto) antes de sincronizar; false si no se puede seguir.
 * - `alSincronizar`: se subió o se aplicó una bajada (refrescar Gist ID, estado y fecha de última sincronización).
 * - `alCambiarFrase`: la frase guardada cambió porque se escribió la que abre el Gist.
 * @type {{ guardarAntes: () => boolean, alSincronizar: () => void, alCambiarFrase: () => void }}
 */
let _modal = { guardarAntes: () => true, alSincronizar: () => { }, alCambiarFrase: () => { } };

/** @param {Partial<typeof _modal>} aportes */
function conectarModal(aportes) { _modal = { ..._modal, ...aportes }; }

let _gistMergeDesdeModal = false;
/** @type {{ registrosNormalizados: any[], data: any } | null} */
let _gistMergeData = null;

function _gistMergeCerrarOVolver() {
    if (_gistMergeDesdeModal) {
        _gistMergeDesdeModal = false;
        GestorModales.alternar('modal-gist-merge', 'modal-gist');
    } else {
        GestorModales.cerrar('modal-gist-merge');
    }
}

async function mergeAplicar(modo, modoAutomatico = false) {
    if (!_gistMergeData) return;
    const { registrosNormalizados, data } = _gistMergeData;
    _gistMergeData = null;

    const { ok, vacio } = await ImportarExportar.restaurarRespaldo(data, registrosNormalizados, modo === 'merge' ? 'merge' : 'replace', { etiqueta: 'con Gist', cerrarImportar: false });
    if (ok) TarjetaFichaje.actualizarUI();
    if ((ok || vacio) && !modoAutomatico) _gistMergeCerrarOVolver();
    if (ok) _modal.alSincronizar();

    const btn = $('btn-gist-bajar');
    if (btn) btn.disabled = false;
}

function mergeCancelar() {
    _gistMergeData = null;
    const btn = $('btn-gist-bajar');
    if (btn) btn.disabled = false;
    _gistMergeCerrarOVolver();
}


async function _gistConSpinner(btnId, mensajeError, accion) {
    const btn = $(btnId);
    if (btn) btn.disabled = true;
    const iconoPerfil = $('header-profile-icon');
    iconoPerfil?.classList.add('icono-spin');
    _flashCampo('header-profile-btn');

    try {
        await accion();
    } catch (e) {
        console.error(`${mensajeError}:`, e);
        mostrarToast(mensajeError, 'error', undefined, e instanceof Error ? e.message : null);
    } finally {
        if (btn) btn.disabled = false;
        iconoPerfil?.classList.remove('icono-spin');
    }
}

const FALTA_FRASE_AUTO = 'El Gist está cifrado y falta la frase: cargala en Ajustes → GitHub Gist con «Recordar» activado';

/**
 * El texto a subir: cifrado si hay una frase cargada, en claro si no. Antes de pisar un Gist cifrado comprueba que la frase lo abra
 * (si no, quien tenga la frase anterior ya no podría leerlo): a mano pide confirmación y la subida automática se frena.
 * Devuelve null si la persona canceló.
 * @returns {Promise<{ texto: string, cifrado: boolean, recienCifrado: boolean } | null>}
 */
async function _contenidoParaSubir(respaldo, modoAutomatico) {
    const frase = FraseCifrado.disponible() ? FraseCifrado.actual() : '';
    if (!frase) {
        if (SincronizacionGist.getCifrado()) {
            if (modoAutomatico) throw new Error(FALTA_FRASE_AUTO);
            const seguir = await GestorModales.confirmar('Este Gist está cifrado y no hay una frase de cifrado cargada. Si seguís, se sube sin cifrar y cualquiera con el enlace puede leerlo.', 'Subir sin cifrar', '#icon-lock-open');
            if (!seguir) return null;
        }
        const salida = await ImportarExportar.textoRespaldo(respaldo);
        if ('error' in salida) throw new Error(salida.error);
        return { ...salida, recienCifrado: false };
    }

    let sal = null;
    let habiaEnClaro = false;
    const actual = await SincronizacionGist.leerActual();
    if (actual !== null) {
        const abierto = await RespaldoCifrado.abrir(actual, frase);
        if ('datos' in abierto) {
            sal = abierto.sal;   // la del sobre anterior se reutiliza: no hay que derivar la clave de nuevo
            habiaEnClaro = !abierto.cifrado;
        } else if (abierto.codigo === 'descifrado') {
            if (modoAutomatico) throw new Error('La frase guardada no abre el Gist (se cifró con otra): no se subió para no pisarlo');
            const seguir = await GestorModales.confirmar('La frase cargada no abre lo que hay en el Gist: se cifró con otra. Si seguís, se reemplaza y los dispositivos que tengan la frase anterior no van a poder leerlo.', 'Reemplazar', '#icon-upload');
            if (!seguir) return null;
        }
    }
    const salida = await ImportarExportar.textoRespaldo(respaldo, frase, { sal });
    if ('error' in salida) throw new Error(salida.error);
    return { ...salida, recienCifrado: habiaEnClaro };
}

async function subir(modoAutomatico = false) {
    if (!_modal.guardarAntes()) return;
    await _gistConSpinner('btn-gist-subir', 'Error al subir', async () => {
        const contenido = await _contenidoParaSubir(await ImportarExportar.armarRespaldo(EstadoApp.registros()), modoAutomatico);
        if (!contenido) return;
        await SincronizacionGist.subir(contenido.texto);
        SincronizacionGist.setCifrado(contenido.cifrado);
        _modal.alSincronizar();   // un Gist recién creado: ya hay Gist ID, se habilita Bajar
        mostrarToast(contenido.cifrado ? 'Datos respaldados en Gist (cifrados)' : 'Datos respaldados en Gist', 'success');
        if (contenido.recienCifrado) mostrarToast('Las versiones anteriores del Gist siguen en claro en su historial: conviene crear un Gist nuevo y borrar el viejo', 'info', 9000);
    });
}

/**
 * Texto del Gist → respaldo. En claro se lee como siempre; cifrado se abre con la frase guardada y, si falta o no lo abre, con la
 * que se pide (a mano; la bajada automática se frena). La frase que abre el Gist queda como la frase de la app.
 * Devuelve null si la persona canceló.
 */
async function _abrirGist(texto, modoAutomatico) {
    let frase = FraseCifrado.disponible() ? FraseCifrado.actual() : '';
    for (;;) {
        const abierto = await RespaldoCifrado.abrir(texto, frase, { exigirCifrado: SincronizacionGist.getCifrado() });
        if ('datos' in abierto) {
            if (abierto.cifrado) {
                SincronizacionGist.setCifrado(true);
                if (frase !== FraseCifrado.actual()) {
                    FraseCifrado.guardar(frase, FraseCifrado.recordada());
                    _modal.alCambiarFrase();
                }
            }
            return abierto.datos;
        }
        if (abierto.codigo === 'formato') throw new Error(abierto.error);
        if (abierto.codigo === 'sin-cifrar') {
            // Estaba cifrado y ahora está en claro: o lo cambió la misma persona desde otro dispositivo, o alguien lo reemplazó
            if (modoAutomatico) throw new Error(abierto.error);
            const seguir = await GestorModales.confirmar('Este Gist estaba cifrado y ahora está en claro. Si quitaste el cifrado desde otro dispositivo, podés seguir; si no, alguien lo cambió.', 'Usar igual', '#icon-lock-open');
            if (!seguir) return null;
            SincronizacionGist.setCifrado(false);
            continue;
        }
        if (modoAutomatico) throw new Error(abierto.codigo === 'sin-frase' ? FALTA_FRASE_AUTO : 'La frase guardada no abre el Gist (se cifró con otra)');
        const motivo = abierto.codigo === 'sin-frase' ? 'El Gist está cifrado. Escribí la frase con la que se subió.'
            : abierto.codigo === 'frase' ? abierto.error
                : 'La frase no abre el Gist (o su contenido fue alterado). Probá con otra.';
        const pedida = await FraseModal.pedir(motivo);
        if (pedida === null) return null;
        frase = pedida;
    }
}

async function bajar(modoAutomatico = false) {
    if (!_modal.guardarAntes()) return;
    _gistMergeDesdeModal = $('modal-gist')?.classList.contains('show') ?? false;
    await _gistConSpinner('btn-gist-bajar', 'Error al bajar', async () => {
        const data = await _abrirGist(await SincronizacionGist.bajar(), modoAutomatico);
        if (!data) return;
        const preparado = await ImportarExportar.prepararRespaldo(data, 'gist');
        if ('error' in preparado) return;
        const registrosNormalizados = preparado.registros;
        _gistMergeData = { registrosNormalizados, data };

        if (modoAutomatico) {
            await mergeAplicar(SincronizacionGist.getMergeBehavior(), true);
        } else {
            const diff = ImportarExportar.calcularDiferencias(registrosNormalizados);
            const configCambios = ImportarExportar.calcularCambiosConfigImport(data);
            const resumenEl = $('gist-merge-resumen');
            if (resumenEl) GistResumenMerge.construir(resumenEl, diff, registrosNormalizados, configCambios);
            if (_gistMergeDesdeModal) GestorModales.alternar('modal-gist', 'modal-gist-merge');
            else GestorModales.abrir('modal-gist-merge');
        }
    });
}

export const GistSync = { conectarModal, subir, bajar, mergeAplicar, mergeCancelar };
