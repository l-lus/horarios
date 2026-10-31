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
