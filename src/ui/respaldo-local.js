import { $, setColapsable } from '../core/dom.js';
import { TiempoUtils } from '../core/tiempo-utils.js';
import { UIBase } from './base.js';
import { SeguridadYUtils as S } from '../core/seguridad.js';
import { EstadoApp } from '../services/estado-app.js';
import { ImportarExportar } from '../services/importar-exportar.js';
import { setIconoBtn } from './boton-fichar.js';
import { mostrarToast } from './toast.js';
import { CampoFrase } from './campo-frase.js';
import { FraseCifrado } from '../services/frase-cifrado.js';

// ====================================================================
//                     UI LOCAL BACKUP MODULE (Import / Export JSON)
// ====================================================================
const ESPERA_MODAL_MS = 50;   // deja abrir el modal antes de lanzar el selector de archivos

const { descargarArchivo, obtenerNombrePerfilSafe, _setBtnActivo, _abrirModalConPadre, _cerrarModalConPadre } = UIBase;

// «Cifrar con la frase» (opcional): es la misma frase del Gist; sin marcar, el archivo sale en claro como siempre
const _campoFrase = new CampoFrase({ input: 'export-frase', ojo: 'btn-export-frase-ver', generar: 'btn-export-frase-generar' });

const _cifrarExportacion = () => !!$('btn-toggle-export-cifrar')?.classList.contains('btn-activo');

function _setCifrarExportacion(activo, animar = true) {
    _setBtnActivo('btn-toggle-export-cifrar', activo);
    setColapsable($('export-frase-bloque'), activo, { animar });
}

/** La frase con la que sale el archivo ('' = sin cifrar), o null si se pidió cifrar y lo escrito no sirve (ya se avisó). */
function _fraseParaExportar() {
    if (!_cifrarExportacion()) return '';
    if (!_campoFrase.confirmar({ permitirVacia: false })) return null;
    return FraseCifrado.actual();
}

// Respaldar y Restaurar se abren desde Ajustes (y al cerrar vuelven ahí) o desde la barra del histórico (y al cerrar no queda
// nada abierto): UIBase._abrirModalConPadre y _cerrarModalConPadre resuelven los dos casos según haya o no un modal a la vista.
function _actualizarBotonVolver(id, desdeLista) {
    const btn = $(id);
    if (!btn) return;
    if (btn.lastChild) btn.lastChild.textContent = desdeLista ? ' Cerrar' : ' Volver';
    setIconoBtn(btn, desdeLista ? '#icon-cancelar' : '#icon-undo');
}

function mostrarImportar(desdeLista = false) {
    _abrirModalConPadre('modal-importar', () => {
        $('file-import').value = '';

        const nombreEl = $('nombre-archivo-seleccionado');
        if (nombreEl) {
            nombreEl.classList.add('hidden');
            nombreEl.textContent = '';
        }

        const btnCombinar = $('btn-combinar');
        const btnReemplazar = $('btn-reemplazar');

        if (btnCombinar) {
            btnCombinar.disabled = true;
        }
        if (btnReemplazar) {
            btnReemplazar.disabled = true;
        }

        _actualizarBotonVolver('btn-volver-importar', desdeLista);
        setTimeout(() => $('file-import').click(), ESPERA_MODAL_MS);
    });
}

function cerrarImportar() {
    $('file-import').value = '';
    _cerrarModalConPadre('modal-importar');
}

function mostrarExportar(desdeLista = false) {
    _abrirModalConPadre('modal-exportar', () => {
        const tipoSelect = $('tipo-exportacion');
        if (tipoSelect) tipoSelect.value = 'todo';

        setColapsable($('campos-rango-exportar'), false, { animar: false });

        $('export-fecha-desde').value = '';
        $('export-fecha-hasta').value = '';

        _campoFrase.cargar();
        _setCifrarExportacion(FraseCifrado.disponible(), false);

        _actualizarBotonVolver('btn-volver-exportar', desdeLista);
    });
}

