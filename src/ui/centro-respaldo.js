import { $, setColapsable, alClic } from '../core/dom.js';
import { EventosApp } from '../core/eventos.js';
import { UIBase } from './base.js';
import { GestorModales } from './gestor-modales.js';
import { IconosAnimados } from './iconos-animados.js';
import { HistoricoEdicion } from './historico-edicion.js';
import { mostrarToast } from './toast.js';
import { _scrollHastaVisible } from './scroll.js';
import { CampoFrase } from './campo-frase.js';
import { FraseModal } from './frase-modal.js';
import { SyncAutomatizacion } from './sync-automatizacion.js';
import { SyncNube } from './sync-nube.js';
import { GistSync } from './gist-sync.js';
import { DriveSync } from './drive-sync.js';
import { GistRespaldo } from './gist-respaldo.js';
import { DriveRespaldo } from './drive-respaldo.js';
import { RespaldoLocal } from './respaldo-local.js';
import { FraseCifrado } from '../services/frase-cifrado.js';
import { ConfigSync } from '../services/config-sync.js';
import { EstadoApp } from '../services/estado-app.js';
import { DestinoRespaldo } from '../services/destino-respaldo.js';
import { SincronizacionGist } from '../services/sincronizacion-gist.js';
import { SincronizacionDrive } from '../services/sincronizacion-drive.js';

// ====================================================================
// RESPALDO Y SINCRONIZACIÓN — el modal único de los respaldos (Ajustes → Datos)
// ====================================================================
// Reúne los tres destinos (archivo local, GitHub Gist y Google Drive) con sus acciones, y lo que es común a todos y antes se
// repetía en cada modal: la frase de cifrado y la sincronización automática. Uno de los destinos es el principal del perfil
// (DestinoRespaldo): con él corren la automática y los botones rápidos del histórico. La conexión de cada servicio sigue en su
// desplegable «Conexión» (gist-respaldo.js, drive-respaldo.js), que avisa con el evento 'respaldo:conexion' cuando cambia.
// Todo se guarda en vivo (el destino principal, la automática, «Recordar»), salvo la frase de cifrado: se escribe y se aplica con
// «Aplicar» (Respaldar, Subir y Bajar aplican la escrita antes, y al cerrar con una sin aplicar se pregunta).
const { _setBtnDisabled, _abrirModalConPadre, _cerrarModalConPadre, _flashCampo } = UIBase;

const MODAL = 'modal-respaldo';
const NOMBRE_CORTO = Object.freeze({ local: 'el archivo', gist: 'Gist', drive: 'Drive' });
/** @type {('local' | 'gist' | 'drive')[]} */
const DESTINOS = ['local', 'gist', 'drive'];
const FLUJOS = { gist: GistSync, drive: DriveSync };

const _abierto = () => !!$(MODAL)?.classList.contains('show');

const _auto = SyncAutomatizacion.crear({
    prefijo: 'sync', servicio: ConfigSync, nombre: () => NOMBRE_CORTO[DestinoRespaldo.principal()],
    alCambiar: () => { _auto.setHabilitado(DestinoRespaldo.nubeActiva() !== null); _actualizarResumenAjustes(); }   // «Al bajar datos» solo aplica al modo restaurar
});

// La frase de cifrado de la app (FraseCifrado): el único lugar donde se carga
const _campoFrase = new CampoFrase(
    { input: 'sync-frase', ojo: 'btn-sync-frase-ver', generar: 'btn-sync-frase-generar', recordar: 'btn-toggle-sync-recordar' },
    () => _actualizarResumenCifrado());

function _actualizarResumenCifrado() {
    const el = $('sync-cifrado-resumen');
    if (!el) return;
    const escrita = _campoFrase.valor();
    const evaluada = FraseCifrado.evaluar(escrita);
    const hayFrase = escrita.trim() !== '';
    _setBtnDisabled('btn-toggle-sync-recordar', !hayFrase);
    if (!hayFrase) el.textContent = 'Sin cifrar · los respaldos salen en claro';
    else if (!evaluada.ok) el.textContent = `Faltan ${Math.max(1, 20 - evaluada.frase.length)} caracteres (mínimo 20)`;
    else el.textContent = _campoFrase.recordar() ? 'Activado · frase recordada en este navegador' : 'Activado · la frase vale hasta cerrar la app';
}

