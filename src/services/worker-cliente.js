// ====================================================================
// WORKER horarios-push — dirección y cabeceras comunes (recordatorios push, estadísticas y OAuth de Google Drive)
// ====================================================================
const WORKER_URL = 'https://horarios-push.lushibosca.workers.dev';
const APP_SECRET = '487e4c492604b653b56e9ba234cb9eda007fc149c66650e9'; // que mira bobo, anda paya

function cabeceras() {
    return { 'Content-Type': 'application/json', 'X-App-Secret': APP_SECRET };
}

/** POST con JSON al Worker. Devuelve la Response (no lanza por estados HTTP; sí por errores de red). */
function post(path, payload, keepalive = false) {
    return fetch(`${WORKER_URL}${path}`, {
        method: 'POST',
        headers: cabeceras(),
        body: JSON.stringify(payload),
        keepalive: !!keepalive
    });
}

export const WorkerCliente = { WORKER_URL, cabeceras, post };
