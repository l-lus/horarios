import { $ } from '../core/dom.js';
import { TiempoUtils } from '../core/tiempo-utils.js';
import { Animaciones } from './animaciones.js';
import { TarjetaTiempoFuera } from './tarjeta-tiempo-fuera.js';

// ====================================================================
//              UI CLOCK-IN CARD STATS CYCLE (#stats-semana)
// ====================================================================
// Ciclo de textos del número grande de la tarjeta en la vista diaria: horas → "Entrada 08:30" → "Tiempo fuera 25m"
// → "Salida 17:00" → horas, cada 2 s. tarjeta-fichaje.js le pasa los datos en cada render y lo inicia/detiene.
const { _animarMutacion } = Animaciones;
const { _formatearMinutosCorto } = TarjetaTiempoFuera;

let _cicloStatsInterval = null;
let _cicloStatsValorHoras = '';
let _cicloStatsEntrada = '';
let _cicloStatsSalida = '';
let _cicloStatsTiempoFuera = '';
let _cicloStatsFaseAlRenderizar = null;

const _CICLO_DURACION_MS = 2000;
const _CICLO_PREFIJOS = { entrada: 'Entrada', salida: 'Salida', tiempoFuera: 'Tiempo fuera' };

function _detenerCicloStats() {
    clearTimeout(_cicloStatsInterval);
    _cicloStatsInterval = null;
    const el = $('stats-semana');
    if (el) el.classList.remove('mutacion-entrante');
}

function _prepararMostrarFaseAlRenderizar(tipo) {
    _cicloStatsFaseAlRenderizar = tipo;
}

function _fasesCiclo() {
    return [
        _cicloStatsValorHoras,
        `Entrada ${_cicloStatsEntrada}`,
        _cicloStatsTiempoFuera ? `Tiempo fuera ${_formatearMinutosCorto(TiempoUtils.horaAMinutos(_cicloStatsTiempoFuera))}` : null,
        _cicloStatsSalida ? `Salida ${_cicloStatsSalida}` : null,
    ].filter(Boolean);
}

function _crearCicloTick(fases, estado) {
    const _cicloTick = () => {
        const el = $('stats-semana');
        if (!el) { _detenerCicloStats(); return; }

        _animarMutacion(el, () => {
            estado.idx++;
            const terminado = estado.idx >= fases.length;
            el.textContent = terminado ? _cicloStatsValorHoras : fases[estado.idx];
            if (terminado) { _detenerCicloStats(); return; }
            _cicloStatsInterval = setTimeout(_cicloTick, _CICLO_DURACION_MS);
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
    const prefijo = _CICLO_PREFIJOS[tipo];
    const idx = prefijo ? fases.findIndex(f => f?.startsWith(prefijo)) : -1;
    if (idx === -1) return false;

    const estado = { idx };
    const tick = _crearCicloTick(fases, estado);

    const el = $('stats-semana');
    if (el) el.textContent = fases[idx];

    _cicloStatsInterval = setTimeout(tick, _CICLO_DURACION_MS);
    return true;
}

/** Datos del registro de hoy que muestran las fases (strings vacíos si no corresponde). */
function _actualizarDatos({ valorHoras, entrada, salida, tiempoFuera }) {
    _cicloStatsValorHoras = valorHoras;
    _cicloStatsEntrada = entrada;
    _cicloStatsSalida = salida;
    _cicloStatsTiempoFuera = tiempoFuera;
}

/** Fase pedida para el próximo render (tras fichar), o null; la consume. */
function _tomarFasePendiente() {
    const tipo = _cicloStatsFaseAlRenderizar;
    _cicloStatsFaseAlRenderizar = null;
    return tipo;
}

export const CicloStats = {
    actualizarDatos: _actualizarDatos,
    tomarFasePendiente: _tomarFasePendiente,
    prepararFase: _prepararMostrarFaseAlRenderizar,
    iniciar: _iniciarCicloStats,
    iniciarEnFase: _iniciarCicloEnFase,
    detener: _detenerCicloStats,
    activo: _cicloStatsActivo,
};
