import { STORAGE_KEYS } from '../core/constantes.js';
import { TiempoUtils } from '../core/tiempo-utils.js';
import { Almacenamiento } from '../core/almacenamiento.js';
import { SeguridadYUtils as S } from '../core/seguridad.js';
import { EstadoApp } from './estado-app.js';
import { Compensatorios } from './compensatorios.js';
import { FiltrosYPeriodos } from './filtros-periodos.js';
import { GestorHistorial } from './gestor-historial.js';
import { TiposRegistro } from './tipos-registro.js';
import { AvisoJornada } from './aviso-jornada.js';

// ====================================================================
//              RECORD EDITING (modal "Editar" de un registro)
// ====================================================================
// Abrir, guardar (con validaciones, salida temprana y referencia de compensatorio), eliminar y referencia automática.
// Lee y escribe el formulario solo por el puerto notify.formularioEdicion (lo implementa ui/formularios.js).
const {
    ordenarRegistros, registroPorId, _fechaFuturaInvalida, calcularHoras, _aplicarCalculoHoras, guardarYActualizar
} = EstadoApp;
const {
    _esObjetivoValido, objetivoGuardado, calcularAsignacionesCompensatorio, _buscarAsignacionCompensatorio, objetivoEdicionEnVivo
} = Compensatorios;
const { detenerYRegistrarTimer, registroParaTiempoFuera } = FiltrosYPeriodos;

async function eliminarRegistroActual() {
    const editandoId = EstadoApp.editandoId();
    if (editandoId) {
        const notify = EstadoApp._notify();
        const btnEliminar = notify.formularioEdicion.bloquearEliminar();
        const registroABorrar = registroPorId(editandoId);
        const hoy = TiempoUtils.obtenerFechaHoy();

        if (registroABorrar && registroABorrar === registroParaTiempoFuera(hoy)) {
            const perfilId = EstadoApp.obtenerPerfilIdActual();
            const storageKey = STORAGE_KEYS.BREAK_TIME(perfilId);
            if (Almacenamiento.getItem(storageKey)) {
                Almacenamiento.removeItem(storageKey);
                notify.mostrarToast('Timer detenido al borrar el registro', 'info');
            }
        }

        EstadoApp._setRegistros(EstadoApp.registros().filter(r => r.id !== editandoId));
        AvisoJornada.sincronizarHoy();
        GestorHistorial.saveState(EstadoApp.registros(), `eliminar registro${registroABorrar ? ` (${TiempoUtils.fechaCorta(registroABorrar.fecha)})` : ''}`);

        const saved = await guardarYActualizar();
        notify.formularioEdicion.liberarEliminar(btnEliminar);

        if (saved) {
            notify.mostrarToast('Registro eliminado', 'success');
            notify.cerrarEdicion();
            notify.actualizarEstadoBotonTimerMain();
        }
    }
}

function editarRegistro(id) {
    if (EstadoApp.editandoId() !== null) return;
    const r = registroPorId(id);
    if (!r) return;

    const notify = EstadoApp._notify();
    EstadoApp.setEditandoId(id);
    const objetivoActual = objetivoGuardado(r);
    notify.formularioEdicion.poblar({
        fecha: r.fecha,
        entrada: r.entrada || '',
        salida: r.salida || '',
        tiempoFuera: r.tiempoFuera || '',
        notas: r.notas || '',
        objetivo: objetivoActual,
        esCompensatorio: TiposRegistro.obtenerTipoPorCodigo(r.entrada, r.salida)?.id === 'compensatorio',
        referencia: r.referenciaCompensatorio || '',
        creditoActivo: !!(r.credito && r.credito !== '00:00'),
    });

    notify.setBloqueoEdicion(true);
    notify.abrirModal('modal-editar');

    requestAnimationFrame(() => {
        notify.verificarBloqueoCredito();
        notify.formularioEdicion.refrescarHintResumen();
    });
}

function pegarReferenciaAutomatica() {
    const editandoId = EstadoApp.editandoId();
    const form = EstadoApp._notify().formularioEdicion;
    if (!form.tieneCampoReferencia() || editandoId === null) return;

    const campos = form.leer();
    if (campos.referencia) {
        form.escribirReferencia('');
    } else {
        const { fecha: f, entrada: e, salida: s } = S.limpiarCamposHorario(campos);
        const listaSinManual = EstadoApp.registros().map(x => x.id === editandoId
            ? { ...x, fecha: f, entrada: e || null, salida: s || null, referenciaCompensatorio: undefined }
            : x);
        const asignaciones = calcularAsignacionesCompensatorio(listaSinManual);
        const asignacion = asignaciones.find(a => a.compensatorioId === editandoId);
        form.escribirReferencia(asignacion?.referenciaFecha || '');
    }
}