function cerrarExportar() {
    _cerrarModalConPadre('modal-exportar');
}

function toggleCamposRangoExport() {
    const tipo = $('tipo-exportacion').value;
    setColapsable($('campos-rango-exportar'), tipo === 'rango');
}

async function ejecutarExportacion() {
    const tipo = $('tipo-exportacion').value;
    const btn = /** @type {HTMLButtonElement} */ (document.querySelector('#modal-exportar .btn-export'));

    const frase = _fraseParaExportar();
    if (frase === null) return;

    btn.disabled = true;

    try {
        if (tipo === 'todo') {
            ImportarExportar.exportarJSON(frase);
            cerrarExportar();

        } else if (tipo === 'mes-actual') {
            const mesActual = TiempoUtils.claveMes(TiempoUtils.obtenerFechaHoy());
            await exportarRango(mesActual, mesActual, true, frase);

        } else if (tipo === 'rango') {
            const desde = S.limpiarTexto($('export-fecha-desde').value, 10);
            const hasta = S.limpiarTexto($('export-fecha-hasta').value, 10);

            if (!desde || !hasta) {
                mostrarToast('Completá ambas fechas', 'error');
                btn.disabled = false;
                return;
            }

            if (!TiempoUtils.validarFecha(desde) || !TiempoUtils.validarFecha(hasta)) {
                mostrarToast('Fechas inválidas', 'error');
                btn.disabled = false;
                return;
            }

            if (desde > hasta) {
                mostrarToast('La fecha inicial debe ser anterior a la final', 'error');
                btn.disabled = false;
                return;
            }

            await exportarRango(desde, hasta, false, frase);
        }

    } catch (error) {
        console.error('Error en exportación:', error);
        mostrarToast('Error al exportar', 'error');
    } finally {
        btn.disabled = false;
    }
}

function _filtrarRegistrosRango(desde, hasta, esMes) {
    if (esMes) {
        const [año, mes] = desde.split('-').map(Number);
        return EstadoApp.registros().filter(r => TiempoUtils.esDelMes(r.fecha, año, mes));
    }
    return EstadoApp.registros().filter(r => r.fecha >= desde && r.fecha <= hasta);
}

async function exportarRango(desde, hasta, esMes = false, frase = '') {
    const registrosFiltrados = _filtrarRegistrosRango(desde, hasta, esMes);
    if (registrosFiltrados.length === 0) { mostrarToast('No hay registros en ese rango', 'warning'); return; }

    const fechaLocal = TiempoUtils.fechaLocalISOFull();
    const fechaHoy = fechaLocal.substring(0, 10);

    const data = await ImportarExportar.armarRespaldo(registrosFiltrados, {
        rangoExportado: S.limpiarTexto(esMes ? `Mes ${desde}` : `${desde} a ${hasta}`, 100)
    });

    try {
        const salida = await ImportarExportar.textoRespaldo(data, frase);
        if ('error' in salida) { mostrarToast(salida.error, 'error'); return; }
        const sufijo = esMes ? `_${desde}` : `_${desde}_${hasta}`;
        descargarArchivo(salida.texto, ImportarExportar.nombreArchivoRespaldo(`Horarios_${obtenerNombrePerfilSafe()}${sufijo}_${fechaHoy}`, salida.cifrado), 'application/json');
        mostrarToast(`Exportados ${registrosFiltrados.length} registros${esMes ? ' del mes' : ''}${salida.cifrado ? ' (archivo cifrado)' : ''}`, 'success');
        cerrarExportar();
    } catch (e) {
        console.error(e);
        mostrarToast('Error al exportar', 'error');
    }
}


function bindEventos() {
    _campoFrase.vincular();
    $('btn-toggle-export-cifrar')?.addEventListener('click', () => _setCifrarExportacion(!_cifrarExportacion()));
}

export const RespaldoLocal = {
    bindEventos,
    mostrarImportar,
    cerrarImportar,
    mostrarExportar,
    cerrarExportar,
    ejecutarExportacion,
    toggleCamposRangoExport
};
