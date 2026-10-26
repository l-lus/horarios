import { STORAGE_KEYS } from '../core/constants.js';
import { $ } from '../core/dom.js';
import { TimeUtils } from '../core/time-utils.js';
import { StorageHelper } from '../core/storage.js';
import { TiposRegistro } from '../services/tipos-registro.js';
import { DataManagement } from '../services/data-management.js';
import { SaldoSemanal } from '../services/saldo-semanal.js';
import { UICore } from './ui-core.js';
import { CardLote } from './card-lote.js';
import { SecurityAndUtils as S } from '../core/security.js';
const D = DataManagement;

// ====================================================================
//                     UI CALENDAR MODULE
// ====================================================================
const { registrarSwipe, _animarFadeSwap, _animarMutacion, _animarSlideElemento, _posicionarPopup, _registrarCierrePopup, _crearPopupFlotante, formatoDiferencia, _flashElemento, DUR_CALENDARIO, _crearFantasmaSiVisible, _aArray } = UICore;

function _cerrarSelectorMeses(idResaltar = null) {
    const grid = document.getElementById('calendario-grid');
    const selector = document.getElementById('calendario-selector-meses');
    const navBotones = document.getElementById('calendario-nav-botones');
    _animarMutacion([selector, grid], () => {
        selector.style.display = 'none';
        navBotones.style.display = 'flex';
        grid.style.display = 'grid';
        _renderizarCalendario(idResaltar);
    });
}

function abrirSelectorMesesCalendario() {
    const grid = document.getElementById('calendario-grid');
    const selector = document.getElementById('calendario-selector-meses');
    const navBotones = document.getElementById('calendario-nav-botones');
    const titulo = document.getElementById('calendario-titulo-mes');

    if (selector.style.display !== 'none') { _cerrarSelectorMeses(); return; }

    const mesesOrdenados = [...new Set(D.registros().map(r => r.fecha.substring(0, 7)))].sort().reverse();
    selector.innerHTML = '';

    if (mesesOrdenados.length === 0) {
        const emptyEl = Object.assign(document.createElement('div'), {
            className: 'empty-state empty-state--calendario',
            textContent: 'No hay registros'
        });
        selector.appendChild(emptyEl);
    } else {
        const hoy = new Date();
        const anioActual = _calendarioMes ? _calendarioMes.anio : hoy.getFullYear();
        const mesActual = _calendarioMes ? _calendarioMes.mes : hoy.getMonth();

        TimeUtils.agruparMesesPorAnio(mesesOrdenados).forEach((meses, anioStr) => {
            const separador = Object.assign(document.createElement('div'), {
                className: 'selector-meses-anio-header',
                textContent: anioStr
            });
            selector.appendChild(separador);

            meses.forEach(mesAnio => {
                const [aStr, mesStr] = mesAnio.split('-');
                const anio = parseInt(aStr), mes = parseInt(mesStr) - 1;
                const btn = Object.assign(document.createElement('button'), {
                    className: 'btn-mes-calendario',
                    textContent: TimeUtils.nombreMesCapitalizado(mesAnio)
                });
                if (anio === anioActual && mes === mesActual) btn.classList.add('activo');
                btn.onclick = (e) => { e.stopPropagation(); _calendarioMes = { anio, mes }; _cerrarSelectorMeses(); };
                selector.appendChild(btn);
            });
        });
    }

    selector.style.height = grid.getBoundingClientRect().height + 'px';
    _animarMutacion([grid, selector], () => {
        grid.style.display = 'none';
        navBotones.style.display = 'none';
        titulo.innerHTML = '<svg class="icon"><use href="#icon-back" /></svg> Volver';
        selector.style.display = 'grid';
    });
}

function _activarVistaCalendarioHistorico() {
    if (!_vistaHistoricoCalendario) return;
    const lista = document.getElementById('lista-registros');
    const cal = document.getElementById('vista-calendario-historico');
    const btnFiltro = document.getElementById('btn-filtro');
    if (lista) lista.classList.add('hidden');
    if (cal) cal.classList.remove('hidden');
    if (btnFiltro) btnFiltro.disabled = false;
    _renderizarCalendario();
}

