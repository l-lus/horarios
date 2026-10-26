import { STORAGE_KEYS } from '../core/constants.js';
import { $ } from '../core/dom.js';
import { TimeUtils } from '../core/time-utils.js';
import { StorageHelper } from '../core/storage.js';
import { SecurityAndUtils as S } from '../core/security.js';
import { HistoryManager } from './history-manager.js';
import { TiposRegistro } from './tipos-registro.js';
import { AppState } from './app-state.js';
import { Compensatorios } from './compensatorios.js';

// ====================================================================
//    FILTERS, PERIOD CALCULATIONS & BATCH/GROUP OPERATIONS SERVICE
// ====================================================================
function editarGrupo(grupo) {
    if (AppState.getGrupoEnEdicion() !== null) return;
    const grupoEnEdicion = {
        registros: grupo.registros,
        subtipo: grupo.subtipo,
        fechaDesde: grupo.registros[grupo.registros.length - 1].fecha,
        fechaHasta: grupo.registros[0].fecha
    };
    AppState.setGrupoEnEdicion(grupoEnEdicion);
    $('edit-grupo-tipo').value = grupo.subtipo;
    $('edit-grupo-desde').value = grupoEnEdicion.fechaDesde;
    $('edit-grupo-hasta').value = grupoEnEdicion.fechaHasta;
    const notify = AppState._notify();
    notify.actualizarHintGrupo();
    notify.setBloqueoEdicionGrupo(true);
    notify.abrirModal('modal-editar-grupo');
}

function _validarRangoGrupo(nuevoTipo, nuevaDesde, nuevaHasta) {
    if (!nuevaDesde || !nuevaHasta) return 'Verificá ambas fechas';
    if (!TimeUtils.validarFecha(nuevaDesde)) return 'Fecha "Desde" inválida';
    if (!TimeUtils.validarFecha(nuevaHasta)) return 'Fecha "Hasta" inválida';
    if (nuevaDesde > nuevaHasta) return 'La fecha inicial debe ser inferior a la final';
    const hoy = new Date();
    const dosPasado = new Date(hoy); dosPasado.setFullYear(hoy.getFullYear() - 2);
    const dosFuturo = new Date(hoy); dosFuturo.setFullYear(hoy.getFullYear() + 2);
    const ini = TimeUtils.parsearFechaLocal(nuevaDesde), fin = TimeUtils.parsearFechaLocal(nuevaHasta);
    if (ini < dosPasado || fin > dosFuturo) return 'El rango debe estar entre 2 años atrás y 2 años adelante';
    if (!TiposRegistro.validarTipoPermitido(nuevoTipo)) return 'Tipo de registro inválido';
    const dias = Math.ceil(Math.abs(fin - ini) / 864e5) + 1;
    if (dias > S.SECURITY_LIMITS.MAX_REGISTROS_POR_OPERACION) return `El rango contiene ${dias} días.\n Máximo: ${S.SECURITY_LIMITS.MAX_REGISTROS_POR_OPERACION} días por operación.`;
    return null;
}

