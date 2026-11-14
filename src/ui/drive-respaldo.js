import { $, alClic, setColapsable } from '../core/dom.js';
import { html, icono, montar } from '../core/html.js';
import { UIBase } from './base.js';
import { GestorModales } from './gestor-modales.js';
import { IconosAnimados } from './iconos-animados.js';
import { mostrarToast } from './toast.js';
import { CampoFrase } from './campo-frase.js';
import { SyncAutomatizacion } from './sync-automatizacion.js';
import { DriveSync } from './drive-sync.js';
import { GistRespaldo } from './gist-respaldo.js';
import { SincronizacionDrive } from '../services/sincronizacion-drive.js';
import { SincronizacionGist } from '../services/sincronizacion-gist.js';
import { FraseCifrado } from '../services/frase-cifrado.js';

// ====================================================================
// GOOGLE DRIVE — modal de configuración: cuenta, respaldo vinculado al perfil, cifrado y automatización
// ====================================================================
// Conectar lleva a Google en la misma ventana; al volver (oauth-callback.html → la app) completarConexionPendiente
// termina el canje y reabre este modal. Los flujos de subir y bajar están en drive-sync.js (los mismos del Gist).
// Los paneles plegables usan la clase .gist-panel-toggle, que ya conecta gist-respaldo.js para los dos modales.
const { _setBtnDisabled, _abrirModalConPadre, _cerrarModalConPadre } = UIBase;

const _auto = SyncAutomatizacion.crear({
    prefijo: 'drive', servicio: SincronizacionDrive, nombre: 'Drive',
    otro: () => ({ servicio: SincronizacionGist, nombre: 'el Gist' }),
    alCambiar: () => actualizarEstado()
});

// La frase es la misma de la app (FraseCifrado): el bloque es otro par de controles sobre el mismo dato que en el Gist
const _campoFrase = new CampoFrase(
    { input: 'drive-frase', ojo: 'btn-drive-frase-ver', generar: 'btn-drive-frase-generar', recordar: 'btn-toggle-drive-recordar' },
    () => _actualizarResumenCifrado());

function _actualizarResumenCifrado() {
    const el = $('drive-cifrado-resumen');
    if (!el) return;
    const escrita = _campoFrase.valor();
    const evaluada = FraseCifrado.evaluar(escrita);
    const hayFrase = escrita.trim() !== '';
    _setBtnDisabled('btn-toggle-drive-recordar', !hayFrase);
    if (!hayFrase) el.textContent = 'Sin cifrar · el respaldo se sube en claro';
    else if (!evaluada.ok) el.textContent = `Faltan ${Math.max(1, 20 - evaluada.frase.length)} caracteres (mínimo 20)`;
    else el.textContent = _campoFrase.recordar() ? 'Activado · frase recordada en este navegador' : 'Activado · la frase vale hasta cerrar la app';
}

const _modalAbierto = () => !!$('modal-drive')?.classList.contains('show');

