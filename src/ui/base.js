import { Animaciones } from './animaciones.js';
import { STORAGE_KEYS } from '../core/constantes.js';
import { $ } from '../core/dom.js';
import { Movimiento } from '../core/movimiento.js';
import { TiempoUtils } from '../core/tiempo-utils.js';
import { Almacenamiento } from '../core/almacenamiento.js';
import { GestorPerfiles } from '../services/gestor-perfiles.js';
import { GestorModales } from './gestor-modales.js';
import { SeguridadYUtils as S } from '../core/seguridad.js';
import { GestionDatos as D } from '../services/gestion-datos.js';

// ====================================================================
//                     UI CORE MODULE (generic UI utilities)
// ====================================================================
function toggleSeccionGen(elementId, iconId, storageKey, callback = null) {
    const el = $(elementId);
    const icon = $(iconId);
    if (!el) return;

    el.classList.toggle('expanded');
    const isExpanded = el.classList.contains('expanded');
    if (icon) {
        if (isExpanded) icon.classList.add('rotated');
        else icon.classList.remove('rotated');
    }

    if (Almacenamiento.getBoolean(STORAGE_KEYS.PERSISTIR_TARJETAS, true)) {
        Almacenamiento.setItem(storageKey, isExpanded);
    }
    if (isExpanded && callback) callback();
}


let toastTimeout = null;
let _toastQueue = [];
let _toastRunning = false;
let _toastAccionActual = null;
const MAX_TOAST_QUEUE = 4;

function formatoDiferencia(tiempoTotal, objetivo = D.horasDiarias()) {
    return TiempoUtils.formatoDiferencia(tiempoTotal, objetivo);
}

function registrarSwipe(el, callback, { minX = 50, maxY = 80 } = {}) {
    if (!el || el.dataset.swipeInit) return;
    el.dataset.swipeInit = '1';
    let _x = null, _y = null;
    let _direccionBloqueada = null;

    el.addEventListener('touchstart', e => {
        if (e.touches.length !== 1) return;
        _x = e.touches[0].clientX;
        _y = e.touches[0].clientY;
        _direccionBloqueada = null;
    }, { passive: true });

    el.addEventListener('touchmove', e => {
        if (_x === null || _y === null) return;

        const dx = Math.abs(e.touches[0].clientX - _x);
        const dy = Math.abs(e.touches[0].clientY - _y);

        if (!_direccionBloqueada && (dx > 5 || dy > 5)) {
            _direccionBloqueada = dx > dy ? 'x' : 'y';
        }

        if (_direccionBloqueada === 'x' && e.cancelable) {
            e.preventDefault();
        }
    }, { passive: false });

    el.addEventListener('touchend', e => {
        if (_x === null || _direccionBloqueada === 'y') {
            _x = null; _y = null;
            return;
        }

        const dx = e.changedTouches[0].clientX - _x;
        const dy = e.changedTouches[0].clientY - _y;
        _x = null; _y = null;

        if (Math.abs(dy) > maxY) return;
        if (Math.abs(dx) < minX) return;
        callback(dx < 0 ? 1 : -1);
    }, { passive: true });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function _crearPressHold(accionFn) {
    let timeout = null, intervalo = null;
    const iniciar = (arg) => {
        accionFn(arg);
        timeout = setTimeout(() => {
            intervalo = setInterval(() => accionFn(arg), 100);
        }, 500);
    };
    const detener = () => {
        if (timeout) { clearTimeout(timeout); timeout = null; }
        if (intervalo) { clearInterval(intervalo); intervalo = null; }
    };
    const vincular = (btn, arg) => {
        const start = (e) => {
            if (btn.disabled) return;
            if (e.type === 'touchstart') e.preventDefault();
            iniciar(arg);
        };
        const stop = (e) => {
            if (e && e.type === 'touchend') e.preventDefault();
            detener();
        };
        btn.addEventListener('mousedown', start);
        btn.addEventListener('touchstart', start, { passive: false });
        btn.addEventListener('mouseup', stop);
        btn.addEventListener('mouseleave', stop);
        btn.addEventListener('touchend', stop, { passive: false });
        btn.addEventListener('touchcancel', stop);
    };
    return { iniciar, detener, vincular };
}

function _actualizarOffsetsStickyMes() {
    const header = document.querySelector('.header');
    const mesHeader = document.querySelector('.registro-mes-header');
    const root = document.documentElement.style;
    if (header) root.setProperty('--app-header-h', header.getBoundingClientRect().height + 'px');
    if (mesHeader) root.setProperty('--mes-header-h', mesHeader.getBoundingClientRect().height + 'px');
}
const actualizarOffsetsStickyMesDebounced = debounce(_actualizarOffsetsStickyMes, 150);

function mostrarError(inputId, errorId) {
    const input = $(inputId);
    const error = $(errorId);
    if (input) input.classList.add('error');
    if (error) error.style.display = 'block';
}

function limpiarError(inputId, errorId) {
    const input = $(inputId);
    const error = $(errorId);
    if (input) input.classList.remove('error');
    if (error) error.style.display = 'none';
}

function obtenerNombrePerfilSafe() {
    let nombre = 'Backup';
    if (GestorPerfiles) nombre = GestorPerfiles.obtenerDatosPerfil().nombre;
    return nombre.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ'\-_ ]/g, '').trim().replace(/\s+/g, '_');
}

function descargarJSON(data, nombreArchivo) {
    descargarArchivo(JSON.stringify(data, null, 2), nombreArchivo, 'application/json');
}

function descargarArchivo(contenido, nombreArchivo, mime) {
    const blob = new Blob([contenido], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: nombreArchivo });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function mostrarToast(mensaje, tipo = 'info', duracion = 3000, detalle = null, accion = null) {
    const texto = detalle ? `${mensaje}, ${detalle}` : mensaje;
    const textoLimpio = S.sanitizeString(texto, 200);
    const ultimo = _toastQueue[_toastQueue.length - 1];
    const actual = _toastRunning ? $('toast')?.textContent : null;
    if ((ultimo && ultimo.mensaje === textoLimpio) || actual === textoLimpio) return;
    _toastQueue.push({ mensaje: textoLimpio, tipo, duracionBase: duracion, accion });
    if (_toastQueue.length > MAX_TOAST_QUEUE) {
        _toastQueue.splice(0, _toastQueue.length - MAX_TOAST_QUEUE);
    }
    if (!_toastRunning) _procesarToastQueue();
}

function _procesarToastQueue() {
    if (_toastQueue.length === 0) {
        _toastRunning = false;
        _toastAccionActual = null;
        return;
    }

    _toastRunning = true;
    const actual = _toastQueue.shift();
    _toastAccionActual = actual.accion || null;
    const toast = $('toast');
    toast.classList.remove('show');
    toast.textContent = actual.mensaje;
    toast.className = `toast ${actual.tipo}`;
    toast.classList.toggle('toast-accionable', !!actual.accion);
    let duracionFinal = actual.duracionBase || 3000;
    if (_toastQueue.length >= 1) {
        duracionFinal = Math.floor(duracionFinal / 2);
    }

    setTimeout(() => {
        toast.classList.add('show');
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
            toastTimeout = null;
            _esperarAnim().then(() => _procesarToastQueue());
        }, duracionFinal);
    }, 10);
}

