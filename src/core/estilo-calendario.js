import { STORAGE_KEYS } from './constantes.js';
import { Almacenamiento } from './almacenamiento.js';
import { catalogoCiclico, opcionGuardada } from './catalogo.js';

// ====================================================================
// ESTILO DE LOS DÍAS DEL CALENDARIO: estilo (forma) y variante
// ====================================================================
// El CSS solo mira <html data-estilo-calendario data-familia-calendario data-variante-calendario>. Redondeado, Cuadrado y Cápsula son la familia
// "aro": comparten sus variantes (cambia solo la forma); la primera, 'legacy' (Relleno), es el relleno original. Mínimo es su propia familia
// (barra o punto). Por defecto: Redondeado + Relleno. Cada familia guarda su variante (como las subopciones de EstiloTarjeta): al pasar de
// Redondeado a Mínimo y volver, sigue la que estaba.
// Para el primer pintado (tema-inicial.js, que no puede importar módulos) se guardan además los tres atributos ya resueltos (CALENDARIO_ATRIBUTOS).
export const ESTILOS_CALENDARIO = Object.freeze([
    { id: 'redondeado', label: 'Redondeado', familia: 'aro' },
    { id: 'cuadrado', label: 'Cuadrado', familia: 'aro' },
    { id: 'capsula', label: 'Cápsula', familia: 'aro' },
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

/** Dónde guarda su variante cada familia. */
const CLAVES_VARIANTE = Object.freeze({ aro: STORAGE_KEYS.ESTILO_CALENDARIO_VARIANTE_ARO, minimo: STORAGE_KEYS.ESTILO_CALENDARIO_VARIANTE_MINIMO });
/** Clave de una versión de prueba que guardaba las variantes juntas ({ aro, minimo }): se pasa a las claves por familia y se borra. */
const CLAVE_VARIANTES_JUNTAS = 'estiloCalendarioVariantes';

const _estilos = catalogoCiclico(ESTILOS_CALENDARIO, { porDefecto: 'redondeado', desconocidoEsPorDefecto: true });
const _estiloGuardado = opcionGuardada(STORAGE_KEYS.ESTILO_CALENDARIO, _estilos);
/** Catálogo y opción guardada de la variante de cada familia. */
const _variantes = Object.fromEntries(Object.entries(VARIANTES_CALENDARIO).map(([fam, lista]) => {
    const catalogo = catalogoCiclico(lista, { desconocidoEsPorDefecto: true });
    return [fam, { catalogo, guardada: opcionGuardada(CLAVES_VARIANTE[fam], catalogo) }];
}));

/** Estilo que sigue al `id` en el ciclo (vuelve al primero al terminar; un id desconocido cuenta como el estilo por defecto). */
export const siguienteEstilo = _estilos.siguiente;
export const etiquetaEstilo = _estilos.etiqueta;

/** @param {string} estilo @returns {string} la familia de variantes del estilo */
const familiaDe = (estilo) => ESTILOS_CALENDARIO.find(e => e.id === estilo)?.familia ?? 'aro';

const actual = () => _estiloGuardado.get();
const familia = () => familiaDe(actual());
/** La variante del estilo actual. */
const variante = () => _variantes[familia()].guardada.get();
/** @returns {Record<string, string>} la variante elegida en cada familia */
const variantes = () => Object.fromEntries(Object.entries(_variantes).map(([fam, v]) => [fam, v.guardada.get()]));

/** ¿Es una variante de esa familia? (para validar los respaldos) @param {string} fam @param {unknown} id */
export const esVarianteValida = (fam, id) => !!_variantes[fam]?.catalogo.esValido(id);

function _aplicar() {
    if (typeof document === 'undefined') return;
    const atributos = { estilo: actual(), familia: familia(), variante: variante() };
    const raiz = document.documentElement;
    raiz.setAttribute('data-estilo-calendario', atributos.estilo);
    raiz.setAttribute('data-familia-calendario', atributos.familia);
    raiz.setAttribute('data-variante-calendario', atributos.variante);
    Almacenamiento.setItem(STORAGE_KEYS.CALENDARIO_ATRIBUTOS, Object.values(atributos).join(' '));
}

/** Fija la variante de una familia (sin aplicarla). @param {string} fam @param {unknown} id */
const _fijarVariante = (fam, id) => _variantes[fam]?.guardada.set(id) ?? false;

/** Lo guardado por versiones anteriores pasa al formato actual (una vez: después ya está así). */
function _migrarGuardado() {
    const juntas = Almacenamiento.getObject(CLAVE_VARIANTES_JUNTAS, null);
    if (juntas !== null) {
        if (typeof juntas === 'object') Object.entries(juntas).forEach(([fam, id]) => _fijarVariante(fam, id));
        Almacenamiento.removeItem(CLAVE_VARIANTES_JUNTAS);
    }
    const anterior = ESTILOS_CALENDARIO_ANTERIORES[Almacenamiento.getItem(STORAGE_KEYS.ESTILO_CALENDARIO, '') ?? ''];
    if (anterior) {
        _fijarVariante(familiaDe(anterior[0]), anterior[1]);
        _estiloGuardado.set(anterior[0]);
    }
}

function init() {
    _migrarGuardado();
    _aplicar();
}

/** Cambia el estilo. Acepta también los ids de antes (respaldos viejos): se convierten a estilo + variante. @param {string} id */
function setEstilo(id) {
    const anterior = ESTILOS_CALENDARIO_ANTERIORES[id];
    if (anterior) {
        _fijarVariante(familiaDe(anterior[0]), anterior[1]);
        id = anterior[0];
    }
    if (_estiloGuardado.set(id) || anterior) _aplicar();   // el CSS lo anima solo (transiciones en .calendario-dia): sin bloquear ni esperar
}

/** Fija la variante de una familia y la aplica (al restaurar un respaldo). @param {string} fam @param {unknown} id */
function setVariante(fam, id) {
    if (_fijarVariante(fam, id)) _aplicar();
}

function siguiente() {
    setEstilo(siguienteEstilo(actual()));
}

/** Pasa a la variante siguiente del estilo actual. */
function siguienteVariante() {
    const fam = familia();
    setVariante(fam, _variantes[fam].catalogo.siguiente(variante()));
}

/** Vuelve a leer lo guardado (después de restaurar un respaldo, que escribe el almacenamiento por su cuenta). */
function releer() {
    _estiloGuardado.olvidar();
    Object.values(_variantes).forEach(v => v.guardada.olvidar());
    _aplicar();
}

export const EstiloCalendario = {
    init, siguiente, actual, setEstilo, etiqueta: () => etiquetaEstilo(actual()), releer,
    familia, variante, variantes, setVariante, siguienteVariante,
    etiquetaVariante: () => _variantes[familia()].catalogo.etiqueta(variante())
};