async function guardarEdicionGrupo() {
    const grupoEnEdicion = AppState.getGrupoEnEdicion();
    if (!grupoEnEdicion) return;
    const notify = AppState._notify();
    const btnGuardar = $('modal-editar-grupo').querySelector('.btn-edit');
    btnGuardar.disabled = true;
    try {
        const nuevoTipo = S.sanitizeString($('edit-grupo-tipo').value.trim(), 20);
        const nuevaDesde = S.sanitizeString($('edit-grupo-desde').value.trim(), 10);
        const nuevaHasta = S.sanitizeString($('edit-grupo-hasta').value.trim(), 10);

        const error = _validarRangoGrupo(nuevoTipo, nuevaDesde, nuevaHasta);
        if (error) { notify.mostrarToast(error, 'error'); return; }

        if (nuevoTipo === grupoEnEdicion.subtipo && nuevaDesde === grupoEnEdicion.fechaDesde && nuevaHasta === grupoEnEdicion.fechaHasta) {
            notify.mostrarToast('Sin cambios', 'info'); notify.cerrarEdicionGrupo(); return;
        }

        const fechasNuevas = TimeUtils.generarRangoFechas(nuevaDesde, nuevaHasta);
        const idsDelGrupo = new Set(grupoEnEdicion.registros.map(r => r.id));
        const fechasSet = new Set(fechasNuevas);
        const registros = AppState.registros();
        const conflictos = registros.filter(r => fechasSet.has(r.fecha) && !idsDelGrupo.has(r.id));
        if (conflictos.length > 0) {
            const dias = conflictos.map(r => r.fecha.substring(8, 10)).sort((a, b) => a - b).join(', ');
            notify.mostrarToast(`Conflicto en día(s): ${dias}\n Ya existen registros en esas fechas.`, 'error'); return;
        }

        const deltaRegistros = fechasNuevas.length - idsDelGrupo.size;
        if (deltaRegistros > 0 && !AppState._hayEspacioParaRegistros(deltaRegistros)) {
            notify.mostrarToast('Límite de registros alcanzado', 'error'); return;
        }
        const notaPrevia = TiposRegistro.notaDeGrupo(grupoEnEdicion) || null;
        const objetivoPorFecha = new Map(grupoEnEdicion.registros.map(r => [r.fecha, r.objetivoHoras]));
        const filtrados = registros.filter(r => !idsDelGrupo.has(r.id));
        const { entrada, salida } = TiposRegistro.obtenerCodigosPorTipo(nuevoTipo);
        const nuevosRegistros = fechasNuevas.map((fechaISO, idx) => {
            const reg = AppState._construirRegistro(fechaISO, entrada, salida);
            if (Compensatorios._esObjetivoValido(objetivoPorFecha.get(fechaISO))) reg.objetivoHoras = objetivoPorFecha.get(fechaISO);
            if (idx === 0 && notaPrevia) reg.notas = notaPrevia;
            return reg;
        });
        filtrados.push(...nuevosRegistros);
        AppState._setRegistros(filtrados);
        AppState.ordenarRegistros();
        AppState.sincronizarPushHoy();
        HistoryManager.saveState(AppState.registros(), `editar grupo (${nuevosRegistros.length} día${TimeUtils.pluralizar(nuevosRegistros.length)})`);
        const saved = await AppState.guardarYActualizar(nuevosRegistros.map(r => r.id));
        if (saved) { notify.mostrarToast('Grupo actualizado', 'success'); notify.cerrarEdicionGrupo(); }
    } finally {
        btnGuardar.disabled = false;
    }
}

async function eliminarGrupoActual() {
    const grupoEnEdicion = AppState.getGrupoEnEdicion();
    if (!grupoEnEdicion) return;
    const notify = AppState._notify();
    if (grupoEnEdicion.registros.length > S.SECURITY_LIMITS.MAX_REGISTROS_POR_OPERACION) {
        notify.mostrarToast(`Este grupo contiene ${grupoEnEdicion.registros.length} registros.\nMáximo permitido: ${S.SECURITY_LIMITS.MAX_REGISTROS_POR_OPERACION} registros por operación.`, 'error', 4000);
        return;
    }
    const idsAEliminar = grupoEnEdicion.registros.map(r => r.id);
    AppState._setRegistros(AppState.registros().filter(r => !idsAEliminar.includes(r.id)));
    AppState.sincronizarPushHoy();
    HistoryManager.saveState(AppState.registros(), `eliminar grupo (${idsAEliminar.length} registro${TimeUtils.pluralizar(idsAEliminar.length)})`);
    const saved = await AppState.guardarYActualizar();
    if (saved) { notify.mostrarToast('Grupo eliminado', 'success'); notify.cerrarEdicionGrupo(); }
}

