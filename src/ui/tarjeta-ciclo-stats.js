import { $ } from '../core/dom.js';
import { TiempoUtils } from '../core/tiempo-utils.js';
import { Animaciones } from './animaciones.js';
import { TarjetaTiempoFuera } from './tarjeta-tiempo-fuera.js';

// ====================================================================
//              UI CLOCK-IN CARD STATS CYCLE (#stats-semana)
// ====================================================================
// Ciclo de textos del número grande de la tarjeta en la vista diaria: horas → "Entrada 08:30" → "Tiempo fuera 25m"
// → "Salida 17:00" (registro cerrado) → horas. Con el hint integrado (`hitosEnBarra`) la barra ya muestra la entrada, la salida y, con el registro abierto,
// la salida estimada y la salida con banco, cada una con su descripción: esas fases no cambian el texto (queda el de las horas) y solo resaltan su hito.
// El tiempo fuera no tiene hito en la barra y siempre se muestra como texto. Sin el hint integrado, entrada y salida se muestran como texto.
// Cada 2 s (las fases con hito sobre la barra, un poco más). tarjeta-fichaje.js le pasa los datos en cada render y lo inicia/detiene.
// Cada vez que cambia la fase avisa su tipo (o null al terminar) a quien se registre con `alCambiarFase`: así la barra resalta el hito correspondiente
// sin que este módulo conozca el DOM de la barra.
const { _animarMutacion } = Animaciones;
const { _formatearMinutosCorto } = TarjetaTiempoFuera;

/** @typedef {{ tipo: string, texto: () => string, ms?: number }} FaseCiclo */

let _cicloStatsInterval = null;
let _cicloStatsValorHoras = '';
let _cicloStatsEntrada = '';
let _cicloStatsSalida = '';
let _cicloStatsSalidaEstimada = '';
let _cicloStatsSalidaBanco = '';
let _cicloStatsTiempoFuera = '';
let _cicloStatsHitosEnBarra = false;
let _cicloStatsFaseAlRenderizar = null;
/** @type {((tipo: string | null) => void) | null} */
let _alCambiarFase = null;

const _CICLO_DURACION_MS = 2000;
// El resalte de la hora y su descripción tarda ~0,5 s en desplegarse: estas fases se quedan un poco más para que se lea
// (y como su texto es el de las horas, no hay animación de cambio de texto si ya se está mostrando)
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

/**
 * Fase de un hito de la barra: con el hint integrado deja el texto de las horas y se queda más tiempo (se despliega la descripción);
 * sin él muestra `texto`.
 * @param {string} tipo
 * @param {() => string} texto
 * @returns {FaseCiclo}
 */
function _faseHito(tipo, texto) {
    return _cicloStatsHitosEnBarra
        ? { tipo, ms: _CICLO_DURACION_HITO_MS, texto: () => _cicloStatsValorHoras }
        : { tipo, texto };
}

/** @returns {FaseCiclo[]} */
function _fasesCiclo() {
    /** @type {FaseCiclo[]} */
    const fases = [
        { tipo: 'horas', texto: () => _cicloStatsValorHoras },
        _faseHito('entrada', () => `Entrada ${_cicloStatsEntrada}`),
    ];
    if (_cicloStatsTiempoFuera) {
        fases.push({ tipo: 'tiempoFuera', texto: () => `Tiempo fuera ${_formatearMinutosCorto(TiempoUtils.horaAMinutos(_cicloStatsTiempoFuera))}` });
    }
    if (_cicloStatsSalida) {
        fases.push(_faseHito('salida', () => `Salida ${_cicloStatsSalida}`));
    }
    if (_cicloStatsSalidaEstimada) fases.push(_faseHito('salidaEstimada', () => ''));
    if (_cicloStatsSalidaBanco) fases.push(_faseHito('banco', () => ''));
    return fases;
}

function _crearCicloTick(fases, estado) {
    const _cicloTick = () => {
        const el = $('stats-semana');
        if (!el) { _detenerCicloStats(); return; }

        const aplicar = () => {
            estado.idx++;
            const terminado = estado.idx >= fases.length;
            el.textContent = terminado ? _cicloStatsValorHoras : fases[estado.idx].texto();
            if (terminado) { _detenerCicloStats(); return; }
            _emitirFase(fases[estado.idx].tipo);
            _cicloStatsInterval = setTimeout(_cicloTick, fases[estado.idx].ms ?? _CICLO_DURACION_MS);
        };
        // si el texto que sigue es el que ya se ve (fases solo de hito) no hay nada que animar
        const siguiente = estado.idx + 1 >= fases.length ? _cicloStatsValorHoras : fases[estado.idx + 1].texto();
        if (siguiente === el.textContent) aplicar();
        else _animarMutacion(el, aplicar);
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
    if (el) el.textContent = fases[idx].texto();
    _emitirFase(fases[idx].tipo);

    _cicloStatsInterval = setTimeout(tick, fases[idx].ms ?? _CICLO_DURACION_MS);
    return true;
}

/** Datos del registro de hoy que muestran las fases (strings vacíos si no corresponde). */
function _actualizarDatos({ valorHoras, entrada, salida, tiempoFuera, salidaEstimada = '', salidaBanco = '', hitosEnBarra = false }) {
    _cicloStatsValorHoras = valorHoras;
    _cicloStatsEntrada = entrada;
    _cicloStatsSalida = salida;
    _cicloStatsTiempoFuera = tiempoFuera;
    _cicloStatsSalidaEstimada = salidaEstimada;
    _cicloStatsSalidaBanco = salidaBanco;
    _cicloStatsHitosEnBarra = hitosEnBarra;
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
