import { STORAGE_KEYS, horasGte, horasEq } from '../core/constantes.js';
import { EventosApp } from '../core/eventos.js';
import { TiempoUtils } from '../core/tiempo-utils.js';
import { Almacenamiento } from '../core/almacenamiento.js';
import { TiposRegistro } from '../services/tipos-registro.js';
import { SaldoSemanal } from '../services/saldo-semanal.js';
import { TarjetaTiempoFuera } from './tarjeta-tiempo-fuera.js';
import { Compensatorios } from '../services/compensatorios.js';
import { EstadoApp } from '../services/estado-app.js';
import { icono } from '../core/html.js';

// ====================================================================
//                     UI CLOCK-IN CARD VIEW MODEL (textos, hints y colores de la tarjeta)
// ====================================================================
const { _minutosBreakActivo, _minutosAHoraWrap } = TarjetaTiempoFuera;

function _calcularProgreso(valor, objetivo) {
    return objetivo > 0 ? Math.min((valor / objetivo) * 100, 100) : 100;
}

function _estaCumplido(valor, objetivo) {
    return objetivo === 0 || horasGte(valor, objetivo);
}

let _formatoCortoStatsCache = false;

function _refrescarFormatoCortoStatsCache() {
    _formatoCortoStatsCache = Almacenamiento.getBoolean(STORAGE_KEYS.FORMATO_CORTO_STATS, false);
}
EventosApp.on('config:formato-corto-stats', _refrescarFormatoCortoStatsCache);

// "Hint integrado": la salida estimada y la salida con buffer se dibujan sobre la barra en vez de en el texto inferior
let _hintIntegrado = Almacenamiento.getBoolean(STORAGE_KEYS.HINT_INTEGRADO, false);
EventosApp.on('config:hint-integrado', () => {
    _hintIntegrado = Almacenamiento.getBoolean(STORAGE_KEYS.HINT_INTEGRADO, false);
});

function _modoTextoStats() {
    return _formatoCortoStatsCache ? 'short' : 'long';
}

function _horasTextoStats(horasDecimales) {
    return TiempoUtils.horasATexto(horasDecimales, _modoTextoStats());
}

function _cantidadHoras(horasDecimales) {
    const { horas, minutos } = TiempoUtils.descomponerHorasDecimales(horasDecimales);
    const texto = _horasTextoStats(horasDecimales);
    const singular = horas === 1 || (horas === 0 && minutos === 1);
    return { texto, singular };
}

function _fraseCantidad(horasDecimales, singular, plural) {
    const { texto, singular: esSingular } = _cantidadHoras(horasDecimales);
    return `${esSingular ? singular : plural} ${texto}`;
}

function _fraseCantidadSufijo(horasDecimales, singular, plural) {
    const { texto, singular: esSingular } = _cantidadHoras(horasDecimales);
    return `${texto} ${esSingular ? singular : plural}`;
}

function _hintSalidaODefault(reg, objetivoAplica, bufferSemanal, diasHabiles, hintDefault, permiteEstimado) {
    if (permiteEstimado && reg && reg.entrada && objetivoAplica > 0 && !TiposRegistro.esRegistroEspecial(reg.entrada, reg.salida)) {
        return _calcularHintSalidaEstimada(reg, objetivoAplica, bufferSemanal, diasHabiles);
    }
    return { hint: hintDefault, hintEsHTML: false };
}

function _tituloDia(nombreDia) {
    return `${icono('#icon-clock')}${nombreDia}`;
}

function _badgeEstadoHoy(dayClosed, colorFinal) {
    if (!dayClosed) {
        return `<span class="estado-badge estado-badge--en-curso">En curso</span>`;
    }
    const color = colorFinal || 'green';
    return `<span class="estado-badge estado-badge--finalizado estado-badge--${color}">Finalizado</span>`;
}

function _conAvisoAyer(vista, avisoAyerHint) {
    return avisoAyerHint ? { ...vista, ...avisoAyerHint } : vista;
}

