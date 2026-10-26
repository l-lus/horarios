import { STORAGE_KEYS } from '../core/constants.js';
import { TimeUtils } from '../core/time-utils.js';
import { StorageHelper } from '../core/storage.js';
import { DataManagement } from '../services/data-management.js';
import { UIConfig } from './ui-config.js';

// ====================================================================
// WELCOME MODULE
// ====================================================================
async function chequearYMostrar() {
    const yaVista = StorageHelper.getBoolean(STORAGE_KEYS.BIENVENIDA_VISTA, false, true);
    if (yaVista) return;

    if (DataManagement.registros().length > 0) {
        StorageHelper.setItem(STORAGE_KEYS.BIENVENIDA_VISTA, true, true);
        return;
    }

    await TimeUtils.esperar(1000);
    await UIConfig.mostrarConfigOnboarding();
}

export const BienvenidaModal = { chequearYMostrar };
