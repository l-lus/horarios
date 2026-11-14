import { TiempoUtils } from '../core/tiempo-utils.js';
import { Almacenamiento } from '../core/almacenamiento.js';
import { GestorPerfiles } from './gestor-perfiles.js';

// ====================================================================
// CONFIGURACIÓN DE SINCRONIZACIÓN — lo que comparten Gist y Google Drive
// ====================================================================
// Modo automático, comportamiento al bajar, franja horaria y límites por hora. Todo vive en el perfil activo con
// el prefijo del proveedor (`gistAutoSync`, `driveAutoSync`, …), salvo los límites, que son globales
// (`gistSyncLimite_subir`, `driveSyncLimite_subir`, …).
const RANGO_HORARIO_DEFAULT = Object.freeze({ desde: '21:00', hasta: '00:00' });

function _conPerfil(fn) {
    const perfil = GestorPerfiles.obtenerDatosPerfil();
    if (perfil) { fn(perfil); GestorPerfiles.guardarPerfiles(); }
}

function _claveHoraActual() {
    return TiempoUtils.fechaLocalISOFull().slice(0, 13);
}

/**
 * @param {string} prefijo 'gist' o 'drive': el de los campos del perfil
 * @param {(tipo: string) => string} claveLimite la clave global del límite por hora de cada tipo ('subir' o 'bajar')
 */
function crear(prefijo, claveLimite) {
    const campo = (nombre) => `${prefijo}${nombre}`;

    function getMergeBehavior() { return GestorPerfiles.obtenerDatosPerfil()?.[campo('MergeBehavior')] || 'replace'; }
    function setMergeBehavior(valor) { _conPerfil(perfil => { perfil[campo('MergeBehavior')] = valor; }); }

    /** 0: manual; 1: baja al abrir la app; 2: sube al abrir la app. */
    function getAutoSync() {
        const val = GestorPerfiles.obtenerDatosPerfil()?.[campo('AutoSync')];
        if (val === 1 || val === 2) return val;
        if (val === true) return 1;
        return 0;
    }
    function setAutoSync(valor) { _conPerfil(perfil => { perfil[campo('AutoSync')] = valor; }); }

    function getRangoHorario() {
        const perfil = GestorPerfiles.obtenerDatosPerfil();
        return {
            desde: perfil?.[campo('RangoDesde')] || RANGO_HORARIO_DEFAULT.desde,
            hasta: perfil?.[campo('RangoHasta')] || RANGO_HORARIO_DEFAULT.hasta
        };
    }
    function setRangoHorario(desde, hasta) { _conPerfil(perfil => { perfil[campo('RangoDesde')] = desde; perfil[campo('RangoHasta')] = hasta; }); }

    const _clavesSyncCount = (tipo) => ({ key: campo(`SyncCount_${tipo}`), keyFecha: campo(`SyncFecha_${tipo}`) });

    function getSyncLimite(tipo) {
        const defValue = tipo === 'bajar' ? 2 : (tipo === 'subir' ? 1 : 2);
        return Almacenamiento.getNumber(claveLimite(tipo), defValue);
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
        Almacenamiento.setItem(claveLimite(tipo), valor);
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

    return { getMergeBehavior, setMergeBehavior, getAutoSync, setAutoSync, getRangoHorario, setRangoHorario, RANGO_HORARIO_DEFAULT, marcarSync, superaLimite, getSyncLimite, setSyncLimite, dentroDelRangoHorario };
}

function formatLastSync(isoOrLegacy) {
    if (!isoOrLegacy) return null;
    const d = new Date(isoOrLegacy);
    return isNaN(d.getTime()) ? isoOrLegacy : d.toLocaleString('es-AR');
}

export const ConfigSync = { crear, formatLastSync, RANGO_HORARIO_DEFAULT, _conPerfil };
