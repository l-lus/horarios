import { STORAGE_KEYS } from '../core/constantes.js';
import { $ } from '../core/dom.js';
import { Movimiento } from '../core/movimiento.js';
import { TiempoUtils } from '../core/tiempo-utils.js';
import { Almacenamiento } from '../core/almacenamiento.js';
import { GestorTemas } from './gestor-temas.js';
import { GestorPerfiles } from '../services/gestor-perfiles.js';
import { GestorModales } from './gestor-modales.js';
import { GestionDatos } from '../services/gestion-datos.js';
import { UIBase } from './ui-base.js';
import { TarjetaFondos } from './tarjeta-fondos.js';
import { UIOrdenTarjetas } from './ui-orden-tarjetas.js';
import { UINotificaciones } from './ui-notificaciones.js';
import { EventosApp } from '../core/eventos.js';
const D = GestionDatos;

// ====================================================================
// UI CONFIG MODULE (configuración, ayuda, tema y steppers)
// ====================================================================
const {
    _crearPressHold, _abrirModalConPadre, _cerrarModalConPadre, mostrarToast, _esperarAnim,
    _crearToggleConfig, _setBtnDisabled, _animarValor, _flashCampo, _scrollHastaVisible, _scrollA, debounce
} = UIBase;

const _reprogramarPushDebounced = debounce(() => D.sincronizarPushHoy(), 400);

const verificarBloqueoCredito = (...args) => D._notify().verificarBloqueoCredito(...args);
const actualizarUI = (...args) => D._notify().actualizarUI(...args);
const getFondoCard = (...args) => TarjetaFondos.getFondoCard(...args);
const _getLabelFondo = (...args) => TarjetaFondos._getLabelFondo(...args);
const _refrescarFormatoCortoStatsCache = () => EventosApp.emit('config:formato-corto-stats');
const actualizarEstadoBotonPersistir = (...args) => UIOrdenTarjetas.actualizarEstadoBotonPersistir(...args);
const actualizarEstadoBotonNotificaciones = (...args) => UINotificaciones.actualizarEstadoBotonNotificaciones(...args);

function alternarTema() {
    const temaActual = GestorTemas.temaGuardado();
    const temaSiguiente = GestorTemas.siguienteTema(temaActual);
    Almacenamiento.setItem(STORAGE_KEYS.TEMA_OSCURO, temaSiguiente);
    GestorTemas.aplicarTema(temaSiguiente);
}

const { toggle: toggleIgnorarTiempoFuera, actualizarEstado: actualizarEstadoBotonIgnorarTF } =
    _crearToggleConfig({
        getVal: () => D.getIgnorarTiempoFuera(),
        setVal: (v) => { D.setIgnorarTiempoFuera(v); Almacenamiento.setItem(STORAGE_KEYS.IGNORAR_TF, v, true); },
        btnId: 'btn-toggle-ignorar-tf',
        onAfterToggle: () => { D.recalcularTotalesEnMemoria(true); D.guardarYActualizar(); D.sincronizarPushHoy(); },
    });

const { toggle: toggleHoverPopupCalendario, actualizarEstado: actualizarEstadoBotonHoverPopup } =
    _crearToggleConfig({
        getVal: () => Almacenamiento.getBoolean(STORAGE_KEYS.HOVER_POPUP, false),
        setVal: (v) => Almacenamiento.setItem(STORAGE_KEYS.HOVER_POPUP, v),
        btnId: 'btn-toggle-hover-popup',
    });

const { toggle: toggleLogicaCubierto, actualizarEstado: actualizarEstadoBotonLogicaCubierto } =
    _crearToggleConfig({
        getVal: () => Almacenamiento.getBoolean(STORAGE_KEYS.IGNORAR_LOGICA_CUBIERTO, false, true),
        setVal: (v) => Almacenamiento.setItem(STORAGE_KEYS.IGNORAR_LOGICA_CUBIERTO, v, true),
        btnId: 'btn-toggle-logica-cubierto',
        onAfterToggle: () => { actualizarUI(); }
    });