let _calendarioMes = null;

function _renderizarCalendario(idResaltar = null, asignacionesPrecalculadas = null) {
    const grid = document.getElementById('calendario-grid');
    const titulo = document.getElementById('calendario-titulo-mes');
    if (!grid) return;

    if (grid.parentNode) {
        registrarSwipe(grid.parentNode, dir => navegarCalendario(dir));
    } else {
        registrarSwipe(grid, dir => navegarCalendario(dir));
    }
    _registrarLongPressSemana(grid);

    const hoy = new Date();
    const anio = _calendarioMes ? _calendarioMes.anio : hoy.getFullYear();
    const mes = _calendarioMes ? _calendarioMes.mes : hoy.getMonth();
    if (titulo) titulo.textContent = `${TimeUtils.nombreMesPorIndice(mes)} ${anio}`;
    const fechaStr = (y, m, d) => `${y}-${TimeUtils._pad2(m + 1)}-${TimeUtils._pad2(d)}`;
    const registrosFiltrados = D.obtenerRegistrosFiltrados();
    const todosLosRegistros = D.registros();
    const regsPorFecha = Object.fromEntries(registrosFiltrados.map(r => [r.fecha, r]));
    const todosRegsPorFecha = Object.fromEntries(todosLosRegistros.map(r => [r.fecha, r]));
    const filtroActivo = registrosFiltrados.length !== todosLosRegistros.length;
    const asignacionesCompensatorio = asignacionesPrecalculadas || D.calcularAsignacionesCompensatorio();
    const claveMes = `${anio}-${TimeUtils._pad2(mes + 1)}`;
    const notasDelMes = TiposRegistro.mapaNotasPorRegistro(todosLosRegistros.filter(r => r.fecha.startsWith(claveMes)));
    const claseDelDia = (fecha) => {
        const r = regsPorFecha[fecha];
        if (!r && filtroActivo && todosRegsPorFecha[fecha]) return 'dia-filtrado';
        if (!r) return 'dia-sin-registro';
        const { estado, tipo } = SaldoSemanal.estadoDeRegistro(r, asignacionesCompensatorio);
        if (estado === 'especial') return `dia-especial-${tipo.color}`;
        if (estado === 'en-curso') return 'dia-en-curso';
        if (estado === 'cubierto') return 'dia-cubierto';
        if (estado === 'incompleto' || estado === 'sin-datos') return 'dia-incompleto';
        return 'dia-normal';
    };

    const diasNombre = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const primerDia = new Date(anio, mes, 1);
    const ultimoDia = new Date(anio, mes + 1, 0);
    const frag = document.createDocumentFragment();

    diasNombre.forEach(d => {
        const cell = document.createElement('div');
        cell.className = 'calendario-dia-nombre';
        cell.textContent = d;
        frag.appendChild(cell);
    });

    const offsetInicio = primerDia.getDay();
    for (let i = 0; i < offsetInicio; i++) {
        const vacio = document.createElement('div');
        vacio.className = 'calendario-dia vacio';
        frag.appendChild(vacio);
    }

    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
        const fecha = fechaStr(anio, mes, dia);
        const clase = claseDelDia(fecha);
        const esHoy = anio === hoy.getFullYear() && mes === hoy.getMonth() && dia === hoy.getDate();
        const reg = regsPorFecha[fecha];
        const idsNuevos = _aArray(idResaltar);
        const esNuevo = reg && idsNuevos.includes(reg.id);

        const cell = document.createElement('div');
        let clases = `calendario-dia ${clase}`;
        if (esHoy) clases += ' hoy';
        if (clase === 'dia-sin-registro' && !TimeUtils.esFechaHabil(fecha, D.diasHabilesEnFecha(fecha))) clases += ' no-laborable';
        if (esNuevo) {
            clases += ' nuevo-registro-animacion';
            cell.addEventListener('animationend', () => cell.classList.remove('nuevo-registro-animacion'), { once: true });
        }
        if (reg) clases += ' cursor-pointer';
        if (reg && notasDelMes.has(reg.id)) clases += ' tiene-comentario';
        cell.className = clases;
        cell.textContent = dia;
        cell.dataset.dia = fecha;

        if (reg) {
            cell.dataset.regId = reg.id;
            cell.addEventListener('click', (e) => _onclickCalendarioDia(e, reg.id, asignacionesCompensatorio));
            cell.addEventListener('mouseenter', (e) => _popupCalendarioHover(e, reg.id, asignacionesCompensatorio));
            cell.addEventListener('mouseleave', (e) => _cerrarPopupCalendarioHover(e));
        } else if (clase === 'dia-sin-registro') {
            cell.classList.add('cursor-pointer');
            cell.dataset.fecha = fecha;
            cell.addEventListener('click', (e) => _popupCalendarioDiaSinRegistro(e, fecha));
        }

        frag.appendChild(cell);
    }

    const { inicio: semIni, fin: semFin } = TimeUtils.obtenerSemanaRangoActual();
    const esLaborable = (f) => TimeUtils.esFechaHabil(f, D.diasHabilesEnFecha(f));
    const fechaDeDia = (d) => TimeUtils.formatearFechaLocal(new Date(anio, mes, d));
    const segmentosSemana = [];
    for (let d = 1; d <= ultimoDia.getDate(); d++) {
        const f = fechaStr(anio, mes, d);
        if (f < semIni || f > semFin || !esLaborable(f)) continue;
        const idx = offsetInicio + d - 1;
        const fila = 2 + Math.floor(idx / 7);
        const col = 1 + (idx % 7);
        const ultimo = segmentosSemana[segmentosSemana.length - 1];
        if (ultimo && ultimo.fila === fila && ultimo.hasta === col - 1) {
            ultimo.hasta = col;
            ultimo.diaFin = d;
        } else {
            segmentosSemana.push({ fila, desde: col, hasta: col, diaIni: d, diaFin: d });
        }
    }
    segmentosSemana.forEach(seg => {
        const banda = document.createElement('div');
        banda.className = 'calendario-semana-actual';
        if (seg.desde === 1 && esLaborable(fechaDeDia(seg.diaIni - 1))) banda.classList.add('abierta-izq');
        if (seg.hasta === 7 && esLaborable(fechaDeDia(seg.diaFin + 1))) banda.classList.add('abierta-der');
        banda.setAttribute('aria-hidden', 'true');
        banda.style.gridArea = `${seg.fila} / ${seg.desde} / ${seg.fila + 1} / ${seg.hasta + 1}`;
        frag.appendChild(banda);
    });

    grid.classList.toggle('calendario-filtro-activo', filtroActivo);

    if (idResaltar) {
        const idsAnimados = _aArray(idResaltar).map(String);
        grid.querySelectorAll('.calendario-dia[data-reg-id]').forEach(celdaVieja => {
            if (idsAnimados.includes(celdaVieja.dataset.regId)) _crearFantasmaSiVisible(celdaVieja);
        });
    }

    grid.innerHTML = '';
    grid.appendChild(frag);

}

