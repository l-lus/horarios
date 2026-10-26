import { Compensatorios } from './compensatorios.js';
import { ImportExportData } from './import-export-data.js';
import { FiltrosYPeriodosService } from './filtros-periodos-service.js';
import { AppState } from './app-state.js';
import { STORAGE_KEYS } from '../core/constants.js';
import { $, setColapsable } from '../core/dom.js';
import { TimeUtils } from '../core/time-utils.js';
import { PushReminder } from './push-reminder.js';
import { StorageHelper } from '../core/storage.js';
import { PerfilManager } from './perfil-manager.js';
import { HistoryManager } from './history-manager.js';
import { TiposRegistro } from './tipos-registro.js';
import { SecurityAndUtils as S } from '../core/security.js';

// ====================================================================
// DATA MANAGEMENT MODULE
// ====================================================================
const {
    ordenarRegistros, registroPorFecha, registroPorId, existeRegistroEnFecha,
    _hayEspacioParaRegistros, _fechaFuturaInvalida, calcularHoras,
    _aplicarCalculoHoras, _recalcularHorasSiValido, _construirRegistro,
    guardarYActualizar, _guardarConCicloSiHoy
} = AppState;

const {
    _esObjetivoValido, _sanitizarHistorialDiasHabiles, diasHabilesEnFecha,
    registrarCambioDiasHabiles, objetivoDeRegistro, esTipoRemoto,
    _calcularAsignacionesCompensatorio, _buscarAsignacionCompensatorio,
    _montoCompensadoPorRegistro, _fechaCompensadaPorRegistro,
    _fechaCompensadoDeRegistro, _montoCompensadoDeReferencia,
    horasEfectivasDeRegistro, objetivoEdicionEnVivo, migrarObjetivoHorasFaltante,
    _recalcularCreditoRegistro, aplicarHorasATodosLosRegistros
} = Compensatorios;

const {
    KEYS_CONFIG_EXPORTABLE, obtenerConfigExportable, validarCamposConfigImport,
    aplicarConfigImportada, calcularCambiosConfigImport,
    normalizarRegistrosImportados, exportarJSON, importarDatos
} = ImportExportData;

const {
    editarGrupo, guardarEdicionGrupo, eliminarGrupoActual, registrarDiaEspecial,
    detenerYRegistrarTimer, detectarAyerAbierto, registroParaTiempoFuera,
    calcularBufferPeriodo, limpiarFiltros, aplicarFiltrosInmediato,
    obtenerRegistrosFiltrados, registrarVacacionesDirecto, borrarPeriodoDirecto
} = FiltrosYPeriodosService;

function cargarConfiguracion() {
    const perfilData = PerfilManager ? PerfilManager.obtenerDatosPerfil() : null;
    return {
        diasHabiles: (perfilData && Array.isArray(perfilData.diasHabiles))
            ? perfilData.diasHabiles
            : StorageHelper.getObject(STORAGE_KEYS.DIAS_HABILES, [1, 2, 3, 4, 5]),
        horasDiarias: (perfilData && perfilData.horasDiarias !== undefined)
            ? perfilData.horasDiarias
            : StorageHelper.getNumber(STORAGE_KEYS.HORAS_DIARIAS, 7),
        tema: AppState._notify().temaGuardado(),
        vistaActual: StorageHelper.getItem(STORAGE_KEYS.VISTA_ACTUAL, 'diaria'),
        ignorarTiempoFuera: StorageHelper.getBoolean(STORAGE_KEYS.IGNORAR_TF, false, true),
        modoEstadisticas: StorageHelper.getItem(STORAGE_KEYS.MODO_ESTADISTICAS, 'mensual'),
        fondoCard: StorageHelper.getItem(STORAGE_KEYS.FONDO_CARD, 'golden-gate', true)
    };
}

function validarFormulario() {
    let valido = true;
    const notify = AppState._notify();
    const fecha = S.sanitizeString($('fecha').value, 10);
    const entrada = S.sanitizeString($('entrada').value.trim(), 5);
    const salida = S.sanitizeString($('salida').value.trim(), 5);

    notify.limpiarError('fecha', null);
    notify.limpiarError('entrada', null);
    notify.limpiarError('salida', null);

    if (!fecha || !TimeUtils.validarFecha(fecha)) { notify.mostrarError('fecha', null); valido = false; }
    if (entrada && !TimeUtils.validarHora(entrada)) { notify.mostrarError('entrada', null); valido = false; }
    if (salida && !TimeUtils.validarHora(salida)) { notify.mostrarError('salida', null); valido = false; }
    return valido;
}

