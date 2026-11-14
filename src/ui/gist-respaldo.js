import { RespaldoLocal } from './respaldo-local.js';
import { IconosAnimados } from './iconos-animados.js';
import { $, setColapsable, alClic, alternarVisibilidadClave } from '../core/dom.js';
import { EventosApp } from '../core/eventos.js';
import { UIBase } from './base.js';
import { SincronizacionGist } from '../services/sincronizacion-gist.js';
import { HistoricoEdicion } from './historico-edicion.js';
import { ImportarExportar } from '../services/importar-exportar.js';
import { mostrarToast } from './toast.js';
import { GistSync } from './gist-sync.js';
import { DriveSync } from './drive-sync.js';
import { CampoFrase } from './campo-frase.js';
import { FraseModal } from './frase-modal.js';
import { FraseCifrado } from '../services/frase-cifrado.js';
import { SyncAutomatizacion } from './sync-automatizacion.js';
import { SincronizacionDrive } from '../services/sincronizacion-drive.js';

// ====================================================================
//                     UI GIST AND BACKUP MODULE
// ====================================================================
// El modal de configuración de Gist (conexión, cifrado, automatización) y los botones de respaldo. Los flujos de subir y bajar
// están en gist-sync.js; este módulo le aporta lo que necesitan del modal (GistSync.conectarModal, en bindEventos).
const { _setBtnDisabled, _abrirModalConPadre, _cerrarModalConPadre } = UIBase;

const { mostrarImportar, cerrarImportar, mostrarExportar, cerrarExportar, ejecutarExportacion } = RespaldoLocal;
// Sincronización automática, comportamiento al bajar, límites y horario (la misma sección que en el modal de Drive)
const _auto = SyncAutomatizacion.crear({
    prefijo: 'gist', servicio: SincronizacionGist, nombre: 'Gist',
    otro: () => ({ servicio: SincronizacionDrive, nombre: 'Google Drive' }),
    alCambiar: () => actualizarEstadoBotonesGist()
});

// Frase de cifrado (opcional): con una frase cargada el Gist se sube cifrado; sin frase, en claro como siempre
const _campoFrase = new CampoFrase(
    { input: 'gist-frase', ojo: 'btn-gist-frase-ver', generar: 'btn-gist-frase-generar', recordar: 'btn-toggle-gist-recordar' },
    () => _actualizarResumenCifrado());

function _actualizarResumenCifrado() {
    const el = $('gist-cifrado-resumen');
    if (!el) return;
    const escrita = _campoFrase.valor();
    const evaluada = FraseCifrado.evaluar(escrita);
    const hayFrase = escrita.trim() !== '';
    _setBtnDisabled('btn-toggle-gist-recordar', !hayFrase);
    if (!hayFrase) el.textContent = 'Sin cifrar · el Gist se sube en claro';
    else if (!evaluada.ok) el.textContent = `Faltan ${Math.max(1, 20 - evaluada.frase.length)} caracteres (mínimo 20)`;
    else el.textContent = _campoFrase.recordar() ? 'Activado · frase recordada en este navegador' : 'Activado · la frase vale hasta cerrar la app';
}

function actualizarEstadoBotonesGist() {
    const token = $('gist-token')?.value.trim() || '';
    const gistId = $('gist-id')?.value.trim() || '';
    const soloToken = token !== '';
    const ambosCompletos = soloToken && gistId.length > 10;

    _setBtnDisabled('btn-gist-subir', !soloToken);
    _setBtnDisabled('btn-gist-bajar', !ambosCompletos);

    const estadoEl = $('gist-estado');
    const tituloEl = $('gist-estado-titulo');
    const conexionEl = $('gist-conexion-resumen');
    estadoEl?.classList.toggle('gist-estado--off', !ambosCompletos);
    if (tituloEl) tituloEl.textContent = ambosCompletos ? 'Conectado' : soloToken ? 'Falta el Gist ID' : 'Sin configurar';
    if (conexionEl) {
        conexionEl.textContent = ambosCompletos
            ? `Configurado · ${gistId.slice(0, 6)}…${gistId.slice(-4)}`
            : soloToken ? 'Token cargado · falta el Gist ID' : 'Ingresá tu token para empezar';
    }
    _auto.setHabilitado(ambosCompletos);
}

function _gistSetPanel(btnId, abierto, animar = true) {
    const btn = $(btnId);
    const panel = $(btn?.getAttribute('aria-controls') || '');
    if (!btn || !panel) return;
    btn.setAttribute('aria-expanded', String(abierto));
    setColapsable(panel, abierto, { animar });
}

function toggleGistPanel(btnId) {
    const btn = $(btnId);
    _gistSetPanel(btnId, btn?.getAttribute('aria-expanded') !== 'true');
}