const { toggle: toggleObjetivoPorRegistro, actualizarEstado: actualizarEstadoBotonObjetivoPorRegistro } =
    _crearToggleConfig({
        getVal: () => Almacenamiento.getBoolean(STORAGE_KEYS.IGNORAR_OBJETIVO_POR_REGISTRO, false, true),
        setVal: (v) => Almacenamiento.setItem(STORAGE_KEYS.IGNORAR_OBJETIVO_POR_REGISTRO, v, true),
        btnId: 'btn-toggle-objetivo-registro',
        onAfterToggle: () => { actualizarUI(); actualizarEstadoBotonAplicarHoras(); _reprogramarPushDebounced(); }
    });

const { toggle: toggleFormatoCortoStats, actualizarEstado: actualizarEstadoBotonFormatoCortoStats } =
    _crearToggleConfig({
        getVal: () => Almacenamiento.getBoolean(STORAGE_KEYS.FORMATO_CORTO_STATS, false),
        setVal: (v) => Almacenamiento.setItem(STORAGE_KEYS.FORMATO_CORTO_STATS, v),
        btnId: 'btn-toggle-formato-corto-stats',
        onAfterToggle: () => { _refrescarFormatoCortoStatsCache(); actualizarUI(); }
    });

function actualizarEstadoBotonAplicarHoras() {
    const modoGlobal = Almacenamiento.getBoolean(STORAGE_KEYS.IGNORAR_OBJETIVO_POR_REGISTRO, false, true);
    _setBtnDisabled('btn-aplicar-horas-todos', modoGlobal);
}

async function aplicarHorasConfiguradasATodos() {
    const btn = $('btn-aplicar-horas-todos');
    if (btn && btn.disabled) return;

    const horas = D.horasDiarias();
    const totalRegistros = D.registros().length;
    if (totalRegistros === 0) {
        mostrarToast('No hay registros para actualizar', 'info');
        return;
    }

    const confirmado = await GestorModales.confirmar(
        `Se va a reemplazar el objetivo horario de ${totalRegistros} registro${TiempoUtils.pluralizar(totalRegistros)} existente${TiempoUtils.pluralizar(totalRegistros)} por ${TiempoUtils.horasATexto(horas, 'short')}.`,
        'Aplicar',
        '#icon-aplicar-horas'
    );
    if (!confirmado) return;

    const { aplicados, creditosRecalculados } = D.aplicarHorasATodosLosRegistros();
    const guardado = await D.guardarYActualizar();
    if (guardado) {
        actualizarUI();
        _reprogramarPushDebounced();
        let mensaje = aplicados > 0
            ? `Objetivo actualizado en ${aplicados} registro${TiempoUtils.pluralizar(aplicados)}`
            : 'Los registros ya tenían este objetivo';
        if (creditosRecalculados > 0) {
            mensaje += ` (${creditosRecalculados} con Salida Temprana recalculada)`;
        }
        mostrarToast(mensaje, 'success');
    }
}

let _resolverOnboarding = null;

function cerrarConfig() {
    if (document.body.classList.contains('config-onboarding')) {
        _esperarAnim().then(() => document.body.classList.remove('config-onboarding'));
        Almacenamiento.setItem(STORAGE_KEYS.BIENVENIDA_VISTA, true, true);
        if (_resolverOnboarding) {
            _resolverOnboarding();
            _resolverOnboarding = null;
        }
    }
    const padre = GestorModales.getPadre('modal-config');
    if (padre) {
        GestorModales.alternar('modal-config', padre);
    } else {
        GestorModales.cerrar('modal-config');
    }
}

function abrirModalAyuda() {
    _abrirModalConPadre('modal-ayuda');
}

function cerrarModalAyuda() {
    _cerrarModalConPadre('modal-ayuda');
}

const _ETIQUETAS_ANIMACIONES = { auto: 'Auto', on: 'Sí', off: 'No' };

function actualizarHintAnimaciones() {
    const lbl = $('hint-animaciones-label');
    if (lbl) lbl.textContent = _ETIQUETAS_ANIMACIONES[Movimiento.modo()];
}

function toggleReducirAnimaciones() {
    Movimiento.siguienteModo();
    actualizarHintAnimaciones();
}

function _refrescarTogglesConfig() {
    actualizarEstadoBotonIgnorarTF();
    actualizarEstadoBotonLogicaCubierto();
    actualizarEstadoBotonObjetivoPorRegistro();
    actualizarEstadoBotonAplicarHoras();
    actualizarHintAnimaciones();
}