function _setPanel(btnId, abierto, animar = true) {
    const btn = $(btnId);
    const panel = $(btn?.getAttribute('aria-controls') || '');
    if (!btn || !panel) return;
    btn.setAttribute('aria-expanded', String(abierto));
    setColapsable(panel, abierto, { animar });
}

/** El desplegable «Conexión» de un destino. */
const _alternarConexion = (btnId) => _setPanel(btnId, $(btnId)?.getAttribute('aria-expanded') !== 'true');

// --------------------------------------------------------------------
// Destinos: estado de cada uno y cuál es el principal
// --------------------------------------------------------------------
const _ultimaSync = (iso) => (iso ? `última sync: ${ConfigSync.formatLastSync(iso)}` : 'sin sincronizar');

function _estadoGist() {
    if (!SincronizacionGist.conectado()) return 'Sin configurar';
    if (!SincronizacionGist.listo()) return 'Token cargado · el Gist se crea al subir';
    return `Conectado${SincronizacionGist.getCifrado() ? ' · cifrado' : ''} · ${_ultimaSync(SincronizacionGist.getLastSync())}`;
}

function _estadoDrive() {
    if (!SincronizacionDrive.conectado()) return SincronizacionDrive.disponible() ? 'Sin conectar' : 'No disponible todavía';
    if (!SincronizacionDrive.listo()) return 'Conectado · el respaldo se crea al subir o se elige al bajar';
    return `${SincronizacionDrive.getCuenta() || 'Conectado'}${SincronizacionDrive.getCifrado() ? ' · cifrado' : ''} · ${_ultimaSync(SincronizacionDrive.getLastSync())}`;
}

/** El resumen de la entrada de Ajustes → Datos: cuál es el destino principal y si sincroniza solo. */
function _actualizarResumenAjustes() {
    const el = $('respaldo-resumen');
    if (!el) return;
    const principal = DestinoRespaldo.principal();
    const modo = DestinoRespaldo.nubeActiva() ? ConfigSync.getAutoSync() : 0;
    el.textContent = `Principal: ${DestinoRespaldo.NOMBRES[principal]}${modo === 1 ? ' · restaura al abrir' : modo === 2 ? ' · respalda al abrir' : ''}`;
}

/** Pone al día los tres destinos (estado, botones y marca de principal) y lo que depende de ellos. */
function refrescar() {
    const gistConectado = SincronizacionGist.conectado();
    const driveConectado = SincronizacionDrive.conectado();
    const estadoGist = $('destino-gist-estado');
    const estadoDrive = $('destino-drive-estado');
    if (estadoGist) estadoGist.textContent = _estadoGist();
    if (estadoDrive) estadoDrive.textContent = _estadoDrive();

    GistRespaldo.cargar();
    DriveRespaldo.actualizarEstado();
    _setBtnDisabled('btn-gist-subir', !gistConectado);
    _setBtnDisabled('btn-gist-bajar', !SincronizacionGist.listo());
    _setBtnDisabled('btn-drive-subir', !driveConectado);
    _setBtnDisabled('btn-drive-bajar', !driveConectado);

    const principal = DestinoRespaldo.principal();
    const conectado = { local: true, gist: gistConectado, drive: driveConectado };
    DESTINOS.forEach(d => {
        const btn = $(`btn-principal-${d}`);
        if (!btn) return;
        const esPrincipal = d === principal;
        btn.setAttribute('aria-pressed', String(esPrincipal));
        btn.textContent = esPrincipal ? 'Principal' : 'Elegir';
        btn.disabled = !esPrincipal && !conectado[d];
    });

    _auto.setHabilitado(DestinoRespaldo.nubeActiva() !== null);
    _actualizarResumenAjustes();
}

function _elegirPrincipal(destino) {
    if (DestinoRespaldo.principal() === destino && ConfigSync.getDestino() === destino) return;
    ConfigSync.setDestino(destino);
    refrescar();
    actualizarBotonesHistorico();
}

