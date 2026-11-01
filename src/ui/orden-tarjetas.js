import { STORAGE_KEYS, CARDS } from '../core/constantes.js';
import { normalizarOrdenCards, fusionarOrdenVisibles, columnaDeCard } from '../services/orden-cards.js';
import { $ } from '../core/dom.js';
import { EventosApp } from '../core/eventos.js';
import { Almacenamiento } from '../core/almacenamiento.js';
import { UIBase } from './base.js';
import { uiAnimarReubicacion, uiArrastreLargo, REUBICACION_MS } from './arrastre.js';

// ====================================================================
// UI CARDS LAYOUT MODULE (visibilidad y orden de las tarjetas)
// ====================================================================
const { _crearToggleConfig, _setBtnActivo } = UIBase;

const { toggle: togglePersistirTarjetas, actualizarEstado: actualizarEstadoBotonPersistir } =
    _crearToggleConfig({
        getVal: () => Almacenamiento.getBoolean(STORAGE_KEYS.PERSISTIR_TARJETAS, true),
        setVal: (v) => Almacenamiento.setItem(STORAGE_KEYS.PERSISTIR_TARJETAS, v),
        btnId: 'btn-toggle-persistir-tarjetas',
    });

function toggleVisibilidadCard(cual) {
    const key = STORAGE_KEYS.CARD_VISIBLE(cual);
    const nuevo = !Almacenamiento.getBoolean(key, true, true);
    Almacenamiento.setItem(key, nuevo, true);
    aplicarVisibilidadCard(cual, nuevo);
    _setBtnActivo('btn-toggle-card-' + cual, nuevo);
    EventosApp.emit('tarjetas:visibilidad');
}

function aplicarVisibilidadCard(cual, visible) {
    const card = $('card-' + cual);
    if (card) card.style.display = visible ? '' : 'none';
}

function aplicarVisibilidadCards() {
    CARDS.forEach(cual => {
        const visible = Almacenamiento.getBoolean(STORAGE_KEYS.CARD_VISIBLE(cual), true, true);
        aplicarVisibilidadCard(cual, visible);
        _setBtnActivo('btn-toggle-card-' + cual, visible);
    });
    EventosApp.emit('tarjetas:visibilidad');
}

function obtenerOrdenCards() {
    return normalizarOrdenCards(Almacenamiento.getObject(STORAGE_KEYS.ORDEN_CARDS, null, true));
}

// Columnas de escritorio: la izquierda es la que tiene la tarjeta de fichaje con la barra, la derecha es la que sigue (en móvil se apilan en ese orden)
function _columnas() {
    const statsCard = $('stats-card');
    const izquierda = statsCard ? statsCard.parentElement : null;
    const derecha = $('right-column') ?? (izquierda ? izquierda.parentElement : null);
    return { izquierda, derecha };
}

function aplicarOrdenCards(orden) {
    const { izquierda, derecha } = _columnas();
    if (!izquierda || !derecha) return;

    const delays = [0.10, 0.15, 0.20, 0.25];
    orden.forEach((cual, idx) => {
        const card = $('card-' + cual);
        if (!card) return;
        card.style.animationDelay = `${delays[idx] ?? 0.25}s`;
        (columnaDeCard(idx, orden.length) ? derecha : izquierda).appendChild(card);
    });

    const lista = $('lista-orden-cards');
    if (lista) {
        orden.forEach(cual => {
            const item = $('orden-item-' + cual);
            if (item) lista.appendChild(item);
        });
    }
}

// Al restaurar un respaldo o bajar de Gist cambian el orden y las tarjetas visibles: se redibuja el diseño
EventosApp.on('config:tarjetas', () => {
    aplicarVisibilidadCards();
    aplicarOrdenCards(obtenerOrdenCards());
});


function obtenerCardsVisibles() {
    const { izquierda, derecha } = _columnas();
    const cards = [];
    [izquierda, derecha].forEach(columna => {
        if (!columna) return;
        /** @type {HTMLElement[]} */ (Array.from(columna.children)).forEach(el => {
            if (el.id && el.id.startsWith('card-') && el.style.display !== 'none' && !el.classList.contains('d-none')) {
                cards.push(el);
            }
        });
    });
    return cards;
}

