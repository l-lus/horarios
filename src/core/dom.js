// ====================================================================
// DOM & COLLAPSIBLES — shared helpers
// ====================================================================
export const $ = id => document.getElementById(id);

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