let _vistaHistoricoCalendario = false;

function toggleVistaHistorico() {
    _vistaHistoricoCalendario = !_vistaHistoricoCalendario;
    StorageHelper.setItem(STORAGE_KEYS.VISTA_HISTORICO_CAL, _vistaHistoricoCalendario);

    const lista = document.getElementById('lista-registros');
    const cal = document.getElementById('vista-calendario-historico');
    if (lista) {
        lista.querySelectorAll('.nuevo-registro-animacion').forEach(el => el.classList.remove('nuevo-registro-animacion'));
    }
    if (cal) {
        cal.querySelectorAll('.nuevo-registro-animacion').forEach(el => el.classList.remove('nuevo-registro-animacion'));
    }
    const btnFiltro = document.getElementById('btn-filtro');
    const saliente = _vistaHistoricoCalendario ? lista : cal;
    const entrante = _vistaHistoricoCalendario ? cal : lista;
    _animarMutacion([saliente, entrante], () => {
        if (saliente) { saliente.classList.add('hidden'); }
        if (entrante) { entrante.classList.remove('hidden'); }

        if (btnFiltro) btnFiltro.disabled = false;
        if (_vistaHistoricoCalendario) _renderizarCalendario();
    });

    const selector = document.getElementById('calendario-selector-meses');
    const grid = document.getElementById('calendario-grid');
    const navBotones = document.getElementById('calendario-nav-botones');
    if (selector && !selector.classList.contains('hidden') && selector.style.display !== 'none') {
        selector.style.display = 'none';
        if (grid) grid.style.display = 'grid';
        if (navBotones) navBotones.style.display = 'flex';
    }
}

