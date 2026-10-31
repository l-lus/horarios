import { TarjetaFondos } from './tarjeta-fondos.js';
import { TarjetaTiempoFuera } from './tarjeta-tiempo-fuera.js';
import { TarjetaLote } from './tarjeta-lote.js';
import { STORAGE_KEYS } from '../core/constantes.js';
import { $ } from '../core/dom.js';
import { TiempoUtils } from '../core/tiempo-utils.js';
import { Almacenamiento } from '../core/almacenamiento.js';
import { SaldoSemanal } from '../services/saldo-semanal.js';
import { Animaciones } from './animaciones.js';
import { TarjetaFichajeVista } from './tarjeta-fichaje-vista.js';
import { EstadoTarjeta } from '../services/estado-tarjeta.js';
import { Calendario } from './calendario.js';
import { Historico } from './historico.js';
import { Estadisticas } from './estadisticas.js';
import { Compensatorios } from '../services/compensatorios.js';
import { EstadoApp } from '../services/estado-app.js';

// ====================================================================
//                     UI CLOCK-IN CARD MODULE
// ====================================================================
const {
    _renderConFirma, _conRendersSinAnimar, _rendersSinAnimarActivos, _animarFadeSwap,
    _animarMutacion, _animarConteo, _conteoEnCurso, _cancelarConteo, _durSiAnima
} = Animaciones;
const { _cantidadHoras, _modoTextoStats, _hintIntegradoActivo } = TarjetaFichajeVista;

const { setProgressBarColor, toggleFondoCard, actualizarFondoCard } = TarjetaFondos;
const {
    _breakStorageKey, _minutosBreakActivo, _formatearMinutosCorto,
    _obtenerOCrearLabelTF, _quitarLabelTF, actualizarEstadoBotonTimerMain, toggleTimerBreakMain
} = TarjetaTiempoFuera;
const {
    pegarHoraActual, limpiarCampo, toggleModoLote, ejecutarAccionRegistro, actualizarBotonLote,
    toggleFormulario, alternarFechaActual
} = TarjetaLote;
let _timerAutoVista = null;

// Al cerrar la jornada abierta de ayer, la tarjeta sigue mostrando ese registro (salida y total) antes de pasar a hoy.
// Dura lo que un ciclo completo de la salida (fase "Salida" + total); fichar de nuevo lo anula y pasa a hoy al instante.
let _retencionAyer = null;
const _RETENCION_AYER_MS = 4000;

function _cancelarRetencionAyer() {
    if (!_retencionAyer) return;
    clearTimeout(_retencionAyer.timer);
    _retencionAyer = null;
}

/** @param {string | null} id registro de ayer recién cerrado; null anula la retención */
function _retenerRegistroAyer(id) {
    _cancelarRetencionAyer();
    if (id === null) return;
    _retencionAyer = {
        id,
        timer: setTimeout(() => { _retencionAyer = null; actualizarUI(null, false, true); }, _RETENCION_AYER_MS),
    };
}

function _registroRetenidoAyer(registros, regHoy) {
    if (!_retencionAyer) return null;
    const reg = registros.find(r => r.id === _retencionAyer?.id);
    if (regHoy?.entrada || !reg?.salida) { _cancelarRetencionAyer(); return null; }
    return reg;
}

/** @param {any} [asignacionesPrecalculadas] */
function _calcularEstadoCard(asignacionesPrecalculadas = null) {
    return EstadoTarjeta.calcularEstadoCard({
        asignacionesPrecalculadas,
        minutosBreakActivo: _minutosBreakActivo(),
        resolverRetenido: _registroRetenidoAyer
    });
}

const _COLORES_BORDE = ['blue', 'green', 'red', 'purple', 'orange', 'gold', 'transparent'];

/** @param {any} [est] */
function _renderTitulo(vista, sinAnimar = false, est = null) {
    const el = $('stats-titulo');
    const aplicarExtra = () => _actualizarTiempoFueraConsolidado(el, est);
    _renderConFirma(el, vista.titulo, aplicarExtra, { forzar: sinAnimar });
}

function _actualizarTiempoFueraConsolidado(el, est) {
    if (!el) return;

    const regHoy = (est?.ayerAbierto && !est.regHoy?.entrada) ? est.regAyer : est?.regHoy;
    const mostrar = !!regHoy && EstadoApp.vistaActual() !== 'semana'
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
    const idx = prefijo ? fases.findIndex(f => f?.startsWith(prefijo)) : -1;
    if (idx === -1) return false;

    const estado = { idx };
    const tick = _crearCicloTick(fases, estado);

    const el = $('stats-semana');
    if (el) el.textContent = fases[idx];

    _cicloStatsInterval = setTimeout(tick, _CICLO_DURACION_MS);
    return true;
}

