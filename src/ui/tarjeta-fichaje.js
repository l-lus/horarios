import { TarjetaFondos } from './tarjeta-fondos.js';
import { TarjetaTiempoFuera } from './tarjeta-tiempo-fuera.js';
import { TarjetaLote } from './tarjeta-lote.js';
import { STORAGE_KEYS, horasGte, horasEq } from '../core/constantes.js';
import { $ } from '../core/dom.js';
import { EventosApp } from '../core/eventos.js';
import { FONDOS_SVG } from '../data/fondos.js';
import { TiempoUtils } from '../core/tiempo-utils.js';
import { Almacenamiento } from '../core/almacenamiento.js';
import { GestorPerfiles } from '../services/gestor-perfiles.js';
import { GestorHistorial } from '../services/gestor-historial.js';
import { TiposRegistro } from '../services/tipos-registro.js';
import { GestionDatos } from '../services/gestion-datos.js';
import { SaldoSemanal } from '../services/saldo-semanal.js';
import { UIBase } from './base.js';
import { Calendario } from './calendario.js';
import { Historico } from './historico.js';
import { Estadisticas } from './estadisticas.js';
const D = GestionDatos;

// ====================================================================
//                     UI CLOCK-IN CARD MODULE
// ====================================================================
const {
    formatoDiferencia, mostrarToast, resetearBoton, restaurarBotonGuardarEdicion,
    _setBtnActivo, _setBtnDisabled, _flashCampo, _avisarFichaje, registrarSwipe, _animarFadeSwap,
    _animarMutacion, _animarSlideElemento, toggleSeccionGen, _crearOpcion, setIconoBtn,
    aplicarFeedbackCampos, _esperarAnim, _scrollHastaVisible,
    _animarConteo, _conteoEnCurso, _cancelarConteo, _durSiAnima
} = UIBase;

const { setProgressBarColor, getFondoCard, setFondoCard, toggleFondoCard, _getLabelFondo, actualizarFondoCard } = TarjetaFondos;
const _breakStorageKey = (...args) => TarjetaTiempoFuera._breakStorageKey.apply(TarjetaTiempoFuera, args);
const _minutosBreakActivo = (...args) => TarjetaTiempoFuera._minutosBreakActivo.apply(TarjetaTiempoFuera, args);
const _minutosAHoraWrap = (...args) => TarjetaTiempoFuera._minutosAHoraWrap(...args);
const _formatearMinutosCorto = (...args) => TarjetaTiempoFuera._formatearMinutosCorto(...args);
const _obtenerOCrearLabelTF = (...args) => TarjetaTiempoFuera._obtenerOCrearLabelTF(...args);
const _quitarLabelTF = (...args) => TarjetaTiempoFuera._quitarLabelTF(...args);
const _actualizarCardTimerRunning = (...args) => TarjetaTiempoFuera._actualizarCardTimerRunning(...args);
const actualizarEstadoBotonTimerMain = (...args) => TarjetaTiempoFuera.actualizarEstadoBotonTimerMain(...args);
const toggleTimerBreakMain = (...args) => TarjetaTiempoFuera.toggleTimerBreakMain.apply(TarjetaTiempoFuera, args);
const pegarHoraActual = (...args) => TarjetaLote.pegarHoraActual(...args);
const limpiarCampo = (...args) => TarjetaLote.limpiarCampo(...args);
const toggleModoLote = (...args) => TarjetaLote.toggleModoLote(...args);
const ejecutarAccionRegistro = (...args) => TarjetaLote.ejecutarAccionRegistro.apply(TarjetaLote, args);
const registrarLoteDesdeCard = (...args) => TarjetaLote.registrarLoteDesdeCard.apply(TarjetaLote, args);
const poblarSelectoresTipos = (...args) => TarjetaLote.poblarSelectoresTipos.apply(TarjetaLote, args);
const actualizarBotonLote = (...args) => TarjetaLote.actualizarBotonLote.apply(TarjetaLote, args);
const toggleFormulario = (...args) => TarjetaLote.toggleFormulario.apply(TarjetaLote, args);
const _irAFicharConFecha = (...args) => TarjetaLote._irAFicharConFecha(...args);
const _scrollACardFichar = (...args) => TarjetaLote._scrollACardFichar(...args);
const alternarFechaActual = (...args) => TarjetaLote.alternarFechaActual(...args);
let _timerAutoVista = null;
let _suprimirAnimacionInterna = false;

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
        .filter(f => D.diasHabilesEnFecha(f).includes(TiempoUtils.parsearFechaLocal(f).getDay()));
    if (fechasLaborables.length === 0) return false;
    return fechasLaborables.every(fecha => {
        const r = registros.find(x => x.fecha === fecha);
        if (!r) return false;
        const tipo = TiposRegistro.obtenerTipoPorCodigo(r.entrada, r.salida);
        return tipo && tipo.id !== 'remoto';
    });
}

