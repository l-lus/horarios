import { $ } from '../core/dom.js';
import { EstiloTarjeta } from '../core/estilo-tarjeta.js';
import { duracionCompacta, hitosOrdenados, posicionesLinea } from '../core/resumen-tarjeta.js';

// ====================================================================
// DISEÑOS PROPIOS DE LA TARJETA DE ESTADO (vista diaria): anillo, línea de tiempo, lista de filas y tipográfica
// ====================================================================
// Cada diseño arma su DOM una sola vez dentro de #stats-estilo y después solo actualiza textos y variables CSS con el `resumen` que deriva
// tarjeta-fichaje-vista.js (tipo 'registro', 'espera' o 'especial'). El CSS (tarjetas-vistas.css, sección "ESTILOS DE LA TARJETA") hace el resto:
// colores por tono (data-tono) y por estado (data-color), y los avances por variables (--ring-offset, --avance, --banco).
// Todo se escribe con createElement/textContent: sin innerHTML (Trusted Types) y sin estilos en línea en el HTML (CSP).
const NS_SVG = 'http://www.w3.org/2000/svg';

/** @param {string} tag @param {string} [clase] @param {string} [texto] @returns {HTMLElement} */
function el(tag, clase = '', texto = '') {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto) n.textContent = texto;
    return n;
}

/** @param {string} clase @returns {SVGCircleElement} círculo de radio 44 con pathLength 100: el avance es un dashoffset de 0 a 100 */
function circulo(clase) {
    const c = /** @type {SVGCircleElement} */ (document.createElementNS(NS_SVG, 'circle'));
    c.setAttribute('class', clase);
    c.setAttribute('cx', '50');
    c.setAttribute('cy', '50');
    c.setAttribute('r', '44');
    c.setAttribute('pathLength', '100');
    return c;
}

/** @param {Element} n @param {string} texto */
const fijar = (n, texto) => { if (n.textContent !== texto) n.textContent = texto; };
/** @param {Element} n @param {boolean} visible */
const mostrar = (n, visible) => n.classList.toggle('hidden', !visible);
/** @param {HTMLElement} n @param {string | undefined} tono 'neutro' | 'green' | 'red' | 'gold' */
const entonar = (n, tono) => { n.dataset.tono = tono || 'neutro'; };
const _pad2 = n => String(n).padStart(2, '0');

/** Frase del banco de horas de la semana: "▲ 19 min extras esta semana". @param {{ minutos: number, positivo: boolean }} banco */
const fraseBanco = banco => `${banco.positivo ? '▲' : '▼'} ${duracionCompacta(Math.abs(banco.minutos))} ${banco.positivo ? 'extras' : 'faltantes'} esta semana`;
/** @param {{ positivo: boolean } | null} banco */
const tonoBanco = banco => (banco ? (banco.positivo ? 'green' : 'red') : 'neutro');

/** @param {any} p avance de 0 a 100 */
function pintarAvance(arco, p) {
    const v = Math.max(0, Math.min(100, p));
    arco.style.setProperty('--ring-offset', String(100 - v));
    arco.classList.toggle('vacio', v <= 0);
}

// ─── Piezas comunes ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** Duración con unidades chicas ("7 h 45 min"): el número grande y la unidad en tipografías distintas. */
function crearDuracion(clase = '') {
    const raiz = el('span', `est-duracion ${clase}`.trim());
    const h = el('span', 'est-num');
    const hu = el('span', 'est-unidad', 'h');
    const m = el('span', 'est-num');
    const mu = el('span', 'est-unidad', 'min');
    raiz.append(h, hu, m, mu);
    return { raiz, h, hu, m, mu };
}

/** @param {ReturnType<typeof crearDuracion>} d @param {{ horas: number, minutos: number }} t */
function pintarDuracion(d, { horas, minutos }) {
    const conHoras = horas > 0;
    const conMinutos = !conHoras || minutos > 0;
    mostrar(d.h, conHoras); mostrar(d.hu, conHoras);
    mostrar(d.m, conMinutos); mostrar(d.mu, conMinutos);
    fijar(d.h, String(horas));
    fijar(d.m, String(minutos));
}

/** Etiqueta chica y valor (la unidad de la cuadrícula inferior del anillo y de los mosaicos de la línea de tiempo). */
function crearDato(etiqueta, clase = 'est-dato') {
    const raiz = el('div', clase);
    const e = el('span', 'est-dato-etiqueta', etiqueta);
    const valor = el('span', 'est-dato-valor');
    raiz.append(e, valor);
    return { raiz, etiqueta: e, valor };
}

