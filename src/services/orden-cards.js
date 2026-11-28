import { CARDS_ORDEN, STORAGE_KEYS } from '../core/constantes.js';

// ====================================================================
// ORDEN Y COLUMNAS DE LAS TARJETAS (sin DOM)
// ====================================================================
// El orden es una lista con todas las tarjetas, ocultas incluidas. En escritorio esa lista se corta en columnas según los tamaños guardados
// (ej. [3, 1] = 3 tarjetas en la primera columna y 1 en la segunda); en móvil se muestra apilada. La tarjeta de estado ('estado') nunca se oculta.
// Reparto por defecto: Registros y la de atajos (las últimas del orden por defecto) van a la segunda columna. Se cuentan las que hay
// en el orden recibido y se toman otras tantas del final (con un orden sin atajos, solo la última).
const CARDS_A_LA_DERECHA = ['historico', 'atajos'];
const _enDerechaPorDefecto = (orden) => Math.max(1, orden.filter(c => CARDS_A_LA_DERECHA.includes(c)).length);
export const MAX_COLUMNAS = 3;

/**
 * Qué se guarda para cada modo de columnas (1 = móvil apilado, 2 y 3 = escritorio): cada uno tiene su propio orden, y los de 2 y 3 también sus tamaños.
 * @typedef {1 | 2 | 3} ModoColumnas
 * @param {ModoColumnas} modo
 * @returns {{ orden: string, columnas: string | null }}
 */
export function clavesDeLayout(modo) {
    if (modo === 1) return { orden: STORAGE_KEYS.ORDEN_CARDS_MOVIL, columnas: null };
    if (modo === 3) return { orden: STORAGE_KEYS.ORDEN_CARDS_3, columnas: STORAGE_KEYS.COLUMNAS_CARDS_3 };
    return { orden: STORAGE_KEYS.ORDEN_CARDS, columnas: STORAGE_KEYS.COLUMNAS_CARDS };
}

/**
 * Orden y tamaños de columna de un modo, tal como están guardados. Un modo sin orden propio parte del de 2 columnas (móvil y 3 columnas);
 * los tamaños van con el orden, así que con 3 columnas sin orden propio se usan también los de 2.
 * @param {ModoColumnas} modo
 * @param {(clave: string) => unknown} leer lee una clave guardada (null si no existe)
 * @returns {{ orden: string[], tamanos: unknown }}
 */
export function leerLayout(modo, leer) {
    const propio = clavesDeLayout(modo);
    const base = clavesDeLayout(2);
    const guardado = leer(propio.orden);
    const claveTamanos = modo === 3 && !guardado ? base.columnas : propio.columnas;
    const crudo = guardado ?? leer(base.orden);
    const orden = normalizarOrdenCards(crudo);
    return { orden, tamanos: sumarTarjetasNuevas(crudo, orden, claveTamanos ? leer(claveTamanos) : null) };
}

/**
 * Tamaños guardados antes de que existiera una tarjeta (ej. la de atajos) → tamaños para el orden con ella: cada tarjeta nueva suma uno
 * a la columna donde normalizarOrdenCards la ubicó (la de la tarjeta anterior; la primera, si va primera). Así el diseño que ya había
 * elegido el usuario no se corre de columna. Si los tamaños no corresponden a las tarjetas que ya estaban, se devuelven sin tocar.
 * @param {unknown} guardado el orden tal como estaba guardado
 * @param {readonly string[]} orden el mismo orden ya normalizado
 * @param {unknown} tamanos
 */
export function sumarTarjetasNuevas(guardado, orden, tamanos) {
    if (!Array.isArray(guardado) || !Array.isArray(tamanos)) return tamanos;
    const previas = orden.filter(c => guardado.includes(c));
    if (previas.length === orden.length || !esTamanosColumnasValidos(tamanos, previas.length)) return tamanos;
    let desde = 0;
    const columnas = /** @type {number[]} */ (tamanos).map(n => { const col = previas.slice(desde, desde + n); desde += n; return col; });
    orden.forEach((c, i) => {
        if (previas.includes(c)) return;
        if (i === 0) { columnas[0].unshift(c); return; }
        const col = columnas.find(cs => cs.includes(orden[i - 1])) ?? columnas[columnas.length - 1];
        col.splice(col.indexOf(orden[i - 1]) + 1, 0, c);
    });
    return columnas.map(c => c.length);
}

/**
 * Orden guardado → orden válido. Descarta lo desconocido y repetido; una tarjeta que no estaba cuando se guardó (agregada en una versión posterior)
 * entra en el lugar que le toca por defecto, sin tocar el orden que ya había elegido el usuario.
 * @param {unknown} guardado
 * @param {readonly string[]} [cards]
 */
export function normalizarOrdenCards(guardado, cards = CARDS_ORDEN) {
    const orden = Array.isArray(guardado) ? [...new Set(guardado.filter(c => cards.includes(c)))] : [];
    cards.forEach((c, i) => {
        if (!orden.includes(c)) orden.splice(Math.min(i, orden.length), 0, c);
    });
    return orden;
}

