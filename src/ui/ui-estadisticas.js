import { UIReportes } from './ui-reportes.js';
import { STORAGE_KEYS, horasGte } from '../core/constants.js';
import { $ } from '../core/dom.js';
import { TimeUtils } from '../core/time-utils.js';
import { StorageHelper } from '../core/storage.js';
import { ModalManager } from './modal-manager.js';
import { TiposRegistro } from '../services/tipos-registro.js';
import { SaldoSemanal } from '../services/saldo-semanal.js';
import { UICore } from './ui-core.js';
import { UIConfig } from './ui-config.js';
import { SecurityAndUtils as S } from '../core/security.js';
import { DataManagement as D } from '../services/data-management.js';

// ====================================================================
//                     UI STATISTICS MODULE
// ====================================================================
const {
    mostrarToast, _poblarSelect,
    _animarSlideElemento, _posicionarPopup, _registrarCierrePopup, _crearPopupFlotante,
    toggleSeccionGen, registrarSwipe, _animarFadeSwap, descargarArchivo
} = UICore;

let modoEstadisticas = 'mensual';
let _ultimosStatsRenderizados = null;

function calcularRegularidad(desviacionMinutos) {
    if (desviacionMinutos === null) return '--:--';
    const mins = Math.round(desviacionMinutos);
    return mins <= 20 ? 'Alta' : mins <= 40 ? 'Media' : 'Baja';
}

function desviacionEstandar(valores) {
    if (valores.length < 2) return null;
    const media = valores.reduce((a, b) => a + b, 0) / valores.length;
    const varianza = valores.reduce((sum, v) => sum + Math.pow(v - media, 2), 0) / valores.length;
    return Math.sqrt(varianza);
}

function _fechaDesdeEfectiva(registros, fechaDesdeDefault) {
    if (registros.length === 0) return fechaDesdeDefault;
    const primerRegistro = registros.reduce((min, r) => r.fecha < min ? r.fecha : min, registros[0].fecha);
    return primerRegistro > fechaDesdeDefault ? primerRegistro : fechaDesdeDefault;
}


function _calcularRegularidadRango(registrosValidos, regularidadPorMes) {
    if (regularidadPorMes) {
        const meses = [...new Set(registrosValidos.map(r => r.fecha.substring(0, 7)))];
        const desE = [], desJ = [];
        meses.forEach(mes => {
            const regs = registrosValidos.filter(r => r.fecha.startsWith(mes));
            if (regs.length < 2) return;
            const dE = desviacionEstandar(regs.map(r => TimeUtils.horaAMinutos(r.entrada)));
            const dJ = desviacionEstandar(regs.map(r => Math.round(r.total * 60)));
            if (dE !== null) desE.push(dE);
            if (dJ !== null) desJ.push(dJ);
        });
        const avg = arr => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
        return {
            regEntrada: calcularRegularidad(avg(desE)),
            regJornada: calcularRegularidad(avg(desJ))
        };
    }
    return {
        regEntrada: calcularRegularidad(desviacionEstandar(registrosValidos.map(r => TimeUtils.horaAMinutos(r.entrada)))),
        regJornada: calcularRegularidad(desviacionEstandar(registrosValidos.map(r => Math.round(r.total * 60))))
    };
}