async function registrarDiaEspecial(fecha, tipo) {
    const notify = AppState._notify();
    const registroExistente = AppState.registroPorFecha(fecha);
    if (registroExistente) { notify.mostrarToast('Ya existe un registro para hoy', 'warning'); throw new Error('Registro ya existe'); }

    const tipoConfig = TiposRegistro.obtenerTipoPorId(tipo);
    if (!tipoConfig) { notify.avisarFichaje('Tipo inválido'); throw new Error('Tipo inválido'); }

    const entrada = tipoConfig.codigo;
    const salida = tipoConfig.codigo;
    const tipoTexto = `${tipoConfig.emoji} ${tipoConfig.label}`;

    if (!AppState._hayEspacioParaRegistros(1)) { notify.avisarFichaje('Límite de registros alcanzado'); throw new Error('Límite alcanzado'); }

    const nuevo = AppState._construirRegistro(fecha, entrada, salida);
    AppState.registros().push(nuevo);

    AppState.ordenarRegistros();
    const esHoy = fecha === TimeUtils.obtenerFechaHoy();
    HistoryManager.saveState(AppState.registros(), `agregar ${tipoConfig.label} (${TimeUtils.fechaCorta(fecha)})`);
    const saved = await AppState._guardarConCicloSiHoy(nuevo.id, esHoy);
    if (saved) {
        notify.avisarFichaje(`Registro agregado como ${tipoTexto}`, 'success');
    } else {
        throw new Error('Error al guardar');
    }
}

function detenerYRegistrarTimer(registro) {
    const perfilId = AppState.obtenerPerfilIdActual();
    const storageKey = STORAGE_KEYS.BREAK_TIME(perfilId);
    const storedStart = StorageHelper.getItem(storageKey);
    if (!storedStart) return false;

    const diffMs = Date.now() - parseInt(storedStart);
    const segundosTranscurridos = Math.floor(diffMs / 1000);
    if (segundosTranscurridos < 30) { StorageHelper.removeItem(storageKey); return false; }

    const minutosTranscurridos = TimeUtils.segundosAMinutosRedondeado(segundosTranscurridos);
    const tiempoActual = registro.tiempoFuera || '00:00';
    registro.tiempoFuera = TimeUtils.sumarMinutosAHora(tiempoActual, minutosTranscurridos);
    StorageHelper.removeItem(storageKey);
    return true;
}

function detectarAyerAbierto(fechaHoy, regs) {
    const ayerObj = TimeUtils.parsearFechaLocal(fechaHoy);
    ayerObj.setDate(ayerObj.getDate() - 1);
    const ayerStr = TimeUtils.formatearFechaLocal(ayerObj);
    const regAyer = regs instanceof Map ? (regs.get(ayerStr) ?? null) : (regs.find(r => r.fecha === ayerStr) ?? null);

    let ayerAbierto = false;
    if (regAyer?.entrada && !regAyer.salida) {
        const [hE, mE] = regAyer.entrada.split(':').map(Number);
        const fechaEntrada = TimeUtils.parsearFechaLocal(ayerStr);
        fechaEntrada.setHours(hE, mE, 0, 0);
        ayerAbierto = (Date.now() - fechaEntrada.getTime()) <= 86400000;
    }
    return { ayerStr, regAyer, ayerAbierto };
}

function registroParaTiempoFuera(fechaHoy = TimeUtils.obtenerFechaHoy()) {
    const regHoy = AppState.registroPorFecha(fechaHoy) ?? null;
    if (regHoy?.entrada) return regHoy;
    const { regAyer, ayerAbierto } = detectarAyerAbierto(fechaHoy, AppState.registros());
    return ayerAbierto ? regAyer : regHoy;
}

