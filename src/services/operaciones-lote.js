import { TOAST_MS } from '../core/constantes.js';
import { TiempoUtils } from '../core/tiempo-utils.js';
import { SeguridadYUtils as S } from '../core/seguridad.js';
import { EstadoApp } from './estado-app.js';
import { TiposRegistro } from './tipos-registro.js';
import { Cambios } from './cambios.js';

// ====================================================================
// ALTA DE DÍAS ESPECIALES Y OPERACIONES POR RANGO DE FECHAS
// ====================================================================
// Devuelven { ok: true } o { error: mensaje } (ver "Errores" en docs/ARQUITECTURA.md); el aviso al usuario ya está dado.
const ERROR_GUARDAR = 'Error al guardar';

/** @param {string} mensaje @param {string} [tipo] @param {{ duracion?: number }} [opciones] */
function _rechazar(mensaje, tipo, opciones) {
    EstadoApp._notify().avisarFichaje(mensaje, tipo, opciones);
    return { error: mensaje };
}

/** @param {string} fecha @param {string} tipo @param {string | null} [notas] descripción opcional del registro (p. ej. el nombre del feriado) */
async function registrarDiaEspecial(fecha, tipo, notas = null) {
    const notify = EstadoApp._notify();
    if (!TiempoUtils.validarFecha(fecha)) return _rechazar('Fecha inválida');
    const registroExistente = EstadoApp.registroPorFecha(fecha);
    if (registroExistente) {
        const mensaje = fecha === TiempoUtils.obtenerFechaHoy() ? 'Ya existe un registro para hoy' : 'Ya existe un registro para esa fecha';
        notify.mostrarToast(mensaje, 'warning');
        return { error: mensaje };
    }

    const tipoConfig = TiposRegistro.obtenerTipoPorId(tipo);
    if (!tipoConfig) return _rechazar('Tipo inválido');

    const entrada = tipoConfig.codigo;
    const salida = tipoConfig.codigo;
    const tipoTexto = `${tipoConfig.emoji} ${tipoConfig.label}`;

    if (!EstadoApp._hayEspacioParaRegistros(1)) return _rechazar('Límite de registros alcanzado');

    const nuevo = EstadoApp._construirRegistro(fecha, entrada, salida);
    const notasLimpias = S.normalizarNotas(notas);
    if (notasLimpias) nuevo.notas = notasLimpias;
    EstadoApp.registros().push(nuevo);

    EstadoApp.ordenarRegistros();
    const esHoy = fecha === TiempoUtils.obtenerFechaHoy();
    const saved = await Cambios.confirmarEnTarjeta(`agregar ${tipoConfig.label} (${TiempoUtils.fechaCorta(fecha)})`, nuevo.id, esHoy);
    if (!saved) return { error: ERROR_GUARDAR };   // el aviso ya lo dio el guardado
    notify.avisarFichaje(`Registro agregado como ${tipoTexto}`, 'success');
    return { ok: true };
}

async function registrarVacacionesDirecto(desde, hasta, tipo) {
    const notify = EstadoApp._notify();
    const tipoConfig = TiposRegistro.obtenerTipoPorId(tipo);
    if (!tipoConfig) return _rechazar('Tipo inválido');
    const errorRango = TiempoUtils.errorRangoFechas(desde, hasta);
    if (errorRango) return _rechazar(errorRango);
    const entrada = tipoConfig.codigo;
    const salida = tipoConfig.codigo;

    const fechasARegistrar = TiempoUtils.generarRangoFechas(desde, hasta);

    if (fechasARegistrar.length > S.SECURITY_LIMITS.MAX_REGISTROS_POR_OPERACION) {
        return _rechazar(`El rango seleccionado contiene ${fechasARegistrar.length} días.\n Máximo permitido: ${S.SECURITY_LIMITS.MAX_REGISTROS_POR_OPERACION} días por operación.`, 'error', { duracion: TOAST_MS.LARGO });
    }

    const nuevosRegistros = fechasARegistrar.filter(f => !EstadoApp.existeRegistroEnFecha(f));
    if (nuevosRegistros.length === 0) return _rechazar('Todas las fechas ya están registradas', 'warning');
    if (!EstadoApp._hayEspacioParaRegistros(nuevosRegistros.length)) return _rechazar('Límite de registros alcanzado', 'error');

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
    if (!saved) return { error: ERROR_GUARDAR };   // el aviso ya lo dio el guardado
    notify.avisarFichaje(nuevosRegistros.length === 1 ? '1 día registrado' : `${nuevosRegistros.length} días registrados`, 'success');
    return { ok: true };
}

async function borrarPeriodoDirecto(desde, hasta) {
    const notify = EstadoApp._notify();
    const errorRango = TiempoUtils.errorRangoFechas(desde, hasta);
    if (errorRango) return _rechazar(errorRango);
    const registros = EstadoApp.registros();
    const registrosAEliminar = registros.filter(r => {
        if (r.fecha < desde || r.fecha > hasta) return false;
        return !TiposRegistro.esRegistroEspecial(r.entrada, r.salida);
    });
    if (registrosAEliminar.length > S.SECURITY_LIMITS.MAX_REGISTROS_POR_OPERACION) {
        return _rechazar(`Máximo ${S.SECURITY_LIMITS.MAX_REGISTROS_POR_OPERACION} registros por operación. Encontrados: ${registrosAEliminar.length}`);
    }
    if (registrosAEliminar.length === 0) {
        return _rechazar('No hay registros de jornadas en ese período', 'info');
    }

    EstadoApp._setRegistros(registros.filter(r => !registrosAEliminar.includes(r)));
    EstadoApp.sincronizarPushHoy();
    const saved = await Cambios.confirmar(`eliminar período (${TiempoUtils.contar(registrosAEliminar.length, 'registro')})`);
    if (!saved) return { error: ERROR_GUARDAR };   // el aviso ya lo dio el guardado
    notify.avisarFichaje(registrosAEliminar.length === 1 ? '1 registro eliminado' : `${registrosAEliminar.length} registros eliminados`, 'success');
    return { ok: true };
}

export const OperacionesLote = { registrarDiaEspecial, registrarVacacionesDirecto, borrarPeriodoDirecto };