function _validarCamposEdicion(f, e, s, tf) {
    if (_fechaFuturaInvalida(f, e, s))
        return { msg: 'Fecha futura no permitida en registro regular', tipo: 'warning' };

    if (!TiempoUtils.validarFecha(f))
        return { msg: 'Fecha inválida', tipo: 'error' };
    if (e && !TiempoUtils.validarHora(e))
        return { msg: 'Hora de entrada inválida', tipo: 'error' };
    if (s && !TiempoUtils.validarHora(s))
        return { msg: 'Hora de salida inválida', tipo: 'error' };
    if (tf && !TiempoUtils.validarHora(tf))
        return { msg: 'Tiempo fuera inválido', tipo: 'error' };
    if (!e && s)
        return { msg: 'Debés fichar una entrada', tipo: 'error' };

    const editandoId = EstadoApp.editandoId();
    if (EstadoApp.registros().some(reg => reg.fecha === f && reg.id !== editandoId))
        return { msg: 'Ya existe otro registro para esa fecha', tipo: 'error' };

    if (e && tf) {
        const minutosEntrada = TiempoUtils.horaAMinutos(e);
        const minutosFuera = TiempoUtils.horaAMinutos(tf);
        const minutosLimite = s
            ? TiempoUtils.horaAMinutos(s)
            : TiempoUtils.horaAMinutos(TiempoUtils.obtenerHoraActual());
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

function _calcularCredito(e, s, tf, objetivo = EstadoApp.horasDiarias()) {
    if (!EstadoApp._notify().formularioEdicion.leer().creditoActivo) return null;
    const calc = calcularHoras(e, s, tf, null);
    if (!calc) return null;
    const diferencia = objetivo - calc.total;
    if (diferencia <= 0.01) return null;
    const { horas: h, minutos: m } = TiempoUtils.descomponerHorasDecimales(diferencia);
    return TiempoUtils.minutosAHora(h * 60 + m);
}

async function _eliminarRegistroVacioDesdeEdicion(btnGuardar) {
    const editandoId = EstadoApp.editandoId();
    const notify = EstadoApp._notify();
    const reg = registroPorId(editandoId);
    if (reg?.fecha === TiempoUtils.obtenerFechaHoy()) {
        const perfilId = EstadoApp.obtenerPerfilIdActual();
        Almacenamiento.removeItem(STORAGE_KEYS.BREAK_TIME(perfilId));
        notify.actualizarEstadoBotonTimerMain();
    }
    EstadoApp._setRegistros(EstadoApp.registros().filter(r => r.id !== editandoId));
    AvisoJornada.sincronizarHoy();
    GestorHistorial.saveState(EstadoApp.registros(), `eliminar registro vacío${reg ? ` (${TiempoUtils.fechaCorta(reg.fecha)})` : ''}`);
    const saved = await guardarYActualizar();
    notify.restaurarBotonGuardarEdicion(btnGuardar);
    if (saved) { notify.mostrarToast('Registro eliminado (vacío)', 'info'); notify.cerrarEdicion(); }
}

async function guardarEdicion() {
    const editandoId = EstadoApp.editandoId();
    const r = registroPorId(editandoId);
    if (!r) return;
    const notify = EstadoApp._notify();
    const horasDiarias = EstadoApp.horasDiarias();
    const btnGuardar = notify.formularioEdicion.bloquearGuardar();

    const campos = notify.formularioEdicion.leer();
    const { fecha: f, entrada: e, salida: s } = S.limpiarCamposHorario(campos);
    let tf = S.limpiarTexto(campos.tiempoFuera.trim(), 5) || null;
    tf = tf ? TiempoUtils.normalizarMinutosSueltos(tf) : tf;
    const notas = S.normalizarNotas(campos.notas);

    let objetivoNuevo = campos.objetivo;
    if (!_esObjetivoValido(objetivoNuevo)) objetivoNuevo = horasDiarias;
    const objetivoPrevio = objetivoGuardado(r);

    const esCompensatorioNuevo = TiposRegistro.obtenerTipoPorCodigo(e, s)?.id === 'compensatorio';
    let referenciaCompensatorioNueva;
    if (esCompensatorioNuevo) {
        const refInput = S.limpiarTexto(campos.referencia, 10);
        referenciaCompensatorioNueva = TiempoUtils.validarFecha(refInput) ? refInput : undefined;

        if (referenciaCompensatorioNueva) {
            if (referenciaCompensatorioNueva > f) {
                notify.restaurarBotonGuardarEdicion(btnGuardar);
                notify.mostrarToast('El día a compensar no puede ser posterior al compensatorio', 'error');
                return;
            }
            const asignacionesActuales = calcularAsignacionesCompensatorio();
            const yaUsadoPorOtro = asignacionesActuales.find(a => a.compensatorioId !== r.id && a.referenciaFecha === referenciaCompensatorioNueva);
            if (yaUsadoPorOtro) {
                notify.restaurarBotonGuardarEdicion(btnGuardar);
                notify.mostrarToast(`Ese día ya está asignado al compensatorio del ${TiempoUtils.fechaCorta(yaUsadoPorOtro.compensatorioFecha)}`, 'error');
                return;
            }
            const listaSimulada = EstadoApp.registros().map(x => x.id === r.id
                ? { ...x, fecha: f, entrada: e || null, salida: s || null, referenciaCompensatorio: referenciaCompensatorioNueva }
                : x);
            const asigTest = calcularAsignacionesCompensatorio(listaSimulada);
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
    GestorHistorial.saveState(EstadoApp.registros(), `editar registro (${TiempoUtils.fechaCorta(f)})`);
    const saved = await guardarYActualizar(r.id, true);
    notify.restaurarBotonGuardarEdicion(btnGuardar);
    if (saved) {
        AvisoJornada.sincronizarHoy();
        notify.mostrarToast(cr ? `Guardado con Salida Temprana (+${cr})` : 'Registro actualizado', 'success');
        notify.cerrarEdicion();
    }
}

export const EdicionRegistro = {
    editar: editarRegistro,
    guardar: guardarEdicion,
    eliminar: eliminarRegistroActual,
    pegarReferencia: pegarReferenciaAutomatica,
};
