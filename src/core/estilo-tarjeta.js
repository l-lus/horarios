import { STORAGE_KEYS } from './constantes.js';
import { Almacenamiento } from './almacenamiento.js';
import { Preferencias } from './preferencias.js';

// ====================================================================
// ESTILO DE LA TARJETA DE ESTADO
// ====================================================================
// Cómo se dibuja el registro del día en la tarjeta de arriba. La clásica (el predeterminado) y la barra con hitos (el antiguo "hint integrado") son la barra de
// siempre; los demás son diseños propios que reemplazan el número, la barra y los textos, tanto en la vista diaria como en la semanal. Es una opción de la
// instalación, no del perfil. Sin valor guardado se usa la clásica, salvo que el interruptor antiguo HINT_INTEGRADO estuviera activo (entonces, la barra con hitos).
export const ESTILOS_TARJETA = Object.freeze([
    { id: 'clasica', label: 'Clásica' },
    { id: 'linea', label: 'Línea de tiempo' },
    { id: 'filas', label: 'Lista de filas' },
    { id: 'anillo', label: 'Anillo' },
    { id: 'hitos', label: 'Barra con hitos' }
]);

/** Estilos con diseño propio: dibujan la tarjeta en `#stats-estilo` en vez de la barra. */
const ESTILOS_PROPIOS = Object.freeze(['linea', 'filas', 'anillo']);

const _esValido = id => ESTILOS_TARJETA.some(e => e.id === id);

// Subvariante del estilo "Línea de tiempo": en una tarjeta ancha (PC) elige cómo se reparte la tarjeta: el tiempo trabajado arriba de la línea (como en el móvil), el tiempo
// a la izquierda o a la derecha de la línea, o los mosaicos "Faltan" y "Banco de horas" apilados a la izquierda o a la derecha.
// El CSS solo mira <html data-disposicion-linea> (y el ancho de la tarjeta), así que cambiarla no redibuja nada.
export const DISPOSICIONES_LINEA = Object.freeze([
    { id: 'arriba', label: 'Arriba' },
    { id: 'izquierda', label: 'Tiempo a la izquierda' },
    { id: 'derecha', label: 'Tiempo a la derecha' },
    { id: 'mosaicos-izquierda', label: 'Mosaicos a la izquierda' },
    { id: 'mosaicos-derecha', label: 'Mosaicos a la derecha' }
]);

const _disposicionValida = id => DISPOSICIONES_LINEA.some(d => d.id === id);

// Subvariante para la tarjeta angosta (móvil): los mosaicos "Faltan" y "Banco de horas" abajo (como siempre) o apilados a la derecha, al lado del tiempo y la línea.
export const MOSAICOS_LINEA = Object.freeze([
    { id: 'abajo', label: 'Abajo' },
    { id: 'derecha', label: 'A la derecha' }
]);

const _mosaicosValido = id => MOSAICOS_LINEA.some(m => m.id === id);

/** Posición que sigue a `id` en el ciclo (un id desconocido cuenta como la primera). */
export function siguienteMosaicos(id) {
    const idx = MOSAICOS_LINEA.findIndex(m => m.id === id);
    return MOSAICOS_LINEA[(idx + 1) % MOSAICOS_LINEA.length].id;
}

export function etiquetaMosaicos(id) {
    return (MOSAICOS_LINEA.find(m => m.id === id) ?? MOSAICOS_LINEA[0]).label;
}

/** Disposición que sigue a `id` en el ciclo (un id desconocido cuenta como la primera). */
export function siguienteDisposicion(id) {
    const idx = DISPOSICIONES_LINEA.findIndex(d => d.id === id);
    return DISPOSICIONES_LINEA[(idx + 1) % DISPOSICIONES_LINEA.length].id;
}

export function etiquetaDisposicion(id) {
    return (DISPOSICIONES_LINEA.find(d => d.id === id) ?? DISPOSICIONES_LINEA[0]).label;
}

