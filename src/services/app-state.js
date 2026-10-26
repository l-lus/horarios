import { TimeUtils } from '../core/time-utils.js';
import { SecurityAndUtils as S } from '../core/security.js';
import { TiposRegistro } from './tipos-registro.js';

// ====================================================================
// CENTRAL APPLICATION STATE & BASE RECORD CALCULATIONS MODULE
// ====================================================================
let notify = {
    abrirModal: () => { },
    actualizarEstadoBotonTimerMain: () => { },
    actualizarHintGrupo: () => { },
    actualizarUI: () => { },
    aplicarFeedbackCampos: () => { },
    avisarFichaje: () => { },
    cerrarEdicion: () => { },
    cerrarEdicionGrupo: () => { },
    cerrarFiltros: () => { },
    cerrarImportar: () => { },
    cerrarTodosModales: () => { },
    confirmarModal: async () => false,
    descargarJSON: () => { },
    forzarVista: (vista, fn) => fn(),
    iniciarTimerAutoCierreBotones: () => { },
    limpiarError: () => { },
    mostrarError: () => { },
    mostrarToast: () => { },
    obtenerNombrePerfilSafe: () => '',
    prepararMostrarFaseAlRenderizar: () => { },
    refrescarConfigSiVisible: () => { },
    resetearBoton: () => { },
    restaurarBotonGuardarEdicion: () => { },
    setBloqueoEdicion: () => { },
    setBloqueoEdicionGrupo: () => { },
    temaGuardado: () => 'claro',
    verificarBloqueoCredito: () => { },
};

function configurarNotificaciones(handlers) {
    notify = { ...notify, ...handlers };
}

let registros = [];
let diasHabiles = [1, 2, 3, 4, 5];
let horasDiarias = 7;
let editandoId = null;
let vistaActual = 'diaria';
let ignorarTiempoFuera = false;
let historialDiasHabiles = [];
let filtroActivo = false;
let filtroDesde = null;
let filtroHasta = null;
let filtroTipo = null;
let grupoEnEdicion = null;

let _perfilHooks = {
    obtenerPerfilActual: () => 'default',
    guardarDatosPerfilActual: null
};
let _sincronizarPushHoyFn = () => { };

function setPerfilHooks(hooks) {
    _perfilHooks = { ..._perfilHooks, ...hooks };
}

function setSincronizarPushHoyHook(fn) {
    if (typeof fn === 'function') _sincronizarPushHoyFn = fn;
}

function obtenerPerfilIdActual() {
    return _perfilHooks.obtenerPerfilActual ? _perfilHooks.obtenerPerfilActual() : 'default';
}

function ordenarRegistros() {
    registros.sort((a, b) => {
        if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha);
        return (b.entrada || '').localeCompare(a.entrada || '');
    });
}

function registroPorFecha(fecha) { return registros.find(r => r.fecha === fecha); }
function registroPorId(id) { return registros.find(r => r.id === id); }
function existeRegistroEnFecha(fecha) { return registros.some(r => r.fecha === fecha); }

function _hayEspacioParaRegistros(cantidadAAgregar = 1) {
    return (registros.length + cantidadAAgregar) <= S.SECURITY_LIMITS.MAX_REGISTROS;
}

function _fechaFuturaInvalida(fecha, entrada, salida) {
    return fecha > TimeUtils.obtenerFechaHoy() && !TiposRegistro.esRegistroEspecial(entrada, salida);
}

function calcularHoras(e, s, tf = null, cr = null, esCalculoTemporal = false) {
    const tfEfectivo = ignorarTiempoFuera ? null : tf;
    const tfMinutos = tfEfectivo ? TimeUtils.horaAMinutos(tfEfectivo) : 0;
    const crMinutos = cr ? TimeUtils.horaAMinutos(cr) : 0;

    if (!esCalculoTemporal) {
        const tipoEspecial = TiposRegistro.obtenerTipoPorCodigo(e, s);
        if (tipoEspecial) {
            const resultado = { horas: 0, minutos: 0, total: horasDiarias };
            resultado[`es${tipoEspecial.label}`] = true;
            return resultado;
        }
    }

    if (!e || !s || !e.includes(':') || !s.includes(':')) return null;
    const [hE, mE] = e.split(':').map(Number);
    const [hS, mS] = s.split(':').map(Number);

    if (!Number.isFinite(hE) || !Number.isFinite(mE) || !Number.isFinite(hS) || !Number.isFinite(mS)) return null;

    const minutosEntrada = hE * 60 + mE;
    const minutosSalida = hS * 60 + mS;
    let minTotal = minutosSalida - minutosEntrada;
    if (minTotal < 0) minTotal += 24 * 60;
    let minNeto = (minTotal - tfMinutos) + crMinutos;
    if (minNeto < 0) minNeto = 0;

    return { horas: Math.floor(minNeto / 60), minutos: minNeto % 60, total: minNeto / 60 };
}

