import { SincronizacionDrive } from '../services/sincronizacion-drive.js';
import { SyncNube } from './sync-nube.js';

// ====================================================================
// GOOGLE DRIVE: SUBIR Y BAJAR — los mismos flujos que el Gist (ver sync-nube.js)
// ====================================================================
// El modal (drive-respaldo.js) aporta, con conectarModal, la elección del respaldo cuando el perfil todavía no tiene uno.
export const DriveSync = SyncNube.registrar({
    servicio: SincronizacionDrive,
    origen: 'drive',
    modalId: 'modal-drive',
    btnSubir: 'btn-drive-subir',
    btnBajar: 'btn-drive-bajar',
    el: 'el respaldo de Drive',
    este: 'Este respaldo de Drive',
    en: 'en Drive',
    etiqueta: 'con Drive',
    ajustes: 'Ajustes → Google Drive',
    riesgoEnClaro: 'se sube sin cifrar a tu Drive.',
    avisoHistorial: 'Drive puede conservar las versiones anteriores del archivo (en claro) en su historial de revisiones por unos 30 días',
});