/** Estilo que sigue al `id` en el ciclo (vuelve al primero al terminar; un id desconocido cuenta como el primero). */
export function siguienteEstilo(id) {
    const idx = ESTILOS_TARJETA.findIndex(e => e.id === id);
    return ESTILOS_TARJETA[(idx + 1) % ESTILOS_TARJETA.length].id;
}

export function etiquetaEstilo(id) {
    return (ESTILOS_TARJETA.find(e => e.id === id) ?? ESTILOS_TARJETA[0]).label;
}

export const esEstiloPropio = id => ESTILOS_PROPIOS.includes(id);

let _estilo = null;
let _disposicion = null;
let _mosaicos = null;

function actual() {
    if (_estilo === null) {
        const guardado = Almacenamiento.getItem(STORAGE_KEYS.ESTILO_TARJETA, null);
        _estilo = _esValido(guardado) ? guardado : (Preferencias.HINT_INTEGRADO.get() ? 'hitos' : 'clasica');
    }
    return _estilo;
}

function disposicion() {
    if (_disposicion === null) {
        const guardado = Almacenamiento.getItem(STORAGE_KEYS.LINEA_DISPOSICION, null);
        _disposicion = _disposicionValida(guardado) ? guardado : DISPOSICIONES_LINEA[0].id;
    }
    return _disposicion;
}

function mosaicos() {
    if (_mosaicos === null) {
        const guardado = Almacenamiento.getItem(STORAGE_KEYS.LINEA_MOSAICOS, null);
        _mosaicos = _mosaicosValido(guardado) ? guardado : MOSAICOS_LINEA[0].id;
    }
    return _mosaicos;
}

function setMosaicos(id) {
    if (!_mosaicosValido(id)) return;
    _mosaicos = id;
    Almacenamiento.setItem(STORAGE_KEYS.LINEA_MOSAICOS, id);
    _aplicar();
}

function _aplicar() {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-estilo-tarjeta', actual());
    document.documentElement.setAttribute('data-disposicion-linea', disposicion());
    document.documentElement.setAttribute('data-mosaicos-linea', mosaicos());
}

function setDisposicion(id) {
    if (!_disposicionValida(id)) return;
    _disposicion = id;
    Almacenamiento.setItem(STORAGE_KEYS.LINEA_DISPOSICION, id);
    _aplicar();
}

function init() {
    _aplicar();
}

function setEstilo(id) {
    if (!_esValido(id)) return;
    _estilo = id;
    Almacenamiento.setItem(STORAGE_KEYS.ESTILO_TARJETA, id);
    _aplicar();
}

function siguiente() {
    setEstilo(siguienteEstilo(actual()));
}

/** Vuelve a leer el estilo guardado (después de restaurar un respaldo, que escribe el almacenamiento por su cuenta). */
function releer() {
    _estilo = null;
    _disposicion = null;
    _mosaicos = null;
    _aplicar();
}

/** Un respaldo viejo solo trae el interruptor del hint integrado: equivale a la barra con hitos o a la clásica. */
function desdeHintIntegrado(activo) {
    setEstilo(activo ? 'hitos' : 'clasica');
}

export const EstiloTarjeta = {
    init, actual, setEstilo, siguiente, releer, desdeHintIntegrado, disposicion, setDisposicion,
    siguienteDisposicion: () => setDisposicion(siguienteDisposicion(disposicion())),
    etiquetaDisposicion: () => etiquetaDisposicion(disposicion()),
    mosaicos, setMosaicos,
    siguienteMosaicos: () => setMosaicos(siguienteMosaicos(mosaicos())),
    etiquetaMosaicos: () => etiquetaMosaicos(mosaicos()),
    etiqueta: () => etiquetaEstilo(actual()),
    /** ¿La barra lleva los hitos dibujados encima (el antiguo hint integrado)? */
    hintIntegrado: () => actual() === 'hitos',
    /** ¿La vista diaria usa un diseño propio en vez de la barra? */
    propio: () => esEstiloPropio(actual())
};
