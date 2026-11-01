import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarAtajos, alternarAtajo, ATAJOS_POR_DEFECTO, MAX_ATAJOS } from '../src/services/atajos.js';
import { normalizarOrdenCards, fusionarOrdenVisibles, columnaDeCard } from '../src/services/orden-cards.js';
import { CARDS } from '../src/core/constantes.js';

const VALIDOS = ['bajar', 'subir', 'deshacer', 'rehacer', 'tema', 'ayuda', 'ajustes', 'perfiles', 'fichar', 'tiempo-fuera', 'reporte', 'notificaciones', 'animaciones', 'estilo-calendario', 'exportar', 'importar'];

test('atajos: sin lista guardada quedan los de por defecto', () => {
    assert.deepEqual(normalizarAtajos(null, VALIDOS), [...ATAJOS_POR_DEFECTO]);
    assert.deepEqual(normalizarAtajos('basura', VALIDOS), [...ATAJOS_POR_DEFECTO]);
});

test('atajos: una lista vacía guardada se respeta', () => {
    assert.deepEqual(normalizarAtajos([], VALIDOS), []);
});

test('atajos: descarta desconocidos y repetidos y respeta el máximo', () => {
    assert.deepEqual(normalizarAtajos(['tema', 'nada', 'tema', 7, 'ayuda'], VALIDOS), ['tema', 'ayuda']);
    assert.equal(normalizarAtajos(VALIDOS, VALIDOS).length, MAX_ATAJOS);
});

test('atajos: alternar agrega al final, quita y no pasa del máximo', () => {
    assert.deepEqual(alternarAtajo(['tema'], 'ayuda'), { lista: ['tema', 'ayuda'], lleno: false });
    assert.deepEqual(alternarAtajo(['tema', 'ayuda'], 'tema'), { lista: ['ayuda'], lleno: false });
    const llena = VALIDOS.slice(0, MAX_ATAJOS);
    assert.deepEqual(alternarAtajo(llena, VALIDOS[MAX_ATAJOS]), { lista: llena, lleno: true });
    assert.equal(alternarAtajo(llena, llena[0]).lista.length, MAX_ATAJOS - 1);
});

test('orden de tarjetas: sin orden guardado o inválido queda el de por defecto', () => {
    assert.deepEqual(normalizarOrdenCards(null), [...CARDS]);
    assert.deepEqual(normalizarOrdenCards(['x', 'y']), [...CARDS]);
});

test('orden de tarjetas: un orden guardado antes de existir "atajos" lo incorpora en su lugar por defecto', () => {
    assert.deepEqual(normalizarOrdenCards(['historico', 'registrar', 'estadisticas']), ['historico', 'atajos', 'registrar', 'estadisticas']);
    assert.deepEqual(normalizarOrdenCards(['registrar', 'estadisticas', 'historico']), ['registrar', 'atajos', 'estadisticas', 'historico']);
});

test('orden de tarjetas: un orden completo se respeta y se descartan repetidos', () => {
    assert.deepEqual(normalizarOrdenCards(['historico', 'atajos', 'estadisticas', 'registrar']), ['historico', 'atajos', 'estadisticas', 'registrar']);
    assert.deepEqual(normalizarOrdenCards(['atajos', 'atajos', 'registrar', 'estadisticas', 'historico']), ['atajos', 'registrar', 'estadisticas', 'historico']);
});

test('orden de tarjetas: reordenar las visibles deja las ocultas en su lugar', () => {
    // "atajos" oculta en el 2.º lugar: las visibles se invierten y ella no se mueve
    assert.deepEqual(fusionarOrdenVisibles(['registrar', 'atajos', 'estadisticas', 'historico'], ['historico', 'estadisticas', 'registrar']),
        ['historico', 'atajos', 'estadisticas', 'registrar']);
    assert.deepEqual(fusionarOrdenVisibles(['a', 'b'], ['b', 'a']), ['b', 'a']);
});

test('orden de tarjetas: en escritorio las últimas dos van a la derecha', () => {
    assert.deepEqual([0, 1, 2, 3].map(i => columnaDeCard(i, 4)), [0, 0, 1, 1]);
    assert.deepEqual([0, 1, 2].map(i => columnaDeCard(i, 3)), [0, 1, 1]);
});