function derivarVistaSemana(est) {
    const { totalSemana: tot, totalSemanaProgreso, objetivoSemana, semanaAbierta, horasDiarias, todosEspeciales } = est;
    const prog = totalSemanaProgreso ?? tot;

    const progreso = _calcularProgreso(prog, objetivoSemana);

    let colorBarra, colorBorde, estadoFondo, mensaje, mostrarMensaje;

    if (horasDiarias === 0) {
        colorBarra = 'blue'; colorBorde = 'transparent';
        estadoFondo = 'esperando';
        mensaje = `Total fichado: ${_horasTextoStats(tot)}`;
        mostrarMensaje = false;
    } else if (todosEspeciales) {
        colorBarra = 'blue'; colorBorde = 'transparent';
        estadoFondo = 'esperando';
        mensaje = 'Semana sin días laborables';
        mostrarMensaje = true;
    } else if (semanaAbierta) {
        estadoFondo = 'en_curso';
        if (horasGte(prog, objetivoSemana)) {
            colorBarra = 'green'; colorBorde = 'green';
            const dif = prog - objetivoSemana;
            mensaje = horasEq(dif, 0) ? 'Vas justo' : `Vas ${_horasTextoStats(dif)} de más`;
        } else {
            colorBarra = 'blue'; colorBorde = 'blue';
            mensaje = objetivoSemana === 0
                ? `${_horasTextoStats(prog)} (Sin objetivo)`
                : _fraseCantidad(objetivoSemana - prog, 'Falta', 'Faltan');
        }
        mostrarMensaje = true;
    } else if (horasGte(prog, objetivoSemana)) {
        colorBarra = 'green'; colorBorde = 'green';
        estadoFondo = 'finalizado_ok';
        const dif = prog - objetivoSemana;
        mensaje = horasEq(dif, 0) ? 'Perfecto' : `Hiciste ${_horasTextoStats(dif)} de más`;
        mostrarMensaje = true;
    } else {
        colorBarra = 'red'; colorBorde = 'red';
        estadoFondo = 'finalizado_fail';
        mensaje = _fraseCantidad(objetivoSemana - prog, 'Faltó', 'Faltaron');
        mostrarMensaje = true;
    }

    const cerrado = !semanaAbierta && !todosEspeciales && horasDiarias > 0;

    return {
        titulo: `${icono('#icon-calendar-simple')} Esta Semana`,
        stats: todosEspeciales ? '🌞' : _horasTextoStats(tot),
        mensaje, mostrarMensaje,
        colorBarra, anchoBarra: progreso,
        colorBorde, estadoFondo,
        colorCierre: colorBarra,
        cerrado,
        hint: 'Tocá para ver Hoy',
        hintEsHTML: false,
    };
}

function _calcularHintSalidaEstimada(reg, objetivoDiario, bufferSemanal, diasHabiles) {
    let minutosTotal = TiempoUtils.horaAMinutos(reg.entrada) + (objetivoDiario * 60);

    if (reg.tiempoFuera && !EstadoApp.getIgnorarTiempoFuera()) {
        minutosTotal += TiempoUtils.horaAMinutos(reg.tiempoFuera);
    }

    minutosTotal += _minutosBreakActivo();

    const horaSalida = _minutosAHoraWrap(minutosTotal);

    const esLaborable = TiempoUtils.esFechaHabil(reg.fecha, diasHabiles);
    const mostrarBuffer = Math.abs(bufferSemanal) > 0.01 && esLaborable;

    if (mostrarBuffer) {
        const minutosConBuffer = minutosTotal - (bufferSemanal * 60);
        const horaBuf = _minutosAHoraWrap(minutosConBuffer);
        const claseBuffer = bufferSemanal > 0 ? ' hint-buffer-color--green' : bufferSemanal < 0 ? ' hint-buffer-color--red' : '';
        return {
            hint: `Salida estimada: <strong>${horaSalida}</strong> | <span class="hint-buffer-color${claseBuffer}"><strong>${horaBuf}</strong></span>`,
            hintEsHTML: true
        };
    }

    return {
        hint: `Salida estimada: <strong>${horaSalida}</strong>`,
        hintEsHTML: true
    };
}

// Datos de la línea del día, en minutos relativos a la entrada (evita problemas con el cruce de medianoche).
// Con la jornada abierta incluye la salida estimada y la salida con buffer; cerrada, solo la estimada.
function _calcularLinea(reg, objetivoDiario, bufferSemanal, diasHabiles) {
    if (!reg || !reg.entrada || !(objetivoDiario > 0) || TiposRegistro.esRegistroEspecial(reg.entrada, reg.salida)) return null;
    const entrada = TiempoUtils.horaAMinutos(reg.entrada);
    const rel = minutos => (((minutos - entrada) % 1440) + 1440) % 1440;
    const cerrado = !!reg.salida;

    let salidaRel = objetivoDiario * 60;
    if (reg.tiempoFuera && !EstadoApp.getIgnorarTiempoFuera()) salidaRel += TiempoUtils.horaAMinutos(reg.tiempoFuera);
    salidaRel += _minutosBreakActivo();

    const ahoraRel = rel(TiempoUtils.horaAMinutos(cerrado ? reg.salida : TiempoUtils.obtenerHoraActual()));
    const hayBuffer = !cerrado && TiempoUtils.esFechaHabil(reg.fecha, diasHabiles) && Math.abs(bufferSemanal) > 0.01;
    // con un buffer mayor que la jornada la salida con buffer no puede quedar antes de la entrada
    const bufferRel = hayBuffer ? Math.max(0, salidaRel - bufferSemanal * 60) : null;
    const hayBanda = bufferRel !== null && Math.abs(bufferRel - salidaRel) >= 1;

    return {
        entrada, cerrado, salidaRel, bufferRel, ahoraRel, hayBanda,
        bufferPositivo: bufferSemanal > 0,
        horaEntrada: reg.entrada,
        horaSalida: _minutosAHoraWrap(entrada + salidaRel),
        horaBuffer: bufferRel !== null ? _minutosAHoraWrap(entrada + bufferRel) : '',
    };
}

