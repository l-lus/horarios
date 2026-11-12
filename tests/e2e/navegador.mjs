// Navegador sin ventana manejado por el protocolo DevTools (CDP), sin dependencias: lo usa la prueba de humo.
// Busca un Chromium instalado (o el de CHROME_BIN), lo abre con un perfil temporal y sirve la app con scripts/servidor.py.
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const CANDIDATOS = ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'brave-browser', 'microsoft-edge'];
const ESPERA_ARRANQUE_MS = 15000;

const esperar = ms => new Promise(r => setTimeout(r, ms));

function buscarNavegador() {
    if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
    return CANDIDATOS.find(bin => spawnSync('which', [bin]).status === 0) ?? null;
}

/** Por qué no se puede correr la prueba (texto para `skip`), o null si se puede. */
export function motivoParaSaltear() {
    if (typeof WebSocket === 'undefined') return 'hace falta Node 22 o superior (WebSocket global)';
    if (spawnSync('python3', ['--version']).status !== 0) return 'sin python3 (lo usa el servidor de desarrollo)';
    if (!buscarNavegador()) return `sin navegador Chromium (probé ${CANDIDATOS.join(', ')}; o definí CHROME_BIN)`;
    return null;
}

const puertoLibre = () => new Promise((ok, no) => {
    const s = net.createServer();
    s.once('error', no);
    s.listen(0, '127.0.0.1', () => { const { port } = /** @type {net.AddressInfo} */ (s.address()); s.close(() => ok(port)); });
});

/** Mata el proceso y sus hijos (el lanzador del navegador suele ser un script que abre otro proceso). */
function matarGrupo(proceso) {
    try { process.kill(-proceso.pid, 'SIGKILL'); } catch { try { proceso.kill('SIGKILL'); } catch { /* ya terminó */ } }
}

/**
 * Abre la app en un navegador sin ventana. Devuelve la página (ver los métodos abajo) y `cerrar()`.
 * @param {{ ancho?: number, alto?: number, movil?: boolean }} [opciones]
 */
export async function abrirApp({ ancho = 360, alto = 780, movil = true } = {}) {
    const puerto = await puertoLibre();
    const servidor = spawn('python3', ['scripts/servidor.py', String(puerto), '127.0.0.1', process.cwd()], { stdio: 'ignore', detached: true });
    const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'horarios-humo-'));
    const navegador = spawn(/** @type {string} */ (buscarNavegador()), [
        '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-gpu',
        ...(process.env.CI ? ['--no-sandbox'] : []),
        `--user-data-dir=${perfil}`, '--remote-debugging-port=0', 'about:blank',
    ], { stdio: ['ignore', 'ignore', 'pipe'], detached: true });

    const cerrar = async () => {
        matarGrupo(navegador);
        matarGrupo(servidor);
        await esperar(200);
        fs.rmSync(perfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    };

    try {
        // El navegador anuncia por stderr en qué puerto quedó escuchando DevTools
        const puertoCdp = await new Promise((ok, no) => {
            let salida = '';
            const limite = setTimeout(() => no(new Error(`el navegador no arrancó: ${salida.slice(-300)}`)), ESPERA_ARRANQUE_MS);
            navegador.stderr.on('data', d => {
                salida += d;
                const m = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//.exec(salida);
                if (m) { clearTimeout(limite); ok(Number(m[1])); }
            });
            navegador.once('exit', () => { clearTimeout(limite); no(new Error(`el navegador se cerró al arrancar: ${salida.slice(-300)}`)); });
        });
        const destinos = await (await fetch(`http://127.0.0.1:${puertoCdp}/json/list`)).json();
        const ws = new WebSocket(destinos.find(d => d.type === 'page').webSocketDebuggerUrl);
        await new Promise((ok, no) => { ws.addEventListener('open', ok); ws.addEventListener('error', no); });

        let ultimoId = 0;
        const pendientes = new Map();
        /** @type {string[]} */
        const errores = [];
        ws.addEventListener('message', e => {
            const m = JSON.parse(String(e.data));
            if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); }
            if (m.method === 'Runtime.exceptionThrown') errores.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
            if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errores.push(m.params.args.map(a => a.value ?? a.description).join(' '));
        });
        const cdp = (metodo, params = {}) => new Promise(r => { const id = ++ultimoId; pendientes.set(id, r); ws.send(JSON.stringify({ id, method: metodo, params })); });

        /**
         * Ejecuta una función dentro de la página y devuelve su resultado (tiene que poder pasar por JSON).
         * La función se manda como texto: no ve las variables de este archivo, solo sus argumentos y `window.humo` (ayudas.js).
         */
        const evaluar = async (fn, ...args) => {
            const r = await cdp('Runtime.evaluate', { expression: `(${fn})(...${JSON.stringify(args)})`, awaitPromise: true, returnByValue: true });
            const detalle = r.result?.exceptionDetails;
            if (detalle) throw new Error(`en la página: ${detalle.exception?.description || detalle.text}`);
            return r.result.result.value;
        };
        const tamano = (w, h, esMovil) => cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: esMovil });

        await cdp('Runtime.enable');
        await cdp('Page.enable');
        await tamano(ancho, alto, movil);
        await cdp('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(new URL('./ayudas-pagina.js', import.meta.url), 'utf8') });
        await cdp('Page.navigate', { url: `http://localhost:${puerto}/index.html` });
        // La app terminó de arrancar cuando enlazó sus eventos: el botón de Gist responde
        await evaluar(() => window.humo.hasta(() => document.readyState === 'complete' && !!document.querySelector('.config-actions .btn-gist')));
        await esperar(600);

        return { evaluar, tamano, errores, cerrar };
    } catch (err) {
        await cerrar();
        throw err;
    }
}
