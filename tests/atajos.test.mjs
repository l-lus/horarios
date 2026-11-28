import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarAtajos, alternarAtajo, ATAJOS_POR_DEFECTO, MAX_ATAJOS } from '../src/services/atajos.js';
import { normalizarOrdenCards, columnasDesdeOrden, sumarTarjetasNuevas, leerLayout, clavesDeLayout } from '../src/services/orden-cards.js';
import { CARDS_ORDEN } from '../src/core/constantes.js';

const VALIDOS = ['bajar', 'subir', 'exportar', 'importar', 'deshacer', 'rehacer', 'personalizar', 'respaldo', 'ayuda', 'ajustes', 'notificaciones', 'animaciones'];

test('atajos: sin lista guardada quedan los de por defecto (personalizar, notificaciones, respaldo y ayuda)', () => {
    assert.deepEqual([...ATAJOS_POR_DEFECTO], ['personalizar', 'notificaciones', 'respaldo', 'ayuda']);
    assert.deepEqual(normalizarAtajos(null, VALIDOS), [...ATAJOS_POR_DEFECTO]);
    assert.deepEqual(normalizarAtajos('basura', VALIDOS), [...ATAJOS_POR_DEFECTO]);
});

test('atajos: una lista vacía guardada se respeta', () => {
    assert.deepEqual(normalizarAtajos([], VALIDOS), []);
});

test('atajos: descarta desconocidos y repetidos y respeta el máximo', () => {
    assert.deepEqual(normalizarAtajos(['respaldo', 'nada', 'respaldo', 7, 'ayuda'], VALIDOS), ['respaldo', 'ayuda']);
    // los que ya no existen (versiones anteriores: tema, estilo del calendario, fichar...) se descartan
    assert.deepEqual(normalizarAtajos(['tema', 'fichar', 'ayuda', 'estilo-calendario', 'reporte'], VALIDOS), ['ayuda']);
    const muchos = Array.from({ length: MAX_ATAJOS + 5 }, (_, i) => `a${i}`);
    assert.equal(normalizarAtajos(muchos, muchos).length, MAX_ATAJOS);
});

test('atajos: alternar agrega al final, quita y no pasa del máximo', () => {
    assert.deepEqual(alternarAtajo(['tema'], 'ayuda'), { lista: ['tema', 'ayuda'], lleno: false });
    assert.deepEqual(alternarAtajo(['tema', 'ayuda'], 'tema'), { lista: ['ayuda'], lleno: false });
    const llena = Array.from({ length: MAX_ATAJOS }, (_, i) => `a${i}`);
    assert.deepEqual(alternarAtajo(llena, 'otro'), { lista: llena, lleno: true });
    assert.equal(alternarAtajo(llena, llena[0]).lista.length, MAX_ATAJOS - 1);
});

test('tarjeta de atajos: va última por defecto y, sin diseño guardado, en la columna derecha junto a Registros', () => {
    assert.equal(CARDS_ORDEN[CARDS_ORDEN.length - 1], 'atajos');
    assert.deepEqual(columnasDesdeOrden(normalizarOrdenCards(null)), [['estado', 'registrar', 'estadisticas'], ['historico', 'atajos']]);
});

test('tarjeta de atajos: un orden guardado antes de que existiera la incorpora al final, sin tocar el resto', () => {
    assert.deepEqual(normalizarOrdenCards(['historico', 'estado', 'registrar', 'estadisticas']), ['historico', 'estado', 'registrar', 'estadisticas', 'atajos']);
});

test('tarjeta de atajos: los tamaños guardados sin ella le suman un lugar a la columna de la tarjeta anterior', () => {
    const viejo = ['estado', 'registrar', 'estadisticas', 'historico'];
    const orden = normalizarOrdenCards(viejo);
    assert.deepEqual(sumarTarjetasNuevas(viejo, orden, [3, 1]), [3, 2]);
    assert.deepEqual(sumarTarjetasNuevas(viejo, orden, [2, 1, 1]), [2, 1, 2]);
    // Registros a la izquierda: la de atajos queda al final de la última columna, sin mover las demás
    const otro = ['historico', 'estado', 'registrar', 'estadisticas'];
    assert.deepEqual(columnasDesdeOrden(normalizarOrdenCards(otro), sumarTarjetasNuevas(otro, normalizarOrdenCards(otro), [1, 3])),
        [['historico'], ['estado', 'registrar', 'estadisticas', 'atajos']]);
    // de cuando la de estado tampoco se movía: va primera, en la primera columna
    const legado = ['registrar', 'estadisticas', 'historico'];
    assert.deepEqual(sumarTarjetasNuevas(legado, normalizarOrdenCards(legado), [2, 1]), [3, 2]);
    // ya completos, o tamaños que no corresponden: sin tocar
    assert.deepEqual(sumarTarjetasNuevas(orden, orden, [4, 1]), [4, 1]);
    assert.deepEqual(sumarTarjetasNuevas(viejo, orden, [9]), [9]);
    assert.equal(sumarTarjetasNuevas(null, orden, [3, 1])?.toString(), '3,1');
});

test('tarjeta de atajos: leerLayout aplica el ajuste al diseño guardado', () => {
    const k2 = clavesDeLayout(2);
    const guardado = { [k2.orden]: ['estado', 'registrar', 'estadisticas', 'historico'], [k2.columnas]: [3, 1] };
    const { orden, tamanos } = leerLayout(2, (clave) => guardado[clave] ?? null);
    assert.deepEqual(columnasDesdeOrden(orden, tamanos), [['estado', 'registrar', 'estadisticas'], ['historico', 'atajos']]);
});
