import { CARDS } from '../core/constantes.js';

// ====================================================================
// ORDEN Y COLUMNAS DE LAS TARJETAS (sin DOM)
// ====================================================================
// El orden es una lista con todas las tarjetas, ocultas incluidas. En escritorio esa lista se corta en columnas según los tamaños guardados
// (ej. [1, 2] = 1 tarjeta en la primera columna y 2 en la segunda); en móvil se muestra apilada. La primera columna comparte lugar con la
// tarjeta de fichaje (fija arriba), por eso puede quedar sin tarjetas propias.
export const CARDS_EN_DERECHA = 2;   // reparto por defecto: las últimas dos van a la segunda columna
export const MAX_COLUMNAS = 3;

/**
 * Orden guardado → orden válido. Descarta lo desconocido y repetido; una tarjeta que no estaba cuando se guardó (agregada en una versión posterior)
 * entra en el lugar que le toca por defecto, sin tocar el orden que ya había elegido el usuario.
 * @param {unknown} guardado
 * @param {readonly string[]} [cards]
 */
export function normalizarOrdenCards(guardado, cards = CARDS) {
    const orden = Array.isArray(guardado) ? [...new Set(guardado.filter(c => cards.includes(c)))] : [];
    cards.forEach((c, i) => {
        if (!orden.includes(c)) orden.splice(Math.min(i, orden.length), 0, c);
    });
    return orden;
}

/**
 * ¿Son tamaños de columna válidos? Hasta MAX_COLUMNAS números enteros: la primera puede ser 0, las demás al menos 1.
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
    const t = esTamanosColumnasValidos(tamanos, total)
        ? /** @type {number[]} */ (tamanos)
        : (total > CARDS_EN_DERECHA ? [total - CARDS_EN_DERECHA, CARDS_EN_DERECHA] : [total]);
    let desde = 0;
    return t.map(n => { const col = orden.slice(desde, desde + n); desde += n; return col; });
}

/** @param {readonly (readonly string[])[]} columnas */
export const tamanosDeColumnas = (columnas) => columnas.map(c => c.length);

/**
 * Columnas tal como se dibujan: una columna sin tarjetas visibles (salvo la primera, que tiene la tarjeta de fichaje) se funde con la anterior,
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
    while (res.length > max) {
        const sobrante = /** @type {string[]} */ (res.pop());
        res[res.length - 1].push(...sobrante);
    }
    return res;
}

/**
 * Mueve una tarjeta a `colDestino` (si es igual a la cantidad de columnas, abre una nueva), delante de `antesDe` o al final.
 * Las columnas que quedan vacías desaparecen (salvo la primera). Devuelve las columnas nuevas, o null si no hay cambio
 * o el resultado superaría `max` columnas con tarjetas visibles.
 * @param {readonly (readonly string[])[]} columnas
 * @param {string} id
 * @param {number} colDestino
 * @param {string | null} [antesDe]
 * @param {{ max?: number, visibles?: ReadonlySet<string> | null }} [opciones]
 * @returns {string[][] | null}
 */
export function moverCard(columnas, id, colDestino, antesDe = null, { max = MAX_COLUMNAS, visibles = null } = {}) {
    const nuevas = columnas.map(c => c.filter(x => x !== id));
    if (colDestino >= nuevas.length) {
        nuevas.push([id]);
    } else {
        const destino = nuevas[Math.max(0, colDestino)];
        const i = antesDe ? destino.indexOf(antesDe) : -1;
        destino.splice(i === -1 ? destino.length : i, 0, id);
    }
    const resultado = nuevas.filter((c, i) => i === 0 || c.length > 0);
    if (resultado.filter((c, i) => i === 0 || c.some(x => !visibles || visibles.has(x))).length > max) return null;
    return JSON.stringify(resultado) === JSON.stringify(columnas) ? null : resultado;
}
