import { $, alClic } from '../core/dom.js';
import { EventosApp } from '../core/eventos.js';
import { html, icono, montar } from '../core/html.js';
import { Controles } from './controles.js';
import { GestorModales } from './gestor-modales.js';
import { mostrarToast } from './toast.js';
import { DriveSync } from './drive-sync.js';
import { SincronizacionDrive } from '../services/sincronizacion-drive.js';

// ====================================================================
// GOOGLE DRIVE — conexión: cuenta y respaldo vinculado al perfil
// ====================================================================
// Estas opciones están en el desplegable «Conexión» del destino Drive, dentro de «Respaldo y sincronización» (centro-respaldo.js).
// Conectar lleva a Google en la misma ventana; al volver (oauth-callback.html → la app) completarConexionPendiente
// termina el canje y se sigue en el modal de respaldo. Subir y Bajar, el cifrado y la automatización están en «Respaldo y sincronización»
// (centro-respaldo.js), que se pone al día con el evento 'respaldo:conexion'. Los flujos (drive-sync.js) le piden a este
// módulo que elija el respaldo cuando el perfil todavía no tiene uno.
const { setBtnDisabled } = Controles;

function _formatearFecha(iso) {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

function actualizarEstado() {
    const disponible = SincronizacionDrive.disponible();
    const conectado = SincronizacionDrive.conectado();
    const cuenta = SincronizacionDrive.getCuenta();

    const resumenCuenta = $('drive-cuenta-resumen');
    if (resumenCuenta) resumenCuenta.textContent = conectado ? (cuenta || 'Cuenta conectada') : 'Conectá tu cuenta de Google para empezar';
    const accion = $('drive-cuenta-accion');
    if (accion) accion.textContent = conectado ? 'Desconectar' : 'Conectar';
    setBtnDisabled('btn-drive-cuenta', !disponible && !conectado);

    const resumenArchivo = $('drive-archivo-resumen');
    if (resumenArchivo) {
        resumenArchivo.textContent = SincronizacionDrive.esFileIdValido(SincronizacionDrive.getFileId())
            ? (SincronizacionDrive.getArchivoNombre() || 'Respaldo vinculado')
            : 'Ninguno · se crea al subir o se elige al bajar';
    }
    setBtnDisabled('btn-drive-elegir', !conectado);
}

// --------------------------------------------------------------------
// Cuenta: conectar (redirección a Google) y desconectar
// --------------------------------------------------------------------
async function conectar() {
    const r = await SincronizacionDrive.iniciarConexion(location.href);
    if ('error' in r) { mostrarToast(r.error, 'error'); return; }
    location.assign(r.url);
}

async function desconectar() {
    const seguir = await GestorModales.confirmar('Se desconecta tu cuenta de Google en todos tus dispositivos: Google le quita el permiso a Horarios y en los demás también hay que volver a conectar. Los respaldos quedan en tu Drive y podés volver a conectarte cuando quieras.', 'Desconectar', '#icon-exit', { titulo: 'Google Drive' });
    if (!seguir) return;
    const { revocado } = await SincronizacionDrive.desconectar();
    mostrarToast(revocado ? 'Google Drive desconectado' : 'Google Drive desconectado en este navegador', 'success', undefined,
        revocado ? null : 'No se pudo avisar a Google: podés quitar el acceso desde tu cuenta (Seguridad → Apps de terceros)');
    actualizarEstado();
    EventosApp.emit('respaldo:conexion');
}

/**
 * Al arrancar la app: si se vuelve de autorizar en Google, termina la conexión. Devuelve true si quedó conectada (quien llama
 * decide cómo seguir, ver CentroRespaldo.alConectarDrive). Sin retorno pendiente no hace nada (ni red ni almacenamiento).
 * @returns {Promise<boolean>}
 */
async function completarConexionPendiente() {
    if (!SincronizacionDrive.hayRetornoPendiente()) return false;
    const r = await SincronizacionDrive.completarConexion();
    if ('ninguno' in r) return false;
    if ('error' in r) {
        mostrarToast(r.error, r.cancelado ? 'info' : 'error');
        return false;
    }
    mostrarToast('Google Drive conectado', 'success', undefined, r.cuenta || null);
    EventosApp.emit('respaldo:conexion');
    return true;
}

// --------------------------------------------------------------------
// Elegir el respaldo del perfil (dispositivo nuevo, o para cambiarlo)
// --------------------------------------------------------------------
const NUEVO = 'nuevo';

/**
 * Muestra los respaldos de Horarios en la cuenta y devuelve el elegido, NUEVO (crear otro al subir) o null (cancelar).
 * @param {'bajar' | 'subir' | 'cambiar'} motivo
 * @param {{ id: string, nombre: string, perfil: string, modificado: string }[]} archivos
 * @returns {Promise<{ id: string, nombre: string } | 'nuevo' | null>}
 */
function _preguntarRespaldo(motivo, archivos) {
    const lista = $('drive-elegir-lista');
    if (!lista) return Promise.resolve(null);
    const actual = SincronizacionDrive.getFileId();
    const textos = {
        bajar: 'Elegí qué respaldo bajar a este perfil. Queda vinculado para las próximas veces.',
        subir: 'Ya hay respaldos de Horarios en tu Drive. Elegí cuál reemplazar con los datos de este perfil, o creá uno nuevo.',
        cambiar: 'Elegí el respaldo de Drive de este perfil.'
    };
    return GestorModales.preguntar('modal-drive-elegir', (/** @type {(v: any) => void} */ responder) => {
        const motivoEl = $('drive-elegir-motivo');
        if (motivoEl) motivoEl.textContent = textos[motivo];
        montar(lista, html`${archivos.map(a => html`
            <button type="button" data-id="${a.id}">
                ${icono(a.id === actual ? '#icon-check' : '#icon-cloud')}
                <span class="settings-list-text">
                    <span>${a.perfil || a.nombre}</span>
                    <span class="settings-list-desc">${a.nombre}${a.modificado ? ` · ${_formatearFecha(a.modificado)}` : ''}</span>
                </span>
            </button>`)}${motivo !== 'bajar' ? html`
            <button type="button" data-id="${NUEVO}">
                ${icono('#icon-plus')}
                <span class="settings-list-text">
                    <span>Crear un respaldo nuevo</span>
                    <span class="settings-list-desc">Se crea al subir</span>
                </span>
            </button>` : ''}`);

        /** @param {Event} e */
        const alElegir = (e) => {
            const btn = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('button[data-id]'));
            if (!btn) return;
            const id = btn.dataset.id;
            if (id === NUEVO) { responder(NUEVO); return; }
            const archivo = archivos.find(a => a.id === id);
            if (archivo) responder({ id: archivo.id, nombre: archivo.nombre });
        };
        const cancelar = () => responder(null);
        const btnCancelar = $('btn-drive-elegir-cancelar');
        lista.addEventListener('click', alElegir);
        btnCancelar?.addEventListener('click', cancelar);
        return () => {
            lista.removeEventListener('click', alElegir);
            btnCancelar?.removeEventListener('click', cancelar);
        };
    }, null);
}

