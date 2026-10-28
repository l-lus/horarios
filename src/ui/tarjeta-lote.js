import { STORAGE_KEYS } from '../core/constantes.js';
import { $ } from '../core/dom.js';
import { TiempoUtils } from '../core/tiempo-utils.js';
import { Almacenamiento } from '../core/almacenamiento.js';
import { TiposRegistro } from '../services/tipos-registro.js';
import { GestionDatos } from '../services/gestion-datos.js';
import { UIBase } from './base.js';
const D = GestionDatos;

// ====================================================================
//           UI CARD BATCH / FORM & INPUT HELPERS MODULE
// ====================================================================
const {
    mostrarToast, resetearBoton, _setBtnDisabled, _flashCampo, _avisarFichaje,
    _animarFadeSwap, _animarSlideElemento, toggleSeccionGen, _crearOpcion,
    setIconoBtn, aplicarFeedbackCampos, _esperarAnim, _scrollHastaVisible
} = UIBase;
const actualizarEstadoBotonTimerMain = (...args) => D._notify().actualizarEstadoBotonTimerMain(...args);

let modoLoteActivo = false;

function _alternarValorCampo(id, obtenerValor) {
    const input = $(id);
    if (!input) return null;
    input.value = input.value.trim() !== '' ? '' : obtenerValor();
    return input;
}

function pegarHoraActual(id) {
    _alternarValorCampo(id, TiempoUtils.obtenerHoraActual)?.dispatchEvent(new Event('input'));
}

function limpiarCampo(id) {
    const input = $(id);
    if (input) {
        input.value = '';
        input.dispatchEvent(new Event('input'));
    }
}

function toggleModoLote(deltaSwipe, conAnimacion = true) {
    const modoContenedor = $('modo-contenedor');
    const modoNormal = $('modo-normal');
    const modoLote = $('modo-lote');
    const btnTexto = $('btn-registrar-texto');
    const btnTimer = $('btn-timer-main');
    const btn = $('btn-agregar');

    modoLoteActivo = !modoLoteActivo;
    const delta = deltaSwipe !== undefined ? deltaSwipe : (modoLoteActivo ? 1 : -1);

    const aplicarCambiosLote = () => {
        modoNormal.style.display = 'none';
        modoLote.style.display = 'block';

        $('lote-tipo').value = 'feriado';
        $('lote-fecha-desde').value = '';
        $('lote-fecha-hasta').value = '';

        btn.classList.remove('btn-color-muted', 'btn-color-red');

        setIconoBtn(btn, '#icon-save');

        btnTimer.disabled = true;

        actualizarBotonLote();
    };

    const aplicarCambiosNormal = () => {
        modoLote.style.display = 'none';
        modoNormal.style.display = 'block';
        resetearBoton(btn);
        actualizarEstadoBotonTimerMain();
    };

    if (conAnimacion) {
        _animarSlideElemento(modoContenedor, delta, modoLoteActivo ? aplicarCambiosLote : aplicarCambiosNormal);
    } else {
        modoLoteActivo ? aplicarCambiosLote() : aplicarCambiosNormal();
    }
}

async function ejecutarAccionRegistro() {
    if (modoLoteActivo) {
        await registrarLoteDesdeCard();
    } else {
        await GestionDatos.agregarRegistro();
    }
}

function _limpiarCamposLote() {
    $('lote-fecha-desde').value = '';
    $('lote-fecha-hasta').value = '';
}

async function _registrarEspecial(fecha, tipo, mensajeDuplicado, alExito) {
    if (D.existeRegistroEnFecha(fecha)) {
        _avisarFichaje(mensajeDuplicado, 'warning'); return;
    }
    try {
        await GestionDatos.registrarDiaEspecial(fecha, tipo);
        alExito?.();
        _limpiarCamposLote();
        actualizarBotonLote();
    } catch (e) { console.error('Error al registrar:', e); }
}