function _mensajeExitoSalida(reg, usaHoraActual, timerDetenido, s) {
    if (timerDetenido && usaHoraActual) {
        return `Salida registrada con hora actual \nTiempo fuera: +${reg.tiempoFuera || '00:00'} \n(entrada: ${reg.entrada})`;
    }
    return usaHoraActual
        ? `Salida registrada con hora actual \n(entrada: ${reg.entrada})`
        : `Salida ${s} agregada \n(entrada: ${reg.entrada})`;
}

async function _completarSalidaRegistro(reg, s, usaHoraActual, btn) {
    const notify = AppState._notify();
    const timerDetenido = detenerYRegistrarTimer(reg);
    reg.salida = s;
    _aplicarCalculoHoras(reg, reg.entrada, s, reg.tiempoFuera || null);

    const esHoy = reg.fecha === TimeUtils.obtenerFechaHoy();
    HistoryManager.saveState(AppState.registros(), `salida ${s} (${TimeUtils.fechaCorta(reg.fecha)})`);
    const saved = await _guardarConCicloSiHoy(reg.id, esHoy, 'salida');
    if (!saved) {
        notify.avisarFichaje(null, 'error', { btn });
        return;
    }
    PushReminder.cancelarFinDeJornada(reg.fecha);
    if (!usaHoraActual) {
        notify.aplicarFeedbackCampos([
            { id: 'entrada', fallback: 'Entrada', mostrar: false },
            { id: 'salida', fallback: 'Salida', mostrar: true }
        ]);
    }
    notify.avisarFichaje(_mensajeExitoSalida(reg, usaHoraActual, timerDetenido, s), 'success');
    notify.resetearBoton(btn);
    $('fecha').value = TimeUtils.obtenerFechaHoy();
    $('salida').value = '';
}

function _sincronizarPushHoy() {
    const hoy = TimeUtils.obtenerFechaHoy();
    const esDiaHabil = TimeUtils.esFechaHabil(hoy, diasHabilesEnFecha(hoy));
    const abierto = esDiaHabil && AppState.registros().find(r => r.fecha === hoy && r.entrada && !r.salida);
    const habilitado = PushReminder.getHabilitado();
    const minutosTF = abierto && !AppState.getIgnorarTiempoFuera() && abierto.tiempoFuera ? TimeUtils.horaAMinutos(abierto.tiempoFuera) : 0;
    const nuevoTarget = (habilitado && abierto)
        ? PushReminder.calcularTarget(abierto.entrada, objetivoDeRegistro(abierto), _bufferSemanalParaPush(hoy), minutosTF)
        : null;
    const targetActual = PushReminder.targetProgramadoParaHoy();
    if (nuevoTarget === targetActual) return;

    if (abierto && nuevoTarget != null) {
        PushReminder.programarFinDeJornada(abierto.fecha, abierto.entrada, objetivoDeRegistro(abierto), _bufferSemanalParaPush(hoy), minutosTF);
    } else if (targetActual != null) {
        PushReminder.cancelarFinDeJornada(hoy);
    }
}

AppState.setSincronizarPushHoyHook(_sincronizarPushHoy);

function _bufferSemanalActual() {
    const { inicio: iniSemana } = TimeUtils.obtenerSemanaRangoActual();
    return calcularBufferPeriodo(iniSemana, TimeUtils.obtenerFechaHoy(), false, 0, _calcularAsignacionesCompensatorio());
}

function _ultimoDiaHabilEfectivoSemana() {
    const { fin } = TimeUtils.obtenerSemanaRangoActual();
    let fecha = fin;
    for (let i = 0; i < 7; i++) {
        if (TimeUtils.esFechaHabil(fecha, diasHabilesEnFecha(fecha))) {
            const reg = registroPorFecha(fecha);
            const esEspecial = reg && TiposRegistro.esRegistroEspecial(reg.entrada, reg.salida);
            if (!esEspecial) return fecha;
        }
        const d = TimeUtils.parsearFechaLocal(fecha);
        d.setDate(d.getDate() - 1);
        fecha = TimeUtils.formatearFechaLocal(d);
    }
    return null;
}