/** @param {any} [conteo] */
function _renderStats(vista, est, conteo = null) {
    const el = $('stats-semana');
    if (!el) return;

    const esDiaria = EstadoApp.vistaActual() !== 'semana';
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

let _ultimaVistaLinea = null;
// La última marca llega al final de la barra; el dominio se estira solo si "ahora" la supera, y ahí las marcas se corren hacia la izquierda.
function _escalaLinea(L) {
    const fin = Math.max(L.salidaRel, L.bufferRel ?? 0, L.ahoraRel, 60);
    return t => Math.min(100, Math.max(0, (t / fin) * 100));
}

function _colocarEtiquetaLinea(el, pct, ancho) {
    if (!el) return;
    const w = el.offsetWidth;
    el.style.left = `${Math.max(0, Math.min(ancho - w, (pct / 100) * ancho - w / 2))}px`;
}

function _renderLinea(vista, pista, fill) {
    const L = vista.linea;
    const ancho = pista.clientWidth;
    pista.style.setProperty('--ancho-pista', ancho ? `${ancho}px` : '100%');

    const pct = _escalaLinea(L);
    const pSalida = pct(L.salidaRel);
    const pBuffer = L.bufferRel !== null ? pct(L.bufferRel) : null;
    const lo = pBuffer !== null && L.hayBanda ? Math.min(pSalida, pBuffer) : pSalida;
    const hi = pBuffer !== null && L.hayBanda ? Math.max(pSalida, pBuffer) : pSalida;
    const colorMedio = L.bufferPositivo ? (SaldoSemanal.logicaCubiertoActiva() ? 'gold' : 'green') : 'red';

    const banda = $('linea-banda');
    banda.style.left = `${lo}%`;
    banda.style.width = L.hayBanda ? `${hi - lo}%` : '0%';
    banda.style.setProperty('--banda-color', `var(--c-${colorMedio})`);

    const tickSalida = $('linea-tick-salida');
    const tickBuffer = $('linea-tick-buffer');
    tickSalida.style.left = `${pSalida}%`;
    tickBuffer.style.left = `${pBuffer ?? pSalida}%`;
    tickBuffer.style.opacity = L.hayBanda ? '1' : '0';
    tickBuffer.classList.toggle('positivo', L.bufferPositivo);
    tickBuffer.classList.toggle('negativo', !L.bufferPositivo);

    const etEntrada = $('linea-et-entrada');
    const etSalida = $('linea-et-salida');
    const etBuffer = $('linea-et-buffer');
    etEntrada.textContent = L.horaEntrada;
    etSalida.textContent = L.horaSalida;
    etBuffer.textContent = L.horaBuffer;
    etBuffer.style.opacity = L.hayBanda ? '1' : '0';
    etBuffer.classList.toggle('positivo', L.bufferPositivo);
    etBuffer.classList.toggle('negativo', !L.bufferPositivo);
    _colocarEtiquetaLinea(etEntrada, 0, ancho);
    _colocarEtiquetaLinea(etSalida, pSalida, ancho);
    _colocarEtiquetaLinea(etBuffer, pBuffer ?? pSalida, ancho);

    // relleno: azul hasta la primera salida, color del tramo entre ambas y verde al superar la última
    if (!L.cerrado) {
        fill.classList.add('segmentado');
        fill.style.setProperty('--seg-1', 'var(--c-blue)');
        fill.style.setProperty('--seg-2', `var(--c-${colorMedio})`);
        fill.style.setProperty('--seg-3', 'var(--c-green)');
        fill.style.setProperty('--seg-a', `${lo}%`);
        fill.style.setProperty('--seg-b', `${hi}%`);
    }
}

function _renderBarra(vista, desdeCero = false) {
    const el = $('progress-bar');
    if (!el) return;
    const card = $('stats-card');
    const punto = $('progress-punto');
    const pista = el.closest('.progress-pista');
    const esDiaria = EstadoApp.vistaActual() !== 'semana';
    const conLinea = !!(_hintIntegradoActivo() && esDiaria && vista.linea && pista);
    pista?.classList.toggle('con-linea', conLinea);
    // con el hint integrado la pista reserva siempre el alto de la línea (vista diaria o semanal), así nada se corre al cambiar de vista o crear el registro
    pista?.classList.toggle('reserva-linea', _hintIntegradoActivo());
    _ultimaVistaLinea = conLinea ? vista : null;
    const anchoBarra = conLinea ? _escalaLinea(vista.linea)(vista.linea.ahoraRel) : vista.anchoBarra;
    const dur = desdeCero && card ? _durSiAnima('--dur-conteo') : 0;
    if (dur > 1) {
        card.classList.add('conteo-inicial');
        el.style.width = '0%';
        if (punto) punto.style.left = '0%';
        void el.offsetWidth;
        TiempoUtils.esperar(dur + 100).then(() => card.classList.remove('conteo-inicial'));
    }
    el.style.width = `${anchoBarra}%`;
    if (punto) {
        punto.style.left = `${anchoBarra}%`;
        const esVisible = (vista.estadoFondo === 'en_curso' || !!vista.cerrado) && anchoBarra > 0;
        punto.classList.toggle('visible', esVisible);
        punto.classList.toggle('cerrado', !!vista.cerrado);
        punto.dataset.color = vista.colorCierre ?? vista.colorBarra;
        // el último tramo de la barra se degrada hacia el color del remate
        el.style.setProperty('--color-remate', `var(--c-${punto.dataset.color})`);
        el.style.setProperty('--color-barra', `var(--c-${vista.colorBarra})`);
    }
    const enProgreso = esDiaria && vista.colorBarra === 'green' && vista.estadoFondo === 'en_curso';
    setProgressBarColor(el, vista.colorBarra, vista.colorBorde, enProgreso);
    if (conLinea) _renderLinea(vista, pista, el);
    el.classList.toggle('con-remate', !conLinea && vista.estadoFondo === 'en_curso' && !!punto && punto.classList.contains('visible'));
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
    if (_hintIntegradoActivo()) { el.textContent = vista.aviso || ''; return; }
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
    const esSemana = EstadoApp.vistaActual() === 'semana';
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

/** @param {any} [idNuevo] */
function actualizarUI(idNuevo = null, soloReloj = false, animarCard = false, sinAnimarTitulo = false, conteoInicial = false) {
    const asignacionesCompensatorio = Compensatorios.calcularAsignacionesCompensatorio();

    if (!soloReloj) {
        const idNuevoLista = Calendario.getVistaHistoricoCalendario() ? null : idNuevo;
        Historico.actualizarListaRegistros(EstadoApp.registros(), idNuevoLista, asignacionesCompensatorio);
    }

    const est = _calcularEstadoCard(asignacionesCompensatorio);
    const vista = EstadoApp.vistaActual() === 'semana'
        ? TarjetaFichajeVista.derivarVistaSemana(est)
        : TarjetaFichajeVista.derivarVistaHoy(est);

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

    const debeAnimar = !_rendersSinAnimarActivos() && (animarCard || (idNuevo !== null && !soloReloj));
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
    if (EstadoApp.vistaActual() === nuevaVista) { return Promise.resolve(renderFn()); }
    if (_timerAutoVista) { clearTimeout(_timerAutoVista); _timerAutoVista = null; }
    const card = $('stats-card');
    const content = $('stats-card-content');
    if (card) card.classList.add('cambiando-vista');
    return _animarFadeSwap(content, async () => {
        EstadoApp.setVistaActual(nuevaVista);
        Almacenamiento.setItem(STORAGE_KEYS.VISTA_ACTUAL, nuevaVista);
        _detenerCicloStats();
        const resultado = await _conRendersSinAnimar(renderFn);
        if (card) card.classList.remove('cambiando-vista');
        return resultado;
    });
}

function alternarVista() {
    const nuevaVista = EstadoApp.vistaActual() === 'semana' ? 'diaria' : 'semana';
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
            resizeTimer = setTimeout(() => {
                crearObserver();
                const pista = $('progress-bar')?.closest('.progress-pista');
                if (_ultimaVistaLinea && pista) _renderLinea(_ultimaVistaLinea, pista, $('progress-bar'));
            }, 200);
        });
    })();

    $('stats-card')?.addEventListener('click', (e) => {
        const enStatsNumber = /** @type {HTMLElement} */ (e.target).closest('#stats-semana');
        if (enStatsNumber && EstadoApp.vistaActual() !== 'semana' && !_cicloStatsActivo()) {
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
    actualizarUI,
    alternarVista,
    _forzarVista,
    setTimerAutoVista: (v) => { _timerAutoVista = v; },
    _iniciarCicloStats,
    _detenerCicloStats,
    _cicloStatsActivo,
    _prepararMostrarFaseAlRenderizar,
    _retenerRegistroAyer,
};