function _cerrarToastActual() {
    if (toastTimeout) { clearTimeout(toastTimeout); toastTimeout = null; }
    const toast = $('toast');
    if (!toast || !toast.classList.contains('show')) return;
    toast.classList.remove('show');
    _esperarAnim().then(() => _procesarToastQueue());
}

function _habilitarCierreToast() {
    const toast = $('toast');
    if (!toast || toast.dataset.cierreInit) return;
    toast.dataset.cierreInit = '1';
    toast.addEventListener('click', () => {
        const accion = _toastAccionActual;
        _cerrarToastActual();
        if (accion) accion();
    });
    registrarSwipe(toast, () => _cerrarToastActual(), { minX: 40 });
}

function resetearBoton(btn) {
    btn.disabled = false;
    btn.classList.remove('btn-color-muted', 'btn-color-red');
    btn.innerHTML = '<svg class="icon"><use href="#icon-save"/></svg> <span id="btn-registrar-texto">Fichar</span>';
}

function restaurarBotonGuardarEdicion(btnGuardar) {
    btnGuardar.disabled = false;
    btnGuardar.innerHTML = '<svg class="icon"><use href="#icon-save"/></svg> Guardar';
}

const { _durSiAnima, DUR_ANIM, DUR_CALENDARIO, _aArray, _estaColapsado, _esperarAnim, _finalizarSlidePendiente, _animarSlideElemento, _animarFadeSwap, _animarMutacion, _crearFantasmaSiVisible, _animarValor, _animarConteo, _conteoEnCurso, _cancelarConteo } = Animaciones;
function _crearToggleConfig({ getVal, setVal, btnId, onAfterToggle, puedeActivar }) {
    function actualizarEstado() {
        const val = getVal();
        _setBtnActivo(btnId, val);
        if (puedeActivar) _setBtnDisabled(btnId, !val && !puedeActivar());
    }
    function toggle() {
        const nuevo = !getVal();
        if (nuevo && puedeActivar && !puedeActivar()) {
            actualizarEstado();
            return;
        }
        setVal(nuevo);
        actualizarEstado();
        onAfterToggle?.(nuevo);
    }
    return { toggle, actualizarEstado };
}

function _setBtnActivo(id, activo) {
    const btn = document.getElementById(id);
    if (btn) btn.classList.toggle('btn-activo', activo);
}

