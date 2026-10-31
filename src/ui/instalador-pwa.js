import { $ } from '../core/dom.js';
import { EstadoApp } from '../services/estado-app.js';

// ====================================================================
// PWA INSTALLER MODULE
// ====================================================================
let deferredPrompt = null;
const btnInstall = $('btn-install');

function init() {
    if (window.matchMedia('(display-mode: standalone)').matches ||
        /** @type {any} */ (window.navigator).standalone === true) {
        if (btnInstall) btnInstall.style.display = 'none';
        return;
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (btnInstall) {
            btnInstall.style.display = 'flex';
        }
    });

    window.addEventListener('appinstalled', () => {
        if (btnInstall) btnInstall.style.display = 'none';
        deferredPrompt = null;
        EstadoApp._notify().mostrarToast('¡App instalada con éxito!', 'success');
    });
}

async function instalarApp() {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
}

function bindEventos() {
    $('btn-install')?.addEventListener('click', () => instalarApp());
}

function registrarServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    const _registrar = () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('SW registrado:', registration.scope);
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (!newWorker) return;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            EstadoApp._notify().mostrarToast('Se actualizará la versión al recargar', 'info');
                        }
                    });
                });
            })
            .catch(err => console.error('❌ Error SW:', err));
    };
    if (document.readyState === 'complete') {
        _registrar();
    } else {
        window.addEventListener('load', _registrar);
    }
}

export const InstaladorPWA = {
    bindEventos,
    registrarServiceWorker,
    init,
    instalarApp
};
