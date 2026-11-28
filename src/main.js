import { APP_NOMBRE, APP_VERSION, DEMORA_ARRANQUE_MS } from './core/constantes.js';
import { InstaladorPWA } from './ui/instalador-pwa.js';
import { RecordatorioPush } from './services/recordatorio-push.js';
import { FeriadosAR } from './services/feriados-ar.js';
import { Perfiles } from './ui/perfiles.js';
import { Calendario } from './ui/calendario.js';
import { CentroRespaldo } from './ui/centro-respaldo.js';
import { DriveRespaldo } from './ui/drive-respaldo.js';
import { Historico } from './ui/historico.js';
import { Atajos } from './ui/atajos.js';
import { Estadisticas } from './ui/estadisticas.js';
import { TarjetaFichaje } from './ui/tarjeta-fichaje.js';
import { OrdenTarjetas } from './ui/orden-tarjetas.js';
import { Notificaciones } from './ui/notificaciones.js';
import { Configuracion } from './ui/configuracion.js';
import { Personalizacion } from './ui/personalizacion.js';
import { HistorialDias } from './ui/historial-dias.js';
import { VerificarFeriados } from './ui/verificar-feriados.js';
import { OrquestadorUI } from './ui/orquestador.js';
import { BienvenidaModal } from './ui/bienvenida-modal.js';
import { AvisoPush } from './ui/aviso-push.js';
import { RecargaGesto } from './ui/recarga-gesto.js';
import { esPWAInstalada } from './core/dom.js';

// ====================================================================
// MAIN — arranque de la aplicación
// ====================================================================
InstaladorPWA.registrarServiceWorker();
OrquestadorUI.init();

// Sin zoom en móviles: el meta viewport lo bloquea en Android, pero iOS Safari ignora user-scalable=no y dispara gesturestart al pellizcar
document.addEventListener('gesturestart', e => e.preventDefault());

function _mostrarVersion() {
    const el = document.querySelector('.version-text');
    if (el) el.textContent = `${APP_NOMBRE}-${APP_VERSION}`;
}

function _iniciarEventosDOM() {
    InstaladorPWA.bindEventos();
    Perfiles.bindEventos();
    Calendario.bindEventos();
    CentroRespaldo.bindEventos();
    Historico.bindEventos();
    Estadisticas.bindEventos();
    TarjetaFichaje.bindEventos();
    OrdenTarjetas.bindEventos();
    Atajos.bindEventos();
    Notificaciones.bindEventos();
    Configuracion.bindEventos();
    Personalizacion.bindEventos();
    HistorialDias.bindEventos();
    VerificarFeriados.bindEventos();
    RecargaGesto.bindEventos();

    _mostrarVersion();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _iniciarEventosDOM);
} else {
    _iniciarEventosDOM();
}

// UI iniciada: se quita la pantalla de carga (ver html.cargando en base.css y tema-inicial.js)
requestAnimationFrame(() => {
    document.documentElement.classList.remove('cargando');
    RecargaGesto.entrar();
});

(async () => {
    // Si se vuelve de autorizar Google Drive (ver oauth-callback.html), la conexión se termina ya, sin esperar a que se cierre
    // la configuración inicial; el modal de respaldo se abre cuando esa configuración (si toca mostrarla) está a la vista.
    const driveConectado = DriveRespaldo.completarConexionPendiente();
    const bienvenida = BienvenidaModal.chequearYMostrar();
    bienvenida.visible.then(async () => { if (await driveConectado) CentroRespaldo.alConectarDrive(); });
    await bienvenida.cerrada;
    setTimeout(() => FeriadosAR.chequearYNotificar(), DEMORA_ARRANQUE_MS.FERIADOS);
    setTimeout(() => AvisoPush.chequearYAvisar(), DEMORA_ARRANQUE_MS.AVISO_PUSH);
    const registrarUso = () => RecordatorioPush.registrarUso({
        visible: document.visibilityState === 'visible',
        pwa: esPWAInstalada()
    });
    setTimeout(registrarUso, DEMORA_ARRANQUE_MS.REGISTRAR_USO);
    document.addEventListener('visibilitychange', registrarUso);
})();