/** @param {ReturnType<typeof crearDato>} d @param {string} etiqueta @param {string} valor @param {string} [tono] */
function pintarDato(d, etiqueta, valor, tono) {
    fijar(d.etiqueta, etiqueta);
    fijar(d.valor, valor);
    entonar(d.raiz, tono);
}

// ─── B · Anillo ───────────────────────────────────────────────────────────────────────────────────────────────────────────
function crearAnillo() {
    const raiz = el('div', 'est-anillo');
    const principal = el('div', 'est-anillo-principal');
    const aro = el('div', 'est-anillo-aro');
    const svg = document.createElementNS(NS_SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('class', 'est-anillo-svg');
    svg.setAttribute('aria-hidden', 'true');
    const arco = circulo('est-anillo-arco');
    svg.append(circulo('est-anillo-pista'), arco);
    const centro = el('div', 'est-anillo-centro');
    const valor = el('span', 'est-anillo-valor');
    const unidad = el('span', 'est-anillo-unidad');
    centro.append(valor, unidad);
    aro.append(svg, centro);

    const datos = el('div', 'est-anillo-datos');
    const mensaje = el('div', 'est-anillo-mensaje');
    const sub = el('div', 'est-anillo-sub');
    const balance = crearDato('', 'est-dato est-dato--vertical');
    const banco = crearDato('Banco de horas', 'est-dato est-dato--vertical');
    datos.append(mensaje, sub, balance.raiz, banco.raiz);
    principal.append(aro, datos);

    const pie = el('div', 'est-anillo-pie');
    const entrada = crearDato('Entrada');
    const salida = crearDato('Salida');
    const conBanco = crearDato('Con banco');
    const fuera = crearDato('Tiempo fuera');
    pie.append(entrada.raiz, salida.raiz, conBanco.raiz, fuera.raiz);
    raiz.append(principal, pie);
    return { raiz, aro, arco, valor, unidad, mensaje, sub, balance, banco, pie, entrada, salida, conBanco, fuera };
}

function pintarAnillo(r, d) {
    r.raiz.dataset.tipo = d.tipo;
    const esRegistro = d.tipo === 'registro';
    mostrar(r.pie, d.tipo !== 'especial');
    mostrar(r.mensaje, !esRegistro);
    mostrar(r.sub, !esRegistro && !!d.banco);
    mostrar(r.balance.raiz, esRegistro && !!d.balance);
    mostrar(r.banco.raiz, esRegistro && !!d.banco);

    if (esRegistro) {
        const { horas, minutos } = d.trabajado;
        fijar(r.valor, horas > 0 ? `${horas}:${_pad2(minutos)}` : String(minutos));
        fijar(r.unidad, horas > 0 ? 'horas' : 'min');
        r.aro.dataset.color = d.color;
        r.aro.classList.remove('espera');
        pintarAvance(r.arco, d.progreso);
        if (d.balance) pintarDato(r.balance, d.balance.etiqueta, d.balance.texto, d.balance.tono);
        if (d.banco) pintarDato(r.banco, 'Banco de horas', d.banco.texto, tonoBanco(d.banco));
        pintarDato(r.entrada, 'Entrada', d.entrada);
        mostrar(r.salida.raiz, !!(d.salida || d.salidaEstimada));
        pintarDato(r.salida, 'Salida', d.salida || d.salidaEstimada);
        mostrar(r.conBanco.raiz, !!d.salidaBanco);
        pintarDato(r.conBanco, 'Con banco', d.salidaBanco, tonoBanco(d.banco));
        mostrar(r.fuera.raiz, !!d.tiempoFuera);
        if (d.tiempoFuera) pintarDato(r.fuera, d.tiempoFuera.corriendo ? 'Fuera (en curso)' : 'Tiempo fuera', d.tiempoFuera.texto);
        return;
    }

    fijar(r.valor, d.emoji);
    fijar(r.unidad, '');
    if (d.tipo === 'espera') {
        r.aro.dataset.color = 'blue';
        r.aro.classList.add('espera');
        pintarAvance(r.arco, 0);
        fijar(r.mensaje, d.mensaje);
        if (d.banco) { fijar(r.sub, fraseBanco(d.banco)); entonar(r.sub, tonoBanco(d.banco)); }
        pintarDato(r.entrada, 'Entrada', '--:--');
        pintarDato(r.salida, 'Salida', '--:--');
        pintarDato(r.conBanco, 'Con banco', '--:--');
        mostrar(r.salida.raiz, true); mostrar(r.conBanco.raiz, true); mostrar(r.fuera.raiz, false);
    } else {
        r.aro.dataset.color = d.color;
        r.aro.classList.remove('espera');
        pintarAvance(r.arco, 100);
        fijar(r.mensaje, d.etiqueta);
        fijar(r.sub, d.descripcion);
        mostrar(r.sub, true);
        entonar(r.sub, 'neutro');
    }
}

const ROTULOS_NODO = { entrada: 'Entrada', ahora: 'Ahora', salida: 'Salida', banco: 'Con banco' };

// ─── C · Línea de tiempo vertical ─────────────────────────────────────────────────────────────────────────────────────────
function crearLinea() {
    const raiz = el('div', 'est-linea');
    const cabecera = el('div', 'est-linea-cabecera');
    const etiqueta = el('div', 'est-linea-etiqueta', 'Llevás trabajado');
    const duracion = crearDuracion('est-duracion--grande');
    const titulo = el('div', 'est-linea-titulo');
    const emoji = el('span', 'est-emoji');
    const texto = el('span', 'est-linea-texto');
    titulo.append(emoji, texto);
    cabecera.append(etiqueta, duracion.raiz, titulo);

    const nodos = el('ol', 'est-nodos');
    /** @type {Record<string, { raiz: HTMLElement, etiqueta: HTMLElement, hora: HTMLElement }>} */
    const hitos = {};
    for (const [tipo, rotulo] of Object.entries(ROTULOS_NODO)) {
        const li = el('li', `est-nodo est-nodo--${tipo}`);
        const e = el('span', 'est-nodo-etiqueta', rotulo);
        const hora = el('span', 'est-nodo-hora');
        li.append(el('span', 'est-nodo-punto'), e, hora);
        nodos.append(li);
        hitos[tipo] = { raiz: li, etiqueta: e, hora };
    }

    const mosaicos = el('div', 'est-mosaicos');
    const balance = crearDato('Faltan', 'est-dato est-mosaico');
    const banco = crearDato('Banco de horas', 'est-dato est-mosaico');
    const fuera = crearDato('Tiempo fuera', 'est-dato est-mosaico');
    mosaicos.append(balance.raiz, banco.raiz, fuera.raiz);
    const nota = el('div', 'est-linea-nota');
    raiz.append(cabecera, nodos, mosaicos, nota);
    return { raiz, etiqueta, duracion, titulo, emoji, texto, nodos, hitos, mosaicos, balance, banco, fuera, nota };
}

function pintarLinea(r, d) {
    r.raiz.dataset.tipo = d.tipo;
    const esRegistro = d.tipo === 'registro';
    mostrar(r.etiqueta, esRegistro);
    mostrar(r.duracion.raiz, esRegistro);
    mostrar(r.titulo, !esRegistro);
    mostrar(r.nota, d.tipo === 'especial');

    if (esRegistro) {
        fijar(r.etiqueta, d.cerrado ? 'Trabajaste' : 'Llevás trabajado');
        pintarDuracion(r.duracion, d.trabajado);
        pintarNodos(r, d);
        mostrar(r.nodos, true);
        mostrar(r.balance.raiz, !!d.balance);
        if (d.balance) pintarDato(r.balance, d.balance.etiqueta, d.balance.texto, d.balance.tono);
        mostrar(r.banco.raiz, !!d.banco);
        if (d.banco) pintarDato(r.banco, 'Banco de horas', d.banco.texto, tonoBanco(d.banco));
        mostrar(r.fuera.raiz, !!d.tiempoFuera);
        if (d.tiempoFuera) pintarDato(r.fuera, d.tiempoFuera.corriendo ? 'Fuera (en curso)' : 'Tiempo fuera', d.tiempoFuera.texto);
        mostrar(r.mosaicos, !!(d.balance || d.banco || d.tiempoFuera));
        return;
    }

    fijar(r.emoji, d.emoji);
    r.titulo.dataset.color = d.tipo === 'especial' ? d.color : 'neutro';
    if (d.tipo === 'espera') {
        fijar(r.texto, d.mensaje);
        pintarNodosPendientes(r);
        mostrar(r.nodos, !!d.mensaje);
        mostrar(r.banco.raiz, !!d.banco);
        if (d.banco) pintarDato(r.banco, 'Banco de horas', `${d.banco.texto} esta semana`, tonoBanco(d.banco));
        mostrar(r.balance.raiz, false); mostrar(r.fuera.raiz, false);
        mostrar(r.mosaicos, !!d.banco);
    } else {
        fijar(r.texto, d.etiqueta);
        fijar(r.nota, d.descripcion);
        r.nota.dataset.color = d.color;
        mostrar(r.nodos, false);
        mostrar(r.mosaicos, false);
    }
}

/** Nodos de la jornada con registro, en el orden en que ocurren (el "Ahora" queda entre los demás según la hora). */
function pintarNodos(r, d) {
    const linea = d.linea;
    for (const [tipo, h] of Object.entries(r.hitos)) {
        mostrar(h.raiz, false);
        h.raiz.classList.remove('pendiente');
        fijar(h.etiqueta, ROTULOS_NODO[tipo]);   // sin registro quedan como "Entrada · pendiente"
    }

    /** @type {{ tipo: string, rel: number }[]} */
    const orden = linea ? hitosOrdenados(linea) : [{ tipo: 'entrada', rel: 0 }, ...(d.salida ? [{ tipo: 'salida', rel: 1 }] : [])];
    const horas = { entrada: d.entrada, salida: d.salida || d.salidaEstimada, banco: d.salidaBanco, ahora: '' };
    const ahoraRel = linea ? linea.ahoraRel : Infinity;
    let primero = true;
    orden.forEach((hito, i) => {
        const nodo = r.hitos[hito.tipo];
        if (!nodo) return;
        mostrar(nodo.raiz, true);
        nodo.raiz.style.order = String(i);
        nodo.raiz.classList.toggle('primero', primero);
        nodo.raiz.classList.toggle('pasado', hito.tipo !== 'ahora' && hito.rel <= ahoraRel);
        primero = false;
        fijar(nodo.hora, horas[hito.tipo] ?? '');
        if (hito.tipo === 'salida') fijar(nodo.etiqueta, d.cerrado ? 'Salida' : 'Salida estimada');
        if (hito.tipo === 'banco') entonar(nodo.raiz, tonoBanco(d.banco));
    });
}

/** Sin registro: entrada y salida quedan pendientes (nodos punteados). */
function pintarNodosPendientes(r) {
    for (const h of Object.values(r.hitos)) mostrar(h.raiz, false);
    const pendientes = [['entrada', 'Entrada · pendiente'], ['salida', 'Salida estimada · se calcula al fichar']];
    pendientes.forEach(([tipo, texto], i) => {
        const nodo = r.hitos[tipo];
        mostrar(nodo.raiz, true);
        nodo.raiz.classList.add('pendiente');
        nodo.raiz.classList.toggle('primero', i === 0);
        nodo.raiz.classList.remove('pasado');
        nodo.raiz.style.order = String(i);
        fijar(nodo.etiqueta, texto);
        fijar(nodo.hora, '');
    });
}

// ─── E · Lista de filas ───────────────────────────────────────────────────────────────────────────────────────────────────
function crearFilas() {
    const raiz = el('div', 'est-filas');
    const cabecera = el('div', 'est-fila est-fila--cabecera');
    const etiqueta = el('span', 'est-fila-etiqueta est-fila-etiqueta--chica', 'Llevás trabajado');
    const grande = el('span', 'est-fila-grande');
    const duracion = crearDuracion('est-duracion--media');
    const emoji = el('span', 'est-emoji');
    const texto = el('span', 'est-fila-texto');
    grande.append(emoji, texto, duracion.raiz);
    cabecera.append(etiqueta, grande);
    raiz.append(cabecera);

    /** @type {Record<string, ReturnType<typeof crearDato>>} */
    const filas = {};
    for (const [id, rotulo] of [['entrada', 'Entrada'], ['salida', 'Salida estimada'], ['conBanco', 'Salida con banco'], ['fuera', 'Tiempo fuera'], ['balance', 'Faltan'], ['banco', 'Banco de horas'], ['estado', 'Estado'], ['nota', 'Nota']]) {
        const f = crearDato(rotulo, 'est-fila');
        f.etiqueta.className = 'est-fila-etiqueta';
        f.valor.className = 'est-fila-valor';
        raiz.append(f.raiz);
        filas[id] = f;
    }
    return { raiz, cabecera, etiqueta, emoji, texto, duracion, filas };
}

function pintarFilas(r, d) {
    r.raiz.dataset.tipo = d.tipo;
    const f = r.filas;
    for (const fila of Object.values(f)) mostrar(fila.raiz, false);
    mostrar(r.duracion.raiz, d.tipo === 'registro');
    mostrar(r.emoji, d.tipo !== 'registro');
    mostrar(r.texto, d.tipo !== 'registro');
    r.cabecera.dataset.color = d.tipo === 'especial' ? d.color : 'neutro';
    entonar(r.texto, d.tipo === 'espera' ? 'apagado' : 'neutro');

    const fila = (id, etiqueta, valor, tono) => { mostrar(f[id].raiz, true); pintarDato(f[id], etiqueta, valor, tono); };

    if (d.tipo === 'registro') {
        fijar(r.etiqueta, d.cerrado ? 'Trabajaste' : 'Llevás trabajado');
        mostrar(r.emoji, false);
        pintarDuracion(r.duracion, d.trabajado);
        fila('entrada', 'Entrada', d.entrada);
        if (d.cerrado) fila('salida', 'Salida', d.salida);
        else if (d.salidaEstimada) fila('salida', 'Salida estimada', d.salidaEstimada);
        if (d.salidaBanco) fila('conBanco', 'Salida con banco', d.salidaBanco, tonoBanco(d.banco));
        if (d.tiempoFuera) fila('fuera', d.tiempoFuera.corriendo ? 'Tiempo fuera (en curso)' : 'Tiempo fuera', d.tiempoFuera.texto);
        if (d.balance) fila('balance', d.balance.etiqueta, d.balance.texto, d.balance.tono);
        if (d.banco) fila('banco', 'Banco de horas', d.banco.texto, tonoBanco(d.banco));
    } else if (d.tipo === 'espera') {
        fijar(r.etiqueta, 'Llevás trabajado');
        fijar(r.emoji, '');
        mostrar(r.emoji, false);
        fijar(r.texto, d.mensaje || '—');
        fila('entrada', 'Entrada', '--:--', 'apagado');
        fila('salida', 'Salida estimada', '--:--', 'apagado');
        fila('conBanco', 'Salida con banco', '--:--', 'apagado');
        if (d.banco) fila('banco', 'Banco de horas', d.banco.texto, tonoBanco(d.banco));
    } else {
        fijar(r.etiqueta, 'Hoy');
        fijar(r.emoji, d.emoji);
        fijar(r.texto, d.etiqueta);
        fila('estado', 'Estado', d.etiqueta);
        f.estado.valor.dataset.color = d.color;
        fila('nota', 'Nota', d.descripcion);
    }
}

// ─── F · Tipográfica minimal ──────────────────────────────────────────────────────────────────────────────────────────────
function crearTipografica() {
    const raiz = el('div', 'est-tipografica');
    const emoji = el('div', 'est-emoji est-emoji--grande');
    const duracion = crearDuracion('est-duracion--enorme');
    const titulo = el('div', 'est-tipografica-titulo');
    const subtitulo = el('div', 'est-tipografica-subtitulo');

    const linea = el('div', 'est-regla');
    const relleno = el('span', 'est-regla-relleno');
    const marca = el('span', 'est-regla-marca');
    linea.append(relleno, marca);
    const izq = el('span', 'est-regla-hora');
    const der = el('span', 'est-regla-hora');
    const fila = el('div', 'est-regla-fila');
    fila.append(izq, linea, der);
    const pie = el('div', 'est-regla-pie');
    const pieIzq = el('span', 'est-regla-leyenda');
    const pieDer = el('span', 'est-regla-leyenda est-regla-leyenda--der');
    pie.append(pieIzq, pieDer);

    const regla = el('div', 'est-regla-bloque');
    regla.append(fila, pie);
    raiz.append(emoji, duracion.raiz, titulo, subtitulo, regla);
    return { raiz, emoji, duracion, titulo, subtitulo, regla, linea, relleno, marca, izq, der, pieIzq, pieDer };
}

function pintarTipografica(r, d) {
    r.raiz.dataset.tipo = d.tipo;
    const esRegistro = d.tipo === 'registro';
    mostrar(r.emoji, !esRegistro);
    mostrar(r.duracion.raiz, esRegistro);
    mostrar(r.titulo, !esRegistro);
    r.raiz.dataset.color = d.tipo === 'especial' ? d.color : (esRegistro ? d.color : 'neutro');

    if (d.tipo === 'registro') {
        pintarDuracion(r.duracion, d.trabajado);
        const partes = ['trabajados hoy'];
        if (d.balance) partes.push(d.balance.etiqueta === 'Objetivo' ? 'objetivo cumplido' : `${d.balance.etiqueta.toLowerCase()} ${d.balance.texto}`);
        if (d.tiempoFuera) partes.push(`${d.tiempoFuera.corriendo ? 'fuera (en curso)' : 'fuera'} ${d.tiempoFuera.texto}`);
        fijar(r.subtitulo, partes.join(' · '));
        entonar(r.subtitulo, 'apagado');

        const linea = d.linea;
        mostrar(r.regla, true);
        mostrar(r.linea, !!linea);
        mostrar(r.izq, true);
        mostrar(r.der, !!(d.salida || d.salidaEstimada));
        fijar(r.izq, d.entrada);
        fijar(r.der, d.salida || d.salidaEstimada);
        r.linea.classList.remove('punteada', 'llena');
        if (linea) {
            const pos = posicionesLinea(linea);
            r.relleno.style.setProperty('--avance', String(d.cerrado ? 1 : pos.avance));
            mostrar(r.marca, pos.banco !== null);
            if (pos.banco !== null) r.marca.style.setProperty('--banco', String(pos.banco));
            entonar(r.marca, tonoBanco(d.banco));
        }
        fijar(r.pieIzq, 'Entrada');
        const conBanco = d.salidaBanco && d.banco ? `Con banco ${d.salidaBanco} · ${d.banco.texto}` : (d.cerrado ? 'Salida' : 'Salida estimada');
        fijar(r.pieDer, conBanco);
        entonar(r.pieDer, d.salidaBanco ? tonoBanco(d.banco) : 'apagado');
        return;
    }

    fijar(r.emoji, d.emoji);
    r.linea.classList.toggle('punteada', d.tipo === 'espera');
    r.linea.classList.toggle('llena', d.tipo === 'especial');
    mostrar(r.linea, true);
    mostrar(r.marca, false);
    mostrar(r.izq, false);
    mostrar(r.der, false);
    mostrar(r.pieIzq, true);
    r.relleno.style.setProperty('--avance', d.tipo === 'especial' ? '1' : '0');
    entonar(r.pieDer, 'apagado');
    fijar(r.pieDer, '');
    if (d.tipo === 'espera') {
        fijar(r.titulo, d.mensaje);
        mostrar(r.titulo, !!d.mensaje);
        fijar(r.subtitulo, '');
        mostrar(r.regla, !!d.banco);
        fijar(r.pieIzq, d.banco ? fraseBanco(d.banco) : '');
        entonar(r.pieIzq, tonoBanco(d.banco));
    } else {
        fijar(r.titulo, d.etiqueta);
        fijar(r.subtitulo, '');
        mostrar(r.regla, true);
        fijar(r.pieIzq, d.descripcion);
        entonar(r.pieIzq, 'apagado');
    }
}

// ─── Montaje ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
const DISENOS = {
    anillo: { crear: crearAnillo, pintar: pintarAnillo },
    linea: { crear: crearLinea, pintar: pintarLinea },
    filas: { crear: crearFilas, pintar: pintarFilas },
    tipografica: { crear: crearTipografica, pintar: pintarTipografica }
};

/** @type {{ id: string, refs: any } | null} */
let _montado = null;

/**
 * Dibuja el resumen del día con el diseño del estilo elegido. Al cambiar de estilo se reconstruye el DOM; si el estilo no es propio (o no hay
 * resumen) deja el contenedor vacío y devuelve false: la tarjeta usa entonces la barra de siempre.
 * @param {any} resumen
 */
function actualizar(resumen) {
    const host = $('stats-estilo');
    if (!host) return false;
    const id = EstiloTarjeta.actual();
    const diseno = DISENOS[/** @type {keyof typeof DISENOS} */ (id)];
    if (!diseno || !resumen) {
        if (_montado) { host.replaceChildren(); _montado = null; }
        return false;
    }
    if (!_montado || _montado.id !== id || !host.firstChild) {
        host.replaceChildren();
        const refs = diseno.crear();
        host.append(refs.raiz);
        _montado = { id, refs };
    }
    diseno.pintar(_montado.refs, resumen);
    return true;
}

export const TarjetaEstilos = { actualizar };