/**
 * ¿Son tamaños de columna válidos? Hasta MAX_COLUMNAS números enteros: la primera puede ser 0 (formato de la versión anterior), las demás al menos 1.
 * @param {unknown} tamanos
 * @param {number} [total] si se indica, además deben sumar ese total
 */
export function esTamanosColumnasValidos(tamanos, total) {
    if (!Array.isArray(tamanos) || tamanos.length < 1 || tamanos.length > MAX_COLUMNAS) return false;
    if (!tamanos.every((n, i) => Number.isInteger(n) && n >= (i === 0 ? 0 : 1))) return false;
    return total === undefined || tamanos.reduce((a, b) => a + b, 0) === total;
}

/**
 * Corta el orden en columnas. Sin tamaños válidos (nunca se movieron, o ya no coinciden con las tarjetas) usa el reparto por defecto.
 * @param {readonly string[]} orden
 * @param {unknown} [tamanos]
 * @returns {string[][]}
 */
export function columnasDesdeOrden(orden, tamanos = null) {
    const total = orden.length;
    let t = null;
    if (esTamanosColumnasValidos(tamanos, total)) {
        t = /** @type {number[]} */ (tamanos);
    } else if (esTamanosColumnasValidos(tamanos, total - 1)) {
        // Guardados cuando la tarjeta de estado no era movible: ella iba siempre arriba de la primera columna
        t = [/** @type {number[]} */ (tamanos)[0] + 1, .../** @type {number[]} */ (tamanos).slice(1)];
    }
    const enDerecha = _enDerechaPorDefecto(orden);
    t ??= total > enDerecha ? [total - enDerecha, enDerecha] : [total];
    let desde = 0;
    return t.map(n => { const col = orden.slice(desde, desde + n); desde += n; return col; }).filter(col => col.length > 0);
}

/** @param {readonly (readonly string[])[]} columnas */
export const tamanosDeColumnas = (columnas) => columnas.map(c => c.length);

/**
 * Columnas tal como se dibujan: una columna sin tarjetas visibles se funde con la anterior (la primera, con la siguiente),
 * y si hay más que `max` las sobrantes pasan a la última. No toca lo guardado: al mostrar de nuevo una tarjeta oculta, vuelve a su columna.
 * @param {readonly (readonly string[])[]} columnas
 * @param {number} [max]
 * @param {ReadonlySet<string> | null} [visibles] tarjetas visibles (null = todas)
 * @returns {string[][]}
 */
export function prepararColumnas(columnas, max = MAX_COLUMNAS, visibles = null) {
    /** @type {string[][]} */
    const res = [];
    columnas.forEach(col => {
        if (res.length && !col.some(c => !visibles || visibles.has(c))) res[res.length - 1].push(...col);
        else res.push([...col]);
    });
    if (res.length > 1 && !res[0].some(c => !visibles || visibles.has(c))) res[1].unshift(...(/** @type {string[]} */ (res.shift())));
    while (res.length > max) {
        const sobrante = /** @type {string[]} */ (res.pop());
        res[res.length - 1].push(...sobrante);
    }
    return res;
}

/**
 * Mueve una tarjeta a `colDestino` (si es igual a la cantidad de columnas, abre una nueva), delante de `antesDe` o al final.
 * Las columnas que quedan vacías desaparecen. Devuelve las columnas nuevas, o null si no hay cambio
 * o el resultado superaría `max` columnas con tarjetas visibles. Con `exigirDosColumnas` tampoco deja una sola columna con
 * tarjetas visibles si antes había más de una (la página nunca queda en una sola columna por un movimiento).
 * @param {readonly (readonly string[])[]} columnas
 * @param {string} id
 * @param {number} colDestino
 * @param {string | null} [antesDe]
 * @param {{ max?: number, visibles?: ReadonlySet<string> | null, exigirDosColumnas?: boolean }} [opciones]
 * @returns {string[][] | null}
 */
export function moverCard(columnas, id, colDestino, antesDe = null, { max = MAX_COLUMNAS, visibles = null, exigirDosColumnas = false } = {}) {
    const nuevas = columnas.map(c => c.filter(x => x !== id));
    if (colDestino >= nuevas.length) {
        nuevas.push([id]);
    } else {
        const destino = nuevas[Math.max(0, colDestino)];
        const i = antesDe ? destino.indexOf(antesDe) : -1;
        destino.splice(i === -1 ? destino.length : i, 0, id);
    }
    const resultado = nuevas.filter(c => c.length > 0);
    const esVisible = (x) => !visibles || visibles.has(x);
    const columnasVisibles = (cols) => cols.filter(c => c.some(esVisible)).length;
    if (columnasVisibles(resultado) > max) return null;
    if (exigirDosColumnas && columnasVisibles(columnas) > 1 && columnasVisibles(resultado) < 2) return null;
    return JSON.stringify(resultado) === JSON.stringify(columnas) ? null : resultado;
}