function _calcularEstadisticasRango(registrosRango, opciones = {}) {
    const { regularidadPorMes = false } = opciones;

    const conteosPorTipo = {};
    const claveTipoPorCodigo = new Map(TiposRegistro.obtenerTodosLosTipos().map(t => [t.codigo, TiposRegistro.claveStat(t)]));
    claveTipoPorCodigo.forEach(clave => { conteosPorTipo[clave] = 0; });
    registrosRango.forEach(r => {
        if (r.entrada && r.entrada === r.salida) {
            const clave = claveTipoPorCodigo.get(r.entrada);
            if (clave) conteosPorTipo[clave]++;
        }
    });

    const compensaciones = registrosRango.filter(r => r.credito && r.credito !== '00:00').length;

    let tiempoFueraTotalMinutos = 0;
    registrosRango.forEach(r => {
        if (r.tiempoFuera && r.tiempoFuera !== '00:00') {
            tiempoFueraTotalMinutos += TimeUtils.horaAMinutos(r.tiempoFuera);
        }
    });

    const registrosValidos = registrosRango.filter(r =>
        r.entrada && r.salida && !TiposRegistro.esRegistroEspecial(r.entrada, r.salida)
    );

    const vacios = {
        entradaPromedio: '--:--', salidaPromedio: '--:--',
        diasTrabajados: 0, promedioDiario: '--:--',
        tiempoFueraTotal: '--:--', tiempoTotal: '--:--',
        ...conteosPorTipo, compensaciones,
        regularidadEntrada: '--:--', regularidadJornada: '--:--',
        bufferPeriodo: null, aprovechamientoSaldo: null
    };
    const totalHoras = _sumarHorasEfectivas(registrosRango);
    const horasDiariasObj = D.horasDiarias();
    const hayPeriodo = horasDiariasObj > 0 && opciones.desde && opciones.hasta;
    const asignacionesCompensatorio = hayPeriodo ? D.calcularAsignacionesCompensatorio() : null;
    const bufferPeriodo = hayPeriodo
        ? D.calcularBufferPeriodo(opciones.desde, opciones.hasta, true, 0, asignacionesCompensatorio)
        : null;
    const aprovechamientoSaldo = hayPeriodo
        ? SaldoSemanal.calcularAprovechamiento(opciones.desde, opciones.hasta, asignacionesCompensatorio)
        : null;

    if (registrosValidos.length === 0) {
        if (registrosRango.length === 0) return vacios;
        return {
            ...vacios,
            tiempoFueraTotal: tiempoFueraTotalMinutos > 0 ? TimeUtils.horasATexto(tiempoFueraTotalMinutos / 60, 'short') : '--:--',
            tiempoTotal: totalHoras > 0 ? TimeUtils.horasATexto(totalHoras, 'short') : '--:--',
            bufferPeriodo, aprovechamientoSaldo
        };
    }

    const avgMin = arr => Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);
    const promedioEntrada = avgMin(registrosValidos.map(r => TimeUtils.horaAMinutos(r.entrada)));
    const promedioSalida = avgMin(registrosValidos.map(r => TimeUtils.horaAMinutos(r.salida)));

    const totalHorasTrabajadas = registrosValidos.reduce((s, r) => s + r.total, 0);
    const promDiario = totalHorasTrabajadas / registrosValidos.length;

    const { regEntrada, regJornada } = _calcularRegularidadRango(registrosValidos, regularidadPorMes);

    return {
        entradaPromedio: TimeUtils.minutosAHora(promedioEntrada),
        salidaPromedio: TimeUtils.minutosAHora(promedioSalida),
        diasTrabajados: registrosValidos.length,
        promedioDiario: TimeUtils.horasATexto(promDiario, 'short'),
        tiempoFueraTotal: TimeUtils.horasATexto(tiempoFueraTotalMinutos / 60, 'short'),
        tiempoTotal: TimeUtils.horasATexto(totalHoras, 'short'),
        ...conteosPorTipo, compensaciones,
        regularidadEntrada: regEntrada,
        regularidadJornada: regJornada,
        bufferPeriodo, aprovechamientoSaldo
    };
}

