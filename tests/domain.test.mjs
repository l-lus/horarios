import test from 'node:test';
import assert from 'node:assert/strict';
import { TiempoUtils } from '../src/core/tiempo-utils.js';
import { SeguridadYUtils } from '../src/core/seguridad.js';
import { EventosApp } from '../src/core/eventos.js';
import { TiposRegistro } from '../src/services/tipos-registro.js';
import { EstadoApp } from '../src/services/estado-app.js';
import { Compensatorios } from '../src/services/compensatorios.js';

test('TiempoUtils: conversión HH:MM <-> minutos y cruces de medianoche', () => {
    assert.equal(TiempoUtils.horaAMinutos('08:30'), 510);
    assert.equal(TiempoUtils.minutosAHora(510), '08:30');
    assert.equal(TiempoUtils.sumarMinutosAHora('08:45', 30), '09:15');
    assert.equal(TiempoUtils.validarFecha('2026-10-25'), true);
    assert.equal(TiempoUtils.validarFecha('2026-02-30'), false);
    assert.equal(TiempoUtils.validarHora('23:59'), true);
    assert.equal(TiempoUtils.validarHora('24:00'), false);
});

test('SeguridadYUtils: escapeHtml, validarRegistroSeguro y calcularHashSHA256', async () => {
    assert.equal(SeguridadYUtils.escapeHtml('<script>"alert(1)"</script>'), '&lt;script&gt;&quot;alert(1)&quot;&lt;/script&gt;');

    const regValido = {
        id: SeguridadYUtils.generarIDSeguro(),
        fecha: '2026-10-20',
        entrada: '09:00',
        salida: '16:00',
        tiempoFuera: '00:30',
        horas: 6,
        minutos: 30,
        total: 6.5,
        objetivoHoras: 7
    };
    assert.equal(SeguridadYUtils.validarRegistroSeguro(regValido), true);
    assert.equal(SeguridadYUtils.validarRegistroSeguro({ ...regValido, propiedadExtra: 'maliciosa' }), false);

    const hash = await SeguridadYUtils.calcularHashSHA256([regValido]);
    assert.equal(typeof hash, 'string');
    assert.equal(hash.length, 64);
});

test('EventosApp: suscripción, desuscripción y registro de handlers', () => {
    let recibido = null;
    const off = EventosApp.on('test:evento', (payload) => { recibido = payload; });
    EventosApp.emit('test:evento', { ok: 42 });
    assert.deepEqual(recibido, { ok: 42 });

    off();
    EventosApp.emit('test:evento', { ok: 99 });
    assert.deepEqual(recibido, { ok: 42 });

    EventosApp.register('test:sumar', (a, b) => a + b);
    assert.equal(EventosApp.call('test:sumar', 10, 15), 25);
});

test('EstadoApp.calcularHoras y Compensatorios: cálculo de jornada, cruce de medianoche y asignación de compensatorios', () => {
    EstadoApp.setHorasDiarias(7);
    EstadoApp.setDiasHabiles([1, 2, 3, 4, 5]);
    EstadoApp.setIgnorarTiempoFuera(false);

    // Jornada normal con tiempo fuera
    const normal = EstadoApp.calcularHoras('08:00', '15:30', '00:30');
    assert.deepEqual(normal, { horas: 7, minutos: 0, total: 7 });

    // Cruce de medianoche (22:00 a 02:00 = 4h)
    const nocturno = EstadoApp.calcularHoras('22:00', '02:00', null);
    assert.deepEqual(nocturno, { horas: 4, minutos: 0, total: 4 });

    // Día especial (feriado)
    const feriado = EstadoApp.calcularHoras('00:00', '00:00', null);
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
    EstadoApp._setRegistros(lista);
    const asignaciones = Compensatorios._calcularAsignacionesCompensatorio(lista);
    assert.equal(asignaciones.length, 1);
    assert.equal(asignaciones[0].compensatorioId, 'reg-comp-1');
    assert.equal(asignaciones[0].referenciaId, 'reg-excedente-1');
    assert.equal(asignaciones[0].excedente, 2);
});

test('Integración: Arranque completo de OrquestadorUI.init() sin errores de ejecución', async () => {
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
        const { OrquestadorUI } = await import('../src/ui/orquestador.js');
        await assert.doesNotReject(async () => {
            await OrquestadorUI.init();
        });
    } finally {
        globalThis.setInterval = origSetInterval;
        globalThis.setTimeout = origSetTimeout;
    }
});

