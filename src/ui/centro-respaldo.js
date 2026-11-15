import { $, setColapsable, alClic } from '../core/dom.js';
import { EventosApp } from '../core/eventos.js';
import { UIBase } from './base.js';
import { GestorModales } from './gestor-modales.js';
import { IconosAnimados } from './iconos-animados.js';
import { HistoricoEdicion } from './historico-edicion.js';
import { mostrarToast } from './toast.js';
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
// modal (gist-respaldo.js, drive-respaldo.js), que avisa con el evento 'respaldo:conexion' cuando cambia.
// El destino principal se guarda al tocarlo; la frase y la automática quedan en borrador hasta Guardar (Respaldar, Subir y
// Bajar guardan antes).
const { _setBtnDisabled, _abrirModalConPadre, _cerrarModalConPadre } = UIBase;

const MODAL = 'modal-respaldo';
const NOMBRE_CORTO = Object.freeze({ local: 'el archivo', gist: 'Gist', drive: 'Drive' });
/** @type {('local' | 'gist' | 'drive')[]} */
const DESTINOS = ['local', 'gist', 'drive'];
const FLUJOS = { gist: GistSync, drive: DriveSync };

const _abierto = () => !!$(MODAL)?.classList.contains('show');

const _auto = SyncAutomatizacion.crear({
    prefijo: 'sync', servicio: ConfigSync, nombre: () => NOMBRE_CORTO[DestinoRespaldo.principal()],
    alCambiar: () => _auto.setHabilitado(DestinoRespaldo.nubeActiva() !== null)   // «Al bajar datos» solo aplica al modo restaurar
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
        _campoFrase.cargar();
    });
}

/** Valida y guarda el borrador (frase y automática). Devuelve false si algo de lo escrito no sirve (ya se avisó). */
function _guardarBorrador() {
    const { desdeInvalida, hastaInvalida } = _auto.leerRango();
    if (desdeInvalida || hastaInvalida) {
        mostrarToast(desdeInvalida ? 'Hora inicial inválida.' : 'Hora final inválida.', 'error');
        _setPanel('btn-sync-panel-limites', true);
        return false;
    }
    if (!_campoFrase.confirmar()) { _setPanel('btn-sync-panel-cifrado', true); return false; }
    _auto.guardar();
    _actualizarResumenAjustes();
    return true;
}

/** Antes de respaldar, subir o bajar: lo escrito en el modal (si está abierto) se guarda primero. */
const _guardarSiAbierto = () => !_abierto() || _guardarBorrador();

function guardar() {
    const huboCambios = _campoFrase.cambio() || _auto.hayCambios();
    if (!_guardarBorrador()) return;
    mostrarToast(huboCambios ? 'Configuración guardada' : 'Sin cambios', huboCambios ? 'success' : 'info');
    cerrar();
}

function cerrar() {
    _auto.descartar();
    _cerrarModalConPadre(MODAL);
    actualizarBotonesHistorico();
}

// --------------------------------------------------------------------
// Botones rápidos de la barra del histórico: van al destino principal
// --------------------------------------------------------------------
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
        newRespaldar.title = `Subir a ${nombre}`;
        newRespaldar.addEventListener('click', () => { autoCierre(); IconosAnimados.animarFlecha(newRespaldar, 'subir'); flujos.subir(); });
        IconosAnimados.ponerIconoFlecha(newRespaldar, base, 'subir');

        newRestaurar.title = `Bajar de ${nombre}`;
        newRestaurar.addEventListener('click', () => { autoCierre(); IconosAnimados.animarFlecha(newRestaurar, 'bajar'); flujos.bajar(); });
        IconosAnimados.ponerIconoFlecha(newRestaurar, base, 'bajar');
    } else {
        newRespaldar.title = 'Respaldar';
        newRespaldar.addEventListener('click', () => { autoCierre(); RespaldoLocal.mostrarExportar(true); });
        IconosAnimados.ponerIconoFlecha(newRespaldar, 'bandeja', 'bajar');

        newRestaurar.title = 'Restaurar';
        newRestaurar.addEventListener('click', () => { autoCierre(); RespaldoLocal.mostrarImportar(true); });
        IconosAnimados.ponerIconoFlecha(newRestaurar, 'bandeja', 'subir');
    }
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
        'btn-local-respaldar': () => { if (_guardarBorrador()) RespaldoLocal.mostrarExportar(); },
        'btn-local-restaurar': () => RespaldoLocal.mostrarImportar(),
        'btn-gist-subir': sincronizar('gist', 'subir'),
        'btn-gist-bajar': sincronizar('gist', 'bajar'),
        'btn-gist-configurar': () => GistRespaldo.abrir(),
        'btn-drive-subir': sincronizar('drive', 'subir'),
        'btn-drive-bajar': sincronizar('drive', 'bajar'),
        'btn-drive-configurar': () => DriveRespaldo.abrir(),
        'btn-principal-local': () => _elegirPrincipal('local'),
        'btn-principal-gist': () => _elegirPrincipal('gist'),
        'btn-principal-drive': () => _elegirPrincipal('drive'),
        'btn-sync-panel-cifrado': () => _setPanel('btn-sync-panel-cifrado', $('btn-sync-panel-cifrado')?.getAttribute('aria-expanded') !== 'true'),
        'btn-sync-panel-limites': () => _setPanel('btn-sync-panel-limites', $('btn-sync-panel-limites')?.getAttribute('aria-expanded') !== 'true'),
        'btn-respaldo-guardar': () => guardar(),
        'btn-respaldo-volver': () => cerrar(),
        'btn-gist-merge-aplicar': () => SyncNube.mergeAplicar($('gist-merge-resumen')?.dataset.modo === 'replace' ? 'replace' : 'merge'),
        'btn-gist-merge-cancelar': () => SyncNube.mergeCancelar(),
    });
    GestorModales.registrarAccionVolver(MODAL, cerrar);
    GestorModales.registrarAccionVolver('modal-gist-merge', SyncNube.mergeCancelar);
    _actualizarResumenAjustes();
}

export const CentroRespaldo = { bindEventos, abrir, cerrar, refrescar, actualizarBotonesHistorico, iniciarAutomatica, alConectarDrive };