// --------------------------------------------------------------------
// Abrir, guardar y cerrar
// --------------------------------------------------------------------
function abrir() {
    _abrirModalConPadre(MODAL, () => {
        _auto.cargar();
        refrescar();
        _setPanel('btn-sync-panel-limites', false, false);
        _setPanel('btn-sync-panel-cifrado', false, false);
        _setPanel('btn-gist-configurar', false, false);
        _setPanel('btn-drive-configurar', false, false);
        _campoFrase.cargar();
    });
}

/** Abre el desplegable de cifrado, lleva la vista al campo de la frase si no se ve y lo destella. */
async function _señalarFrase() {
    const abierto = $('btn-sync-panel-cifrado')?.getAttribute('aria-expanded') === 'true';
    _setPanel('btn-sync-panel-cifrado', true);
    if (!abierto) await new Promise(r => setTimeout(r, 400));   // espera a que termine de desplegarse
    const campo = $('sync-frase');
    const cuerpo = /** @type {HTMLElement | null} */ (campo?.closest('.modal-panel-body'));
    if (!campo || !cuerpo) return;
    await _scrollHastaVisible(campo, { contenedor: cuerpo });
    _flashCampo('sync-frase');
    campo.focus({ preventScroll: true });
}

/** Aplica la frase escrita (vacía = sin cifrado). Devuelve false si no sirve (ya se avisó). */
function _aplicarFrase() {
    if (!_campoFrase.confirmar()) { _señalarFrase(); return false; }
    _actualizarResumenAjustes();
    return true;
}

/** Antes de respaldar, subir o bajar: la frase escrita en el modal (si está abierto) se aplica primero. */
const _guardarSiAbierto = () => !_abierto() || _aplicarFrase();

function _botonAplicarFrase() {
    const huboCambios = _campoFrase.cambio();
    if (!_aplicarFrase()) return;
    const hayFrase = _campoFrase.valor().trim() !== '';
    mostrarToast(!huboCambios ? 'Sin cambios' : hayFrase ? 'Cifrado activado' : 'Cifrado desactivado', huboCambios ? 'success' : 'info');
}

/** «Recordar» se guarda en vivo, pero solo si lo escrito es la frase ya aplicada: una nueva espera a «Aplicar». */
function _alCambiarRecordar() {
    const evaluada = FraseCifrado.evaluar(_campoFrase.valor());
    if (!evaluada.ok || evaluada.frase !== FraseCifrado.actual()) return;
    if (!FraseCifrado.guardar(evaluada.frase, _campoFrase.recordar())) mostrarToast('No se pudo guardar la frase en este navegador', 'warning');
}

async function cerrar() {
    if (_abierto() && _campoFrase.cambio()) {
        _setPanel('btn-sync-panel-cifrado', true);
        const salir = await GestorModales.confirmar('La frase de cifrado que escribiste no se aplicó: si salís, se descarta.', 'Salir', '#icon-back', { titulo: 'Cifrado', labelCancel: 'Seguir editando', iconoCancel: '#icon-edit' });
        if (!salir) return;
    }
    _cerrarModalConPadre(MODAL);
    actualizarBotonesHistorico();
}

// --------------------------------------------------------------------
// Botones rápidos de la barra del histórico: van al destino principal
// --------------------------------------------------------------------
const MANTENER_MS = 500;
const MANTENER_TOLERANCIA_PX = 10;

/** Atajo: mantener presionado el botón (clic o dedo) abre el modal de Respaldo y sincronización; el clic que sigue al soltar se descarta. */
function _atajoMantenerAbreRespaldo(/** @type {HTMLElement} */ btn) {
    /** @type {ReturnType<typeof setTimeout> | null} */
    let timer = null;
    let x0 = 0, y0 = 0, disparado = false;
    const cancelar = () => { if (timer) clearTimeout(timer); timer = null; };
    btn.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        disparado = false;
        x0 = e.clientX; y0 = e.clientY;
        cancelar();
        timer = setTimeout(() => {
            timer = null;
            disparado = true;
            if ('vibrate' in navigator && navigator.userActivation?.hasBeenActive) { try { navigator.vibrate(15); } catch { /* opcional */ } }
            abrir();
        }, MANTENER_MS);
    }, { passive: true });
    btn.addEventListener('pointermove', (e) => {
        if (timer && Math.hypot(e.clientX - x0, e.clientY - y0) > MANTENER_TOLERANCIA_PX) cancelar();
    }, { passive: true });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => btn.addEventListener(t, cancelar, { passive: true }));
    btn.addEventListener('contextmenu', (e) => e.preventDefault());   // el menú del mantener en el celular
    // En captura y antes que el clic normal: si ya abrió el modal, ese clic no sube ni baja nada
    btn.addEventListener('click', (e) => {
        if (!disparado) return;
        disparado = false;
        e.stopImmediatePropagation();
        e.preventDefault();
    }, true);
}