let _popupCalendarioEl = null;

function _buildInfoHtmlRegistro(reg, asignaciones = null) {
    const est = SaldoSemanal.estadoDeRegistro(reg, asignaciones || D.calcularAsignacionesCompensatorio());
    if (est.estado === 'especial') {
        const { tipo } = est;
        const emoji = S.escapeHtml(tipo.emoji ?? '');
        const label = S.escapeHtml(tipo.label);
        const colorSafe = /^[a-z]+$/.test(tipo.color || '') ? tipo.color : 'purple';
        const fechaCompensadaHtml = est.fechaCompensada
            ? ` <span class="cal-popup-badge cal-popup-badge--${colorSafe}">${S.escapeHtml(TimeUtils.fechaCorta(est.fechaCompensada))}</span>`
            : '';
        return `<span class="cal-popup-badge cal-popup-badge--${colorSafe}">${emoji} ${label}</span>${fechaCompensadaHtml}`;
    }
    if (est.estado === 'en-curso') {
        const esHoy = reg.fecha === TimeUtils.obtenerFechaHoy();
        return `<div class="cal-popup-info cal-popup-info--blue">${esHoy ? 'En curso' : 'Incompleto'}</div>
            <div class="cal-popup-3l">Entrada: ${S.escapeHtml(reg.entrada)}</div>`;
    }
    let tfStr = '';
    if (reg.tiempoFuera && reg.tiempoFuera !== '00:00') {
        tfStr = `${TimeUtils.horasATexto(TimeUtils.horaAMinutos(reg.tiempoFuera) / 60, 'short')} fuera`;
    }
    const diffClase = { cumplido: 'cal-popup-info--green', cubierto: 'cal-popup-info--gold', incompleto: 'cal-popup-info--red' }[est.estado] || '';
    const totalConDiff = TimeUtils.horasATexto(reg.total || 0, 'short') + (est.diffText ? ` (${est.diffText})` : '');
    const cubiertoLineaHtml = est.estado === 'cubierto' ? `<span class="cal-popup-badge cal-popup-badge--gold">Cubierto</span>` : '';
    const compensadoLineaHtml = est.fechaCompensado
        ? `<span class="cal-popup-badge cal-popup-badge--purple">→ ${S.escapeHtml(TimeUtils.fechaCorta(est.fechaCompensado))}</span>`
        : '';
    return `<div class="cal-popup-info${diffClase ? ' ' + diffClase : ''}">${totalConDiff}</div>
        ${cubiertoLineaHtml}
        ${compensadoLineaHtml}
        <div class="cal-popup-3l">${S.escapeHtml(reg.entrada)} → ${S.escapeHtml(reg.salida)}</div>
        ${tfStr ? _cajaPopupHtml('#icon-exit', tfStr) : ''}`;
}

function _cerrarPopupCalendario() {
    if (!_popupCalendarioEl) return;
    const el = _popupCalendarioEl;
    _popupCalendarioEl = null;
    if (el._cerrar) el._cerrar();
    else el.remove();
}

function _cajaPopupHtml(icono, texto) {
    return `<div class="cal-popup-caja">
        <svg class="icon cal-popup-caja-icono"><use href="${icono}"/></svg>
        <span class="cal-popup-caja-texto">${S.escapeHtml(texto)}</span>
    </div>`;
}

