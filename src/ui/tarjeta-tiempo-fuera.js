import { STORAGE_KEYS } from '../core/constantes.js';
import { $ } from '../core/dom.js';
import { TiempoUtils } from '../core/tiempo-utils.js';
import { Almacenamiento } from '../core/almacenamiento.js';
import { GestorPerfiles } from '../services/gestor-perfiles.js';
import { GestorHistorial } from '../services/gestor-historial.js';
import { TiposRegistro } from '../services/tipos-registro.js';
import { GestionDatos as D } from '../services/gestion-datos.js';
import { UIBase } from './ui-base.js';
import { TarjetaLote } from './tarjeta-lote.js';

// ====================================================================
//                     UI CARD BREAK TIMER MODULE
// ====================================================================
const { mostrarToast, _setBtnActivo, _setBtnDisabled, _flashCampo, _avisarFichaje, setIconoBtn } = UIBase;
let _renderTituloAnimadoFn = (titulo, nuevoHTML, cb) => {
    if (titulo) { titulo.innerHTML = nuevoHTML; titulo.dataset.firma = nuevoHTML; }
    if (cb) cb();
};
function configurarRenderTitulo(fn) {
    if (typeof fn === 'function') _renderTituloAnimadoFn = fn;
}

function _breakStorageKey() {
    const perfilId = GestorPerfiles ? GestorPerfiles.obtenerPerfilActual() : 'default';
    return STORAGE_KEYS.BREAK_TIME(perfilId);
}

function _minutosBreakActivo() {
    if (D.getIgnorarTiempoFuera()) return 0;
    const inicioBreak = Almacenamiento.getItem(_breakStorageKey());
    if (!inicioBreak) return 0;
    const mins = Math.floor((Date.now() - parseInt(inicioBreak)) / 60000);
    return mins > 0 ? mins : 0;
}

function _minutosAHoraWrap(totalMinutos) {
    const normalizado = ((totalMinutos % 1440) + 1440) % 1440;
    return TiempoUtils.minutosAHora(normalizado);
}

function _formatearMinutosCorto(totalMinutos) {
    return TiempoUtils.horasATexto(totalMinutos / 60, 'short');
}

const TF_LABEL_ID = 'tiempo-fuera-label';

function _obtenerOCrearLabelTF(contenedor) {
    const enBadge = !!contenedor.querySelector('.tf-badge');
    const destino = contenedor.querySelector('.tf-badge') || contenedor;
    let label = contenedor.querySelector('#' + TF_LABEL_ID);
    if (!label) {
        label = document.createElement('span');
        label.id = TF_LABEL_ID;
        label.className = 'break-counter-label';
        if (!enBadge) {
            label.innerHTML = '<svg class="icon"><use href="#icon-exit"/></svg><span class="break-counter-label-text"></span>';
        }
        const estadoBadge = !enBadge ? contenedor.querySelector('.estado-badge') : null;
        if (estadoBadge) {
            destino.insertBefore(label, estadoBadge);
        } else {
            destino.appendChild(label);
        }
    }
    return label;
}

function _quitarLabelTF(contenedor) {
    if (!contenedor) return;
    const label = contenedor.querySelector('#' + TF_LABEL_ID);
    if (label) label.remove();
}

const sumarMinutosAHora = TiempoUtils.sumarMinutosAHora;

function _actualizarCardTimerRunning(card, storageKey, sinAnimar = false) {
    if (!card) return;
    card.classList.add('timer-running');
    const titulo = card.querySelector('h2');
    if (!titulo) return;
    const vistaActual = D.vistaActual();
    const icono = vistaActual === 'semana'
        ? '<svg class="icon"><use href="#icon-calendar-simple"/></svg>'
        : '<svg class="icon"><use href="#icon-clock"/></svg>';
    const contexto = vistaActual === 'semana' ? 'Esta Semana' : TiempoUtils.obtenerNombreDia(TiempoUtils.obtenerFechaHoy());
    const nuevoHTML = `${icono} ${contexto}<span class="tf-badge">Tiempo fuera</span>`;
    const agregarContador = () => {
        _obtenerOCrearLabelTF(titulo);
        _iniciarContadorBreak(storageKey);
    };
    if (sinAnimar) {
        titulo.innerHTML = nuevoHTML;
        titulo.dataset.firma = nuevoHTML;
        agregarContador();
    } else {
        _renderTituloAnimadoFn(titulo, nuevoHTML, agregarContador);
    }
}

