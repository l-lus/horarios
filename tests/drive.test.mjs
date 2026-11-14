import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

// Google Drive sin DOM: PKCE, el retorno de Google, el vínculo con el perfil y la API simulada.
const store = new Map();
globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
};
globalThis.window = globalThis;
globalThis.addEventListener = () => { };
globalThis.requestAnimationFrame = () => 0;
globalThis.matchMedia = () => ({ matches: false, addEventListener: () => { } });

const { OAuthPKCE } = await import('../src/services/oauth-pkce.js');
const { SincronizacionDrive: D } = await import('../src/services/sincronizacion-drive.js');
const { SincronizacionGist } = await import('../src/services/sincronizacion-gist.js');
const { GestorPerfiles } = await import('../src/services/gestor-perfiles.js');
const { STORAGE_KEYS, APP_STORAGE_PREFIX } = await import('../src/core/constantes.js');
GestorPerfiles.inicializar();

const BASE = 'https://lushibosca.github.io/horarios/index.html?x=1#y';
const FILE_ID = '1AbCdEfGhIjKlMnOpQrStUv';
const REFRESH = '1//0gRefreshTokenDePrueba-abc_def';

/** Simula el Worker y la API de Drive. Devuelve los pedidos que se hicieron. */
function simularRed(t, rutas) {
    const pedidos = [];
    const original = globalThis.fetch;
    globalThis.fetch = async (url, op = {}) => {
        const u = String(url);
        pedidos.push({ url: u, metodo: op.method || 'GET', op });
        for (const [patron, responder] of rutas) {
            if (u.includes(patron)) return responder(u, op);
        }
        return new Response('{}', { status: 599 });
    };
    t.after(() => { globalThis.fetch = original; });
    return pedidos;
}
const json = (datos, status = 200) => new Response(JSON.stringify(datos), { status, headers: { 'Content-Type': 'application/json' } });

test('OAuthPKCE: el code_challenge es el SHA-256 en base64url del verificador y los pedidos nuevos son válidos y distintos', async () => {
    const verificador = 'dBjftJeZ4CVP-mJ92K1qaAy4s3rVvR8wATF7bKqVkWc';
    assert.equal(await OAuthPKCE.desafioS256(verificador), createHash('sha256').update(verificador).digest('base64url'));
    const a = await OAuthPKCE.nuevoPedido();
    const b = await OAuthPKCE.nuevoPedido();
    assert.equal(OAuthPKCE.esVerificadorValido(a.verificador), true);
    assert.equal(a.state.length, 43);
    assert.notEqual(a.state, b.state);
    assert.notEqual(a.verificador, b.verificador);
    assert.equal(a.desafio, await OAuthPKCE.desafioS256(a.verificador));
    assert.equal(OAuthPKCE.esVerificadorValido('corto'), false);
    assert.equal(OAuthPKCE.esVerificadorValido('a'.repeat(43) + ' '), false);
});

test('Drive: sin cliente configurado no se puede conectar; con cliente arma la URL de Google con PKCE, offline y la URI de retorno exacta', async () => {
    assert.equal(D.disponible(), false);
    assert.ok('error' in await D.iniciarConexion(BASE));

    const r = await D.iniciarConexion(BASE, { clientId: 'cliente.apps.googleusercontent.com' });
    assert.ok('url' in r);
    const url = new URL(r.url);
    assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
    const p = url.searchParams;
    assert.equal(p.get('redirect_uri'), 'https://lushibosca.github.io/horarios/oauth-callback.html');
    assert.equal(p.get('scope'), 'https://www.googleapis.com/auth/drive.file');
    assert.equal(p.get('response_type'), 'code');
    assert.equal(p.get('code_challenge_method'), 'S256');
    assert.equal(p.get('access_type'), 'offline');
    assert.equal(p.get('prompt'), 'consent');
    const pendiente = JSON.parse(store.get(APP_STORAGE_PREFIX + STORAGE_KEYS.DRIVE_OAUTH_PENDIENTE));
    assert.equal(pendiente.state, p.get('state'));
    assert.equal(p.get('code_challenge'), await OAuthPKCE.desafioS256(pendiente.verificador));
    store.clear();
});

test('Drive: la página de retorno escribe la misma clave que lee la app', () => {
    const script = fs.readFileSync('src/oauth-callback.js', 'utf8');
    assert.match(script, new RegExp(`'${APP_STORAGE_PREFIX}${STORAGE_KEYS.DRIVE_OAUTH_RETORNO}'`));
    assert.match(script, /history\.replaceState/);
    const html = fs.readFileSync('oauth-callback.html', 'utf8');
    assert.match(html, /default-src 'none'/);
    assert.match(html, /name="referrer" content="no-referrer"/);
});