function _formatearFechaLabelPopup(fecha) {
    const d = new Date(fecha + 'T12:00:00');
    const diaSemana = TimeUtils.obtenerNombreDia(fecha).toLowerCase();
    const mes = TimeUtils.nombreMesPorIndice(d.getMonth());
    return S.escapeHtml(`${diaSemana}, ${d.getDate()} de ${mes}`);
}

function _popupCalendario(event, registroId, asignaciones = null) {
    event.stopPropagation();

    _cerrarPopupCalendario();

    const reg = D.registroPorId(registroId);
    if (!reg) return;

    const claveMes = reg.fecha.substring(0, 7);
    const registrosDelMes = D.registros().filter(r => r.fecha.substring(0, 7) === claveMes);
    const grupos = TiposRegistro.agruparConsecutivos(registrosDelMes);
    const grupoDelRegistro = grupos.find(g => g.tipo === 'grupo' && g.registros.some(r => r.id === registroId));

    const fechaLabel = _formatearFechaLabelPopup(reg.fecha);
    const infoHtml = _buildInfoHtmlRegistro(reg, asignaciones);
    const notasTexto = reg.notas || (grupoDelRegistro && TiposRegistro.notaDeGrupo(grupoDelRegistro));
    const comentarioHtml = notasTexto ? _cajaPopupHtml('#icon-comment', notasTexto) : '';
    const btnGrupoHtml = grupoDelRegistro ? `
        <button class="cal-popup-btn-edit" id="_cal-popup-btn-grupo">
            <svg class="icon"><use href="#icon-grid-group"/></svg>
            Editar grupo
        </button>` : '';

    const { popup, cerrar } = _crearPopupFlotante({
        className: 'cal-popup',
        id: '_cal-popup',
        dataset: { registroId: reg.id },
        html: `
        <div class="cal-popup-fecha">${fechaLabel}</div>
        ${infoHtml}
        ${comentarioHtml}
        <button class="cal-popup-btn-edit" id="_cal-popup-btn-edit">
            <svg class="icon"><use href="#icon-edit"/></svg>
            Editar
        </button>
        ${btnGrupoHtml}`,
        event,
        selectorTrigger: '.calendario-dia',
        esMismoTrigger: dia => dia.dataset.regId === reg.id,
        alCerrar: (p) => { if (_popupCalendarioEl === p) _popupCalendarioEl = null; }
    });
    _popupCalendarioEl = popup;

    popup.querySelector('#_cal-popup-btn-edit')?.addEventListener('click', () => {
        cerrar();
        DataManagement.editarRegistro(reg.id);
    });
    popup.querySelector('#_cal-popup-btn-grupo')?.addEventListener('click', () => {
        cerrar();
        DataManagement.editarGrupo(grupoDelRegistro);
    });

    popup.addEventListener('mouseenter', () => clearTimeout(_popupCalendarioHoverTimer));
    popup.addEventListener('mouseleave', () => {
        if (_popupCalendarioEsHover) {
            _popupCalendarioHoverTimer = setTimeout(() => {
                _cerrarPopupCalendario();
                _popupCalendarioEsHover = false;
            }, 500);
        }
    });
}

// ── Popup de la semana: long press en móvil, click secundario en PC ──────────
const LONG_PRESS_MS = 500;
const LONG_PRESS_TOLERANCIA_PX = 10;
let _ultimoToqueTs = 0;
let _longPressDisparadoTs = 0;

