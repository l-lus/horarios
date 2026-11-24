import { Preferencias } from '../core/preferencias.js';
import { $ } from '../core/dom.js';
import { Almacenamiento } from '../core/almacenamiento.js';
import { Animaciones } from './animaciones.js';

// ====================================================================
// CONTROLES — botones con estado, interruptores de Ajustes, selects, secciones plegables, errores y destellos de campos
// ====================================================================
const { _animarMutacion, _flashElemento } = Animaciones;

/** @param {string | HTMLElement | null} idOEl */
const _el = (idOEl) => (typeof idOEl === 'string' ? $(idOEl) : idOEl);

/** @param {any} [callback] */
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

    if (Preferencias.PERSISTIR_TARJETAS.get()) {
        Almacenamiento.setItem(storageKey, isExpanded);
    }
    if (isExpanded && callback) callback();
}

function mostrarError(inputId, errorId) {
    const input = $(inputId);
    const error = $(errorId);
    if (input) input.classList.add('error');
    if (error) error.classList.remove('hidden');
}

function limpiarError(inputId, errorId) {
    const input = $(inputId);
    const error = $(errorId);
    if (input) input.classList.remove('error');
    if (error) error.classList.add('hidden');
}

/**
 * @param {{ getVal: () => boolean, setVal: (v: boolean) => any, btnId: string,
 *           onAfterToggle?: (v: boolean) => void, puedeActivar?: () => boolean }} cfg
 */
function crearToggleConfig({ getVal, setVal, btnId, onAfterToggle, puedeActivar }) {
    function actualizarEstado() {
        const val = getVal();
        setBtnActivo(btnId, val);
        if (puedeActivar) setBtnDisabled(btnId, !val && !puedeActivar());
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

/** Marca o desmarca un botón con estado (clase .btn-activo). @param {string | HTMLElement | null} idOEl @param {boolean} activo */
function setBtnActivo(idOEl, activo) {
    _el(idOEl)?.classList.toggle('btn-activo', activo);
}

/** ¿El botón con estado está marcado? @param {string | HTMLElement | null} idOEl */
function esBtnActivo(idOEl) {
    return !!_el(idOEl)?.classList.contains('btn-activo');
}

/** Invierte el botón con estado y devuelve cómo quedó. @param {string | HTMLElement | null} idOEl */
function alternarBtnActivo(idOEl) {
    return !!_el(idOEl)?.classList.toggle('btn-activo');
}

function setBtnDisabled(id, disabled) {
    const btn = $(id);
    if (!btn) return;
    btn.disabled = disabled;
}

function crearOpcion(value, text, selected = false) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    if (selected) { opt.selected = true; opt.setAttribute('selected', ''); }
    return opt;
}

/** @param {any} [agruparFn] */
function poblarSelect(selectId, items, getLabel, selDefault, actualizarFn, agruparFn = null) {
    const select = $(selectId);
    if (!select) return;
    const selActual = select.value;
    select.replaceChildren();
    if (!items.length) { select.appendChild(crearOpcion('', 'Sin registros')); actualizarFn(null); return; }
    const sel = (selActual && items.includes(selActual))
        ? selActual
        : (items.includes(selDefault)
            ? selDefault
            : (items.find(k => k <= selDefault) || items[items.length - 1]));
    if (agruparFn) {
        agruparFn(items).forEach((claves, grupo) => {
            const grp = document.createElement('optgroup');
            grp.label = grupo;
            claves.forEach(k => grp.appendChild(crearOpcion(k, getLabel(k), k === sel)));
            select.appendChild(grp);
        });
    } else {
        items.forEach(k => select.appendChild(crearOpcion(k, getLabel(k), k === sel)));
    }
    actualizarFn(sel);
}

/** @param {any} [colorVar] */
function flashCampoConClase(clase, ids, colorVar = null) {
    ids.forEach(id => _flashElemento($(id), clase, colorVar));
}

function flashCampo(...ids) { flashCampoConClase('campo-flash', ids); }

function aplicarFeedbackCampos(campos, texto = '✓ Agregado', claseColor = 'label-feedback--green') {
    const activos = campos
        .filter(c => c.mostrar)
        .map(c => {
            const input = $(c.id);
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

export const Controles = {
    toggleSeccionGen, mostrarError, limpiarError, crearToggleConfig,
    setBtnActivo, esBtnActivo, alternarBtnActivo, setBtnDisabled,
    crearOpcion, poblarSelect, flashCampoConClase, flashCampo, aplicarFeedbackCampos
};
