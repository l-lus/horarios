import { STORAGE_KEYS } from './constantes.js';
import { Almacenamiento } from './almacenamiento.js';
import { catalogoCiclico, opcionGuardada, siguienteEnCiclo } from './catalogo.js';

// ====================================================================
// ESTILO DE LOS DÍAS DEL CALENDARIO: estilo (forma) y variante
// ====================================================================
// El CSS solo mira <html data-estilo-calendario="..." data-variante-calendario="...">. Redondeado y Cuadrado comparten las variantes de aro
// (cambia solo la forma); la primera, 'legacy' (Relleno), es el relleno original. Mínimo tiene las suyas (barra o punto).
// Por defecto: Redondeado + Relleno.
// La variante se recuerda por familia: al pasar de Redondeado a Mínimo y volver, sigue la que estaba.
// tema-inicial.js aplica los dos atributos antes de que cargue la app (copia de estas listas: un test verifica que coincidan).
export const ESTILOS_CALENDARIO = Object.freeze([
    { id: 'redondeado', label: 'Redondeado', familia: 'aro' },
    { id: 'cuadrado', label: 'Cuadrado', familia: 'aro' },
    { id: 'minimo', label: 'Mínimo', familia: 'minimo' }
]);

export const VARIANTES_CALENDARIO = Object.freeze({
    aro: Object.freeze([
        { id: 'legacy', label: 'Relleno' },   // el relleno original (el id quedó de cuando era un estilo propio)
        { id: 'relleno-aro', label: 'Relleno con aro' },
        { id: 'aro-tinte', label: 'Aro con tinte' },
        { id: 'aro-grueso', label: 'Aro grueso' },
        { id: 'contorno-brillo', label: 'Contorno con brillo' }
    ]),
    minimo: Object.freeze([
        { id: 'subrayado', label: 'Subrayado' },
        { id: 'punto', label: 'Punto' }
    ])
});

/** Los estilos de antes (un solo valor por estilo) → estilo y variante. Para lo guardado y para los respaldos viejos. */
export const ESTILOS_CALENDARIO_ANTERIORES = Object.freeze({
    'legacy': ['redondeado', 'legacy'],
    'relleno-aro': ['redondeado', 'relleno-aro'],
    'cuadrado-aro': ['cuadrado', 'relleno-aro'],
    'aro-tinte': ['redondeado', 'aro-tinte'],
    'aro-grueso': ['redondeado', 'aro-grueso'],
    'contorno-brillo': ['redondeado', 'contorno-brillo'],
    'subrayado': ['minimo', 'subrayado'],
    'punto': ['minimo', 'punto']
});

const _catalogo = catalogoCiclico(ESTILOS_CALENDARIO, { porDefecto: 'redondeado', desconocidoEsPorDefecto: true });
const _guardado = opcionGuardada(STORAGE_KEYS.ESTILO_CALENDARIO, _catalogo);

/** Estilo que sigue al `id` en el ciclo (vuelve al primero al terminar; un id desconocido cuenta como el estilo por defecto). */
export const siguienteEstilo = _catalogo.siguiente;
export const etiquetaEstilo = _catalogo.etiqueta;

/** @param {string} estilo @returns {string | null} la familia de variantes del estilo */
const familiaDe = (estilo) => ESTILOS_CALENDARIO.find(e => e.id === estilo)?.familia ?? null;

/** ¿Es un mapa válido de variantes por familia? (lo que se guarda y viaja en el respaldo) @param {unknown} v */
export function esVariantesValidas(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
    return Object.entries(v).every(([familia, id]) => familia in VARIANTES_CALENDARIO && VARIANTES_CALENDARIO[familia].some(x => x.id === id));
}

/**
 * La variante elegida en cada familia. Cada una se valida por separado: una que ya no existe (o que no se eligió) vuelve a la primera
 * de su familia sin tocar las demás.
 * @returns {Record<string, string>}
 */