/** @type {'gist' | 'drive' | null | undefined} a dónde apuntan hoy los botones (undefined: todavía no se armaron) */
let _nubeBotones;

function actualizarBotonesHistorico() {
    const btnRespaldar = $('btn-hist-respaldar');
    const btnRestaurar = $('btn-hist-restaurar');
    if (!btnRespaldar || !btnRestaurar) return;

    const nube = DestinoRespaldo.nubeActiva();
    _nubeBotones = nube;

    const newRespaldar = /** @type {HTMLElement} */ (btnRespaldar.cloneNode(true));
    const newRestaurar = /** @type {HTMLElement} */ (btnRestaurar.cloneNode(true));
    btnRespaldar.parentNode?.replaceChild(newRespaldar, btnRespaldar);
    btnRestaurar.parentNode?.replaceChild(newRestaurar, btnRestaurar);

    const autoCierre = () => {
        HistoricoEdicion.iniciarTimerAutoCierreBotones();
    };

    if (nube) {
        const flujos = FLUJOS[nube];
        const nombre = NOMBRE_CORTO[nube];
        const base = nube === 'drive' ? 'drive' : 'nube';   // Drive dibuja su silueta; el Gist, la nube
        newRespaldar.title = `Subir a ${nombre} (mantener presionado: abrir Respaldo y sincronización)`;
        newRespaldar.addEventListener('click', () => { autoCierre(); IconosAnimados.animarFlecha(newRespaldar, 'subir'); flujos.subir(); });
        IconosAnimados.ponerIconoFlecha(newRespaldar, base, 'subir');

        newRestaurar.title = `Bajar de ${nombre} (mantener presionado: abrir Respaldo y sincronización)`;
        newRestaurar.addEventListener('click', () => { autoCierre(); IconosAnimados.animarFlecha(newRestaurar, 'bajar'); flujos.bajar(); });
        IconosAnimados.ponerIconoFlecha(newRestaurar, base, 'bajar');
    } else {
        newRespaldar.title = 'Respaldar (mantener presionado: abrir Respaldo y sincronización)';
        newRespaldar.addEventListener('click', () => { autoCierre(); RespaldoLocal.mostrarExportar(true); });
        IconosAnimados.ponerIconoFlecha(newRespaldar, 'bandeja', 'bajar');

        newRestaurar.title = 'Restaurar (mantener presionado: abrir Respaldo y sincronización)';
        newRestaurar.addEventListener('click', () => { autoCierre(); RespaldoLocal.mostrarImportar(true); });
        IconosAnimados.ponerIconoFlecha(newRestaurar, 'bandeja', 'subir');
    }
    _atajoMantenerAbreRespaldo(newRespaldar);
    _atajoMantenerAbreRespaldo(newRestaurar);
    EventosApp.emit('historico:botones');
}

/** Sincronización automática al abrir la app, con el destino principal (ver DestinoRespaldo.automaticaPendiente). */
function iniciarAutomatica(demoraMs) {
    const pendiente = DestinoRespaldo.automaticaPendiente();
    if (!pendiente) return;
    setTimeout(async () => { await FLUJOS[pendiente.destino][pendiente.tipo](true); ConfigSync.marcarSync(pendiente.tipo); }, demoraMs);
}

/**
 * Recién conectada la cuenta de Google (se volvió de autorizar): se sigue en este modal, que es donde están Subir y Bajar.
 * En un perfil sin registros (dispositivo nuevo, configuración inicial) con respaldos de Horarios en esa cuenta, ofrece
 * bajar uno ahí mismo: la lista para elegirlo y después el resumen, que se pueden cancelar.
 */
