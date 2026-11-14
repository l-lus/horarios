import { SincronizacionGist } from '../services/sincronizacion-gist.js';
import { SyncNube } from './sync-nube.js';

// ====================================================================
// GIST: SUBIR Y BAJAR — los flujos de sincronización con el Gist (ver sync-nube.js, compartidos con Google Drive)
// ====================================================================
// El modal de configuración (gist-respaldo.js) es otra cosa: acá están los flujos, que también corren sin el modal abierto
// (botones de la barra del histórico y sincronización automática al abrir la app). Lo que necesitan del modal lo reciben
// por `conectarModal`, así este módulo no depende de él.
export const GistSync = SyncNube.registrar({
    servicio: SincronizacionGist,
    origen: 'gist',
    modalId: 'modal-gist',
    btnSubir: 'btn-gist-subir',
    btnBajar: 'btn-gist-bajar',
    el: 'el Gist',
    este: 'Este Gist',
    en: 'en Gist',
    etiqueta: 'con Gist',
    ajustes: 'Ajustes → GitHub Gist',
    riesgoEnClaro: 'se sube sin cifrar y cualquiera con el enlace puede leerlo.',
    avisoHistorial: 'Las versiones anteriores del Gist siguen en claro en su historial: conviene crear un Gist nuevo y borrar el viejo',
});
