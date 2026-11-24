import { STORAGE_KEYS } from '../core/constantes.js';
import { Almacenamiento } from '../core/almacenamiento.js';
import { SeguridadYUtils as S } from '../core/seguridad.js';
import { GestorPerfiles } from './gestor-perfiles.js';
import { ConfigSync } from './config-sync.js';
import { OAuthPKCE } from './oauth-pkce.js';
import { WorkerCliente } from './worker-cliente.js';

// ====================================================================
// GOOGLE DRIVE — conexión (OAuth 2.0 + PKCE por el Worker), respaldo vinculado al perfil y sincronización
// ====================================================================
// Ver docs/PROPUESTA-GOOGLE-DRIVE.md. Resumen:
// - Permiso drive.file: la app solo ve los archivos que ella misma creó, y quedan visibles en el Drive del usuario.
// - Autorización por redirección en la misma ventana (no popup): un solo camino para escritorio, Android e iOS instaladas.
//   El state y el code_verifier esperan en localStorage (10 minutos) y oauth-callback.html deja el code al volver.
// - El Worker guarda el secreto del cliente y canjea, renueva y revoca los tokens. La app le habla directo a la API de Drive.
// - El refresh_token es global (una cuenta de Google por navegador, como el token de GitHub); el access_token vive en memoria.
// Igual que el cliente del Gist, es el único otro servicio que lanza errores (los de red y de la API).

/** Cliente OAuth "Aplicación web" del proyecto de Google Cloud. Vacío = Drive todavía no está disponible en esta versión. */
/** @type {string} */
const GOOGLE_CLIENT_ID = '735444541286-4kadct48eo67jopcbg565ej5e0cd3m4s.apps.googleusercontent.com';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const API = 'https://www.googleapis.com/drive/v3';
const API_SUBIDA = 'https://www.googleapis.com/upload/drive/v3';
const RUTA_RETORNO = 'oauth-callback.html';

const FILE_ID_REGEX = /^[a-zA-Z0-9_-]{10,100}$/;
// Los tokens y códigos de Google son base64url con '/' y '.' (p. ej. "1//0g…", "4/0AX…")
const TOKEN_GOOGLE_REGEX = /^[\w./~+-]{10,2048}$/;
const PENDIENTE_TTL_MS = 10 * 60 * 1000;
const MARGEN_VENCIMIENTO_MS = 60 * 1000;
const MAX_NOMBRE_PERFIL = 60;   // appProperties admite 124 bytes por par clave + valor

const { formatLastSync } = ConfigSync;
const _conPerfil = GestorPerfiles.modificarPerfilActual;
/** driveLastSync y driveCifrado del perfil (misma regla de cifrado que con el Gist). */
const { getLastSync, getCifrado, setCifrado, marcarSincronizado: _marcarSincronizado } = ConfigSync.camposNubePerfil('drive');

function disponible() { return GOOGLE_CLIENT_ID !== ''; }
function esFileIdValido(id) { return typeof id === 'string' && FILE_ID_REGEX.test(id); }
function _esTokenGoogle(t) { return typeof t === 'string' && TOKEN_GOOGLE_REGEX.test(t); }

// --------------------------------------------------------------------
// Estado: cuenta (global) y respaldo vinculado (por perfil)
// --------------------------------------------------------------------
function getRefreshToken() { return Almacenamiento.getItem(STORAGE_KEYS.DRIVE_REFRESH_TOKEN, ''); }
function getCuenta() { return Almacenamiento.getItem(STORAGE_KEYS.DRIVE_CUENTA, ''); }
function conectado() { return _esTokenGoogle(getRefreshToken()); }

function getFileId() { return GestorPerfiles.obtenerDatosPerfil()?.driveFileId || ''; }
function getArchivoNombre() { return GestorPerfiles.obtenerDatosPerfil()?.driveArchivoNombre || ''; }
/** ¿Hay cuenta conectada y un respaldo vinculado al perfil? Es lo que necesitan la sincronización automática y los botones rápidos. */
function listo() { return conectado() && esFileIdValido(getFileId()); }


/**
 * Vincula el perfil con un respaldo de Drive (o lo desvincula con null). Cambiar de archivo olvida si el anterior estaba cifrado.
 * @param {{ id: string, nombre?: string } | null} archivo
 */
