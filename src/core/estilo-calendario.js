import { STORAGE_KEYS } from './constantes.js';
import { catalogoCiclico, opcionGuardada } from './catalogo.js';

// ====================================================================
// ESTILO DE LOS DÍAS DEL CALENDARIO
// ====================================================================
// Cómo se dibuja cada día con registro: el CSS solo mira <html data-estilo-calendario="...">; 'legacy' es el estilo original (círculo relleno).
// tema-inicial.js lo aplica antes de que cargue la app, igual que el tema y data-motion.
// El orden del ciclo agrupa los estilos por parecido, de más a menos peso visual: primero los de relleno (el original y sus variantes con aro),
// luego los de aro (del grueso al fino con brillo) y al final los que solo marcan con una barra o un punto
export const ESTILOS_CALENDARIO = Object.freeze([
    { id: 'legacy', label: 'Legacy' },
    { id: 'relleno-aro', label: 'Relleno con aro' },
    { id: 'cuadrado-aro', label: 'Cuadrado con aro' },
    { id: 'aro-tinte', label: 'Aro con tinte' },
    { id: 'aro-grueso', label: 'Aro grueso' },
    { id: 'contorno-brillo', label: 'Contorno con brillo' },
    { id: 'subrayado', label: 'Subrayado' },
    { id: 'punto', label: 'Punto' }
]);

const _catalogo = catalogoCiclico(ESTILOS_CALENDARIO, { porDefecto: 'legacy', desconocidoEsPorDefecto: true });
const _guardado = opcionGuardada(STORAGE_KEYS.ESTILO_CALENDARIO, _catalogo);

/** Estilo que sigue al `id` en el ciclo (vuelve al primero al terminar; un id desconocido cuenta como el estilo por defecto). */
export const siguienteEstilo = _catalogo.siguiente;
export const etiquetaEstilo = _catalogo.etiqueta;

const actual = () => _guardado.get();

function _aplicar() {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-estilo-calendario', actual());
}

function init() {
    _aplicar();
}

function setEstilo(id) {
    if (!_guardado.set(id)) return;
    _aplicar();   // el CSS lo anima solo (transiciones en .calendario-dia): sin bloquear ni esperar, cada toque cuenta
}

function siguiente() {
    setEstilo(siguienteEstilo(actual()));
}

export const EstiloCalendario = { init, siguiente, actual, setEstilo, etiqueta: () => etiquetaEstilo(actual()) };
