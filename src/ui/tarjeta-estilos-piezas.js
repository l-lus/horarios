import { superaUnaLinea } from '../core/dom.js';
import { duracionCompacta, horaCorta } from '../core/resumen-tarjeta.js';

// ====================================================================
// TARJETA DE ESTADO · piezas comunes de los diseños propios (anillo, línea de tiempo y lista de filas)
// ====================================================================
// Parte de tarjeta-estilos.js (no lo importa). Todo se escribe con createElement/textContent: sin innerHTML (Trusted Types) y sin estilos en línea en el HTML (CSP).
export const NS_SVG = 'http://www.w3.org/2000/svg';

/** @param {string} tag @param {string} [clase] @param {string} [texto] @returns {HTMLElement} */
export function el(tag, clase = '', texto = '') {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto) n.textContent = texto;
    return n;
}

/** @param {string} clase @returns {SVGCircleElement} círculo de radio 44 con pathLength 100: el avance es un dashoffset de 0 a 100 */
export function circulo(clase) {
    const c = /** @type {SVGCircleElement} */ (document.createElementNS(NS_SVG, 'circle'));
    c.setAttribute('class', clase);
    c.setAttribute('cx', '50');
    c.setAttribute('cy', '50');
    c.setAttribute('r', '44');
    c.setAttribute('pathLength', '100');
    return c;
}

/** @param {Element} n @param {string} texto */
export const fijar = (n, texto) => { if (n.textContent !== texto) n.textContent = texto; };
/** @param {Element} n @param {boolean} visible */
export const mostrar = (n, visible) => n.classList.toggle('hidden', !visible);
/** @param {HTMLElement} n @param {string | undefined} tono 'neutro' | 'green' | 'red' | 'gold' */
export const entonar = (n, tono) => { n.dataset.tono = tono || 'neutro'; };

/** Versiones de cada texto "que entre" (de la más completa a la más corta): hace falta recordarlas para volver a elegir cuando cambia el ancho del lugar donde está. @type {WeakMap<HTMLElement, string[]>} */
export const versionesQueEntre = new WeakMap();

/**
 * Pone en `n` el primer texto de `textos` que entra en una línea: el completo y, solo si se parte en dos, la siguiente versión (más corta).
 * Cada llamada parte del texto completo, así que vuelve solo cuando vuelve a entrar (ej. al girar el celular). Con un solo texto equivale a `fijar`.
 * Necesita el elemento en el documento y visible para medir; sin eso (alto 0) queda el completo.
 * @param {HTMLElement} n @param {string | string[] | undefined} textos
 */
export function fijarQueEntre(n, textos) {
    const versiones = [textos ?? ''].flat();
    versionesQueEntre.set(n, versiones);
    fijar(n, versiones[0]);
    for (let i = 1; i < versiones.length && superaUnaLinea(n, n.scrollHeight); i++) fijar(n, versiones[i]);
}
export const pad2 = n => String(n).padStart(2, '0');

/** Frase del banco de horas de la semana: "▲ 19 min extras esta semana". @param {{ minutos: number, positivo: boolean }} banco */
export const fraseBanco = banco => `${banco.positivo ? '▲' : '▼'} ${duracionCompacta(Math.abs(banco.minutos))} ${banco.positivo ? 'extras' : 'faltantes'} esta semana`;
/**
 * Etiqueta del mosaico de balance (la comparten la línea de tiempo y el anillo): con el registro en curso y el objetivo del día cumplido, el extra es el de hoy
 * (cerrado o en la semana queda "Extra"). @param {any} d resumen
 */
export const etiquetaBalance = d => (d.tipo === 'registro' && !d.cerrado && d.balance.etiqueta === 'Extra' ? 'Extra de hoy' : d.balance.etiqueta);
/** @param {{ positivo: boolean } | null} banco */
export const tonoBanco = banco => (banco ? (banco.positivo ? 'green' : 'red') : 'neutro');

// ─── Piezas comunes ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** Duración con unidades chicas ("7 h 45 min"): el número grande y la unidad en tipografías distintas. */
export function crearDuracion(clase = '') {
    const raiz = el('span', `est-duracion ${clase}`.trim());
    const h = el('span', 'est-num');
    const hu = el('span', 'est-unidad', 'h');
    const m = el('span', 'est-num');
    const mu = el('span', 'est-unidad', 'min');
    raiz.append(h, hu, m, mu);
    return { raiz, h, hu, m, mu };
}

/** @param {ReturnType<typeof crearDuracion>} d @param {{ horas: number, minutos: number }} t */
export function pintarDuracion(d, { horas, minutos }) {
    const conHoras = horas > 0;
    const conMinutos = !conHoras || minutos > 0;
    mostrar(d.h, conHoras); mostrar(d.hu, conHoras);
    mostrar(d.m, conMinutos); mostrar(d.mu, conMinutos);
    fijar(d.h, String(horas));
    fijar(d.m, String(minutos));
}

/** Etiqueta chica y valor (la unidad de la cuadrícula inferior del anillo y de los mosaicos de la línea de tiempo). */
export function crearDato(etiqueta, clase = 'est-dato') {
    const raiz = el('div', clase);
    const e = el('span', 'est-dato-etiqueta', etiqueta);
    const valor = el('span', 'est-dato-valor');
    raiz.append(e, valor);
    return { raiz, etiqueta: e, valor };
}

/** @param {ReturnType<typeof crearDato>} d @param {string} etiqueta @param {string} valor @param {string} [tono] */
export function pintarDato(d, etiqueta, valor, tono) {
    fijar(d.etiqueta, etiqueta);
    fijar(d.valor, valor);
    entonar(d.raiz, tono);
}

// ─── Días de la semana (compartido) ──────────────────────────────────────────────────────────────────────────────────────

/** Qué se escribe de un día en la semana: sus horas, el emoji del día especial o su estado cuando no hay horas. @param {any} dia */
export function textoDia(dia) {
    if (dia.totalMin > 0) return duracionCompacta(dia.totalMin);
    if (dia.estado === 'especial') return `${dia.emoji} ${dia.etiqueta}`.trim();
    return { 'sin-salida': 'sin salida', 'sin-registro': 'sin registro', futuro: 'pendiente' }[/** @type {string} */ (dia.estado)] ?? '—';
}

/** Fila de celdas chicas (sigla y horas de cada día): el pie del anillo en la semana. */
export function crearDias(max = 7) {
    const raiz = el('div', 'est-dias');
    const celdas = Array.from({ length: max }, () => {
        const c = el('div', 'est-dia');
        const sigla = el('span', 'est-dia-sigla');
        const valor = el('span', 'est-dia-valor');
        c.append(sigla, valor);
        raiz.append(c);
        return { raiz: c, sigla, valor };
    });
    return { raiz, celdas };
}

/** @param {ReturnType<typeof crearDias>} d @param {any[]} dias */
export function pintarDias(d, dias) {
    d.celdas.forEach((c, i) => {
        const dia = dias[i];
        mostrar(c.raiz, !!dia);
        if (!dia) return;
        fijar(c.sigla, dia.sigla);
        fijar(c.valor, dia.estado === 'especial' && dia.emoji ? dia.emoji : horaCorta(dia.totalMin));
        c.raiz.dataset.color = dia.color ?? 'neutro';
        c.raiz.dataset.estado = dia.estado;
        c.raiz.classList.toggle('hoy', !!dia.hoy);
    });
}