function vincular(archivo) {
    if (archivo && !esFileIdValido(archivo.id)) return false;
    _conPerfil(perfil => {
        const anterior = perfil.driveFileId || '';
        if (archivo) {
            perfil.driveFileId = archivo.id;
            if (archivo.nombre) perfil.driveArchivoNombre = String(archivo.nombre).slice(0, 200);
        } else {
            delete perfil.driveFileId;
            delete perfil.driveArchivoNombre;
        }
        if ((perfil.driveFileId || '') !== anterior) delete perfil.driveCifrado;
    });
    return true;
}

// --------------------------------------------------------------------
// Conexión: autorizar en Google y volver
// --------------------------------------------------------------------
/** La URI de retorno registrada en Google: oauth-callback.html junto a la app (Google la compara exacta). */
function redirectUri(base) { return new URL(RUTA_RETORNO, base).href; }

/**
 * Prepara el pedido de autorización y devuelve la URL de Google a la que hay que ir. El state y el code_verifier quedan
 * en localStorage hasta la vuelta (no en sessionStorage: en una PWA instalada la vuelta puede llegar a otro contexto).
 * @param {string} base la URL de la app (location.href)
 * @param {{ cripto?: Crypto, clientId?: string }} [opciones] para los tests
 * @returns {Promise<{ url: string } | { error: string }>}
 */
async function iniciarConexion(base, { cripto = globalThis.crypto, clientId = GOOGLE_CLIENT_ID } = {}) {
    if (!clientId) return { error: 'Google Drive todavía no está disponible en esta versión' };
    const { state, verificador, desafio } = await OAuthPKCE.nuevoPedido(cripto);
    const uri = redirectUri(base);
    if (!Almacenamiento.setItem(STORAGE_KEYS.DRIVE_OAUTH_PENDIENTE, { state, verificador, redirectUri: uri, t: Date.now() })) {
        return { error: 'No se pudo guardar el pedido de autorización' };
    }
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: uri,
        response_type: 'code',
        scope: SCOPE,
        code_challenge: desafio,
        code_challenge_method: 'S256',
        state,
        access_type: 'offline',   // sin esto Google no entrega refresh_token
        prompt: 'consent',        // y solo lo entrega en el consentimiento: forzarlo garantiza recibirlo al reconectar
    });
    return { url: `${AUTH_URL}?${params}` };
}

/** ¿Volvió Google con algo para este dispositivo (lo dejó oauth-callback.html)? */
function hayRetornoPendiente() { return Almacenamiento.getItem(STORAGE_KEYS.DRIVE_OAUTH_RETORNO) !== null; }

/**
 * Lee y borra lo que dejó la página de retorno y el pedido pendiente. Devuelve el code y el code_verifier si el state coincide
 * (DRV-SEC-1), o { error } si no hay nada válido. Sin red: lo usa completarConexion y se prueba solo.
 * @returns {{ code: string, verificador: string, redirectUri: string } | { error: string, cancelado?: boolean }}
 */
function tomarRetorno(ahora = Date.now()) {
    const retorno = Almacenamiento.getObject(STORAGE_KEYS.DRIVE_OAUTH_RETORNO);
    const pendiente = Almacenamiento.getObject(STORAGE_KEYS.DRIVE_OAUTH_PENDIENTE);
    Almacenamiento.removeItem(STORAGE_KEYS.DRIVE_OAUTH_RETORNO);
    Almacenamiento.removeItem(STORAGE_KEYS.DRIVE_OAUTH_PENDIENTE);

    if (!retorno || typeof retorno !== 'object') return { error: 'No hay una conexión en curso' };
    if (!pendiente || typeof pendiente !== 'object' || typeof pendiente.t !== 'number' || ahora - pendiente.t > PENDIENTE_TTL_MS || ahora < pendiente.t) {
        return { error: 'La autorización tardó demasiado: volvé a conectar' };
    }
    if (typeof retorno.state !== 'string' || retorno.state !== pendiente.state) return { error: 'La respuesta de Google no corresponde a este pedido' };
    if (retorno.error) return retorno.error === 'access_denied' ? { error: 'Se canceló la conexión con Google Drive', cancelado: true } : { error: 'Google no autorizó la conexión' };
    if (!_esTokenGoogle(retorno.code) || !OAuthPKCE.esVerificadorValido(pendiente.verificador) || typeof pendiente.redirectUri !== 'string') {
        return { error: 'La respuesta de Google no es válida' };
    }
    return { code: retorno.code, verificador: pendiente.verificador, redirectUri: pendiente.redirectUri };
}