function calcularEstadoCard(asignacionesPrecalculadas = null) {
    const hoy = TiempoUtils.obtenerFechaHoy();
    const { inicio: ini, fin: fn } = TiempoUtils.obtenerSemanaRangoActual();
    const registros = D.registros();
    const horasDiarias = D.horasDiarias();
    const horasSemanales = D.horasSemanales();
    const diasHabiles = D.diasHabiles();
    const { ayerStr: ayer, regAyer, ayerAbierto } = D.detectarAyerAbierto(hoy, registros);

    const { esDiaHabil, quedanDiasFuturos } = _estadoDiasHabiles(diasHabiles);
    const regHoy = registros.find(r => r.fecha === hoy) ?? null;
    const semanaAbierta = quedanDiasFuturos || (esDiaHabil && !(regHoy && regHoy.salida));
    const minutosBreakActivo = _minutosBreakActivo();
    const asignacionesCompensatorio = asignacionesPrecalculadas || D.calcularAsignacionesCompensatorio();
    const bufferSemanalBase = D.calcularBufferPeriodo(ini, hoy, false, 0, asignacionesCompensatorio);
    const bufferSemanal = D.calcularBufferPeriodo(ini, hoy, true, minutosBreakActivo, asignacionesCompensatorio);

    const tipoEspecialHoy = TiposRegistro.obtenerTipoPorCodigo(regHoy?.entrada, regHoy?.salida);

    let tiempoHoy = 0;
    const regActivo = (ayerAbierto && !regHoy?.entrada) ? regAyer
        : (!tipoEspecialHoy && regHoy?.entrada && !regHoy.salida) ? regHoy : null;
    if (regActivo) {
        const t = D.calcularHoras(regActivo.entrada, TiempoUtils.obtenerHoraActual(), regActivo.tiempoFuera || null, null, true);
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
        totalSemana += D.horasEfectivasDeRegistro(r);
        const tipoDia = TiposRegistro.obtenerTipoPorCodigo(r.entrada, r.salida);
        if (!tipoDia) {
            descuentoCompensatorioSemana += D.montoCompensadoDeReferencia(r, asignacionesCompensatorio);
        }
    });
    const totalSemanaProgreso = totalSemana - descuentoCompensatorioSemana;

    const registrosSemanaCompletaPorFecha = new Map(
        registros.filter(r => r.fecha >= ini && r.fecha <= fn).map(r => [r.fecha, r])
    );
    let objetivoSemana = 0;
    for (const isoDate of TiempoUtils.generarRangoFechas(ini, fn)) {
        if (!D.diasHabilesEnFecha(isoDate).includes(TiempoUtils.parsearFechaLocal(isoDate).getDay())) continue;
        const rDia = registrosSemanaCompletaPorFecha.get(isoDate);
        if (!rDia) { objetivoSemana += horasDiarias; continue; }
        const tipoDia = TiposRegistro.obtenerTipoPorCodigo(rDia.entrada, rDia.salida);
        if (tipoDia && tipoDia.id !== 'remoto') continue;
        objetivoSemana += D.objetivoDeRegistro(rDia);
    }
    const todosEspeciales = _todosEspeciales(registros, ini, fn, diasHabiles, horasDiarias);

    return {
        hoy, ini, fn,
        registros, regHoy,
        horasDiarias, horasSemanales,
        diasHabiles, esDiaHabil,
        semanaAbierta, bufferSemanal, bufferSemanalBase,
        totalSemana, totalSemanaProgreso, objetivoSemana,
        tipoEspecialHoy, tiempoHoy,
        todosEspeciales,
        ayerAbierto, ayerStr: ayer, regAyer
    };
}

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
    return `<svg class="icon"><use href="#icon-clock" /></svg>${nombreDia}`;
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
        titulo: `<svg class="icon"><use href="#icon-calendar-simple" /></svg> Esta Semana`,
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

    if (reg.tiempoFuera && !D.getIgnorarTiempoFuera()) {
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
    const objetivoDiario = regHoy ? D.objetivoDeRegistro(regHoy) : horasDiarias;

    if (!regHoy || !regHoy.entrada) {

        if (est.ayerAbierto) {
            const objetivoDiarioAyerAplica = TiempoUtils.esFechaHabil(est.ayerStr, diasHabiles)
                ? (est.regAyer ? D.objetivoDeRegistro(est.regAyer) : objetivoDiario)
                : 0;
            const prog = _calcularProgreso(tiempoHoy, objetivoDiarioAyerAplica);
            const cumplido = _estaCumplido(tiempoHoy, objetivoDiarioAyerAplica);
            const colorBarra = objetivoDiarioAyerAplica === 0 ? 'blue' : (cumplido ? 'green' : 'blue');
            const mensaje = _mensajeProgreso(cumplido, tiempoHoy, objetivoDiarioAyerAplica, bufferSemanalBase, 'En curso (cruce de medianoche)');

            const nombreDiaAyer = TiempoUtils.obtenerNombreDia(est.ayerStr);
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
        ? { hint: `⚠️ Ayer (${TiempoUtils.obtenerNombreDia(est.ayerStr)}) quedó un fichaje sin cerrar`, hintEsHTML: false }
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

    const { hint, hintEsHTML } = _hintSalidaODefault(regHoy, objetivoDiarioAplica, bufferSemanalBase, diasHabiles, 'Tocá para ver la Semana', !dayClosed);

    const colorFinal = estadoFondoColor || (estadoFondo === 'finalizado_fail' ? 'red' : 'green');

    return _conAvisoAyer({
        titulo: `${_tituloDia(TiempoUtils.obtenerNombreDia(TiempoUtils.obtenerFechaHoy()))}${_badgeEstadoHoy(dayClosed, colorFinal)}`,
        stats: _horasTextoStats(tiempoHoy),
        mensaje, mostrarMensaje,
        colorBarra, anchoBarra: prog,
        colorBorde, estadoFondo, estadoFondoColor,
        colorCierre: dayClosed ? colorBarra : _colorSiCerraraAhora(tiempoHoy, objetivoDiarioAplica, bufferSemanalBase),
        cerrado: dayClosed,
        hint, hintEsHTML,
    }, avisoAyerHint);
}

const _COLORES_BORDE = ['blue', 'green', 'red', 'purple', 'orange', 'gold', 'transparent'];

function _renderTituloAnimado(el, nuevoHTML, aplicarExtra) {
    if (!el) { if (aplicarExtra) aplicarExtra(); return; }
    const aplicarCambio = () => {
        el.innerHTML = nuevoHTML;
        el.dataset.firma = nuevoHTML;
        if (aplicarExtra) aplicarExtra();
    };
    if (el.dataset.firma === nuevoHTML) { if (aplicarExtra) aplicarExtra(); return; }
    if (_suprimirAnimacionInterna) { aplicarCambio(); return; }
    _animarMutacion(el, aplicarCambio);
}
TarjetaTiempoFuera.configurarRenderTitulo(_renderTituloAnimado);

function _renderTitulo(vista, sinAnimar = false, est = null) {
    const el = $('stats-titulo');
    const aplicarExtra = () => _actualizarTiempoFueraConsolidado(el, est);
    if (sinAnimar && el) { el.innerHTML = vista.titulo; el.dataset.firma = vista.titulo; aplicarExtra(); return; }
    _renderTituloAnimado(el, vista.titulo, aplicarExtra);
}

function _actualizarTiempoFueraConsolidado(el, est) {
    if (!el) return;

    const regHoy = (est?.ayerAbierto && !est.regHoy?.entrada) ? est.regAyer : est?.regHoy;
    const mostrar = !!regHoy && D.vistaActual() !== 'semana'
        && Almacenamiento.getItem(_breakStorageKey()) === null
        && regHoy.tiempoFuera && regHoy.tiempoFuera !== '00:00';

    if (!mostrar) { _quitarLabelTF(el); return; }

    const minutos = TiempoUtils.horaAMinutos(regHoy.tiempoFuera);
    if (!minutos) { _quitarLabelTF(el); return; }

    const label = _obtenerOCrearLabelTF(el);
    const textEl = label.querySelector('.break-counter-label-text');
    const texto = _formatearMinutosCorto(minutos);
    if (textEl) { textEl.textContent = texto; } else { label.textContent = texto; }
    label.title = 'Tiempo fuera registrado hoy';
}

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
    const idx = prefijo ? fases.findIndex(f => f.startsWith(prefijo)) : -1;
    if (idx === -1) return false;

    const estado = { idx };
    const tick = _crearCicloTick(fases, estado);

    const el = $('stats-semana');
    if (el) el.textContent = fases[idx];

    _cicloStatsInterval = setTimeout(tick, _CICLO_DURACION_MS);
    return true;
}

function _renderStats(vista, est, conteo = null) {
    const el = $('stats-semana');
    if (!el) return;

    const esDiaria = D.vistaActual() !== 'semana';
    const regHoy = est.regHoy;
    const esEspecial = !!est.tipoEspecialHoy;
    const entradaHoy = (esDiaria && regHoy && regHoy.entrada && !esEspecial) ? regHoy.entrada : '';
    const salidaHoy = (esDiaria && regHoy && regHoy.salida && !esEspecial) ? regHoy.salida : '';
    const tiempoFueraHoy = (esDiaria && regHoy && regHoy.tiempoFuera && regHoy.tiempoFuera !== '00:00' && !esEspecial) ? regHoy.tiempoFuera : '';

    _cicloStatsValorHoras = vista.stats;
    _cicloStatsEntrada = entradaHoy;
    _cicloStatsSalida = salidaHoy;
    _cicloStatsTiempoFuera = tiempoFueraHoy;

    if (_cicloStatsFaseAlRenderizar) {
        const tipo = _cicloStatsFaseAlRenderizar;
        _cicloStatsFaseAlRenderizar = null;
        if (_iniciarCicloEnFase(tipo)) return;
    }

    if (!_cicloStatsInterval) {
        if (conteo) {
            _animarConteo(el, conteo.texto);
        } else if (_conteoEnCurso(el) === vista.stats) {
            return;
        } else {
            _cancelarConteo(el);
            el.textContent = vista.stats;
        }
    }
}

function _renderBarra(vista, desdeCero = false) {
    const el = $('progress-bar');
    if (!el) return;
    const card = $('stats-card');
    const punto = $('progress-punto');
    const dur = desdeCero && card ? _durSiAnima('--dur-conteo') : 0;
    if (dur > 1) {
        card.classList.add('conteo-inicial');
        el.style.width = '0%';
        if (punto) punto.style.left = '0%';
        void el.offsetWidth;
        TiempoUtils.esperar(dur + 100).then(() => card.classList.remove('conteo-inicial'));
    }
    el.style.width = `${vista.anchoBarra}%`;
    if (punto) {
        punto.style.left = `${vista.anchoBarra}%`;
        const esVisible = (vista.estadoFondo === 'en_curso' || !!vista.cerrado) && vista.anchoBarra > 0;
        punto.classList.toggle('visible', esVisible);
        punto.classList.toggle('cerrado', !!vista.cerrado);
        punto.dataset.color = vista.colorCierre ?? vista.colorBarra;
        // el último tramo de la barra se degrada hacia el color del remate
        el.style.setProperty('--color-remate', `var(--c-${punto.dataset.color})`);
        el.style.setProperty('--color-barra', `var(--c-${vista.colorBarra})`);
    }
    const esDiaria = D.vistaActual() !== 'semana';
    const enProgreso = esDiaria && vista.colorBarra === 'green' && vista.estadoFondo === 'en_curso';
    setProgressBarColor(el, vista.colorBarra, vista.colorBorde, enProgreso);
    el.classList.toggle('con-remate', vista.estadoFondo === 'en_curso' && !!punto && punto.classList.contains('visible'));
}

function _renderMensaje(vista) {
    const el = $('stats-mensaje');
    if (!el) return;
    el.textContent = vista.mensaje;
    el.style.display = vista.mostrarMensaje ? 'block' : 'none';
}

function _renderCard(vista) {
    const card = $('stats-card');
    if (!card) return;
    card.classList.remove(..._COLORES_BORDE.map(c => `border-${c}`));
    card.classList.add(`border-${vista.colorBorde}`);
    actualizarFondoCard(vista.estadoFondo, vista.estadoFondoColor ?? null);
}

function _renderHint(vista) {
    const el = $('toggle-hint');
    if (!el) return;
    if (vista.hintEsHTML) { el.innerHTML = vista.hint; }
    else el.textContent = vista.hint;
}

function _renderBuffer(est) {
    const el = $('stats-buffer');
    if (!el) return;
    el.innerHTML = '';
    const { bufferSemanal, horasDiarias, semanaAbierta } = est;
    if (horasDiarias > 0 && Math.abs(bufferSemanal) > 0.01 && semanaAbierta) {
        const esPositivo = bufferSemanal > 0;
        const claseColor = esPositivo ? 'positivo' : 'negativo';
        const punto = document.createElement('span');
        punto.className = `buffer-semanal-punto ${claseColor}`;
        const span = document.createElement('span');
        span.className = `buffer-semanal-texto ${claseColor}`;
        const { texto: textoBuffer, singular } = _cantidadHoras(Math.abs(bufferSemanal));
        const adjetivo = esPositivo ? (singular ? 'extra' : 'extras') : (singular ? 'faltante' : 'faltantes');
        span.textContent = `${textoBuffer} ${adjetivo} esta semana`;
        span.insertBefore(punto, span.firstChild);
        el.appendChild(span);
    }
}

function _animarCambioCard(renderFn) {
    const els = [
        $('stats-semana'),
        $('stats-mensaje'),
        $('stats-buffer'),
        $('toggle-hint'),
    ];

    _detenerCicloStats();
    _animarMutacion(els, renderFn);
}

function _planConteoInicial(vista, est) {
    const esSemana = D.vistaActual() === 'semana';
    if (!esSemana) {
        const reg = est.regHoy;
        if (!reg || !reg.entrada || est.tipoEspecialHoy) return null;
    }
    const valor = esSemana ? est.totalSemana : est.tiempoHoy;
    if (!(valor > 0)) return null;
    const { horas, minutos } = TiempoUtils.descomponerHorasDecimales(valor);
    const modo = _modoTextoStats();
    const texto = e => TiempoUtils.partesATexto(Math.round(horas * e), Math.round(minutos * e), modo, { horas, minutos });
    if (texto(1) !== vista.stats) return null;
    return { texto };
}

function actualizarUI(idNuevo = null, soloReloj = false, animarCard = false, sinAnimarTitulo = false, conteoInicial = false) {
    const asignacionesCompensatorio = D.calcularAsignacionesCompensatorio();

    if (!soloReloj) {
        const idNuevoLista = Calendario.getVistaHistoricoCalendario() ? null : idNuevo;
        Historico.actualizarListaRegistros(D.registros(), idNuevoLista, asignacionesCompensatorio);
    }

    const est = calcularEstadoCard(asignacionesCompensatorio);
    const vista = D.vistaActual() === 'semana'
        ? derivarVistaSemana(est)
        : derivarVistaHoy(est);

    const conteo = conteoInicial ? _planConteoInicial(vista, est) : null;

    const timerFueraCorriendo = Almacenamiento.getItem(_breakStorageKey()) !== null;
    if (!timerFueraCorriendo) { _renderTitulo(vista, sinAnimarTitulo, est); }
    _renderCard(vista);
    _renderBarra(vista, !!conteo);
    Estadisticas._renderSelectorStats();
    actualizarEstadoBotonTimerMain(sinAnimarTitulo);
    if (TarjetaLote.getModoLoteActivo()) actualizarBotonLote();
    if (Calendario.getVistaHistoricoCalendario()) {
        const selector = $('calendario-selector-meses');
        if (selector && selector.style.display !== 'none') {
            Calendario._cerrarSelectorMeses(idNuevo);
        } else {
            Calendario._renderizarCalendario(idNuevo, asignacionesCompensatorio);
        }
    }

    const debeAnimar = !_suprimirAnimacionInterna && (animarCard || (idNuevo !== null && !soloReloj));
    const renderResto = () => {
        _renderStats(vista, est, conteo);
        _renderMensaje(vista);
        _renderHint(vista);
        _renderBuffer(est);
    };
    if (debeAnimar) {
        _animarCambioCard(renderResto);
    } else {
        renderResto();
    }
}

function _forzarVista(nuevaVista, renderFn) {
    if (D.vistaActual() === nuevaVista) { return Promise.resolve(renderFn()); }
    if (_timerAutoVista) { clearTimeout(_timerAutoVista); _timerAutoVista = null; }
    const card = $('stats-card');
    const content = $('stats-card-content');
    if (card) card.classList.add('cambiando-vista');
    return _animarFadeSwap(content, async () => {
        D.setVistaActual(nuevaVista);
        Almacenamiento.setItem(STORAGE_KEYS.VISTA_ACTUAL, nuevaVista);
        _detenerCicloStats();
        _suprimirAnimacionInterna = true;
        let resultado;
        try {
            resultado = await renderFn();
        } finally {
            _suprimirAnimacionInterna = false;
        }
        if (card) card.classList.remove('cambiando-vista');
        return resultado;
    });
}

function alternarVista() {
    const nuevaVista = D.vistaActual() === 'semana' ? 'diaria' : 'semana';
    _forzarVista(nuevaVista, () => actualizarUI());
}

function bindEventos() {
    (function () {
        const header = /** @type {HTMLElement} */ (document.querySelector('.header'));
        const statsCard = $('stats-card');
        if (!header || !statsCard) return;

        let observer = null;

        const crearObserver = () => {
            if (observer) observer.disconnect();
            const headerH = header.offsetHeight;
            observer = new IntersectionObserver(
                ([entry]) => {
                    header.classList.toggle('scrolled', !entry.isIntersecting);
                },
                { rootMargin: `-${headerH}px 0px 0px 0px`, threshold: 0 }
            );
            observer.observe(statsCard);
        };

        crearObserver();
        let resizeTimer = null;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(crearObserver, 200);
        });
    })();

    $('stats-card')?.addEventListener('click', (e) => {
        const enStatsNumber = /** @type {HTMLElement} */ (e.target).closest('#stats-semana');
        if (enStatsNumber && D.vistaActual() !== 'semana' && !_cicloStatsActivo()) {
            const ciclado = _iniciarCicloStats(true);
            if (ciclado) {
                e.stopPropagation();
                return;
            }
        }
        alternarVista();
    });

    $('btn-timer-main')?.addEventListener('click', () => toggleTimerBreakMain());
    $('btn-agregar')?.addEventListener('click', () => ejecutarAccionRegistro());
    $('icon-indicator-form')?.addEventListener('click', () => toggleFormulario());

    $('btn-ir-modo-lote')?.addEventListener('click', () => toggleModoLote());
    $('btn-pegar-entrada')?.addEventListener('click', () => pegarHoraActual('entrada'));
    $('btn-pegar-salida')?.addEventListener('click', () => pegarHoraActual('salida'));

    $('lote-tipo')?.addEventListener('change', () => actualizarBotonLote());
    $('btn-ir-modo-normal')?.addEventListener('click', () => toggleModoLote());
    $('btn-lote-desde')?.addEventListener('click', () => alternarFechaActual('lote-fecha-desde'));
    $('btn-lote-hasta')?.addEventListener('click', () => alternarFechaActual('lote-fecha-hasta'));

    $('btn-toggle-fondo')?.addEventListener('click', () => toggleFondoCard());
    $('btn-edit-entrada')?.addEventListener('click', () => pegarHoraActual('edit-entrada'));
    $('btn-edit-salida')?.addEventListener('click', () => pegarHoraActual('edit-salida'));
    $('btn-edit-tf')?.addEventListener('click', () => limpiarCampo('edit-tiempo-fuera'));
    $('btn-edit-notas')?.addEventListener('click', () => limpiarCampo('edit-notas'));
    $('btn-grupo-desde')?.addEventListener('click', () => alternarFechaActual('edit-grupo-desde'));
    $('btn-grupo-hasta')?.addEventListener('click', () => alternarFechaActual('edit-grupo-hasta'));
}

export const TarjetaFichaje = {
    bindEventos,
    setFondoCard,
    toggleFondoCard,
    calcularEstadoCard,
    derivarVistaSemana,
    derivarVistaHoy,
    actualizarUI,
    alternarVista,
    _forzarVista,
    _renderTituloAnimado,
    actualizarEstadoBotonTimerMain,
    toggleTimerBreakMain,
    toggleModoLote,
    ejecutarAccionRegistro,
    registrarLoteDesdeCard,
    poblarSelectoresTipos,
    actualizarBotonLote,
    toggleFormulario,
    _irAFicharConFecha,
    _scrollACardFichar,
    alternarFechaActual,
    pegarHoraActual,
    limpiarCampo,
    getFondoCard,
    setTimerAutoVista: (v) => { _timerAutoVista = v; },
    _getLabelFondo,
    _iniciarCicloStats,
    _detenerCicloStats,
    _cicloStatsActivo,
    _prepararMostrarFaseAlRenderizar,
    _refrescarFormatoCortoStatsCache,
};
