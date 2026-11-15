import { ConfigSync } from './config-sync.js';
import { SincronizacionGist } from './sincronizacion-gist.js';
import { SincronizacionDrive } from './sincronizacion-drive.js';

// ====================================================================
// DESTINO PRINCIPAL DEL RESPALDO — a dónde van la sincronización automática y los botones rápidos del histórico
// ====================================================================
// Cada perfil tiene un destino principal: el archivo local, el Gist o Google Drive. Es el que la persona marcó en
// «Respaldo y sincronización»; mientras no marque ninguno, se deduce de lo que tenga conectado.

/** @typedef {'local' | 'gist' | 'drive'} Destino */

const NOMBRES = Object.freeze({ local: 'Archivo local', gist: 'GitHub Gist', drive: 'Google Drive' });

/** ¿El destino está en condiciones de subir y bajar sin preguntar nada? El archivo local siempre. @param {Destino} destino */
function listo(destino) {
    if (destino === 'gist') return SincronizacionGist.listo();
    if (destino === 'drive') return SincronizacionDrive.listo();
    return true;
}

/**
 * El destino principal del perfil: el elegido o, sin elección, el único servicio listo (con los dos, el último que se
 * sincronizó) y, si no hay ninguno, el archivo local.
 * @returns {Destino}
 */
function principal() {
    const elegido = ConfigSync.getDestino();
    if (elegido) return elegido;
    const gist = listo('gist');
    const drive = listo('drive');
    if (gist && drive) {
        const fecha = (iso) => new Date(iso || 0).getTime() || 0;
        return fecha(SincronizacionDrive.getLastSync()) > fecha(SincronizacionGist.getLastSync()) ? 'drive' : 'gist';
    }
    return gist ? 'gist' : drive ? 'drive' : 'local';
}

/** La nube que usan la sincronización automática y los botones rápidos: el destino principal si es un servicio y está listo; si no, null. */
function nubeActiva() {
    const destino = principal();
    return destino !== 'local' && listo(destino) ? destino : null;
}

/**
 * Qué toca hacer al abrir la app: 'subir' o 'bajar' con la nube activa, o null (sin automatizar, fuera de la franja horaria
 * o con el límite por hora alcanzado).
 * @returns {{ destino: 'gist' | 'drive', tipo: 'subir' | 'bajar' } | null}
 */
function automaticaPendiente() {
    const destino = nubeActiva();
    const modo = ConfigSync.getAutoSync();
    if (!destino || modo === 0) return null;
    const tipo = modo === 1 ? 'bajar' : 'subir';
    if (!ConfigSync.dentroDelRangoHorario() || ConfigSync.superaLimite(tipo)) return null;
    return { destino, tipo };
}

export const DestinoRespaldo = { NOMBRES, listo, principal, nubeActiva, automaticaPendiente };