function _bufferSemanalParaPush(fecha) {
    const buffer = _bufferSemanalActual();
    if (!PushReminder.getUsarBufferSemanal() || !PushReminder.getBufferSoloUltimoDia()) return buffer;
    return fecha === _ultimoDiaHabilEfectivoSemana() ? buffer : 0;
}

async function _crearNuevoRegistro(f, e, s, usaHoraActual, btn) {
    const notify = AppState._notify();
    if (!_hayEspacioParaRegistros(1)) {
        notify.avisarFichaje('Límite alcanzado', 'error', { btn }); return;
    }
    const nuevo = _construirRegistro(f, e, s);
    const registros = AppState.registros();
    registros.push(nuevo);
    ordenarRegistros();
    const esHoy = e && f === TimeUtils.obtenerFechaHoy();
    const detalleAccion = e && s ? `entrada ${e} y salida ${s}` : e ? `entrada ${e}` : `salida ${s}`;
    HistoryManager.saveState(registros, `${detalleAccion} (${TimeUtils.fechaCorta(f)})`);
    const saved = await _guardarConCicloSiHoy(nuevo.id, esHoy, 'entrada');
    if (!saved) {
        notify.avisarFichaje(null, 'error', { btn });
        return;
    }
    if (esHoy && !s && TimeUtils.esFechaHabil(f, diasHabilesEnFecha(f))) {
        const bufferSemanal = _bufferSemanalParaPush(f);
        PushReminder.programarFinDeJornada(nuevo.fecha, nuevo.entrada, nuevo.objetivoHoras, bufferSemanal);
    }
    const entradaManual = e && !usaHoraActual, salidaManual = s && !usaHoraActual;
    if (entradaManual || salidaManual) {
        notify.aplicarFeedbackCampos([
            { id: 'entrada', fallback: 'Entrada', mostrar: entradaManual },
            { id: 'salida', fallback: 'Salida', mostrar: salidaManual }
        ]);
    }
    notify.avisarFichaje(usaHoraActual ? 'Registro agregado con hora actual' : 'Registro agregado', 'success');
    notify.resetearBoton(btn);
    $('fecha').value = TimeUtils.obtenerFechaHoy();
    $('entrada').value = ''; $('salida').value = '';
}

async function agregarRegistro() {
    const notify = AppState._notify();
    if (!validarFormulario()) { notify.avisarFichaje('Verificá los campos'); return; }

    const btn = $('btn-agregar');
    btn.disabled = true;
    let usaHoraActual = false;
    let f = S.sanitizeString($('fecha').value, 10);
    let e = S.sanitizeString($('entrada').value.trim(), 5);
    let s = S.sanitizeString($('salida').value.trim(), 5);

    if (_fechaFuturaInvalida(f, e, s)) {
        notify.mostrarError('fecha', null);
        notify.avisarFichaje('Fecha futura no permitida en registro regular', 'warning', { btn }); return;
    }

    const hoy = TimeUtils.obtenerFechaHoy();
    if (!e && f === hoy) {
        const { ayerStr: ayer, ayerAbierto } = detectarAyerAbierto(hoy, AppState.registros());
        if (ayerAbierto && !existeRegistroEnFecha(hoy)) { f = ayer; $('fecha').value = f; }
    }

    const registroExistente = registroPorFecha(f);

    if (!e && !s) {
        const horaActual = TimeUtils.obtenerHoraActual();
        if (registroExistente?.entrada && !registroExistente.salida) {
            s = horaActual; $('salida').value = s;
        } else {
            e = horaActual; $('entrada').value = e;
        }
        usaHoraActual = true;
    }

    if (!e && s) {
        if (registroExistente?.salida) { notify.avisarFichaje('Ya existe un registro completo para esta fecha', 'error', { btn }); return; }
        if (!registroExistente?.entrada) { notify.avisarFichaje('Debés fichar una entrada primero', 'error', { btn }); return; }
    }

    if (registroExistente?.entrada && !registroExistente.salida && !e && s) {
        await _completarSalidaRegistro(registroExistente, s, usaHoraActual, btn); return;
    }

    if (registroExistente) {
        if (usaHoraActual) $('entrada').value = '';
        notify.avisarFichaje('Ya existe un registro para esta fecha', 'error', { btn }); return;
    }

    await _crearNuevoRegistro(f, e, s, usaHoraActual, btn);
}