// Con el arrastre, la tarjeta se intercambia de lugar con la que tiene al lado (en su columna) o, si el puntero pasó a la otra columna,
// con la que está a la altura del puntero. Devuelve las tarjetas visibles en su nuevo orden, o null si no hay cambio.
function evaluarNuevoOrdenCards(arrastrado, visibles, clientX, clientY) {
    const idxActual = visibles.indexOf(arrastrado);
    if (idxActual === -1 || visibles.length <= 1) return null;

    const rects = visibles.map(c => c.getBoundingClientRect());
    const enDerecha = rects.map(r => Math.abs(r.left - rects[0].left) > 50);
    const dosColumnas = enDerecha.some(Boolean);
    const mitad = (i) => rects[i].top + rects[i].height / 2;
    const indicesDe = (derecha) => visibles.map((_, i) => i).filter(i => enDerecha[i] === derecha);

    let columnaCursor = enDerecha[idxActual];
    if (dosColumnas) {
        const finIzq = Math.max(...indicesDe(false).map(i => rects[i].right));
        const inicioDer = Math.min(...indicesDe(true).map(i => rects[i].left));
        columnaCursor = clientX >= (finIzq + inicioDer) / 2;
    }

    let targetIdx = null;
    if (columnaCursor === enDerecha[idxActual]) {
        const misma = indicesDe(columnaCursor);
        const pos = misma.indexOf(idxActual);
        if (pos > 0 && clientY < mitad(misma[pos - 1])) targetIdx = misma[pos - 1];
        else if (pos < misma.length - 1 && clientY > mitad(misma[pos + 1])) targetIdx = misma[pos + 1];
    } else {
        const otra = indicesDe(columnaCursor);
        targetIdx = otra.reduce((mejor, i) => (Math.abs(clientY - mitad(i)) < Math.abs(clientY - mitad(mejor)) ? i : mejor), otra[0]);
    }

    if (targetIdx === null || targetIdx === idxActual) return null;

    const nuevaLista = [...visibles];
    [nuevaLista[idxActual], nuevaLista[targetIdx]] = [nuevaLista[targetIdx], nuevaLista[idxActual]];
    return nuevaLista;
}

// Desde dónde se arrastra cada tarjeta: su encabezado, o la tarjeta entera en la de atajos (no tiene encabezado)
const _SELECTOR_ENCABEZADOS = '#card-registrar .card-registrar-header, #card-atajos, #card-estadisticas .card-header-clickable, #card-historico .card-header-clickable';
const _SELECTOR_CARDS = '#card-registrar, #card-atajos, #card-estadisticas, #card-historico';

function iniciarDragTarjetas() {
    let ordenInicial = null;
    let ordenEnCurso = null;
    let deslizandoHasta = 0;

    // Reubica las tarjetas visibles en `visiblesNuevo` (las ocultas conservan su lugar) con la animación de deslizamiento
    const reubicar = (visiblesNuevo, encima) => {
        const nuevoOrden = fusionarOrdenVisibles(ordenEnCurso ?? obtenerOrdenCards(), visiblesNuevo.map(c => c.id.replace('card-', '')));
        ordenEnCurso = nuevoOrden;
        return uiAnimarReubicacion(
            () => obtenerCardsVisibles(),
            c => c.id,
            () => aplicarOrdenCards(nuevoOrden),
            { encima }
        );
    };

    uiArrastreLargo(document, {
        elegir: (e) => {
            const el = e.target instanceof Element ? e.target : null;
            if (!el) return null;
            if (el.closest('#btn-timer-main')) return null;

            const header = el.closest(_SELECTOR_ENCABEZADOS);
            if (!header) return null;

            return header.closest(_SELECTOR_CARDS);
        },
        capturar: (card) => card.querySelector('.card-registrar-header, .card-header-clickable') || card,
        alEmpezar: (card) => {
            ordenInicial = obtenerOrdenCards();
            ordenEnCurso = ordenInicial;
            card.classList.add('reordenando');
            document.body.classList.add('tarjeta-arrastrando-activa');
            /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.animated-card')).forEach(c => c.style.animation = 'none');
        },
        alMover: (e, card) => {
            if (performance.now() < deslizandoHasta) return;
            const visiblesNuevo = evaluarNuevoOrdenCards(card, obtenerCardsVisibles(), e.clientX, e.clientY);
            if (!visiblesNuevo) return;

            if (reubicar(visiblesNuevo, card).length > 0) {
                deslizandoHasta = performance.now() + REUBICACION_MS;
            }
        },
        alTerminar: (card, confirmar) => {
            card.classList.remove('reordenando');
            document.body.classList.remove('tarjeta-arrastrando-activa');
            if (confirmar) {
                Almacenamiento.setItem(STORAGE_KEYS.ORDEN_CARDS, ordenEnCurso, true);
                aplicarOrdenCards(ordenEnCurso);
            } else if (ordenInicial) {
                uiAnimarReubicacion(
                    () => obtenerCardsVisibles(),
                    c => c.id,
                    () => aplicarOrdenCards(ordenInicial)
                );
                Almacenamiento.setItem(STORAGE_KEYS.ORDEN_CARDS, ordenInicial, true);
            }
            ordenInicial = null;
            ordenEnCurso = null;
        }
    });

    // Con teclado (Alt + flechas sobre el encabezado), el mismo recorrido: intercambia con la visible anterior o siguiente
    const headers = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(_SELECTOR_ENCABEZADOS));
    headers.forEach(header => {
        header.addEventListener('keydown', (e) => {
            if (!e.altKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
            const card = header.closest(_SELECTOR_CARDS);
            if (!card) return;

            const visibles = obtenerCardsVisibles();
            const idx = visibles.indexOf(card);
            if (idx === -1) return;

            const atras = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
            if (atras ? idx <= 0 : idx >= visibles.length - 1) return;

            e.preventDefault();
            const nuevaLista = [...visibles];
            const otro = atras ? idx - 1 : idx + 1;
            [nuevaLista[idx], nuevaLista[otro]] = [nuevaLista[otro], nuevaLista[idx]];

            ordenEnCurso = obtenerOrdenCards();
            reubicar(nuevaLista, card);
            Almacenamiento.setItem(STORAGE_KEYS.ORDEN_CARDS, ordenEnCurso, true);
            ordenEnCurso = null;
            // en la tarjeta de atajos el foco estaba en uno de sus botones
            (header === card ? /** @type {HTMLElement} */ (e.target) : header).focus();
        });
    });
}

