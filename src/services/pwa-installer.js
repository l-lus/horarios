import { $ } from '../core/dom.js';
import { AppState } from './app-state.js';

// ====================================================================
// PWA INSTALLER MODULE
// ====================================================================
let deferredPrompt = null;
const btnInstall = document.getElementById('btn-install');

function init() {
    if (window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true) {
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
        AppState._notify().mostrarToast('¡App instalada con éxito!', 'success');
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
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            AppState._notify().mostrarToast('Se actualizará la versión al recargar', 'info');
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

export const PWAInstaller = {
    bindEventos,
    registrarServiceWorker,
    init,
    instalarApp
};