function _renderizarStats(stats, opciones = {}) {
    const { mostrarBtnReporte = true } = opciones;

    const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
    set('stat-entrada-promedio', stats.entradaPromedio);
    set('stat-salida-promedio', stats.salidaPromedio);
    set('stat-tiempo-fuera-total', stats.tiempoFueraTotal);
    set('stat-tiempo-total', stats.tiempoTotal);

    const toggleStatItem = (id, value) => {
        const el = $(id); if (!el) return;
        const si = el.closest('.stat-item');
        if (si) { if (value === 0) { si.style.display = 'none'; } else { si.style.display = ''; el.textContent = value; } }
    };
    toggleStatItem('stat-dias-trabajados', stats.diasTrabajados);

    TiposRegistro.obtenerTodosLosTipos().forEach(t => {
        const clave = TiposRegistro.claveStat(t);
        toggleStatItem(`stat-${clave}`, stats[clave] || 0);
    });

    toggleStatItem('stat-compensaciones', stats.compensaciones);

    const elProm = $('stat-promedio-diario');
    if (elProm) elProm.textContent = stats.promedioDiario || '--:--';

    const elRegEnt = $('stat-regularidad-entrada');
    if (elRegEnt) elRegEnt.textContent = stats.regularidadEntrada || '--:--';
    const elRegJor = $('stat-regularidad-jornada');
    if (elRegJor) elRegJor.textContent = stats.regularidadJornada || '--:--';

    const btnReporte = document.getElementById('btn-reporte');
    if (btnReporte) {
        btnReporte.disabled = !mostrarBtnReporte;
    }
    const elSaldo = $('stat-saldo');
    const itemSaldo = $('stat-item-saldo');
    if (elSaldo && itemSaldo) {
        if (stats.bufferPeriodo === null) {
            itemSaldo.style.display = 'none';
        } else {
            itemSaldo.style.display = '';
            const b = stats.bufferPeriodo;
            elSaldo.textContent = b === 0 ? '0h' : TimeUtils.horasATexto(b, 'short');
            elSaldo.classList.remove('saldo-positivo', 'saldo-negativo', 'saldo-neutro');
            elSaldo.classList.add(b > 0 ? 'saldo-positivo' : b < 0 ? 'saldo-negativo' : 'saldo-neutro');
        }
    }

    _ultimosStatsRenderizados = stats;
}

function calcularEstadisticasMes(mesAnio = null, registrosPeriodo = null) {
    let mesActual, añoActual;
    if (mesAnio) {
        const [año, mes] = mesAnio.split('-').map(Number);
        añoActual = año; mesActual = mes - 1;
    } else {
        const hoy = new Date();
        mesActual = hoy.getMonth(); añoActual = hoy.getFullYear();
    }
    const registros = registrosPeriodo ?? D.registros().filter(r => {
        const [a, m] = r.fecha.split('-').map(Number);
        return a === añoActual && m === mesActual + 1;
    });
    const ultimoDia = TimeUtils.formatearFechaLocal(new Date(añoActual, mesActual + 1, 0));
    const fechaDesde = _fechaDesdeEfectiva(registros, TimeUtils.formatearFechaLocal(new Date(añoActual, mesActual, 1)));
    return _calcularEstadisticasRango(registros, { regularidadPorMes: false, desde: fechaDesde, hasta: ultimoDia });
}

function actualizarEstadisticas(mesAnio = null) {
    const selectMes = $('select-mes-stats');
    if (!mesAnio && selectMes) mesAnio = selectMes.value;
    if (mesAnio && selectMes) {
        const [año, mes] = mesAnio.split('-').map(Number);
        const tieneRegs = D.registros().some(r => { const [a, m] = r.fecha.split('-').map(Number); return a === año && m === mes; });
        if (!tieneRegs) {
            mesAnio = TimeUtils.formatearFechaLocal(new Date()).slice(0, 7);
            if (selectMes) selectMes.value = mesAnio;
        }
    }
    const stats = calcularEstadisticasMes(mesAnio);
    _renderizarStats(stats, { mostrarBtnReporte: true });
}

function _renderSelectorStats() {
    const anioEl = $('select-anio-stats');
    const mesEl = $('select-mes-stats');
    const semEl = $('select-semana-stats');
    const labelEl = $('label-periodo-toggle');
    if (modoEstadisticas === 'anual') {
        if (anioEl) anioEl.classList.remove('hidden');
        if (mesEl) mesEl.classList.add('hidden');
        if (semEl) semEl.classList.add('hidden');
        if (labelEl) labelEl.textContent = 'Anual';
        poblarSelectorAnios();
    } else if (modoEstadisticas === 'semanal') {
        if (anioEl) anioEl.classList.add('hidden');
        if (mesEl) mesEl.classList.add('hidden');
        if (semEl) semEl.classList.remove('hidden');
        if (labelEl) labelEl.textContent = 'Semanal';
        poblarSelectorSemanas();
        actualizarEstadisticasSemana(semEl?.value);
    } else {
        if (anioEl) anioEl.classList.add('hidden');
        if (mesEl) mesEl.classList.remove('hidden');
        if (semEl) semEl.classList.add('hidden');
        if (labelEl) labelEl.textContent = 'Mensual';
        poblarSelectorMeses();
    }
}