function actualizarEstadoBotonTimerMain(sinAnimarTitulo = false) {
    const btn = $('btn-timer-main');
    const card = $('stats-card');
    if (!btn) return;

    if (TarjetaLote.getModoLoteActivo()) { btn.disabled = true; return; }

    const registroHoy = D.registroParaTiempoFuera();
    const storageKey = _breakStorageKey();
    const isRunning = Almacenamiento.getItem(storageKey) !== null;
    const diaCerrado = registroHoy?.salida?.trim() !== '' && !!registroHoy?.salida;

    if (!isRunning && (!registroHoy || diaCerrado)) {
        Object.assign(btn, { disabled: true, title: diaCerrado ? 'Día finalizado' : 'Debés fichar entrada primero' });
    } else {
        Object.assign(btn, { disabled: false, title: isRunning ? 'Detener tiempo fuera' : 'Iniciar tiempo fuera' });
    }

    setIconoBtn(btn, '#icon-exit');
    if (isRunning) {
        btn.classList.add('running');
        _actualizarCardTimerRunning(card, storageKey, sinAnimarTitulo);
    } else {
        btn.classList.remove('running');
        if (card) card.classList.remove('timer-running');
        _detenerContadorBreak();
    }
}

let _breakCounterInterval = null;

function _iniciarContadorBreak(storageKey) {
    _detenerContadorBreak();
    function _actualizarContador() {
        const titulo = $('stats-titulo');
        const el = titulo ? titulo.querySelector('#' + TF_LABEL_ID) : null;

        if (!el) { _detenerContadorBreak(); return; }
        const start = parseInt(Almacenamiento.getItem(storageKey));
        if (isNaN(start)) { el.textContent = ''; _detenerContadorBreak(); return; }
        const mins = Math.floor((Date.now() - start) / 60000);
        el.textContent = _formatearMinutosCorto(mins);
    }
    _actualizarContador();
    _breakCounterInterval = setInterval(_actualizarContador, 1000);
}

function _detenerContadorBreak() {
    if (_breakCounterInterval) {
        clearInterval(_breakCounterInterval);
        _breakCounterInterval = null;
    }
}

async function _detenerTimerBreak(registroHoy, storageKey, storedStart) {
    const totalSeg = Math.floor((Date.now() - parseInt(storedStart)) / 1000);

    if (totalSeg < 30) {
        Almacenamiento.removeItem(storageKey);
        mostrarToast('Tiempo muy corto, no se registró', 'info');
        D._notify().actualizarUI(); return;
    }
    if (!registroHoy) {
        Almacenamiento.removeItem(storageKey);
        mostrarToast('No hay registro para hoy, tiempo fuera descartado', 'warning');
        D._notify().actualizarUI(); return;
    }

    const minutos = TiempoUtils.segundosAMinutosRedondeado(totalSeg);
    registroHoy.tiempoFuera = TiempoUtils.sumarMinutosAHora(registroHoy.tiempoFuera || '00:00', minutos);
    const t = D.calcularHoras(registroHoy.entrada, registroHoy.salida, registroHoy.tiempoFuera);
    registroHoy.horas = t?.horas || 0; registroHoy.minutos = t?.minutos || 0; registroHoy.total = t?.total || 0;
    GestorHistorial.saveState(D.registros(), `tiempo fuera +${minutos}min (${TiempoUtils.fechaCorta(registroHoy.fecha)})`);
    Almacenamiento.removeItem(storageKey);
    await D.guardarYActualizar(registroHoy.id);
    D.sincronizarPushHoy();
    const ignorarTF = D.getIgnorarTiempoFuera();
    const diaTexto = registroHoy.fecha === TiempoUtils.obtenerFechaHoy() ? 'hoy' : 'ayer';
    const mensajeToast = ignorarTF
        ? (minutos === 1
            ? 'Se registró 1 minuto de tiempo fuera (cálculo ignorado)'
            : `Se registraron ${minutos} minutos de tiempo fuera (cálculo ignorado)`)
        : (minutos === 1 ? `Se descontó 1 minuto al registro de ${diaTexto}` : `Se descontaron ${minutos} minutos al registro de ${diaTexto}`);
    mostrarToast(mensajeToast, ignorarTF ? 'info' : 'success');
}

async function toggleTimerBreakMain() {
    const storageKey = _breakStorageKey();
    const storedStart = Almacenamiento.getItem(storageKey);
    const registroHoy = D.registroParaTiempoFuera();

    if (!storedStart && !registroHoy) { mostrarToast('Debés crear un registro para hoy primero', 'warning'); return; }

    if (!storedStart) {
        Almacenamiento.setItem(storageKey, Date.now());
        mostrarToast('Tiempo fuera iniciado', 'info');
    } else {
        await _detenerTimerBreak(registroHoy, storageKey, storedStart);
    }
    actualizarEstadoBotonTimerMain();
}

export const TarjetaTiempoFuera = {
    configurarRenderTitulo,
    _breakStorageKey,
    _minutosBreakActivo,
    _minutosAHoraWrap,
    _formatearMinutosCorto,
    TF_LABEL_ID,
    _obtenerOCrearLabelTF,
    _quitarLabelTF,
    _actualizarCardTimerRunning,
    actualizarEstadoBotonTimerMain,
    _iniciarContadorBreak,
    _detenerContadorBreak,
    _detenerTimerBreak,
    toggleTimerBreakMain
};