function _formatearFecha(iso) {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

function actualizarEstado() {
    const disponible = SincronizacionDrive.disponible();
    const conectado = SincronizacionDrive.conectado();
    const listo = SincronizacionDrive.listo();
    const cuenta = SincronizacionDrive.getCuenta();

    $('drive-estado')?.classList.toggle('gist-estado--off', !conectado);
    const titulo = $('drive-estado-titulo');
    if (titulo) titulo.textContent = !disponible ? 'No disponible todavía' : conectado ? 'Conectado' : 'Sin conectar';

    const resumenCuenta = $('drive-cuenta-resumen');
    if (resumenCuenta) resumenCuenta.textContent = conectado ? (cuenta || 'Cuenta conectada') : 'Conectá tu cuenta de Google para empezar';
    const accion = $('drive-cuenta-accion');
    if (accion) accion.textContent = conectado ? 'Desconectar' : 'Conectar';
    _setBtnDisabled('btn-drive-cuenta', !disponible && !conectado);

    const resumenArchivo = $('drive-archivo-resumen');
    if (resumenArchivo) {
        resumenArchivo.textContent = SincronizacionDrive.esFileIdValido(SincronizacionDrive.getFileId())
            ? (SincronizacionDrive.getArchivoNombre() || 'Respaldo vinculado')
            : 'Ninguno · se crea al subir o se elige al bajar';
    }
    _setBtnDisabled('btn-drive-elegir', !conectado);
    _setBtnDisabled('btn-drive-subir', !conectado);
    _setBtnDisabled('btn-drive-bajar', !conectado);
    _auto.setHabilitado(listo);
}

function _mostrarUltimaSync() {
    const el = $('drive-ultima-sync');
    if (!el) return;
    const ultima = SincronizacionDrive.getLastSync();
    el.textContent = ultima ? `Última sync: ${SincronizacionDrive.formatLastSync(ultima)}` : 'Sin sincronizar';
}

function _setPanel(btnId, abierto, animar) {
    const btn = $(btnId);
    const panel = $(btn?.getAttribute('aria-controls') || '');
    if (!btn || !panel) return;
    btn.setAttribute('aria-expanded', String(abierto));
    setColapsable(panel, abierto, { animar });
}

function abrirModalDrive() {
    _abrirModalConPadre('modal-drive', () => {
        _mostrarUltimaSync();
        _auto.cargar();
        actualizarEstado();
        _setPanel('btn-drive-panel-limites', false, false);
        _setPanel('btn-drive-panel-cifrado', false, false);
        _campoFrase.cargar();
    });
}

function cerrarModalDrive() {
    _auto.descartar();
    _cerrarModalConPadre('modal-drive');
    GistRespaldo.actualizarBotonesHistorico();
}

/** Guarda lo escrito en el modal antes de subir o bajar. false si la frase escrita no es válida (ya se avisó). */
function _guardarSiModalAbierto() {
    if (!_modalAbierto()) return true;
    if (!_campoFrase.confirmar()) { _setPanel('btn-drive-panel-cifrado', true, true); return false; }
    _auto.guardar();
    return true;
}

function guardarConfig() {
    const { desdeInvalida, hastaInvalida } = _auto.leerRango();
    if (desdeInvalida) { mostrarToast('Hora inicial inválida.', 'error'); return; }
    if (hastaInvalida) { mostrarToast('Hora final inválida.', 'error'); return; }
    const cambioFrase = _campoFrase.cambio();
    if (!_campoFrase.confirmar()) { _setPanel('btn-drive-panel-cifrado', true, true); return; }
    const huboCambios = cambioFrase || _auto.hayCambios();
    _auto.guardar();
    mostrarToast(huboCambios ? 'Configuración guardada' : 'Sin cambios', huboCambios ? 'success' : 'info');
    cerrarModalDrive();
}

// --------------------------------------------------------------------
// Cuenta: conectar (redirección a Google) y desconectar
// --------------------------------------------------------------------
async function conectar() {
    const r = await SincronizacionDrive.iniciarConexion(location.href);
    if ('error' in r) { mostrarToast(r.error, 'error'); return; }
    _guardarSiModalAbierto();   // lo que se haya tocado en el modal no se pierde al salir hacia Google
    location.assign(r.url);
}

async function desconectar() {
    const seguir = await GestorModales.confirmar('Se desconecta tu cuenta de Google en este navegador. Los respaldos quedan en tu Drive y podés volver a conectarte cuando quieras.', 'Desconectar', '#icon-exit', { titulo: 'Google Drive' });
    if (!seguir) return;
    const { revocado } = await SincronizacionDrive.desconectar();
    mostrarToast(revocado ? 'Google Drive desconectado' : 'Google Drive desconectado en este navegador', 'success', undefined,
        revocado ? null : 'No se pudo avisar a Google: podés quitar el acceso desde tu cuenta (Seguridad → Apps de terceros)');
    actualizarEstado();
    GistRespaldo.actualizarBotonesHistorico();
}

/**
 * Al arrancar la app: si se vuelve de autorizar en Google, termina la conexión y abre el modal para seguir.
 * Sin retorno pendiente no hace nada (ni red ni almacenamiento).
 */
async function completarConexionPendiente() {
    if (!SincronizacionDrive.hayRetornoPendiente()) return;
    const r = await SincronizacionDrive.completarConexion();
    if ('ninguno' in r) return;
    if ('error' in r) {
        mostrarToast(r.error, r.cancelado ? 'info' : 'error');
        return;
    }
    mostrarToast('Google Drive conectado', 'success', undefined, r.cuenta || null);
    GistRespaldo.actualizarBotonesHistorico();
    abrirModalDrive();
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
    if (_modalAbierto()) actualizarEstado();
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
        mostrarToast(elegido === NUEVO ? 'Se va a crear un respaldo nuevo al subir' : 'Respaldo vinculado a este perfil', 'success');
    } catch (e) {
        mostrarToast('No se pudieron listar los respaldos', 'error', undefined, e instanceof Error ? e.message : null);
    }
}

function bindEventos() {
    document.querySelector('.config-actions .btn-drive')?.addEventListener('click', () => abrirModalDrive());
    _campoFrase.vincular();
    _auto.bindEventos();
    DriveSync.conectarModal({
        guardarAntes: _guardarSiModalAbierto,
        antesDeSubir: (auto) => _prepararVinculo('subir', auto),
        antesDeBajar: (auto) => _prepararVinculo('bajar', auto),
        alSincronizar: () => {
            if (!_modalAbierto()) return;
            actualizarEstado();
            _mostrarUltimaSync();
        },
        alCambiarFrase: () => { if (_modalAbierto()) _campoFrase.cargar(); },
    });
    alClic({
        'btn-drive-cuenta': () => (SincronizacionDrive.conectado() ? desconectar() : conectar()),
        'btn-drive-elegir': () => cambiarRespaldo(),
        'btn-drive-subir': () => { IconosAnimados.animarFlecha($('btn-drive-subir'), 'subir'); DriveSync.subir(); },
        'btn-drive-bajar': () => { IconosAnimados.animarFlecha($('btn-drive-bajar'), 'bajar'); DriveSync.bajar(); },
        'btn-drive-guardar': () => guardarConfig(),
        'btn-drive-volver': () => cerrarModalDrive(),
    });
    GestorModales.registrarAccionVolver('modal-drive', cerrarModalDrive);
    GestorModales.registrarAccionVolver('modal-drive-elegir', () => $('btn-drive-elegir-cancelar')?.click());
}

export const DriveRespaldo = { bindEventos, completarConexionPendiente, cerrarModalDrive };
