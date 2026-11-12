import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirApp, motivoParaSaltear } from './navegador.mjs';

// ====================================================================
// PRUEBA DE HUMO — la app en un navegador real, a ancho de celular
// ====================================================================
// Cubre lo que los tests sin DOM no ven: que la app arranca sin errores, que los controles en fila no se solapan, que los
// contenedores animan el alto (directivas de CLAUDE.md) y que el cifrado funciona de punta a punta con el `crypto` del navegador.
// No entra en `npm test`: se corre con `npm run test:humo` (necesita un Chromium instalado y python3).
// Las funciones que se pasan a `evaluar` corren DENTRO de la página: solo ven sus argumentos y `window.humo` (ayudas-pagina.js).

const saltear = motivoParaSaltear();

const REGISTRO = { id: '1762170900000', fecha: '2026-11-03', entrada: '08:15', salida: '16:40', tiempoFuera: null, horas: 8, minutos: 25, total: 8.42, objetivoHoras: 7, notas: 'Turno en el hospital' };

test('Prueba de humo en navegador', { skip: saltear ?? false }, async (t) => {
    const app = await abrirApp();
    t.after(() => app.cerrar());
    const { evaluar } = app;

    await t.test('arranca sin errores, con la configuración inicial a la vista y sin desplazamiento lateral', async () => {
        // En la primera visita la app abre sola la configuración inicial (un instante después de arrancar)
        await evaluar(() => window.humo.modalAbierto('modal-config'));
        await evaluar(() => window.humo.pausa(400));
        assert.ok(await evaluar(() => window.humo.desbordeHorizontal()) <= 0, 'la página no se desplaza hacia el costado en celular');
        assert.deepEqual(await evaluar(() => window.humo.solapes()), []);
        assert.deepEqual(app.errores, []);
    });

    await t.test('Gist: paneles abiertos sin controles solapados, y el panel de cifrado anima el alto', async () => {
        await evaluar(async () => { window.humo.clic('.config-actions .btn-gist'); await window.humo.modalAbierto('modal-gist'); });
        const alto = await evaluar(() => window.humo.altosDurante('#gist-panel-cifrado', () => window.humo.clic('#btn-gist-panel-cifrado')));
        assert.ok(alto.final > alto.inicial, `el panel se abre (${JSON.stringify(alto)})`);
        assert.ok(alto.intermedios >= 2, `el alto cambia de a poco, no de golpe (${JSON.stringify(alto)})`);

        await evaluar(async () => {
            for (const id of ['btn-gist-panel-conexion', 'btn-gist-panel-limites']) {
                if (document.getElementById(id).getAttribute('aria-expanded') !== 'true') window.humo.clic(`#${id}`);
            }
            await window.humo.pausa(500);
        });
        assert.deepEqual(await evaluar(() => window.humo.solapes()), []);
    });

    await t.test('Gist: la frase generada es válida, se ve para poder anotarla y habilita «Recordar»', async () => {
        const r = await evaluar(() => {
            const antes = document.getElementById('btn-toggle-gist-recordar').disabled;
            window.humo.clic('#btn-gist-frase-generar');
            const campo = document.getElementById('gist-frase');
            window.fraseHumo = campo.value;
            return { antes, frase: campo.value, tipo: campo.type, despues: document.getElementById('btn-toggle-gist-recordar').disabled, resumen: document.getElementById('gist-cifrado-resumen').textContent };
        });
        assert.equal(r.antes, true, 'sin frase no se puede recordar');
        assert.match(r.frase, /^([a-z]{6}-){4}[a-z]{6}$/);
        assert.equal(r.tipo, 'text');
        assert.equal(r.despues, false);
        assert.match(r.resumen, /^Activado/);
        assert.deepEqual(await evaluar(() => window.humo.solapes()), []);
    });

    await t.test('Gist (API simulada): sin frase sube en claro; al crear el Gist se habilita Bajar; con frase sube cifrado y baja con el resumen', async () => {
        const r = await evaluar(async (registro) => {
            const h = window.humo;
            const gist = { contenido: null, pedidos: [] };
            const fetchReal = window.fetch;
            window.fetch = async (url, op = {}) => {
                if (!String(url).startsWith('https://api.github.com/gists')) return fetchReal(url, op);
                const metodo = op.method || 'GET';
                gist.pedidos.push(metodo);
                if (metodo !== 'GET') gist.contenido = JSON.parse(op.body).files['horarios_backup.json'].content;
                return new Response(JSON.stringify({ id: 'a'.repeat(32), files: gist.contenido === null ? {} : { 'horarios_backup.json': { content: gist.contenido } } }), { status: 200 });
            };
            const { EstadoApp } = await import('/src/services/estado-app.js');
            const { SincronizacionGist } = await import('/src/services/sincronizacion-gist.js');
            EstadoApp._setRegistros([registro]);
            const salida = {};

            // 1. sin frase: en claro, como siempre
            const frase = document.getElementById('gist-frase');
            frase.value = ''; frase.dispatchEvent(new Event('input'));
            const token = document.getElementById('gist-token');
            token.value = 'ghp_' + 'x'.repeat(36); token.dispatchEvent(new Event('input'));
            h.clic('#btn-gist-subir');
            await h.hasta(() => gist.contenido !== null, 5000, 'subida en claro');
            await h.hasta(() => !document.getElementById('btn-gist-bajar').disabled, 3000, 'Bajar habilitado tras crear el Gist');
            salida.enClaro = gist.contenido.includes('hospital');
            salida.estado = document.getElementById('gist-estado-titulo').textContent;
            salida.ultimaSync = document.getElementById('gist-ultima-sync').textContent;

            // 2. con la frase generada: cifrado (lee antes lo que hay para no pisarlo a ciegas)
            gist.pedidos = [];
            frase.value = window.fraseHumo; frase.dispatchEvent(new Event('input'));
            h.clic('#btn-gist-subir');
            await h.hasta(() => gist.pedidos.includes('PATCH'), 10000, 'subida cifrada');
            await h.hasta(() => SincronizacionGist.getCifrado(), 3000, 'marca de Gist cifrado');
            salida.pedidos = gist.pedidos.join(',');
            salida.formato = JSON.parse(gist.contenido).formato;
            salida.muestraNota = gist.contenido.includes('hospital');

            // 3. bajar: abre con la frase y muestra el resumen
            await h.hasta(() => !document.getElementById('btn-gist-bajar').disabled);
            h.clic('#btn-gist-bajar');
            await h.modalAbierto('modal-gist-merge');
            h.clic('#btn-gist-merge-cancelar');
            await h.modalAbierto('modal-gist');
            return salida;
        }, REGISTRO);
        assert.equal(r.enClaro, true);
        assert.equal(r.estado, 'Conectado');
        assert.match(r.ultimaSync, /^Última sync: /);
        assert.equal(r.pedidos, 'GET,PATCH');
        assert.equal(r.formato, 'horarios-cifrado');
        assert.equal(r.muestraNota, false, 'el Gist cifrado no deja ver las notas');
    });

    await t.test('Gist: con otra frase pide confirmación antes de pisar, y al cancelar no cambia nada', async () => {
        const r = await evaluar(async () => {
            const h = window.humo;
            const frase = document.getElementById('gist-frase');
            frase.value = 'otra frase distinta de la anterior 123'; frase.dispatchEvent(new Event('input'));
            h.clic('#btn-gist-subir');
            await h.modalAbierto('modal-confirmar');
            const texto = document.getElementById('modal-confirmar-texto').textContent;
            h.clic('#modal-confirmar-cancel');
            await h.modalAbierto('modal-gist');
            frase.value = window.fraseHumo; frase.dispatchEvent(new Event('input'));
            h.clic('#btn-gist-guardar');
            await h.modalAbierto('modal-config');
            return texto;
        });
        assert.match(r, /no abre lo que hay en el Gist/);
    });

    await t.test('Respaldar: «Cifrar con la frase» anima el alto, no solapa controles y descarga un archivo cifrado', async () => {
        await evaluar(async () => { window.humo.clic('.config-actions .btn-export'); await window.humo.modalAbierto('modal-exportar'); await window.humo.pausa(400); });
        assert.equal(await evaluar(() => document.getElementById('btn-toggle-export-cifrar').classList.contains('btn-activo')), true, 'con frase guardada viene activado');
        assert.deepEqual(await evaluar(() => window.humo.solapes()), []);

        const cerrar = await evaluar(() => window.humo.altosDurante('#export-frase-bloque', () => window.humo.clic('#btn-toggle-export-cifrar')));
        assert.ok(cerrar.final < cerrar.inicial && cerrar.intermedios >= 2, `el bloque de la frase se cierra de a poco (${JSON.stringify(cerrar)})`);
        const abrir = await evaluar(() => window.humo.altosDurante('#export-frase-bloque', () => window.humo.clic('#btn-toggle-export-cifrar')));
        assert.ok(abrir.final > abrir.inicial && abrir.intermedios >= 2, `y se abre de a poco (${JSON.stringify(abrir)})`);

        const r = await evaluar(async () => {
            const h = window.humo;
            const blobs = [];
            const crear = URL.createObjectURL;
            URL.createObjectURL = (b) => { blobs.push(b); return crear.call(URL, b); };
            HTMLAnchorElement.prototype.click = function () { window.nombreDescarga = this.download; };   // sin descargar de verdad
            h.clic('#modal-exportar .btn-export');
            await h.hasta(() => blobs.length > 0, 10000, 'descarga del respaldo');
            window.respaldoHumo = await blobs[0].text();
            return { nombre: window.nombreDescarga, formato: JSON.parse(window.respaldoHumo).formato, muestraNota: window.respaldoHumo.includes('hospital') };
        });
        assert.match(r.nombre, /\.cifrado\.json$/);
        assert.equal(r.formato, 'horarios-cifrado');
        assert.equal(r.muestraNota, false);
    });

    await t.test('Restaurar un archivo cifrado sin frase guardada: la pide, rechaza una incorrecta y con la correcta restaura', async () => {
        const r = await evaluar(async () => {
            const h = window.humo;
            const { ImportarExportar } = await import('/src/services/importar-exportar.js');
            const { EstadoApp } = await import('/src/services/estado-app.js');
            const { FraseCifrado } = await import('/src/services/frase-cifrado.js');
            await h.hasta(() => !document.querySelector('.modal.show') || h.modales() === 'modal-config', 5000, 'cierre de Respaldar');
            FraseCifrado.olvidar();
            EstadoApp._setRegistros([]);
            ImportarExportar.importarDatos(new File([window.respaldoHumo], 'respaldo.cifrado.json', { type: 'application/json' }), 'replace');
            await h.hasta(() => h.modales() === 'modal-frase', 5000, 'pedido de la frase');
            await h.pausa(300);
            const salida = { solapes: h.solapes(), motivo: document.getElementById('modal-frase-motivo').textContent };

            document.getElementById('frase-pedida').value = 'esta frase no es la correcta para nada';
            h.clic('#btn-frase-aceptar');
            await h.hasta(() => /no abre/.test(document.getElementById('modal-frase-motivo').textContent) && h.modales() === 'modal-frase', 10000, 'rechazo de la frase incorrecta');

            document.getElementById('frase-pedida').value = window.fraseHumo;
            h.clic('#btn-frase-aceptar');
            await h.hasta(() => EstadoApp.registros().length === 1, 10000, 'restauración');
            salida.nota = EstadoApp.registros()[0].notas;
            salida.fraseGuardada = FraseCifrado.actual();
            return salida;
        });
        assert.deepEqual(r.solapes, []);
        assert.match(r.motivo, /está cifrado/);
        assert.equal(r.nota, 'Turno en el hospital');
        assert.equal(r.fraseGuardada, '', 'la frase escrita para un archivo no queda guardada');
    });

    await t.test('escritorio: sin desplazamiento lateral ni controles solapados, y sin errores en toda la corrida', async () => {
        await app.tamano(1280, 800, false);
        await evaluar(() => window.humo.pausa(600));
        assert.ok(await evaluar(() => window.humo.desbordeHorizontal()) <= 0);
        assert.deepEqual(await evaluar(() => window.humo.solapes()), []);
        assert.deepEqual(app.errores, []);
    });
});