/**
 * Antes de subir o bajar sin un respaldo vinculado: lista los de la cuenta y deja elegir. Devuelve false si no se puede seguir.
 * @param {'bajar' | 'subir'} tipo
 */
async function _prepararVinculo(tipo, modoAutomatico) {
    if (!SincronizacionDrive.conectado()) {
        if (!modoAutomatico) mostrarToast('Conectá tu cuenta de Google primero', 'warning');
        return false;
    }
    if (SincronizacionDrive.esFileIdValido(SincronizacionDrive.getFileId())) return true;
    if (modoAutomatico) return false;   // la automática solo corre con un respaldo vinculado (ver SincronizacionDrive.listo)

    const archivos = await SincronizacionDrive.listarRespaldos();
    if (archivos.length === 0) {
        if (tipo === 'subir') return true;   // se crea el primero
        mostrarToast('No hay respaldos de Horarios en este Drive: subí uno primero', 'info');
        return false;
    }
    const elegido = await _preguntarRespaldo(tipo, archivos);
    if (elegido === null) return false;
    if (elegido !== NUEVO) SincronizacionDrive.vincular(elegido);
    EventosApp.emit('respaldo:conexion');
    return true;
}

async function cambiarRespaldo() {
    try {
        const archivos = await SincronizacionDrive.listarRespaldos();
        if (archivos.length === 0) { mostrarToast('Todavía no hay respaldos de Horarios en este Drive: se crea uno al subir', 'info'); return; }
        const elegido = await _preguntarRespaldo('cambiar', archivos);
        if (elegido === null) return;
        SincronizacionDrive.vincular(elegido === NUEVO ? null : elegido);
        actualizarEstado();
        EventosApp.emit('respaldo:conexion');
        mostrarToast(elegido === NUEVO ? 'Se va a crear un respaldo nuevo al subir' : 'Respaldo vinculado a este perfil', 'success');
    } catch (e) {
        mostrarToast('No se pudieron listar los respaldos', 'error', undefined, e instanceof Error ? e.message : null);
    }
}

function bindEventos() {
    DriveSync.conectarModal({
        antesDeSubir: (auto) => _prepararVinculo('subir', auto),
        antesDeBajar: (auto) => _prepararVinculo('bajar', auto),
    });
    alClic({
        'btn-drive-cuenta': () => (SincronizacionDrive.conectado() ? desconectar() : conectar()),
        'btn-drive-elegir': () => cambiarRespaldo(),
    });
    GestorModales.registrarAccionVolver('modal-drive-elegir', () => $('btn-drive-elegir-cancelar')?.click());
}

export const DriveRespaldo = { bindEventos, completarConexionPendiente, actualizarEstado };
