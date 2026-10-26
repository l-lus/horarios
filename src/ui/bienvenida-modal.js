import { STORAGE_KEYS } from '../core/constantes.js';
import { TiempoUtils } from '../core/tiempo-utils.js';
import { Almacenamiento } from '../core/almacenamiento.js';
import { GestionDatos } from '../services/gestion-datos.js';
import { Configuracion } from './configuracion.js';

// ====================================================================
// WELCOME MODULE
// ====================================================================
async function chequearYMostrar() {
    const yaVista = Almacenamiento.getBoolean(STORAGE_KEYS.BIENVENIDA_VISTA, false, true);
    if (yaVista) return;

    if (GestionDatos.registros().length > 0) {
        Almacenamiento.setItem(STORAGE_KEYS.BIENVENIDA_VISTA, true, true);
        return;
    }

    await TiempoUtils.esperar(1000);
    await Configuracion.mostrarConfigOnboarding();
}

export const BienvenidaModal = { chequearYMostrar };
