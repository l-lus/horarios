import { $ } from '../core/dom.js';
import { Movimiento } from '../core/movimiento.js';

// ====================================================================
// VISTA PREVIA EN VIVO (ajustes de apariencia que se prueban sobre la propia tarjeta)
// ====================================================================
// Algunas opciones de Ajustes (el estilo de la tarjeta de estado, el del calendario) se entienden mejor viéndolas. Al tocarlas se cierra Ajustes, la tarjeta
// se lleva a la vista (con scroll si hace falta) sobre un velo que atenúa el resto de la página, y abajo queda un panel con los mismos controles para ir
// cambiando y ver el resultado al instante. "Listo" (o Escape, o el botón Atrás) cierra la vista previa y devuelve a Ajustes.
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

/** @type {Record<string, () => (() => void) | void>} */
const _preparadores = {};

/** @type {{ cfg: ConfigVistaPrevia, objetivo: HTMLElement, restaurar: (() => void) | null, filas: { def: FilaVistaPrevia, btn: HTMLElement, valor: HTMLElement }[], observer: ResizeObserver | null, timer: any } | null} */
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
        btn.addEventListener('click', () => {
            def.alTocar();
            _refrescar();
            // la tarjeta puede cambiar de alto (se anima): se vuelve a encuadrar cuando termina
            clearTimeout(_activa?.timer);
            if (_activa) _activa.timer = setTimeout(_llevarAVista, 380);
        });
        cont.append(btn);
        return { def, btn, valor };
    });
}

function _refrescar() {
    if (!_activa) return;
    for (const f of _activa.filas) {
        const texto = f.def.valor();
        if (f.valor.textContent !== texto) f.valor.textContent = texto;
        f.btn.classList.toggle('hidden', f.def.visible ? !f.def.visible() : false);
    }
}

/** Deja la tarjeta entera entre el encabezado y el panel: si ya se ve no se mueve; si es más alta que el espacio libre se alinea arriba. */
function _llevarAVista() {
    if (!_activa) return;
    const panel = $('vista-previa-panel');
    const encabezado = document.querySelector('.header');
    const libreSup = (encabezado ? encabezado.getBoundingClientRect().bottom : 0) + MARGEN_PX;
    const libreInf = window.innerHeight - (panel ? panel.offsetHeight : 0) - MARGEN_PX;
    const r = _activa.objetivo.getBoundingClientRect();
    let delta = 0;
    if (r.height > libreInf - libreSup || r.top < libreSup) delta = r.top - libreSup;
    else if (r.bottom > libreInf) delta = r.bottom - libreInf;
    if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: Movimiento.scrollBehavior() });
}

function _medirPanel() {
    const panel = $('vista-previa-panel');
    if (panel) document.body.style.setProperty('--vp-panel-h', `${panel.offsetHeight}px`);
}

function _mostrar() {
    if (!_activa) return;
    const { cfg, objetivo } = _activa;
    const panel = $('vista-previa-panel');
    const velo = $('vista-previa-velo');
    if (!panel || !velo) return;

    $('vista-previa-titulo')?.replaceChildren(cfg.titulo);
    _activa.filas = _construirFilas(cfg.filas);
    _refrescar();

    objetivo.classList.add('vista-previa-objetivo');
    document.body.classList.add('vista-previa-activa');
    velo.classList.add('show');
    panel.classList.add('show');
    panel.setAttribute('aria-hidden', 'false');
    history.pushState({ vistaPrevia: true }, '');

    _medirPanel();
    // las filas que aparecen o desaparecen al cambiar de estilo cambian el alto del panel: el espacio de abajo y el encuadre lo siguen
    _activa.observer = new ResizeObserver(() => { _medirPanel(); });
    _activa.observer.observe(panel);
    _activa.timer = setTimeout(_llevarAVista, 60);
    /** @type {HTMLElement | null} */ (panel.querySelector('button:not(.hidden)'))?.focus({ preventScroll: true });
}

/**
 * Abre la vista previa: cierra Ajustes (`antes`), lleva la tarjeta a la vista y muestra el panel con `filas`.
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
    panel?.classList.remove('show');
    panel?.setAttribute('aria-hidden', 'true');
    activa.restaurar?.();
    if (activa.cfg.alCerrar) setTimeout(() => activa.cfg.alCerrar?.(), DEMORA_CIERRE_MS);
}

function bindEventos() {
    if (_iniciada) return;
    _iniciada = true;
    $('vista-previa-listo')?.addEventListener('click', () => cerrar());
    window.addEventListener('popstate', () => { if (_activa && document.body.classList.contains('vista-previa-activa')) _finalizar(); });
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && _activa && document.body.classList.contains('vista-previa-activa')) { e.preventDefault(); cerrar(); }
    });
    window.addEventListener('resize', () => { _medirPanel(); });
}

export const VistaPrevia = { abrir, cerrar, bindEventos, registrarPreparador, activa: () => !!_activa };
