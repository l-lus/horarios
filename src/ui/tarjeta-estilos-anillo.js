import {
    NS_SVG, el, circulo, fijar, mostrar, entonar, fijarQueEntre, pad2, fraseBanco, etiquetaBalance, tonoBanco, crearDato, pintarDato, crearDias, pintarDias
} from './tarjeta-estilos-piezas.js';

// ====================================================================
// TARJETA DE ESTADO · diseño «Anillo»
// ====================================================================
// Parte de tarjeta-estilos.js (no lo importa): arma el DOM del anillo una vez y lo pinta con el resumen.

/** El avance vive en el contenedor del aro (lo leen el arco y el brillo). @param {HTMLElement} aro @param {any} arco @param {any} p avance de 0 a 100 */
function pintarAvance(aro, arco, p) {
    const v = Math.max(0, Math.min(100, p));
    aro.style.setProperty('--ring-offset', String(100 - v));
    arco.classList.toggle('vacio', v <= 0);
    aro.querySelector('.est-anillo-inicio')?.classList.toggle('vacio', v <= 0);
}

const MAX_TRAMOS_ANILLO = 7;   // el día: azul, el color del banco y verde (`_anilloEnCurso`); la semana: un tramo por día (`_anilloSemana`)
let _anillosCreados = 0;       // cada aro tiene su propia máscara en el svg: el id no se puede repetir
export function crearAnillo() {
    const raiz = el('div', 'est-anillo');
    const principal = el('div', 'est-anillo-principal');
    const aro = el('div', 'est-anillo-aro');
    const svg = document.createElementNS(NS_SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('class', 'est-anillo-svg');
    svg.setAttribute('aria-hidden', 'true');
    // El arco (blanco) es la máscara de los tramos de color: el avance lo anima él y los tramos quedan fijos debajo, así los colores se descubren en orden como en la barra
    const arco = circulo('est-anillo-arco');
    const idMascara = `est-anillo-mascara-${++_anillosCreados}`;
    const mascara = document.createElementNS(NS_SVG, 'mask');
    mascara.setAttribute('id', idMascara);
    mascara.setAttribute('maskUnits', 'userSpaceOnUse');
    ['x', 'y'].forEach(a => mascara.setAttribute(a, '0'));
    ['width', 'height'].forEach(a => mascara.setAttribute(a, '100'));
    mascara.append(arco);
    const tramos = document.createElementNS(NS_SVG, 'g');
    tramos.setAttribute('mask', `url(#${idMascara})`);
    const arcosTramo = Array.from({ length: MAX_TRAMOS_ANILLO }, () => {
        const t = circulo('est-anillo-tramo');
        tramos.append(t);
        return t;
    });
    // el comienzo redondeado del arco cae antes de los tramos (fuera del trazo): lo dibuja este punto, en el color y en el lugar del primer tramo
    const inicio = document.createElementNS(NS_SVG, 'circle');
    inicio.setAttribute('class', 'est-anillo-inicio');
    inicio.setAttribute('cx', '94');
    inicio.setAttribute('cy', '50');
    inicio.setAttribute('r', '4.5');
    // hitos: una marca radial en cada corte entre tramos (a lo ancho del trazo), que gira hasta su posición (ver pintarTramos)
    const hitos = Array.from({ length: MAX_TRAMOS_ANILLO - 1 }, () => {
        const h = document.createElementNS(NS_SVG, 'line');
        h.setAttribute('class', 'est-anillo-hito');
        h.setAttribute('x1', '88.5');
        h.setAttribute('x2', '99.5');
        h.setAttribute('y1', '50');
        h.setAttribute('y2', '50');
        return h;
    });
    svg.append(circulo('est-anillo-pista'), mascara, tramos, inicio, ...hitos);
    const centro = el('div', 'est-anillo-centro');
    const valor = el('span', 'est-anillo-valor');
    const unidad = el('span', 'est-anillo-unidad');
    centro.append(valor, unidad);
    const brillo = el('span', 'est-anillo-brillo');
    brillo.setAttribute('aria-hidden', 'true');
    aro.append(svg, brillo, centro);

    const datos = el('div', 'est-anillo-datos');
    const mensaje = el('div', 'est-anillo-mensaje');
    const sub = el('div', 'est-anillo-sub');
    // Cada dato tiene su copia en el otro grupo (la clase est-anillo-copia): las variantes "intercambiado" de la disposición (html[data-disposicion-anillo]) cambian de lugar
    // los mosaicos (Faltan, Banco de horas, Tiempo fuera) con la fila Entrada / Salida / Con banco, y el CSS muestra solo el juego que corresponde. Se pintan los dos.
    const mosaico = (/** @type {string} */ etiqueta, /** @type {boolean} */ conDetalle = false, /** @type {boolean} */ copia = false) => {
        const d = crearDato(etiqueta, copia ? 'est-dato est-anillo-copia' : 'est-dato est-mosaico est-anillo-orig');
        // tercera línea del mosaico (la misma de la línea de tiempo): "Cubierto", "Te podés ir", "Te podés ir, pero debés tiempo"...
        if (conDetalle) d.raiz.append(el('span', 'est-dato-detalle'));
        return d;
    };
    const balance = mosaico('', true);
    const banco = mosaico('Banco de horas');
    const fuera = mosaico('Tiempo fuera');
    const balanceX = mosaico('', true, true);
    const bancoX = mosaico('Banco de horas', false, true);
    const fueraX = mosaico('Tiempo fuera', false, true);
    const dato = (/** @type {string} */ etiqueta, /** @type {boolean} */ copia = false) => crearDato(etiqueta, copia ? 'est-dato est-mosaico est-anillo-copia' : 'est-dato est-anillo-orig');
    const entrada = dato('Entrada');
    const salida = dato('Salida');
    const conBanco = dato('Con banco');
    const entradaX = dato('Entrada', true);
    const salidaX = dato('Salida', true);
    const conBancoX = dato('Con banco', true);
    datos.append(mensaje, sub, balance.raiz, banco.raiz, fuera.raiz, entradaX.raiz, salidaX.raiz, conBancoX.raiz);
    principal.append(aro, datos);

    const pie = el('div', 'est-anillo-pie');
    pie.append(entrada.raiz, salida.raiz, conBanco.raiz, balanceX.raiz, bancoX.raiz, fueraX.raiz);
    const dias = crearDias();
    raiz.append(principal, pie, dias.raiz);
    return { raiz, aro, arco, arcosTramo, inicio, hitos, valor, unidad, mensaje, sub, balance, banco, fuera, pie, entrada, salida, conBanco, balanceX, bancoX, fueraX, entradaX, salidaX, conBancoX, dias };
}

/**
 * Colorea el aro por tramos (% del aro, ver `_anilloEnCurso` en tarjeta-fichaje-vista.js); sin tramos, nada. Cada tramo es un arco de su largo que arranca en su comienzo
 * y se mete un poco bajo el siguiente para que no quede una línea clara entre colores. En cada corte entre tramos va un hito (una marca a lo ancho del trazo),
 * hueco (más tenue) hasta que el avance lo alcanza; en el llenado inicial (`conteoMs`, lo que dura) se marca recién cuando el aro llega a él (el aro avanza con ease-out cúbico).
 * @param {any} r @param {{ desde: number, hasta: number, color: string }[]} tramos @param {number} progreso avance del aro, en % @param {number} [conteoMs]
 */
function pintarTramos(r, tramos, progreso, conteoMs = 0) {
    r.arcosTramo.forEach((/** @type {SVGElement} */ arco, /** @type {number} */ i) => {
        const t = tramos[i];
        mostrar(arco, !!t);
        if (!t) return;
        // el último sigue un poco más allá del avance: ahí se ve el extremo redondeado del arco (sin color debajo quedaría cortado en seco)
        const largo = t.hasta - t.desde + (i < tramos.length - 1 ? 0.3 : 2);
        arco.style.strokeDasharray = `${largo} 100`;
        arco.style.strokeDashoffset = String(-t.desde);
        arco.dataset.color = t.color;
    });
    const cortes = tramos.slice(0, -1).map(t => t.hasta);
    r.hitos.forEach((/** @type {SVGElement} */ h, /** @type {number} */ i) => {
        const corte = cortes[i];
        mostrar(h, corte !== undefined);
        if (corte === undefined) return;
        h.style.transform = `rotate(${(corte * 3.6).toFixed(2)}deg)`;
        h.classList.toggle('pendiente', progreso < corte);
        const llegada = conteoMs > 0 && progreso >= corte ? 1 - Math.pow(1 - corte / progreso, 1 / 3) : 0;
        h.style.setProperty('--retraso-hito', `${Math.round(llegada * conteoMs)}ms`);
    });
    mostrar(r.inicio, tramos.length > 0);
    if (tramos.length) {
        // el redondeo del comienzo va donde arranca el primer tramo (en la semana puede haber un hueco antes: un día sin horas)
        r.inicio.dataset.color = tramos[0].color;
        r.inicio.style.transform = `rotate(${(tramos[0].desde * 3.6).toFixed(2)}deg)`;
    }
}

/** El número del centro del aro: "7:45 horas" o "22 min". @param {any} r @param {{ horas: number, minutos: number }} t */
export function pintarNumeroAnillo(r, { horas, minutos }) {
    fijar(r.valor, horas > 0 ? `${horas}:${pad2(minutos)}` : String(minutos));
    fijar(r.unidad, horas > 0 ? 'horas' : 'min');
}

/** Cada dato del anillo y su copia en el otro grupo (ver crearAnillo). @param {any} r @param {'balance'|'banco'|'fuera'|'entrada'|'salida'|'conBanco'} k */
const _duo = (r, k) => [r[k], r[`${k}X`]];
const mostrarDuo = (r, k, visible) => _duo(r, k).forEach(d => mostrar(d.raiz, visible));
const pintarDuo = (r, k, etiqueta, valor, tono) => _duo(r, k).forEach(d => pintarDato(d, etiqueta, valor, tono));

export function pintarAnillo(r, d) {
    r.raiz.dataset.tipo = d.tipo;
    const conTotal = d.tipo === 'registro' || d.tipo === 'semana';
    // los dos grupos con su contenedor: la fila de abajo (la de siempre: Entrada / Salida / Con banco) y, en las variantes intercambiadas, la de los mosaicos; el CSS
    // oculta el que no tiene nada que mostrar según la variante (data-pie: ¿hay fila de Entrada?; data-pie-x: ¿hay mosaicos abajo?)
    r.raiz.dataset.pie = d.tipo === 'registro' || d.tipo === 'espera' ? 'si' : 'no';
    r.raiz.dataset.pieX = conTotal && (!!d.balance || !!d.banco || (d.tipo === 'registro' && !!d.tiempoFuera)) ? 'si' : 'no';
    mostrar(r.dias.raiz, d.tipo === 'semana');
    mostrar(r.mensaje, !conTotal);
    mostrar(r.sub, !conTotal && (d.tipo === 'especial' || !!d.banco));
    mostrarDuo(r, 'balance', conTotal && !!d.balance);
    mostrarDuo(r, 'banco', conTotal && !!d.banco);
    mostrarDuo(r, 'fuera', false);
    // fuera del registro (o de la espera) la fila de Entrada / Salida / Con banco no se muestra, y sus copias al costado tampoco
    const conFila = d.tipo === 'registro' || d.tipo === 'espera';
    mostrarDuo(r, 'entrada', conFila);
    mostrarDuo(r, 'salida', conFila);
    mostrarDuo(r, 'conBanco', conFila);

    if (conTotal) {
        pintarNumeroAnillo(r, d.trabajado);
        r.aro.dataset.color = d.color;
        r.aro.classList.remove('espera');
        // con la jornada abierta el aro lleva los tramos de la barra con hitos y la semana uno por día; cerrado y lo demás van de un solo color
        const anillo = d.anillo ?? null;
        pintarTramos(r, anillo?.tramos ?? [{ desde: 0, hasta: 100, color: d.color }], anillo?.progreso ?? d.progreso, d.conteoMs);
        pintarAvance(r.aro, r.arco, anillo?.progreso ?? d.progreso);
        // con el registro (o la semana) en curso, el brillo recorre el arco lleno, como el de la barra
        r.aro.classList.toggle('en-curso', d.tipo === 'registro' ? !d.cerrado : !!d.abierta);
        if (d.balance) {
            pintarDuo(r, 'balance', etiquetaBalance(d), d.balance.texto, d.balance.tono);
            _duo(r, 'balance').forEach(b => fijarQueEntre(b.raiz.querySelector('.est-dato-detalle'), d.balance.detalle));
        }
        if (d.banco) pintarDuo(r, 'banco', 'Banco de horas', d.banco.texto, tonoBanco(d.banco));
        if (d.tipo === 'semana') { pintarDias(r.dias, d.dias); return; }
        pintarDuo(r, 'entrada', 'Entrada', d.entrada);
        mostrarDuo(r, 'salida', !!(d.salida || d.salidaEstimada));
        pintarDuo(r, 'salida', 'Salida', d.salida || d.salidaEstimada);
        mostrarDuo(r, 'conBanco', !!d.salidaBanco);
        pintarDuo(r, 'conBanco', 'Con banco', d.salidaBanco, tonoBanco(d.banco));
        mostrarDuo(r, 'fuera', !!d.tiempoFuera);
        if (d.tiempoFuera) pintarDuo(r, 'fuera', d.tiempoFuera.corriendo ? 'Fuera (en curso)' : 'Tiempo fuera', d.tiempoFuera.texto);
        return;
    }

    fijar(r.valor, d.emoji);
    fijar(r.unidad, '');
    if (d.tipo === 'espera') {
        r.aro.dataset.color = 'blue';
        r.aro.classList.add('espera');
        pintarTramos(r, [], 0);
        pintarAvance(r.aro, r.arco, 0);
        r.aro.classList.remove('en-curso');
        fijar(r.mensaje, d.mensaje);
        if (d.banco) { fijar(r.sub, fraseBanco(d.banco)); entonar(r.sub, tonoBanco(d.banco)); }
        pintarDuo(r, 'entrada', 'Entrada', '--:--');
        pintarDuo(r, 'salida', 'Salida', '--:--');
        pintarDuo(r, 'conBanco', 'Con banco', '--:--');
        mostrarDuo(r, 'salida', true); mostrarDuo(r, 'conBanco', true);
    } else {
        r.aro.dataset.color = d.color;
        r.aro.classList.remove('espera');
        pintarTramos(r, [{ desde: 0, hasta: 100, color: d.color }], 100);
        pintarAvance(r.aro, r.arco, 100);
        r.aro.classList.remove('en-curso');
        fijar(r.mensaje, d.etiqueta);
        fijar(r.sub, d.descripcion);
        entonar(r.sub, 'neutro');
    }
}
