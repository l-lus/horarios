// ====================================================================
// ACCIONES DE LA UI QUE OTROS MÓDULOS DE LA UI NECESITAN SIN PODER IMPORTARLAS
// ====================================================================
// Redibujar la tarjeta de estado o revisar el botón de crédito viven en módulos que importan a quienes las piden
// (tarjeta-fichaje.js, historico-edicion.js): importarlas directo formaría un ciclo. El orquestador las registra al arrancar.
// Es un canal de la UI hacia la UI: los servicios siguen hablando con la UI por EstadoApp._notify() (ver services/estado-app.js).
// Sin imports a propósito, para que cualquier módulo de ui/ lo pueda usar.

const _acciones = {
    /** @type {(...args: any[]) => void} */ actualizarUI: () => { },
    /** @type {(sinAnimarTitulo?: boolean) => void} */ actualizarEstadoBotonTimerMain: () => { },
    /** @type {() => void} */ verificarBloqueoCredito: () => { },
    /** @type {(fn: () => any) => any} */ cambiarConFundido: (fn) => fn(),
};

/** @param {Partial<typeof _acciones>} handlers */
function registrar(handlers) {
    Object.assign(_acciones, handlers);
}

export const AccionesUI = {
    registrar,
    /** Redibuja la tarjeta de estado y lo que depende del registro de hoy. @param {...any} args */
    actualizarUI: (...args) => _acciones.actualizarUI(...args),
    /** @param {boolean} [sinAnimarTitulo] */
    actualizarEstadoBotonTimerMain: (sinAnimarTitulo) => _acciones.actualizarEstadoBotonTimerMain(sinAnimarTitulo),
    /** Habilita o no el botón de crédito del modal de edición según los campos. */
    verificarBloqueoCredito: () => _acciones.verificarBloqueoCredito(),
    /** Redibuja la tarjeta de estado con el fundido de todo su contenido. @param {() => any} fn */
    cambiarConFundido: (fn) => _acciones.cambiarConFundido(fn),
};