function _crearOpcion(value, text, selected = false) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    if (selected) { opt.selected = true; opt.setAttribute('selected', ''); }
    return opt;
}

function _poblarSelect(selectId, items, getLabel, selDefault, actualizarFn, agruparFn = null) {
    const select = $(selectId);
    if (!select) return;
    const selActual = select.value;
    select.innerHTML = '';
    if (!items.length) { select.appendChild(_crearOpcion('', 'Sin registros')); actualizarFn(null); return; }
    const sel = (selActual && items.includes(selActual))
        ? selActual
        : (items.includes(selDefault)
            ? selDefault
            : (items.find(k => k <= selDefault) || items[items.length - 1]));
    if (agruparFn) {
        agruparFn(items).forEach((claves, grupo) => {
            const grp = document.createElement('optgroup');
            grp.label = grupo;
            claves.forEach(k => grp.appendChild(_crearOpcion(k, getLabel(k), k === sel)));
            select.appendChild(grp);
        });
    } else {
        items.forEach(k => select.appendChild(_crearOpcion(k, getLabel(k), k === sel)));
    }
    actualizarFn(sel);
}

function setIconoBtn(btn, icono) {
    const use = btn.querySelector('svg use');
    if (use) use.setAttribute('href', icono);
}

function _setBtnDisabled(id, disabled) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = disabled;
}

function _posicionarPopup(popup, event) {
    const el = event.currentTarget || event.target;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    requestAnimationFrame(() => {
        if (!popup.isConnected || popup.classList.contains('closing')) return;
        const pw = popup.offsetWidth, ph = popup.offsetHeight;
        let top = rect.bottom + 12;
        let left = rect.left + (rect.width / 2) - (pw / 2);
        if (left + pw > window.innerWidth - margin) left = window.innerWidth - pw - margin;
        if (left < margin) left = margin;
        if (top + ph > window.innerHeight - margin) top = rect.top - ph - 12;
        if (top < margin) top = margin;
        popup.style.top = `${top}px`;
        popup.style.left = `${left}px`;

        const triggerCenterX = rect.left + rect.width / 2;
        const triggerCenterY = rect.top + rect.height / 2;
        const originX = Math.round(triggerCenterX - left);
        const originY = Math.round(triggerCenterY - top);
        popup.style.transformOrigin = `${originX}px ${originY}px`;

        popup.style.visibility = '';
        requestAnimationFrame(() => {
            if (!popup.isConnected || popup.classList.contains('closing')) return;
            popup.classList.add('show');
            setTimeout(() => {
                if (!popup.classList.contains('closing')) popup.classList.add('listo');
            }, 280);
        });
    });
}

function _registrarCierrePopup(popup, selectorTrigger, esMismoTrigger, alCerrar) {
    let cerrado = false;
    const cerrar = () => {
        if (cerrado) return;
        cerrado = true;
        popup.classList.remove('show');
        popup.classList.remove('listo');
        popup.classList.add('closing');
        document.removeEventListener('click', onClick, true);
        document.removeEventListener('scroll', cerrar, true);
        setTimeout(() => {
            popup.remove();
            if (alCerrar) alCerrar(popup);
        }, 200);
    };
    popup._cerrar = cerrar;
    const onClick = (e) => {
        const trigger = e.target.closest(selectorTrigger);
        if (trigger && esMismoTrigger(trigger)) return;
        if (!popup.contains(e.target)) cerrar();
    };
    setTimeout(() => {
        if (cerrado) return;
        document.addEventListener('click', onClick, { capture: true, passive: true });
        document.addEventListener('scroll', cerrar, { capture: true, passive: true });
    }, 10);
    return cerrar;
}

function _crearPopupFlotante({ className, id, dataset = {}, html, event, selectorTrigger, esMismoTrigger, alCerrar }) {
    const popup = document.createElement('div');
    popup.className = className;
    popup.id = id;
    Object.entries(dataset).forEach(([k, v]) => { popup.dataset[k] = v; });
    popup.innerHTML = html;
    popup.style.visibility = 'hidden';
    document.body.appendChild(popup);

    const cerrar = _registrarCierrePopup(popup, selectorTrigger, esMismoTrigger, alCerrar);
    _posicionarPopup(popup, event);
    return { popup, cerrar };
}

function _abrirModalConPadre(modalId, setupFn = null) {
    const modalAbierto = document.querySelector('.modal.show');
    const padre = modalAbierto ? modalAbierto.id : null;
    if (setupFn) setupFn();
    if (padre) GestorModales.alternar(padre, modalId);
    else GestorModales.abrir(modalId);
}