// El access_token (1 hora) vive solo en memoria; al abrir la app se pide uno nuevo con el refresh_token
let _acceso = { token: '', vence: 0 };
/** @type {Promise<string> | null} */
let _renovando = null;

function _guardarAcceso(token, expiresIn) {
    const segundos = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600;
    _acceso = { token, vence: Date.now() + segundos * 1000 };
}

/**
 * El cuerpo de una respuesta del Worker, o lanza. `reconectar` (Google ya no acepta el permiso) olvida la cuenta, salvo en el
 * canje: un code vencido o reusado no dice nada del permiso que ya funcionaba (pentest H4).
 */
async function _respuestaWorker(res, { olvidarSiReconectar = true } = {}) {
    const cuerpo = await res.json().catch(() => ({}));
    if (res.ok) return cuerpo;
    if (cuerpo?.codigo === 'reconectar') {
        if (!olvidarSiReconectar) throw new Error('Google no aceptó la autorización (venció o ya se usó): volvé a conectar');
        olvidarCuenta();
        throw new Error('Google Drive se desconectó: volvé a conectarlo desde Ajustes → Google Drive');
    }
    throw new Error(res.status === 429 ? 'Demasiados pedidos: probá en un momento' : (cuerpo?.error || `Error ${res.status}`));
}

/**
 * Canjea el code que trajo Google (vía el Worker, que tiene el secreto del cliente) y deja la cuenta conectada.
 * @returns {Promise<{ ok: true, cuenta: string } | { ninguno: true } | { error: string, cancelado?: boolean }>}
 */
async function completarConexion() {
    if (!hayRetornoPendiente()) return { ninguno: true };
    const retorno = tomarRetorno();
    if ('error' in retorno) return retorno;
    try {
        const datos = await _respuestaWorker(await WorkerCliente.postOAuth('/api/oauth/google/exchange', {
            code: retorno.code, codeVerifier: retorno.verificador, redirectUri: retorno.redirectUri
        }), { olvidarSiReconectar: false });
        if (!_esTokenGoogle(datos?.refreshToken) || !_esTokenGoogle(datos?.accessToken)) return { error: 'Google no devolvió un permiso permanente: volvé a conectar' };
        const anterior = { token: getRefreshToken(), cuenta: getCuenta() };
        Almacenamiento.setItem(STORAGE_KEYS.DRIVE_REFRESH_TOKEN, datos.refreshToken);
        _guardarAcceso(datos.accessToken, datos.expiresIn);
        const cuenta = await _leerCuenta().catch(() => '');
        // Se pasó a otra cuenta: el permiso de la anterior seguiría valiendo y se revoca en segundo plano (pentest H3).
        // Con la misma cuenta no: Google revoca el permiso entero (también el nuevo), no un token suelto.
        if (_esTokenGoogle(anterior.token) && anterior.cuenta && cuenta && anterior.cuenta !== cuenta) {
            WorkerCliente.postOAuth('/api/oauth/google/revoke', { token: anterior.token }).catch(() => { /* si no se puede, vence solo a los 6 meses sin uso */ });
        }
        if (cuenta) Almacenamiento.setItem(STORAGE_KEYS.DRIVE_CUENTA, cuenta);
        else Almacenamiento.removeItem(STORAGE_KEYS.DRIVE_CUENTA);
        return { ok: true, cuenta };
    } catch (e) {
        return { error: e instanceof Error ? e.message : 'No se pudo conectar con Google Drive' };
    }
}

async function _tokenAcceso() {
    if (_acceso.token && _acceso.vence - MARGEN_VENCIMIENTO_MS > Date.now()) return _acceso.token;
    if (_renovando) return _renovando;
    const refreshToken = getRefreshToken();
    if (!_esTokenGoogle(refreshToken)) throw new Error('Google Drive no está conectado');
    _renovando = (async () => {
        try {
            const datos = await _respuestaWorker(await WorkerCliente.postOAuth('/api/oauth/google/refresh', { refreshToken }));
            if (!_esTokenGoogle(datos?.accessToken)) throw new Error('Google no renovó el permiso');
            _guardarAcceso(datos.accessToken, datos.expiresIn);
            return datos.accessToken;
        } finally {
            _renovando = null;
        }
    })();
    return _renovando;
}