function calcularBufferPeriodo(desde, hasta, incluirActivoEnVivo = true, minutosBreakActivo = 0, asignacionesPrecalculadas = null) {
    const hoy = TimeUtils.obtenerFechaHoy();
    const registros = AppState.registros();
    const registrosRango = registros.filter(r => r.fecha >= desde && r.fecha <= hasta);
    const regsPorFecha = new Map(registrosRango.map(r => [r.fecha, r]));
    const { ayerStr, ayerAbierto } = detectarAyerAbierto(hoy, regsPorFecha);
    const asignacionesCompensatorio = asignacionesPrecalculadas || Compensatorios._calcularAsignacionesCompensatorio();

    const regHoy = regsPorFecha.get(hoy) ?? null;
    const tipoEspecialHoy = TiposRegistro.obtenerTipoPorCodigo(regHoy?.entrada, regHoy?.salida);
    const regActivo = (ayerAbierto && !regHoy?.entrada) ? (regsPorFecha.get(ayerStr) ?? null)
        : (!tipoEspecialHoy && regHoy?.entrada && !regHoy.salida) ? regHoy : null;

    let objetivo = 0, hechas = 0;
    const horasDiarias = AppState.horasDiarias();
    for (const iso of TimeUtils.generarRangoFechas(desde, hasta)) {
        if (iso > hoy) continue;
        const esDiaHabil = Compensatorios.diasHabilesEnFecha(iso).includes(TimeUtils.parsearFechaLocal(iso).getDay());
        const r = regsPorFecha.get(iso);
        const esEspecial = r && TiposRegistro.esRegistroEspecial(r.entrada, r.salida);
        const esRemoto = esEspecial && Compensatorios.esTipoRemoto(r);
        const diaTerminado = iso === hoy ? !!(r && r.salida) : !(ayerAbierto && iso === ayerStr);
        const objetivoDia = r ? Compensatorios.objetivoDeRegistro(r) : horasDiarias;

        if (esDiaHabil && (!esEspecial || esRemoto) && diaTerminado) objetivo += objetivoDia;
        if (r && r.salida && !esEspecial && diaTerminado) {
            hechas += r.total;
            hechas -= Compensatorios._montoCompensadoDeReferencia(r, asignacionesCompensatorio);
        }
        if (esRemoto && esDiaHabil && diaTerminado) hechas += objetivoDia;

        if (incluirActivoEnVivo && !diaTerminado && esDiaHabil && !esEspecial && r && r === regActivo) {
            const t = AppState.calcularHoras(regActivo.entrada, TimeUtils.obtenerHoraActual(), regActivo.tiempoFuera || null, null, true);
            const transcurrido = Math.max(0, (t ? t.total : 0) - (minutosBreakActivo / 60));
            if (transcurrido > objetivoDia) {
                objetivo += objetivoDia;
                hechas += transcurrido;
            }
        }
    }
    return Math.round((hechas - objetivo) * 1e6) / 1e6;
}

function limpiarFiltros() {
    AppState.setFiltroState({ activo: false, desde: null, hasta: null, tipo: null });
    if ($('filtro-fecha-desde')) $('filtro-fecha-desde').value = '';
    if ($('filtro-fecha-hasta')) $('filtro-fecha-hasta').value = '';
    if ($('filtro-tipo')) $('filtro-tipo').value = '';
    AppState.guardarYActualizar();
    const notify = AppState._notify();
    notify.cerrarFiltros();
    notify.mostrarToast('Filtro eliminado', 'info');
    document.getElementById('btn-filtro')?.classList.remove('filtro-activo');
}

function aplicarFiltrosInmediato(desde, hasta, tipo) {
    if (!desde && !hasta && !tipo) {
        AppState.setFiltroState({ activo: false, desde: null, hasta: null, tipo: null });
        document.getElementById('btn-filtro')?.classList.remove('filtro-activo');
    } else {
        AppState.setFiltroState({ activo: true, desde: desde || null, hasta: hasta || null, tipo: tipo || null });
        document.getElementById('btn-filtro')?.classList.add('filtro-activo');
    }
    AppState.guardarYActualizar();
}

function obtenerRegistrosFiltrados() {
    const { filtroActivo, filtroDesde, filtroHasta, filtroTipo } = AppState.getFiltroState();
    const registros = AppState.registros();
    if (!filtroActivo) return registros;
    return registros.filter(r => {
        if (filtroDesde && r.fecha < filtroDesde) return false;
        if (filtroHasta && r.fecha > filtroHasta) return false;
        if (filtroTipo) {
            const tipoRegistro = TiposRegistro.obtenerTipoPorCodigo(r.entrada, r.salida);
            if (filtroTipo === 'normal') { if (tipoRegistro) return false; }
            else { if (!tipoRegistro || tipoRegistro.id !== filtroTipo) return false; }
        }
        return true;
    });
}

