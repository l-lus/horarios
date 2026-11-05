import { $, anchoDeTexto } from '../core/dom.js';
import { primeroQueEntra } from '../core/geometria-etiquetas.js';
import { TiempoUtils } from '../core/tiempo-utils.js';
import { Animaciones } from './animaciones.js';
import { TarjetaTiempoFuera } from './tarjeta-tiempo-fuera.js';

// ====================================================================
//              UI CLOCK-IN CARD STATS CYCLE (#stats-semana)
// ====================================================================
// Ciclo de textos del número grande de la tarjeta en la vista diaria: horas → "Entrada 08:30" → "Tiempo fuera 25m"
// → "Salida 17:00" (registro cerrado) o "Salida estimada 17:00" → "Con banco 16:52" (registro abierto) → horas.
// Cada 2 s (las fases con hito sobre la barra, un poco más). tarjeta-fichaje.js le pasa los datos en cada render y lo inicia/detiene.
// Cada vez que cambia la fase avisa su tipo (o null al terminar) a quien se registre con `alCambiarFase`: así la barra resalta el hito correspondiente
// sin que este módulo conozca el DOM de la barra.
const { _animarMutacion } = Animaciones;
const { _formatearMinutosCorto } = TarjetaTiempoFuera;

/** @typedef {{ tipo: string, texto: (el: HTMLElement) => string, ms?: number }} FaseCiclo */

let _cicloStatsInterval = null;
let _cicloStatsValorHoras = '';
let _cicloStatsEntrada = '';
let _cicloStatsSalida = '';
let _cicloStatsSalidaEstimada = '';
let _cicloStatsSalidaBanco = '';
let _cicloStatsTiempoFuera = '';
let _cicloStatsFaseAlRenderizar = null;
/** @type {((tipo: string | null) => void) | null} */
let _alCambiarFase = null;

const _CICLO_DURACION_MS = 2000;
// El resalte de la hora y su descripción tarda ~0,5 s en desplegarse: estas fases se quedan un poco más para que se lea
const _CICLO_DURACION_HITO_MS = 2600;

function _emitirFase(tipo) {
    if (_alCambiarFase) _alCambiarFase(tipo);
}

function _detenerCicloStats() {
    clearTimeout(_cicloStatsInterval);
    _cicloStatsInterval = null;
    const el = $('stats-semana');
    if (el) el.classList.remove('mutacion-entrante');
    _emitirFase(null);
}

function _prepararMostrarFaseAlRenderizar(tipo) {
    _cicloStatsFaseAlRenderizar = tipo;
}

// "Salida estimada 17:00" se abrevia ("Salida estim.", "Estim.") solo si no entra en una línea del número grande
function _textoSalidaEstimada(el, hora) {
    const opciones = [`Salida estimada ${hora}`, `Salida estim. ${hora}`, `Estim. ${hora}`];
    if (!(el.clientWidth > 0)) return opciones[0];
    return primeroQueEntra(opciones, el.clientWidth, texto => anchoDeTexto(el, texto));
}

/** @returns {FaseCiclo[]} */
function _fasesCiclo() {
    /** @type {FaseCiclo[]} */
    const fases = [
        { tipo: 'horas', texto: () => _cicloStatsValorHoras },
        { tipo: 'entrada', texto: () => `Entrada ${_cicloStatsEntrada}` },
    ];
    if (_cicloStatsTiempoFuera) {
        fases.push({ tipo: 'tiempoFuera', texto: () => `Tiempo fuera ${_formatearMinutosCorto(TiempoUtils.horaAMinutos(_cicloStatsTiempoFuera))}` });
    }
    if (_cicloStatsSalida) {
        fases.push({ tipo: 'salida', texto: () => `Salida ${_cicloStatsSalida}` });
    }
    if (_cicloStatsSalidaEstimada) {
        fases.push({ tipo: 'salidaEstimada', ms: _CICLO_DURACION_HITO_MS, texto: el => _textoSalidaEstimada(el, _cicloStatsSalidaEstimada) });
    }
    if (_cicloStatsSalidaBanco) {
        fases.push({ tipo: 'banco', ms: _CICLO_DURACION_HITO_MS, texto: () => `Con banco ${_cicloStatsSalidaBanco}` });
    }
    return fases;
}

function _crearCicloTick(fases, estado) {
    const _cicloTick = () => {
        const el = $('stats-semana');
        if (!el) { _detenerCicloStats(); return; }

        _animarMutacion(el, () => {
            estado.idx++;
            const terminado = estado.idx >= fases.length;
            el.textContent = terminado ? _cicloStatsValorHoras : fases[estado.idx].texto(el);
            if (terminado) { _detenerCicloStats(); return; }
            _emitirFase(fases[estado.idx].tipo);
            _cicloStatsInterval = setTimeout(_cicloTick, fases[estado.idx].ms ?? _CICLO_DURACION_MS);
        });
    };
    return _cicloTick;
}

function _cicloStatsActivo() {
    return !!_cicloStatsInterval;
}

function _iniciarCicloStats(inmediato = false) {
    if (_cicloStatsInterval) return true;
    _detenerCicloStats();
    if (!_cicloStatsEntrada) return false;

    const fases = _fasesCiclo();
    const estado = { idx: 0 };
    const tick = _crearCicloTick(fases, estado);

    _cicloStatsInterval = setTimeout(tick, inmediato ? 0 : _CICLO_DURACION_MS);
    return true;
}

function _iniciarCicloEnFase(tipo) {
    if (!_cicloStatsEntrada) return false;
    clearTimeout(_cicloStatsInterval);

    const fases = _fasesCiclo();
    const idx = fases.findIndex(f => f.tipo === tipo);
    if (idx === -1) return false;

    const estado = { idx };
    const tick = _crearCicloTick(fases, estado);

    const el = $('stats-semana');
    if (el) el.textContent = fases[idx].texto(el);
    _emitirFase(fases[idx].tipo);

    _cicloStatsInterval = setTimeout(tick, fases[idx].ms ?? _CICLO_DURACION_MS);
    return true;
}

/** Datos del registro de hoy que muestran las fases (strings vacíos si no corresponde). */
function _actualizarDatos({ valorHoras, entrada, salida, tiempoFuera, salidaEstimada = '', salidaBanco = '' }) {
    _cicloStatsValorHoras = valorHoras;
    _cicloStatsEntrada = entrada;
    _cicloStatsSalida = salida;
    _cicloStatsTiempoFuera = tiempoFuera;
    _cicloStatsSalidaEstimada = salidaEstimada;
    _cicloStatsSalidaBanco = salidaBanco;
}

/** Fase pedida para el próximo render (tras fichar), o null; la consume. */
function _tomarFasePendiente() {
    const tipo = _cicloStatsFaseAlRenderizar;
    _cicloStatsFaseAlRenderizar = null;
    return tipo;
}

/** Registra quién recibe el tipo de la fase que se está mostrando ('entrada', 'tiempoFuera', 'salida', 'salidaEstimada', 'banco', 'horas') o null al terminar o detenerse. */
function _registrarAlCambiarFase(fn) {
    _alCambiarFase = fn;
}

export const CicloStats = {
    actualizarDatos: _actualizarDatos,
    tomarFasePendiente: _tomarFasePendiente,
    prepararFase: _prepararMostrarFaseAlRenderizar,
    iniciar: _iniciarCicloStats,
    iniciarEnFase: _iniciarCicloEnFase,
    detener: _detenerCicloStats,
    activo: _cicloStatsActivo,
    alCambiarFase: _registrarAlCambiarFase,
};