function _precargarCamposConfig() {
    const elHoras = $('config-horas-diarias');
    elHoras.dataset.valor = D.horasDiarias();
    elHoras.textContent = TiempoUtils.horasATexto(D.horasDiarias(), 'short');

    const diasActivos = D.diasHabiles();
    const checkboxes = document.querySelectorAll('input[name="dia-habil"]');
    checkboxes.forEach(cb => {
        cb.checked = diasActivos.includes(parseInt(cb.value));
        cb.onchange = actualizarFeedbackConfig;
    });

    actualizarFeedbackConfig();
    _refrescarTogglesConfig();
    actualizarEstadoBotonNotificaciones();
    const lbl = $('hint-fondo-label');
    if (lbl) lbl.textContent = _getLabelFondo(getFondoCard());
}

function mostrarconfig() {
    GestorModales.alternar('modal-selector-perfiles', 'modal-config', null, _precargarCamposConfig);
}

function mostrarConfigEnAjuste(id) {
    GestorModales.abrir('modal-config', _precargarCamposConfig);
    setTimeout(async () => {
        const el = $(id);
        const cuerpo = el?.closest('.modal-panel-body');
        if (!el || !cuerpo) return;
        await _scrollHastaVisible(el, { contenedor: cuerpo });
        _flashCampo(id);
    }, 500);
}

function refrescarConfigSiVisible() {
    _refrescarTogglesConfig();
    if (document.getElementById('modal-config')?.classList.contains('show')) {
        _precargarCamposConfig();
    }
}

function mostrarConfigOnboarding() {
    document.body.classList.add('config-onboarding');
    GestorModales.abrir('modal-config', _precargarCamposConfig);
    return new Promise(resolve => { _resolverOnboarding = resolve; });
}

function actualizarFeedbackConfig() {
    let checkboxes = document.querySelectorAll('input[name="dia-habil"]:checked');
    if (checkboxes.length === 0) {
        const vigentes = D.diasHabiles();
        document.querySelectorAll('input[name="dia-habil"]').forEach(cb => { cb.checked = vigentes.includes(parseInt(cb.value)); });
        mostrarToast('Seleccioná al menos un día', 'error');
        checkboxes = document.querySelectorAll('input[name="dia-habil"]:checked');
    }
    const seleccionados = checkboxes.length;
    const horas = parseFloat($('config-horas-diarias').dataset.valor) || 0;
    const total = seleccionados * horas;

    const el = $('config-total-feedback');
    if (el) {
        if (horas === 0) el.textContent = 'Registro libre sin objetivos';
        else el.textContent = `Total semanal: ${TiempoUtils.horasATexto(total, 'short')}`;
    }

    if (seleccionados > 0) {
        const nuevosDias = Array.from(checkboxes).map(cb => parseInt(cb.value)).sort((a, b) => a - b);
        const diasVigentes = [...D.diasHabiles()].sort((a, b) => a - b);
        const huboCambio = nuevosDias.length !== diasVigentes.length
            || nuevosDias.some((d, i) => d !== diasVigentes[i]);
        if (huboCambio) D.registrarCambioDiasHabiles(nuevosDias);
        const esDefault = GestorPerfiles && GestorPerfiles.esPerfilDefault();
        if (esDefault) Almacenamiento.setItem(STORAGE_KEYS.DIAS_HABILES, nuevosDias);
        D.guardarYActualizar();
        if (huboCambio) _reprogramarPushDebounced();
    }
    if (typeof actualizarEstadoBotonPersistir === 'function') {
        actualizarEstadoBotonPersistir();
    }
}

function _ajustarStepperHoras(el, incremento) {
    let valorActual = parseFloat(el.dataset.valor);
    if (isNaN(valorActual)) valorActual = D.horasDiarias();
    const nuevoValor = Math.min(24, Math.max(0, valorActual + incremento));
    if (isNaN(nuevoValor)) return nuevoValor;
    el.dataset.valor = nuevoValor;
    _animarValor(el, TiempoUtils.horasATexto(nuevoValor, 'short'), Math.sign(nuevoValor - valorActual));
    return nuevoValor;
}

const pressHoldHoras = _crearPressHold(incremento => cambiarHorasDiarias(incremento));

