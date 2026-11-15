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

    await t.test('Respaldo y sincronización: destinos y paneles sin controles solapados, y el panel de cifrado anima el alto', async () => {
        await evaluar(async () => { window.humo.clic('#btn-abrir-respaldo'); await window.humo.modalAbierto('modal-respaldo'); await window.humo.pausa(400); });
        assert.deepEqual(await evaluar(() => window.humo.solapes()), []);
        const alto = await evaluar(() => window.humo.altosDurante('#sync-panel-cifrado', () => window.humo.clic('#btn-sync-panel-cifrado')));
        assert.ok(alto.final > alto.inicial, `el panel se abre (${JSON.stringify(alto)})`);
        assert.ok(alto.intermedios >= 2, `el alto cambia de a poco, no de golpe (${JSON.stringify(alto)})`);

        const r = await evaluar(async () => {
            window.humo.clic('#btn-sync-panel-limites');
            await window.humo.pausa(500);
            const pulsado = (d) => document.getElementById(`btn-principal-${d}`).getAttribute('aria-pressed');
            return { solapes: window.humo.solapes(), principal: ['local', 'gist', 'drive'].map(pulsado).join(','), automatica: document.getElementById('btn-toggle-sync-backup').disabled, subirGist: document.getElementById('btn-gist-subir').disabled };
        });
        assert.deepEqual(r.solapes, []);
        assert.equal(r.principal, 'true,false,false', 'sin nada conectado el principal es el archivo local');
        assert.equal(r.automatica, true, 'el archivo local no se sincroniza solo');
        assert.equal(r.subirGist, true);
    });

    await t.test('Cifrado: la frase generada es válida, se ve para poder anotarla y habilita «Recordar»', async () => {
        const r = await evaluar(() => {
            const antes = document.getElementById('btn-toggle-sync-recordar').disabled;
            window.humo.clic('#btn-sync-frase-generar');
            const campo = document.getElementById('sync-frase');
            window.fraseHumo = campo.value;
            return { antes, frase: campo.value, tipo: campo.type, despues: document.getElementById('btn-toggle-sync-recordar').disabled, resumen: document.getElementById('sync-cifrado-resumen').textContent };
        });
        assert.equal(r.antes, true, 'sin frase no se puede recordar');
        assert.match(r.frase, /^([a-z]{6}-){4}[a-z]{6}$/);
        assert.equal(r.tipo, 'text');
        assert.equal(r.despues, false);
        assert.match(r.resumen, /^Activado/);
        assert.deepEqual(await evaluar(() => window.humo.solapes()), []);
    });

    await t.test('Gist (API simulada): la conexión se carga en su modal; sin frase sube en claro y queda como principal; con frase sube cifrado y baja con el resumen', async () => {
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
            const estado = () => document.getElementById('destino-gist-estado').textContent;

            // 0. la conexión: en el modal del Gist, que vuelve al de respaldo (la frase escrita ahí sigue en borrador)
            h.clic('#btn-gist-configurar'); await h.modalAbierto('modal-gist');
            await h.pausa(300);
            salida.solapesConexion = h.solapes();
            const token = document.getElementById('gist-token');
            token.value = 'ghp_' + 'x'.repeat(36); token.dispatchEvent(new Event('input'));
            h.clic('#btn-gist-guardar'); await h.modalAbierto('modal-respaldo');
            salida.soloToken = estado();
            salida.bajarSinGist = document.getElementById('btn-gist-bajar').disabled;
            salida.borrador = document.getElementById('sync-frase').value === window.fraseHumo;

            // 1. sin frase: en claro, como siempre
            const frase = document.getElementById('sync-frase');
            frase.value = ''; frase.dispatchEvent(new Event('input'));
            h.clic('#btn-gist-subir');
            await h.hasta(() => gist.contenido !== null, 5000, 'subida en claro');
            await h.hasta(() => !document.getElementById('btn-gist-bajar').disabled, 3000, 'Bajar habilitado tras crear el Gist');
            salida.enClaro = gist.contenido.includes('hospital');
            salida.estado = estado();
            salida.principal = document.getElementById('btn-principal-gist').getAttribute('aria-pressed');
            salida.automatica = document.getElementById('btn-toggle-sync-backup').disabled;

            // 2. con la frase generada: cifrado (lee antes lo que hay para no pisarlo a ciegas)
            gist.pedidos = [];
            frase.value = window.fraseHumo; frase.dispatchEvent(new Event('input'));
            h.clic('#btn-gist-subir');
            await h.hasta(() => gist.pedidos.includes('PATCH'), 10000, 'subida cifrada');
            await h.hasta(() => SincronizacionGist.getCifrado(), 3000, 'marca de Gist cifrado');
            await h.hasta(() => /cifrado/.test(estado()), 3000, 'estado del destino al día');
            salida.pedidos = gist.pedidos.join(',');
            salida.formato = JSON.parse(gist.contenido).formato;
            salida.muestraNota = gist.contenido.includes('hospital');

            // 3. bajar: abre con la frase y muestra el resumen
            await h.hasta(() => !document.getElementById('btn-gist-bajar').disabled);
            h.clic('#btn-gist-bajar');
            await h.modalAbierto('modal-gist-merge');
            h.clic('#btn-gist-merge-cancelar');
            await h.modalAbierto('modal-respaldo');
            await h.pausa(300);
            salida.solapes = h.solapes();
            return salida;
        }, REGISTRO);
        assert.deepEqual(r.solapesConexion, []);
        assert.match(r.soloToken, /^Token cargado/);
        assert.equal(r.bajarSinGist, true);
        assert.equal(r.borrador, true, 'ir a la conexión y volver no pierde lo escrito');
        assert.equal(r.enClaro, true);
        assert.match(r.estado, /^Conectado · última sync: /);
        assert.equal(r.principal, 'true', 'el único servicio listo pasa a ser el destino principal');
        assert.equal(r.automatica, false, 'y ya se puede automatizar');
        assert.equal(r.pedidos, 'GET,PATCH');
        assert.equal(r.formato, 'horarios-cifrado');
        assert.equal(r.muestraNota, false, 'el Gist cifrado no deja ver las notas');
        assert.deepEqual(r.solapes, []);
    });

    await t.test('Gist: con otra frase pide confirmación antes de pisar, y al cancelar no cambia nada', async () => {
        const r = await evaluar(async () => {
            const h = window.humo;
            const frase = document.getElementById('sync-frase');
            frase.value = 'otra frase distinta de la anterior 123'; frase.dispatchEvent(new Event('input'));
            h.clic('#btn-gist-subir');
            await h.modalAbierto('modal-confirmar');
            const texto = document.getElementById('modal-confirmar-texto').textContent;
            h.clic('#modal-confirmar-cancel');
            await h.modalAbierto('modal-respaldo');
            frase.value = window.fraseHumo; frase.dispatchEvent(new Event('input'));
            return texto;
        });
        assert.match(r, /no abre lo que hay en el Gist/);
    });

    await t.test('Destino principal: los botones rápidos del histórico y el resumen de Ajustes siguen al elegido', async () => {
        const r = await evaluar(async () => {
            const h = window.humo;
            const rapido = () => document.getElementById('btn-hist-respaldar').title;
            const resumen = () => document.getElementById('respaldo-resumen').textContent;
            const salida = { conGist: rapido() };
            h.clic('#btn-principal-local');
            salida.conLocal = rapido();
            salida.resumenLocal = resumen();
            salida.automaticaLocal = document.getElementById('btn-toggle-sync-backup').disabled;
            h.clic('#btn-principal-gist');
            h.clic('#btn-toggle-sync-backup'); h.clic('#btn-toggle-sync-backup');   // sin automatizar → restaurar → respaldar
            h.clic('#btn-respaldo-guardar');
            await h.modalAbierto('modal-config');
            salida.resumenGist = resumen();
            salida.rapidoGist = rapido();
            return salida;
        });
        assert.deepEqual(r, {
            conGist: 'Subir a Gist', conLocal: 'Respaldar', resumenLocal: 'Principal: Archivo local', automaticaLocal: true,
            resumenGist: 'Principal: GitHub Gist · respalda al abrir', rapidoGist: 'Subir a Gist'
        });
    });

    await t.test('Respaldar y Restaurar: desde el modal de respaldo vuelven a él; abiertos sin modales (barra del histórico) se cierran sin dejar nada', async () => {
        const r = await evaluar(async () => {
            const h = window.humo;
            const { GestorModales } = await import('/src/ui/gestor-modales.js');
            const { RespaldoLocal } = await import('/src/ui/respaldo-local.js');
            const salida = {};
            await h.hasta(() => h.modales() === 'modal-config', 5000, `Ajustes a la vista (hay: ${h.modales()})`);
            h.clic('#btn-abrir-respaldo'); await h.modalAbierto('modal-respaldo');

            h.clic('#btn-local-respaldar'); await h.modalAbierto('modal-exportar');
            salida.volverExportar = document.getElementById('btn-volver-exportar').textContent.trim();
            h.clic('#btn-volver-exportar'); await h.modalAbierto('modal-respaldo');
            h.clic('#btn-local-restaurar'); await h.modalAbierto('modal-importar');
            h.clic('#btn-volver-importar'); await h.modalAbierto('modal-respaldo');

            // una confirmación en el medio no pierde el camino de vuelta
            h.clic('#btn-local-respaldar'); await h.modalAbierto('modal-exportar');
            const pregunta = GestorModales.confirmar('¿Seguir?', 'Sí');
            await h.modalAbierto('modal-confirmar');
            h.clic('#modal-confirmar-ok');
            salida.confirmado = await pregunta;
            await h.modalAbierto('modal-exportar');
            h.clic('#btn-volver-exportar'); await h.modalAbierto('modal-respaldo');
            h.clic('#btn-respaldo-volver'); await h.modalAbierto('modal-config');

            GestorModales.ejecutarAccionCierre('modal-config');
            await h.hasta(() => h.modales() === '', 5000, `sin modales tras cerrar Ajustes (hay: ${h.modales()})`);
            await h.pausa(400);
            RespaldoLocal.mostrarExportar(true); await h.modalAbierto('modal-exportar');
            salida.cerrarExportar = document.getElementById('btn-volver-exportar').textContent.trim();
            h.clic('#btn-volver-exportar');
            await h.hasta(() => h.modales() === '', 5000, `sin modales tras cerrar Respaldar (hay: ${h.modales()})`);
            await h.pausa(300);
            RespaldoLocal.mostrarImportar(true); await h.modalAbierto('modal-importar');
            h.clic('#btn-volver-importar');
            await h.hasta(() => h.modales() === '', 5000, `sin modales tras cerrar Restaurar (hay: ${h.modales()})`);
            return salida;
        });
        assert.deepEqual(r, { volverExportar: 'Volver', confirmado: true, cerrarExportar: 'Cerrar' });
    });

    await t.test('Respaldar: «Cifrar este archivo» viene marcado con la frase de la app, no solapa controles y descarga un archivo cifrado', async () => {
        const previo = await evaluar(async () => {
            const h = window.humo;
            const { RespaldoLocal } = await import('/src/ui/respaldo-local.js');
            RespaldoLocal.mostrarExportar(true); await h.modalAbierto('modal-exportar'); await h.pausa(400);
            const btn = document.getElementById('btn-toggle-export-cifrar');
            const salida = { activo: btn.classList.contains('btn-activo'), deshabilitado: btn.disabled, solapes: h.solapes() };
            h.clic('#btn-toggle-export-cifrar');
            salida.desmarcado = !btn.classList.contains('btn-activo');
            h.clic('#btn-toggle-export-cifrar');
            return salida;
        });
        assert.deepEqual(previo, { activo: true, deshabilitado: false, solapes: [], desmarcado: true });

        const r = await evaluar(async () => {
            const h = window.humo;
            const blobs = [];
            const crear = URL.createObjectURL;
            URL.createObjectURL = (b) => { blobs.push(b); return crear.call(URL, b); };
            HTMLAnchorElement.prototype.click = function () { window.nombreDescarga = this.download; };   // sin descargar de verdad
            h.clic('#btn-exportar-descargar');
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
            await h.hasta(() => !document.querySelector('.modal.show'), 5000, 'cierre de Respaldar');
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