test('Drive: el retorno se acepta solo con el state del pedido, dentro de los 10 minutos y una sola vez', async () => {
    const preparar = async (retorno) => {
        await D.iniciarConexion(BASE, { clientId: 'c' });
        const { state } = JSON.parse(store.get(APP_STORAGE_PREFIX + STORAGE_KEYS.DRIVE_OAUTH_PENDIENTE));
        store.set(APP_STORAGE_PREFIX + STORAGE_KEYS.DRIVE_OAUTH_RETORNO, JSON.stringify({ state, ...retorno }));
        return state;
    };

    await preparar({ code: '4/0AXcodigo-de_prueba' });
    const ok = D.tomarRetorno();
    assert.equal(ok.code, '4/0AXcodigo-de_prueba');
    assert.equal(ok.redirectUri, 'https://lushibosca.github.io/horarios/oauth-callback.html');
    assert.ok('error' in D.tomarRetorno(), 'se consume: un segundo intento no sirve');
    assert.equal(D.hayRetornoPendiente(), false);

    await preparar({ code: '4/0AXotro' });
    store.set(APP_STORAGE_PREFIX + STORAGE_KEYS.DRIVE_OAUTH_RETORNO, JSON.stringify({ state: 'de-otro-pedido', code: '4/0AXotro' }));
    assert.match(D.tomarRetorno().error, /no corresponde/);

    await preparar({ code: '4/0AXtarde' });
    assert.match(D.tomarRetorno(Date.now() + 11 * 60 * 1000).error, /tardó/);

    await preparar({ error: 'access_denied' });
    assert.equal(D.tomarRetorno().cancelado, true);

    await preparar({ code: 'con espacios <script>' });
    assert.ok('error' in D.tomarRetorno());
    store.clear();
});

test('Drive: completar la conexión canjea el code por el Worker y guarda el refresh_token y la cuenta', async (t) => {
    const pedidos = simularRed(t, [
        ['/api/oauth/google/exchange', () => json({ accessToken: 'ya29.acceso', refreshToken: REFRESH, expiresIn: 3599 })],
        ['/drive/v3/about', () => json({ user: { emailAddress: 'alguien@example.com' } })],
    ]);
    await D.iniciarConexion(BASE, { clientId: 'c' });
    const { state, verificador } = JSON.parse(store.get(APP_STORAGE_PREFIX + STORAGE_KEYS.DRIVE_OAUTH_PENDIENTE));
    store.set(APP_STORAGE_PREFIX + STORAGE_KEYS.DRIVE_OAUTH_RETORNO, JSON.stringify({ state, code: '4/0AXcodigo' }));

    const r = await D.completarConexion();
    assert.deepEqual(r, { ok: true, cuenta: 'alguien@example.com' });
    assert.equal(D.conectado(), true);
    assert.equal(D.getCuenta(), 'alguien@example.com');
    const canje = JSON.parse(pedidos[0].op.body);
    assert.deepEqual(canje, { code: '4/0AXcodigo', codeVerifier: verificador, redirectUri: 'https://lushibosca.github.io/horarios/oauth-callback.html' });
    assert.equal(pedidos[1].op.headers.Authorization, 'Bearer ya29.acceso');
});

test('Drive: subir crea el respaldo la primera vez, después lo actualiza, y si lo borraron crea otro', async (t) => {
    let creados = 0;
    let existe = true;
    const pedidos = simularRed(t, [
        ['/api/oauth/google/refresh', () => json({ accessToken: 'ya29.renovado', expiresIn: 3600 })],
        ['/upload/drive/v3/files?uploadType=multipart', () => { creados++; return json({ id: FILE_ID + creados, name: 'horarios_principal.json' }); }],
        [`/upload/drive/v3/files/`, () => (existe ? json({ id: FILE_ID + 1 }) : json({ error: { message: 'File not found' } }, 404))],
    ]);
    store.set(APP_STORAGE_PREFIX + STORAGE_KEYS.DRIVE_REFRESH_TOKEN, REFRESH);
    D.vincular(null);

    assert.equal(await D.subir('{"registros":[]}'), FILE_ID + 1);
    assert.equal(D.getFileId(), FILE_ID + 1);
    assert.equal(D.getArchivoNombre(), 'horarios_principal.json');
    assert.equal(D.listo(), true);
    const multipart = pedidos.find(p => p.url.includes('multipart'));
    assert.match(multipart.op.body, /"appProperties":\{"app":"horarios","perfil":"Principal"\}/);
    assert.match(multipart.op.body, /\{"registros":\[\]\}/);

    assert.equal(await D.subir('{"registros":[1]}'), FILE_ID + 1);
    assert.equal(creados, 1);
    assert.equal(pedidos.at(-1).metodo, 'PATCH');

    existe = false;
    assert.equal(await D.subir('{"registros":[2]}'), FILE_ID + 2);
    assert.equal(creados, 2);
    assert.ok(D.getLastSync());
});

