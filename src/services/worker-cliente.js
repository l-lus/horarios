// ====================================================================
// WORKER horarios-push — dirección y cabeceras comunes (recordatorios push, estadísticas y OAuth de Google Drive)
// ====================================================================
const WORKER_URL = 'https://horarios-push.lushibosca.workers.dev';
// El OAuth de Google Drive todavía se prueba en el Worker de la cuenta de pruebas (l-lus, `wrangler deploy --env pruebas`).
// Al pasar Drive a producción: igualarlo a WORKER_URL y sacar este dominio del connect-src de index.html.
const WORKER_OAUTH_URL = 'https://horarios-push.l-lus.workers.dev';
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