test('ImportarExportar: exportación, validación y restauración de flags de configuración', async () => {
    const { ImportarExportar } = await import('../src/services/importar-exportar.js');
    const { Almacenamiento } = await import('../src/core/almacenamiento.js');
    const { Movimiento } = await import('../src/core/movimiento.js');
    const { STORAGE_KEYS } = await import('../src/core/constantes.js');

    EstadoApp.setIgnorarTiempoFuera(false);
    Almacenamiento.setItem(STORAGE_KEYS.IGNORAR_TF, false, true);
    Almacenamiento.setItem(STORAGE_KEYS.IGNORAR_LOGICA_CUBIERTO, false, true);
    Almacenamiento.setItem(STORAGE_KEYS.IGNORAR_OBJETIVO_POR_REGISTRO, false, true);
    Movimiento.setModo('auto');

    // Simular un registro importado inicialmente con ignorarTiempoFuera = false (descarga 30m de tiempo fuera -> 7.5h)
    const registros = ImportarExportar.normalizarRegistrosImportados([
        {
            id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
            fecha: '2026-10-20',
            entrada: '09:00',
            salida: '17:00',
            tiempoFuera: '00:30',
            horas: 8,
            minutos: 0,
            total: 8
        }
    ], EstadoApp.calcularHoras);
    assert.equal(registros[0].total, 7.5);

    const backupData = {
        registros,
        diasHabiles: [1, 2, 3, 4],
        horasDiarias: 8,
        ignorarTiempoFuera: true,
        ignorarLogicaCubierto: true,
        ignorarObjetivoPorRegistro: true,
        reducirAnimaciones: 'on'
    };

    assert.equal(ImportarExportar.validarCamposConfigImport(backupData), true);
    assert.equal(ImportarExportar.validarCamposConfigImport({ ...backupData, reducirAnimaciones: 'invalido' }), false);
    assert.equal(ImportarExportar.validarCamposConfigImport({ ...backupData, ignorarTiempoFuera: 'si' }), false);

    const cambios = ImportarExportar.calcularCambiosConfigImport(backupData);
    assert.ok(cambios.includes('tiempo fuera'));
    assert.ok(cambios.includes('banco de horas'));
    assert.ok(cambios.includes('objetivo diario global'));
    assert.ok(cambios.includes('animaciones'));

    // Al aplicar la configuración importada en modo replace, debe recalcular el registro con ignorarTiempoFuera = true (-> 8h)
    ImportarExportar.aplicarConfigImportada(backupData, registros);
    assert.equal(EstadoApp.getIgnorarTiempoFuera(), true);
    assert.equal(Almacenamiento.getBoolean(STORAGE_KEYS.IGNORAR_LOGICA_CUBIERTO, false, true), true);
    assert.equal(Almacenamiento.getBoolean(STORAGE_KEYS.IGNORAR_OBJETIVO_POR_REGISTRO, false, true), true);
    assert.equal(Movimiento.modo(), 'on');
    assert.equal(registros[0].total, 8);

    const exportado = ImportarExportar.obtenerConfigExportable();
    assert.deepEqual(exportado, {
        ignorarTiempoFuera: true,
        ignorarLogicaCubierto: true,
        ignorarObjetivoPorRegistro: true,
        reducirAnimaciones: 'on'
    });
});

test('Almacenamiento: prefijo horarios_ (APP_STORAGE_PREFIX) y migración automática de claves legadas sin tocar otras apps', async () => {
    const { Almacenamiento } = await import('../src/core/almacenamiento.js');
    const { APP_STORAGE_PREFIX, STORAGE_KEYS } = await import('../src/core/constantes.js');

    const rawStore = new Map();
    globalThis.localStorage = {
        get length() { return rawStore.size; },
        key: (i) => Array.from(rawStore.keys())[i] ?? null,
        getItem: (k) => (rawStore.has(k) ? rawStore.get(k) : null),
        setItem: (k, v) => rawStore.set(k, String(v)),
        removeItem: (k) => rawStore.delete(k)
    };

    // 1. Sembrar datos legados de Horarios (estáticos, por perfil y dinámicos) + claves de otras apps del mismo GitHub Pages
    const perfilesLegados = JSON.stringify({
        default: { nombre: 'Principal', registros: [{ id: 'r1', fecha: '2026-10-20' }], diasHabiles: [1, 2, 3, 4, 5], horasDiarias: 7 },
        perfil_custom1: { nombre: ' Guardia ', registros: [], diasHabiles: [6, 0], horasDiarias: 12 }
    });
    rawStore.set('perfiles', perfilesLegados);
    rawStore.set('temaOscuro', 'dark');
    rawStore.set('pushInstallId', 'uuid-instalacion-123');
    rawStore.set('pushOwnerToken', 'a'.repeat(64));
    rawStore.set('ignorarTiempoFuera_default', 'true');
    rawStore.set('history_perfil_custom1', '{"history":[],"currentIndex":-1}');
    rawStore.set('mes-2026-10-expandido', 'true');
    rawStore.set('anio-2026-expandido', 'false');
    rawStore.set('gistSyncLimite_subir', '15');

    // Claves de otras apps en el mismo dominio github.io (NO deben migrarse ni borrarse)
    rawStore.set('gestion_servicios_config', '{"activo":true}');
    rawStore.set('IDR_usuario', 'luis');

    // 2. Ejecutar migración automática
    const migradas = Almacenamiento.migrarClavesLegadas();
    assert.equal(migradas, 9);

    // 3. Verificar que todas las claves legadas de Horarios pasaron al prefijo horarios_ y las viejas se eliminaron
    assert.equal(rawStore.has('perfiles'), false);
    assert.equal(rawStore.get(`${APP_STORAGE_PREFIX}perfiles`), perfilesLegados);
    assert.equal(rawStore.has('temaOscuro'), false);
    assert.equal(Almacenamiento.getItem(STORAGE_KEYS.TEMA_OSCURO), 'dark');
    assert.equal(Almacenamiento.getItem(STORAGE_KEYS.PUSH_INSTALL_ID), 'uuid-instalacion-123');
    assert.equal(Almacenamiento.getItem(STORAGE_KEYS.PUSH_OWNER_TOKEN), 'a'.repeat(64));
    assert.equal(rawStore.get(`${APP_STORAGE_PREFIX}ignorarTiempoFuera_default`), 'true');
    assert.equal(rawStore.get(`${APP_STORAGE_PREFIX}history_perfil_custom1`), '{"history":[],"currentIndex":-1}');
    assert.equal(Almacenamiento.getBoolean(STORAGE_KEYS.MES_EXPANDIDO('2026-10')), true);
    assert.equal(Almacenamiento.getBoolean(STORAGE_KEYS.ANIO_EXPANDIDO('2026')), false);
    assert.equal(Almacenamiento.getNumber(STORAGE_KEYS.GIST_LIMITE('subir')), 15);

    // 4. Verificar que las claves de otras apps del mismo origen quedaron intactas
    assert.equal(rawStore.get('gestion_servicios_config'), '{"activo":true}');
    assert.equal(rawStore.get('IDR_usuario'), 'luis');
    assert.equal(rawStore.has(`${APP_STORAGE_PREFIX}gestion_servicios_config`), false);
});

