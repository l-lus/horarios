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

/**
 * Un desplegable recién abierto dentro de un contenedor con scroll (ej. el cuerpo de un modal): cuando termina de abrirse, si quedó
 * tapado abajo, el contenedor baja lo justo para mostrarlo entero, sin llevar por encima del borde superior al botón que lo abrió
 * (`ancla`): si el desplegable es más alto que lo visible, se ve su comienzo junto al botón.
 * @param {HTMLElement | null} panel @param {{ ancla?: HTMLElement | null, contenedor?: HTMLElement | null }} [opciones]
 */
export async function _revelarDesplegado(panel, { ancla = null, contenedor = null } = {}) {
    const cuerpo = contenedor ?? /** @type {HTMLElement | null} */ (panel?.closest('.modal-panel-body'));
    if (!panel || !cuerpo) return;
    await _finDeDespliegue(panel);
    if (!panel.classList.contains('expanded')) return;   // se volvió a cerrar mientras se abría
    const c = cuerpo.getBoundingClientRect();
    const falta = panel.getBoundingClientRect().bottom + _MARGEN_DESPLEGADO_PX - c.bottom;
    if (falta <= 0) return;
    const tope = (ancla ?? panel).getBoundingClientRect().top - _MARGEN_DESPLEGADO_PX - c.top;
    const desplazar = Math.min(falta, Math.max(0, tope));
    if (desplazar > 0) cuerpo.scrollBy({ top: desplazar, behavior: Movimiento.scrollBehavior() });
}
