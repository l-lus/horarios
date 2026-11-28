// ====================================================================
// WORKER horarios-push — dirección y cabeceras comunes (recordatorios push, estadísticas y OAuth de Google Drive)
// ====================================================================
// Publicada (l-lus.github.io o lushibosca.github.io), la app usa el Worker de producción. Abierta en la computadora
// (localhost) usa el de pruebas (cuenta l-lus, `wrangler deploy --env pruebas`): el de producción no acepta localhost.
const WORKER_PRODUCCION = 'https://horarios-push.lushibosca.workers.dev';
const WORKER_PRUEBAS = 'https://horarios-push.l-lus.workers.dev';
const _esLocal = ['localhost', '127.0.0.1'].includes(globalThis.location?.hostname ?? '');
const WORKER_URL = _esLocal ? WORKER_PRUEBAS : WORKER_PRODUCCION;
// El OAuth de Google Drive va al mismo Worker
const WORKER_OAUTH_URL = WORKER_URL;
const APP_SECRET = '487e4c492604b653b56e9ba234cb9eda007fc149c66650e9'; // que mira bobo, anda paya

function cabeceras() {
    return { 'Content-Type': 'application/json', 'X-App-Secret': APP_SECRET };
}

/** POST con JSON al Worker. Devuelve la Response (no lanza por estados HTTP; sí por errores de red). */
function post(path, payload, keepalive = false, base = WORKER_URL) {
    return fetch(`${base}${path}`, {
        method: 'POST',
        headers: cabeceras(),
        body: JSON.stringify(payload),
        keepalive: !!keepalive
    });
}

/** POST a las rutas de OAuth de Google Drive (/api/oauth/google/…). */
function postOAuth(path, payload) { return post(path, payload, false, WORKER_OAUTH_URL); }

export const WorkerCliente = { WORKER_URL, WORKER_OAUTH_URL, cabeceras, post, postOAuth };
