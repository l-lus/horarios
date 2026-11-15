import { hitosOrdenados } from '../core/resumen-tarjeta.js';
import {
    el, fijar, mostrar, entonar, fijarQueEntre, etiquetaBalance, tonoBanco, crearDuracion, pintarDuracion, crearDato, pintarDato, textoDia
} from './tarjeta-estilos-piezas.js';

// ====================================================================
// TARJETA DE ESTADO · diseño «Línea de tiempo»
// ====================================================================
// Parte de tarjeta-estilos.js (no lo importa): cabecera, nodos del día o de la semana, mosaicos y la entrada animada de la línea.

const ROTULOS_NODO = { entrada: 'Entrada', ahora: 'Ahora', salida: 'Salida', banco: 'Con banco' };

export function crearLinea() {
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

    // la semana: un nodo por día
    const nodosDias = el('ol', 'est-nodos');
    const dias = Array.from({ length: 7 }, () => {
        const li = el('li', 'est-nodo est-nodo--dia');
        const e = el('span', 'est-nodo-etiqueta');
        const hora = el('span', 'est-nodo-hora');
        li.append(el('span', 'est-nodo-punto'), e, hora);
        nodosDias.append(li);
        return { raiz: li, etiqueta: e, hora };
    });

    const mosaicos = el('div', 'est-mosaicos');
    const balance = crearDato('Faltan', 'est-dato est-mosaico');
    // tercera línea del mosaico: "Cubierto" cuando el faltante de un día cerrado lo cubre el saldo
    balance.raiz.append(el('span', 'est-dato-detalle'));
    const banco = crearDato('Banco de horas', 'est-dato est-mosaico');
    const fuera = crearDato('Tiempo fuera', 'est-dato est-mosaico');
    // tercera línea del mosaico: si ese tiempo se descuenta o no del total (opción "No descontar tiempo fuera" de Ajustes)
    const fueraDetalle = el('span', 'est-dato-detalle');
    fuera.raiz.append(fueraDetalle);
    mosaicos.append(balance.raiz, banco.raiz, fuera.raiz);
    const nota = el('div', 'est-linea-nota');
    // cabecera (tiempo trabajado) y cuerpo (la línea): en una tarjeta ancha van lado a lado (ver la disposición en estilo-tarjeta.js);
    // los mosaicos y la nota quedan siempre abajo, a todo el ancho
    const cuerpo = el('div', 'est-linea-cuerpo');
    cuerpo.append(nodos, nodosDias);
    raiz.append(cabecera, cuerpo, mosaicos, nota);
    return { raiz, cabecera, cuerpo, etiqueta, duracion, titulo, emoji, texto, nodos, hitos, nodosDias, dias, mosaicos, balance, banco, fuera, nota };
}

/**
 * Esperando registro no tiene el número grande de arriba ("Llevás trabajado", "Total de la semana"): su cabecera es más baja y la línea de tiempo arrancaría más arriba que
 * en la semana. Se le reserva el alto de la cabecera de la semana (la de la capa de medida) para que, al alternar de vista, el comienzo de la línea no cambie de lugar.
 * @param {any} r @param {any} rSemana
 */
export function alinearLinea(r, rSemana) {
    const espera = r.raiz.dataset.tipo === 'espera' && !r.cuerpo.classList.contains('hidden');
    r.cabecera.style.minHeight = espera ? `${rSemana.cabecera.offsetHeight}px` : '';
}