/** Olvida la cuenta en este navegador (sin avisarle a Google). El respaldo vinculado al perfil se conserva. */
function olvidarCuenta() {
    Almacenamiento.removeItem(STORAGE_KEYS.DRIVE_REFRESH_TOKEN);
    Almacenamiento.removeItem(STORAGE_KEYS.DRIVE_CUENTA);
    _acceso = { token: '', vence: 0 };
}

/**
 * Desconecta: olvida la cuenta acá y le pide a Google (por el Worker: su endpoint de revocación no admite CORS) que anule el
 * permiso. Los archivos que la app subió quedan en el Drive (drive.file no los borra).
 * @returns {Promise<{ revocado: boolean }>}
 */
async function desconectar() {
    const refreshToken = getRefreshToken();
    olvidarCuenta();
    if (!_esTokenGoogle(refreshToken)) return { revocado: false };
    try {
        const res = await WorkerCliente.postOAuth('/api/oauth/google/revoke', { token: refreshToken });
        return { revocado: res.ok };
    } catch {
        return { revocado: false };
    }
}

// --------------------------------------------------------------------
// API de Drive
// --------------------------------------------------------------------
class ErrorDrive extends Error {
    /** @param {string} mensaje @param {number} status */
    constructor(mensaje, status) { super(mensaje); this.status = status; }
}

/** fetch a la API con el access_token; si Google lo rechaza (401) se renueva una vez y se reintenta. */
async function _driveFetch(url, opciones = {}, reintento = true) {
    const token = await _tokenAcceso();
    const res = await fetch(url, { ...opciones, headers: { ...opciones.headers, Authorization: `Bearer ${token}` } });
    if (res.status === 401 && reintento) {
        _acceso = { token: '', vence: 0 };
        return _driveFetch(url, opciones, false);
    }
    if (!res.ok) {
        const cuerpo = await res.json().catch(() => ({}));
        const mensaje = res.status === 404 ? 'No se encontró el respaldo en Drive'
            : res.status === 403 ? (cuerpo?.error?.message || 'Google Drive rechazó el pedido')
                : (cuerpo?.error?.message || `Error ${res.status}`);
        throw new ErrorDrive(mensaje, res.status);
    }
    return res;
}

async function _leerCuenta() {
    const res = await _driveFetch(`${API}/about?fields=user(emailAddress)`);
    const datos = await res.json();
    const correo = datos?.user?.emailAddress;
    return typeof correo === 'string' && correo.length <= 320 ? correo : '';
}

/** El texto de la respuesta, cortando apenas pasa el tope (Drive no recorta los archivos grandes, a diferencia del Gist). */
async function _textoAcotado(res, max = S.SECURITY_LIMITS.MAX_JSON_SIZE) {
    const declarado = Number(res.headers.get('Content-Length'));
    if (Number.isFinite(declarado) && declarado > max) throw new Error('El respaldo de Drive es demasiado grande');
    const lector = res.body?.getReader();
    if (!lector) {
        const texto = await res.text();
        if (texto.length > max) throw new Error('El respaldo de Drive es demasiado grande');
        return texto;
    }
    const decodificador = new TextDecoder();
    let texto = '';
    let bytes = 0;
    for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > max) {
            await lector.cancel().catch(() => { });
            throw new Error('El respaldo de Drive es demasiado grande');
        }
        texto += decodificador.decode(value, { stream: true });
    }
    return texto + decodificador.decode();
}

/**
 * Los respaldos de Horarios en la cuenta (con drive.file, Google solo muestra los que creó la app), del más nuevo al más viejo.
 * @returns {Promise<{ id: string, nombre: string, perfil: string, modificado: string }[]>}
 */
async function listarRespaldos() {
    const params = new URLSearchParams({
        q: "appProperties has { key='app' and value='horarios' } and trashed = false",
        fields: 'files(id,name,modifiedTime,appProperties)',
        orderBy: 'modifiedTime desc',
        pageSize: '50',
        spaces: 'drive',
    });
    const res = await _driveFetch(`${API}/files?${params}`);
    const datos = await res.json();
    const archivos = Array.isArray(datos?.files) ? datos.files : [];
    return archivos
        .filter(f => esFileIdValido(f?.id))
        .map(f => ({
            id: f.id,
            nombre: typeof f.name === 'string' ? f.name.slice(0, 200) : '',
            perfil: typeof f.appProperties?.perfil === 'string' ? f.appProperties.perfil.slice(0, MAX_NOMBRE_PERFIL) : '',
            modificado: typeof f.modifiedTime === 'string' ? f.modifiedTime : ''
        }));
}

