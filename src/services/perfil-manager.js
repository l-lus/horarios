import { STORAGE_KEYS } from '../core/constants.js';
import { StorageHelper } from '../core/storage.js';
import { AppState } from './app-state.js';

// ====================================================================
// PROFILE MANAGER MODULE
// ====================================================================
const MAX_PERFILES = 9;
let perfilActual = 'default';
let perfiles = {};
let _inicializado = false;

function inicializar() {
    cargarPerfiles();
    actualizarSelector();
    _inicializado = true;
}

function cargarPerfiles() {
    const defaultPerfil = {
        'default': { nombre: 'Principal', registros: [], diasHabiles: [1, 2, 3, 4, 5], horasDiarias: 7 }
    };

    perfiles = StorageHelper.getObject(STORAGE_KEYS.PERFILES, defaultPerfil);
    if (!perfiles['default']) perfiles['default'] = defaultPerfil['default'];

    perfilActual = StorageHelper.getItem(STORAGE_KEYS.PERFIL_ACTIVO, 'default');
    if (!perfiles[perfilActual]) {
        const availableIds = Object.keys(perfiles);
        perfilActual = availableIds.length > 0 ? availableIds[0] : 'default';
    }
}

function guardarPerfiles() {
    const savedPerfiles = StorageHelper.setItem(STORAGE_KEYS.PERFILES, perfiles);
    const savedActivo = StorageHelper.setItem(STORAGE_KEYS.PERFIL_ACTIVO, perfilActual);
    return savedPerfiles && savedActivo;
}

function guardarDatosPerfilActual() {
    const actual = perfiles[perfilActual];
    perfiles[perfilActual] = {
        nombre: actual.nombre,
        registros: [...AppState.registros()],
        diasHabiles: AppState.diasHabiles(),
        horasDiarias: AppState.horasDiarias(),
        historialDiasHabiles: AppState.historialDiasHabiles(),
        ...(actual.gistId && { gistId: actual.gistId }),
        ...(actual.gistLastSync && { gistLastSync: actual.gistLastSync }),
        ...(actual.gistAutoSync != null && { gistAutoSync: actual.gistAutoSync }),
        ...(actual.gistRangoDesde && { gistRangoDesde: actual.gistRangoDesde }),
        ...(actual.gistRangoHasta && { gistRangoHasta: actual.gistRangoHasta }),
        ...(actual.gistSyncFecha_subir && { gistSyncFecha_subir: actual.gistSyncFecha_subir }),
        ...(actual.gistSyncCount_subir != null && { gistSyncCount_subir: actual.gistSyncCount_subir }),
        ...(actual.gistSyncFecha_bajar && { gistSyncFecha_bajar: actual.gistSyncFecha_bajar }),
        ...(actual.gistSyncCount_bajar != null && { gistSyncCount_bajar: actual.gistSyncCount_bajar }),
        ...(actual.gistMergeBehavior && { gistMergeBehavior: actual.gistMergeBehavior })
    };
    return guardarPerfiles();
}

function actualizarSelector() {
    const btnTexto = document.getElementById('nombre-perfil-header');
    if (btnTexto && perfiles[perfilActual]) {
        btnTexto.textContent = perfiles[perfilActual].nombre;
    }
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
    if (StorageHelper.setItem(STORAGE_KEYS.PERFIL_ACTIVO, perfilActual)) {
        location.reload();
    }
}

function obtenerPerfilActual() { return perfilActual; }
function esPerfilDefault() { return perfilActual === 'default'; }
function estaInicializado() { return _inicializado; }
function obtenerDatosPerfil() { return perfiles[perfilActual]; }
function obtenerTodosPerfiles() { return perfiles; }

function perfilKey(base) {
    return base + '_' + perfilActual;
}

StorageHelper.setProfileKeyResolver(perfilKey);
AppState.setPerfilHooks({ obtenerPerfilActual, guardarDatosPerfilActual });

export const PerfilManager = {
    inicializar, estaInicializado, cambiarPerfil, guardarDatosPerfilActual,
    obtenerPerfilActual, esPerfilDefault, obtenerDatosPerfil, obtenerListaPerfiles, obtenerTodosPerfiles,
    guardarPerfiles, perfilKey, MAX_PERFILES
};
