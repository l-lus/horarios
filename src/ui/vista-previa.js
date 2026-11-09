import { $, setColapsable } from '../core/dom.js';
import { Movimiento } from '../core/movimiento.js';
import { PosicionHeader } from '../core/posicion-header.js';
import { Animaciones } from './animaciones.js';

// ====================================================================
// VISTA PREVIA EN VIVO (ajustes de apariencia que se prueban sobre la propia tarjeta)
// ====================================================================
// Algunas opciones de Ajustes (el estilo de la tarjeta de estado, el del calendario) se entienden mejor viéndolas. Al tocarlas se cierra Ajustes, la tarjeta
// se lleva a la vista (con scroll si hace falta) sobre un velo que atenúa el resto de la página, y abajo queda un panel con los mismos controles para ir
// cambiando y ver el resultado al instante. "Listo" (o tocar el velo, Escape o el botón Atrás) cierra la vista previa y devuelve a Ajustes (tocar el velo también).
//
// Este módulo no conoce las opciones: quien lo llama pasa las filas del panel y, si la tarjeta necesita prepararse (p. ej. expandir el calendario del histórico),
// un preparador registrado con `registrarPreparador` que devuelve cómo dejar todo como estaba.
//
// La vista previa agrega una entrada al historial del navegador (como los modales): así el botón Atrás de un móvil la cierra en vez de salir de la app.
// Todo cierre pasa por history.back() y se completa en el popstate, para no pisarse con el historial de los modales (ver gestor-modales.js).

/** @typedef {{ etiqueta: string, descripcion?: string, icono?: string, valor: () => string, alTocar: () => void, visible?: () => boolean }} FilaVistaPrevia */
/** @typedef {{ id: string, titulo: string, idObjetivo: string, filas: FilaVistaPrevia[], antes?: () => void, alCerrar?: () => void }} ConfigVistaPrevia */

const NS_SVG = 'http://www.w3.org/2000/svg';
/** Demora entre cerrar Ajustes y mostrar la vista previa: deja pasar el popstate del modal para que los dos historiales no se pisen. */
const DEMORA_APERTURA_MS = 160;
/** Demora entre el popstate de la vista previa y lo que sigue (reabrir Ajustes): el gestor de modales ignora los popstate durante unos ms. */
const DEMORA_CIERRE_MS = 90;
const MARGEN_PX = 12;
/** Si la tarjeta es más alta que el espacio libre pero su borde superior ya se ve, alinearla arriba solo vale la pena si hay que mover más que esto. */
const TOLERANCIA_ALINEAR_PX = 40;

/** @type {Record<string, () => (() => void) | void>} */
const _preparadores = {};

/** @type {{ cfg: ConfigVistaPrevia, objetivo: HTMLElement, restaurar: (() => void) | null, filas: { def: FilaVistaPrevia, envoltorio: HTMLElement, btn: HTMLElement, valor: HTMLElement }[], observer: ResizeObserver | null, timer: any } | null} */
let _activa = null;
let _iniciada = false;
let _cerrando = false;

/** Un preparador deja visible lo que se va a probar y devuelve cómo volver al estado anterior. @param {string} id @param {() => (() => void) | void} fn */
function registrarPreparador(id, fn) {
    _preparadores[id] = fn;
}

function _icono(href) {
    const svg = document.createElementNS(NS_SVG, 'svg');
    svg.setAttribute('class', 'icon');
    const uso = document.createElementNS(NS_SVG, 'use');
    uso.setAttribute('href', href);
    svg.append(uso);
    return svg;
}

