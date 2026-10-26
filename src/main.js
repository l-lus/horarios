import { PWAInstaller } from './services/pwa-installer.js';
import { PushReminder } from './services/push-reminder.js';
import { FeriadosAR } from './services/feriados-ar.js';
import { UIPerfiles } from './ui/ui-perfiles.js';
import { UICalendario } from './ui/ui-calendario.js';
import { UIGistYRespaldo } from './ui/ui-gist-respaldo.js';
import { UIHistorico } from './ui/ui-historico.js';
import { UIEstadisticas } from './ui/ui-estadisticas.js';
import { UITarjetaFichaje } from './ui/ui-tarjeta-fichaje.js';
import { UICardsLayout } from './ui/ui-cards-layout.js';
import { UINotificaciones } from './ui/ui-notificaciones.js';
import { UIConfig } from './ui/ui-config.js';
import { UIHistorialDias } from './ui/ui-historial-dias.js';
import { UILogic } from './ui/ui-logic.js';
import { BienvenidaModal } from './ui/bienvenida-modal.js';
import { AvisoPush } from './ui/aviso-push.js';

// ====================================================================
// MAIN — arranque de la aplicación
// ====================================================================
PWAInstaller.registrarServiceWorker();
UILogic.init();

function _iniciarEventosDOM() {
    PWAInstaller.bindEventos();
    UIPerfiles.bindEventos();
    UICalendario.bindEventos();
    UIGistYRespaldo.bindEventos();
    UIHistorico.bindEventos();
    UIEstadisticas.bindEventos();
    UITarjetaFichaje.bindEventos();
    UICardsLayout.bindEventos();
    UINotificaciones.bindEventos();
    UIConfig.bindEventos();
    UIHistorialDias.bindEventos();

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
    setTimeout(() => PushReminder.registrarUso(), 3000);
    document.addEventListener('visibilitychange', () => PushReminder.registrarUso());
})();
