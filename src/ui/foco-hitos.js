import { $ } from '../core/dom.js';
import { BarraHitos } from './barra-hitos.js';

// ====================================================================
//                FOCO DE HITOS (barra de progreso del día)
// ====================================================================
// Mientras el ciclo del número grande (tarjeta-ciclo-stats.js) muestra una fase, resalta en la barra el hito al que se refiere:
// su hora pasa a una píldora con la descripción desplegada, el resto se atenúa y el punto pulsa.
// Solo alterna clases (`foco` en la etiqueta y en la marca, `hay-foco` en la pista). El dibujo es CSS (tarjetas-vistas.css) y
// qué versión de la descripción entra en cada etiqueta (y si conviene abrirla hacia la derecha de la hora mientras dura el foco) lo decide barra-hitos.js al medir;
// así este módulo no conoce geometría ni textos.

// Elementos de la barra que enfoca cada fase del ciclo (la entrada no tiene marca propia: usa el remate del comienzo; cerrada, la salida usa el remate del final)
const _HITOS_POR_FASE = {
    entrada: ['linea-et-entrada', 'progress-punto-inicio'],
    salida: ['linea-et-salida', 'progress-punto'],
    salidaEstimada: ['linea-et-salida', 'linea-tick-salida'],
    banco: ['linea-et-buffer', 'linea-tick-buffer'],
};

/** @type {HTMLElement[]} */
let _enfocados = [];

/**
 * Enfoca el hito de la fase `tipo`; cualquier otra fase (horas, tiempo fuera) o null quita el foco.
 * @param {string | null} tipo
 */
function enfocar(tipo) {
    _enfocados.forEach(el => { el.classList.remove('foco'); BarraHitos.desplegarADerecha(el, false); });
    _enfocados = [];
    const pista = $('progress-bar')?.closest('.progress-pista');
    const ids = tipo ? _HITOS_POR_FASE[tipo] : undefined;
    pista?.classList.toggle('hay-foco', !!ids);
    if (!ids) return;
    ids.forEach(id => {
        const el = $(id);
        if (!el) return;
        el.classList.add('foco');
        BarraHitos.desplegarADerecha(el, true);   // solo hace algo en las etiquetas cuya descripción no entra a la izquierda (ver barra-hitos.js)
        _enfocados.push(el);
    });
}

export const FocoHitos = { enfocar };