function calcularEstadisticasAnio(anio, registrosPeriodo = null) {
    const anioNum = parseInt(anio);
    const registros = registrosPeriodo ?? D.registros().filter(r => parseInt(r.fecha.substring(0, 4)) === anioNum);
    const fechaDesde = _fechaDesdeEfectiva(registros, `${anioNum}-01-01`);

    return _calcularEstadisticasRango(registros, {
        regularidadPorMes: true,
        desde: fechaDesde,
        hasta: `${anioNum}-12-31`
    });
}


function poblarSelectorAnios() {
    const anios = [...new Set(D.registros().map(r => r.fecha.substring(0, 4)))].sort().reverse();
    const anioActual = String(new Date().getFullYear());
    _poblarSelect('select-anio-stats', anios, a => a, anioActual, actualizarEstadisticasAnio);
}

function actualizarEstadisticasAnio(anio) {
    const stats = calcularEstadisticasAnio(anio);
    _renderizarStats(stats, { mostrarBtnReporte: true });
}

function _obtenerSemanas() {
    const semanas = new Map();
    D.registros().forEach(r => {
        const d = new Date(r.fecha + 'T00:00:00');
        const lunes = TimeUtils.obtenerLunes(d);
        const key = TimeUtils.formatearFechaLocal(lunes);
        if (!semanas.has(key)) semanas.set(key, lunes);
    });
    return Array.from(semanas.keys()).sort().reverse();
}

function poblarSelectorSemanas() {
    const semanas = _obtenerSemanas();
    const lunesISO = TimeUtils.formatearFechaLocal(TimeUtils.obtenerLunes());
    _poblarSelect('select-semana-stats', semanas, TimeUtils.formatearRangoSemana, lunesISO, actualizarEstadisticasSemana, TimeUtils.agruparMesesPorAnio);
}

function calcularEstadisticasSemana(lunesISO) {
    if (!lunesISO) return _calcularEstadisticasRango([], { regularidadPorMes: false });
    const lunes = new Date(lunesISO + 'T00:00:00');
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    const hasta = TimeUtils.formatearFechaLocal(domingo);
    const registros = D.registros().filter(r => r.fecha >= lunesISO && r.fecha <= hasta);
    return _calcularEstadisticasRango(registros, { regularidadPorMes: false, desde: lunesISO, hasta });
}

function actualizarEstadisticasSemana(lunesISO) {
    const stats = calcularEstadisticasSemana(lunesISO);
    _renderizarStats(stats, { mostrarBtnReporte: false });
}

function _animarCambioStats(fn) {
    const grid = document.querySelector('.stats-grid');
    _animarFadeSwap(grid, fn);
}

function _cambiarPeriodoStats(selectId, actualizarFn) {
    const v = $(selectId)?.value;
    if (v !== undefined) _animarCambioStats(() => actualizarFn(v));
}
function cambiarMesStats() { _cambiarPeriodoStats('select-mes-stats', actualizarEstadisticas); }
function cambiarSemanaStats() { _cambiarPeriodoStats('select-semana-stats', actualizarEstadisticasSemana); }
function cambiarAnioStats() { _cambiarPeriodoStats('select-anio-stats', actualizarEstadisticasAnio); }

