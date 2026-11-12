import test from 'node:test';
import assert from 'node:assert/strict';

// Sin `document`: los servicios de cifrado no tocan el DOM. Almacenamiento simulado (permanente y de sesión).
const crearAlmacen = () => {
    const datos = new Map();
    return { getItem: k => (datos.has(k) ? datos.get(k) : null), setItem: (k, v) => datos.set(k, String(v)), removeItem: k => datos.delete(k) };
};
globalThis.localStorage = crearAlmacen();
globalThis.sessionStorage = crearAlmacen();
globalThis.window = globalThis;
globalThis.addEventListener = () => { };
globalThis.requestAnimationFrame = () => 0;
globalThis.matchMedia = () => ({ matches: false, addEventListener: () => { } });

const { RespaldoCifrado } = await import('../src/services/respaldo-cifrado.js');
const { FraseCifrado } = await import('../src/services/frase-cifrado.js');
const { ImportarExportar } = await import('../src/services/importar-exportar.js');
const { SincronizacionGist } = await import('../src/services/sincronizacion-gist.js');
const { GestorPerfiles } = await import('../src/services/gestor-perfiles.js');
const { SeguridadYUtils: S } = await import('../src/core/seguridad.js');

const FRASE = 'una frase larga para probar el respaldo cifrado';
const registros = [{ id: 'r1', fecha: '2026-11-03', entrada: '08:15', salida: '16:40', notas: 'Turno en el hospital' }];
const respaldo = { registros, horasDiarias: 8, version: 1 };

test('sellar → abrir: el respaldo vuelve igual, el texto no muestra horarios ni notas y trae su sal', async () => {
    const sellado = await RespaldoCifrado.sellar(respaldo, FRASE);
    assert.ok('texto' in sellado);
    assert.equal(sellado.texto.includes('hospital'), false);
    assert.equal(sellado.texto.includes('08:15'), false);
    const abierto = await RespaldoCifrado.abrir(sellado.texto, FRASE);
    assert.ok('datos' in abierto);
    assert.deepEqual(abierto.datos, respaldo);
    assert.equal(abierto.cifrado, true);
    assert.equal(abierto.sal, sellado.sal);
    // el hash interno del respaldo sigue coincidiendo después de pasar por el sobre
    assert.equal(await S.calcularHashSHA256(abierto.datos.registros), await S.calcularHashSHA256(registros));
});

test('abrir lee también un respaldo en claro (el de siempre) y avisa que no estaba cifrado', async () => {
    const abierto = await RespaldoCifrado.abrir(JSON.stringify(respaldo, null, 2), '');
    assert.ok('datos' in abierto);
    assert.equal(abierto.cifrado, false);
    assert.equal(abierto.sal, null);
    assert.equal(abierto.datos.registros[0].id, 'r1');
});

test('abrir con exigirCifrado rechaza el contenido en claro (un Gist ya cifrado no se degrada a JSON plano) y sigue abriendo el cifrado', async () => {
    const enClaro = await RespaldoCifrado.abrir(JSON.stringify(respaldo), FRASE, { exigirCifrado: true });
    assert.equal(enClaro.codigo, 'sin-cifrar');
    assert.equal('datos' in enClaro, false);
    const { texto } = /** @type {{ texto: string }} */ (await RespaldoCifrado.sellar(respaldo, FRASE));
    const cifrado = await RespaldoCifrado.abrir(texto, FRASE, { exigirCifrado: true });
    assert.equal(/** @type {any} */ (cifrado).cifrado, true);
    assert.equal((await RespaldoCifrado.abrir('no es json', FRASE, { exigirCifrado: true })).codigo, 'formato');
});