function iniciarDragOrdenCards() {
    const lista = $('lista-orden-cards');
    if (!lista) return;

    let draggingEl = null;
    let dragClone = null;
    let startY = 0;
    let initialYOffset = 0;
    let dragTimer = null;
    const DRAG_DELAY = 150;

    function getCardFromItem(el) {
        const handle = el?.classList?.contains('drag-handle') ? el : el?.querySelector('.drag-handle');
        return handle?.dataset?.card;
    }

    function initDrag(item, clientY) {
        draggingEl = item;
        const rect = item.getBoundingClientRect();
        initialYOffset = clientY - rect.top;
        dragClone = item.cloneNode(true);
        dragClone.classList.add('drag-clone');
        Object.assign(dragClone.style, {
            top: `${rect.top}px`, left: `${rect.left}px`,
            width: `${rect.width}px`, height: `${rect.height}px`
        });
        document.body.appendChild(dragClone);
        draggingEl.classList.add('arrastrando');
        if (navigator.vibrate) navigator.vibrate(30);
    }

    function moveDrag(clientY) {
        if (!dragClone || !draggingEl) return;

        dragClone.style.top = `${clientY - initialYOffset}px`;

        const target = [...lista.querySelectorAll('.orden-card-item')].find(item => {
            if (item === draggingEl) return false;
            const r = item.getBoundingClientRect();
            return clientY >= r.top && clientY <= r.bottom;
        });

        if (target) {
            const targetRect = target.getBoundingClientRect();
            const targetMiddle = targetRect.top + targetRect.height / 2;

            if (clientY < targetMiddle) {
                lista.insertBefore(draggingEl, target);
            } else {
                lista.insertBefore(draggingEl, target.nextSibling);
            }
        }
    }

    function endDrag() {
        clearTimeout(dragTimer);
        if (!draggingEl) return;

        if (dragClone) {
            dragClone.remove();
            dragClone = null;
        }
        draggingEl.classList.remove('arrastrando');

        const itemsDOM = Array.from(lista.querySelectorAll('.orden-card-item'));
        const nuevoOrden = itemsDOM.map(i => getCardFromItem(i)).filter(Boolean);

        Almacenamiento.setItem(STORAGE_KEYS.ORDEN_CARDS, nuevoOrden, true);

        aplicarOrdenCards(nuevoOrden);

        draggingEl = null;
    }

    const bindStart = (eventType, getY, opts) => lista.addEventListener(eventType, (e) => {
        const item = e.target.closest('.drag-handle')?.closest('.orden-card-item');
        if (!item) return;
        startY = getY(e);
        dragTimer = setTimeout(() => initDrag(item, startY), DRAG_DELAY);
    }, opts);

    const bindMove = (target, eventType, getY, opts) => target.addEventListener(eventType, (e) => {
        if (!draggingEl) { if (Math.abs(getY(e) - startY) > 10) clearTimeout(dragTimer); return; }
        e.preventDefault();
        moveDrag(getY(e));
    }, opts);

    bindStart('touchstart', e => e.touches[0].clientY, { passive: true });
    bindStart('mousedown', e => e.clientY);
    bindMove(lista, 'touchmove', e => e.touches[0].clientY, { passive: false });
    bindMove(document, 'mousemove', e => e.clientY);
    lista.addEventListener('touchend', endDrag);
    lista.addEventListener('touchcancel', endDrag);
    document.addEventListener('mouseup', endDrag);
}

function bindEventos() {
    $('btn-toggle-persistir-tarjetas')?.addEventListener('click', () => togglePersistirTarjetas());
    $('btn-toggle-card-registrar')?.addEventListener('click', () => toggleVisibilidadCard('registrar'));
    $('btn-toggle-card-estadisticas')?.addEventListener('click', () => toggleVisibilidadCard('estadisticas'));
    $('btn-toggle-card-atajos')?.addEventListener('click', () => toggleVisibilidadCard('atajos'));
    $('btn-toggle-card-historico')?.addEventListener('click', () => toggleVisibilidadCard('historico'));
}

export const OrdenTarjetas = {
    actualizarEstadoBotonPersistir, aplicarVisibilidadCards, obtenerOrdenCards, aplicarOrdenCards,
    iniciarDragOrdenCards, iniciarDragTarjetas, bindEventos
};