async function registrarLoteDesdeCard() {
    const inputDesde = $('lote-fecha-desde');
    const inputHasta = $('lote-fecha-hasta');
    const tipo = $('lote-tipo').value;

    if ((inputDesde.value === '' && inputDesde.validity && !inputDesde.validity.valid) ||
        (inputHasta.value === '' && inputHasta.validity && !inputHasta.validity.valid)) {
        _avisarFichaje('Fecha inválida'); return;
    }

    const desde = inputDesde.value;
    const hasta = inputHasta.value;

    if (!desde && !hasta) {
        if (!inputDesde.checkValidity() || !inputHasta.checkValidity()) {
            _avisarFichaje('Revisá las fechas ingresadas'); return;
        }
        if (tipo === 'normal') { _avisarFichaje('Completá ambos campos', 'info'); return; }
        await _registrarEspecial(TiempoUtils.obtenerFechaHoy(), tipo, 'Ya existe un registro para hoy'); return;
    }

    if (desde && !hasta) {
        if (tipo === 'normal') { _avisarFichaje('Completá ambos campos', 'info'); return; }
        await _registrarEspecial(desde, tipo, 'Ya existe un registro para esa fecha', () => aplicarFeedbackCampos([
            { id: 'lote-fecha-desde', fallback: 'Desde', mostrar: true },
            { id: 'lote-fecha-hasta', fallback: 'Hasta', mostrar: false }
        ])); return;
    }

    if (!desde && hasta) { _avisarFichaje('Completá ambos campos', 'info'); return; }
    if (desde > hasta) { _avisarFichaje('La fecha inicial debe ser inferior a la final'); return; }

    if (tipo !== 'normal' && !TiposRegistro.obtenerCodigosPorTipo(tipo)) {
        _avisarFichaje('Tipo de registro inválido'); return;
    }

    try {
        if (tipo === 'normal') await GestionDatos.borrarPeriodoDirecto(desde, hasta);
        else await GestionDatos.registrarVacacionesDirecto(desde, hasta, tipo);
        aplicarFeedbackCampos(
            [
                { id: 'lote-fecha-desde', fallback: 'Desde', mostrar: true },
                { id: 'lote-fecha-hasta', fallback: 'Hasta', mostrar: true }
            ],
            tipo === 'normal' ? '✓ Borrado' : '✓ Agregado',
            tipo === 'normal' ? 'label-feedback--red' : 'label-feedback--green'
        );
        _limpiarCamposLote();
        actualizarBotonLote();
    } catch (e) { console.error('Error en operación de lote:', e); }
}


function poblarSelectoresTipos() {
    const tipos = TiposRegistro.obtenerTodosLosTipos();

    const cfg = [
        { id: 'lote-tipo', getLabel: t => `${t.emoji} ${t.label}`, extra: [{ value: 'normal', text: '🕒 Jornadas (borrar)' }] },
        { id: 'filtro-tipo', getLabel: t => `${t.emoji} ${t.labelPlural}`, prefix: '<option value="">Todos</option><option value="normal">🕒 Jornadas</option>' },
        { id: 'edit-grupo-tipo', getLabel: t => `${t.emoji} ${t.label}` },
    ];

    cfg.forEach(({ id, getLabel, prefix = '', extra = [] }) => {
        const sel = $(id);
        if (!sel) return;
        sel.innerHTML = prefix;
        tipos.forEach(t => sel.appendChild(_crearOpcion(t.id, getLabel(t))));
        extra.forEach(e => sel.appendChild(_crearOpcion(e.value, e.text)));
    });
}

function _pintarBotonLote(btn, btnTexto, texto, claseColor = '', icono = '#icon-save') {
    btnTexto.textContent = texto;
    btn.classList.remove('btn-color-muted', 'btn-color-red');
    if (claseColor) btn.classList.add(claseColor);
    setIconoBtn(btn, icono);
}

function _setBtnError(btn, btnTexto, mensaje) {
    _pintarBotonLote(btn, btnTexto, mensaje, 'btn-color-muted');
}

function _actualizarBtnNormal(btn, btnTexto, desde, hasta) {
    const n = GestionDatos.registros().filter(r =>
        r.fecha >= desde && r.fecha <= hasta && !TiposRegistro.esRegistroEspecial(r.entrada, r.salida)
    ).length;
    n > 0
        ? _pintarBotonLote(btn, btnTexto, `Borrar (${n})`, 'btn-color-red', '#icon-trash')
        : _pintarBotonLote(btn, btnTexto, 'Sin Registros', 'btn-color-muted');
}

function _actualizarBtnEspecial(btn, btnTexto, desde, hasta, tipo, diasTotales) {
    const codigosTipo = TiposRegistro.obtenerCodigosPorTipo(tipo);
    if (!codigosTipo) return _pintarBotonLote(btn, btnTexto, 'Fichar');

    const yaRegistrados = GestionDatos.registros().filter(r =>
        r.fecha >= desde && r.fecha <= hasta &&
        r.entrada === codigosTipo.entrada && r.salida === codigosTipo.salida
    ).length;
    const diasOcupados = GestionDatos.registros().filter(r => r.fecha >= desde && r.fecha <= hasta).length;
    const disponibles = diasTotales - diasOcupados;
    const sobreescribirOtros = diasOcupados - yaRegistrados;

    if (disponibles === 0 && yaRegistrados === diasTotales) return _pintarBotonLote(btn, btnTexto, `Fichado (${diasTotales})`, 'btn-color-muted');
    if (disponibles === diasTotales) return _pintarBotonLote(btn, btnTexto, `Fichar (${diasTotales})`);
    if (sobreescribirOtros > 0) return _pintarBotonLote(btn, btnTexto, `Fichar (${disponibles} - ${sobreescribirOtros})`);
    return _pintarBotonLote(btn, btnTexto, `Fichar (${disponibles})`);
}