/** Fecha de la última sincronización en el encabezado del modal (un solo texto para abrir el modal, subir y bajar). */
function _mostrarUltimaSync() {
    const el = $('gist-ultima-sync');
    if (!el) return;
    const ultima = SincronizacionGist.getLastSync();
    el.textContent = ultima ? `Última sync: ${SincronizacionGist.formatLastSync(ultima)}` : 'Sin sincronizar';
}

function abrirModalGist() {
    _abrirModalConPadre('modal-gist', () => {
        const tokenInput = $('gist-token');
        const gistIdInput = $('gist-id');

        if (tokenInput) tokenInput.value = SincronizacionGist.getToken();
        if (gistIdInput) gistIdInput.value = SincronizacionGist.getGistId();
        _mostrarUltimaSync();

        _auto.cargar();
        actualizarEstadoBotonesGist();
        const _gistCompleto = SincronizacionGist.getToken() && (SincronizacionGist.getGistId() || '').length > 10;
        _gistSetPanel('btn-gist-panel-limites', false, false);
        _gistSetPanel('btn-gist-panel-conexion', !_gistCompleto, false);
        _gistSetPanel('btn-gist-panel-cifrado', false, false);
        _campoFrase.cargar();
    });
}

/** Guarda lo escrito en el modal antes de subir o bajar. Devuelve false si la frase escrita no es válida (ya se avisó): no se sigue. */
function _gistGuardarCredencialesSiModalAbierto() {
    if (!$('modal-gist')?.classList.contains('show')) return true;
    if (!_campoFrase.confirmar()) { _gistSetPanel('btn-gist-panel-cifrado', true); return false; }

    SincronizacionGist.saveCredentials(
        $('gist-token')?.value.trim() || '',
        $('gist-id')?.value.trim() || ''
    );
    _auto.guardar();
    return true;
}

/**
 * A qué nube van los botones rápidos de la barra del histórico: el proveedor con la sincronización automática activa; si
 * ninguno la tiene, el último que se sincronizó; si no hay ninguno listo, null (archivo local).
 * @returns {'gist' | 'drive' | null}
 */
function proveedorRapido() {
    const gist = SincronizacionGist.conectado();
    const drive = SincronizacionDrive.listo();
    if (gist && SincronizacionGist.getAutoSync() !== 0) return 'gist';
    if (drive && SincronizacionDrive.getAutoSync() !== 0) return 'drive';
    if (gist && drive) {
        const fecha = (iso) => new Date(iso || 0).getTime() || 0;
        return fecha(SincronizacionDrive.getLastSync()) > fecha(SincronizacionGist.getLastSync()) ? 'drive' : 'gist';
    }
    return gist ? 'gist' : drive ? 'drive' : null;
}

function actualizarBotonesHistorico() {
    const btnRespaldar = $('btn-hist-respaldar');
    const btnRestaurar = $('btn-hist-restaurar');
    if (!btnRespaldar || !btnRestaurar) return;

    const proveedor = proveedorRapido();

    const newRespaldar = /** @type {HTMLElement} */ (btnRespaldar.cloneNode(true));
    const newRestaurar = /** @type {HTMLElement} */ (btnRestaurar.cloneNode(true));
    btnRespaldar.parentNode?.replaceChild(newRespaldar, btnRespaldar);
    btnRestaurar.parentNode?.replaceChild(newRestaurar, btnRestaurar);

    const autoCierre = () => {
        HistoricoEdicion.iniciarTimerAutoCierreBotones();
    };

    if (proveedor) {
        const flujos = proveedor === 'gist' ? GistSync : DriveSync;
        const nombre = proveedor === 'gist' ? 'Gist' : 'Drive';
        newRespaldar.title = `Subir a ${nombre}`;
        newRespaldar.addEventListener('click', () => { autoCierre(); IconosAnimados.animarFlecha(newRespaldar, 'subir'); flujos.subir(); });
        IconosAnimados.ponerIconoFlecha(newRespaldar, 'nube', 'subir');

        newRestaurar.title = `Bajar de ${nombre}`;
        newRestaurar.addEventListener('click', () => { autoCierre(); IconosAnimados.animarFlecha(newRestaurar, 'bajar'); flujos.bajar(); });
        IconosAnimados.ponerIconoFlecha(newRestaurar, 'nube', 'bajar');
    } else {
        newRespaldar.title = 'Respaldar';
        newRespaldar.addEventListener('click', () => { autoCierre(); mostrarExportar(true); });
        IconosAnimados.ponerIconoFlecha(newRespaldar, 'bandeja', 'bajar');

        newRestaurar.title = 'Restaurar';
        newRestaurar.addEventListener('click', () => { autoCierre(); mostrarImportar(true); });
        IconosAnimados.ponerIconoFlecha(newRestaurar, 'bandeja', 'subir');
    }
    EventosApp.emit('historico:botones');
}

