import { $ } from '../core/dom.js';
import { uiAnimarReubicacion } from './arrastre.js';
import { Animaciones } from './animaciones.js';
import { EstiloTarjeta } from '../core/estilo-tarjeta.js';
import { resumenesDeMedida } from '../core/resumen-tarjeta.js';
import { el, pintarDuracion, fijarQueEntre, versionesQueEntre } from './tarjeta-estilos-piezas.js';
import { crearAnillo, pintarAnillo, pintarNumeroAnillo } from './tarjeta-estilos-anillo.js';
import { crearLinea, pintarLinea, alinearLinea, BASE_ENTRADA, duracionLinea } from './tarjeta-estilos-linea.js';
import { crearFilas, pintarFilas } from './tarjeta-estilos-filas.js';

// ====================================================================
// DISEÑOS PROPIOS DE LA TARJETA DE ESTADO (vista diaria): anillo, línea de tiempo y lista de filas
// ====================================================================
// Cada diseño arma su DOM una sola vez dentro de #stats-estilo y después solo actualiza textos y variables CSS con el `resumen` que deriva
// tarjeta-fichaje-vista.js (tipo 'registro', 'espera' o 'especial'). El CSS (tarjeta-estilos.css) hace el resto:
// colores por tono (data-tono) y por estado (data-color), y los avances por variables (--ring-offset, --avance, --banco).
// Las piezas comunes y cada diseño viven en tarjeta-estilos-piezas.js, -anillo.js, -linea.js y -filas.js; este módulo monta el elegido, cuenta el número y reubica.
// Todo se escribe con createElement/textContent: sin innerHTML (Trusted Types) y sin estilos en línea en el HTML (CSP).

// ─── Montaje ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
// `fija`: el alto de la tarjeta no varía casi nada entre estados (el anillo), así que se reserva el del más alto. `reservaSemana` (la línea de tiempo): se reserva
// el alto de la vista semanal (con la semana real, no un peor caso) para que alternar entre el día y la semana no mueva lo de abajo; los estados del día más altos
// que la semana (si los hay) siguen ampliando la tarjeta. En los demás (lista de filas) el alto sigue al contenido y se anima (ver _animarAlturaCard en tarjeta-fichaje.js).
const DISENOS = {
    anillo: { crear: crearAnillo, pintar: pintarAnillo, fija: true, reservaSemana: false, alinear: null },
    linea: { crear: crearLinea, pintar: pintarLinea, fija: false, reservaSemana: true, alinear: alinearLinea },
    filas: { crear: crearFilas, pintar: pintarFilas, fija: false, reservaSemana: false, alinear: null }
};

/** @type {{ id: string, refs: any, refsSemana: any } | null} */
let _montado = null;

// Número grande de cada diseño (lo que cuenta de 0 al valor en la primera carga, como el número de la barra en los estilos clásicos)
const NUMEROS = {
    anillo: pintarNumeroAnillo,
    linea: (/** @type {any} */ r, /** @type {any} */ t) => pintarDuracion(r.duracion, t),
    filas: (/** @type {any} */ r, /** @type {any} */ t) => pintarDuracion(r.duracion, t)
};

/** @type {(() => void) | null} el cancelador del conteo en curso */
let _conteo = null;

function _cancelarConteo() {
    _conteo?.();
    _conteo = null;
}

/**
 * Cuenta el número de 0 al valor con la misma curva que el de las barras (ease-out cúbico, horas y minutos por separado). Cualquier otro dibujo lo corta.
 * @param {string} id @param {any} refs @param {{ horas: number, minutos: number }} total @param {number} duracion
 */
function _contar(id, refs, total, duracion) {
    const pintarNumero = NUMEROS[/** @type {keyof typeof NUMEROS} */ (id)];
    pintarNumero(refs, { horas: 0, minutos: 0 });
    const cancelar = Animaciones._recorrerCurva(duracion, (e, t) => {
        pintarNumero(refs, t >= 1 ? total : { horas: Math.round(total.horas * e), minutos: Math.round(total.minutos * e) });
    }, () => { if (_conteo === cancelar) _conteo = null; });
    _conteo = cancelar;
}

/** El mismo resumen sin avance (aro, regla y segmentos vacíos): de ahí parten las transiciones del primer dibujo. @param {any} d */
function _sinAvance(d) {
    return {
        ...d, progreso: 0,
        anillo: d.anillo ? { ...d.anillo, progreso: 0 } : d.anillo,   // el aro toma su avance de aquí cuando hay tramos: sin esto aparecería lleno de entrada
        linea: d.linea ? { ...d.linea, ahoraRel: 0 } : d.linea,
        dias: d.dias ? d.dias.map((/** @type {any} */ x) => ({ ...x, fraccion: 0 })) : d.dias
    };
}

