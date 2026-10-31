import { $ } from '../core/dom.js';

// ====================================================================
// AVISO DE ACTUALIZACIÓN — toast con barra de progreso mientras se descarga la versión nueva
// ====================================================================
// Aparece en cuanto el navegador detecta una versión nueva (no al terminar de descargarla): así se sabe que conviene
// dejar la app abierta unos segundos. Es un elemento propio, aparte de la cola de toasts, porque dura varios segundos y tiene barra y botón.
const AUTOCIERRE_LISTO_MS = 10000;
const AUTOCIERRE_ERROR_MS = 6000;

/** @type {'oculto' | 'descargando' | 'listo' | 'error'} */
let _estado = 'oculto';
let _timerCierre = null;

function _el() {
    return {
        aviso: $('toast-actualizacion'),
        texto: $('toast-act-texto'),
        barra: /** @type {HTMLProgressElement | null} */ (/** @type {unknown} */ ($('toast-act-progreso'))),
        recargar: $('toast-act-recargar')
    };
}

/** Porcentaje entero válido (0 a 100) o `null` si el valor no es un número. @param {any} valor */
export function porcentajeValido(valor) {
    if (valor === null || valor === undefined || valor === '') return null;
    const n = Number(valor);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : null;
}

/** @param {string} texto @param {{ porcentaje?: number | null, conBoton?: boolean, tipo?: string }} [opciones] */
function _mostrar(texto, { porcentaje = null, conBoton = false, tipo = 'info' } = {}) {
    const { aviso, texto: elTexto, barra, recargar } = _el();
    if (!aviso || !elTexto || !barra || !recargar) return;
    clearTimeout(_timerCierre);
    elTexto.textContent = texto;
    // sin valor la barra es indeterminada (animada); con valor muestra el avance
    if (porcentaje === null) barra.removeAttribute('value'); else barra.value = porcentaje;
    barra.hidden = tipo === 'error';
    recargar.hidden = !conBoton;
    aviso.dataset.tipo = tipo;
    aviso.hidden = false;
    // un cuadro después, para que la transición de entrada se vea
    requestAnimationFrame(() => aviso.classList.add('show'));
}

function ocultar() {
    clearTimeout(_timerCierre);
    _estado = 'oculto';
    const { aviso } = _el();
    if (!aviso) return;
    aviso.classList.remove('show');
    setTimeout(() => { if (_estado === 'oculto') aviso.hidden = true; }, 400);
}

/** Se detectó una versión nueva y empieza la descarga. */
function iniciar() {
    if (_estado === 'descargando') return;
    _estado = 'descargando';
    _mostrar('Descargando actualización…');
}

/** @param {any} porcentaje avance de la descarga, de 0 a 100 */
function progreso(porcentaje) {
    const p = porcentajeValido(porcentaje);
    if (p === null) return;
    if (_estado !== 'descargando') { if (_estado !== 'oculto') return; _estado = 'descargando'; }
    _mostrar(`Descargando actualización… ${p} %`, { porcentaje: p });
}

/** La versión nueva quedó descargada e instalada: se aplica al recargar. */
function listo() {
    _estado = 'listo';
    _mostrar('Actualización lista', { porcentaje: 100, conBoton: true, tipo: 'success' });
    _timerCierre = setTimeout(ocultar, AUTOCIERRE_LISTO_MS);
}

/** La descarga falló: se conserva la versión actual y se vuelve a intentar en la próxima apertura. */
function error() {
    _estado = 'error';
    _mostrar('No se pudo descargar la actualización', { tipo: 'error' });
    _timerCierre = setTimeout(ocultar, AUTOCIERRE_ERROR_MS);
}

function bindEventos() {
    $('toast-act-recargar')?.addEventListener('click', () => location.reload());
    $('toast-act-cerrar')?.addEventListener('click', ocultar);
}

export const AvisoActualizacion = { iniciar, progreso, listo, error, ocultar, bindEventos };