function _construirFilas(defs) {
    const cont = $('vista-previa-filas');
    if (!cont) return [];
    cont.replaceChildren();
    return defs.map(def => {
        const btn = document.createElement('button');
        btn.type = 'button';
        const texto = document.createElement('span');
        texto.className = 'settings-list-text';
        const titulo = document.createElement('span');
        titulo.textContent = def.etiqueta;
        texto.append(titulo);
        if (def.descripcion) {
            const desc = document.createElement('span');
            desc.className = 'settings-list-desc';
            desc.textContent = def.descripcion;
            texto.append(desc);
        }
        const valor = document.createElement('span');
        btn.append(_icono(def.icono ?? '#icon-eye'), texto, valor);
        // cada fila va dentro de un colapsable: al aparecer o desaparecer una subopción se despliega o se pliega con la misma animación que en Ajustes
        const envoltorio = document.createElement('div');
        envoltorio.className = 'collapsible';
        const interior = document.createElement('div');
        interior.className = 'collapsible-inner';
        interior.append(btn);
        envoltorio.append(interior);
        btn.addEventListener('click', () => {
            def.alTocar();
            _refrescar();
            // la tarjeta puede cambiar de alto (se anima): se vuelve a encuadrar cuando termina
            clearTimeout(_activa?.timer);
            if (_activa) _activa.timer = setTimeout(_llevarAVista, 380);
        });
        cont.append(envoltorio);
        return { def, envoltorio, btn, valor };
    });
}

/** Ancho que tendría el valor con `texto` (se mide con una copia oculta que hereda la misma tipografía). @param {HTMLElement} el @param {string} texto */
function _anchoConTexto(el, texto) {
    const medidor = /** @type {HTMLElement} */ (el.cloneNode(false));
    medidor.removeAttribute('style');
    medidor.textContent = texto;
    Object.assign(medidor.style, { position: 'absolute', visibility: 'hidden', width: 'auto', pointerEvents: 'none' });
    el.parentElement?.append(medidor);
    const ancho = medidor.getBoundingClientRect().width;
    medidor.remove();
    return ancho;
}

/**
 * Cambia el valor de una fila con el desplazamiento vertical de siempre y, además, anima su ANCHO del anterior al nuevo: el texto de la izquierda (nombre y
 * descripción, que se recortan con puntos suspensivos) gana o pierde lugar de a poco en vez de mostrarse o recortarse de golpe cuando el valor es más corto o más largo.
 * @param {HTMLElement} el @param {string} texto
 */
function _cambiarValor(el, texto) {
    const dur = Animaciones._durSiAnima('--dur-valor', el);
    const antes = el.getBoundingClientRect().width;
    if (!(dur > 1) || !(antes > 0) || el.textContent === texto) { Animaciones._animarValor(el, texto, 1); return; }
    const despues = _anchoConTexto(el, texto);
    el.style.width = `${antes}px`;
    Animaciones._animarValor(el, texto, 1);
    if (Math.abs(despues - antes) < 1) { el.style.width = ''; return; }
    void el.offsetWidth;
    el.style.transition = `width ${dur}ms ease-out`;
    el.style.width = `${despues}px`;
    clearTimeout(/** @type {any} */ (el).__finAncho);
    /** @type {any} */ (el).__finAncho = setTimeout(() => { el.style.width = ''; el.style.transition = ''; }, dur + 60);
}

/** @param {boolean} [animar] con false (la primera vez) las filas quedan en su estado sin transición */
function _refrescar(animar = true) {
    if (!_activa) return;
    const filas = _activa.filas;
    const visibles = filas.map(f => (f.def.visible ? f.def.visible() : true));
    const aplicar = () => {
        filas.forEach((f, i) => {
            // el valor cambia con el mismo desplazamiento vertical que los valores de Ajustes (la primera vez, sin animar)
            if (animar) _cambiarValor(f.valor, f.def.valor());
            else Animaciones._animarValor(f.valor, f.def.valor(), 0);
            if (f.envoltorio.classList.contains('expanded') !== visibles[i]) setColapsable(f.envoltorio, visibles[i], { animar });
        });
    };
    // Si no aparece ni desaparece ninguna fila (eso ya lo anima su colapsable), un valor más largo o corto puede partir el texto en otra cantidad de líneas
    // y cambiar el alto del panel: ese cambio también se anima
    const cambiaVisibilidad = filas.some((f, i) => f.envoltorio.classList.contains('expanded') !== visibles[i]);
    const panel = $('vista-previa-panel');
    if (animar && !cambiaVisibilidad && panel) Animaciones._animarAlturaCambio(panel, aplicar);
    else aplicar();
}

