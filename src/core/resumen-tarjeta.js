// ====================================================================
// RESUMEN DEL DÍA PARA LOS ESTILOS DE LA TARJETA DE ESTADO (funciones puras, sin DOM)
// ====================================================================
// Los diseños propios de la tarjeta (anillo, línea de tiempo, lista de filas, tipográfica) dibujan los mismos datos con distinta forma:
// acá se calculan una sola vez, en minutos y con textos compactos ("6 h 38 min").

/** @param {number} minutos entero (se redondea; lo negativo cuenta como 0) */
export function partesDuracion(minutos) {
    const total = Math.max(0, Math.round(minutos));
    return { horas: Math.floor(total / 60), minutos: total % 60 };
}

/** "22 min", "7 h", "7 h 45 min". @param {number} minutos */
export function duracionCompacta(minutos) {
    const { horas, minutos: m } = partesDuracion(minutos);
    if (horas === 0) return `${m} min`;
    return m === 0 ? `${horas} h` : `${horas} h ${m} min`;
}

/** Con signo explícito: "+19 min", "−35 min" (menos tipográfico). @param {number} minutos */
export function duracionConSigno(minutos) {
    return `${minutos < 0 ? '−' : '+'}${duracionCompacta(Math.abs(minutos))}`;
}

/**
 * Hitos de la jornada abierta o cerrada en orden de aparición (minutos relativos a la entrada), para la línea de tiempo vertical.
 * "Ahora" se ordena entre los demás por su hora; con la jornada cerrada solo quedan la entrada y la salida real.
 * @param {{ cerrado: boolean, ahoraRel: number, salidaRel: number, bufferRel: number | null, hayBanda: boolean }} linea
 * @returns {{ tipo: 'entrada' | 'ahora' | 'salida' | 'banco', rel: number }[]}
 */
export function hitosOrdenados(linea) {
    /** @type {{ tipo: 'entrada' | 'ahora' | 'salida' | 'banco', rel: number }[]} */
    const hitos = [{ tipo: 'entrada', rel: 0 }];
    if (linea.cerrado) {
        hitos.push({ tipo: 'salida', rel: linea.salidaRel });
        return hitos;
    }
    hitos.push({ tipo: 'ahora', rel: linea.ahoraRel }, { tipo: 'salida', rel: linea.salidaRel });
    if (linea.hayBanda && linea.bufferRel !== null) hitos.push({ tipo: 'banco', rel: linea.bufferRel });
    // orden estable: ante un empate "ahora" va primero (es lo que ya pasó), la salida y luego el banco
    const prioridad = { entrada: 0, ahora: 1, salida: 2, banco: 3 };
    return hitos.sort((a, b) => a.rel - b.rel || prioridad[a.tipo] - prioridad[b.tipo]);
}

/**
 * Posiciones (0 a 1) del avance, la salida con banco y el final sobre una escala común, para la línea de la variante tipográfica.
 * La escala llega hasta el hito más lejano (si el banco obliga a quedarse más tiempo, la salida con banco es el final).
 * @param {{ ahoraRel: number, salidaRel: number, bufferRel: number | null, hayBanda: boolean }} linea
 */
export function posicionesLinea(linea) {
    const fin = Math.max(linea.salidaRel, linea.hayBanda && linea.bufferRel !== null ? linea.bufferRel : 0, 1);
    const unitario = v => Math.min(1, Math.max(0, v / fin));
    return {
        avance: unitario(linea.ahoraRel),
        salida: unitario(linea.salidaRel),
        banco: linea.hayBanda && linea.bufferRel !== null ? unitario(linea.bufferRel) : null
    };
}