function actualizarBotonLote() {
    const tipo = $('lote-tipo').value;
    const desde = $('lote-fecha-desde').value;
    const hasta = $('lote-fecha-hasta').value;
    const btn = $('btn-agregar');
    const btnTexto = $('btn-registrar-texto');

    if (!desde && !hasta) {
        if (tipo === 'normal') return _setBtnError(btn, btnTexto, 'Completar rango');

        const hoy = TiempoUtils.obtenerFechaHoy();
        const existeHoy = D.existeRegistroEnFecha(hoy);
        return existeHoy
            ? _pintarBotonLote(btn, btnTexto, 'Fichado', 'btn-color-muted')
            : _pintarBotonLote(btn, btnTexto, 'Fichar');
    }

    if (!desde && hasta) return _setBtnError(btn, btnTexto, 'Rango incompleto');
    if (!TiempoUtils.validarFecha(desde)) return _setBtnError(btn, btnTexto, 'Fecha Inicial Inválida');
    if (desde && !hasta) {
        if (tipo === 'normal') return _setBtnError(btn, btnTexto, 'Rango incompleto');
        const existe = D.existeRegistroEnFecha(desde);
        return existe
            ? _pintarBotonLote(btn, btnTexto, 'Fichado', 'btn-color-muted')
            : _pintarBotonLote(btn, btnTexto, 'Fichar');
    }

    if (!TiempoUtils.validarFecha(hasta)) return _setBtnError(btn, btnTexto, 'Fecha Final Inválida');
    if (desde > hasta) return _setBtnError(btn, btnTexto, 'Rango Inválido');

    const diasTotales = Math.ceil(Math.abs(TiempoUtils.parsearFechaLocal(hasta) - TiempoUtils.parsearFechaLocal(desde)) / 864e5) + 1;

    return tipo === 'normal'
        ? _actualizarBtnNormal(btn, btnTexto, desde, hasta)
        : _actualizarBtnEspecial(btn, btnTexto, desde, hasta, tipo, diasTotales);
}

function toggleFormulario() {
    const el = $('form-registro');
    const estabaExpandido = el.classList.contains('expanded');

    toggleSeccionGen('form-registro', 'icon-indicator-form', STORAGE_KEYS.FORMULARIO_EXPANDIDO);

    if (estabaExpandido) {
        $('entrada').value = '';
        $('salida').value = '';
        $('fecha').value = TiempoUtils.obtenerFechaHoy();

        const loteDesde = $('lote-fecha-desde');
        const loteHasta = $('lote-fecha-hasta');
        const loteTipo = $('lote-tipo');

        if (loteDesde) loteDesde.value = '';
        if (loteHasta) loteHasta.value = '';
        if (loteTipo) loteTipo.value = 'feriado';

        if (modoLoteActivo) {
            setTimeout(() => {
                if (modoLoteActivo) {
                    toggleModoLote(undefined, false);
                }
            }, 350);
        } else {
            actualizarEstadoBotonTimerMain();
        }
    }
}

async function _irAFicharConFecha(fecha, esEspecial) {
    const formulario = $('form-registro');
    const estabaExpandido = !!(formulario && formulario.classList.contains('expanded'));

    if (!estabaExpandido) toggleFormulario();

    const scrollTerminado = _scrollACardFichar($('card-registrar'));

    if (!estabaExpandido) await _esperarAnim(80);

    if (!!esEspecial !== modoLoteActivo) {
        toggleModoLote();
        await _esperarAnim();
    }

    if (esEspecial) {
        const desde = $('lote-fecha-desde');
        const hasta = $('lote-fecha-hasta');
        if (desde) desde.value = fecha;
        if (hasta) hasta.value = fecha;
        actualizarBotonLote();
    } else {
        const input = $('fecha');
        if (input) input.value = fecha;
    }

    await scrollTerminado;
    if (esEspecial) _flashCampo('lote-fecha-desde', 'lote-fecha-hasta', 'lote-tipo');
    else _flashCampo('fecha', 'entrada', 'salida');
}

function _scrollACardFichar(el) {
    const headerEl = document.querySelector('.header');
    const margen = (headerEl ? headerEl.offsetHeight : 0) + 8;
    return _scrollHastaVisible(el, { margenSuperior: margen });
}

function alternarFechaActual(id) {
    const c = _alternarValorCampo(id, TiempoUtils.obtenerFechaHoy);
    if (!c) return;

    actualizarBotonLote();
    if (id === 'edit-grupo-desde' || id === 'edit-grupo-hasta') {
        c.dispatchEvent(new Event('change'));
    }
}

export const TarjetaLote = {
    getModoLoteActivo: () => modoLoteActivo,
    pegarHoraActual,
    limpiarCampo,
    toggleModoLote,
    ejecutarAccionRegistro,
    registrarLoteDesdeCard,
    poblarSelectoresTipos,
    actualizarBotonLote,
    toggleFormulario,
    _irAFicharConFecha,
    _scrollACardFichar,
    alternarFechaActual
};