async function eliminarRegistroActual() {
    const editandoId = AppState.editandoId();
    if (editandoId) {
        const notify = AppState._notify();
        const modal = $('modal-editar');
        const btnEliminar = modal.querySelector('.btn-delete');
        btnEliminar.disabled = true;
        const registroABorrar = registroPorId(editandoId);
        const hoy = TimeUtils.obtenerFechaHoy();

        if (registroABorrar && registroABorrar === registroParaTiempoFuera(hoy)) {
            const perfilId = AppState.obtenerPerfilIdActual();
            const storageKey = STORAGE_KEYS.BREAK_TIME(perfilId);
            if (StorageHelper.getItem(storageKey)) {
                StorageHelper.removeItem(storageKey);
                notify.mostrarToast('Timer detenido al borrar el registro', 'info');
            }
        }

        AppState._setRegistros(AppState.registros().filter(r => r.id !== editandoId));
        _sincronizarPushHoy();
        HistoryManager.saveState(AppState.registros(), `eliminar registro${registroABorrar ? ` (${TimeUtils.fechaCorta(registroABorrar.fecha)})` : ''}`);

        const saved = await guardarYActualizar();
        btnEliminar.disabled = false;
        btnEliminar.innerHTML = '<svg class="icon"><use href="#icon-trash"/></svg> Eliminar';

        if (saved) {
            notify.mostrarToast('Registro eliminado', 'success');
            notify.cerrarEdicion();
            notify.actualizarEstadoBotonTimerMain();
        }
    }
}

function editarRegistro(id) {
    if (AppState.editandoId() !== null) return;
    const r = registroPorId(id);
    if (!r) return;

    const notify = AppState._notify();
    const horasDiarias = AppState.horasDiarias();
    AppState.setEditandoId(id);
    $('edit-fecha').value = r.fecha;
    $('edit-entrada').value = r.entrada || '';
    $('edit-salida').value = r.salida || '';
    $('edit-tiempo-fuera').value = r.tiempoFuera || '';
    $('edit-notas').value = r.notas || '';

    const objetivoActual = (typeof r.objetivoHoras === 'number' && Number.isFinite(r.objetivoHoras)) ? r.objetivoHoras : horasDiarias;
    const elObjetivo = $('edit-objetivo');
    if (elObjetivo) {
        elObjetivo.dataset.valor = objetivoActual;
        elObjetivo.textContent = TimeUtils.horasATexto(objetivoActual, 'short');
    }

    const elRef = $('edit-referencia-compensatorio');
    if (elRef) {
        const esCompensatorio = TiposRegistro.obtenerTipoPorCodigo(r.entrada, r.salida)?.id === 'compensatorio';
        setColapsable($('grupo-referencia-compensatorio'), esCompensatorio, { animar: false });
        elRef.value = esCompensatorio ? (r.referenciaCompensatorio || '') : '';
    }

    const btnCredito = document.getElementById('btn-toggle-credito');

    if (r.credito && r.credito !== '00:00') {
        btnCredito.dataset.activo = "true";
        btnCredito.classList.add('btn-activo');
    } else {
        btnCredito.dataset.activo = "false";
        btnCredito.classList.remove('btn-activo');
    }

    notify.setBloqueoEdicion(true);
    notify.abrirModal('modal-editar');

    requestAnimationFrame(() => {
        notify.verificarBloqueoCredito();
        const hintEl = document.getElementById('edit-hint-resumen');
        if (hintEl) document.getElementById('edit-entrada').dispatchEvent(new Event('input'));
    });
}

