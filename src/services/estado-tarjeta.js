import { horasGte } from '../core/constantes.js';
import { TiempoUtils } from '../core/tiempo-utils.js';
import { EstadoApp } from './estado-app.js';
import { Compensatorios } from './compensatorios.js';
import { FiltrosYPeriodos } from './filtros-periodos.js';
import { TiposRegistro } from './tipos-registro.js';
import { SaldoSemanal } from './saldo-semanal.js';

// ====================================================================
// ESTADO DE LA TARJETA DE FICHAJE MODULE (cálculo del día y la semana, sin DOM)
// ====================================================================
function _estadoDiasHabiles(diasHabiles) {
    const hoy = TiempoUtils.obtenerFechaHoy();
    const diaSemana = new Date().getDay();
    const hoyIndex = diaSemana === 0 ? 7 : diaSemana;
    const esDiaHabil = TiempoUtils.esFechaHabil(hoy, diasHabiles);
    let quedanDiasFuturos;
    if (Array.isArray(diasHabiles)) {
        quedanDiasFuturos = false;
        for (let d = hoyIndex + 1; d <= 7; d++) {
            if (diasHabiles.includes(d === 7 ? 0 : d)) { quedanDiasFuturos = true; break; }
        }
    } else {
        quedanDiasFuturos = hoyIndex < diasHabiles;
    }
    return { esDiaHabil, quedanDiasFuturos };
}

function _todosEspeciales(registros, ini, fn, diasHabiles, horasDiarias) {
    if (!Array.isArray(diasHabiles) || diasHabiles.length === 0 || horasDiarias <= 0) return false;
    const fechasLaborables = TiempoUtils.generarRangoFechas(ini, fn)
        .filter(f => Compensatorios.diasHabilesEnFecha(f).includes(TiempoUtils.parsearFechaLocal(f).getDay()));
    if (fechasLaborables.length === 0) return false;
    return fechasLaborables.every(fecha => {
        const r = registros.find(x => x.fecha === fecha);
        if (!r) return false;
        const tipo = TiposRegistro.obtenerTipoPorCodigo(r.entrada, r.salida);
        return tipo && tipo.id !== 'remoto';
    });
}

/**
 * Estado de la tarjeta de fichaje (día y semana actual). Lo que depende de la UI llega por parámetro:
 * los minutos del tiempo fuera en curso y el registro de ayer que la tarjeta retiene tras cerrarlo.
 * @param {{ asignacionesPrecalculadas?: any, minutosBreakActivo?: number, resolverRetenido?: (registros: any[], regHoy: any) => any }} [opciones]
 */