test('abrir distingue: falta la frase, frase inválida, frase incorrecta y contenido alterado', async () => {
    const { texto } = /** @type {{ texto: string }} */ (await RespaldoCifrado.sellar(respaldo, FRASE));
    assert.equal((await RespaldoCifrado.abrir(texto, '')).codigo, 'sin-frase');
    assert.equal((await RespaldoCifrado.abrir(texto, 'corta')).codigo, 'frase');
    assert.equal((await RespaldoCifrado.abrir(texto, 'otra frase igual de larga que la correcta')).codigo, 'descifrado');
    const sobre = JSON.parse(texto);
    sobre.datos = (sobre.datos[0] === 'A' ? 'B' : 'A') + sobre.datos.slice(1);
    assert.equal((await RespaldoCifrado.abrir(JSON.stringify(sobre), FRASE)).codigo, 'descifrado');
});

test('abrir rechaza sin lanzar lo que no es un respaldo: texto roto, arrays, tamaño excesivo, sobre de otra app o con parámetros inválidos', async () => {
    for (const malo of ['no es json', '[]', '"texto"', '42', 'null']) {
        const r = await RespaldoCifrado.abrir(malo, FRASE);
        assert.equal(r.codigo, 'formato', malo);
    }
    assert.equal((await RespaldoCifrado.abrir('x'.repeat(5 * 1024 * 1024), FRASE)).codigo, 'formato');
    assert.equal((await RespaldoCifrado.abrir(/** @type {any} */ (null), FRASE)).codigo, 'formato');
    const { texto } = /** @type {{ texto: string }} */ (await RespaldoCifrado.sellar(respaldo, FRASE));
    const sobre = JSON.parse(texto);
    assert.equal((await RespaldoCifrado.abrir(JSON.stringify({ ...sobre, iter: 10 }), FRASE)).codigo, 'formato');
    // un sobre de Servicios (mismo esquema, otro formato) no se toma por uno de Horarios: se lee como JSON en claro y lo frena la validación del respaldo
    const ajeno = await RespaldoCifrado.abrir(JSON.stringify({ ...sobre, formato: 'servicios-cifrado' }), FRASE);
    assert.equal(/** @type {any} */ (ajeno).cifrado, false);
    assert.ok(ImportarExportar.errorEstructuraRespaldo(/** @type {any} */ (ajeno).datos));
});

test('abrir no confunde un sobre dentro de otro sobre con un respaldo', async () => {
    const { texto: interior } = /** @type {{ texto: string }} */ (await RespaldoCifrado.sellar(respaldo, FRASE));
    const { texto: doble } = /** @type {{ texto: string }} */ (await RespaldoCifrado.sellar(JSON.parse(interior), FRASE));
    assert.equal((await RespaldoCifrado.abrir(doble, FRASE)).codigo, 'formato');
});

test('una clave peligrosa de prototipo dentro del respaldo cifrado se descarta al abrir', async () => {
    const { texto } = /** @type {{ texto: string }} */ (await RespaldoCifrado.sellar(JSON.parse('{"registros":[],"__proto__":{"x":1}}'), FRASE));
    const r = /** @type {any} */ (await RespaldoCifrado.abrir(texto, FRASE));
    assert.equal(r.datos.x, undefined);
    assert.equal({}.x, undefined);
});

test('sellar con una frase corta devuelve el error "frase" en vez de lanzar', async () => {
    assert.equal((await RespaldoCifrado.sellar(respaldo, 'corta')).codigo, 'frase');
});

test('ImportarExportar.textoRespaldo: sin frase sale el JSON en claro de siempre; con frase, un sobre que se abre con ella (y reutiliza la sal dada)', async () => {
    const enClaro = /** @type {any} */ (await ImportarExportar.textoRespaldo(respaldo));
    assert.equal(enClaro.cifrado, false);
    assert.equal(enClaro.texto, JSON.stringify(respaldo, null, 2));

    const cifrado = /** @type {any} */ (await ImportarExportar.textoRespaldo(respaldo, FRASE));
    assert.equal(cifrado.cifrado, true);
    assert.equal(cifrado.texto.includes('hospital'), false);
    const abierto = /** @type {any} */ (await RespaldoCifrado.abrir(cifrado.texto, FRASE));
    assert.deepEqual(abierto.datos, respaldo);

    const otra = /** @type {any} */ (await ImportarExportar.textoRespaldo(respaldo, FRASE, { sal: abierto.sal }));
    assert.equal(JSON.parse(otra.texto).sal, abierto.sal);
    assert.notEqual(JSON.parse(otra.texto).iv, JSON.parse(cifrado.texto).iv, 'el IV es nuevo en cada cifrado');

    assert.ok('error' in await ImportarExportar.textoRespaldo(respaldo, 'corta'));
    assert.equal(ImportarExportar.nombreArchivoRespaldo('Horarios_x', true), 'Horarios_x.cifrado.json');
    assert.equal(ImportarExportar.nombreArchivoRespaldo('Horarios_x', false), 'Horarios_x.json');
});

