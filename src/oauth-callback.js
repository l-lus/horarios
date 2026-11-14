// ====================================================================
// RETORNO DE GOOGLE (oauth-callback.html) — se ejecuta solo, fuera de la app
// ====================================================================
// Google vuelve acá con ?code=…&state=… (o ?error=…). Esta página no canjea nada: borra la query de la barra y del
// historial (DRV-SEC-3), deja el resultado en localStorage para la app y vuelve a ella. La app verifica el state contra
// el pedido que guardó al salir (SincronizacionDrive.tomarRetorno) y canjea el code con el code_verifier por el Worker.
// Sin imports: es la única página aparte y no carga la app. La clave coincide con STORAGE_KEYS.DRIVE_OAUTH_RETORNO
// con el prefijo de Almacenamiento (horarios_).
const CLAVE_RETORNO = 'horarios_driveOauthRetorno';

const params = new URLSearchParams(location.search);
history.replaceState(null, '', location.pathname);

/** @param {string | null} v @param {number} max */
const texto = (v, max) => (typeof v === 'string' && v.length <= max ? v : '');
const state = texto(params.get('state'), 128);
if (state) {
    try {
        localStorage.setItem(CLAVE_RETORNO, JSON.stringify({
            code: texto(params.get('code'), 2048),
            state,
            error: texto(params.get('error'), 100),
        }));
    } catch { /* sin almacenamiento la app avisa que no hay conexión en curso */ }
}
location.replace('./');
