import { STORAGE_KEYS } from './constantes.js';
import { Almacenamiento } from './almacenamiento.js';

// ====================================================================
// ESTILO DE LOS DÍAS DEL CALENDARIO
// ====================================================================
// Cómo se dibuja cada día con registro: el CSS solo mira <html data-estilo-calendario="...">; 'legacy' es el estilo original (círculo relleno).
// tema-inicial.js lo aplica antes de que cargue la app, igual que el tema y data-motion.
export const ESTILOS_CALENDARIO = Object.freeze([
    { id: 'legacy', label: 'Legacy' },
    { id: 'contorno-brillo', label: 'Contorno con brillo' },
    { id: 'aro-grueso', label: 'Aro grueso' },
    { id: 'relleno-aro', label: 'Relleno con aro' },
    { id: 'subrayado', label: 'Subrayado' },
    { id: 'punto', label: 'Punto' },
    { id: 'solo-contorno', label: 'Solo contorno' }
]);

const ID_POR_DEFECTO = 'legacy';
const _esValido = id => ESTILOS_CALENDARIO.some(e => e.id === id);

/** Estilo que sigue al `id` en el ciclo (vuelve al primero al terminar; un id desconocido cuenta como el estilo por defecto). */
export function siguienteEstilo(id) {
    const idx = ESTILOS_CALENDARIO.findIndex(e => e.id === id);
    return ESTILOS_CALENDARIO[(Math.max(idx, 0) + 1) % ESTILOS_CALENDARIO.length].id;
}

export function etiquetaEstilo(id) {
    return (ESTILOS_CALENDARIO.find(e => e.id === id) ?? ESTILOS_CALENDARIO[0]).label;
}

let _estilo = null;

function actual() {
    if (_estilo === null) {
        const guardado = Almacenamiento.getItem(STORAGE_KEYS.ESTILO_CALENDARIO, ID_POR_DEFECTO);
        _estilo = _esValido(guardado) ? guardado : ID_POR_DEFECTO;
    }
    return _estilo;
}

function _aplicar() {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-estilo-calendario', actual());
}

function init() {
    _aplicar();
}

function setEstilo(id) {
    if (!_esValido(id)) return;
    _estilo = id;
    Almacenamiento.setItem(STORAGE_KEYS.ESTILO_CALENDARIO, id);
    _aplicar();
}

function siguiente() {
    setEstilo(siguienteEstilo(actual()));
}

export const EstiloCalendario = { init, actual, setEstilo, siguiente, etiqueta: () => etiquetaEstilo(actual()) };
