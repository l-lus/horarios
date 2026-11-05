// ====================================================================
// DOM & COLLAPSIBLES — shared helpers
// ====================================================================
/**
 * getElementById tipado como input: casi todos los usos leen .value/.disabled/.checked.
 * Puede devolver null si el id no existe (por eso el código usa `?.` o `if (el)`).
 * @param {string} id
 * @returns {HTMLInputElement}
 */
export const $ = id => /** @type {HTMLInputElement} */ (document.getElementById(id));

/** @type {CanvasRenderingContext2D | null | undefined} */
let _ctxMedida;

/**
 * Ancho (px) que ocuparía `texto` con la tipografía de `el`, medido en un canvas (no toca el DOM visible).
 * Sin canvas devuelve 0: el texto "entra" siempre y no se abrevia.
 * @param {Element} el
 * @param {string} texto
 */
export function anchoDeTexto(el, texto) {
    if (_ctxMedida === undefined) _ctxMedida = document.createElement('canvas').getContext('2d');
    if (!_ctxMedida) return 0;
    const estilo = getComputedStyle(el);
    _ctxMedida.font = `${estilo.fontStyle} ${estilo.fontWeight} ${estilo.fontSize} ${estilo.fontFamily}`;
    const espaciado = parseFloat(estilo.letterSpacing) || 0;
    return _ctxMedida.measureText(texto).width + espaciado * texto.length;
}

// ====================================================================
// COLAPSABLES — shared helper
// ====================================================================
export function setColapsable(el, abierto, { animar = true } = {}) {
    if (!el) return;
    if (animar) {
        el.classList.toggle('expanded', abierto);
        return;
    }
    el.classList.add('sin-transicion');
    el.classList.toggle('expanded', abierto);
    void el.offsetHeight;
    el.classList.remove('sin-transicion');
}
