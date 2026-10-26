import { STORAGE_KEYS } from '../core/constants.js';
import { TimeUtils } from '../core/time-utils.js';
import { SecurityAndUtils } from '../core/security.js';
import { StorageHelper } from '../core/storage.js';
import { PerfilManager } from './perfil-manager.js';
import { TiposRegistro } from './tipos-registro.js';
import { AppState } from './app-state.js';

// ====================================================================
// PUSH REMINDER MODULE — notification via Cloudflare
// ====================================================================
const WORKER_URL = 'https://horarios-push.lushibosca.workers.dev';
const VAPID_PUBLIC_KEY = 'BMU-iLslFVrTxUKMHRUn8r_CtyCLX41ppVTUgdATAdPYE8ayJ0U_ew6d50CmvghkIdv34fGuXvf-KP5W62rs3ms';
const APP_SECRET = '487e4c492604b653b56e9ba234cb9eda007fc149c66650e9'; // que mira bobo, anda paya
const MARGEN_CRON_MS = 60 * 1000;
const AVISO_FALLO_CADA_MS = 10 * 60 * 1000;
const REINTENTOS_MAX = 3;
const REINTENTO_ESPERA_MS = 60 * 1000;
let _generacionProgramacion = 0;
let _generacionCancelada = 0;

let notify = { mostrarToast: () => { } };
function configurarNotificaciones(handlers) { notify = { ...notify, ...handlers }; }

const _ultimoAvisoFallo = {};
function _avisarFallo(accion, status) {
    const motivo = status == null
        ? (navigator.onLine === false ? 'sin conexión' : 'no se pudo contactar al servicio')
        : status === 409 ? 'este dispositivo está vinculado a otra instalación'
            : status === 429 ? 'el servicio está recibiendo demasiados pedidos'
                : 'el servicio no está disponible ahora';
    const clave = `${accion}|${motivo}`;
    const ahora = Date.now();
    if (ahora - (_ultimoAvisoFallo[clave] || 0) < AVISO_FALLO_CADA_MS) return;
    _ultimoAvisoFallo[clave] = ahora;
    const mensaje = accion === 'cancelar'
        ? 'No se pudo cancelar el aviso de hoy (puede que igual te llegue)'
        : 'No se pudo programar el aviso de fin de jornada';
    notify.mostrarToast(mensaje, 'warning', 5000, motivo);
}

function _headersWorker() {
    const headers = { 'Content-Type': 'application/json' };
    if (APP_SECRET && !APP_SECRET.startsWith('PEGA_ACA')) headers['X-App-Secret'] = APP_SECRET;
    return headers;
}

function _postWorker(path, payload, keepalive = false) {
    return fetch(`${WORKER_URL}${path}`, {
        method: 'POST',
        headers: _headersWorker(),
        body: JSON.stringify(payload),
        keepalive: !!keepalive
    });
}

function _urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from([...atob(base64)].map(c => c.charCodeAt(0)));
}

let _idInstalacionFallback = null;