async function alConectarDrive() {
    if (!_abierto()) abrir();
    if (EstadoApp.registros().length > 0) return;
    try {
        if (!SincronizacionDrive.listo() && (await SincronizacionDrive.listarRespaldos()).length === 0) return;
    } catch {
        return;   // sin red para listar: queda el modal abierto con Bajar a mano
    }
    DriveSync.bajar();
}

function bindEventos() {
    _campoFrase.vincular();
    $('btn-toggle-sync-recordar')?.addEventListener('click', _alCambiarRecordar);   // después del cambio que hace _campoFrase
    _auto.bindEventos();
    FraseModal.bindEventos();
    RespaldoLocal.bindEventos();
    GistRespaldo.bindEventos();
    DriveRespaldo.bindEventos();

    // Lo que los flujos de subir y bajar (sync-nube.js) necesitan de este modal
    const aportes = {
        guardarAntes: _guardarSiAbierto,
        // Una primera subida deja listo el destino (crea el Gist o el archivo de Drive): los botones rápidos pasan a usarlo.
        // Si no cambió no se rearman, porque el clic pudo venir de ellos y están animando su flecha.
        alSincronizar: () => { refrescar(); if (DestinoRespaldo.nubeActiva() !== _nubeBotones) actualizarBotonesHistorico(); },
        alCambiarFrase: () => { if (_abierto()) _campoFrase.cargar(); },
    };
    GistSync.conectarModal(aportes);
    DriveSync.conectarModal(aportes);
    EventosApp.on('respaldo:conexion', () => { refrescar(); actualizarBotonesHistorico(); });

    const sincronizar = (destino, tipo) => () => { IconosAnimados.animarFlecha($(`btn-${destino}-${tipo}`), tipo); FLUJOS[destino][tipo](); };
    alClic({
        'btn-abrir-respaldo': () => abrir(),
        'btn-local-respaldar': () => { if (_aplicarFrase()) RespaldoLocal.mostrarExportar(); },
        'btn-local-restaurar': () => RespaldoLocal.mostrarImportar(),
        'btn-gist-subir': sincronizar('gist', 'subir'),
        'btn-gist-bajar': sincronizar('gist', 'bajar'),
        'btn-gist-configurar': () => _alternarConexion('btn-gist-configurar'),
        'btn-gist-guardar': () => { if (GistRespaldo.guardar()) _setPanel('btn-gist-configurar', false); },
        'btn-drive-subir': sincronizar('drive', 'subir'),
        'btn-drive-bajar': sincronizar('drive', 'bajar'),
        'btn-drive-configurar': () => _alternarConexion('btn-drive-configurar'),
        'btn-principal-local': () => _elegirPrincipal('local'),
        'btn-principal-gist': () => _elegirPrincipal('gist'),
        'btn-principal-drive': () => _elegirPrincipal('drive'),
        'btn-sync-panel-cifrado': () => _setPanel('btn-sync-panel-cifrado', $('btn-sync-panel-cifrado')?.getAttribute('aria-expanded') !== 'true'),
        'btn-sync-panel-limites': () => _setPanel('btn-sync-panel-limites', $('btn-sync-panel-limites')?.getAttribute('aria-expanded') !== 'true'),
        'btn-sync-frase-aplicar': () => _botonAplicarFrase(),
        'btn-respaldo-volver': () => cerrar(),
        'btn-gist-merge-aplicar': () => SyncNube.mergeAplicar($('gist-merge-resumen')?.dataset.modo === 'replace' ? 'replace' : 'merge'),
        'btn-gist-merge-cancelar': () => SyncNube.mergeCancelar(),
    });
    GestorModales.registrarAccionVolver(MODAL, cerrar);
    GestorModales.registrarAccionVolver('modal-gist-merge', SyncNube.mergeCancelar);
    _actualizarResumenAjustes();
}

export const CentroRespaldo = { bindEventos, abrir, cerrar, refrescar, actualizarBotonesHistorico, iniciarAutomatica, alConectarDrive };