function pegarReferenciaAutomatica() {
    const editandoId = AppState.editandoId();
    const elRef = $('edit-referencia-compensatorio');
    if (!elRef || editandoId === null) return;

    if (elRef.value) {
        elRef.value = '';
    } else {
        const f = S.sanitizeString($('edit-fecha').value, 10);
        const e = S.sanitizeString($('edit-entrada').value.trim(), 5);
        const s = S.sanitizeString($('edit-salida').value.trim(), 5);
        const listaSinManual = AppState.registros().map(x => x.id === editandoId
            ? { ...x, fecha: f, entrada: e || null, salida: s || null, referenciaCompensatorio: undefined }
            : x);
        const asignaciones = _calcularAsignacionesCompensatorio(listaSinManual);
        const asignacion = asignaciones.find(a => a.compensatorioId === editandoId);
        elRef.value = asignacion?.referenciaFecha || '';
    }
    elRef.dispatchEvent(new Event('input'));
}

function _validarCamposEdicion(f, e, s, tf) {
    if (_fechaFuturaInvalida(f, e, s))
        return { msg: 'Fecha futura no permitida en registro regular', tipo: 'warning' };

    if (!TimeUtils.validarFecha(f))
        return { msg: 'Fecha inválida', tipo: 'error' };
    if (e && !TimeUtils.validarHora(e))
        return { msg: 'Hora de entrada inválida', tipo: 'error' };
    if (s && !TimeUtils.validarHora(s))
        return { msg: 'Hora de salida inválida', tipo: 'error' };
    if (tf && !TimeUtils.validarHora(tf))
        return { msg: 'Tiempo fuera inválido', tipo: 'error' };
    if (!e && s)
        return { msg: 'Debés fichar una entrada', tipo: 'error' };

    const editandoId = AppState.editandoId();
    if (AppState.registros().some(reg => reg.fecha === f && reg.id !== editandoId))
        return { msg: 'Ya existe otro registro para esa fecha', tipo: 'error' };

    if (e && tf) {
        const minutosEntrada = TimeUtils.horaAMinutos(e);
        const minutosFuera = TimeUtils.horaAMinutos(tf);
        const minutosLimite = s
            ? TimeUtils.horaAMinutos(s)
            : TimeUtils.horaAMinutos(TimeUtils.obtenerHoraActual());
        let tiempoTranscurrido = minutosLimite - minutosEntrada;
        if (tiempoTranscurrido < 0) tiempoTranscurrido += 24 * 60;
        if (minutosFuera > tiempoTranscurrido)
            return {
                msg: s
                    ? 'El tiempo fuera no puede superar el tiempo efectivo'
                    : 'El tiempo fuera no puede superar el tiempo transcurrido desde la entrada',
                tipo: 'error'
            };
    }

    return null;
}

function _calcularCredito(e, s, tf, objetivo = AppState.horasDiarias()) {
    const btn = document.getElementById('btn-toggle-credito');
    if (!btn || btn.dataset.activo !== 'true') return null;
    const calc = calcularHoras(e, s, tf, null);
    if (!calc) return null;
    const diferencia = objetivo - calc.total;
    if (diferencia <= 0.01) return null;
    const { horas: h, minutos: m } = TimeUtils.descomponerHorasDecimales(diferencia);
    return TimeUtils.minutosAHora(h * 60 + m);
}

async function _eliminarRegistroVacioDesdeEdicion(btnGuardar) {
    const editandoId = AppState.editandoId();
    const notify = AppState._notify();
    const reg = registroPorId(editandoId);
    if (reg?.fecha === TimeUtils.obtenerFechaHoy()) {
        const perfilId = AppState.obtenerPerfilIdActual();
        StorageHelper.removeItem(STORAGE_KEYS.BREAK_TIME(perfilId));
        notify.actualizarEstadoBotonTimerMain();
    }
    AppState._setRegistros(AppState.registros().filter(r => r.id !== editandoId));
    _sincronizarPushHoy();
    HistoryManager.saveState(AppState.registros(), `eliminar registro vacío${reg ? ` (${TimeUtils.fechaCorta(reg.fecha)})` : ''}`);
    const saved = await guardarYActualizar();
    notify.restaurarBotonGuardarEdicion(btnGuardar);
    if (saved) { notify.mostrarToast('Registro eliminado (vacío)', 'info'); notify.cerrarEdicion(); }
}

