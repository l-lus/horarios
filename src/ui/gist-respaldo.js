import { $, alClic, alternarVisibilidadClave } from '../core/dom.js';
import { EventosApp } from '../core/eventos.js';
import { UIBase } from './base.js';
import { GestorModales } from './gestor-modales.js';
import { SincronizacionGist } from '../services/sincronizacion-gist.js';
import { mostrarToast } from './toast.js';

// ====================================================================
// GITHUB GIST — modal de conexión: token y Gist ID
// ====================================================================
// Se abre desde «Respaldo y sincronización» (centro-respaldo.js), donde están Subir y Bajar, el cifrado y la automatización.
// Al guardar avisa con 'respaldo:conexion' para que ese modal y los botones del histórico se pongan al día.
const { _abrirModalConPadre, _cerrarModalConPadre } = UIBase;

function _actualizarEstado() {
    const token = $('gist-token')?.value.trim() || '';
    const gistId = $('gist-id')?.value.trim() || '';
    const soloToken = token !== '';
    const ambosCompletos = soloToken && gistId.length > 10;

    $('gist-estado')?.classList.toggle('gist-estado--off', !ambosCompletos);
    const tituloEl = $('gist-estado-titulo');
    if (tituloEl) tituloEl.textContent = ambosCompletos ? 'Conectado' : soloToken ? 'Falta el Gist ID · se crea al subir' : 'Ingresá tu token para empezar';
}

function abrir() {
    _abrirModalConPadre('modal-gist', () => {
        const tokenInput = $('gist-token');
        const gistIdInput = $('gist-id');
        if (tokenInput) { tokenInput.value = SincronizacionGist.getToken(); tokenInput.type = 'password'; }
        if (gistIdInput) gistIdInput.value = SincronizacionGist.getGistId();

        const ultimaEl = $('gist-ultima-sync');
        const ultima = SincronizacionGist.getLastSync();
        if (ultimaEl) ultimaEl.textContent = ultima ? `Última sync: ${SincronizacionGist.formatLastSync(ultima)}` : 'Sin sincronizar';
        _actualizarEstado();
    });
}

function guardar() {
    const token = $('gist-token')?.value.trim() || '';
    const gistId = $('gist-id')?.value.trim() || '';

    if (token && !SincronizacionGist.esTokenValido(token)) {
        mostrarToast('El token de GitHub tiene caracteres no válidos', 'error');
        return;
    }
    if (gistId && !SincronizacionGist.esGistIdValido(gistId)) {
        mostrarToast('Gist ID inválido', 'error');
        return;
    }

    const huboCambios = token !== SincronizacionGist.getToken() || gistId !== SincronizacionGist.getGistId();
    SincronizacionGist.saveCredentials(token, gistId);
    mostrarToast(huboCambios ? 'Conexión guardada' : 'Sin cambios', huboCambios ? 'success' : 'info');
    EventosApp.emit('respaldo:conexion');
    cerrar();
}

function cerrar() {
    _cerrarModalConPadre('modal-gist');
}

function _abrirEnGitHub() {
    const gistId = ($('gist-id')?.value || SincronizacionGist.getGistId() || '').trim();
    const url = SincronizacionGist.esGistIdValido(gistId) ? `https://gist.github.com/${gistId}` : 'https://gist.github.com';
    window.open(url, '_blank', 'noopener,noreferrer');
}

function bindEventos() {
    $('gist-token')?.addEventListener('input', () => _actualizarEstado());
    $('gist-id')?.addEventListener('input', () => _actualizarEstado());
    alClic({
        'btn-toggle-token': () => alternarVisibilidadClave($('gist-token')),
        'btn-crear-token': () => window.open('https://github.com/settings/tokens/new?description=Horarios+sync&scopes=gist', '_blank', 'noopener,noreferrer'),
        'btn-gist-abrir': () => _abrirEnGitHub(),
        'btn-gist-guardar': () => guardar(),
        'btn-gist-volver': () => cerrar(),
    });
    GestorModales.registrarAccionVolver('modal-gist', cerrar);
}

export const GistRespaldo = { bindEventos, abrir, cerrar };
