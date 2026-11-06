import test from 'node:test';
import assert from 'node:assert/strict';
import {
    columnasDesdeOrden, tamanosDeColumnas, prepararColumnas, moverCard, esTamanosColumnasValidos, MAX_COLUMNAS
} from '../src/services/orden-cards.js';

const ORDEN = ['registrar', 'estadisticas', 'historico'];

test('Columnas: sin tamaños guardados se usa el reparto por defecto (la primera con 1 tarjeta, la segunda con 2)', () => {
    assert.deepEqual(columnasDesdeOrden(ORDEN), [['registrar'], ['estadisticas', 'historico']]);
    assert.deepEqual(columnasDesdeOrden(ORDEN, [2, 1]), [['registrar', 'estadisticas'], ['historico']]);
    assert.deepEqual(columnasDesdeOrden(ORDEN, [1, 1, 1]), [['registrar'], ['estadisticas'], ['historico']]);
    assert.deepEqual(columnasDesdeOrden(ORDEN, [0, 3]), [[], ORDEN]);
    // tamaños que no suman el total (ej. una versión con otra cantidad de tarjetas) o inválidos: reparto por defecto
    assert.deepEqual(columnasDesdeOrden(ORDEN, [1, 1]), [['registrar'], ['estadisticas', 'historico']]);
    assert.deepEqual(columnasDesdeOrden(ORDEN, 'x'), [['registrar'], ['estadisticas', 'historico']]);
});

test('Columnas: validación de tamaños (hasta 3, enteros, solo la primera puede ser 0)', () => {
    assert.equal(esTamanosColumnasValidos([1, 2]), true);
    assert.equal(esTamanosColumnasValidos([0, 3]), true);
    assert.equal(esTamanosColumnasValidos([1, 0]), false);
    assert.equal(esTamanosColumnasValidos([1, 1, 1, 1]), false);
    assert.equal(esTamanosColumnasValidos([1.5, 1]), false);
    assert.equal(esTamanosColumnasValidos([]), false);
    assert.equal(esTamanosColumnasValidos([1, 2], 4), false);
    assert.equal(MAX_COLUMNAS, 3);
});

test('Columnas: mover una tarjeta a otra columna, entre dos tarjetas o al final', () => {
    const base = [['registrar'], ['estadisticas', 'historico']];
    assert.deepEqual(moverCard(base, 'registrar', 1, 'historico'), [[], ['estadisticas', 'registrar', 'historico']]);
    assert.deepEqual(moverCard(base, 'historico', 0), [['registrar', 'historico'], ['estadisticas']]);
    assert.deepEqual(moverCard(base, 'historico', 1, 'estadisticas'), [['registrar'], ['historico', 'estadisticas']]);
    assert.equal(moverCard(base, 'estadisticas', 1, 'historico'), null);   // ya está ahí: sin cambio
});

test('Columnas: soltar en el hueco de la derecha abre una columna nueva, y una columna vacía desaparece', () => {
    const base = [['registrar'], ['estadisticas', 'historico']];
    const tres = moverCard(base, 'historico', 2);
    assert.deepEqual(tres, [['registrar'], ['estadisticas'], ['historico']]);
    assert.deepEqual(tamanosDeColumnas(tres), [1, 1, 1]);
    // la única tarjeta de una columna al hueco de al lado no cambia nada (la columna se vacía y se vuelve a abrir)
    assert.equal(moverCard(tres, 'historico', 3), null);
    // vaciar una columna del medio la quita
    assert.deepEqual(moverCard(tres, 'estadisticas', 0), [['registrar', 'estadisticas'], ['historico']]);
    // la primera columna puede quedar sin tarjetas propias (comparte lugar con la tarjeta de fichaje)
    assert.deepEqual(moverCard([['registrar'], ['estadisticas', 'historico']], 'registrar', 1)[0], []);
});

test('Columnas: nunca más de 3 columnas con tarjetas visibles', () => {
    const tres = [['registrar'], ['estadisticas'], ['historico']];
    assert.equal(moverCard(tres, 'historico', 3), null);
    assert.equal(moverCard([['registrar', 'estadisticas'], ['historico']], 'estadisticas', 2, null, { max: 2 }), null);
    // una columna de tarjetas ocultas no cuenta
    const visibles = new Set(['registrar', 'estadisticas']);
    assert.deepEqual(moverCard([['registrar'], ['estadisticas'], ['historico']], 'registrar', 3, null, { max: 3, visibles }), [[], ['estadisticas'], ['historico'], ['registrar']]);
});

test('Columnas: preparar para dibujar funde columnas sin tarjetas visibles y respeta el máximo', () => {
    const cols = [['registrar'], ['estadisticas'], ['historico']];
    assert.deepEqual(prepararColumnas(cols), cols);
    assert.deepEqual(prepararColumnas(cols, 2), [['registrar'], ['estadisticas', 'historico']]);
    assert.deepEqual(prepararColumnas(cols, 3, new Set(['registrar', 'historico'])), [['registrar', 'estadisticas'], ['historico']]);
    assert.deepEqual(prepararColumnas([[], ['estadisticas']], 3), [[], ['estadisticas']]);
    // no modifica lo que recibe
    assert.deepEqual(cols, [['registrar'], ['estadisticas'], ['historico']]);
});