async function guardarEdicion() {
    const editandoId = AppState.editandoId();
    const r = registroPorId(editandoId);
    if (!r) return;
    const notify = AppState._notify();
    const horasDiarias = AppState.horasDiarias();
    const btnGuardar = $('modal-editar').querySelector('.btn-edit');
    btnGuardar.disabled = true;

    const f = S.sanitizeString($('edit-fecha').value, 10);
    const e = S.sanitizeString($('edit-entrada').value.trim(), 5);
    const s = S.sanitizeString($('edit-salida').value.trim(), 5);
    let tf = S.sanitizeString($('edit-tiempo-fuera').value.trim(), 5) || null;
    tf = tf ? TimeUtils.normalizarMinutosSueltos(tf) : tf;
    let notas = S.sanitizeString($('edit-notas').value.trim(), S.SECURITY_LIMITS.MAX_NOTAS_LENGTH);
    if (notas) notas = S.sanitizeNotas(notas, true) || null;
    if (notas === '') notas = null;

    let objetivoNuevo = parseFloat($('edit-objetivo')?.dataset.valor);
    if (!_esObjetivoValido(objetivoNuevo)) objetivoNuevo = horasDiarias;
    const objetivoPrevio = (typeof r.objetivoHoras === 'number' && Number.isFinite(r.objetivoHoras)) ? r.objetivoHoras : horasDiarias;

    const esCompensatorioNuevo = TiposRegistro.obtenerTipoPorCodigo(e, s)?.id === 'compensatorio';
    let referenciaCompensatorioNueva;
    if (esCompensatorioNuevo) {
        const refInput = S.sanitizeString($('edit-referencia-compensatorio')?.value || '', 10);
        referenciaCompensatorioNueva = TimeUtils.validarFecha(refInput) ? refInput : undefined;

        if (referenciaCompensatorioNueva) {
            if (referenciaCompensatorioNueva > f) {
                notify.restaurarBotonGuardarEdicion(btnGuardar);
                notify.mostrarToast('El día a compensar no puede ser posterior al compensatorio', 'error');
                return;
            }
            const asignacionesActuales = _calcularAsignacionesCompensatorio();
            const yaUsadoPorOtro = asignacionesActuales.find(a => a.compensatorioId !== r.id && a.referenciaFecha === referenciaCompensatorioNueva);
            if (yaUsadoPorOtro) {
                notify.restaurarBotonGuardarEdicion(btnGuardar);
                notify.mostrarToast(`Ese día ya está asignado al compensatorio del ${TimeUtils.fechaCorta(yaUsadoPorOtro.compensatorioFecha)}`, 'error');
                return;
            }
            const listaSimulada = AppState.registros().map(x => x.id === r.id
                ? { ...x, fecha: f, entrada: e || null, salida: s || null, referenciaCompensatorio: referenciaCompensatorioNueva }
                : x);
            const asigTest = _calcularAsignacionesCompensatorio(listaSimulada);
            const resuelto = _buscarAsignacionCompensatorio(r.id, 'compensatorioId', asigTest);
            if (!resuelto?.referenciaFecha) {
                notify.restaurarBotonGuardarEdicion(btnGuardar);
                notify.mostrarToast('Ese día no tiene excedente disponible (o ya fue usado por otro compensatorio)', 'error');
                return;
            }
        }
    }

    let cr = _calcularCredito(e, s, tf, objetivoEdicionEnVivo());

    if (r.fecha === f && (r.entrada || '') === (e || '') && (r.salida || '') === (s || '') &&
        (r.tiempoFuera || '') === (tf || '') && (r.credito || '') === (cr || '') && (r.notas || '') === (notas || '') &&
        objetivoNuevo === objetivoPrevio && (r.referenciaCompensatorio || '') === (referenciaCompensatorioNueva || '')) {
        notify.mostrarToast('Sin cambios', 'info');
        notify.restaurarBotonGuardarEdicion(btnGuardar);
        notify.cerrarEdicion();
        return;
    }

    if (!e && !s) { await _eliminarRegistroVacioDesdeEdicion(btnGuardar); return; }

    const camposError = _validarCamposEdicion(f, e, s, tf);
    if (camposError) {
        notify.restaurarBotonGuardarEdicion(btnGuardar);
        notify.mostrarToast(camposError.msg, camposError.tipo);
        return;
    }

    r.fecha = f; r.entrada = e || null;
    if (s && !(r.salida || '')) {
        const timerDetenido = detenerYRegistrarTimer(r);
        if (timerDetenido) {
            tf = r.tiempoFuera;
            cr = _calcularCredito(e, s, tf, objetivoEdicionEnVivo());
        }
    }
    r.salida = s || null; r.tiempoFuera = tf; r.credito = cr; r.notas = notas; r.objetivoHoras = objetivoNuevo;
    if (referenciaCompensatorioNueva) r.referenciaCompensatorio = referenciaCompensatorioNueva;
    else delete r.referenciaCompensatorio;

    _aplicarCalculoHoras(r, r.entrada, r.salida, r.tiempoFuera, r.credito);

    ordenarRegistros();
    HistoryManager.saveState(AppState.registros(), `editar registro (${TimeUtils.fechaCorta(f)})`);
    const saved = await guardarYActualizar(r.id, true);
    notify.restaurarBotonGuardarEdicion(btnGuardar);
    if (saved) {
        _sincronizarPushHoy();
        notify.mostrarToast(cr ? `Guardado con Salida Temprana (+${cr})` : 'Registro actualizado', 'success');
        notify.cerrarEdicion();
    }
}