function _registrarLongPressSemana(grid) {
    if (!grid || grid.dataset.semanaInit) return;
    grid.dataset.semanaInit = '1';
    let timer = null, x0 = 0, y0 = 0;
    const cancelar = () => { clearTimeout(timer); timer = null; };

    grid.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') return;
        const celda = e.target.closest('.calendario-dia[data-dia]');
        if (!celda) return;
        _ultimoToqueTs = performance.now();
        x0 = e.clientX; y0 = e.clientY;
        cancelar();
        timer = setTimeout(() => {
            timer = null;
            _longPressDisparadoTs = performance.now();
            const puedeVibrar = navigator.userActivation ? navigator.userActivation.hasBeenActive : true;
            if (puedeVibrar && 'vibrate' in navigator) { try { navigator.vibrate(15); } catch (_) { } }
            _popupSemana(celda);
        }, LONG_PRESS_MS);
    }, { passive: true });

    grid.addEventListener('pointermove', (e) => {
        if (timer && Math.hypot(e.clientX - x0, e.clientY - y0) > LONG_PRESS_TOLERANCIA_PX) cancelar();
    }, { passive: true });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(tipo => grid.addEventListener(tipo, cancelar, { passive: true }));

    grid.addEventListener('contextmenu', (e) => {
        const celda = e.target.closest('.calendario-dia[data-dia]');
        if (!celda) return;
        e.preventDefault();
        if (performance.now() - _ultimoToqueTs < 1500) return;
        _popupSemana(celda);
    });

    grid.addEventListener('click', (e) => {
        if (performance.now() - _longPressDisparadoTs < 600) { e.stopPropagation(); e.preventDefault(); }
    }, true);
}

function _filaSemana(r, asignaciones) {
    const est = SaldoSemanal.estadoDeRegistro(r, asignaciones);
    const color = SaldoSemanal.colorDeEstado(est);
    const colorSafe = /^[a-z]+$/.test(color || '') ? color : 'neutro';
    const diaTxt = `${TimeUtils.obtenerNombreDia(r.fecha).slice(0, 3)} ${parseInt(r.fecha.substring(8), 10)}`;
    let medio = '', totalHtml = '', diffHtml = '';
    if (est.estado === 'especial') {
        medio = `${est.tipo.emoji ?? ''} ${est.tipo.label}`.trim();
    } else if (est.estado === 'en-curso') {
        medio = `${r.entrada} → …`;
        totalHtml = `<span class="cal-semana-hs cal-popup-info--blue">${r.fecha === TimeUtils.obtenerFechaHoy() ? 'En curso' : 'Incompleto'}</span>`;
    } else if (est.estado === 'sin-datos') {
        medio = '-';
    } else {
        medio = `${r.entrada} → ${r.salida}`;
        totalHtml = `<span class="cal-semana-hs">${TimeUtils.horasATexto(r.total || 0, 'short')}</span>`;
        if (est.diffText) diffHtml = `<span class="cal-semana-diff cal-popup-info--${colorSafe}">${est.diffText}</span>`;
    }
    return `<span class="cal-semana-punto cal-semana-punto--${colorSafe}"></span>
        <span class="cal-semana-dia">${S.escapeHtml(diaTxt)}</span>
        <span class="cal-popup-3l">${S.escapeHtml(medio)}</span>
        ${totalHtml || '<span></span>'}
        ${diffHtml || '<span></span>'}`;
}

function _htmlPopupSemana(lunes) {
    const d = TimeUtils.parsearFechaLocal(lunes);
    d.setDate(d.getDate() + 6);
    const domingo = TimeUtils.formatearFechaLocal(d);
    const asignaciones = D.calcularAsignacionesCompensatorio();
    const registros = D.registros()
        .filter(r => r.fecha >= lunes && r.fecha <= domingo)
        .sort((a, b) => a.fecha.localeCompare(b.fecha));

    const titulo = `<div class="cal-popup-fecha">${S.escapeHtml(TimeUtils.formatearRangoSemana(lunes))}</div>`;
    if (!registros.length) return `${titulo}<div class="cal-popup-sin-reg">Sin registros</div>`;

    const total = registros.reduce((sum, r) => sum + D.horasEfectivasDeRegistro(r), 0);
    const buffer = D.calcularBufferPeriodo(lunes, domingo, false, 0, asignaciones);
    const bufferTxt = TimeUtils.formatoDiferencia(buffer, 0);
    const chip = bufferTxt
        ? `<span class="registro-total ${buffer > 0 ? 'green-text' : 'red-text'}">${bufferTxt}</span>`
        : '';
    const filas = registros.map(r => _filaSemana(r, asignaciones)).join('');
    return `${titulo}
        <div class="cal-semana-total">
            <span class="cal-popup-info">${TimeUtils.horasATexto(total, 'short')}</span>
            ${chip}
        </div>
        <div class="cal-semana-lista">${filas}</div>`;
}

