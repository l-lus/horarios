import { TOAST_MS } from '../core/constantes.js';
import { TiempoUtils } from '../core/tiempo-utils.js';
import { SeguridadYUtils as S } from '../core/seguridad.js';
import { EstadoApp } from './estado-app.js';
import { TiposRegistro } from './tipos-registro.js';
import { Cambios } from './cambios.js';

// ====================================================================
// ALTA DE DÍAS ESPECIALES Y OPERACIONES POR RANGO DE FECHAS
// ====================================================================
async function registrarDiaEspecial(fecha, tipo) {
    const notify = EstadoApp._notify();
    if (!TiempoUtils.validarFecha(fecha)) { notify.avisarFichaje('Fecha inválida'); throw new Error('Fecha inválida'); }
    const registroExistente = EstadoApp.registroPorFecha(fecha);
    if (registroExistente) {
        notify.mostrarToast(fecha === TiempoUtils.obtenerFechaHoy() ? 'Ya existe un registro para hoy' : 'Ya existe un registro para esa fecha', 'warning');
        throw new Error('Registro ya existe');
    }

    const tipoConfig = TiposRegistro.obtenerTipoPorId(tipo);
    if (!tipoConfig) { notify.avisarFichaje('Tipo inválido'); throw new Error('Tipo inválido'); }

    const entrada = tipoConfig.codigo;
    const salida = tipoConfig.codigo;
    const tipoTexto = `${tipoConfig.emoji} ${tipoConfig.label}`;

    if (!EstadoApp._hayEspacioParaRegistros(1)) { notify.avisarFichaje('Límite de registros alcanzado'); throw new Error('Límite alcanzado'); }

    const nuevo = EstadoApp._construirRegistro(fecha, entrada, salida);
    EstadoApp.registros().push(nuevo);

    EstadoApp.ordenarRegistros();
    const esHoy = fecha === TiempoUtils.obtenerFechaHoy();
    const saved = await Cambios.confirmarEnTarjeta(`agregar ${tipoConfig.label} (${TiempoUtils.fechaCorta(fecha)})`, nuevo.id, esHoy);
    if (saved) {
        notify.avisarFichaje(`Registro agregado como ${tipoTexto}`, 'success');
    } else {
        throw new Error('Error al guardar');
    }
}

async function registrarVacacionesDirecto(desde, hasta, tipo) {
    const notify = EstadoApp._notify();
    const tipoConfig = TiposRegistro.obtenerTipoPorId(tipo);
    if (!tipoConfig) { notify.avisarFichaje('Tipo inválido'); throw new Error('Tipo inválido'); }
    const errorRango = TiempoUtils.errorRangoFechas(desde, hasta);
    if (errorRango) { notify.avisarFichaje(errorRango); throw new Error(errorRango); }
    const entrada = tipoConfig.codigo;
    const salida = tipoConfig.codigo;

    const fechasARegistrar = TiempoUtils.generarRangoFechas(desde, hasta);

    if (fechasARegistrar.length > S.SECURITY_LIMITS.MAX_REGISTROS_POR_OPERACION) {
        notify.avisarFichaje(`El rango seleccionado contiene ${fechasARegistrar.length} días.\n Máximo permitido: ${S.SECURITY_LIMITS.MAX_REGISTROS_POR_OPERACION} días por operación.`, 'error', { duracion: TOAST_MS.LARGO });
        throw new Error('Límite de días excedido');
    }

    const nuevosRegistros = fechasARegistrar.filter(f => !EstadoApp.existeRegistroEnFecha(f));
    if (nuevosRegistros.length === 0) { notify.avisarFichaje('Todas las fechas ya están registradas', 'warning'); throw new Error('Sin fechas nuevas'); }
    if (!EstadoApp._hayEspacioParaRegistros(nuevosRegistros.length)) { notify.avisarFichaje('Límite de registros alcanzado', 'error'); throw new Error('Límite alcanzado'); }

    const idsNuevosParaAnimar = [];
    const registros = EstadoApp.registros();
    nuevosRegistros.forEach(fecha => {
        const nuevo = EstadoApp._construirRegistro(fecha, entrada, salida);
        idsNuevosParaAnimar.push(nuevo.id);
        registros.push(nuevo);
    });

    EstadoApp.ordenarRegistros();
    const incluyeHoy = nuevosRegistros.includes(TiempoUtils.obtenerFechaHoy());
    const saved = await Cambios.confirmarEnTarjeta(`agregar ${tipoConfig.label} (${TiempoUtils.contar(nuevosRegistros.length, 'día')})`, idsNuevosParaAnimar, incluyeHoy);
    if (saved) {
        notify.avisarFichaje(nuevosRegistros.length === 1 ? '1 día registrado' : `${nuevosRegistros.length} días registrados`, 'success');
    } else {
        throw new Error('Error al guardar');
    }
}

async function borrarPeriodoDirecto(desde, hasta) {
    const notify = EstadoApp._notify();
    const errorRango = TiempoUtils.errorRangoFechas(desde, hasta);
    if (errorRango) { notify.avisarFichaje(errorRango); throw new Error(errorRango); }
    const registros = EstadoApp.registros();
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

    EstadoApp._setRegistros(registros.filter(r => !registrosAEliminar.includes(r)));
    EstadoApp.sincronizarPushHoy();
    const saved = await Cambios.confirmar(`eliminar período (${TiempoUtils.contar(registrosAEliminar.length, 'registro')})`);
    if (saved) {
        notify.avisarFichaje(registrosAEliminar.length === 1 ? '1 registro eliminado' : `${registrosAEliminar.length} registros eliminados`, 'success');
    } else {
        throw new Error('Error al guardar');
    }
}

export const OperacionesLote = { registrarDiaEspecial, registrarVacacionesDirecto, borrarPeriodoDirecto };
