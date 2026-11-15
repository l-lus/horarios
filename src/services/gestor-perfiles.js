import { STORAGE_KEYS, DIAS_HABILES_DEFAULT, HORAS_DIARIAS_DEFAULT } from '../core/constantes.js';
import { EventosApp } from '../core/eventos.js';
import { Recarga } from '../core/recarga.js';
import { Almacenamiento } from '../core/almacenamiento.js';
import { EstadoApp } from './estado-app.js';
import { SeguridadYUtils as S } from '../core/seguridad.js';

// ====================================================================
// PROFILE MANAGER MODULE
// ====================================================================
const MAX_PERFILES = 9;
const MAX_NOMBRE_PERFIL = 30;
const REGEX_NOMBRE_PERFIL = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\-_ ]+$/;
const ERROR_GUARDAR = 'Error al guardar: almacenamiento lleno';
let perfilActual = 'default';
let perfiles = {};

function inicializar() {
    cargarPerfiles();
    actualizarSelector();
}

function cargarPerfiles() {
    const defaultPerfil = {
        'default': { nombre: 'Principal', registros: [], diasHabiles: [...DIAS_HABILES_DEFAULT], horasDiarias: HORAS_DIARIAS_DEFAULT }
    };

    perfiles = Almacenamiento.getObject(STORAGE_KEYS.PERFILES, defaultPerfil);
    if (!perfiles['default']) perfiles['default'] = defaultPerfil['default'];

    perfilActual = Almacenamiento.getItem(STORAGE_KEYS.PERFIL_ACTIVO, 'default');
    if (!perfiles[perfilActual]) {
        const availableIds = Object.keys(perfiles);
        perfilActual = availableIds.length > 0 ? availableIds[0] : 'default';
    }

    const migrados = Object.values(perfiles).filter(p => migrarCamposSync(p)).length;
    if (migrados > 0) guardarPerfiles();
}

function guardarPerfiles() {
    const savedPerfiles = Almacenamiento.setItem(STORAGE_KEYS.PERFILES, perfiles);
    const savedActivo = Almacenamiento.setItem(STORAGE_KEYS.PERFIL_ACTIVO, perfilActual);
    return savedPerfiles && savedActivo;
}

// Lo que cada perfil guarda de sus respaldos en la nube, además de sus registros.
// - CAMPOS_SYNC: la configuración de la sincronización (una sola por perfil, ver config-sync.js). Restablecer el perfil la borra.
// - Gist y Drive: a dónde apunta el perfil (gistId, archivo de Drive), si eso está cifrado y cuándo se sincronizó por última vez.
//   Restablecer conserva el vínculo y si está cifrado (son datos del respaldo remoto, no de la sincronización).
const CAMPOS_SYNC = Object.freeze([
    'syncDestino', 'syncAuto', 'syncRangoDesde', 'syncRangoHasta', 'syncMergeBehavior',
    'syncFecha_subir', 'syncCount_subir', 'syncFecha_bajar', 'syncCount_bajar'
]);
const CAMPOS_GIST_PERFIL = Object.freeze(['gistId', 'gistCifrado', 'gistLastSync']);
const CAMPOS_DRIVE_PERFIL = Object.freeze(['driveFileId', 'driveArchivoNombre', 'driveCifrado', 'driveLastSync']);
const CAMPOS_NUBE_PERFIL = Object.freeze([...CAMPOS_SYNC, ...CAMPOS_GIST_PERFIL, ...CAMPOS_DRIVE_PERFIL]);
/** Lo que borra «Restablecer»: la configuración de la sincronización y las fechas de última sincronización. */
const CAMPOS_SYNC_RESTABLECER = Object.freeze([...CAMPOS_SYNC, 'gistLastSync', 'driveLastSync']);

// Hasta la versión con un solo modal de respaldo, cada proveedor guardaba su propia automatización en el perfil
const _SUFIJOS_SYNC_ANTERIORES = Object.freeze(['AutoSync', 'RangoDesde', 'RangoHasta', 'MergeBehavior', 'SyncFecha_subir', 'SyncCount_subir', 'SyncFecha_bajar', 'SyncCount_bajar']);

