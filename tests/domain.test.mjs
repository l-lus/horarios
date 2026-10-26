import test from 'node:test';
import assert from 'node:assert/strict';
import { TimeUtils } from '../src/core/time-utils.js';
import { SecurityAndUtils } from '../src/core/security.js';
import { AppEvents } from '../src/core/events.js';
import { TiposRegistro } from '../src/services/tipos-registro.js';
import { AppState } from '../src/services/app-state.js';
import { Compensatorios } from '../src/services/compensatorios.js';

test('TimeUtils: conversión HH:MM <-> minutos y cruces de medianoche', () => {
    assert.equal(TimeUtils.horaAMinutos('08:30'), 510);
    assert.equal(TimeUtils.minutosAHora(510), '08:30');
    assert.equal(TimeUtils.sumarMinutosAHora('08:45', 30), '09:15');
    assert.equal(TimeUtils.validarFecha('2026-10-25'), true);
    assert.equal(TimeUtils.validarFecha('2026-02-30'), false);
    assert.equal(TimeUtils.validarHora('23:59'), true);
    assert.equal(TimeUtils.validarHora('24:00'), false);
});

test('SecurityAndUtils: escapeHtml, validarRegistroSeguro y calcularHashSHA256', async () => {
    assert.equal(SecurityAndUtils.escapeHtml('<script>"alert(1)"</script>'), '&lt;script&gt;&quot;alert(1)&quot;&lt;/script&gt;');

    const regValido = {
        id: SecurityAndUtils.generarIDSeguro(),
        fecha: '2026-10-20',
        entrada: '09:00',
        salida: '16:00',
        tiempoFuera: '00:30',
        horas: 6,
        minutos: 30,
        total: 6.5,
        objetivoHoras: 7
    };
    assert.equal(SecurityAndUtils.validarRegistroSeguro(regValido), true);
    assert.equal(SecurityAndUtils.validarRegistroSeguro({ ...regValido, propiedadExtra: 'maliciosa' }), false);

    const hash = await SecurityAndUtils.calcularHashSHA256([regValido]);
    assert.equal(typeof hash, 'string');
    assert.equal(hash.length, 64);
});

test('AppEvents: suscripción, desuscripción y registro de handlers', () => {
    let recibido = null;
    const off = AppEvents.on('test:evento', (payload) => { recibido = payload; });
    AppEvents.emit('test:evento', { ok: 42 });
    assert.deepEqual(recibido, { ok: 42 });

    off();
    AppEvents.emit('test:evento', { ok: 99 });
    assert.deepEqual(recibido, { ok: 42 });

    AppEvents.register('test:sumar', (a, b) => a + b);
    assert.equal(AppEvents.call('test:sumar', 10, 15), 25);
});

test('AppState.calcularHoras y Compensatorios: cálculo de jornada, cruce de medianoche y asignación de compensatorios', () => {
    AppState.setHorasDiarias(7);
    AppState.setDiasHabiles([1, 2, 3, 4, 5]);
    AppState.setIgnorarTiempoFuera(false);

    // Jornada normal con tiempo fuera
    const normal = AppState.calcularHoras('08:00', '15:30', '00:30');
    assert.deepEqual(normal, { horas: 7, minutos: 0, total: 7 });

    // Cruce de medianoche (22:00 a 02:00 = 4h)
    const nocturno = AppState.calcularHoras('22:00', '02:00', null);
    assert.deepEqual(nocturno, { horas: 4, minutos: 0, total: 4 });

    // Día especial (feriado)
    const feriado = AppState.calcularHoras('00:00', '00:00', null);
    assert.equal(feriado.total, 7);
    assert.equal(feriado.esFeriado, true);

    // Asignación automática de compensatorio a un día previo con excedente
    const compCod = TiposRegistro.obtenerCodigosPorTipo('compensatorio');
    const lista = [
        {
            id: 'reg-excedente-1',
            fecha: '2026-10-19', // Lunes hábil con 9h (2h de excedente sobre 7h)
            entrada: '08:00',
            salida: '17:00',
            tiempoFuera: null,
            horas: 9,
            minutos: 0,
            total: 9,
            objetivoHoras: 7
        },
        {
            id: 'reg-comp-1',
            fecha: '2026-10-22', // Jueves compensatorio
            entrada: compCod.entrada,
            salida: compCod.salida,
            tiempoFuera: null,
            horas: 0,
            minutos: 0,
            total: 7,
            objetivoHoras: 7
        }
    ];
    AppState._setRegistros(lista);
    const asignaciones = Compensatorios._calcularAsignacionesCompensatorio(lista);
    assert.equal(asignaciones.length, 1);
    assert.equal(asignaciones[0].compensatorioId, 'reg-comp-1');
    assert.equal(asignaciones[0].referenciaId, 'reg-excedente-1');
    assert.equal(asignaciones[0].excedente, 2);
});