function variantes() {
    const guardadas = Almacenamiento.getObject(STORAGE_KEYS.ESTILO_CALENDARIO_VARIANTES, null);
    const g = guardadas && typeof guardadas === 'object' ? /** @type {Record<string, unknown>} */ (guardadas) : {};
    return Object.fromEntries(Object.entries(VARIANTES_CALENDARIO).map(([familia, lista]) =>
        [familia, lista.some(v => v.id === g[familia]) ? /** @type {string} */ (g[familia]) : lista[0].id]));
}

/** Los estilos de antes que quedaron guardados pasan a estilo + variante (una vez: después ya está en el formato nuevo). */
function _migrarGuardado() {
    const crudo = Almacenamiento.getItem(STORAGE_KEYS.ESTILO_CALENDARIO, null);
    const anterior = crudo ? ESTILOS_CALENDARIO_ANTERIORES[crudo] : null;
    if (!anterior) return;
    Almacenamiento.setItem(STORAGE_KEYS.ESTILO_CALENDARIO_VARIANTES, { ...variantes(), [familiaDe(anterior[0]) ?? 'aro']: anterior[1] });
    Almacenamiento.setItem(STORAGE_KEYS.ESTILO_CALENDARIO, anterior[0]);
    _guardado.olvidar();
}

const actual = () => _guardado.get();
/** La variante del estilo actual. */
function variante() {
    const familia = familiaDe(actual());
    return familia ? variantes()[familia] : null;
}

function _aplicar() {
    if (typeof document === 'undefined') return;
    const raiz = document.documentElement;
    raiz.setAttribute('data-estilo-calendario', actual());
    const v = variante();
    if (v) raiz.setAttribute('data-variante-calendario', v);
    else raiz.removeAttribute('data-variante-calendario');
}

function init() {
    _migrarGuardado();
    _aplicar();
}

/** Cambia el estilo. Acepta también los ids de antes (respaldos viejos): se convierten a estilo + variante. @param {string} id */
function setEstilo(id) {
    const anterior = ESTILOS_CALENDARIO_ANTERIORES[id];
    if (anterior) {
        Almacenamiento.setItem(STORAGE_KEYS.ESTILO_CALENDARIO_VARIANTES, { ...variantes(), [familiaDe(anterior[0]) ?? 'aro']: anterior[1] });
        id = anterior[0];
    }
    if (!_guardado.set(id)) return;
    _aplicar();   // el CSS lo anima solo (transiciones en .calendario-dia): sin bloquear ni esperar, cada toque cuenta
}

/** Fija las variantes de cada familia (al restaurar un respaldo). @param {unknown} v */
function setVariantes(v) {
    if (!esVariantesValidas(v)) return;
    Almacenamiento.setItem(STORAGE_KEYS.ESTILO_CALENDARIO_VARIANTES, { ...variantes(), .../** @type {object} */ (v) });
    _aplicar();
}

function siguiente() {
    setEstilo(siguienteEstilo(actual()));
}

/** Pasa a la variante siguiente del estilo actual (sin variantes, no hace nada). */
function siguienteVariante() {
    const familia = familiaDe(actual());
    if (!familia) return;
    const ids = VARIANTES_CALENDARIO[familia].map(x => x.id);
    Almacenamiento.setItem(STORAGE_KEYS.ESTILO_CALENDARIO_VARIANTES, { ...variantes(), [familia]: siguienteEnCiclo(ids, variantes()[familia]) });
    _aplicar();
}

function etiquetaVariante() {
    const familia = familiaDe(actual());
    const v = variante();
    return familia && v ? VARIANTES_CALENDARIO[familia].find(x => x.id === v)?.label ?? '' : '';
}

export const EstiloCalendario = {
    init, siguiente, actual, setEstilo, etiqueta: () => etiquetaEstilo(actual()),
    variante, variantes, setVariantes, siguienteVariante, etiquetaVariante, tieneVariantes: () => familiaDe(actual()) !== null
};
