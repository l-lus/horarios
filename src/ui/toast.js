import { $ } from '../core/dom.js';
import { SeguridadYUtils as S } from '../core/seguridad.js';
import { Animaciones } from './animaciones.js';
import { registrarSwipe } from './gestos.js';

const { _esperarAnim } = Animaciones;

// ====================================================================
// TOAST — cola de avisos
// ====================================================================

let toastTimeout = null;
let _toastQueue = [];
let _toastRunning = false;
let _toastAccionActual = null;
const MAX_TOAST_QUEUE = 4;

export function mostrarToast(mensaje, tipo = 'info', duracion = 3000, detalle = null, accion = null) {
    const texto = detalle ? `${mensaje}, ${detalle}` : mensaje;
    const textoLimpio = S.sanitizeString(texto, 200);
    const ultimo = _toastQueue[_toastQueue.length - 1];
    const actual = _toastRunning ? $('toast')?.textContent : null;
    if ((ultimo && ultimo.mensaje === textoLimpio) || actual === textoLimpio) return;
    _toastQueue.push({ mensaje: textoLimpio, tipo, duracionBase: duracion, accion });
    if (_toastQueue.length > MAX_TOAST_QUEUE) {
        _toastQueue.splice(0, _toastQueue.length - MAX_TOAST_QUEUE);
    }
    if (!_toastRunning) _procesarToastQueue();
}

function _procesarToastQueue() {
    if (_toastQueue.length === 0) {
        _toastRunning = false;
        _toastAccionActual = null;
        return;
    }

    _toastRunning = true;
    const actual = _toastQueue.shift();
    _toastAccionActual = actual.accion || null;
    const toast = $('toast');
    toast.classList.remove('show');
    toast.textContent = actual.mensaje;
    toast.className = `toast ${actual.tipo}`;
    toast.classList.toggle('toast-accionable', !!actual.accion);
    let duracionFinal = actual.duracionBase || 3000;
    if (_toastQueue.length >= 1) {
        duracionFinal = Math.floor(duracionFinal / 2);
    }

    setTimeout(() => {
        toast.classList.add('show');
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
            toastTimeout = null;
            _esperarAnim().then(() => _procesarToastQueue());
        }, duracionFinal);
    }, 10);
}

export function _cerrarToastActual() {
    if (toastTimeout) { clearTimeout(toastTimeout); toastTimeout = null; }
    const toast = $('toast');
    if (!toast || !toast.classList.contains('show')) return;
    toast.classList.remove('show');
    _esperarAnim().then(() => _procesarToastQueue());
}

export function _habilitarCierreToast() {
    const toast = $('toast');
    if (!toast || toast.dataset.cierreInit) return;
    toast.dataset.cierreInit = '1';
    toast.addEventListener('click', () => {
        const accion = _toastAccionActual;
        _cerrarToastActual();
        if (accion) accion();
    });
    registrarSwipe(toast, () => _cerrarToastActual(), { minX: 40 });
}