function togglePeriodoStats(direccion = 1) {
    if (_popupStatEl) {
        const el = _popupStatEl;
        _popupStatEl = null;
        if (el._cerrar) el._cerrar();
        else el.remove();
    }
    const selectMes = $('select-mes-stats');
    const selectAnio = $('select-anio-stats');
    const label = $('label-periodo-toggle');
    const selectSemana = $('select-semana-stats');

    const orden = ['mensual', 'anual', 'semanal'];
    const idx = orden.indexOf(modoEstadisticas);
    modoEstadisticas = orden[(idx + direccion + orden.length) % orden.length];
    StorageHelper.setItem(STORAGE_KEYS.MODO_ESTADISTICAS, modoEstadisticas);

    _animarSlideElemento(document.getElementById('stats-inner'), direccion, () => {
        selectMes.classList.add('hidden');
        selectAnio.classList.add('hidden');
        if (selectSemana) selectSemana.classList.add('hidden');
        if (modoEstadisticas === 'anual') {
            selectAnio.classList.remove('hidden');
            if (label) label.textContent = 'Anual';
            poblarSelectorAnios();
        } else if (modoEstadisticas === 'semanal') {
            if (selectSemana) selectSemana.classList.remove('hidden');
            if (label) label.textContent = 'Semanal';
            poblarSelectorSemanas();
        } else {
            selectMes.classList.remove('hidden');
            if (label) label.textContent = 'Mensual';
            poblarSelectorMeses();
        }
    });
}

function poblarSelectorMeses() {
    const meses = [...new Set(D.registros().map(r => r.fecha.substring(0, 7)))].sort().reverse();
    const mesActual = TimeUtils.formatearFechaLocal(new Date()).slice(0, 7);
    _poblarSelect('select-mes-stats', meses, TimeUtils.nombreMesCapitalizado, mesActual, actualizarEstadisticas, TimeUtils.agruparMesesPorAnio);
}

const _sumarHorasEfectivas = (...args) => UIReportes._sumarHorasEfectivas(...args);
const generarReporte = (...args) => UIReportes.generarReporte(...args);
const abrirModalReporteSecciones = (...args) => UIReportes.abrirModalReporteSecciones(...args);
const cerrarModalReporteSecciones = (...args) => UIReportes.cerrarModalReporteSecciones(...args);
const toggleSeccionReporte = (...args) => UIReportes.toggleSeccionReporte(...args);
const confirmarGenerarReporte = (...args) => UIReportes.confirmarGenerarReporte(...args);
UIReportes.configurarStatsProvider({
    calcularEstadisticasAnio,
    calcularEstadisticasMes,
    getModoEstadisticas: () => modoEstadisticas
});
const DESCRIPCIONES_STATS = {
    'stat-tiempo-total': { titulo: 'Tiempo Total', desc: 'Suma de todas las horas trabajadas en el período seleccionado.' },
    'stat-promedio-diario': { titulo: 'Promedio Diario', desc: 'Promedio de horas trabajadas por jornada en el período.' },
    'stat-entrada-promedio': { titulo: 'Entrada Promedio', desc: 'Hora de entrada promedio entre todas las jornadas del período.' },
    'stat-salida-promedio': { titulo: 'Salida Promedio', desc: 'Hora de salida promedio entre todas las jornadas del período.' },
    'stat-regularidad-entrada': { titulo: 'Entrada Regular', desc: 'Qué tan constante es tu hora de entrada. Muestra la desviación promedio respecto al horario habitual: hasta 20m es Alta, hasta 40m Media, y más de 40m Baja.' },
    'stat-regularidad-jornada': { titulo: 'Jornada Regular', desc: 'Qué tan constante es la duración de tu jornada. Muestra la desviación promedio respecto a la duración habitual: hasta 20m es Alta, hasta 40m Media, y más de 40m Baja.' },
    'stat-tiempo-fuera-total': { titulo: 'Tiempo Fuera', desc: 'Suma de los tiempos fuera (salidas del establecimiento, almuerzo, etc.) registrados en las jornadas del período.' },
    'stat-saldo': { titulo: 'Banco de horas', desc: 'Diferencia entre las horas trabajadas y las horas objetivo del período seleccionado, incluyendo compensatorios.' },
    'stat-dias-trabajados': { titulo: 'Jornadas', desc: 'Cantidad de registros con entradas y salidas regulares en el período.' },
    'stat-compensaciones': { titulo: 'Salidas Tempranas', desc: 'Cantidad de jornadas en las que se registró un crédito por salida anticipada o asueto dentro del registro en curso.' },
};