test('Drive: bajar lee el respaldo vinculado, corta los demasiado grandes y desvincula si ya no existe', async (t) => {
    let cuerpo = '{"registros":[]}';
    let existe = true;
    simularRed(t, [
        ['/api/oauth/google/refresh', () => json({ accessToken: 'ya29.renovado', expiresIn: 3600 })],
        ['?alt=media', () => (existe ? new Response(cuerpo, { status: 200 }) : json({}, 404))],
    ]);
    store.set(APP_STORAGE_PREFIX + STORAGE_KEYS.DRIVE_REFRESH_TOKEN, REFRESH);
    D.vincular({ id: FILE_ID, nombre: 'horarios_principal.json' });

    assert.equal(await D.bajar(), cuerpo);
    cuerpo = 'x'.repeat(6 * 1024 * 1024);
    await assert.rejects(D.bajar(), /demasiado grande/);
    existe = false;
    await assert.rejects(D.bajar(), /ya no está/);
    assert.equal(D.getFileId(), '');
});

test('Drive: si Google ya no acepta el refresh_token, la cuenta queda desconectada y se pide reconectar', async (t) => {
    simularRed(t, [['/api/oauth/google/refresh', () => json({ error: 'reconectar', codigo: 'reconectar' }, 401)]]);
    store.set(APP_STORAGE_PREFIX + STORAGE_KEYS.DRIVE_REFRESH_TOKEN, REFRESH + 'x');
    D.olvidarCuenta();   // sin access_token en memoria
    store.set(APP_STORAGE_PREFIX + STORAGE_KEYS.DRIVE_REFRESH_TOKEN, REFRESH + 'x');
    D.vincular({ id: FILE_ID });
    await assert.rejects(D.bajar(), /volvé a conectarlo/);
    assert.equal(D.conectado(), false);
    assert.equal(D.getFileId(), FILE_ID, 'el vínculo del perfil se conserva para reconectar');
});

test('Drive: desconectar olvida la cuenta aunque el Worker no responda', async (t) => {
    simularRed(t, [['/api/oauth/google/revoke', () => { throw new TypeError('sin red'); }]]);
    store.set(APP_STORAGE_PREFIX + STORAGE_KEYS.DRIVE_REFRESH_TOKEN, REFRESH);
    store.set(APP_STORAGE_PREFIX + STORAGE_KEYS.DRIVE_CUENTA, 'alguien@example.com');
    assert.deepEqual(await D.desconectar(), { revocado: false });
    assert.equal(D.conectado(), false);
    assert.equal(D.getCuenta(), '');
});

test('Drive: vincular valida el id y olvida el cifrado al cambiar de archivo; el nombre del archivo se sanea', () => {
    D.vincular({ id: FILE_ID });
    D.setCifrado(true);
    assert.equal(D.vincular({ id: '../../files' }), false);
    assert.equal(D.getFileId(), FILE_ID);
    assert.equal(D.getCifrado(), true);
    D.vincular({ id: FILE_ID });
    assert.equal(D.getCifrado(), true, 'el mismo archivo conserva la marca');
    D.vincular({ id: FILE_ID + 'otro' });
    assert.equal(D.getCifrado(), false);

    assert.equal(D.nombreArchivo('Señor Ñandú / Turno noche'), 'horarios_senor-nandu-turno-noche.json');
    assert.equal(D.nombreArchivo('***'), 'horarios_perfil.json');
    D.vincular(null);
});

test('ConfigSync: Gist y Drive guardan su automatización en campos propios del perfil, y el perfil los conserva', () => {
    SincronizacionGist.setAutoSync(2);
    D.setAutoSync(1);
    D.setRangoHorario('08:00', '09:00');
    D.setSyncLimite('bajar', 5);
    const perfil = GestorPerfiles.obtenerDatosPerfil();
    assert.equal(perfil.gistAutoSync, 2);
    assert.equal(perfil.driveAutoSync, 1);
    assert.equal(perfil.driveRangoDesde, '08:00');
    assert.equal(SincronizacionGist.getRangoHorario().desde, '21:00');
    assert.equal(store.get(APP_STORAGE_PREFIX + 'driveSyncLimite_bajar'), '5');
    assert.equal(SincronizacionGist.getSyncLimite('bajar'), 2);

    D.vincular({ id: FILE_ID, nombre: 'horarios_principal.json' });
    GestorPerfiles.guardarDatosPerfilActual();
    const guardado = GestorPerfiles.obtenerDatosPerfil();
    assert.equal(guardado.driveFileId, FILE_ID);
    assert.equal(guardado.driveAutoSync, 1);
    assert.equal(guardado.gistAutoSync, 2);
    assert.ok(GestorPerfiles.CAMPOS_SYNC_DRIVE.includes('driveAutoSync'));
    assert.ok(!GestorPerfiles.CAMPOS_SYNC_DRIVE.includes('driveFileId'), 'restablecer el perfil conserva el vínculo');
});
