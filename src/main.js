import { APP_NOMBRE, APP_VERSION } from './core/constantes.js';
import { InstaladorPWA } from './ui/instalador-pwa.js';
import { RecordatorioPush } from './services/recordatorio-push.js';
import { FeriadosAR } from './services/feriados-ar.js';
import { Perfiles } from './ui/perfiles.js';
import { Calendario } from './ui/calendario.js';
import { GistRespaldo } from './ui/gist-respaldo.js';
import { Historico } from './ui/historico.js';
import { Estadisticas } from './ui/estadisticas.js';
import { TarjetaFichaje } from './ui/tarjeta-fichaje.js';
import { OrdenTarjetas } from './ui/orden-tarjetas.js';
import { Atajos } from './ui/atajos.js';
import { Notificaciones } from './ui/notificaciones.js';
import { Configuracion } from './ui/configuracion.js';
import { HistorialDias } from './ui/historial-dias.js';
import { OrquestadorUI } from './ui/orquestador.js';
import { BienvenidaModal } from './ui/bienvenida-modal.js';
import { AvisoPush } from './ui/aviso-push.js';
import { RecargaGesto } from './ui/recarga-gesto.js';

// ====================================================================
// MAIN — arranque de la aplicación
// ====================================================================
InstaladorPWA.registrarServiceWorker();
OrquestadorUI.init();

function _mostrarVersion() {
    const el = document.querySelector('.version-text');
    if (el) el.textContent = `${APP_NOMBRE}-${APP_VERSION}`;
}

function _iniciarEventosDOM() {
    InstaladorPWA.bindEventos();
    Perfiles.bindEventos();
    Calendario.bindEventos();
    GistRespaldo.bindEventos();
    Historico.bindEventos();
    Estadisticas.bindEventos();
    TarjetaFichaje.bindEventos();
    OrdenTarjetas.bindEventos();
    Atajos.bindEventos();
    Notificaciones.bindEventos();
    Configuracion.bindEventos();
    HistorialDias.bindEventos();
    RecargaGesto.bindEventos();

    _mostrarVersion();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _iniciarEventosDOM);
} else {
    _iniciarEventosDOM();
}

// UI iniciada: fundido de entrada de las tarjetas (ver html.entrada-pagina en base.css)
requestAnimationFrame(() => RecargaGesto.entrar());

(async () => {
    await BienvenidaModal.chequearYMostrar();
    setTimeout(() => FeriadosAR.chequearYNotificar(), 4000);
    setTimeout(() => AvisoPush.chequearYAvisar(), 2000);
    setTimeout(() => RecordatorioPush.registrarUso(), 3000);
    document.addEventListener('visibilitychange', () => RecordatorioPush.registrarUso());
})();