/**
 * Arma el diseño dentro de #stats-estilo. Los de alto fijo suman capas de medida: copias ocultas del mismo diseño dibujadas con el peor caso de cada estado
 * (registro, sin registro, día especial y semana). Todas ocupan la misma celda de una cuadrícula, así la tarjeta mide siempre lo que el más alto.
 * Los de `reservaSemana` suman una sola capa de medida, con la semana real (la dibuja `actualizar`): la tarjeta nunca es más baja que la vista semanal.
 * @param {HTMLElement} host @param {string} id @param {{ crear: () => any, pintar: (r: any, d: any) => void, fija: boolean, reservaSemana: boolean }} diseno
 */
function _montar(host, id, diseno) {
    host.replaceChildren();
    const refs = diseno.crear();
    let refsSemana = null;
    if (!diseno.fija && !diseno.reservaSemana) {
        host.append(refs.raiz);
    } else {
        const capas = el('div', 'est-capas');
        const visible = el('div', 'est-capa');
        visible.append(refs.raiz);
        capas.append(visible);
        const capaMedida = () => {
            const capa = el('div', 'est-capa est-capa--medida');
            capa.setAttribute('aria-hidden', 'true');
            capa.setAttribute('inert', '');
            return capa;
        };
        if (diseno.fija) {
            for (const medida of resumenesDeMedida()) {
                const capa = capaMedida();
                const r = diseno.crear();
                diseno.pintar(r, medida);
                capa.append(r.raiz);
                capas.append(capa);
            }
        }
        if (diseno.reservaSemana) {
            const capa = capaMedida();
            refsSemana = diseno.crear();
            capa.append(refsSemana.raiz);
            capas.append(capa);
        }
        host.append(capas);
    }
    _montado = { id, refs, refsSemana };
    _anchoObservado = 0;
    _observadorAncho?.disconnect();
    _observadorAncho?.observe(host);
}

/**
 * Dibuja el resumen del día o de la semana con el diseño del estilo elegido. Al cambiar de estilo se reconstruye el DOM; si el estilo no es propio
 * (o no hay resumen) deja el contenedor vacío y devuelve false: la tarjeta usa entonces la barra de siempre.
 * Con `conteoInicial` (la carga de la página, igual que en los estilos clásicos) el aro, la regla y los segmentos crecen de cero y el número cuenta de 0 a su valor.
 * `resumenSemana` (solo lo pide el diseño con `reservaSemana`): el resumen de la vista semanal, para que la capa de medida reserve su alto.
 * @param {any} resumen @param {{ conteoInicial?: boolean, cargaInicial?: boolean, duracion?: number, resumenSemana?: () => any }} [opciones] duracion: la del conteo en ms
 */
function actualizar(resumen, { conteoInicial = false, cargaInicial = false, duracion = 0, resumenSemana } = {}) {
    const host = $('stats-estilo');
    _cancelarConteo();
    if (!host) return false;
    const id = EstiloTarjeta.actual();
    const diseno = DISENOS[/** @type {keyof typeof DISENOS} */ (id)];
    if (!diseno || !resumen) {
        if (_montado) { host.replaceChildren(); _montado = null; }
        return false;
    }
    if (!_montado || _montado.id !== id || !host.firstChild) _montar(host, id, diseno);
    const refs = _montado?.refs;
    // la carga de la página y el paso automático de semana a día (aviso de pedirDestelloBalance) hacen la misma entrada: número que cuenta, línea que se llena, textos que suben y destello
    const pendiente = (id === 'linea' || id === 'anillo') && resumen.tipo === 'registro' && _destelloPendiente > performance.now();
    const carga = conteoInicial || pendiente;   // `cargaInicial`: la carga de la página aunque el número no cuente (sin horas, día especial...): la línea entra igual
    const contar = carga && duracion > 1 && !!resumen.trabajado && resumen.trabajadoMin > 0;
    if (contar) {
        diseno.pintar(refs, _sinAvance(resumen));
        void host.offsetWidth;   // el estado vacío tiene que estar aplicado para que el siguiente dibujo transicione hacia el real
    }
    // entrada de la línea de tiempo: la línea se llena y los textos suben, como en la barra con hitos (también en la semana, pero solo en la carga)
    const entra = id === 'linea' && duracion > 1 && (resumen.tipo === 'semana' ? conteoInicial || cargaInicial : resumen.tipo === 'registro' && (carga || cargaInicial));
    diseno.pintar(refs, {
        ...resumen,
        ...(contar && { conteoMs: duracion }),   // conteoMs: lo que dura el llenado, para que cada hito se marque cuando el aro llega a él
        ...(entra && { entradaMs: duracion })
    });
    // la capa que reserva el alto de la semana se dibuja con los datos reales de la semana (en la vista semanal son los mismos que los de la capa visible)
    const refsSemana = _montado?.refsSemana;
    const semana = refsSemana && resumenSemana ? resumenSemana() : null;
    if (refsSemana && semana) {
        diseno.pintar(refsSemana, semana);
        diseno.alinear?.(refs, refsSemana);
    }
    if (contar) _contar(id, refs, resumen.trabajado, duracion);
    if ((id === 'linea' || id === 'anillo') && resumen.tipo === 'registro') {
        // la línea espera a que termine su entrada; el anillo, a que el aro y el número terminen de contar
        if (carga) destellarBalance(refs, resumen, entra ? BASE_ENTRADA + duracionLinea(duracion) : (contar ? duracion : 0));
        _destelloPendiente = 0;
    }
    return true;
}

