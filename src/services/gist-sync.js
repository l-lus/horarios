import { STORAGE_KEYS } from '../core/constants.js';
import { TimeUtils } from '../core/time-utils.js';
import { StorageHelper } from '../core/storage.js';
import { PerfilManager } from './perfil-manager.js';
import { SecurityAndUtils as S } from '../core/security.js';

// ====================================================================
//                     GIST SYNC MODULE
// ====================================================================
const GIST_FILENAME = 'horarios_backup.json';
const GIST_ID_REGEX = /^[a-f0-9]{20,40}$/i;
const RANGO_HORARIO_DEFAULT = { desde: '21:00', hasta: '00:00' };

function esGistIdValido(id) { return id && GIST_ID_REGEX.test(id.trim()); }

function _conPerfil(fn) {
    if (!PerfilManager) return;
    const perfil = PerfilManager.obtenerDatosPerfil();
    if (perfil) { fn(perfil); PerfilManager.guardarPerfiles(); }
}

function getToken() { return StorageHelper.getItem(STORAGE_KEYS.GIST_TOKEN, ''); }

function getGistId() { return PerfilManager?.obtenerDatosPerfil()?.gistId || ''; }
function getLastSync() { return PerfilManager?.obtenerDatosPerfil()?.gistLastSync || null; }
function getMergeBehavior() { return PerfilManager?.obtenerDatosPerfil()?.gistMergeBehavior || 'replace'; }
function setMergeBehavior(valor) { _conPerfil(perfil => { perfil.gistMergeBehavior = valor; }); }

function getAutoSync() {
    const val = PerfilManager?.obtenerDatosPerfil()?.gistAutoSync;
    if (val === 1 || val === 2) return val;
    if (val === true) return 1;
    return 0;
}
function setAutoSync(valor) { _conPerfil(perfil => { perfil.gistAutoSync = valor; }); }

function getRangoHorario() {
    const perfil = PerfilManager?.obtenerDatosPerfil();
    return {
        desde: perfil?.gistRangoDesde || RANGO_HORARIO_DEFAULT.desde,
        hasta: perfil?.gistRangoHasta || RANGO_HORARIO_DEFAULT.hasta
    };
}
function setRangoHorario(desde, hasta) { _conPerfil(perfil => { perfil.gistRangoDesde = desde; perfil.gistRangoHasta = hasta; }); }

function _claveHoraActual() {
    return TimeUtils.fechaLocalISOFull().slice(0, 13);
}

function _clavesSyncCount(tipo) {
    return { key: `gistSyncCount_${tipo}`, keyFecha: `gistSyncFecha_${tipo}` };
}

function getSyncCount(tipo) {
    const perfil = PerfilManager?.obtenerDatosPerfil();
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

function getSyncLimite(tipo) {
    const defValue = tipo === 'bajar' ? 2 : (tipo === 'subir' ? 1 : 2);
    return StorageHelper.getNumber(STORAGE_KEYS.GIST_LIMITE(tipo), defValue);
}

function setSyncLimite(tipo, valor) {
    const anteriorLimite = getSyncLimite(tipo);
    StorageHelper.setItem(STORAGE_KEYS.GIST_LIMITE(tipo), valor);
    if (anteriorLimite === 0 && valor > 0 && PerfilManager) {
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
    const horaActual = TimeUtils.obtenerHoraActual();
    return desde <= hasta ? (horaActual >= desde && horaActual <= hasta) : (horaActual >= desde || horaActual <= hasta);
}

function saveCredentials(token, gistId) {
    if (token) StorageHelper.setItem(STORAGE_KEYS.GIST_TOKEN, S.sanitizeString(token.trim(), 256));
    else StorageHelper.removeItem(STORAGE_KEYS.GIST_TOKEN);

    _conPerfil(perfil => {
        if (gistId && esGistIdValido(gistId)) perfil.gistId = gistId.trim();
        else if (gistId === '') delete perfil.gistId;
    });
}

function saveLastSync(gistId) {
    const ahoraISO = new Date().toISOString();
    _conPerfil(perfil => {
        perfil.gistLastSync = ahoraISO;
        if (gistId && esGistIdValido(gistId)) perfil.gistId = gistId;
    });
}

function formatLastSync(isoOrLegacy) {
    if (!isoOrLegacy) return null;
    try {
        const d = new Date(isoOrLegacy);
        if (!isNaN(d.getTime())) return d.toLocaleString('es-AR');
    } catch (e) { }
    return isoOrLegacy;
}

async function _gistFetch(url, options = {}) {
    const token = getToken();
    const response = await fetch(url, {
        ...options,
        headers: {
            'Authorization': `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            ...options.headers
        }
    });
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || `Error ${response.status}`);
    return response.json();
}

async function subir(registros, diasHabiles, horasDiarias, historialDiasHabiles, configExtra = {}) {
    const token = getToken();
    if (!token) throw new Error('Falta el token de GitHub');

    const hash = await S.calcularHashSHA256(registros);
    const data = { registros, diasHabiles, horasDiarias, historialDiasHabiles, ...configExtra, fecha: TimeUtils.fechaLocalISOFull(), version: S.SECURITY_LIMITS.SCHEMA_VERSION, hash, timestamp: Date.now() };
    const gistId = getGistId();
    const gistIdValido = esGistIdValido(gistId);
    const url = gistIdValido ? `https://api.github.com/gists/${gistId}` : 'https://api.github.com/gists';
    const method = gistIdValido ? 'PATCH' : 'POST';

    const result = await _gistFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'Horarios PWA - Backup automático', public: false, files: { [GIST_FILENAME]: { content: JSON.stringify(data, null, 2) } } })
    });
    saveLastSync(result.id);
    return result.id;
}

async function bajar() {
    const token = getToken();
    const gistId = getGistId();
    if (!token) throw new Error('Falta el token de GitHub');
    if (!gistId || !esGistIdValido(gistId)) throw new Error('Gist ID inválido — dejá el campo vacío y subí primero para crear uno');

    const respuesta = await _gistFetch(`https://api.github.com/gists/${gistId}`);
    const file = respuesta.files[GIST_FILENAME];
    if (!file) throw new Error(`Archivo ${GIST_FILENAME} no encontrado en el Gist`);

    const data = JSON.parse(file.content, S.reviverJSONSeguro);
    if (data.hash && await S.calcularHashSHA256(data.registros) !== data.hash) data._hashNoCoincide = true;

    saveLastSync(gistId);
    return data;
}

export const GistSync = { getToken, getGistId, getLastSync, formatLastSync, getMergeBehavior, setMergeBehavior, getAutoSync, setAutoSync, getRangoHorario, setRangoHorario, RANGO_HORARIO_DEFAULT, getSyncCount, marcarSync, superaLimite, getSyncLimite, setSyncLimite, dentroDelRangoHorario, saveCredentials, esGistIdValido, subir, bajar };
