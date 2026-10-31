import { STORAGE_KEYS } from '../core/constantes.js';
import { $, setColapsable } from '../core/dom.js';
import { TiempoUtils } from '../core/tiempo-utils.js';
import { Almacenamiento } from '../core/almacenamiento.js';
import { GestorModales } from './gestor-modales.js';
import { TiposRegistro } from '../services/tipos-registro.js';
import { GestionDatos } from '../services/gestion-datos.js';
import { UIBase } from './base.js';
import { Calendario } from './calendario.js';
import { Configuracion } from './configuracion.js';
import { html } from '../core/html.js';
const D = GestionDatos;

// ====================================================================
//           UI HISTORY EDIT, FILTERS & HEADER ACTIONS MODULE
// ====================================================================
const {
    mostrarToast, _setBtnActivo, 
    _crearPopupFlotante,
    setIconoBtn
} = UIBase;

let edicionBloqueada = true;

let edicionGrupoBloqueada = true;

let tiempoExpansionBotones = null;
let timerAutoCierreBotones = null;

function cerrarEdicion() {
    Configuracion.pressHoldObjetivoEdicion.detener();
    GestorModales.cerrar('modal-editar', () => {
        D.setEditandoId(null);
        document.dispatchEvent(new Event('scroll'));
        setBloqueoEdicion(true);
    });
}

function _setBloqueoEdicionGenerico(bloqueado, { btnLockId, inputIds, modalId, excluirBotones }) {
    const btnLock = $(btnLockId);
    if (btnLock) {
        setIconoBtn(btnLock, bloqueado ? '#icon-lock' : '#icon-lock-open');
        btnLock.title = bloqueado ? "Desbloquear edición" : "Bloquear edición";
        btnLock.classList.toggle('bloqueado', bloqueado);
    }

    inputIds.forEach(id => {
        const el = $(id);
        if (el) el.disabled = bloqueado;
    });

    const modal = $(modalId);
    if (modal) {
        const botones = modal.querySelectorAll(excluirBotones);
        botones.forEach(btn => {
            btn.disabled = bloqueado;
        });
    }
}

function setBloqueoEdicion(bloqueado) {
    edicionBloqueada = bloqueado;
    _setBloqueoEdicionGenerico(bloqueado, {
        btnLockId: 'btn-lock-toggle',
        inputIds: ['edit-fecha', 'edit-entrada', 'edit-salida', 'edit-tiempo-fuera', 'edit-notas', 'edit-referencia-compensatorio'],
        modalId: 'modal-editar',
        excluirBotones: 'button:not(#btn-lock-toggle):not(.btn-cancel):not(#btn-toggle-credito)'
    });

    const enModoGlobal = Almacenamiento.getBoolean(STORAGE_KEYS.IGNORAR_OBJETIVO_POR_REGISTRO, false, true);
    const elObjetivo = $('edit-objetivo');
    const objetivoDeshabilitado = bloqueado || enModoGlobal;
    [$('btn-edit-objetivo-inc'), $('btn-edit-objetivo-dec')].forEach(btn => {
        if (btn) btn.disabled = objetivoDeshabilitado;
    });
    if (objetivoDeshabilitado) Configuracion.pressHoldObjetivoEdicion.detener();
    if (elObjetivo) elObjetivo.classList.toggle('input-number-inerte', objetivoDeshabilitado);
    verificarBloqueoCredito();
}

function toggleBloqueoEdicion() {
    setBloqueoEdicion(!edicionBloqueada);
}

function toggleCredito() {
    const btn = $('btn-toggle-credito');
    const estaActivo = btn.dataset.activo === "true";

    btn.dataset.activo = estaActivo ? "false" : "true";
    _setBtnActivo('btn-toggle-credito', !estaActivo);
    mostrarToast(!estaActivo ? 'Asueto | Salida temprana activado' : 'Asueto | Salida temprana desactivado', 'info');
}

function _actualizarHintEdicion() {
    const hint = $('edit-hint-resumen');
    const e = $('edit-entrada')?.value.trim();
    const s = $('edit-salida')?.value.trim();
    let tf = $('edit-tiempo-fuera')?.value.trim();
    if (tf) tf = TiempoUtils.normalizarMinutosSueltos(tf);

    const tipoEspecial = (e || s) ? TiposRegistro.obtenerTipoPorCodigo(e, s) : null;
    const elRef = $('edit-referencia-compensatorio');
    if (elRef) {
        const esCompensatorio = tipoEspecial?.id === 'compensatorio';
        setColapsable($('grupo-referencia-compensatorio'), esCompensatorio);
        if (!esCompensatorio) elRef.value = '';
    }

    if (!hint) return;
    if (!e && !s) { hint.textContent = ''; return; }
    if (tipoEspecial) { hint.textContent = tipoEspecial.label; return; }
    if (e?.length === 5 && s?.length === 5) {
        const t = D.calcularHoras(e, s, tf || null, null, false);
        hint.textContent = t ? `Total: ${t.horas}h ${t.minutos}m` : '';
    } else {
        hint.textContent = '';
    }
}


