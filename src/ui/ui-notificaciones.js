import { $ } from '../core/dom.js';
import { PushReminder } from '../services/push-reminder.js';
import { UICore } from './ui-core.js';
import { DataManagement as D } from '../services/data-management.js';

// ====================================================================
// UI NOTIFICATIONS MODULE (push y permisos de notificaciones)
// ====================================================================
const {
    debounce, _abrirModalConPadre, _cerrarModalConPadre, _crearToggleConfig, _setBtnActivo,
    _setBtnDisabled
} = UICore;

function _actualizarDisponibilidadBotonesPush() {
    const habilitado = PushReminder.getHabilitado();
    const usaBufferSemanal = PushReminder.getUsarBufferSemanal();
    _setBtnDisabled('btn-toggle-push-buffer', !habilitado);
    _setBtnDisabled('btn-toggle-push-buffer-ultimo-dia', !habilitado || !usaBufferSemanal);
}

function actualizarEstadoBotonNotificaciones() {
    _setBtnActivo('btn-toggle-notification', PushReminder.getHabilitado());
}

const _sincronizarPushHoyDebounced = debounce(() => D.sincronizarPushHoy(), 400);

const { toggle: togglePushBuffer, actualizarEstado: actualizarEstadoBotonPushBuffer } =
    _crearToggleConfig({
        getVal: () => PushReminder.getUsarBufferSemanal(),
        setVal: (v) => PushReminder.setUsarBufferSemanal(v),
        btnId: 'btn-toggle-push-buffer',
        onAfterToggle: () => {
            actualizarEstadoBotonPushBufferUltimoDia();
            _actualizarDisponibilidadBotonesPush();
            _sincronizarPushHoyDebounced();
        },
    });

const { toggle: togglePushBufferUltimoDia, actualizarEstado: actualizarEstadoBotonPushBufferUltimoDia } =
    _crearToggleConfig({
        getVal: () => PushReminder.getBufferSoloUltimoDia(),
        setVal: (v) => PushReminder.setBufferSoloUltimoDia(v),
        btnId: 'btn-toggle-push-buffer-ultimo-dia',
        onAfterToggle: () => _sincronizarPushHoyDebounced(),
    });

const { toggle: togglePushHabilitado, actualizarEstado: actualizarEstadoBotonPushHabilitado } =
    _crearToggleConfig({
        getVal: () => PushReminder.getHabilitado(),
        setVal: (v) => PushReminder.setHabilitado(v),
        btnId: 'btn-toggle-push-habilitado',
        puedeActivar: () => PushReminder.puedeHabilitarse(),
        onAfterToggle: () => {
            _actualizarDisponibilidadBotonesPush();
            actualizarEstadoBotonNotificaciones();
            _sincronizarPushHoyDebounced();
        },
    });

function actualizarSelectPushAnticipacion() {
    const select = $('config-push-anticipacion');
    if (select) select.value = String(PushReminder.getAnticipacionMin());
}

function cambiarPushAnticipacion(minutos) {
    PushReminder.setAnticipacionMin(minutos);
    _sincronizarPushHoyDebounced();
}

let _permisoNotifStatus = null;

async function _suscribirCambiosPermisoNotificaciones() {
    if (_permisoNotifStatus || !navigator.permissions?.query) return;
    try {
        _permisoNotifStatus = await navigator.permissions.query({ name: 'notifications' });
        _permisoNotifStatus.onchange = () => actualizarEstadoPermisoNotificaciones();
    } catch {
    }
}

function actualizarEstadoPermisoNotificaciones() {
    const el = $('push-permiso-estado');
    if (!el) return;
    el.innerHTML = '';

    if (!('Notification' in window)) return;

    const permiso = Notification.permission;
    let claseColor, texto;
    if (permiso === 'denied') {
        claseColor = 'negativo';
        texto = 'Permisos de notificaciones bloqueados en el navegador';
    } else if (!PushReminder.getHabilitado() && !PushReminder.puedeHabilitarse()) {
        claseColor = 'neutral';
        texto = 'Usá la app para activar tus notificaciones en este perfil';
    } else if (permiso === 'granted') {
        claseColor = 'positivo';
        texto = 'Permisos de notificaciones aceptados';
    } else {
        claseColor = 'neutral';
        texto = 'Todavía no se pidió permiso al navegador';
    }

    const punto = document.createElement('span');
    punto.className = `buffer-semanal-punto ${claseColor}`;
    const span = document.createElement('span');
    span.className = `buffer-semanal-texto ${claseColor}`;
    span.textContent = texto;
    span.insertBefore(punto, span.firstChild);
    el.appendChild(span);
}

function abrirModalNotificaciones() {
    _abrirModalConPadre('modal-notificaciones', () => {
        actualizarEstadoBotonPushHabilitado();
        actualizarEstadoBotonPushBuffer();
        actualizarEstadoBotonPushBufferUltimoDia();
        _actualizarDisponibilidadBotonesPush();
        actualizarEstadoBotonNotificaciones();
        actualizarSelectPushAnticipacion();
        actualizarEstadoPermisoNotificaciones();
    });
}

function cerrarModalNotificaciones() {
    _cerrarModalConPadre('modal-notificaciones');
}

function bindEventos() {
    $('btn-toggle-push-buffer')?.addEventListener('click', () => togglePushBuffer());
    $('btn-toggle-push-buffer-ultimo-dia')?.addEventListener('click', () => togglePushBufferUltimoDia());
    $('btn-toggle-push-habilitado')?.addEventListener('click', () => togglePushHabilitado());
    $('config-push-anticipacion')?.addEventListener('change', (e) => cambiarPushAnticipacion(e.target.value));
    $('btn-toggle-notification')?.addEventListener('click', () => abrirModalNotificaciones());
    document.querySelector('#modal-notificaciones .btn-cancel')?.addEventListener('click', () => cerrarModalNotificaciones());
}

export const UINotificaciones = {
    actualizarEstadoBotonNotificaciones, actualizarEstadoBotonPushBuffer,
    actualizarEstadoBotonPushHabilitado, actualizarSelectPushAnticipacion,
    _suscribirCambiosPermisoNotificaciones, abrirModalNotificaciones, cerrarModalNotificaciones,
    bindEventos
};