function _aplicarCalculoHoras(r, e, s, tf = null, cr = null, calcularFn = calcularHoras) {
    const t = calcularFn(e, s, tf, cr);
    r.horas = t?.horas || 0; r.minutos = t?.minutos || 0; r.total = t?.total || 0;
    return t;
}

function _recalcularHorasSiValido(r, e = r.entrada, s = r.salida, tf = r.tiempoFuera || null, cr = r.credito || null) {
    const t = calcularHoras(e, s, tf, cr);
    if (t) { r.horas = t.horas; r.minutos = t.minutos; r.total = t.total; }
    return t;
}

function _construirRegistro(fecha, entrada, salida) {
    const e = entrada || null, s = salida || null;
    const t = calcularHoras(e, s, null);
    return {
        id: S.generarIDSeguro(), fecha, entrada: e, salida: s, tiempoFuera: null,
        horas: t?.horas || 0, minutos: t?.minutos || 0, total: t?.total || 0, objetivoHoras: horasDiarias
    };
}

async function guardarYActualizar(idNuevo = null, animarCard = false) {
    let saveSuccessful = false;
    try {
        if (typeof _perfilHooks.guardarDatosPerfilActual === 'function') {
            saveSuccessful = _perfilHooks.guardarDatosPerfilActual();
        } else {
            saveSuccessful = true;
        }
    } catch (e) {
        console.error('Error crítico al guardar:', e);
        saveSuccessful = false;
    }
    if (saveSuccessful) { notify.actualizarUI(idNuevo, false, animarCard); }
    else { notify.mostrarToast('Error al guardar. Almacenamiento lleno o bloqueado.', 'error'); }
    return saveSuccessful;
}

async function _guardarConCicloSiHoy(idOrIds, esHoy, fase = null) {
    const ejecutar = async () => {
        if (esHoy && fase) notify.prepararMostrarFaseAlRenderizar(fase);
        const ok = await guardarYActualizar(idOrIds);
        if (!ok && esHoy && fase) notify.prepararMostrarFaseAlRenderizar(null);
        return ok;
    };
    return esHoy && vistaActual === 'semana'
        ? notify.forzarVista('diaria', ejecutar)
        : ejecutar();
}

export const AppState = {
    configurarNotificaciones,
    _notify: () => notify,
    setPerfilHooks,
    setSincronizarPushHoyHook,
    sincronizarPushHoy: (...args) => _sincronizarPushHoyFn(...args),
    obtenerPerfilIdActual,
    registros: () => registros,
    _setRegistros: (v) => { registros = v; },
    diasHabiles: () => diasHabiles,
    setDiasHabiles: (v) => { diasHabiles = v; },
    horasDiarias: () => horasDiarias,
    setHorasDiarias: (v) => { horasDiarias = v; },
    horasSemanales: () => (horasDiarias * diasHabiles.length),
    historialDiasHabiles: () => historialDiasHabiles,
    _setHistorialDiasHabilesRaw: (v) => { historialDiasHabiles = v; },
    editandoId: () => editandoId,
    setEditandoId: (id) => { editandoId = id; },
    vistaActual: () => vistaActual,
    setVistaActual: (v) => { vistaActual = v; },
    getIgnorarTiempoFuera: () => ignorarTiempoFuera,
    setIgnorarTiempoFuera: (v) => { ignorarTiempoFuera = v; },
    getFiltroState: () => ({ filtroActivo, filtroDesde, filtroHasta, filtroTipo }),
    setFiltroState: ({ activo, desde, hasta, tipo }) => {
        filtroActivo = !!activo;
        filtroDesde = desde ?? null;
        filtroHasta = hasta ?? null;
        filtroTipo = tipo ?? null;
    },
    getGrupoEnEdicion: () => grupoEnEdicion,
    setGrupoEnEdicion: (val) => { grupoEnEdicion = val; },
    ordenarRegistros,
    _ordenarRegistros: ordenarRegistros,
    registroPorFecha,
    registroPorId,
    existeRegistroEnFecha,
    _hayEspacioParaRegistros,
    _fechaFuturaInvalida,
    calcularHoras,
    _aplicarCalculoHoras,
    _recalcularHorasSiValido,
    _construirRegistro,
    guardarYActualizar,
    _guardarConCicloSiHoy
};