function _popupSemana(celda) {
    const fecha = celda?.dataset.dia;
    if (!fecha) return;
    clearTimeout(_popupCalendarioHoverTimer);
    _popupCalendarioEsHover = false;
    _cerrarPopupCalendario();
    
    const ancla = celda.isConnected
        ? celda
        : document.querySelector(`#calendario-grid .calendario-dia[data-dia="${fecha}"]`);
    if (!ancla) return;

    const lunes = TimeUtils.obtenerLunesSemanaISO(fecha);
    const { popup } = _crearPopupFlotante({
        className: 'cal-popup cal-popup-semana',
        id: '_cal-popup',
        dataset: { semana: lunes },
        html: _htmlPopupSemana(lunes),
        event: { currentTarget: ancla },
        selectorTrigger: '.calendario-dia',
        esMismoTrigger: dia => dia.dataset.dia === fecha,
        alCerrar: (p) => { if (_popupCalendarioEl === p) _popupCalendarioEl = null; }
    });
    _popupCalendarioEl = popup;
}

let _popupCalendarioEsHover = false;
let _popupCalendarioHoverTimer = null;

function _popupCalendarioDiaSinRegistro(event, fecha) {
    event.stopPropagation();
    clearTimeout(_popupCalendarioHoverTimer);
    _popupCalendarioEsHover = false;

    const mismaFecha = _popupCalendarioEl?.dataset.fecha === fecha;
    _cerrarPopupCalendario();
    if (mismaFecha) return;

    const esFechaFutura = fecha > TimeUtils.obtenerFechaHoy();
    const fechaLabel = _formatearFechaLabelPopup(fecha);

    const { popup, cerrar } = _crearPopupFlotante({
        className: 'cal-popup',
        id: '_cal-popup',
        dataset: { fecha },
        html: `
        <div class="cal-popup-fecha">${fechaLabel}</div>
        <div class="cal-popup-sin-reg">Sin registros</div>
        ${esFechaFutura ? '' : `<button class="cal-popup-btn-edit cal-popup-btn-accion cal-popup-btn-accion--normal" id="_cal-popup-btn-normal">
            <svg class="icon"><use href="#icon-clock"/></svg>
            Jornada regular
        </button>`}
        <button class="cal-popup-btn-edit cal-popup-btn-accion cal-popup-btn-accion--especial" id="_cal-popup-btn-especial">
            <svg class="icon"><use href="#icon-calendar-simple"/></svg>
            Jornada especial
        </button>`,
        event,
        selectorTrigger: '.calendario-dia',
        esMismoTrigger: dia => dia.dataset.fecha === fecha,
        alCerrar: (p) => { if (_popupCalendarioEl === p) _popupCalendarioEl = null; }
    });
    _popupCalendarioEl = popup;

    popup.querySelector('#_cal-popup-btn-normal')?.addEventListener('click', () => { cerrar(); CardLote._irAFicharConFecha(fecha, false); });
    popup.querySelector('#_cal-popup-btn-especial')?.addEventListener('click', () => { cerrar(); CardLote._irAFicharConFecha(fecha, true); });
}

function _popupCalendarioHover(event, registroId, asignaciones = null) {
    if (event.sourceCapabilities && event.sourceCapabilities.firesTouchEvents) return;
    if (!window.matchMedia('(hover: hover)').matches) return;
    const stored = StorageHelper.getItem(STORAGE_KEYS.HOVER_POPUP, null);
    if (stored !== 'true') return;
    if (_popupCalendarioEl && _popupCalendarioEl.dataset.registroId === registroId) return;
    if (_popupCalendarioEl && !_popupCalendarioEsHover) return;
    clearTimeout(_popupCalendarioHoverTimer);
    _popupCalendarioHoverTimer = setTimeout(() => {
        _popupCalendarioEsHover = true;
        _popupCalendario(event, registroId, asignaciones);
    }, 150);
}

