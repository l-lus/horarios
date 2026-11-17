import { $ } from '../core/dom.js';
import { GestorModales } from './gestor-modales.js';
import { UIBase } from './base.js';
import { TarjetaFichaje } from './tarjeta-fichaje.js';
import { EstadoApp } from '../services/estado-app.js';
import { ImportarExportar } from '../services/importar-exportar.js';
import { mostrarToast } from './toast.js';
import { GistResumenMerge } from './gist-resumen-merge.js';
import { FraseModal } from './frase-modal.js';
import { FraseCifrado } from '../services/frase-cifrado.js';
import { RespaldoCifrado } from '../services/respaldo-cifrado.js';
import { ConfigSync } from '../services/config-sync.js';

// ====================================================================
// NUBE: SUBIR Y BAJAR — los flujos de sincronización (manual y automática) con un proveedor (Gist o Google Drive)
// ====================================================================
// Cada proveedor aporta su servicio (subir, bajar, leerActual y si lo remoto está cifrado), los ids de sus botones y sus
// textos. El cifrado, la comprobación antes de pisar, el pedido de frase y el resumen al bajar son los mismos para todos.
// El modal de respaldo (centro-respaldo.js) y el de Drive (drive-respaldo.js) aportan lo suyo con `conectarModal`.
const { _flashCampo } = UIBase;

/**
 * @typedef {{
 *   getCifrado: () => boolean, setCifrado: (v: boolean) => void, leerActual: () => Promise<string | null>,
 *   subir: (texto: string) => Promise<string>, bajar: () => Promise<string>
 * }} ServicioNube
 * @typedef {{
 *   servicio: ServicioNube, origen: 'gist' | 'drive', modalId: string, btnSubir: string, btnBajar: string,
 *   el: string, este: string, en: string, etiqueta: string, ajustes: string, riesgoEnClaro: string, avisoHistorial: string
 * }} Proveedor
 * - el / este / en: 'el Gist' / 'Este Gist' / 'en Gist' (para armar los mensajes)
 * - etiqueta: para el historial de deshacer ('con Gist')
 * - ajustes: dónde se carga la frase
 * - riesgoEnClaro: qué pasa si se sube sin cifrar algo que estaba cifrado
 * - avisoHistorial: qué pasa con las versiones anteriores al cifrar por primera vez
 */

// El resumen al bajar es un solo modal (#modal-gist-merge) para todos los proveedores: una bajada a la vez
/** @type {{ registrosNormalizados: any[], data: any, proveedor: Proveedor } | null} */
let _merge = null;
/** @type {Proveedor | null} */
let _ultimoProveedorMerge = null;
let _mergeDesdeModal = false;

function _mergeCerrarOVolver(proveedor) {
    if (_mergeDesdeModal) {
        _mergeDesdeModal = false;
        GestorModales.alternar('modal-gist-merge', proveedor.modalId);
    } else {
        GestorModales.cerrar('modal-gist-merge');
    }
}

function _habilitarBajar(proveedor) {
    const btn = $(proveedor.btnBajar);
    if (btn) btn.disabled = false;
}

/**
 * @param {Proveedor} proveedor
 */