function _idInstalacion() {
    const KEY = 'pushInstallId';
    const existente = StorageHelper.getItem(KEY, null);
    if (existente) return existente;

    const nuevo = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (StorageHelper.setItem(KEY, nuevo)) return nuevo;
    if (!_idInstalacionFallback) {
        _idInstalacionFallback = crypto.randomUUID
            ? crypto.randomUUID()
            : `sin-storage-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    return _idInstalacionFallback;
}

let _ownerTokenFallback = null;

function _generarOwnerToken() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function _ownerToken() {
    const KEY = 'pushOwnerToken';
    const existente = StorageHelper.getItem(KEY, null);
    if (existente && /^[a-f0-9]{64}$/.test(existente)) return existente;

    const nuevo = _generarOwnerToken();
    if (StorageHelper.setItem(KEY, nuevo)) return nuevo;
    if (!_ownerTokenFallback) _ownerTokenFallback = _generarOwnerToken();
    return _ownerTokenFallback;
}

function _perfilActivo() {
    return (PerfilManager ? PerfilManager.obtenerPerfilActual() : null) || 'default';
}

function _claveRecordatorio(fechaISO, perfilId) {
    return `${_idInstalacion()}:${perfilId || _perfilActivo()}:${fechaISO}`;
}

function _getLegacyOPerfil(key, defaultValue, parseFn) {
    const val = StorageHelper.getItem(key, null, true);
    if (val !== null) return parseFn ? parseFn(val) : val;
    const legacyVal = StorageHelper.getItem(key, null, false);
    if (legacyVal !== null) {
        const parsed = parseFn ? parseFn(legacyVal) : legacyVal;
        StorageHelper.setItem(key, parsed, true);
        StorageHelper.removeItem(key, false);
        return parsed;
    }
    return defaultValue;
}

function getAnticipacionMin() {
    return _getLegacyOPerfil(STORAGE_KEYS.PUSH_ANTICIPACION_MIN, 0, v => {
        const n = parseFloat(v);
        return isNaN(n) ? 0 : n;
    });
}
function setAnticipacionMin(minutos) {
    const n = Number(minutos);
    const seguro = Number.isFinite(n) ? Math.min(60, Math.max(0, n)) : 0;
    StorageHelper.setItem(STORAGE_KEYS.PUSH_ANTICIPACION_MIN, seguro, true);
}
function getUsarBufferSemanal() {
    return _getLegacyOPerfil(STORAGE_KEYS.PUSH_USAR_BUFFER_SEMANAL, false, v => v === 'true');
}
function setUsarBufferSemanal(valor) {
    StorageHelper.setItem(STORAGE_KEYS.PUSH_USAR_BUFFER_SEMANAL, !!valor, true);
}
function getBufferSoloUltimoDia() {
    return _getLegacyOPerfil(STORAGE_KEYS.PUSH_BUFFER_SOLO_ULTIMO_DIA, false, v => v === 'true');
}
function setBufferSoloUltimoDia(valor) {
    StorageHelper.setItem(STORAGE_KEYS.PUSH_BUFFER_SOLO_ULTIMO_DIA, !!valor, true);
}
function getHabilitado() {
    return _getLegacyOPerfil(STORAGE_KEYS.PUSH_HABILITADO, false, v => v === 'true');
}
function setHabilitado(valor) {
    StorageHelper.setItem(STORAGE_KEYS.PUSH_HABILITADO, !!valor, true);
}
const UMBRAL_REGISTROS_ACTIVACION = 15;
const AVISOS_INICIALES = 3;
function _soportaPush() {
    return ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);
}
function puedeHabilitarse() {
    if (!_soportaPush()) return false;
    if (Notification.permission === 'denied') return false;
    const registros = AppState.registros() || [];
    const regulares = registros.filter(r => !TiposRegistro.obtenerTipoPorCodigo(r.entrada, r.salida));
    return regulares.length > UMBRAL_REGISTROS_ACTIVACION;
}
function _getAvisosRestantes() {
    return StorageHelper.getNumber(STORAGE_KEYS.PUSH_AVISOS_RESTANTES, AVISOS_INICIALES, true);
}
function avisoPendiente() {
    const hayEleccion = [true, false].some(porPerfil => StorageHelper.getItem(STORAGE_KEYS.PUSH_HABILITADO, null, porPerfil) !== null);
    return !hayEleccion && puedeHabilitarse() && _getAvisosRestantes() > 0;
}
function consumirAviso() {
    StorageHelper.setItem(STORAGE_KEYS.PUSH_AVISOS_RESTANTES, Math.max(0, _getAvisosRestantes() - 1), true);
}

function _guardarInfoActiva(fechaISO, targetTimeMs) {
    StorageHelper.setItem(STORAGE_KEYS.PUSH_INFO_ACTIVA, JSON.stringify({ fechaISO, targetTimeMs }), true);
}
function _borrarInfoActiva(perfilId) {
    try {
        if (perfilId) {
            StorageHelper.removeItem(`${STORAGE_KEYS.PUSH_INFO_ACTIVA}_${perfilId}`);
        } else {
            StorageHelper.removeItem(STORAGE_KEYS.PUSH_INFO_ACTIVA, true);
            StorageHelper.removeItem(STORAGE_KEYS.PUSH_INFO_ACTIVA, false);
        }
    } catch { /* noop */ }
}
function obtenerInfoActiva(perfilId) {
    const raw = perfilId
        ? StorageHelper.getItem(`${STORAGE_KEYS.PUSH_INFO_ACTIVA}_${perfilId}`)
        : (StorageHelper.getItem(STORAGE_KEYS.PUSH_INFO_ACTIVA, null, true)
            ?? StorageHelper.getItem(STORAGE_KEYS.PUSH_INFO_ACTIVA, null, false));
    if (!raw) return null;
    try {
        const info = JSON.parse(raw, SecurityAndUtils.reviverJSONSeguro);
        if (!info || info.fechaISO !== TimeUtils.obtenerFechaHoy()) return null;
        return info;
    } catch {
        return null;
    }
}
async function _asegurarSuscripcion() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
    if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY.startsWith('PEGA_ACA')) return null;

    try {
        const permiso = await Notification.requestPermission();
        if (permiso !== 'granted') return null;

        const reg = await navigator.serviceWorker.ready;
        const existente = await reg.pushManager.getSubscription();
        if (existente) return existente;

        return await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: _urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
    } catch (err) {
        console.error('No se pudo suscribir a push:', err);
        return null;
    }
}

function _calcularTarget(entradaHHMM, objetivoHoras, bufferSemanalHoras = 0, minutosTiempoFuera = 0) {
    if (!entradaHHMM || !objetivoHoras) return null;
    const [h, m] = entradaHHMM.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;

    let objetivoAjustado = objetivoHoras;
    if (getUsarBufferSemanal() && Number.isFinite(bufferSemanalHoras)) {
        objetivoAjustado = Math.max(0, objetivoHoras - bufferSemanalHoras);
    }
    const anticipacionMin = getAnticipacionMin();
    const target = new Date();
    target.setHours(h, m, 0, 0);
    const extraMs = Number.isFinite(minutosTiempoFuera) ? minutosTiempoFuera * 60 * 1000 : 0;
    target.setTime(target.getTime() + objetivoAjustado * 60 * 60 * 1000 + extraMs - anticipacionMin * 60 * 1000 - MARGEN_CRON_MS);
    return target.getTime();
}

function _construirMensajeNotificacion(anticipacionMin, bufferSemanalHoras) {
    const usaBuffer = getUsarBufferSemanal() && Number.isFinite(bufferSemanalHoras) && Math.abs(bufferSemanalHoras * 60) >= 1;
    if (!usaBuffer) {
        return anticipacionMin > 0
            ? `Te faltan ${anticipacionMin} min para cumplir tu horario de hoy`
            : 'Se cumplió tu horario de hoy. ¡Podés irte!';
    }

    const tiempoTexto = TimeUtils.horasATexto(Math.abs(bufferSemanalHoras));
    const debeTiempo = bufferSemanalHoras < 0;

    if (debeTiempo) {
        return anticipacionMin > 0
            ? `En ${anticipacionMin} min podés irte (incluye recuperar ${tiempoTexto} faltantes)`
            : `Podés irte. Ya recuperaste los ${tiempoTexto} faltantes de la semana`;
    } else {
        return anticipacionMin > 0
            ? `En ${anticipacionMin} min podés irte (salís ${tiempoTexto} antes por tiempo extra)`
            : `Podés irte ${tiempoTexto} antes por tu tiempo extra semanal`;
    }
}

async function programarFinDeJornada(fechaISO, entradaHHMM, objetivoHoras, bufferSemanalHoras = 0, minutosTiempoFuera = 0) {
    if (!getHabilitado()) return;
    const targetMs = _calcularTarget(entradaHHMM, objetivoHoras, bufferSemanalHoras, minutosTiempoFuera);
    if (targetMs == null) return;

    const generacion = ++_generacionProgramacion;
    const sub = await _asegurarSuscripcion();
    if (!sub || generacion !== _generacionProgramacion || !getHabilitado()) return;

    const anticipacionMin = getAnticipacionMin();
    const mensaje = _construirMensajeNotificacion(anticipacionMin, bufferSemanalHoras);

    const payload = {
        id: _claveRecordatorio(fechaISO),
        ownerToken: _ownerToken(),
        subscription: sub.toJSON(),
        targetTime: targetMs,
        title: 'Horarios',
        message: mensaje
    };

    for (let intento = 0; ; intento++) {
        let status = null;
        try {
            const res = await _postWorker('/api/schedule', payload);
            if (res.ok) {
                if (generacion === _generacionProgramacion) {
                    _guardarInfoActiva(fechaISO, targetMs);
                } else if (_generacionCancelada > generacion && _generacionCancelada === _generacionProgramacion) {
                    // Se canceló mientras este schedule estaba en vuelo: el cancel pudo llegar antes
                    _postWorker('/api/cancel', { id: payload.id, ownerToken: payload.ownerToken }, true).catch(() => { /* noop */ });
                }
                return;
            }
            status = res.status;
        } catch (err) {
            console.error('No se pudo programar el recordatorio:', err);
        }

        const reintentable = status == null || status === 429 || status >= 500;
        if (!reintentable || intento >= REINTENTOS_MAX) {
            _avisarFallo('programar', status);
            return;
        }
        await TimeUtils.esperar(REINTENTO_ESPERA_MS);
        if (generacion !== _generacionProgramacion || !getHabilitado() || Date.now() >= targetMs) return;
    }
}

function limpiarNotificacionVisible() {
    if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(reg => {
            if (reg && typeof reg.getNotifications === 'function') {
                reg.getNotifications({ tag: 'horarios-recordatorio' })
                    .then(notifs => notifs.forEach(n => n.close()))
                    .catch(() => { /* noop */ });
            }
        }).catch(() => { /* noop */ });
    }
}

function cancelarFinDeJornada(fechaISO, perfilId) {
    if (!fechaISO) return;
    const esPerfilActivo = !perfilId || perfilId === _perfilActivo();
    if (esPerfilActivo) limpiarNotificacionVisible();

    const esHoy = fechaISO === TimeUtils.obtenerFechaHoy();
    if (esHoy && esPerfilActivo) _generacionCancelada = ++_generacionProgramacion;
    const activa = esHoy ? obtenerInfoActiva(perfilId) : null;
    if (esHoy) _borrarInfoActiva(perfilId);

    // Sin info local igual se cancela: el Worker pudo guardar el aviso aunque la
    // respuesta del schedule nunca se procesó (app cerrada o congelada al fichar)
    if (!activa && !getHabilitado()) {
        return;
    }

    if (activa?.targetTimeMs && (Date.now() > activa.targetTimeMs + MARGEN_CRON_MS)) {
        return;
    }
    if (!esHoy && fechaISO < TimeUtils.obtenerFechaHoy()) {
        return;
    }

    _postWorker('/api/cancel', { id: _claveRecordatorio(fechaISO, perfilId), ownerToken: _ownerToken() }, true)
        .then(res => { if (!res.ok && activa) _avisarFallo('cancelar', res.status); })
        .catch(err => {
            console.error('No se pudo cancelar el recordatorio:', err);
            if (activa) _avisarFallo('cancelar', null);
        });
}

function restablecer() {
    cancelarFinDeJornada(TimeUtils.obtenerFechaHoy());
    [
        STORAGE_KEYS.PUSH_HABILITADO,
        STORAGE_KEYS.PUSH_ANTICIPACION_MIN,
        STORAGE_KEYS.PUSH_USAR_BUFFER_SEMANAL,
        STORAGE_KEYS.PUSH_BUFFER_SOLO_ULTIMO_DIA,
        STORAGE_KEYS.PUSH_INFO_ACTIVA
    ].forEach(k => {
        StorageHelper.removeItem(k, true);
        StorageHelper.removeItem(k, false);
    });
}

const USO_INTERVALO_MS = 30 * 60 * 1000;

function _idEstadisticas() {
    const KEY = 'statsId';
    const existente = StorageHelper.getItem(KEY, null);
    if (existente) return existente;
    const nuevo = crypto.randomUUID ? crypto.randomUUID() : null;
    if (nuevo) StorageHelper.setItem(KEY, nuevo);
    return nuevo;
}

async function _versionApp() {
    try {
        const claves = await caches.keys();
        return claves.find(k => k.startsWith('horarios-')) || 'desconocida';
    } catch {
        return 'desconocida';
    }
}

async function registrarUso() {
    if (document.visibilityState !== 'visible' || navigator.onLine === false) return;
    const KEY = 'statsUltimoPing';
    const ahora = Date.now();
    if (ahora - Number(StorageHelper.getItem(KEY, 0)) < USO_INTERVALO_MS) return;
    const id = _idEstadisticas();
    if (!id) return;
    StorageHelper.setItem(KEY, String(ahora));
    const pwa = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    try {
        await _postWorker('/api/hola', { id, modo: pwa ? 'pwa' : 'navegador', version: await _versionApp() });
    } catch { /* sin estadística esta vez, no afecta a la app */ }
}

export const PushReminder = {
    configurarNotificaciones, registrarUso,
    programarFinDeJornada, cancelarFinDeJornada, limpiarNotificacionVisible,
    getAnticipacionMin, setAnticipacionMin, setBufferSoloUltimoDia,
    getUsarBufferSemanal, setUsarBufferSemanal, getHabilitado, setHabilitado, puedeHabilitarse, avisoPendiente, consumirAviso,
    getBufferSoloUltimoDia, calcularTarget: _calcularTarget,
    targetProgramadoParaHoy: () => obtenerInfoActiva()?.targetTimeMs ?? null,
    restablecer,
};