async function borrarTodoHistorial() {
    const registros = AppState.registros();
    const totalRegistros = registros.length;
    const confirmar = await AppState._notify().confirmarModal(`Esto restablecerá el perfil activo: se eliminarán ${totalRegistros} registro${TimeUtils.pluralizar(totalRegistros)} y la configuración volverá a los valores por defecto. No afecta otros perfiles.`, 'Restablecer');
    if (!confirmar) return;

    AppState.setDiasHabiles([1, 2, 3, 4, 5]);
    AppState.setHorasDiarias(7);
    AppState._setHistorialDiasHabilesRaw([]);
    registros.splice(0, registros.length);
    AppState.setIgnorarTiempoFuera(false);
    PushReminder.restablecer();

    const perfilId = AppState.obtenerPerfilIdActual();
    StorageHelper.removeItem(STORAGE_KEYS.BREAK_TIME(perfilId));
    const keys = [STORAGE_KEYS.FONDO_CARD, STORAGE_KEYS.IGNORAR_TF, STORAGE_KEYS.IGNORAR_LOGICA_CUBIERTO, STORAGE_KEYS.IGNORAR_OBJETIVO_POR_REGISTRO, 'cardVisible_registrar', 'cardVisible_estadisticas', 'cardVisible_historico', STORAGE_KEYS.ORDEN_CARDS, STORAGE_KEYS.BIENVENIDA_VISTA, STORAGE_KEYS.FERIADOS_PROCESADOS];
    keys.forEach(k => StorageHelper.removeItem(k, true));

    if (PerfilManager) {
        const perfil = PerfilManager.obtenerDatosPerfil();
        if (perfil) {
            ['gistLastSync', 'gistAutoSync', 'gistRangoDesde', 'gistRangoHasta', 'gistSyncFecha_subir', 'gistSyncCount_subir', 'gistSyncFecha_bajar', 'gistSyncCount_bajar', 'gistMergeBehavior'].forEach(k => delete perfil[k]);
        }
    }

    HistoryManager.saveState(registros, `restablecer perfil (${totalRegistros} registro${TimeUtils.pluralizar(totalRegistros)})`);
    if (await guardarYActualizar()) location.reload();
}

function _aplicarEstadoHistorial(resultado, mensaje) {
    if (!resultado?.estado) return;
    const registros = AppState.registros();
    registros.splice(0, registros.length, ...resultado.estado);
    registros.forEach(r => {
        if (r.entrada && r.salida && !TiposRegistro.esRegistroEspecial(r.entrada, r.salida)) {
            _recalcularHorasSiValido(r);
        }
    });
    _sincronizarPushHoy();
    guardarYActualizar(null, true);
    const notify = AppState._notify();
    notify.mostrarToast(mensaje, 'info', undefined, resultado.descripcion);
    notify.iniciarTimerAutoCierreBotones();
}