function calcularEstadoCard({ asignacionesPrecalculadas = null, minutosBreakActivo = 0, resolverRetenido = () => null } = {}) {
    const hoy = TiempoUtils.obtenerFechaHoy();
    const { inicio: ini, fin: fn } = TiempoUtils.obtenerSemanaRangoActual();
    const registros = EstadoApp.registros();
    const horasDiarias = EstadoApp.horasDiarias();
    const horasSemanales = EstadoApp.horasSemanales();
    const diasHabiles = EstadoApp.diasHabiles();
    const { ayerStr: ayer, regAyer, ayerAbierto } = FiltrosYPeriodos.detectarAyerAbierto(hoy, registros);

    const { esDiaHabil, quedanDiasFuturos } = _estadoDiasHabiles(diasHabiles);
    const regHoyReal = registros.find(r => r.fecha === hoy) ?? null;
    const regRetenido = resolverRetenido(registros, regHoyReal);
    const regHoy = regRetenido ?? regHoyReal;
    const semanaAbierta = quedanDiasFuturos || (esDiaHabil && !(regHoyReal && regHoyReal.salida));
    const asignacionesCompensatorio = asignacionesPrecalculadas || Compensatorios.calcularAsignacionesCompensatorio();
    const bufferSemanalBase = FiltrosYPeriodos.calcularBufferPeriodo(ini, hoy, false, 0, asignacionesCompensatorio);
    const bufferSemanal = FiltrosYPeriodos.calcularBufferPeriodo(ini, hoy, true, minutosBreakActivo, asignacionesCompensatorio);

    const tipoEspecialHoy = TiposRegistro.obtenerTipoPorCodigo(regHoy?.entrada, regHoy?.salida);

    let tiempoHoy = 0;
    const regActivo = (ayerAbierto && !regHoy?.entrada) ? regAyer
        : (!tipoEspecialHoy && regHoy?.entrada && !regHoy.salida) ? regHoy : null;
    if (regActivo) {
        const t = EstadoApp.calcularHoras(regActivo.entrada, TiempoUtils.obtenerHoraActual(), regActivo.tiempoFuera || null, null, true);
        tiempoHoy = Math.max(0, (t ? t.total : 0) - (minutosBreakActivo / 60));
    } else if (!tipoEspecialHoy && regHoy?.salida) {
        tiempoHoy = regHoy.total;
    }

    const fechaLimite = hoy < fn ? hoy : fn;
    const registrosSemana = registros.filter(r => r.fecha >= ini && r.fecha <= fechaLimite);
    let totalSemana = 0;
    let descuentoCompensatorioSemana = 0;
    registrosSemana.forEach(r => {
        if (regActivo && r.fecha === regActivo.fecha) { totalSemana += tiempoHoy; return; }
        totalSemana += Compensatorios.horasEfectivasDeRegistro(r);
        const tipoDia = TiposRegistro.obtenerTipoPorCodigo(r.entrada, r.salida);
        if (!tipoDia) {
            descuentoCompensatorioSemana += Compensatorios.montoCompensadoDeReferencia(r, asignacionesCompensatorio);
        }
    });
    const totalSemanaProgreso = totalSemana - descuentoCompensatorioSemana;

    const registrosSemanaCompletaPorFecha = new Map(
        registros.filter(r => r.fecha >= ini && r.fecha <= fn).map(r => [r.fecha, r])
    );
    let objetivoSemana = 0;
    for (const isoDate of TiempoUtils.generarRangoFechas(ini, fn)) {
        if (!Compensatorios.diasHabilesEnFecha(isoDate).includes(TiempoUtils.parsearFechaLocal(isoDate).getDay())) continue;
        const rDia = registrosSemanaCompletaPorFecha.get(isoDate);
        if (!rDia) { objetivoSemana += horasDiarias; continue; }
        const tipoDia = TiposRegistro.obtenerTipoPorCodigo(rDia.entrada, rDia.salida);
        if (tipoDia && tipoDia.id !== 'remoto') continue;
        objetivoSemana += Compensatorios.objetivoDeRegistro(rDia);
    }
    const todosEspeciales = _todosEspeciales(registros, ini, fn, diasHabiles, horasDiarias);

    // Franjas de la semana para la barra con hitos: un día por cada laborable (o con registro), con su objetivo, lo trabajado y su estado
    /** @type {{ fecha: string, objetivo: number, total: number, activo: boolean, estado: 'especial' | 'cerrado' | 'activo' | 'sin-registro' | 'futuro', especial?: string, cumplimiento?: 'cumplido' | 'cubierto' | 'faltante' }[]} */
    const diasSemana = [];
    for (const isoDate of TiempoUtils.generarRangoFechas(ini, fn)) {
        const rDia = registrosSemanaCompletaPorFecha.get(isoDate) ?? null;
        const esLaborable = Compensatorios.diasHabilesEnFecha(isoDate).includes(TiempoUtils.parsearFechaLocal(isoDate).getDay());
        if (!esLaborable && !rDia) continue;
        const tipo = rDia ? TiposRegistro.obtenerTipoPorCodigo(rDia.entrada, rDia.salida) : null;
        const especial = tipo && tipo.id !== 'remoto' ? tipo.color : undefined;
        const objetivo = rDia ? (esLaborable ? Compensatorios.objetivoDeRegistro(rDia) : 0) : horasDiarias;
        const activo = !!regActivo && isoDate === regActivo.fecha;
        /** @type {'especial' | 'cerrado' | 'activo' | 'sin-registro' | 'futuro'} */
        let estado;
        if (isoDate > hoy) estado = 'futuro';
        else if (especial) estado = 'especial';
        else if (activo) estado = 'activo';
        else if (rDia) estado = 'cerrado';
        else estado = isoDate < hoy ? 'sin-registro' : 'futuro';
        const total = activo ? tiempoHoy : (rDia?.total ?? 0);
        // resultado de un día cerrado: cumplió su objetivo, faltó pero lo cubre el saldo, o faltó (se reutilizan las asignaciones ya calculadas)
        const cumplimiento = estado !== 'cerrado' ? undefined
            : (objetivo === 0 || horasGte(total, objetivo)) ? 'cumplido'
                : SaldoSemanal.cubiertoPorSaldo(isoDate, asignacionesCompensatorio) ? 'cubierto' : 'faltante';
        diasSemana.push({ fecha: isoDate, objetivo, total, activo, estado, especial, cumplimiento });
    }

    return {
        hoy: regRetenido ? regRetenido.fecha : hoy, ini, fn,
        registros, regHoy, esRetenido: !!regRetenido,
        horasDiarias, horasSemanales,
        diasHabiles, esDiaHabil: regRetenido ? TiempoUtils.esFechaHabil(regRetenido.fecha, diasHabiles) : esDiaHabil,
        semanaAbierta, bufferSemanal, bufferSemanalBase,
        totalSemana, totalSemanaProgreso, objetivoSemana,
        diasSemana,
        tipoEspecialHoy, tiempoHoy,
        todosEspeciales,
        ayerAbierto, ayerStr: ayer, regAyer
    };
}

export const EstadoTarjeta = { calcularEstadoCard };
