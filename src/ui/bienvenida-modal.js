import { STORAGE_KEYS } from '../core/constantes.js';
import { TiempoUtils } from '../core/tiempo-utils.js';
import { Almacenamiento } from '../core/almacenamiento.js';
import { Configuracion } from './configuracion.js';
import { EstadoApp } from '../services/estado-app.js';

// ====================================================================
// WELCOME MODULE
// ====================================================================
/**
 * En la primera visita abre la configuración inicial. Devuelve dos momentos para quien necesite esperarlos:
 * `visible` (la configuración inicial ya está a la vista, o no hacía falta mostrarla) y `cerrada` (la persona la cerró).
 * @returns {{ visible: Promise<void>, cerrada: Promise<void> }}
 */
function chequearYMostrar() {
    const nada = Promise.resolve();
    const yaVista = Almacenamiento.getBoolean(STORAGE_KEYS.BIENVENIDA_VISTA, false, true);
    if (yaVista) return { visible: nada, cerrada: nada };

    if (EstadoApp.registros().length > 0) {
        Almacenamiento.setItem(STORAGE_KEYS.BIENVENIDA_VISTA, true, true);
        return { visible: nada, cerrada: nada };
    }

    /** @type {Promise<void>} */
    let cerrada = nada;
    const visible = TiempoUtils.esperar(1000).then(() => { cerrada = Configuracion.mostrarConfigOnboarding(); });
    return { visible, cerrada: visible.then(() => cerrada) };
}

export const BienvenidaModal = { chequearYMostrar };
