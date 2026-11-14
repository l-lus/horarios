import { Movimiento } from '../core/movimiento.js';
import { Animaciones } from './animaciones.js';
import { TiposRegistro } from '../services/tipos-registro.js';
import { icono, html, montar } from '../core/html.js';

const { DUR_FICHAJE_OK, DUR_FICHAJE_SALIDA } = Animaciones;

// ====================================================================
// BOTÓN FICHAR — reseteo e ícono con check de éxito
// ====================================================================

export function resetearBoton(btn) {
    btn.disabled = false;
    btn.classList.remove('btn-color-muted', 'btn-color-red');
    // Con el check de éxito en curso no se recrea el ícono: lo restaura su propia salida
    if (_exitoFichaje.has(btn)) return;
    montar(btn, html`${icono('#icon-clock')} <span id="btn-registrar-texto">Fichar</span>`);
}

// ─── Destello de la carga ───────────────────────────────────────────────────
// Al cargar la página, una sola vez, el botón destella (el mismo barrido y onda del botón de instalar y del día de hoy del calendario) si hoy se puede fichar:
// no hay registro o tiene la entrada sin salida. Con un día especial (feriado, vacaciones…) o la jornada ya cerrada no se llama la atención.
const INICIO_DESTELLO_MS = 1200;

/** ¿Falta fichar hoy? Sin registro, o con entrada y sin salida que no sea un día especial. @param {any} regHoy */
export function puedeFicharHoy(regHoy) {
    if (!regHoy) return true;
    return !!regHoy.entrada && !regHoy.salida && !TiposRegistro.obtenerTipoPorCodigo(regHoy.entrada, regHoy.salida);
}

/** @param {HTMLElement|null} btn @param {any} regHoy el registro de hoy (o null/undefined si no hay) */
export function destellarFicharAlCargar(btn, regHoy) {
    if (!btn || Movimiento.reducido() || !puedeFicharHoy(regHoy)) return;
    setTimeout(() => { if (btn.offsetParent) Animaciones._flashElemento(btn, 'destello-fichar'); }, INICIO_DESTELLO_MS);
}

// ─── Check de éxito en el botón Fichar ──────────────────────────────────────
// Reemplaza el ícono por icon-check-circle con entrada/salida (~2 s en total).
// Si mientras tanto se ficha de nuevo con error, el check sale enseguida.
const _exitoFichaje = new WeakMap();

function _limpiarAnimExito(svg) {
    svg.getAnimations?.().forEach(a => a.cancel());
    svg.style.animation = '';
    svg.classList.remove('fichaje-ok', 'fichaje-error', 'fichaje-ok-vuelta');
}

function _finalizarExitoFichaje(btn, conVuelta = true) {
    const est = _exitoFichaje.get(btn);
    if (!est) return;
    clearTimeout(est.timer);
    _exitoFichaje.delete(btn);
    const { svg, use, original, icono: iconoResultado } = est;
    _limpiarAnimExito(svg);
    // Si otro flujo ya cambió el ícono (ej. modo lote), no se pisa
    if (use.getAttribute('href') !== iconoResultado) return;
    use.setAttribute('href', original);
    if (conVuelta && !Movimiento.reducido()) {
        void svg.getBoundingClientRect();
        svg.classList.add('fichaje-ok-vuelta');
    }
}

export function animarExitoFichaje(btn) {
    _animarResultadoFichaje(btn, '#icon-check-circle', 'fichaje-ok');
}

/** Lo mismo que el check pero con una X (el fichaje falló): mismo ícono que rebota, misma pausa y misma salida, en rojo. */
export function animarErrorFichaje(btn) {
    _animarResultadoFichaje(btn, '#icon-x-circle', 'fichaje-error');
}

// Feedback de color del botón: un aro con relleno translúcido (capa ::after, solo opacity) en el color del resultado; sobre el relleno del énfasis el CSS lo pasa al color del texto
const _TIPOS_FEEDBACK = ['success', 'error', 'warning', 'info'];
const _feedbackTimers = new WeakMap();

/** @param {HTMLElement|null} btn @param {string} tipo success | error | warning | info */
export function destellarResultadoFichar(btn, tipo) {
    if (!btn) return;
    clearTimeout(_feedbackTimers.get(btn));
    btn.classList.remove('fichar-feedback', ..._TIPOS_FEEDBACK.map(t => `fichar-feedback--${t}`));
    void btn.offsetWidth;
    btn.classList.add('fichar-feedback', `fichar-feedback--${_TIPOS_FEEDBACK.includes(tipo) ? tipo : 'info'}`);
    _feedbackTimers.set(btn, setTimeout(() => btn.classList.remove('fichar-feedback', ..._TIPOS_FEEDBACK.map(t => `fichar-feedback--${t}`)), Animaciones._getCSSdur('--dur-flash') * 2 + 100));
}

/** @param {HTMLElement|null} btn @param {string} iconoResultado @param {string} clase */
function _animarResultadoFichaje(btn, iconoResultado, clase) {
    if (!btn || !btn.offsetParent) return;
    const svg = btn.querySelector('svg.icon');
    const use = svg?.querySelector('use');
    if (!svg || !use) return;

    const previo = _exitoFichaje.get(btn);
    const original = (previo && previo.svg === svg) ? previo.original : use.getAttribute('href');
    if (previo) { clearTimeout(previo.timer); _limpiarAnimExito(previo.svg); }
    else _limpiarAnimExito(svg);

    use.setAttribute('href', iconoResultado);
    void svg.getBoundingClientRect();
    svg.classList.add(clase);

    const timer = setTimeout(() => _finalizarExitoFichaje(btn), DUR_FICHAJE_OK());
    _exitoFichaje.set(btn, { svg, use, original, timer, icono: iconoResultado });
}

export function salirExitoFichaje(btn) {
    const est = btn && _exitoFichaje.get(btn);
    if (!est || est.saliendo) return;
    est.saliendo = true;
    clearTimeout(est.timer);
    if (Movimiento.reducido() || !est.svg.isConnected) { _finalizarExitoFichaje(btn); return; }

    const cs = getComputedStyle(est.svg);
    const desde = { transform: cs.transform, opacity: cs.opacity };
    const dur = DUR_FICHAJE_SALIDA();
    est.svg.style.animation = 'none';
    est.svg.animate([desde, { transform: 'scale(0.4)', opacity: 0 }], { duration: dur, easing: 'ease-in', fill: 'forwards' });
    est.timer = setTimeout(() => _finalizarExitoFichaje(btn), dur + 20);
}

export function cancelarExitoFichaje(btn) { _finalizarExitoFichaje(btn, false); }

// Ícono "real" del botón: ignora el check mientras dura la animación de éxito
export function obtenerIconoBtn(btn) {
    return _exitoFichaje.get(btn)?.original ?? btn.querySelector('svg use')?.getAttribute('href');
}

export function restaurarBotonGuardarEdicion(btnGuardar) {
    btnGuardar.disabled = false;
    montar(btnGuardar, html`${icono('#icon-check')} Guardar`);
}

export function setIconoBtn(btn, icono) {
    // Con el check de éxito en curso, el ícono nuevo pasa a ser el que se restaura al terminar
    const exito = _exitoFichaje.get(btn);
    if (exito) { exito.original = icono; return; }
    const use = btn.querySelector('svg use');
    if (use) use.setAttribute('href', icono);
}

