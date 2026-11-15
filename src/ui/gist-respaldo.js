import { $, alClic, alternarVisibilidadClave } from '../core/dom.js';
import { EventosApp } from '../core/eventos.js';
import { SincronizacionGist } from '../services/sincronizacion-gist.js';
import { mostrarToast } from './toast.js';

// ====================================================================
// GITHUB GIST — conexión: token y Gist ID
// ====================================================================
// Los campos están en el desplegable «Conexión» del destino Gist, dentro de «Respaldo y sincronización» (centro-respaldo.js), que
// también abre y cierra el desplegable. Al guardar avisa con 'respaldo:conexion' para que ese modal y los botones del histórico
// se pongan al día.

/** Carga en los campos lo guardado. No pisa lo que se está escribiendo. */
function cargar() {
    const tokenInput = /** @type {HTMLInputElement | null} */ ($('gist-token'));
    const gistIdInput = /** @type {HTMLInputElement | null} */ ($('gist-id'));
    if (tokenInput && document.activeElement !== tokenInput) { tokenInput.value = SincronizacionGist.getToken(); tokenInput.type = 'password'; }
    if (gistIdInput && document.activeElement !== gistIdInput) gistIdInput.value = SincronizacionGist.getGistId();
}

/** Valida y guarda token y Gist ID. Devuelve false si algo no sirve (ya se avisó). */
function guardar() {
    const token = $('gist-token')?.value.trim() || '';
    const gistId = $('gist-id')?.value.trim() || '';

    if (token && !SincronizacionGist.esTokenValido(token)) {
        mostrarToast('El token de GitHub tiene caracteres no válidos', 'error');
        return false;
    }
    if (gistId && !SincronizacionGist.esGistIdValido(gistId)) {
        mostrarToast('Gist ID inválido', 'error');
        return false;
    }

    const huboCambios = token !== SincronizacionGist.getToken() || gistId !== SincronizacionGist.getGistId();
    SincronizacionGist.saveCredentials(token, gistId);
    mostrarToast(huboCambios ? 'Conexión guardada' : 'Sin cambios', huboCambios ? 'success' : 'info');
    EventosApp.emit('respaldo:conexion');
    return true;
}

function _abrirEnGitHub() {
    const gistId = ($('gist-id')?.value || SincronizacionGist.getGistId() || '').trim();
    const url = SincronizacionGist.esGistIdValido(gistId) ? `https://gist.github.com/${gistId}` : 'https://gist.github.com';
    window.open(url, '_blank', 'noopener,noreferrer');
}

function bindEventos() {
    alClic({
        'btn-toggle-token': () => alternarVisibilidadClave($('gist-token')),
        'btn-crear-token': () => window.open('https://github.com/settings/tokens/new?description=Horarios+sync&scopes=gist', '_blank', 'noopener,noreferrer'),
        'btn-gist-abrir': () => _abrirEnGitHub(),
    });
}

export const GistRespaldo = { bindEventos, cargar, guardar };