/**
 * Pasa la automatización por proveedor (`gistAutoSync`, `driveAutoSync`, …) a la única del perfil (`sync*`). Manda el proveedor
 * que tenía la automática activa (era uno solo; ante los dos, el Gist), que además queda como destino principal; si ninguno
 * la tenía, se toman las preferencias del Gist y, a falta de ellas, las de Drive. Devuelve true si cambió algo.
 * @param {Record<string, any>} perfil
 */
function migrarCamposSync(perfil) {
    if (!perfil || typeof perfil !== 'object') return false;
    const anteriores = ['gist', 'drive'].flatMap(p => _SUFIJOS_SYNC_ANTERIORES.map(s => `${p}${s}`)).filter(k => k in perfil);
    if (anteriores.length === 0) return false;

    const modo = (p) => { const v = perfil[`${p}AutoSync`]; return v === 1 || v === 2 ? v : v === true ? 1 : 0; };
    const activo = ['gist', 'drive'].find(p => modo(p) !== 0) || null;
    if (!('syncAuto' in perfil)) {
        if (activo) { perfil.syncAuto = modo(activo); perfil.syncDestino = activo; }
        for (const [nuevo, sufijo] of [['syncRangoDesde', 'RangoDesde'], ['syncRangoHasta', 'RangoHasta'], ['syncMergeBehavior', 'MergeBehavior']]) {
            const valor = [activo, 'gist', 'drive'].filter(Boolean).map(p => perfil[`${p}${sufijo}`]).find(v => typeof v === 'string' && v !== '');
            if (valor) perfil[nuevo] = valor;
        }
    }
    anteriores.forEach(k => delete perfil[k]);
    return true;
}

const _camposNube = (perfil) => Object.fromEntries(
    CAMPOS_NUBE_PERFIL.filter(k => perfil[k] != null && perfil[k] !== '').map(k => [k, perfil[k]])
);

function guardarDatosPerfilActual() {
    const actual = perfiles[perfilActual];
    if (!actual) return false;   // el perfil activo se acaba de eliminar (la UI está por recargar)
    perfiles[perfilActual] = {
        nombre: actual.nombre,
        registros: [...EstadoApp.registros()],
        diasHabiles: EstadoApp.diasHabiles(),
        horasDiarias: EstadoApp.horasDiarias(),
        historialDiasHabiles: EstadoApp.historialDiasHabiles(),
        ..._camposNube(actual)
    };
    return guardarPerfiles();
}

function actualizarSelector() {
    if (perfiles[perfilActual]) EventosApp.emit('perfil:cambio', { nombre: perfiles[perfilActual].nombre });
}

function obtenerListaPerfiles() {
    return Object.entries(perfiles).map(([id, perfil]) => ({
        id: id,
        nombre: perfil.nombre,
        esActual: id === perfilActual,
        totalRegistros: Array.isArray(perfil.registros) ? perfil.registros.length : 0
    })).sort((a, b) => {
        if (a.id === 'default') return -1;
        if (b.id === 'default') return 1;
        return a.nombre.localeCompare(b.nombre);
    });
}

function cambiarPerfil(nuevoId) {
    if (!nuevoId || nuevoId === perfilActual) return;
    guardarDatosPerfilActual();
    perfilActual = nuevoId;
    if (Almacenamiento.setItem(STORAGE_KEYS.PERFIL_ACTIVO, perfilActual)) {
        Recarga.solicitar();
    }
}

// --------------------------------------------------------------------
// Alta, renombre y baja (la UI solo lee el input y muestra el resultado)
// --------------------------------------------------------------------
const _normalizarNombre = (nombre) => S.limpiarTexto(String(nombre ?? ''), MAX_NOMBRE_PERFIL);
const _mismoNombre = (a, b) => a.toLowerCase().trim() === b.toLowerCase().trim();