function cambiarHorasDiarias(incremento) {
    const nuevoValor = _ajustarStepperHoras($('config-horas-diarias'), incremento);
    if (isNaN(nuevoValor)) return;

    D.setHorasDiarias(nuevoValor);
    const esDefault = GestorPerfiles && GestorPerfiles.esPerfilDefault();
    if (esDefault) Almacenamiento.setItem(STORAGE_KEYS.HORAS_DIARIAS, nuevoValor);
    actualizarFeedbackConfig();
    _reprogramarPushDebounced();
}

const pressHoldObjetivoEdicion = _crearPressHold(incremento => cambiarObjetivoEdicion(incremento));

function cambiarObjetivoEdicion(incremento) {
    const el = $('edit-objetivo');
    if (!el) return;
    _ajustarStepperHoras(el, incremento);
    verificarBloqueoCredito();
}

function formatearInput(e) {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 4) v = v.substring(0, 4);
    if (v.length > 2) {
        e.target.value = v.substring(0, 2) + ':' + v.substring(2);
    } else {
        e.target.value = v;
    }
}

function bindEventos() {
    $('btn-toggle-ignorar-tf')?.addEventListener('click', () => toggleIgnorarTiempoFuera());
    $('btn-toggle-hover-popup')?.addEventListener('click', () => toggleHoverPopupCalendario());
    $('btn-toggle-animaciones')?.addEventListener('click', () => toggleReducirAnimaciones());
    $('btn-toggle-logica-cubierto')?.addEventListener('click', () => toggleLogicaCubierto());
    $('btn-toggle-objetivo-registro')?.addEventListener('click', () => toggleObjetivoPorRegistro());
    $('btn-toggle-formato-corto-stats')?.addEventListener('click', () => toggleFormatoCortoStats());
    $('btn-aplicar-horas-todos')?.addEventListener('click', () => aplicarHorasConfiguradasATodos());
    document.getElementById('btn-ayuda-perfiles')?.addEventListener('click', () => abrirModalAyuda());
    document.getElementById('btn-ayuda-config')?.addEventListener('click', () => abrirModalAyuda());
    document.querySelector('#modal-ayuda .btn-cancel')?.addEventListener('click', () => cerrarModalAyuda());
    document.getElementById('ayuda-indice')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.ayuda-indice-item');
        if (!btn) return;
        _scrollA(document.getElementById(btn.dataset.target), 'start');
    });
    document.querySelector('.config-actions .btn-delete')?.addEventListener('click', () => GestionDatos.borrarTodoHistorial());
    document.querySelector('#modal-config .modal-panel-footer .btn-cancel')?.addEventListener('click', () => cerrarConfig());
    const inputHoras = $('config-horas-diarias');
    if (inputHoras) {
        const btnHorasInc = $('btn-horas-diarias-inc');
        const btnHorasDec = $('btn-horas-diarias-dec');
        if (btnHorasInc) pressHoldHoras.vincular(btnHorasInc, 0.5);
        if (btnHorasDec) pressHoldHoras.vincular(btnHorasDec, -0.5);
    }
    const btnObjetivoInc = $('btn-edit-objetivo-inc');
    const btnObjetivoDec = $('btn-edit-objetivo-dec');
    if (btnObjetivoInc) pressHoldObjetivoEdicion.vincular(btnObjetivoInc, 0.5);
    if (btnObjetivoDec) pressHoldObjetivoEdicion.vincular(btnObjetivoDec, -0.5);
    document.querySelector('#modal-selector-perfiles .btn-settings')?.addEventListener('click', () => mostrarconfig());
    $('theme-toggle-modal')?.addEventListener('click', () => alternarTema());
    $('theme-toggle-config')?.addEventListener('click', () => alternarTema());
}

export const UIConfig = {
    actualizarEstadoBotonIgnorarTF, actualizarEstadoBotonHoverPopup,
    actualizarEstadoBotonLogicaCubierto, actualizarEstadoBotonObjetivoPorRegistro,
    actualizarEstadoBotonFormatoCortoStats, actualizarEstadoBotonAplicarHoras, cerrarConfig,
    cerrarModalAyuda, _precargarCamposConfig, refrescarConfigSiVisible, mostrarConfigOnboarding, mostrarConfigEnAjuste,
    pressHoldObjetivoEdicion, formatearInput, bindEventos
};