function guardarConfigGist() {
    const token = $('gist-token')?.value.trim() || '';
    const gistId = $('gist-id')?.value.trim() || '';
    const { desdeInvalida, hastaInvalida } = _auto.leerRango();

    if (desdeInvalida) {
        mostrarToast('Hora inicial inválida.', 'error');
        return;
    }
    if (hastaInvalida) {
        mostrarToast('Hora final inválida.', 'error');
        return;
    }
    if (token && !SincronizacionGist.esTokenValido(token)) {
        mostrarToast('El token de GitHub tiene caracteres no válidos', 'error');
        return;
    }
    if (gistId && !SincronizacionGist.esGistIdValido(gistId)) {
        mostrarToast('Gist ID inválido', 'error');
        return;
    }

    const cambioFrase = _campoFrase.cambio();
    if (!_campoFrase.confirmar()) { _gistSetPanel('btn-gist-panel-cifrado', true); return; }

    const huboCambios = cambioFrase
        || token !== SincronizacionGist.getToken()
        || gistId !== SincronizacionGist.getGistId()
        || _auto.hayCambios();

    _auto.guardar();
    SincronizacionGist.saveCredentials(token, gistId);
    mostrarToast(huboCambios ? 'Configuración guardada' : 'Sin cambios', huboCambios ? 'success' : 'info');
    cerrarModalGist();
}

function cerrarModalGist() {
    _auto.descartar();
    _cerrarModalConPadre('modal-gist');
    actualizarBotonesHistorico();
}

function abrirGistEnBrowser() {
    const gistId = ($('gist-id')?.value || SincronizacionGist.getGistId() || '').trim();
    const url = SincronizacionGist.esGistIdValido(gistId) ? `https://gist.github.com/${gistId}` : 'https://gist.github.com';
    window.open(url, '_blank', 'noopener,noreferrer');
}

function bindEventos() {
    document.querySelector('.config-actions .btn-gist')?.addEventListener('click', () => abrirModalGist());
    document.querySelector('.config-actions .btn-backup')?.addEventListener('click', () => mostrarImportar());
    document.querySelector('.config-actions .btn-export')?.addEventListener('click', () => mostrarExportar());
    $('gist-token')?.addEventListener('input', () => actualizarEstadoBotonesGist());
    $('gist-id')?.addEventListener('input', () => actualizarEstadoBotonesGist());
    _campoFrase.vincular();
    FraseModal.bindEventos();
    const modalAbierto = () => !!$('modal-gist')?.classList.contains('show');
    GistSync.conectarModal({
        guardarAntes: _gistGuardarCredencialesSiModalAbierto,
        alSincronizar: () => {
            if (!modalAbierto()) return;
            const gistIdInput = $('gist-id');
            if (gistIdInput) gistIdInput.value = SincronizacionGist.getGistId();
            actualizarEstadoBotonesGist();
            _mostrarUltimaSync();
        },
        alCambiarFrase: () => { if (modalAbierto()) _campoFrase.cargar(); },
    });
    RespaldoLocal.bindEventos();
    alClic({
        'btn-toggle-token': () => alternarVisibilidadClave($('gist-token')),
        'btn-crear-token': () => window.open('https://github.com/settings/tokens/new?description=Horarios+sync&scopes=gist', '_blank', 'noopener,noreferrer'),
        'btn-gist-abrir': () => abrirGistEnBrowser(),
        'btn-gist-subir': () => { IconosAnimados.animarFlecha($('btn-gist-subir'), 'subir'); GistSync.subir(); },
        'btn-gist-bajar': () => { IconosAnimados.animarFlecha($('btn-gist-bajar'), 'bajar'); GistSync.bajar(); },
    });
    document.querySelectorAll('.gist-panel-toggle').forEach(b => b.addEventListener('click', () => toggleGistPanel(b.id)));
    _auto.bindEventos();

    $('btn-gist-guardar')?.addEventListener('click', () => guardarConfigGist());
    $('btn-gist-volver')?.addEventListener('click', () => cerrarModalGist());

    $('btn-gist-merge-aplicar')?.addEventListener('click', () => GistSync.mergeAplicar($('gist-merge-resumen')?.dataset.modo === 'replace' ? 'replace' : 'merge'));
    $('btn-gist-merge-cancelar')?.addEventListener('click', () => GistSync.mergeCancelar());

    alClic({
        'btn-seleccionar-archivo': () => $('file-import').click(),
        'btn-combinar': () => ImportarExportar.importarDatos($('file-import').files?.[0], 'merge'),
        'btn-reemplazar': () => ImportarExportar.importarDatos($('file-import').files?.[0], 'replace'),
        'btn-volver-importar': () => cerrarImportar(),
    });

    document.querySelector('#modal-exportar .btn-export')?.addEventListener('click', () => ejecutarExportacion());
    $('btn-volver-exportar')?.addEventListener('click', () => cerrarExportar());
}

export const GistRespaldo = {
    bindEventos,
    actualizarBotonesHistorico,
    proveedorRapido,
    cerrarModalGist
};