test('TarjetaFichaje: derivarVistaHoy y derivarVistaSemana marcan estado cerrado y colorCierre', async () => {
    const { TarjetaFichaje } = await import('../src/ui/tarjeta-fichaje.js');

    // Semana cerrada cumpliendo objetivo
    const vistaSemanaOk = TarjetaFichaje.derivarVistaSemana({
        totalSemana: 35,
        totalSemanaProgreso: 35,
        objetivoSemana: 35,
        semanaAbierta: false,
        horasDiarias: 7,
        todosEspeciales: false
    });
    assert.equal(vistaSemanaOk.cerrado, true);
    assert.equal(vistaSemanaOk.colorCierre, 'green');

    // Semana cerrada con faltante
    const vistaSemanaFail = TarjetaFichaje.derivarVistaSemana({
        totalSemana: 28,
        totalSemanaProgreso: 28,
        objetivoSemana: 35,
        semanaAbierta: false,
        horasDiarias: 7,
        todosEspeciales: false
    });
    assert.equal(vistaSemanaFail.cerrado, true);
    assert.equal(vistaSemanaFail.colorCierre, 'red');

    // Semana en curso (abierta)
    const vistaSemanaEnCurso = TarjetaFichaje.derivarVistaSemana({
        totalSemana: 14,
        totalSemanaProgreso: 14,
        objetivoSemana: 35,
        semanaAbierta: true,
        horasDiarias: 7,
        todosEspeciales: false
    });
    assert.equal(vistaSemanaEnCurso.cerrado, false);

    // Día cerrado (con salida registrada)
    const vistaDiaCerrado = TarjetaFichaje.derivarVistaHoy({
        regHoy: { fecha: '2026-10-30', entrada: '08:00', salida: '15:00', total: 7, objetivoHoras: 7 },
        tiempoHoy: 7,
        horasDiarias: 7,
        esDiaHabil: true,
        tipoEspecialHoy: null,
        bufferSemanalBase: 0,
        diasHabiles: [1, 2, 3, 4, 5]
    });
    assert.equal(vistaDiaCerrado.cerrado, true);
    assert.equal(vistaDiaCerrado.colorCierre, 'green');

    // Día cerrado con faltante
    const vistaDiaFalto = TarjetaFichaje.derivarVistaHoy({
        regHoy: { fecha: '2026-10-30', entrada: '08:00', salida: '09:07', total: 1.12, objetivoHoras: 7 },
        tiempoHoy: 1.12,
        horasDiarias: 7,
        esDiaHabil: true,
        tipoEspecialHoy: null,
        bufferSemanalBase: 0,
        diasHabiles: [1, 2, 3, 4, 5]
    });
    assert.equal(vistaDiaFalto.cerrado, true);
    assert.equal(vistaDiaFalto.colorCierre, 'red');

    // Día en curso (sin salida)
    const vistaDiaEnCurso = TarjetaFichaje.derivarVistaHoy({
        regHoy: { fecha: '2026-10-30', entrada: '08:00', salida: null, objetivoHoras: 7 },
        tiempoHoy: 2,
        horasDiarias: 7,
        esDiaHabil: true,
        tipoEspecialHoy: null,
        bufferSemanalBase: 0,
        diasHabiles: [1, 2, 3, 4, 5]
    });
    assert.equal(vistaDiaEnCurso.cerrado, false);
});