const AJUSTE_POR_STAT = {
    'stat-dias-trabajados': 'config-row-dias-habiles',
    'stat-tiempo-fuera-total': 'btn-toggle-ignorar-tf',
    'stat-promedio-diario': 'config-row-horas-diarias',
};

let _popupStatEl = null;

function _popupStat(event, statId) {
    event.stopPropagation();
    if (_popupStatEl) {
        const el = _popupStatEl;
        _popupStatEl = null;
        if (el._cerrar) el._cerrar();
        else el.remove();
    }

    let info = DESCRIPCIONES_STATS[statId];
    if (statId === 'stat-saldo' && info) {
        let descExtra = '';

        const stats = _ultimosStatsRenderizados;
        if (stats && stats.aprovechamientoSaldo) {
            const { horas: horasUtil, generado: saldoGenerado } = stats.aprovechamientoSaldo;
            descExtra += `<hr class="stat-popup-sep">`
                + `<div class="stat-popup-metric"><span>Generado</span><strong>${S.escapeHtml(TimeUtils.horasATexto(saldoGenerado, 'short'))}</strong></div>`
                + `<div class="stat-popup-metric"><span>Utilizado</span><strong>${S.escapeHtml(TimeUtils.horasATexto(horasUtil, 'short'))}</strong></div>`;
        }

        const modoTexto = modoEstadisticas === 'anual'
            ? 'Se calcula a partir del PRIMER REGISTRO del año.'
            : modoEstadisticas === 'mensual'
                ? 'Se calcula a partir del PRIMER REGISTRO del mes.'
                : modoEstadisticas === 'semanal'
                    ? 'Se calcula a partir del PRIMER DÍA LABORAL de la semana.'
                    : null;
        if (modoTexto) descExtra += `<hr class="stat-popup-sep"><strong>${modoTexto}</strong>`;

        if (descExtra) info = { titulo: info.titulo, desc: `${info.desc}${descExtra}` };
    }
    if (statId === 'stat-dias-trabajados' && info) {
        const diasTexto = [...D.diasHabiles()].sort((a, b) => a - b).map(d => TimeUtils.nombreDiaPorIndice(d)).join(', ');
        info = { titulo: info.titulo, desc: `${info.desc}<hr class="stat-popup-sep"><strong>Días hábiles: ${diasTexto}.</strong>` };
    }
    if (statId === 'stat-tiempo-fuera-total' && info) {
        const ignorarTF = StorageHelper.getBoolean(STORAGE_KEYS.IGNORAR_TF, false, true);
        const modoTexto = ignorarTF
            ? 'Actualmente NO SE RESTA el tiempo fuera del tiempo total.'
            : 'Actualmente SE RESTA el tiempo fuera del tiempo total.';
        info = { titulo: info.titulo, desc: `${info.desc}<hr class="stat-popup-sep"><strong>${modoTexto}</strong>` };
    }
    if (statId === 'stat-promedio-diario' && info) {
        info = { titulo: info.titulo, desc: `${info.desc}<hr class="stat-popup-sep"><strong>Actualmente las horas diarias objetivo son ${D.horasDiarias()}h.</strong>` };
    }
    if (!info) {
        const valueEl = $(statId);
        const label = valueEl?.closest('.stat-item')?.querySelector('.stat-label');
        const tipoMatch = TiposRegistro.obtenerTodosLosTipos().find(t => statId === `stat-${TiposRegistro.claveStat(t)}`);
        info = {
            titulo: S.escapeHtml(label ? label.textContent : 'Estadística'),
            desc: tipoMatch
                ? `Cantidad de jornadas registradas como "${S.escapeHtml(tipoMatch.label)}" en el período.`
                : 'Detalle de esta estadística.'
        };
    }

    const ajusteId = AJUSTE_POR_STAT[statId];
    const btnModificarHtml = ajusteId ? `
        <button class="cal-popup-btn-edit" id="_stat-popup-btn-modificar">
            <svg class="icon"><use href="#icon-settings"/></svg>
            Modificar
        </button>` : '';

    const { popup, cerrar } = _crearPopupFlotante({
        className: 'stat-popup',
        id: '_stat-popup',
        dataset: { statId },
        html: `
        <div class="stat-popup-titulo">${S.escapeHtml(info.titulo)}</div>
        <div class="stat-popup-desc">${info.desc}</div>
        ${btnModificarHtml}`,
        event,
        selectorTrigger: '.stat-item',
        esMismoTrigger: item => item.dataset.statId === statId,
        alCerrar: (p) => { if (_popupStatEl === p) _popupStatEl = null; }
    });
    _popupStatEl = popup;

    popup.querySelector('#_stat-popup-btn-modificar')?.addEventListener('click', () => {
        cerrar();
        UIConfig.mostrarConfigEnAjuste(ajusteId);
    });
}

