import { STORAGE_KEYS } from './constantes.js';
import { Almacenamiento } from './almacenamiento.js';
import { siguienteEnCiclo } from './catalogo.js';

// ====================================================================
// MOTION
// ====================================================================
const MODOS = ['auto', 'on', 'off'];
const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
let modo = null;
let iniciado = false;

function _modo() {
    if (modo === null) {
        const guardado = Almacenamiento.getItem(STORAGE_KEYS.REDUCIR_ANIMACIONES, 'auto');
        modo = MODOS.includes(guardado) ? guardado : 'auto';
    }
    return modo;
}
function reducido() {
    const m = _modo();
    return m === 'on' || (m === 'auto' && mq.matches);
}
function _aplicar() {
    document.documentElement.setAttribute('data-motion', reducido() ? 'reduce' : 'full');
}
function init() {
    if (iniciado) return;
    iniciado = true;
    mq.addEventListener?.('change', _aplicar);
    _aplicar();
}
function setModo(nuevo) {
    if (!MODOS.includes(nuevo)) return;
    modo = nuevo;
    Almacenamiento.setItem(STORAGE_KEYS.REDUCIR_ANIMACIONES, nuevo);
    _aplicar();
}
function siguienteModo() {
    setModo(siguienteEnCiclo(MODOS, _modo()));
}
export const Movimiento = {
    init, reducido, setModo, siguienteModo, modo: _modo,
    scrollBehavior: () => (reducido() ? 'auto' : 'smooth')
};