test('Integración: Arranque completo de UILogic.init() sin errores de ejecución', async () => {
    const noop = () => { };
    const fakeEl = () => ({
        style: { setProperty: noop, removeProperty: noop },
        dataset: {},
        classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
        addEventListener: noop,
        removeEventListener: noop,
        querySelector: () => fakeEl(),
        querySelectorAll: () => [],
        appendChild: noop,
        insertBefore: noop,
        remove: noop,
        setAttribute: noop,
        removeAttribute: noop,
        getAttribute: () => null,
        getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 }),
        focus: noop,
        blur: noop,
        contains: () => false,
        closest: () => null,
        cloneNode: () => fakeEl(),
        parentNode: { dataset: {}, addEventListener: noop, replaceChild: noop, insertBefore: noop },
        dispatchEvent: noop,
        value: '',
        textContent: '',
        innerHTML: '',
        files: [],
        options: []
    });

    globalThis.window = globalThis;
    globalThis.addEventListener = noop;
    globalThis.removeEventListener = noop;
    globalThis.getComputedStyle = () => ({ getPropertyValue: () => '#ffffff' });
    globalThis.DOMParser = class {
        parseFromString() {
            return {
                documentElement: { tagName: 'svg', querySelectorAll: () => [], attributes: [], outerHTML: '<svg></svg>' },
                querySelector: () => null,
                querySelectorAll: () => []
            };
        }
    };
    globalThis.location = { origin: 'http://localhost:8080', reload: noop, href: 'http://localhost:8080/' };
    globalThis.matchMedia = () => ({ matches: false, addEventListener: noop });
    Object.defineProperty(globalThis, 'navigator', { value: { standalone: false, onLine: true }, configurable: true });
    globalThis.Storage = function () { };
    const store = new Map();
    globalThis.localStorage = {
        getItem: k => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: k => store.delete(k)
    };
    globalThis.requestAnimationFrame = () => 0;
    globalThis.document = {
        readyState: 'complete',
        body: fakeEl(),
        documentElement: fakeEl(),
        getElementById: () => fakeEl(),
        querySelector: () => fakeEl(),
        querySelectorAll: () => [],
        createElement: () => fakeEl(),
        createElementNS: () => fakeEl(),
        createDocumentFragment: () => fakeEl(),
        addEventListener: noop,
        dispatchEvent: noop
    };

    const origSetInterval = globalThis.setInterval;
    const origSetTimeout = globalThis.setTimeout;
    globalThis.setInterval = (...args) => origSetInterval(...args).unref();
    globalThis.setTimeout = (...args) => origSetTimeout(...args).unref();

    try {
        const { UILogic } = await import('../src/ui/ui-logic.js');
        await assert.doesNotReject(async () => {
            await UILogic.init();
        });
    } finally {
        globalThis.setInterval = origSetInterval;
        globalThis.setTimeout = origSetTimeout;
    }
});