function _onclickStatItem(event) {
    const item = event.currentTarget;
    const valueEl = item.querySelector('.stat-value');
    if (!valueEl || !valueEl.id) return;
    if (_popupStatEl && _popupStatEl.dataset.statId === valueEl.id) {
        const el = _popupStatEl;
        _popupStatEl = null;
        if (el._cerrar) el._cerrar();
        else el.remove();
        return;
    }
    item.dataset.statId = valueEl.id;
    _popupStat(event, valueEl.id);
}

function _bindStatItemPopups(container) {
    const root = container || document;
    root.querySelectorAll('.stat-item').forEach(item => {
        if (item._statPopupBound) return;
        item._statPopupBound = true;
        item.addEventListener('click', _onclickStatItem);
    });
}

function toggleStats() {
    toggleSeccionGen('form-stats', 'icon-indicator-stats', STORAGE_KEYS.STATS_EXPANDIDO, () => {
        registrarSwipe($('form-stats'), dir => togglePeriodoStats(dir));
        if (modoEstadisticas === 'anual') {
            poblarSelectorAnios();
        } else if (modoEstadisticas === 'semanal') {
            poblarSelectorSemanas();
        } else {
            poblarSelectorMeses();
        }
    });
}

function bindEventos() {
    document.querySelector('#card-estadisticas .card-header-clickable')?.addEventListener('click', () => toggleStats());
    $('select-mes-stats')?.addEventListener('change', () => cambiarMesStats());
    $('select-anio-stats')?.addEventListener('change', () => cambiarAnioStats());
    $('select-semana-stats')?.addEventListener('change', () => cambiarSemanaStats());
    $('btn-toggle-periodo')?.addEventListener('click', () => togglePeriodoStats());
    $('btn-reporte')?.addEventListener('click', () => abrirModalReporteSecciones());
    $('reporte-secciones-lista')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-seccion-reporte');
        if (btn) toggleSeccionReporte(btn);
    });
    $('btn-confirmar-reporte')?.addEventListener('click', () => confirmarGenerarReporte());
    $('btn-volver-reporte-secciones')?.addEventListener('click', () => cerrarModalReporteSecciones());

}

export const UIEstadisticas = {
    bindEventos,
    _calcularEstadisticasRango,
    _renderizarStats,
    calcularEstadisticasMes,
    actualizarEstadisticas,
    _renderSelectorStats,
    calcularEstadisticasAnio,
    poblarSelectorAnios,
    actualizarEstadisticasAnio,
    poblarSelectorSemanas,
    calcularEstadisticasSemana,
    actualizarEstadisticasSemana,
    cambiarMesStats,
    cambiarSemanaStats,
    cambiarAnioStats,
    togglePeriodoStats,
    poblarSelectorMeses,
    generarReporte,
    abrirModalReporteSecciones,
    cerrarModalReporteSecciones,
    toggleSeccionReporte,
    confirmarGenerarReporte,
    _popupStat,
    _onclickStatItem,
    _bindStatItemPopups,
    toggleStats,
    getModoEstadisticas: () => modoEstadisticas,
    setModoEstadisticas: (v) => { modoEstadisticas = v; }
};