export function pintarLinea(r, d) {
    r.raiz.dataset.tipo = d.tipo;
    const esRegistro = d.tipo === 'registro';
    const conTotal = esRegistro || d.tipo === 'semana';
    mostrar(r.etiqueta, conTotal);
    mostrar(r.duracion.raiz, conTotal);
    mostrar(r.titulo, !conTotal);
    mostrar(r.nota, d.tipo === 'especial');
    mostrar(r.nodosDias, d.tipo === 'semana');
    // sin línea que mostrar (día especial o sin registro: esperando, día libre o sin mensaje) la cabecera ocupa todo el ancho: no hay entrada ni salida que mostrar todavía
    const sinLinea = d.tipo === 'especial' || d.tipo === 'espera';
    mostrar(r.cuerpo, !sinLinea);
    r.raiz.classList.toggle('sin-cuerpo', sinLinea);

    if (conTotal) {
        if (esRegistro) fijar(r.etiqueta, d.cerrado ? 'Trabajaste' : 'Llevás trabajado');
        else fijar(r.etiqueta, d.abierta ? 'Llevás en la semana' : 'Total de la semana');
        pintarDuracion(r.duracion, d.trabajado);
        mostrar(r.nodos, esRegistro);
        if (esRegistro) pintarNodos(r, d); else pintarNodosDias(r, d.dias, d.abierta, d.entradaMs);
        mostrar(r.balance.raiz, !!d.balance);
        if (d.balance) {
            pintarDato(r.balance, etiquetaBalance(d), d.balance.texto, d.balance.tono);
        }
        mostrar(r.banco.raiz, !!d.banco);
        if (d.banco) pintarDato(r.banco, 'Banco de horas', d.banco.texto, tonoBanco(d.banco));
        mostrar(r.fuera.raiz, esRegistro && !!d.tiempoFuera);
        if (esRegistro && d.tiempoFuera) {
            pintarDato(r.fuera, d.tiempoFuera.corriendo ? 'Fuera (en curso)' : 'Tiempo fuera', d.tiempoFuera.texto);
        }
        mostrar(r.mosaicos, !!(d.balance || d.banco || (esRegistro && d.tiempoFuera)));
        // se mide con los mosaicos ya visibles y con su valor puesto: la tercera línea pasa a la versión corta solo si la completa se parte en dos
        if (d.balance) fijarQueEntre(r.balance.raiz.querySelector('.est-dato-detalle'), d.balance.detalle);
        if (esRegistro && d.tiempoFuera) {
            fijarQueEntre(r.fuera.raiz.querySelector('.est-dato-detalle'), d.tiempoFuera.descuenta ? ['Se descuenta', 'Descuenta'] : ['No se descuenta', 'No descuenta']);
        }
        return;
    }

    fijar(r.emoji, d.emoji);
    r.titulo.dataset.color = d.tipo === 'especial' ? d.color : 'neutro';
    if (d.tipo === 'espera') {
        fijar(r.texto, d.mensaje);
        mostrar(r.nodos, false);
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
    // con la jornada abierta el tramo azul (de la entrada hasta ahora) lleva el brillo de la barra de progreso
    r.nodos.classList.toggle('en-curso', !d.cerrado);
    for (const [tipo, h] of Object.entries(r.hitos)) {
        mostrar(h.raiz, false);
        h.raiz.classList.remove('pendiente');
        fijar(h.etiqueta, ROTULOS_NODO[tipo]);   // sin registro quedan como "Entrada · pendiente"
    }

    /** @type {{ tipo: string, rel: number }[]} */
    const orden = linea ? hitosOrdenados(linea) : [{ tipo: 'entrada', rel: 0 }, ...(d.salida ? [{ tipo: 'salida', rel: 1 }] : [])];
    const horas = { entrada: d.entrada, salida: d.salida || d.salidaEstimada, banco: d.salidaBanco, ahora: '' };
    const ahoraRel = linea ? linea.ahoraRel : Infinity;
    // color de cada conector (el tramo que llega a ese nodo) según la zona donde termina, como el anillo: azul hasta la primera salida, el color del banco entre ambas y verde después
    const zonas = linea && d.anillo && linea.hayBanda ? { lo: Math.min(linea.salidaRel, linea.bufferRel), hi: Math.max(linea.salidaRel, linea.bufferRel), medio: d.anillo.colorMedio } : null;
    const tramoDe = (/** @type {number} */ rel) => !linea || !d.anillo ? 'blue' : !zonas ? (rel <= linea.salidaRel ? 'blue' : 'green') : rel <= zonas.lo ? 'blue' : rel <= zonas.hi ? zonas.medio : 'green';
    // el brillo es uno solo y llega hasta "ahora": cuántos tramos de la línea (de nodo a nodo) hay hasta ese punto
    r.nodos.style.setProperty('--segmentos', String(Math.max(0, orden.findIndex(h => h.tipo === 'ahora'))));
    let primero = true;
    orden.forEach((hito, i) => {
        const nodo = r.hitos[hito.tipo];
        if (!nodo) return;
        mostrar(nodo.raiz, true);
        nodo.raiz.style.order = String(i);
        nodo.raiz.classList.toggle('primero', primero);
        nodo.raiz.classList.toggle('pasado', hito.tipo !== 'ahora' && hito.rel <= ahoraRel);
        primero = false;
        // cerrado no hay zonas: todo el tramo lleva el color del estado con que cerró
        if (!d.cerrado) nodo.raiz.dataset.tramo = tramoDe(hito.rel);
        else if (['green', 'gold', 'red'].includes(d.color)) nodo.raiz.dataset.tramo = d.color;
        else delete nodo.raiz.dataset.tramo;
        fijar(nodo.hora, horas[hito.tipo] ?? '');
        if (hito.tipo === 'salida') fijar(nodo.etiqueta, d.cerrado ? 'Salida' : 'Salida estimada');
        if (hito.tipo === 'banco') entonar(nodo.raiz, tonoBanco(d.banco));
        // el badge de "Ahora" lleva el color de la zona donde está, como el remate de la barra con hitos (azul antes de la primera salida, el color del banco entre ambas, verde después)
        if (hito.tipo === 'ahora') nodo.raiz.dataset.color = linea && d.anillo ? tramoDe(hito.rel) : (d.color ?? 'blue');
        // con el registro cerrado los hitos (entrada y salida) y el conector toman el color del estado con que cerró (el mismo del badge "Finalizado")
        nodo.raiz.classList.toggle('cerrado', !!d.cerrado);
        if (d.cerrado) { nodo.raiz.classList.add('pasado'); nodo.raiz.dataset.color = d.color ?? 'neutro'; }
        else if (hito.tipo !== 'ahora') delete nodo.raiz.dataset.color;
    });
    animarEntradaLinea(r, orden.map(h => r.hitos[h.tipo].raiz), d.entradaMs);
}

// La línea se llena más despacio que el número (con su curva ease-out el primer tramo se haría en una fracción de segundo y no se vería) y espera a que termine el fundido de un cambio de vista
const FACTOR_LINEA = 1.8;
export const BASE_ENTRADA = 120;
/** Lo que tarda en llenarse la línea, dada la duración del conteo (ms). @param {number} duracion */
export const duracionLinea = duracion => Math.round(duracion * FACTOR_LINEA);

/**
 * Entrada de la línea (del día o de la semana), como la de la barra con hitos: el tramo ya recorrido se llena de arriba abajo a ritmo parejo (un tramo detrás del otro) y los textos
 * de cada nodo suben desde abajo cuando la línea llega a él (los mosaicos, a mitad). Cada conector es un tramo (de nodo a nodo) y le toca la misma parte del recorrido total. La clase `entrando` (que activa las animaciones en CSS) se quita al terminar.
 * @param {any} r @param {HTMLElement[]} nodos los nodos visibles, en orden @param {number} [duracion] la del conteo en ms (ver `duracionLinea`); 0 / undefined: sin animación
 */
function animarEntradaLinea(r, nodos, duracion = 0) {
    const ms = duracionLinea(duracion);
    const base = BASE_ENTRADA;
    // un dibujo sin entrada (el reloj, un cambio de tamaño) no corta la que está en curso: la clase se quita sola al terminar
    if (!(duracion > 1)) return;
    clearTimeout(r.timerEntrada);
    r.raiz.classList.remove('entrando');
    // todos los nodos van en fila, coloreados o no: la línea avanza a ritmo parejo, un tramo detrás del otro (los que todavía no se alcanzaron en la vida real también se dibujan, apagados)
    const tramos = nodos.length - 1;
    nodos.forEach((raiz, i) => {
        raiz.style.setProperty('--ret', `${Math.round(base + (tramos > 0 ? (i / tramos) * ms : 0))}ms`);
        if (i > 0) {
            raiz.style.setProperty('--con-ret', `${Math.round(base + ((i - 1) / tramos) * ms)}ms`);
            raiz.style.setProperty('--con-dur', `${Math.max(1, Math.round(ms / tramos))}ms`);
        }
    });
    r.raiz.style.setProperty('--ret-mosaicos', `${Math.round(base + ms * 0.4)}ms`);
    void r.raiz.offsetWidth;
    r.raiz.classList.add('entrando');
    r.timerEntrada = setTimeout(() => r.raiz.classList.remove('entrando'), base + ms + 800);
}

/** Un nodo por día de la semana: hoy en azul, los pasados con el color de su estado y los que faltan punteados. */
function pintarNodosDias(r, dias, enCurso, entradaMs = 0) {
    r.nodosDias.classList.toggle('en-curso', !!enCurso);   // con la semana abierta, el tramo hasta hoy brilla igual
    // un solo brillo que va desde el primer día hasta hoy: cuántos tramos hay hasta el nodo de hoy
    r.nodosDias.style.setProperty('--segmentos', String(Math.max(0, dias.findIndex(dia => dia.hoy))));
    r.dias.forEach((n, i) => {
        const dia = dias[i];
        mostrar(n.raiz, !!dia);
        if (!dia) return;
        const futuro = dia.estado === 'futuro' && !dia.hoy;
        // un feriado, asueto, vacaciones... cargado por adelantado se ve desde ya (con su color y su emoji), aunque el día todavía no haya llegado
        const especialFuturo = futuro && !!dia.especial;
        const pendiente = futuro && !especialFuturo;
        n.raiz.classList.toggle('primero', i === 0);
        n.raiz.classList.toggle('hoy', !!dia.hoy);
        n.raiz.classList.toggle('pendiente', pendiente);
        n.raiz.classList.toggle('pasado', !futuro);   // el conector azul llega hasta hoy, también con días especiales más adelante
        n.raiz.classList.toggle('lleno', !futuro);   // el punto se rellena cuando el día ya pasó (hoy lo resuelve el CSS); un día por adelantado queda hueco, aunque sea especial
        n.raiz.dataset.color = (especialFuturo ? dia.especial : dia.color) ?? 'neutro';
        fijar(n.etiqueta, dia.hoy ? 'Hoy' : dia.sigla);
        // los días que faltan llevan un "-" (el "pendiente" queda para hoy, que es el que espera su registro)
        fijar(n.hora, especialFuturo ? `${dia.emoji} ${dia.etiqueta}`.trim() : pendiente ? '-' : textoDia(dia));
    });
    animarEntradaLinea(r, r.dias.slice(0, dias.length).map(n => n.raiz), entradaMs);
}