function _cerrarModalConPadre(modalId, callbackAbrirPadre = null) {
    const padre = GestorModales.getPadre(modalId);
    if (padre) GestorModales.alternar(modalId, padre, null, callbackAbrirPadre ? () => callbackAbrirPadre(padre) : null);
    else GestorModales.cerrar(modalId);
}

function _flashElemento(el, clase, colorVar = null) {
    if (!el) return;
    clearTimeout(el._flashTimeout);
    el.classList.remove(clase);
    if (colorVar) el.style.setProperty('--flash-color', colorVar);
    void el.offsetWidth;
    el.classList.add(clase);

    const cs = getComputedStyle(el);
    const duracionMs = (parseFloat(cs.animationDuration) || 0.5) * 1000;
    const iteraciones = parseFloat(cs.animationIterationCount) || 1;
    const totalMs = duracionMs * iteraciones;

    el._flashTimeout = setTimeout(() => el.classList.remove(clase), totalMs);
}

function _flashCampoConClase(clase, ids, colorVar = null) {
    ids.forEach(id => _flashElemento(document.getElementById(id), clase, colorVar));
}

function _flashCampo(...ids) { _flashCampoConClase('campo-flash', ids); }

function _scrollA(el, block = 'nearest') {
    if (el) el.scrollIntoView({ behavior: Movimiento.scrollBehavior(), block });
}
function _esperarFinScroll(objetivo = window, { estable = 120, maximo = 1500 } = {}) {
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

function _scrollHastaVisible(el, { contenedor = null, margenSuperior = 0 } = {}) {
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

const _COLOR_TOAST_POR_TIPO = {
    success: 'var(--c-green)', error: 'var(--c-red)', warning: 'var(--c-red)', info: 'var(--c-blue)'
};

function _vibrarFichar(tipo) {
    if (!('vibrate' in navigator)) return;
    try {
        if (tipo === 'success') {
            navigator.vibrate(40);
        } else {
            navigator.vibrate([50, 60, 50]);
        }
    } catch (_) { }
}

function _flashCampoTipo(tipo, ...ids) {
    _flashCampoConClase('campo-flash-color', ids, _COLOR_TOAST_POR_TIPO[tipo] || 'var(--text-main)');
    if (ids.includes('btn-agregar')) {
        _vibrarFichar(tipo);
    }
}

function _avisarFichaje(msg, tipo = 'error', { btn = null, duracion } = {}) {
    if (btn) resetearBoton(btn);
    if (msg) mostrarToast(msg, tipo, duracion);
    _flashCampoTipo(tipo, 'btn-agregar');
}

function aplicarFeedbackCampos(campos, texto = '✓ Agregado', claseColor = 'label-feedback--green') {
    const activos = campos
        .filter(c => c.mostrar)
        .map(c => {
            const input = document.getElementById(c.id);
            const label = input?.closest('.form-group')?.querySelector('label');
            const textoOriginal = label ? label.textContent : c.fallback;
            return { label, textoOriginal };
        });

    const labels = activos.filter(a => a.label).map(a => a.label);

    _animarMutacion(labels, () => {
        activos.forEach(({ label }) => {
            if (!label) return;
            label.textContent = texto;
            label.classList.add(claseColor);
        });
    });

    setTimeout(() => {
        _animarMutacion(labels, () => {
            activos.forEach(({ label, textoOriginal }) => {
                if (!label) return;
                label.textContent = textoOriginal;
                label.classList.remove(claseColor);
            });
        });
    }, 2000);
}

export const UIBase = {
    aplicarFeedbackCampos,
    formatoDiferencia,
    registrarSwipe,
    debounce,
    _crearPressHold,
    _actualizarOffsetsStickyMes,
    actualizarOffsetsStickyMesDebounced,
    mostrarError,
    limpiarError,
    obtenerNombrePerfilSafe,
    descargarJSON,
    descargarArchivo,
    mostrarToast,
    _cerrarToastActual,
    _habilitarCierreToast,
    resetearBoton,
    restaurarBotonGuardarEdicion,
    _durSiAnima,
    DUR_ANIM,
    DUR_CALENDARIO,
    _crearToggleConfig,
    _setBtnActivo,
    _crearOpcion,
    _poblarSelect,
    setIconoBtn,
    _setBtnDisabled,
    _posicionarPopup,
    _registrarCierrePopup,
    _crearPopupFlotante,
    _abrirModalConPadre,
    _cerrarModalConPadre,
    _flashCampo,
    _aArray,
    _estaColapsado,
    _scrollA,
    _esperarAnim,
    _esperarFinScroll,
    _scrollHastaVisible,
    _avisarFichaje,
    _flashElemento,
    _finalizarSlidePendiente,
    _animarSlideElemento,
    toggleSeccionGen,
    _animarFadeSwap,
    _animarMutacion,
    _crearFantasmaSiVisible,
    _animarValor,
    _animarConteo,
    _conteoEnCurso,
    _cancelarConteo
};
