import { Movimiento } from '../core/movimiento.js';

// ====================================================================
// SCROLL — desplazamiento respetando reduced-motion
// ====================================================================

export function _scrollA(el, block = 'nearest') {
    if (el) el.scrollIntoView({ behavior: Movimiento.scrollBehavior(), block });
}
export function _esperarFinScroll(objetivo = window, { estable = 120, maximo = 1500 } = {}) {
    const esVentana = objetivo === window;
    const origen = esVentana ? document : objetivo;
    const posicion = () => (esVentana ? window.scrollY : objetivo.scrollTop);
    return new Promise(resolve => {
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