function crear(proveedor) {
    const p = proveedor;
    const s = p.servicio;
    const El = p.el[0].toUpperCase() + p.el.slice(1);

    /**
     * Lo que el modal del proveedor aporta a los flujos:
     * - `guardarAntes`: guarda lo escrito en el modal (si está abierto) antes de sincronizar; false si no se puede seguir.
     * - `antesDeSubir` / `antesDeBajar`: preparativos propios (Drive: elegir o crear el respaldo); false cancela.
     * - `alSincronizar`: se subió o se aplicó una bajada (refrescar estado y fecha de última sincronización).
     * - `alCambiarFrase`: la frase guardada cambió porque se escribió la que abre el respaldo.
     */
    let _modal = {
        guardarAntes: () => true,
        antesDeSubir: async (/** @type {boolean} */ _auto) => true,
        antesDeBajar: async (/** @type {boolean} */ _auto) => true,
        alSincronizar: () => { },
        alCambiarFrase: () => { }
    };

    /** @param {Partial<typeof _modal>} aportes */
    function conectarModal(aportes) { _modal = { ..._modal, ...aportes }; }

    async function _conSpinner(btnId, mensajeError, accion) {
        const btn = $(btnId);
        if (btn) btn.disabled = true;
        const btnPerfil = $('header-profile-btn');
        const iconoPerfil = $('header-profile-icon');
        iconoPerfil?.classList.add('icono-spin');
        btnPerfil?.classList.add('sincronizando');
        if (!document.documentElement.hasAttribute('data-enfasis')) _flashCampo('header-profile-btn');

        try {
            await accion();
        } catch (e) {
            console.error(`${mensajeError}:`, e);
            mostrarToast(mensajeError, 'error', undefined, e instanceof Error ? e.message : null);
        } finally {
            if (btn) btn.disabled = false;
            iconoPerfil?.classList.remove('icono-spin');
            btnPerfil?.classList.remove('sincronizando');
        }
    }

    const FALTA_FRASE_AUTO = `${El} está cifrado y falta la frase: cargala en ${p.ajustes} con «Recordar» activado`;

    /**
     * El texto a subir: cifrado si hay una frase cargada, en claro si no. Antes de pisar algo cifrado comprueba que la frase lo
     * abra (si no, quien tenga la frase anterior ya no podría leerlo): a mano pide confirmación y la subida automática se frena.
     * Devuelve null si la persona canceló.
     * @returns {Promise<{ texto: string, cifrado: boolean, recienCifrado: boolean } | null>}
     */
    async function _contenidoParaSubir(respaldo, modoAutomatico) {
        const frase = FraseCifrado.disponible() ? FraseCifrado.actual() : '';
        if (!frase) {
            if (s.getCifrado()) {
                if (modoAutomatico) throw new Error(FALTA_FRASE_AUTO);
                const seguir = await GestorModales.confirmar(`${p.este} está cifrado y no hay una frase de cifrado cargada. Si seguís, ${p.riesgoEnClaro}`, 'Subir sin cifrar', '#icon-lock-open');
                if (!seguir) return null;
            }
            const salida = await ImportarExportar.textoRespaldo(respaldo);
            if ('error' in salida) throw new Error(salida.error);
            return { ...salida, recienCifrado: false };
        }

        let sal = null;
        let habiaEnClaro = false;
        const actual = await s.leerActual();
        if (actual !== null) {
            const abierto = await RespaldoCifrado.abrir(actual, frase);
            if ('datos' in abierto) {
                sal = abierto.sal;   // la del sobre anterior se reutiliza: no hay que derivar la clave de nuevo
                habiaEnClaro = !abierto.cifrado;
            } else if (abierto.codigo === 'descifrado') {
                if (modoAutomatico) throw new Error(`La frase guardada no abre ${p.el} (se cifró con otra): no se subió para no pisarlo`);
                const seguir = await GestorModales.confirmar(`La frase cargada no abre lo que hay en ${p.el}: se cifró con otra. Si seguís, se reemplaza y los dispositivos que tengan la frase anterior no van a poder leerlo.`, 'Reemplazar', '#icon-upload');
                if (!seguir) return null;
            }
        }
        const salida = await ImportarExportar.textoRespaldo(respaldo, frase, { sal });
        if ('error' in salida) throw new Error(salida.error);
        return { ...salida, recienCifrado: habiaEnClaro };
    }

    async function subir(modoAutomatico = false) {
        if (!_modal.guardarAntes()) return;
        await _conSpinner(p.btnSubir, 'Error al subir', async () => {
            if (!(await _modal.antesDeSubir(modoAutomatico))) return;
            const contenido = await _contenidoParaSubir(await ImportarExportar.armarRespaldo(EstadoApp.registros()), modoAutomatico);
            if (!contenido) return;
            await s.subir(contenido.texto);
            s.setCifrado(contenido.cifrado);
            _modal.alSincronizar();   // un respaldo recién creado: ya hay a dónde bajar, se habilita Bajar
            mostrarToast(contenido.cifrado ? `Datos respaldados ${p.en} (cifrados)` : `Datos respaldados ${p.en}`, 'success');
            if (contenido.recienCifrado) mostrarToast(p.avisoHistorial, 'info', 9000);
        });
    }

    /**
     * Texto bajado → respaldo. En claro se lee como siempre; cifrado se abre con la frase guardada y, si falta o no lo abre, con
     * la que se pide (a mano; la bajada automática se frena). La frase que lo abre queda como la frase de la app.
     * Devuelve null si la persona canceló.
     */
    async function _abrir(texto, modoAutomatico) {
        let frase = FraseCifrado.disponible() ? FraseCifrado.actual() : '';
        for (;;) {
            const abierto = await RespaldoCifrado.abrir(texto, frase, { exigirCifrado: s.getCifrado() });
            if ('datos' in abierto) {
                if (abierto.cifrado) {
                    s.setCifrado(true);
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
                const seguir = await GestorModales.confirmar(`${p.este} estaba cifrado y ahora está en claro. Si quitaste el cifrado desde otro dispositivo, podés seguir; si no, alguien lo cambió.`, 'Usar igual', '#icon-lock-open');
                if (!seguir) return null;
                s.setCifrado(false);
                continue;
            }
            if (modoAutomatico) throw new Error(abierto.codigo === 'sin-frase' ? FALTA_FRASE_AUTO : `La frase guardada no abre ${p.el} (se cifró con otra)`);
            const motivo = abierto.codigo === 'sin-frase' ? `${El} está cifrado. Escribí la frase con la que se subió.`
                : abierto.codigo === 'frase' ? abierto.error
                    : `La frase no abre ${p.el} (o su contenido fue alterado). Probá con otra.`;
            const pedida = await FraseModal.pedir(motivo);
            if (pedida === null) return null;
            frase = pedida;
        }
    }

    async function bajar(modoAutomatico = false) {
        if (!_modal.guardarAntes()) return;
        const desdeModal = $(p.modalId)?.classList.contains('show') ?? false;
        await _conSpinner(p.btnBajar, 'Error al bajar', async () => {
            if (!(await _modal.antesDeBajar(modoAutomatico))) return;
            const data = await _abrir(await s.bajar(), modoAutomatico);
            if (!data) return;
            const preparado = await ImportarExportar.prepararRespaldo(data, p.origen);
            if ('error' in preparado) return;
            const registrosNormalizados = preparado.registros;
            _merge = { registrosNormalizados, data, proveedor: p };
            _ultimoProveedorMerge = p;
            _mergeDesdeModal = desdeModal;

            if (modoAutomatico) {
                await mergeAplicar(ConfigSync.getMergeBehavior(), true);
            } else {
                const diff = ImportarExportar.calcularDiferencias(registrosNormalizados);
                const configCambios = ImportarExportar.calcularCambiosConfigImport(data);
                const resumenEl = $('gist-merge-resumen');
                if (resumenEl) GistResumenMerge.construir(resumenEl, diff, registrosNormalizados, configCambios, p.el);
                if (desdeModal) GestorModales.alternar(p.modalId, 'modal-gist-merge');
                else GestorModales.abrir('modal-gist-merge');
            }
        });
    }

    return {
        conectarModal, subir, bajar,
        /** Lo que llama el modal tras aplicar una bajada de este proveedor. */
        _alSincronizar: () => _modal.alSincronizar()
    };
}

/** Aplica la bajada que muestra el resumen (Combinar o Reemplazar). */
async function mergeAplicar(modo, modoAutomatico = false) {
    if (!_merge) return;
    const { registrosNormalizados, data, proveedor } = _merge;
    _merge = null;

    const { ok, vacio } = await ImportarExportar.restaurarRespaldo(data, registrosNormalizados, modo === 'merge' ? 'merge' : 'replace', { etiqueta: proveedor.etiqueta, cerrarImportar: false });
    if (ok) TarjetaFichaje.actualizarUI();
    if ((ok || vacio) && !modoAutomatico) _mergeCerrarOVolver(proveedor);
    if (ok) _alSincronizarDe(proveedor);
    _habilitarBajar(proveedor);
}

function mergeCancelar() {
    const proveedor = _merge?.proveedor || _ultimoProveedorMerge;
    _merge = null;
    if (!proveedor) { GestorModales.cerrar('modal-gist-merge'); return; }
    _habilitarBajar(proveedor);
    _mergeCerrarOVolver(proveedor);
    _alSincronizarDe(proveedor);   // se bajó aunque no se aplicó: la fecha de última sincronización cambió
}

/** @type {Map<Proveedor, () => void>} */
const _avisosSincronizacion = new Map();
function _alSincronizarDe(proveedor) { _avisosSincronizacion.get(proveedor)?.(); }

/**
 * Crea los flujos de un proveedor y los registra para el resumen compartido.
 * @param {Proveedor} proveedor
 */
function registrar(proveedor) {
    const flujos = crear(proveedor);
    _avisosSincronizacion.set(proveedor, flujos._alSincronizar);
    return { conectarModal: flujos.conectarModal, subir: flujos.subir, bajar: flujos.bajar, mergeAplicar, mergeCancelar };
}

export const SyncNube = { registrar, mergeAplicar, mergeCancelar };
