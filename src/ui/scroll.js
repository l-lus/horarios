import { Movimiento } from '../core/movimiento.js';

// ====================================================================
// SCROLL — desplazamiento respetando reduced-motion
// ====================================================================

export function _scrollA(el, block = 'nearest') {
    if (el) el.scrollIntoView({ behavior: Movimiento.scrollBehavior(), block });
}
/** @param {Window|HTMLElement} [objetivo] */
export function _esperarFinScroll(objetivo = window, { estable = 120, maximo = 1500 } = {}) {
    const esVentana = objetivo === window;
    const origen = esVentana ? document : objetivo;
    const posicion = () => (esVentana ? window.scrollY : /** @type {HTMLElement} */ (objetivo).scrollTop);
    return new Promise(/** @param {(v?: any) => void} resolve */ resolve => {
        let terminado = false;
        const inicio = performance.now();
        let ultimaPos = posicion();
        let desde = inicio;
        const fin = () => {
            if (terminado) return;
            terminado = true;
            origen.removeEventListener('scrollend', fin);
            resolve();
        };
        origen.addEventListener('scrollend', fin, { once: true });
        const revisar = (ahora) => {
            if (terminado) return;
            const pos = posicion();
            if (pos !== ultimaPos) { ultimaPos = pos; desde = ahora; }
            if (ahora - desde >= estable && ahora - inicio >= estable) return fin();
            if (ahora - inicio >= maximo) return fin();
            requestAnimationFrame(revisar);
        };
        requestAnimationFrame(revisar);
    });
}

/** @param {HTMLElement|null} el @param {{ contenedor?: HTMLElement|null, margenSuperior?: number }} [opciones] */
export function _scrollHastaVisible(el, { contenedor = null, margenSuperior = 0 } = {}) {
    if (!el) return Promise.resolve();
    const r = el.getBoundingClientRect();
    const c = contenedor ? contenedor.getBoundingClientRect() : null;
    const limiteSup = c ? c.top : margenSuperior;
    const limiteInf = c ? c.bottom : window.innerHeight;
    if (r.top >= limiteSup && r.bottom <= limiteInf) return Promise.resolve();

    if (contenedor) _scrollA(el, 'nearest');
    else window.scrollTo({ top: window.scrollY + r.top - margenSuperior, behavior: Movimiento.scrollBehavior() });
    if (Movimiento.reducido()) return Promise.resolve();
    return _esperarFinScroll(contenedor || window);
}

const _MARGEN_DESPLEGADO_PX = 12;
const _ESPERA_MAX_DESPLIEGUE_MS = 700;   // por si el transitionend no llega (pestaña en segundo plano, transición cortada)

/** Espera a que el desplegable (`.collapsible`) termine de abrirse: el fin de su transición de alto, o un tope por las dudas. */
function _finDeDespliegue(panel) {
    return new Promise(/** @param {(v?: any) => void} resolve */ resolve => {
        let listo = false;
        const fin = () => {
            if (listo) return;
            listo = true;
            panel.removeEventListener('transitionend', alTerminar);
            resolve();
        };
        /** @param {TransitionEvent} e */
        const alTerminar = (e) => { if (e.target === panel && e.propertyName === 'grid-template-rows') fin(); };
        panel.addEventListener('transitionend', alTerminar);
        setTimeout(fin, Movimiento.reducido() ? 0 : _ESPERA_MAX_DESPLIEGUE_MS);
    });
}

/** Lo que se ve de `el`: la ventana (debajo de `margenSuperior`) recortada por cada contenedor con scroll que lo rodea. */
function _areaVisible(el, margenSuperior = 0) {
    let top = margenSuperior;
    let bottom = window.innerHeight;
    for (let a = el.parentElement; a; a = a.parentElement) {
        const oy = getComputedStyle(a).overflowY;
        if (oy !== 'auto' && oy !== 'scroll') continue;
        const r = a.getBoundingClientRect();
        top = Math.max(top, r.top);
        bottom = Math.min(bottom, r.bottom);
    }
    return { top, bottom };
}

/** El contenedor que hay que desplazar para mover `el`: el primero con scroll (y algo para desplazar) que lo rodea, o la ventana. */
function _desplazableDe(el) {
    for (let a = el.parentElement; a; a = a.parentElement) {
        const oy = getComputedStyle(a).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && a.scrollHeight > a.clientHeight) return a;
    }
    return window;
}

/**
 * Un desplegable recién abierto (`.collapsible`): cuando termina de abrirse, si lo que tiene que verse (`objetivo`: el panel entero,
 * o los elementos que se indiquen) quedó cortado, se lo lleva a la vista. Dos modos:
 * - 'justo' (por defecto): se desplaza lo mínimo para mostrarlo, sin llevar el botón que lo abrió (`ancla`) por encima del borde
 *   superior: si no entra entero, se ve su comienzo junto al botón. Ej.: los desplegables de Respaldo y sincronización.
 * - 'arriba': se lleva el `ancla` al borde superior, para ver todo lo posible de un desplegable largo. Ej.: un mes de la lista de Registros.
 * Mira la ventana (debajo de `margenSuperior`, lo que tapa un encabezado fijo) y cada contenedor con scroll que lo rodea.
 * @param {HTMLElement | null} panel
 * @param {{ ancla?: HTMLElement | null, objetivo?: Element | Element[] | null, modo?: 'justo' | 'arriba', margenSuperior?: number }} [opciones]
 */
export async function _revelarDesplegado(panel, { ancla = null, objetivo = null, modo = 'justo', margenSuperior = 0 } = {}) {
    if (!panel) return;
    await _finDeDespliegue(panel);
    if (!panel.classList.contains('expanded')) return;   // se volvió a cerrar mientras se abría
    const objetivos = objetivo === null ? [panel] : (Array.isArray(objetivo) ? objetivo : [objetivo]);
    if (!objetivos.length) return;
    const rects = objetivos.map(o => o.getBoundingClientRect());
    const arribaObj = Math.min(...rects.map(r => r.top));
    const abajoObj = Math.max(...rects.map(r => r.bottom));
    const area = _areaVisible(objetivos[0], margenSuperior);
    if (arribaObj >= area.top && abajoObj <= area.bottom) return;

    const anc = ancla ?? panel;
    if (modo === 'arriba') { _scrollA(anc, 'start'); return; }
    const falta = abajoObj + _MARGEN_DESPLEGADO_PX - area.bottom;
    if (falta <= 0) return;
    const tope = anc.getBoundingClientRect().top - _MARGEN_DESPLEGADO_PX - area.top;
    const desplazar = Math.min(falta, Math.max(0, tope));
    if (desplazar > 0) _desplazableDe(panel).scrollBy({ top: desplazar, behavior: Movimiento.scrollBehavior() });
}
