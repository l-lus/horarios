import { PosicionHeader, posicionesPermitidas } from '../core/posicion-header.js';
import { uiAnimarReubicacion, uiArrastreLargo } from './arrastre.js';
import { VistaPrevia } from './vista-previa.js';

// ====================================================================
// UI REUBICAR EL ENCABEZADO (mantener presionado y arrastrar, como las tarjetas)
// ====================================================================
// Se mantiene presionado el encabezado (en un lugar que no sea un botón) y, ya levantado, se arrastra: el encabezado se va a poner en vivo en el borde más
// cercano al puntero (arriba, abajo, a la izquierda o a la derecha; en móvil solo arriba y abajo), con el mismo deslizamiento que las tarjetas, y las tarjetas
// se acomodan al lugar que deja. Al soltar queda ahí (Escape cancela y vuelve a donde estaba). El dibujo de cada posición es del CSS (<html data-header-pos>,
// ver core/posicion-header.js).
const _consultaEscritorio = window.matchMedia('(min-width: 1024px)');   // mismo corte que el CSS

// Controles del encabezado que conservan su toque o clic normal: no inician el arrastre
const _SELECTOR_CONTROLES = 'button, a, input, select, textarea';

/** Lo que más cerca del borde nuevo tiene que estar el puntero, respecto del actual, para que el encabezado cambie de lugar (evita saltos en las diagonales). */
const HISTERESIS_PX = 24;

/** El encabezado y las tarjetas visibles: lo que cambia de lugar cuando el encabezado se mueve. */
const _elementosQueSeMueven = () => /** @type {HTMLElement[]} */ ([
    document.querySelector('.header'),
    ...document.querySelectorAll('.animated-card:not(.hidden)')
].filter(Boolean));
const _claveElemento = (el) => el.id || 'header';

/** De los lugares permitidos, el del borde de la ventana más cercano al puntero; el actual solo se deja si otro gana por más que la histéresis. */
function _posicionMasCercana(x, y, permitidas, actual) {
    const distancia = { top: y, bottom: window.innerHeight - y, left: x, right: window.innerWidth - x };
    const mejor = permitidas.reduce((m, id) => (distancia[id] < distancia[m] ? id : m), permitidas[0]);
    if (!permitidas.includes(actual)) return mejor;
    return distancia[mejor] < distancia[actual] - HISTERESIS_PX ? mejor : actual;
}

function iniciar() {
    let permitidas = [];
    let destino = null;

    // El encabezado se muestra en `id` en el acto (sin guardarlo), animando su deslizamiento y el de las tarjetas
    const mostrarEn = (id, header) => uiAnimarReubicacion(_elementosQueSeMueven, _claveElemento, () => PosicionHeader.previsualizar(id), { encima: header });

    uiArrastreLargo(document, {
        elegir: (e) => {
            const el = e.target instanceof Element ? e.target : null;
            if (!el) return null;
            const header = el.closest('.header');
            if (!header || el.closest(_SELECTOR_CONTROLES)) return null;
            // con la vista previa de estilo abierta no se puede reubicar: son modos excluyentes (igual que con las tarjetas)
            if (VistaPrevia.activa()) return null;
            return header;
        },
        alEmpezar: (header) => {
            permitidas = posicionesPermitidas(_consultaEscritorio.matches);
            destino = PosicionHeader.actual();
            header.classList.add('reubicando');
            document.body.classList.add('header-arrastrando-activa');
            // igual que al arrastrar tarjetas: sin la animación de entrada, que pisaría el deslizamiento
            /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.animated-card')).forEach(c => c.style.animation = 'none');
        },
        alMover: (e, header) => {
            const nueva = _posicionMasCercana(e.clientX, e.clientY, permitidas, destino);
            if (nueva === destino) return;
            destino = nueva;
            mostrarEn(destino, header);
        },
        alTerminar: (header, confirmar) => {
            header.classList.remove('reubicando');
            document.body.classList.remove('header-arrastrando-activa');
            if (confirmar && destino) PosicionHeader.setPosicion(destino);   // ya se ve ahí: solo se guarda
            else uiAnimarReubicacion(_elementosQueSeMueven, _claveElemento, () => PosicionHeader.restaurar(), { encima: header });
            destino = null;
        }
    });
}

export const HeaderPosicion = { iniciar };