// color que tendría la barra si el registro se cerrara ahora (mismo criterio que el día cerrado)
function _colorSiCerraraAhora(tiempoHoy, objetivo, bufferSemanal) {
    if (objetivo === 0 || horasGte(tiempoHoy, objetivo)) return 'green';
    return SaldoSemanal.logicaCubiertoActiva() && horasGte(bufferSemanal, objetivo - tiempoHoy) ? 'gold' : 'red';
}

function _mensajeProgreso(cumplido, tiempoHoy, objetivoDiario, bufferSemanal, labelCero = '') {
    if (objetivoDiario === 0) return labelCero;
    if (cumplido) {
        const extra = tiempoHoy - objetivoDiario;
        if (bufferSemanal < 0 && Math.abs(bufferSemanal) > extra) return 'Te podés ir, pero debés tiempo';
        return extra > 0 ? `Te podés ir (+${_horasTextoStats(extra)})` : 'Te podés ir';
    }
    const faltante = objetivoDiario - tiempoHoy;
    const faltanteTexto = _fraseCantidad(faltante, 'Falta', 'Faltan');

    return bufferSemanal >= faltante ? `${faltanteTexto}, pero te podés ir` : faltanteTexto;
}

function derivarVistaHoy(est) {
    const { regHoy, tiempoHoy, horasDiarias, esDiaHabil, tipoEspecialHoy, bufferSemanalBase, diasHabiles } = est;
    const objetivoDiario = regHoy ? Compensatorios.objetivoDeRegistro(regHoy) : horasDiarias;

    if (!regHoy || !regHoy.entrada) {

        if (est.ayerAbierto) {
            const objetivoDiarioAyerAplica = TiempoUtils.esFechaHabil(est.ayerStr, diasHabiles)
                ? (est.regAyer ? Compensatorios.objetivoDeRegistro(est.regAyer) : objetivoDiario)
                : 0;
            const prog = _calcularProgreso(tiempoHoy, objetivoDiarioAyerAplica);
            const cumplido = _estaCumplido(tiempoHoy, objetivoDiarioAyerAplica);
            const colorBarra = objetivoDiarioAyerAplica === 0 ? 'blue' : (cumplido ? 'green' : 'blue');
            const mensaje = _mensajeProgreso(cumplido, tiempoHoy, objetivoDiarioAyerAplica, bufferSemanalBase, 'En curso (cruce de medianoche)');

            const nombreDiaAyer = TiempoUtils.obtenerNombreDia(est.ayerStr);
            const linea = _calcularLinea(est.regAyer, objetivoDiarioAyerAplica, bufferSemanalBase, diasHabiles);
            const { hint, hintEsHTML } = _hintSalidaODefault(est.regAyer, objetivoDiarioAyerAplica, bufferSemanalBase, diasHabiles, 'Tocá Fichar para registrar salida', true);

            return {
                titulo: `${_tituloDia(nombreDiaAyer)} (ayer)${_badgeEstadoHoy(false)}`,
                stats: _horasTextoStats(tiempoHoy),
                mensaje, mostrarMensaje: true,
                colorBarra, anchoBarra: prog,
                colorBorde: colorBarra, estadoFondo: 'en_curso', estadoFondoColor: null,
                colorCierre: _colorSiCerraraAhora(tiempoHoy, objetivoDiarioAyerAplica, bufferSemanalBase),
                cerrado: false,
                hint, hintEsHTML,
                linea,
            };
        }

        return {
            titulo: _tituloDia(TiempoUtils.obtenerNombreDia(TiempoUtils.obtenerFechaHoy())),
            stats: esDiaHabil ? '🎒' : '🌞',
            mensaje: esDiaHabil
                ? (horasDiarias === 0 ? '' : 'Esperando registro...')
                : (horasDiarias === 0 ? '' : 'Día libre'),
            mostrarMensaje: horasDiarias > 0,
            colorBarra: 'blue', anchoBarra: 0,
            colorBorde: 'transparent', estadoFondo: 'esperando',
            cerrado: false,
            hint: 'Tocá para ver la Semana', hintEsHTML: false,
        };
    }

    const avisoAyerHint = est.ayerAbierto
        ? { hint: `⚠️ Ayer (${TiempoUtils.obtenerNombreDia(est.ayerStr)}) quedó un fichaje sin cerrar`, hintEsHTML: false, aviso: `⚠️ Ayer (${TiempoUtils.obtenerNombreDia(est.ayerStr)}) quedó un fichaje sin cerrar` }
        : null;

    if (tipoEspecialHoy) {
        return _conAvisoAyer({
            titulo: _tituloDia(TiempoUtils.obtenerNombreDia(TiempoUtils.obtenerFechaHoy())),
            stats: `${tipoEspecialHoy.emoji} ${tipoEspecialHoy.label}`,
            mensaje: `¡${tipoEspecialHoy.descripcion}!`,
            mostrarMensaje: true,
            colorBarra: tipoEspecialHoy.color, anchoBarra: 100,
            colorBorde: tipoEspecialHoy.color,
            estadoFondo: 'especial', estadoFondoColor: tipoEspecialHoy.color,
            cerrado: false,
            hint: 'Tocá para ver la Semana', hintEsHTML: false,
        }, avisoAyerHint);
    }

    const dayClosed = !!regHoy.salida;
    const objetivoDiarioAplica = esDiaHabil ? objetivoDiario : 0;
    const prog = _calcularProgreso(tiempoHoy, objetivoDiarioAplica);
    const cumplido = _estaCumplido(tiempoHoy, objetivoDiarioAplica);
    let colorBarra, colorBorde, estadoFondo, estadoFondoColor = null, mensaje, mostrarMensaje;

    if (objetivoDiarioAplica === 0) {
        colorBarra = dayClosed ? 'green' : 'blue';
        colorBorde = dayClosed ? 'green' : 'blue';
        estadoFondo = dayClosed ? 'finalizado_ok' : 'en_curso';
        mensaje = ''; mostrarMensaje = false;
    } else if (dayClosed) {
        const dif = tiempoHoy - objetivoDiarioAplica;

        if (horasGte(dif, 0)) {
            colorBarra = 'green'; colorBorde = 'green';
            estadoFondo = 'finalizado_ok';
            mensaje = horasEq(dif, 0) ? 'Perfecto' : _fraseCantidadSufijo(dif, 'extra', 'extras');
        } else {
            const faltoTexto = _fraseCantidad(Math.abs(dif), 'Faltó', 'Faltaron');

            if (SaldoSemanal.cubiertoPorSaldo(est.hoy)) {
                colorBarra = 'gold'; colorBorde = 'gold';
                estadoFondo = 'especial';
                estadoFondoColor = 'gold';
                mensaje = `${faltoTexto} (Cubierto)`;
            } else {
                colorBarra = 'red'; colorBorde = 'red';
                estadoFondo = 'finalizado_fail';
                mensaje = faltoTexto;
            }
        }
        mostrarMensaje = true;
    } else {
        colorBarra = cumplido ? 'green' : 'blue';
        colorBorde = cumplido ? 'green' : 'blue';
        estadoFondo = 'en_curso';
        mostrarMensaje = true;
        mensaje = _mensajeProgreso(cumplido, tiempoHoy, objetivoDiarioAplica, bufferSemanalBase);
    }

    const linea = _calcularLinea(regHoy, objetivoDiarioAplica, bufferSemanalBase, diasHabiles);
    const { hint, hintEsHTML } = _hintSalidaODefault(regHoy, objetivoDiarioAplica, bufferSemanalBase, diasHabiles, 'Tocá para ver la Semana', !dayClosed);

    const colorFinal = estadoFondoColor || (estadoFondo === 'finalizado_fail' ? 'red' : 'green');

    return _conAvisoAyer({
        titulo: `${est.esRetenido ? `${_tituloDia(TiempoUtils.obtenerNombreDia(regHoy.fecha))} (ayer)` : _tituloDia(TiempoUtils.obtenerNombreDia(TiempoUtils.obtenerFechaHoy()))}${_badgeEstadoHoy(dayClosed, colorFinal)}`,
        stats: _horasTextoStats(tiempoHoy),
        mensaje, mostrarMensaje,
        colorBarra, anchoBarra: prog,
        colorBorde, estadoFondo, estadoFondoColor,
        colorCierre: dayClosed ? colorBarra : _colorSiCerraraAhora(tiempoHoy, objetivoDiarioAplica, bufferSemanalBase),
        cerrado: dayClosed,
        hint, hintEsHTML,
        linea,
    }, avisoAyerHint);
}

export const TarjetaFichajeVista = {
    derivarVistaSemana,
    derivarVistaHoy,
    _cantidadHoras,
    _modoTextoStats,
    _hintIntegradoActivo: () => _hintIntegrado,
    _refrescarFormatoCortoStatsCache
};