/**
 * Deja la tarjeta entera entre el encabezado y el panel: si ya se ve entera no se mueve (ni unos píxeles); si es más alta que el espacio libre se alinea arriba,
 * salvo que su borde superior ya se vea y falten pocos píxeles (en una pantalla grande la página casi no se desplaza: el espacio que se reserva abajo para el
 * panel la hacía "saltar" unos píxeles, y al cerrar volvía sola cuando desaparecía esa reserva).
 */
function _llevarAVista() {
    if (!_activa) return;
    // el borde de arriba que deja libre el encabezado: solo cuenta si va arriba
    const bordeEncabezado = PosicionHeader.altoSuperior();
    const libreSup = bordeEncabezado + MARGEN_PX;
    const libreInf = window.innerHeight - _alturaReservada() - MARGEN_PX;
    const r = _activa.objetivo.getBoundingClientRect();
    // lo que se ve de verdad: entre el encabezado y el panel tal como está ahora (sin los márgenes ni la reserva del peor caso, que solo sirven para decidir cuánto
    // desplazar cuando hace falta). Si la tarjeta ya cae entera ahí, no hay nada que acercar: la página se queda donde está
    const panel = $('vista-previa-panel');
    const finVisible = window.innerHeight - (panel ? panel.offsetHeight : 0);
    if (r.top >= bordeEncabezado && r.bottom <= finVisible) return;
    let delta = 0;
    if (r.height > libreInf - libreSup || r.top < libreSup) {
        delta = r.top - libreSup;
        if (r.top >= bordeEncabezado && Math.abs(delta) <= TOLERANCIA_ALINEAR_PX) delta = 0;
    } else if (r.bottom > libreInf) delta = r.bottom - libreInf;
    if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: Movimiento.scrollBehavior() });
}

/**
 * Lo que ocupa el panel en su peor caso: la cabecera, las filas fijas (la principal, la última, y las que no dependen de nada) y la subopción más alta (a la vez solo se muestra una). Es lo que se reserva
 * abajo de la página y lo que se descuenta al encuadrar la tarjeta: así, cuando una subopción aparece o desaparece y el panel crece o se achica, la página de
 * atrás no se corre ni hay que volver a desplazarla (esa era una segunda animación encima de la del panel).
 */
function _alturaReservada() {
    const panel = $('vista-previa-panel');
    if (!panel) return 0;
    const filas = _activa ? _activa.filas : [];
    const alto = (/** @type {{ btn: HTMLElement }} */ f) => f.btn.offsetHeight;   // el alto natural del botón, aunque su colapsable esté plegado
    // lo fijo del panel (cabecera y márgenes) = su alto actual menos el de todas las filas tal como se ven ahora (plegadas, a medias o desplegadas)
    const base = panel.offsetHeight - filas.reduce((suma, f) => suma + f.envoltorio.offsetHeight, 0);
    // las filas sin `visible` están siempre (la principal y las fijas, como el fondo); las condicionales son subopciones y a la vez solo se muestra una
    const fijas = filas.filter(f => !f.def.visible).reduce((suma, f) => suma + alto(f), 0);
    const subopciones = Math.max(0, ...filas.filter(f => f.def.visible).map(alto));
    return Math.ceil(base + fijas + subopciones);
}

function _medirPanel() {
    const panel = $('vista-previa-panel');
    if (panel) document.body.style.setProperty('--vp-panel-h', `${_alturaReservada()}px`);
}