function actualizarHintGrupo() {
    const hint = $('edit-grupo-hint');
    if (!hint) return;
    const desde = $('edit-grupo-desde')?.value;
    const hasta = $('edit-grupo-hasta')?.value;
    if (!desde && !hasta) { hint.textContent = ''; return; }
    if (desde && !hasta) {
        hint.textContent = `1 día`;
        return;
    }
    if (!TiempoUtils.validarFecha(desde) || !TiempoUtils.validarFecha(hasta) || desde > hasta) {
        hint.textContent = 'Rango inválido';
        return;
    }
    const fechaInicio = TiempoUtils.parsearFechaLocal(desde);
    const fechaFin = TiempoUtils.parsearFechaLocal(hasta);
    const diasTotales = Math.ceil(Math.abs(fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    hint.textContent = `${diasTotales} día${TiempoUtils.pluralizar(diasTotales)}`;
}
['edit-grupo-desde', 'edit-grupo-hasta'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('change', actualizarHintGrupo);
});

let _popupFiltrosEl = null;

function mostrarFiltros(event) {
    if (D.obtenerRegistrosFiltrados().length !== D.registros().length) {
        D.limpiarFiltros();
        return;
    }

    const btnFiltro = $('btn-filtro');
    if (!btnFiltro) return;

    if (_popupFiltrosEl) {
        const el = _popupFiltrosEl;
        _popupFiltrosEl = null;
        if (el._cerrar) el._cerrar();
        else el.remove();
        return;
    }

    const tipos = TiposRegistro.obtenerTodosLosTipos();
    const opcionesTipo = tipos.map(t => html`<option value="${t.id}">${t.emoji} ${t.labelPlural}</option>`);

    const popup = _crearPopupFlotante({
        className: 'filtro-popup',
        id: '_filtro-popup',
        html: html`
        <div class="filtro-popup-titulo">
            <svg class="icon"><use href="#icon-filter" /></svg>
            Filtrar Registros
        </div>
        <div class="form-group form-group-mb-half">
            <label>Desde</label>
            <input type="date" id="filtro-fecha-desde" />
        </div>
        <div class="form-group form-group-mb-half">
            <label>Hasta</label>
            <input type="date" id="filtro-fecha-hasta" />
        </div>
        <div class="form-group">
            <label>Tipo de registro</label>
            <select id="filtro-tipo">
                <option value="">Todos</option>
                <option value="normal">🕒 Jornadas</option>
                ${opcionesTipo}
            </select>
        </div>`,
        event: event && event.currentTarget ? event : { currentTarget: btnFiltro },
        selectorTrigger: '#btn-filtro',
        esMismoTrigger: () => true,
        alCerrar: (p) => { if (_popupFiltrosEl === p) _popupFiltrosEl = null; }
    }).popup;
    _popupFiltrosEl = popup;

    const aplicarInmediato = () => {
        const desde = $('filtro-fecha-desde').value;
        const hasta = $('filtro-fecha-hasta').value;
        const tipo = $('filtro-tipo').value;
        D.aplicarFiltrosInmediato(desde, hasta, tipo);
    };

    ['filtro-fecha-desde', 'filtro-fecha-hasta', 'filtro-tipo'].forEach(id => {
        const el = popup.querySelector(`#${id}`);
        if (el) el.addEventListener('change', aplicarInmediato);
    });
}

function cerrarFiltros() {
    if (_popupFiltrosEl) {
        const el = _popupFiltrosEl;
        _popupFiltrosEl = null;
        if (el._cerrar) el._cerrar();
        else el.remove();
    }
}

function _setIconHistorico(icon, estado) {
    if (!icon) return;
    icon.classList.toggle('rotated', estado === 'meses');
    icon.classList.toggle('icon-rotate-neg90', estado === 'completo');
}

function toggleHistorico() {
    cancelarTimerAutoCierreBotones();
    const contenido = $('contenido-historico');
    const botones = $('botones-historico');
    const icon = $('icon-indicator-historico');
    if (!contenido) return;

    const expandido = contenido.classList.contains('expanded');
    const conBotones = botones.classList.contains('expanded');

    try {
        if (!expandido) {
            contenido.classList.add('expanded');
            _setIconHistorico(icon, 'meses');
            Almacenamiento.setItem(STORAGE_KEYS.HISTORICO_EXPANDIDO, 'meses');
            tiempoExpansionBotones = null;
            Calendario._activarVistaCalendarioHistorico();

        } else if (!conBotones) {
            botones.classList.add('expanded');
            _setIconHistorico(icon, 'completo');
            Almacenamiento.setItem(STORAGE_KEYS.HISTORICO_EXPANDIDO, 'completo');
            tiempoExpansionBotones = Date.now();

        } else {
            botones.classList.remove('expanded');
            if (Date.now() - (tiempoExpansionBotones || 0) > 500) {
                _setIconHistorico(icon, 'meses');
                Almacenamiento.setItem(STORAGE_KEYS.HISTORICO_EXPANDIDO, 'meses');
            } else {
                contenido.classList.remove('expanded');
                _setIconHistorico(icon, 'cerrado');
                Almacenamiento.setItem(STORAGE_KEYS.HISTORICO_EXPANDIDO, 'cerrado');
            }
            tiempoExpansionBotones = null;
        }
    } catch (e) {
        console.warn('Error guardando estado histórico:', e);
    }
}

function iniciarTimerAutoCierreBotones() {
    if (timerAutoCierreBotones) {
        clearTimeout(timerAutoCierreBotones);
        timerAutoCierreBotones = null;
    }

    timerAutoCierreBotones = setTimeout(() => {
        const botones = $('botones-historico');
        const icon = $('icon-indicator-historico');

        if (botones && botones.classList.contains('expanded')) {
            botones.classList.remove('expanded');

            if (icon) _setIconHistorico(icon, 'meses');

            try {
                Almacenamiento.setItem(STORAGE_KEYS.HISTORICO_EXPANDIDO, 'meses');
            } catch (e) {
                console.warn('Error guardando estado histórico:', e);
            }

            tiempoExpansionBotones = null;
        }

        timerAutoCierreBotones = null;
    }, 3000);
}

function cancelarTimerAutoCierreBotones() {
    if (timerAutoCierreBotones) {
        clearTimeout(timerAutoCierreBotones);
        timerAutoCierreBotones = null;
    }
}

function verificarBloqueoCredito() {
    const btnCredito = $('btn-toggle-credito');
    if (!btnCredito) return;

    const _bloquear = () => {
        btnCredito.disabled = true;
    };
    const _habilitar = () => {
        btnCredito.disabled = false;
    };

    if ($('edit-fecha').disabled) return _bloquear();

    const e = $('edit-entrada').value.trim();
    const s = $('edit-salida').value.trim();
    const tf = $('edit-tiempo-fuera').value.trim() || null;

    const horarioCompleto = e.length === 5 && s.length === 5;
    if (!horarioCompleto) {
        if (btnCredito.dataset.activo === "true") toggleCredito();
        return _bloquear();
    }

    if (TiposRegistro.esRegistroEspecial(e, s)) return _bloquear();

    const calcTemp = D.calcularHoras(e, s, tf, null);
    const objetivoEdicion = D.objetivoEdicionEnVivo();
    if (!calcTemp || calcTemp.total >= objetivoEdicion) return _bloquear();

    _habilitar();
}

function setBloqueoEdicionGrupo(bloqueado) {
    edicionGrupoBloqueada = bloqueado;
    _setBloqueoEdicionGenerico(bloqueado, {
        btnLockId: 'btn-lock-grupo-toggle',
        inputIds: ['edit-grupo-tipo', 'edit-grupo-desde', 'edit-grupo-hasta'],
        modalId: 'modal-editar-grupo',
        excluirBotones: 'button:not(#btn-lock-grupo-toggle):not(.btn-cancel)'
    });
}

function toggleBloqueoEdicionGrupo() {
    setBloqueoEdicionGrupo(!edicionGrupoBloqueada);
}

function cerrarEdicionGrupo() {
    GestorModales.cerrar('modal-editar-grupo', () => {
        D.setGrupoEnEdicion(null);
        document.dispatchEvent(new Event('scroll'));
        setBloqueoEdicionGrupo(true);
    });
}


export const HistoricoEdicion = {
    cerrarEdicion,
    setBloqueoEdicion,
    toggleBloqueoEdicion,
    toggleCredito,
    _actualizarHintEdicion,
    actualizarHintGrupo,
    mostrarFiltros,
    cerrarFiltros,
    toggleHistorico,
    iniciarTimerAutoCierreBotones,
    cancelarTimerAutoCierreBotones,
    verificarBloqueoCredito,
    setBloqueoEdicionGrupo,
    toggleBloqueoEdicionGrupo,
    cerrarEdicionGrupo,
    setTiempoExpansionBotones: (v) => { tiempoExpansionBotones = v; }
};