/** Nombre legible del archivo nuevo: horarios_<perfil>.json, sin acentos ni símbolos. */
function nombreArchivo(nombrePerfil) {
    const saneado = String(nombrePerfil || 'perfil')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'perfil';
    return `horarios_${saneado}.json`;
}

async function _crearArchivo(contenido) {
    const nombrePerfil = GestorPerfiles.obtenerDatosPerfil()?.nombre || 'Perfil';
    const metadatos = {
        name: nombreArchivo(nombrePerfil),
        mimeType: 'application/json',
        description: 'Respaldo de Horarios. No lo edites a mano: la app comprueba su integridad al bajarlo.',
        appProperties: { app: 'horarios', perfil: String(nombrePerfil).slice(0, MAX_NOMBRE_PERFIL) }
    };
    const limite = `horarios-${OAuthPKCE.aleatorio(12)}`;
    const cuerpo = `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadatos)}\r\n`
        + `--${limite}\r\nContent-Type: application/json\r\n\r\n${contenido}\r\n--${limite}--`;
    const res = await _driveFetch(`${API_SUBIDA}/files?uploadType=multipart&fields=id,name`, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${limite}` },
        body: cuerpo
    });
    const datos = await res.json();
    if (!esFileIdValido(datos?.id)) throw new Error('Drive no devolvió el archivo creado');
    vincular({ id: datos.id, nombre: datos.name || metadatos.name });
    return datos.id;
}

/**
 * Sube el texto ya listo (JSON en claro o sobre cifrado) al respaldo vinculado, o crea uno nuevo si el perfil no tiene
 * (o si el vinculado ya no existe). Devuelve el id del archivo.
 * @param {string} contenido
 */
async function subir(contenido) {
    const fileId = getFileId();
    let id = '';
    if (esFileIdValido(fileId)) {
        try {
            await _driveFetch(`${API_SUBIDA}/files/${fileId}?uploadType=media&fields=id`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: contenido
            });
            id = fileId;
        } catch (e) {
            if (!(e instanceof ErrorDrive && e.status === 404)) throw e;
            vincular(null);   // lo borraron del Drive: se crea otro
        }
    }
    if (!id) id = await _crearArchivo(contenido);
    _marcarSincronizado();
    return id;
}

/** El texto del respaldo vinculado, o null si no hay vínculo o el archivo ya no está. No cuenta como sincronización. */
async function leerActual() {
    const fileId = getFileId();
    if (!esFileIdValido(fileId)) return null;
    try {
        return await _textoAcotado(await _driveFetch(`${API}/files/${fileId}?alt=media`));
    } catch (e) {
        if (e instanceof ErrorDrive && e.status === 404) return null;
        throw e;
    }
}

/**
 * Baja el texto del respaldo vinculado (en claro o cifrado). Lo abren RespaldoCifrado.abrir e ImportarExportar.prepararRespaldo,
 * igual que con el Gist o un archivo. Si el archivo ya no existe, se desvincula para poder elegir otro.
 * @returns {Promise<string>}
 */
async function bajar() {
    if (!esFileIdValido(getFileId())) throw new Error('Este perfil no tiene un respaldo de Drive vinculado');
    const texto = await leerActual();
    if (texto === null) {
        vincular(null);
        throw new Error('El respaldo vinculado ya no está en Drive: elegí otro o subí uno nuevo');
    }
    _marcarSincronizado();
    return texto;
}

export const SincronizacionDrive = {
    disponible, esFileIdValido, getRefreshToken, getCuenta, conectado, getFileId, getArchivoNombre, getLastSync, formatLastSync, listo, getCifrado, setCifrado, vincular,
    redirectUri, iniciarConexion, hayRetornoPendiente, tomarRetorno, completarConexion, olvidarCuenta, desconectar,
    listarRespaldos, nombreArchivo, subir, leerActual, bajar
};
