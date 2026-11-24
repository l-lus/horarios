import { STORAGE_KEYS } from '../core/constantes.js';
import { TiempoUtils } from '../core/tiempo-utils.js';
import { Almacenamiento } from '../core/almacenamiento.js';
import { GestorPerfiles } from './gestor-perfiles.js';

// ====================================================================
// CONFIGURACIÓN DE SINCRONIZACIÓN — una sola por perfil, para el destino principal (archivo, Gist o Google Drive)
// ====================================================================
// Destino principal, modo automático, comportamiento al bajar, franja horaria y límites por hora. Todo vive en el perfil activo
// en campos `sync*` (ver GestorPerfiles.CAMPOS_SYNC), salvo los límites por hora, que son globales. Los perfiles anteriores,
// que guardaban una configuración por proveedor (`gistAutoSync`, `driveAutoSync`, …), se migran al cargar (GestorPerfiles.migrarCamposSync).
const RANGO_HORARIO_DEFAULT = Object.freeze({ desde: '21:00', hasta: '00:00' });
const DESTINOS = Object.freeze(['local', 'gist', 'drive']);

const _conPerfil = GestorPerfiles.modificarPerfilActual;

/**
 * Lo que cada proveedor de nube guarda en el perfil con su prefijo (`gistLastSync`, `driveCifrado`, …): la última sincronización y si su respaldo
 * ya viajó cifrado (mientras lo esté no se acepta en claro, ver RespaldoCifrado.abrir con exigirCifrado).
 * @param {'gist' | 'drive'} prefijo
 */
function camposNubePerfil(prefijo) {
    const claveSync = `${prefijo}LastSync`, claveCifrado = `${prefijo}Cifrado`;
    return Object.freeze({
        /** @returns {string | null} */
        getLastSync: () => GestorPerfiles.obtenerDatosPerfil()?.[claveSync] || null,
        marcarSincronizado: () => { const ahoraISO = new Date().toISOString(); _conPerfil(perfil => { perfil[claveSync] = ahoraISO; }); },
        getCifrado: () => GestorPerfiles.obtenerDatosPerfil()?.[claveCifrado] === true,
        /** @param {boolean} valor */
        setCifrado: (valor) => { _conPerfil(perfil => { if (valor) perfil[claveCifrado] = true; else delete perfil[claveCifrado]; }); }
    });
}

function _claveHoraActual() {
    return TiempoUtils.fechaLocalISOFull().slice(0, 13);
}

/** El destino principal que eligió la persona ('local', 'gist' o 'drive'), o null si todavía no eligió (ver DestinoRespaldo.principal). */
function getDestino() {
    const val = GestorPerfiles.obtenerDatosPerfil()?.syncDestino;
    return DESTINOS.includes(val) ? val : null;
}
function setDestino(valor) { if (DESTINOS.includes(valor)) _conPerfil(perfil => { perfil.syncDestino = valor; }); }

function getMergeBehavior() { return GestorPerfiles.obtenerDatosPerfil()?.syncMergeBehavior === 'merge' ? 'merge' : 'replace'; }
function setMergeBehavior(valor) { _conPerfil(perfil => { perfil.syncMergeBehavior = valor; }); }

/** 0: manual; 1: baja al abrir la app; 2: sube al abrir la app. */
function getAutoSync() {
    const val = GestorPerfiles.obtenerDatosPerfil()?.syncAuto;
    return val === 1 || val === 2 ? val : 0;
}
function setAutoSync(valor) { _conPerfil(perfil => { perfil.syncAuto = valor; }); }

function getRangoHorario() {
    const perfil = GestorPerfiles.obtenerDatosPerfil();
    return {
        desde: perfil?.syncRangoDesde || RANGO_HORARIO_DEFAULT.desde,
        hasta: perfil?.syncRangoHasta || RANGO_HORARIO_DEFAULT.hasta
    };
}
function setRangoHorario(desde, hasta) { _conPerfil(perfil => { perfil.syncRangoDesde = desde; perfil.syncRangoHasta = hasta; }); }

const _clavesSyncCount = (tipo) => ({ key: `syncCount_${tipo}`, keyFecha: `syncFecha_${tipo}` });

function getSyncLimite(tipo) {
    return Almacenamiento.getNumber(STORAGE_KEYS.SYNC_LIMITE(tipo), tipo === 'subir' ? 1 : 2);
}

function getSyncCount(tipo) {
    const perfil = GestorPerfiles.obtenerDatosPerfil();
    const { key, keyFecha } = _clavesSyncCount(tipo);
    if (!perfil?.[keyFecha] || perfil[keyFecha] !== _claveHoraActual()) return 0;
    return perfil?.[key] || 0;
}

function marcarSync(tipo) {
    if (getSyncLimite(tipo) === 0) return;
    const { key, keyFecha } = _clavesSyncCount(tipo);
    _conPerfil(perfil => {
        const clave = _claveHoraActual();
        const esNuevaHora = perfil[keyFecha] !== clave;
        perfil[keyFecha] = clave;
        perfil[key] = esNuevaHora ? 1 : (perfil[key] || 0) + 1;
    });
}

function setSyncLimite(tipo, valor) {
    const anteriorLimite = getSyncLimite(tipo);
    Almacenamiento.setItem(STORAGE_KEYS.SYNC_LIMITE(tipo), valor);
    if (anteriorLimite === 0 && valor > 0) {
        const { key, keyFecha } = _clavesSyncCount(tipo);
        _conPerfil(perfil => {
            perfil[key] = 0;
            perfil[keyFecha] = null;
        });
    }
}

function superaLimite(tipo) {
    const limite = getSyncLimite(tipo);
    if (limite === 0) return false;
    return getSyncCount(tipo) >= limite;
}

function dentroDelRangoHorario() {
    const { desde, hasta } = getRangoHorario();
    const horaActual = TiempoUtils.obtenerHoraActual();
    return desde <= hasta ? (horaActual >= desde && horaActual <= hasta) : (horaActual >= desde || horaActual <= hasta);
}

function formatLastSync(isoOrLegacy) {
    if (!isoOrLegacy) return null;
    const d = new Date(isoOrLegacy);
    return isNaN(d.getTime()) ? isoOrLegacy : d.toLocaleString('es-AR');
}

export const ConfigSync = {
    DESTINOS, RANGO_HORARIO_DEFAULT, formatLastSync, camposNubePerfil,
    getDestino, setDestino, getMergeBehavior, setMergeBehavior, getAutoSync, setAutoSync, getRangoHorario, setRangoHorario,
    marcarSync, superaLimite, getSyncLimite, setSyncLimite, dentroDelRangoHorario
};
