import test from 'node:test';
import assert from 'node:assert/strict';

// Sin `document`: si un servicio lo toca, este archivo falla al ejecutarse.
const store = new Map();
globalThis.Storage = function () { };
globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
};
globalThis.window = globalThis;
globalThis.addEventListener = () => { };
globalThis.requestAnimationFrame = () => 0;
globalThis.matchMedia = () => ({ matches: false, addEventListener: () => { } });

test('GestionDatos.agregarRegistro ficha una entrada usando solo el puerto de formulario (sin DOM)', async () => {
    const { GestionDatos: D } = await import('../src/services/gestion-datos.js');
    const { EstadoApp } = await import('../src/services/estado-app.js');
    const { TiempoUtils } = await import('../src/core/tiempo-utils.js');
    const { GestorPerfiles } = await import('../src/services/gestor-perfiles.js');
    GestorPerfiles.inicializar();

    const toasts = [];
    const escrito = {};
    EstadoApp.configurarNotificaciones({
        formularioRegistro: {
            leer: () => ({ fecha: TiempoUtils.obtenerFechaHoy(), entrada: '08:30', salida: '' }),
            escribir: campos => Object.assign(escrito, campos),
            bloquearBoton: () => ({ id: 'btn-simulado' }),
        },
        avisarFichaje: (msg, tipo) => toasts.push([msg, tipo]),
        aplicarFeedbackCampos: () => { },
        resetearBoton: () => { },
        animarExitoFichaje: () => { },
        actualizarUI: () => { },
        mostrarToast: () => { },
        forzarVista: (_vista, fn) => fn(),
    });
    EstadoApp._setRegistros([]);

    await D.agregarRegistro();

    const registros = EstadoApp.registros();
    assert.equal(registros.length, 1);
    assert.equal(registros[0].entrada, '08:30');
    assert.equal(registros[0].salida, null);
    assert.deepEqual(escrito.entrada, '');
    assert.equal(toasts.at(-1)?.[1], 'success');
});

test('GestionDatos.agregarRegistro rechaza una fecha inválida y avisa sin crear registros', async () => {
    const { GestionDatos: D } = await import('../src/services/gestion-datos.js');
    const { EstadoApp } = await import('../src/services/estado-app.js');

    const avisos = [];
    const errores = [];
    EstadoApp.configurarNotificaciones({
        formularioRegistro: {
            leer: () => ({ fecha: 'no-es-fecha', entrada: '08:30', salida: '' }),
            escribir: () => { },
            bloquearBoton: () => ({}),
        },
        limpiarError: () => { },
        mostrarError: id => errores.push(id),
        avisarFichaje: msg => avisos.push(msg),
    });
    EstadoApp._setRegistros([]);

    await D.agregarRegistro();

    assert.equal(EstadoApp.registros().length, 0);
    assert.deepEqual(errores, ['fecha']);
    assert.deepEqual(avisos, ['Verificá los campos']);
});

test('RecordatorioPush.enviarNotificacionPrueba pide permiso y envía el mensaje al Service Worker', async () => {
    const { RecordatorioPush } = await import('../src/services/recordatorio-push.js');
    const mensajes = [];
    globalThis.Notification = { permission: 'default', requestPermission: async () => 'granted' };
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: { serviceWorker: { ready: Promise.resolve({ active: { postMessage: m => mensajes.push(m) } }) } },
    });

    assert.equal(await RecordatorioPush.enviarNotificacionPrueba(5000), 'ok');
    assert.deepEqual(mensajes, [{ tipo: 'notificacion-prueba', demoraMs: 5000 }]);

    globalThis.Notification = { permission: 'denied', requestPermission: async () => 'denied' };
    assert.equal(await RecordatorioPush.enviarNotificacionPrueba(), 'denegado');
    assert.equal(mensajes.length, 1);
});

test('RecordatorioPush.calcularTarget ubica la entrada en la fecha del registro (cruce de medianoche)', async () => {
    const { RecordatorioPush } = await import('../src/services/recordatorio-push.js');
    // Entrada de ayer 18:40, jornada de 7 h: el aviso cae a la 01:40 de hoy (menos el margen del cron de 1 min)
    const esperado = new Date(2026, 9, 30, 18, 40).getTime() + 7 * 3600 * 1000 - 60 * 1000;
    assert.equal(RecordatorioPush.calcularTarget('2026-10-30', '18:40', 7), esperado);
    assert.equal(new Date(esperado).getDate(), 31);
});

test('GestionDatos._registroAbiertoParaPush toma la jornada abierta de ayer si hoy no tiene registro', async (t) => {
    const { GestionDatos: D } = await import('../src/services/gestion-datos.js');
    const { EstadoApp } = await import('../src/services/estado-app.js');
    const reg = (fecha, entrada, salida) => ({ id: `${fecha}-${entrada}`, fecha, entrada, salida, objetivoHoras: 7 });

    // 31/10/2026 00:26 (sábado): la jornada del viernes 30 sigue abierta
    t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 9, 31, 0, 26) });

    EstadoApp._setRegistros([reg('2026-10-30', '18:40', null)]);
    assert.equal(D._registroAbiertoParaPush('2026-10-31')?.fecha, '2026-10-30');

    // Ayer ya tiene salida: nada para avisar
    EstadoApp._setRegistros([reg('2026-10-30', '18:40', '23:00')]);
    assert.equal(D._registroAbiertoParaPush('2026-10-31'), null);

    // Hoy ya tiene su propio registro cerrado: no se arrastra el de ayer
    EstadoApp._setRegistros([reg('2026-10-30', '18:40', null), reg('2026-10-31', '08:00', '09:00')]);
    assert.equal(D._registroAbiertoParaPush('2026-10-31'), null);

    // Hoy (sábado) tiene uno abierto, pero no es día hábil: no se avisa
    EstadoApp._setRegistros([reg('2026-10-31', '08:00', null)]);
    assert.equal(D._registroAbiertoParaPush('2026-10-31'), null);

    // Abierto hace más de 24 h: se considera olvidado
    EstadoApp._setRegistros([reg('2026-10-30', '00:10', null)]);
    assert.equal(D._registroAbiertoParaPush('2026-10-31'), null);
});