test('FraseCifrado: sin «recordar» queda solo en la sesión, con «recordar» en el navegador, con clave propia de Horarios, y vacía se olvida', () => {
    assert.equal(FraseCifrado.disponible(), false);
    assert.equal(FraseCifrado.guardar(`  ${FRASE}  `), true);
    assert.equal(FraseCifrado.actual(), FRASE, 'se guarda normalizada');
    assert.equal(FraseCifrado.disponible(), true);
    assert.equal(FraseCifrado.recordada(), false);
    assert.equal(sessionStorage.getItem('horarios_fraseCifrado'), FRASE);
    assert.equal(localStorage.getItem('horarios_fraseCifrado'), null);

    FraseCifrado.guardar(FRASE, true);
    assert.equal(FraseCifrado.recordada(), true);
    assert.equal(localStorage.getItem('horarios_fraseCifrado'), FRASE);
    assert.equal(sessionStorage.getItem('horarios_fraseCifrado'), null);

    FraseCifrado.guardar('');
    assert.equal(FraseCifrado.actual(), '');
    assert.equal(FraseCifrado.recordada(), false);

    const generada = FraseCifrado.generar();
    assert.match(generada, /^([a-z]{6}-){4}[a-z]{6}$/);
    assert.equal(FraseCifrado.evaluar(generada).ok, true);
    assert.equal(FraseCifrado.evaluar(generada).debil, false);
    assert.notEqual(FraseCifrado.generar(), generada);
});

test('SincronizacionGist: la marca de Gist cifrado es del perfil, sobrevive al guardado del perfil y se reinicia al cambiar de Gist', () => {
    GestorPerfiles.inicializar();
    const ID_A = 'a'.repeat(32), ID_B = 'b'.repeat(32);
    SincronizacionGist.saveCredentials('ghp_' + 'x'.repeat(36), ID_A);
    assert.equal(SincronizacionGist.getCifrado(), false);
    SincronizacionGist.setCifrado(true);
    assert.equal(SincronizacionGist.getCifrado(), true);

    GestorPerfiles.guardarDatosPerfilActual();
    assert.equal(SincronizacionGist.getCifrado(), true, 'guardar el perfil no pierde la marca');
    SincronizacionGist.saveCredentials('ghp_' + 'x'.repeat(36), ID_A);
    assert.equal(SincronizacionGist.getCifrado(), true, 'guardar el mismo Gist la conserva');

    SincronizacionGist.saveCredentials('ghp_' + 'x'.repeat(36), ID_B);
    assert.equal(SincronizacionGist.getCifrado(), false, 'otro Gist: ya no se sabe si está cifrado');
    SincronizacionGist.setCifrado(true);
    SincronizacionGist.setCifrado(false);
    assert.equal(SincronizacionGist.getCifrado(), false);
});

test('El respaldo no incluye la frase de cifrado ni la marca de Gist cifrado', async () => {
    FraseCifrado.guardar(FRASE, true);
    const armado = await ImportarExportar.armarRespaldo(registros);
    const texto = JSON.stringify(armado);
    assert.equal(texto.includes(FRASE), false);
    assert.equal(texto.includes('gistCifrado'), false);
    FraseCifrado.olvidar();
});