// La carga con la vista semanal pasa sola a la diaria: esa vista tiene que entrar igual que en la carga directa (el aviso vence si la diaria no llega a dibujarse)
let _destelloPendiente = 0;

/** El próximo dibujo del registro del día (el cambio automático de semana a día en la carga) hace la misma entrada que la carga directa en la vista diaria. */
function pedirDestelloBalance() {
    _destelloPendiente = performance.now() + 5000;
}

/**
 * En la carga de la página, con el registro en curso, el mosaico de balance (de la línea de tiempo y del anillo) destella (como el día de hoy del calendario) si hay buenas noticias:
 * el faltante lo cubre el saldo (dorado) o el objetivo ya está cumplido / hay extra (verde). Con el registro cerrado no tiene sentido.
 * Espera a que termine el conteo para que no pase desapercibido.
 * @param {any} refs @param {any} resumen @param {number} espera ms
 */
function destellarBalance(refs, resumen, espera) {
    if (resumen.tipo !== 'registro' || resumen.cerrado || !resumen.balance) return;
    if (resumen.balance.tono !== 'gold' && resumen.balance.tono !== 'green') return;
    const nodo = refs.balance.raiz;
    setTimeout(() => {
        if (nodo.isConnected && _montado?.refs === refs) Animaciones._flashElemento(nodo, 'mosaico-flash');
    }, espera + 20);
}

/**
 * Vuelve a elegir qué versión de cada tercera línea ("Pero te podés ir" / "Te podés ir", "No se descuenta" / "No descuenta") entra en su mosaico.
 * Se usa cuando cambia el ancho del lugar donde están sin que se redibuje la tarjeta: al cambiar la disposición o al rotar/redimensionar.
 */
function reajustarDetalles() {
    const raiz = _montado?.id === 'linea' || _montado?.id === 'anillo' ? _montado.refs?.raiz : null;
    if (!raiz) return;
    raiz.querySelectorAll('.est-dato-detalle').forEach((/** @type {HTMLElement} */ n) => {
        const versiones = versionesQueEntre.get(n);
        if (versiones && versiones.length > 1 && n.offsetParent !== null) fijarQueEntre(n, versiones);
    });
}

// Girar el teléfono o redimensionar cambia el ancho de los mosaicos sin redibujar nada: se reeligen las versiones (solo si cambió el ancho; el texto solo cambia el alto)
let _anchoObservado = 0;
const _observadorAncho = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(entradas => {
    const ancho = Math.round(entradas[entradas.length - 1].contentRect.width);
    if (ancho === _anchoObservado) return;
    _anchoObservado = ancho;
    reajustarDetalles();
});

/**
 * Aplica un cambio de disposición de la línea de tiempo o del anillo (`cambiar`, que solo cambia un atributo de <html>) animando lo que se mueve: el tiempo trabajado, la línea,
 * los mosaicos y la nota (o el aro, sus datos y la fila de abajo) viajan desde su lugar anterior al nuevo (la misma técnica con que se mueven las tarjetas al reubicarlas) y la tarjeta acompaña el cambio de alto.
 * @param {() => void} cambiar
 */
function reubicar(cambiar) {
    const host = $('stats-estilo');
    // sin las copias de la capa de medida (ocultas): solo viaja lo que se ve
    const obtener = () => host ? [.../** @type {NodeListOf<HTMLElement>} */ (host.querySelectorAll('.est-linea-cabecera, .est-linea-cuerpo, .est-mosaicos, .est-linea-nota, .est-anillo-aro, .est-anillo-datos, .est-anillo-pie, .est-dias'))].filter(n => !n.closest('.est-capa--medida')) : [];
    Animaciones._animarAlturaCambio($('stats-card'), () => uiAnimarReubicacion(obtener, (/** @type {HTMLElement} */ el) => el.className.split(' ')[0], () => { cambiar(); reajustarDetalles(); }));
}

export const TarjetaEstilos = { actualizar, reubicar, pedirDestelloBalance };