function _mostrar() {
    if (!_activa) return;
    const { cfg, objetivo } = _activa;
    const panel = $('vista-previa-panel');
    const velo = $('vista-previa-velo');
    if (!panel || !velo) return;

    $('vista-previa-titulo')?.replaceChildren(cfg.titulo);
    _activa.filas = _construirFilas(cfg.filas);
    _refrescar(false);

    objetivo.classList.add('vista-previa-objetivo');
    document.body.classList.add('vista-previa-activa');
    velo.classList.add('show');
    panel.classList.add('show');
    panel.inert = false;
    history.pushState({ vistaPrevia: true }, '');

    _medirPanel();
    // las filas que aparecen o desaparecen al cambiar de estilo cambian el alto del panel: el espacio de abajo y el encuadre lo siguen
    // la reserva ya cubre el peor caso: solo se mide de nuevo si cambia la cantidad de líneas de un texto (por ejemplo al girar el celular)
    _activa.observer = new ResizeObserver(() => { _medirPanel(); });
    _activa.observer.observe(panel);
    _activa.timer = setTimeout(_llevarAVista, 60);
    // el foco va a la primera fila fija (la principal): las subopciones, si las hay, quedan arriba
    _activa.filas.find(f => !f.def.visible)?.btn.focus({ preventScroll: true });
}

/**
 * Abre la vista previa: cierra Ajustes (`antes`), lleva la tarjeta a la vista y muestra el panel con `filas`.
 * Las filas se muestran en el orden dado y la ÚLTIMA es la principal: las subopciones van antes, porque el panel está anclado abajo y crece hacia arriba,
 * así la fila que se toca para cambiar el estilo no se mueve cuando aparece o desaparece una subopción.
 * @param {ConfigVistaPrevia} cfg
 */
function abrir(cfg) {
    if (_activa) return;
    const objetivo = $(cfg.idObjetivo);
    if (!objetivo) return;
    _activa = { cfg, objetivo, restaurar: null, filas: [], observer: null, timer: null };
    _cerrando = false;
    cfg.antes?.();
    _activa.restaurar = _preparadores[cfg.id]?.() ?? null;
    setTimeout(_mostrar, DEMORA_APERTURA_MS);
}

/** Pide cerrar: la vuelta atrás del historial dispara el popstate, que termina el cierre. */
function cerrar() {
    if (!_activa || _cerrando) return;
    _cerrando = true;
    history.back();
    // red de seguridad: si por algo no llega el popstate, se termina igual
    setTimeout(() => { if (_activa && _cerrando) _finalizar(); }, 600);
}

function _finalizar() {
    const activa = _activa;
    if (!activa) return;
    _activa = null;
    _cerrando = false;
    clearTimeout(activa.timer);
    activa.observer?.disconnect();
    activa.objetivo.classList.remove('vista-previa-objetivo');
    document.body.classList.remove('vista-previa-activa');
    document.body.style.removeProperty('--vp-panel-h');
    $('vista-previa-velo')?.classList.remove('show');
    const panel = $('vista-previa-panel');
    // el foco sale del panel antes de ocultarlo (un elemento oculto a los lectores de pantalla no puede conservarlo) y `inert` lo saca del orden de Tab
    if (panel && document.activeElement instanceof HTMLElement && panel.contains(document.activeElement)) document.activeElement.blur();
    panel?.classList.remove('show');
    if (panel) panel.inert = true;
    activa.restaurar?.();
    if (activa.cfg.alCerrar) setTimeout(() => activa.cfg.alCerrar?.(), DEMORA_CIERRE_MS);
}

function bindEventos() {
    if (_iniciada) return;
    _iniciada = true;
    $('vista-previa-listo')?.addEventListener('click', () => cerrar());
    // tocar el velo (fuera de la tarjeta y del panel) cierra igual que Listo: el estilo elegido queda como está
    $('vista-previa-velo')?.addEventListener('click', () => cerrar());
    window.addEventListener('popstate', () => { if (_activa && document.body.classList.contains('vista-previa-activa')) _finalizar(); });
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && _activa && document.body.classList.contains('vista-previa-activa')) { e.preventDefault(); cerrar(); }
    });
    window.addEventListener('resize', () => { _medirPanel(); });
}

export const VistaPrevia = { abrir, cerrar, bindEventos, registrarPreparador, activa: () => !!_activa };