/** Mensaje de error del nombre (ya normalizado) o null; `excluirId` es el perfil que se renombra. */
function errorNombrePerfil(nombre, excluirId = null) {
    if (!nombre) return 'Ingresá un nombre para el perfil';
    if (!REGEX_NOMBRE_PERFIL.test(nombre)) return 'El nombre contiene caracteres no válidos.\n Solo letras, números y espacios.';
    if (Object.entries(perfiles).some(([id, p]) => id !== excluirId && _mismoNombre(String(p?.nombre ?? ''), nombre))) return 'Ya existe un perfil con ese nombre';
    if (excluirId === null && Object.keys(perfiles).length >= MAX_PERFILES) return `Máximo de perfiles alcanzado (${MAX_PERFILES})`;
    return null;
}

const _persistir = () => Almacenamiento.setItem(STORAGE_KEYS.PERFILES, perfiles);

/** @returns {{ error: string } | { id: string, nombre: string }} */
function crearPerfil(nombreCrudo) {
    const nombre = _normalizarNombre(nombreCrudo);
    const error = errorNombrePerfil(nombre);
    if (error) return { error };
    const id = 'perfil_' + S.generarIDSeguro();
    perfiles[id] = { nombre, registros: [], diasHabiles: [...DIAS_HABILES_DEFAULT], horasDiarias: HORAS_DIARIAS_DEFAULT };
    if (!_persistir()) { delete perfiles[id]; return { error: ERROR_GUARDAR }; }
    actualizarSelector();
    return { id, nombre };
}

/** @returns {{ error: string } | { sinCambios: true } | { nombre: string }} */
function renombrarPerfil(id, nombreCrudo) {
    const perfil = perfiles[id];
    if (!perfil) return { error: 'Perfil no encontrado' };
    const nombre = _normalizarNombre(nombreCrudo);
    const error = errorNombrePerfil(nombre, id);
    if (error) return { error };
    if (perfil.nombre === nombre) return { sinCambios: true };
    const anterior = perfil.nombre;
    perfil.nombre = nombre;
    if (!_persistir()) { perfil.nombre = anterior; return { error: ERROR_GUARDAR }; }
    actualizarSelector();
    return { nombre };
}

/**
 * Borra el perfil y sus claves por perfil. Si era el activo, el activo pasa a ser el Principal (la UI recarga).
 * @returns {{ error: string } | { eraActual: boolean }}
 */
function eliminarPerfil(id) {
    if (id === 'default') return { error: 'No se puede eliminar el perfil Principal' };
    const perfil = perfiles[id];
    if (!perfil) return { error: 'Perfil no encontrado' };
    delete perfiles[id];
    if (!_persistir()) { perfiles[id] = perfil; return { error: ERROR_GUARDAR }; }
    Almacenamiento.borrarClavesDePerfil(id);
    const eraActual = id === perfilActual;
    if (eraActual && !Almacenamiento.setItem(STORAGE_KEYS.PERFIL_ACTIVO, 'default')) return { error: ERROR_GUARDAR };
    return { eraActual };
}

function obtenerPerfilActual() { return perfilActual; }
function obtenerDatosPerfil() { return perfiles[perfilActual]; }
function obtenerTodosPerfiles() { return perfiles; }

function perfilKey(base) {
    return base + '_' + perfilActual;
}

Almacenamiento.setProfileKeyResolver(perfilKey);
EstadoApp.setPerfilHooks({ obtenerPerfilActual, guardarDatosPerfilActual });

export const GestorPerfiles = {
    inicializar,
    cambiarPerfil,
    guardarDatosPerfilActual,
    obtenerPerfilActual,
    obtenerDatosPerfil,
    obtenerListaPerfiles,
    obtenerTodosPerfiles,
    guardarPerfiles,
    CAMPOS_SYNC,
    CAMPOS_SYNC_RESTABLECER,
    migrarCamposSync,
    crearPerfil,
    renombrarPerfil,
    eliminarPerfil
};
