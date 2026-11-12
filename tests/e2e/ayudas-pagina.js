// Ayudas que la prueba de humo inyecta en la página (quedan en window.humo). Corren dentro del navegador.
window.humo = {
    pausa: (ms) => new Promise(r => setTimeout(r, ms)),

    /** Espera hasta que la condición sea verdadera; lanza si no pasa en el tiempo dado. */
    async hasta(condicion, ms = 5000, que = String(condicion)) {
        const fin = Date.now() + ms;
        for (;;) {
            if (await condicion()) return;
            if (Date.now() > fin) throw new Error(`no se cumplió a tiempo: ${que}`);
            await new Promise(r => setTimeout(r, 30));
        }
    },

    modales: () => [...document.querySelectorAll('.modal.show')].map(m => m.id).join(','),
    toasts: () => [...document.querySelectorAll('.toast')].map(t => t.textContent.trim()).join(' / '),
    clic: (selector) => {
        const el = document.querySelector(selector);
        if (!el) throw new Error(`no existe ${selector}`);
        el.click();
    },
    /** Espera a que el único modal abierto sea ese. */
    modalAbierto(id) { return this.hasta(() => this.modales() === id, 5000, `modal abierto: ${id} (hay: ${this.modales()})`); },

    /**
     * Directiva: los controles en fila no pueden solaparse ni salirse de la pantalla.
     * Revisa las filas visibles (las del modal abierto, o las de la página si no hay modal) y devuelve una lista de problemas.
     */
    solapes() {
        const FILAS = '.input-with-btn, .btn-group, .importar-btns, .gist-acciones, .input-number-group, #gist-rango-horario, .week-selector, .header-actions';
        const TOLERANCIA = 1;
        const hayModal = !!document.querySelector('.modal.show');
        const visible = (el) => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') return false;
            if (el.closest('.collapsible:not(.expanded)')) return false;
            return hayModal ? !!el.closest('.modal.show') : !el.closest('.modal');
        };
        const nombre = (el) => el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}`;
        const problemas = [];
        for (const fila of [...document.querySelectorAll(FILAS)].filter(visible)) {
            const hijos = [...fila.children].filter(visible);
            const cajas = hijos.map(h => h.getBoundingClientRect());
            cajas.forEach((c, i) => {
                if (c.left < -TOLERANCIA || c.right > window.innerWidth + TOLERANCIA) problemas.push(`${nombre(fila)}: ${nombre(hijos[i])} se sale de la pantalla`);
                for (let j = i + 1; j < cajas.length; j++) {
                    const d = cajas[j];
                    const ancho = Math.min(c.right, d.right) - Math.max(c.left, d.left);
                    const alto = Math.min(c.bottom, d.bottom) - Math.max(c.top, d.top);
                    if (ancho > TOLERANCIA && alto > TOLERANCIA) problemas.push(`${nombre(fila)}: ${nombre(hijos[i])} se solapa con ${nombre(hijos[j])}`);
                }
            });
        }
        return problemas;
    },

    /** ¿La página se puede desplazar hacia el costado? (no debería) */
    desbordeHorizontal: () => document.documentElement.scrollWidth - window.innerWidth,

    /**
     * Directiva: un contenedor que cambia de largo anima el alto, no salta. Ejecuta `accion` y toma el alto del elemento
     * cuadro a cuadro: devuelve { inicial, final, intermedios } (intermedios = valores distintos del inicial y del final).
     */
    async altosDurante(selector, accion, ms = 900) {
        const el = document.querySelector(selector);
        const alto = () => Math.round(el.getBoundingClientRect().height);
        const inicial = alto();
        const vistos = new Set();
        accion();
        const fin = performance.now() + ms;
        while (performance.now() < fin) {
            await new Promise(r => requestAnimationFrame(r));
            vistos.add(alto());
        }
        const final = alto();
        return { inicial, final, intermedios: [...vistos].filter(v => v !== inicial && v !== final).length };
    },
};