async function registrarVacacionesDirecto(desde, hasta, tipo) {
    const notify = AppState._notify();
    const tipoConfig = TiposRegistro.obtenerTipoPorId(tipo);
    if (!tipoConfig) { notify.avisarFichaje('Tipo inválido'); throw new Error('Tipo inválido'); }
    const entrada = tipoConfig.codigo;
    const salida = tipoConfig.codigo;

    const fechasARegistrar = TimeUtils.generarRangoFechas(desde, hasta);

    if (fechasARegistrar.length > S.SECURITY_LIMITS.MAX_REGISTROS_POR_OPERACION) {
        notify.avisarFichaje(`El rango seleccionado contiene ${fechasARegistrar.length} días.\n Máximo permitido: ${S.SECURITY_LIMITS.MAX_REGISTROS_POR_OPERACION} días por operación.`, 'error', { duracion: 4000 });
        throw new Error('Límite de días excedido');
    }

    const nuevosRegistros = fechasARegistrar.filter(f => !AppState.existeRegistroEnFecha(f));
    if (nuevosRegistros.length === 0) { notify.avisarFichaje('Todas las fechas ya están registradas', 'warning'); throw new Error('Sin fechas nuevas'); }
    if (!AppState._hayEspacioParaRegistros(nuevosRegistros.length)) { notify.avisarFichaje('Límite de registros alcanzado', 'error'); throw new Error('Límite alcanzado'); }

    const idsNuevosParaAnimar = [];
    const registros = AppState.registros();
    nuevosRegistros.forEach(fecha => {
        const nuevo = AppState._construirRegistro(fecha, entrada, salida);
        idsNuevosParaAnimar.push(nuevo.id);
        registros.push(nuevo);
    });

    AppState.ordenarRegistros();
    const incluyeHoy = nuevosRegistros.includes(TimeUtils.obtenerFechaHoy());
    HistoryManager.saveState(registros, `agregar ${tipoConfig.label} (${nuevosRegistros.length} día${TimeUtils.pluralizar(nuevosRegistros.length)})`);
    const saved = await AppState._guardarConCicloSiHoy(idsNuevosParaAnimar, incluyeHoy);
    if (saved) {
        notify.avisarFichaje(nuevosRegistros.length === 1 ? '1 día registrado' : `${nuevosRegistros.length} días registrados`, 'success');
    } else {
        throw new Error('Error al guardar');
    }
}

async function borrarPeriodoDirecto(desde, hasta) {
    const notify = AppState._notify();
    const registros = AppState.registros();
    const registrosAEliminar = registros.filter(r => {
        if (r.fecha < desde || r.fecha > hasta) return false;
        return !TiposRegistro.esRegistroEspecial(r.entrada, r.salida);
    });
    if (registrosAEliminar.length > S.SECURITY_LIMITS.MAX_REGISTROS_POR_OPERACION) {
        notify.avisarFichaje(`Máximo ${S.SECURITY_LIMITS.MAX_REGISTROS_POR_OPERACION} registros por operación. Encontrados: ${registrosAEliminar.length}`);
        throw new Error('Límite excedido');
    }
    if (registrosAEliminar.length === 0) {
        notify.avisarFichaje('No hay registros de jornadas en ese período', 'info');
        throw new Error('Sin registros');
    }

    AppState._setRegistros(registros.filter(r => !registrosAEliminar.includes(r)));
    AppState.sincronizarPushHoy();
    HistoryManager.saveState(AppState.registros(), `eliminar período (${registrosAEliminar.length} registro${TimeUtils.pluralizar(registrosAEliminar.length)})`);
    const saved = await AppState.guardarYActualizar();
    if (saved) {
        notify.avisarFichaje(registrosAEliminar.length === 1 ? '1 registro eliminado' : `${registrosAEliminar.length} registros eliminados`, 'success');
    } else {
        throw new Error('Error al guardar');
    }
}

export const FiltrosYPeriodosService = {
    editarGrupo,
    guardarEdicionGrupo,
    eliminarGrupoActual,
    registrarDiaEspecial,
    detenerYRegistrarTimer,
    detectarAyerAbierto,
    registroParaTiempoFuera,
    calcularBufferPeriodo,
    limpiarFiltros,
    aplicarFiltrosInmediato,
    obtenerRegistrosFiltrados,
    registrarVacacionesDirecto,
    borrarPeriodoDirecto
};
