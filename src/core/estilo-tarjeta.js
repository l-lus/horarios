import { STORAGE_KEYS } from './constantes.js';
import { Almacenamiento } from './almacenamiento.js';
import { Preferencias } from './preferencias.js';

// ====================================================================
// ESTILO DE LA TARJETA DE ESTADO
// ====================================================================
// Cómo se dibuja el registro del día en la tarjeta de arriba. Los dos primeros son la barra de siempre (la clásica, con el texto de la salida estimada
// debajo, y la barra con hitos, que es el antiguo "hint integrado"); los demás son diseños propios que reemplazan el número, la barra y los textos
// en la vista diaria (la vista semanal sigue con la barra). Es una opción de la instalación, no del perfil.
// Sin valor guardado se deduce de HINT_INTEGRADO, así quien ya usaba la app ve lo mismo que antes.
export const ESTILOS_TARJETA = Object.freeze([
    { id: 'hitos', label: 'Barra con hitos' },
    { id: 'clasica', label: 'Clásica' },
    { id: 'anillo', label: 'Anillo' },
    { id: 'linea', label: 'Línea de tiempo' },
    { id: 'filas', label: 'Lista de filas' },
    { id: 'tipografica', label: 'Tipográfica' }
]);

/** Estilos con diseño propio: dibujan la vista diaria en `#stats-estilo` en vez de la barra. */
const ESTILOS_PROPIOS = Object.freeze(['anillo', 'linea', 'filas', 'tipografica']);

const _esValido = id => ESTILOS_TARJETA.some(e => e.id === id);

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

function actual() {
    if (_estilo === null) {
        const guardado = Almacenamiento.getItem(STORAGE_KEYS.ESTILO_TARJETA, null);
        _estilo = _esValido(guardado) ? guardado : (Preferencias.HINT_INTEGRADO.get() ? 'hitos' : 'clasica');
    }
    return _estilo;
}

function _aplicar() {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-estilo-tarjeta', actual());
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
    _aplicar();
}

/** Un respaldo viejo solo trae el interruptor del hint integrado: equivale a la barra con hitos o a la clásica. */
function desdeHintIntegrado(activo) {
    setEstilo(activo ? 'hitos' : 'clasica');
}

export const EstiloTarjeta = {
    init, actual, setEstilo, siguiente, releer, desdeHintIntegrado,
    etiqueta: () => etiquetaEstilo(actual()),
    /** ¿La barra lleva los hitos dibujados encima (el antiguo hint integrado)? */
    hintIntegrado: () => actual() === 'hitos',
    /** ¿La vista diaria usa un diseño propio en vez de la barra? */
    propio: () => esEstiloPropio(actual())
};
