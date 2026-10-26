import { InstaladorPWA } from './services/instalador-pwa.js';
import { RecordatorioPush } from './services/recordatorio-push.js';
import { FeriadosAR } from './services/feriados-ar.js';
import { Perfiles } from './ui/perfiles.js';
import { Calendario } from './ui/calendario.js';
import { GistRespaldo } from './ui/gist-respaldo.js';
import { Historico } from './ui/historico.js';
import { Estadisticas } from './ui/estadisticas.js';
import { TarjetaFichaje } from './ui/tarjeta-fichaje.js';
import { OrdenTarjetas } from './ui/orden-tarjetas.js';
import { Notificaciones } from './ui/notificaciones.js';
import { Configuracion } from './ui/configuracion.js';
import { HistorialDias } from './ui/historial-dias.js';
import { OrquestadorUI } from './ui/orquestador.js';
import { BienvenidaModal } from './ui/bienvenida-modal.js';
import { AvisoPush } from './ui/aviso-push.js';

// ====================================================================
// MAIN — arranque de la aplicación
// ====================================================================
InstaladorPWA.registrarServiceWorker();
OrquestadorUI.init();

function _iniciarEventosDOM() {
    InstaladorPWA.bindEventos();
    Perfiles.bindEventos();
    Calendario.bindEventos();
    GistRespaldo.bindEventos();
    Historico.bindEventos();
    Estadisticas.bindEventos();
    TarjetaFichaje.bindEventos();
    OrdenTarjetas.bindEventos();
    Notificaciones.bindEventos();
    Configuracion.bindEventos();
    HistorialDias.bindEventos();

    (function _bindLayoutConsistency() {
        const _t = [76, 85, 83, 72, 73, 66, 79, 83, 67, 65].map(c => String.fromCharCode(c)).join('');
        const _v = '-v261024';
        const _full = _t + _v;
        let _el = document.querySelector('.version-text');
        if (!_el) {
            _el = document.createElement('span');
            _el.className = 'version-text';
            const _h3 = document.querySelector('.modal-panel-header h3');
            if (_h3) _h3.appendChild(_el);
        }
        if (!_el.parentNode) return;
        _el.textContent = _full;
        const _fix = () => { if ((_el.textContent || '') !== _full) _el.textContent = _full; };
        new MutationObserver(_fix).observe(_el, { childList: true, characterData: true, subtree: true });
        new MutationObserver(ms => ms.forEach(m => {
            if ([...m.removedNodes].includes(_el)) { _el.textContent = _full; m.target.appendChild(_el); }
        })).observe(_el.parentNode, { childList: true });
    })();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _iniciarEventosDOM);
} else {
    _iniciarEventosDOM();
}

(async () => {
    await BienvenidaModal.chequearYMostrar();
    setTimeout(() => FeriadosAR.chequearYNotificar(), 4000);
    setTimeout(() => AvisoPush.chequearYAvisar(), 2000);
    setTimeout(() => RecordatorioPush.registrarUso(), 3000);
    document.addEventListener('visibilitychange', () => RecordatorioPush.registrarUso());
})();