function _onclickCalendarioDia(event, registroId, asignaciones = null) {
    const esDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const stored = StorageHelper.getItem(STORAGE_KEYS.HOVER_POPUP, null);
    const hoverActivo = esDesktop && stored === 'true';

    if (hoverActivo) {
        _cerrarPopupCalendario();
        clearTimeout(_popupCalendarioHoverTimer);
        DataManagement.editarRegistro(registroId);
    } else {
        if (_popupCalendarioEl?.dataset.registroId === registroId) {
            _cerrarPopupCalendario();
            return;
        }
        _popupCalendario(event, registroId, asignaciones);
    }
}

function _cerrarPopupCalendarioHover(event) {
    if (!_popupCalendarioEsHover) return;
    const related = event.relatedTarget;
    if (related && _popupCalendarioEl && _popupCalendarioEl.contains(related)) return;
    clearTimeout(_popupCalendarioHoverTimer);
    _popupCalendarioHoverTimer = setTimeout(() => {
        _cerrarPopupCalendario();
        _popupCalendarioEsHover = false;
    }, 500);
}

function _animarCalendario(delta, renderFn) {
    _animarSlideElemento(document.getElementById('calendario-grid'), delta, renderFn);
}

function navegarCalendario(delta) {
    _cerrarPopupCalendario();

    const hoy = new Date();
    const base = _calendarioMes || { anio: hoy.getFullYear(), mes: hoy.getMonth() };
    let nuevoMes = base.mes + delta;
    let nuevoAnio = base.anio;
    if (nuevoMes > 11) { nuevoMes = 0; nuevoAnio++; }
    if (nuevoMes < 0) { nuevoMes = 11; nuevoAnio--; }
    _calendarioMes = { anio: nuevoAnio, mes: nuevoMes };
    _animarCalendario(delta, () => _renderizarCalendario());
}

function _flashDiaHoyCalendario() {
    const el = document.querySelector('#calendario-grid .calendario-dia.hoy');
    _flashElemento(el, 'campo-flash');
}

function irHoyCalendario() {
    const hoy = new Date();
    if (_calendarioMes === null ||
        (_calendarioMes.anio === hoy.getFullYear() && _calendarioMes.mes === hoy.getMonth())) {
        _flashDiaHoyCalendario();
        return;
    }
    const base = _calendarioMes;
    const delta = (base.anio * 12 + base.mes) > (hoy.getFullYear() * 12 + hoy.getMonth()) ? -1 : 1;
    _calendarioMes = null;
    _animarCalendario(delta, () => _renderizarCalendario());
    setTimeout(_flashDiaHoyCalendario, DUR_CALENDARIO() + 20);
}

function bindEventos() {
    $('calendario-titulo-mes')?.addEventListener('click', () => abrirSelectorMesesCalendario());
    document.querySelector('.btn-hoy-calendario')?.addEventListener('click', () => irHoyCalendario());
    const navBotones = $('calendario-nav-botones');
    if (navBotones) {
        const navBtns = navBotones.querySelectorAll('button:not(.btn-hoy-calendario)');
        if (navBtns[0]) navBtns[0].addEventListener('click', () => navegarCalendario(-1));
        if (navBtns[1]) navBtns[1].addEventListener('click', () => navegarCalendario(1));
    }

}

export const UICalendario = {
    bindEventos,
    abrirSelectorMesesCalendario,
    _cerrarSelectorMeses,
    _activarVistaCalendarioHistorico,
    _renderizarCalendario,
    toggleVistaHistorico,
    _popupCalendario,
    _popupCalendarioDiaSinRegistro,
    _popupCalendarioHover,
    _onclickCalendarioDia,
    _cerrarPopupCalendarioHover,
    navegarCalendario,
    irHoyCalendario,
    getVistaHistoricoCalendario: () => _vistaHistoricoCalendario,
    setVistaHistoricoCalendario: (v) => { _vistaHistoricoCalendario = v; }
};