export const DataManagement = {
    registros: AppState.registros,
    horasSemanales: AppState.horasSemanales,
    diasHabiles: AppState.diasHabiles,
    horasDiarias: AppState.horasDiarias,
    setDiasHabiles: AppState.setDiasHabiles,
    setHorasDiarias: AppState.setHorasDiarias,
    registroPorFecha,
    registroPorId,
    existeRegistroEnFecha,
    historialDiasHabiles: AppState.historialDiasHabiles,
    setHistorialDiasHabiles: (v) => {
        const arr = Array.isArray(v) ? v : [];
        AppState._setHistorialDiasHabilesRaw(arr);
        if (arr.length > 0) AppState.setDiasHabiles(diasHabilesEnFecha(TimeUtils.obtenerFechaHoy()));
    },
    diasHabilesEnFecha,
    registrarCambioDiasHabiles,
    sanitizarHistorialDiasHabiles: _sanitizarHistorialDiasHabiles,
    getIgnorarTiempoFuera: AppState.getIgnorarTiempoFuera,
    setIgnorarTiempoFuera: AppState.setIgnorarTiempoFuera,
    objetivoDeRegistro,
    objetivoEdicionEnVivo,
    migrarObjetivoHorasFaltante,
    aplicarHorasATodosLosRegistros,
    esTipoRemoto,
    horasEfectivasDeRegistro,
    montoCompensadoPorRegistro: _montoCompensadoPorRegistro,
    fechaCompensadaPorRegistro: _fechaCompensadaPorRegistro,
    fechaCompensadoDeRegistro: _fechaCompensadoDeRegistro,
    montoCompensadoDeReferencia: _montoCompensadoDeReferencia,
    calcularAsignacionesCompensatorio: _calcularAsignacionesCompensatorio,
    recalcularTotalesEnMemoria: function (recalcularCreditos = false) {
        AppState.registros().forEach(r => {
            if (r.entrada && r.salida && !TiposRegistro.esRegistroEspecial(r.entrada, r.salida)) {
                if (recalcularCreditos && r.credito) _recalcularCreditoRegistro(r, objetivoDeRegistro(r));
                else _recalcularHorasSiValido(r);
            }
        });
    },
    editandoId: AppState.editandoId,
    setEditandoId: AppState.setEditandoId,
    vistaActual: AppState.vistaActual,
    setVistaActual: AppState.setVistaActual,
    cargarConfiguracion,
    KEYS_CONFIG_EXPORTABLE,
    obtenerConfigExportable,
    validarCamposConfigImport,
    aplicarConfigImportada,
    calcularCambiosConfigImport,
    calcularHoras,
    normalizarRegistrosImportados,
    guardarYActualizar,
    agregarRegistro,
    eliminarRegistroActual,
    editarRegistro,
    guardarEdicion,
    pegarReferenciaAutomatica,
    borrarTodoHistorial,
    exportarJSON,
    importarDatos,
    calcularBufferPeriodo,
    detectarAyerAbierto,
    registroParaTiempoFuera,
    aplicarFiltrosInmediato,
    limpiarFiltros,
    obtenerRegistrosFiltrados,
    registrarVacacionesDirecto,
    borrarPeriodoDirecto,
    registrarDiaEspecial,
    editarGrupo,
    guardarEdicionGrupo,
    eliminarGrupoActual,
    setGrupoEnEdicion: AppState.setGrupoEnEdicion,
    sincronizarPushHoy: _sincronizarPushHoy,
    bufferSemanalParaPush: _bufferSemanalParaPush,
    undoAction: function () { _aplicarEstadoHistorial(HistoryManager.undo(), 'Deshecho'); },
    redoAction: function () { _aplicarEstadoHistorial(HistoryManager.redo(), 'Rehecho'); },
    configurarNotificaciones: AppState.configurarNotificaciones,
    _notify: AppState._notify,
    _setRegistros: AppState._setRegistros,
    _setHistorialDiasHabilesRaw: AppState._setHistorialDiasHabilesRaw,
    _ordenarRegistros: ordenarRegistros,
    _hayEspacioParaRegistros,
    _aplicarCalculoHoras,
    _recalcularHorasSiValido
};
