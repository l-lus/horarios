import { RespaldoLocal } from './respaldo-local.js';
import { IconosAnimados } from './iconos-animados.js';
import { $, setColapsable, alClic, alternarVisibilidadClave } from '../core/dom.js';
import { TiempoUtils } from '../core/tiempo-utils.js';
import { EventosApp } from '../core/eventos.js';
import { GestorModales } from './gestor-modales.js';
import { UIBase } from './base.js';
import { SincronizacionGist } from '../services/sincronizacion-gist.js';
import { HistoricoEdicion } from './historico-edicion.js';
import { TarjetaFichaje } from './tarjeta-fichaje.js';
import { EstadoApp } from '../services/estado-app.js';
import { ImportarExportar } from '../services/importar-exportar.js';
import { setIconoBtn } from './boton-fichar.js';
import { _crearPressHold } from './gestos.js';
import { mostrarToast } from './toast.js';
import { Animaciones } from './animaciones.js';
import { GistResumenMerge } from './gist-resumen-merge.js';
import { CampoFrase } from './campo-frase.js';
import { FraseModal } from './frase-modal.js';
import { FraseCifrado } from '../services/frase-cifrado.js';
import { RespaldoCifrado } from '../services/respaldo-cifrado.js';

// ====================================================================
//                     UI GIST AND BACKUP MODULE
// ====================================================================
const { _setBtnDisabled, _setBtnActivo, _flashCampo, _abrirModalConPadre, _cerrarModalConPadre } = UIBase;
const { _animarValor } = Animaciones;

const { mostrarImportar, cerrarImportar, mostrarExportar, cerrarExportar, ejecutarExportacion } = RespaldoLocal;
let _gistAutoSyncTemp = null;
let _gistLimitesTemp = null;
let _gistMergeDesdeModal = false;
/** @type {{ registrosNormalizados: any[], data: any } | null} */
let _gistMergeData = null;

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

function _gistEstadoAutoSyncActual() {
    return parseInt(_gistAutoSyncTemp ?? SincronizacionGist.getAutoSync());
}

function actualizarEstadoBotonesGist() {
    const token = $('gist-token')?.value.trim() || '';
    const gistId = $('gist-id')?.value.trim() || '';
    const soloToken = token !== '';
    const ambosCompletos = soloToken && gistId.length > 10;

    _setBtnDisabled('btn-gist-subir', !soloToken);
    _setBtnDisabled('btn-gist-bajar', !ambosCompletos);
    _setBtnDisabled('btn-toggle-gist-backup', !ambosCompletos);

    const estadoBackup = _gistEstadoAutoSyncActual();
    _setBtnDisabled('btn-toggle-gist-merge', !(ambosCompletos && estadoBackup === 1));

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
    _actualizarResumenLimites();
}

function _actualizarResumenLimites() {
    const el = $('gist-limites-resumen');
    if (!el) return;
    const tipo = _tipoSyncActual();
    if (!tipo) { el.textContent = 'Desactivado'; return; }
    const limite = _gistLimitesTemp ? _gistLimitesTemp[tipo] : SincronizacionGist.getSyncLimite(tipo);
    const desde = $('gist-rango-desde')?.value || '--:--';
    const hasta = $('gist-rango-hasta')?.value || '--:--';
    el.textContent = `${limite === 0 ? 'Sin límite' : `${limite} por hora`} · ${desde} – ${hasta}`;
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

        const rango = SincronizacionGist.getRangoHorario();
        const desdeEl = $('gist-rango-desde');
        const hastaEl = $('gist-rango-hasta');
        if (desdeEl) desdeEl.value = rango.desde;
        if (hastaEl) hastaEl.value = rango.hasta;

        _gistAutoSyncTemp = SincronizacionGist.getAutoSync();
        actualizarBotonGistBackup();
        actualizarBotonGistMerge();
        actualizarEstadoBotonesGist();
        const _gistCompleto = SincronizacionGist.getToken() && (SincronizacionGist.getGistId() || '').length > 10;
        _gistSetPanel('btn-gist-panel-limites', false, false);
        _gistSetPanel('btn-gist-panel-conexion', !_gistCompleto, false);
        _gistSetPanel('btn-gist-panel-cifrado', false, false);
        _campoFrase.cargar();
    });
    _gistLimitesTemp = null;
    _actualizarCampoLimite();
}

function _leerRangoHorarioInputs() {
    const desdeRaw = $('gist-rango-desde')?.value || '';
    const hastaRaw = $('gist-rango-hasta')?.value || '';
    const desdeValida = !desdeRaw || TiempoUtils.validarHora(desdeRaw);
    const hastaValida = !hastaRaw || TiempoUtils.validarHora(hastaRaw);
    return {
        desde: desdeRaw || SincronizacionGist.RANGO_HORARIO_DEFAULT.desde,
        hasta: hastaRaw || SincronizacionGist.RANGO_HORARIO_DEFAULT.hasta,
        desdeInvalida: desdeRaw !== '' && !desdeValida,
        hastaInvalida: hastaRaw !== '' && !hastaValida,
        valida: desdeValida && hastaValida
    };
}

/** Guarda lo escrito en el modal antes de subir o bajar. Devuelve false si la frase escrita no es válida (ya se avisó): no se sigue. */
function _gistGuardarCredencialesSiModalAbierto() {
    if (!$('modal-gist')?.classList.contains('show')) return true;
    if (!_campoFrase.confirmar()) { _gistSetPanel('btn-gist-panel-cifrado', true); return false; }

    SincronizacionGist.saveCredentials(
        $('gist-token')?.value.trim() || '',
        $('gist-id')?.value.trim() || ''
    );

    const { desde, hasta, valida } = _leerRangoHorarioInputs();
    if (valida) SincronizacionGist.setRangoHorario(desde, hasta);

    if (_gistAutoSyncTemp !== null) {
        SincronizacionGist.setAutoSync(_gistAutoSyncTemp);
        _gistAutoSyncTemp = null;
    }
    if (_gistLimitesTemp !== null) {
        SincronizacionGist.setSyncLimite('bajar', _gistLimitesTemp.bajar);
        SincronizacionGist.setSyncLimite('subir', _gistLimitesTemp.subir);
        _gistLimitesTemp = null;
    }
    return true;
}

function actualizarBotonesHistorico() {
    const btnRespaldar = $('btn-hist-respaldar');
    const btnRestaurar = $('btn-hist-restaurar');
    if (!btnRespaldar || !btnRestaurar) return;

    const tieneGist = SincronizacionGist.esGistIdValido(SincronizacionGist.getGistId());

    const newRespaldar = /** @type {HTMLElement} */ (btnRespaldar.cloneNode(true));
    const newRestaurar = /** @type {HTMLElement} */ (btnRestaurar.cloneNode(true));
    btnRespaldar.parentNode?.replaceChild(newRespaldar, btnRespaldar);
    btnRestaurar.parentNode?.replaceChild(newRestaurar, btnRestaurar);

    const autoCierre = () => {
        HistoricoEdicion.iniciarTimerAutoCierreBotones();
    };

    if (tieneGist) {
        newRespaldar.title = 'Subir a Gist';
        newRespaldar.addEventListener('click', () => { autoCierre(); IconosAnimados.animarFlecha(newRespaldar, 'subir'); gistSubir(); });
        IconosAnimados.ponerIconoFlecha(newRespaldar, 'nube', 'subir');

        newRestaurar.title = 'Bajar de Gist';
        newRestaurar.addEventListener('click', () => { autoCierre(); IconosAnimados.animarFlecha(newRestaurar, 'bajar'); gistBajar(); });
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
    const { desde, hasta, desdeInvalida, hastaInvalida } = _leerRangoHorarioInputs();

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

    const rango = SincronizacionGist.getRangoHorario();
    const huboCambios = cambioFrase
        || token !== SincronizacionGist.getToken()
        || gistId !== SincronizacionGist.getGistId()
        || desde !== rango.desde
        || hasta !== rango.hasta
        || (_gistAutoSyncTemp !== null && _gistAutoSyncTemp !== SincronizacionGist.getAutoSync())
        || (_gistLimitesTemp !== null);

    if (_gistAutoSyncTemp !== null) SincronizacionGist.setAutoSync(_gistAutoSyncTemp);
    if (_gistLimitesTemp !== null) {
        SincronizacionGist.setSyncLimite('bajar', _gistLimitesTemp.bajar);
        SincronizacionGist.setSyncLimite('subir', _gistLimitesTemp.subir);
    }
    SincronizacionGist.saveCredentials(token, gistId);
    SincronizacionGist.setRangoHorario(desde, hasta);
    mostrarToast(huboCambios ? 'Configuración guardada' : 'Sin cambios', huboCambios ? 'success' : 'info');
    cerrarModalGist();
}

function cerrarModalGist() {
    _gistAutoSyncTemp = null;
    _gistLimitesTemp = null;
    _cerrarModalConPadre('modal-gist');
    actualizarBotonesHistorico();
}

function _gistMergeCerrarOVolver() {
    if (_gistMergeDesdeModal) {
        _gistMergeDesdeModal = false;
        GestorModales.alternar('modal-gist-merge', 'modal-gist');
    } else {
        GestorModales.cerrar('modal-gist-merge');
    }
}

async function gistMergeAplicar(modo, modoAutomatico = false) {
    if (!_gistMergeData) return;
    const { registrosNormalizados, data } = _gistMergeData;
    _gistMergeData = null;

    const { ok, vacio } = await ImportarExportar.restaurarRespaldo(data, registrosNormalizados, modo === 'merge' ? 'merge' : 'replace', { etiqueta: 'con Gist', cerrarImportar: false });
    if (ok) TarjetaFichaje.actualizarUI();
    if ((ok || vacio) && !modoAutomatico) _gistMergeCerrarOVolver();
    if (ok) {
        _mostrarUltimaSync();
    }

    const btn = $('btn-gist-bajar');
    if (btn) btn.disabled = false;
}

function gistMergeCancelar() {
    _gistMergeData = null;
    const btn = $('btn-gist-bajar');
    if (btn) btn.disabled = false;
    _gistMergeCerrarOVolver();
}

function toggleGistMerge() {
    const actual = SincronizacionGist.getMergeBehavior();
    SincronizacionGist.setMergeBehavior(actual === 'merge' ? 'replace' : 'merge');
    actualizarBotonGistMerge();
}

function actualizarBotonGistMerge() {
    const hint = $('hint-gist-merge');
    const iconEl = $('icon-gist-merge');
    const esMerge = SincronizacionGist.getMergeBehavior() === 'merge';
    if (hint) hint.textContent = esMerge ? 'Combinar' : 'Reemplazar';
    const desc = $('desc-gist-merge');
    if (desc) desc.textContent = esMerge ? ' · une Gist con tus datos locales' : ' · sustituye tus datos locales';
    if (iconEl) setIconoBtn(iconEl, esMerge ? '#icon-combine' : '#icon-replace-swap');
}

function toggleGistBackup() {
    const actual = _gistEstadoAutoSyncActual();
    _gistAutoSyncTemp = (actual + 1) % 3;
    actualizarBotonGistBackup();
    actualizarEstadoBotonesGist();
    _actualizarCampoLimite();
}

function actualizarBotonGistBackup() {
    const btn = $('btn-toggle-gist-backup');
    const hint = $('hint-gist-backup');
    const label = $('label-gist-backup');
    const rangoEl = $('gist-rango-horario');
    const estado = _gistEstadoAutoSyncActual();
    if (!btn) return;

    const configs = [
        { texto: 'Sin automatizar', hint: ' · solo sincronizás de forma manual', activo: false },
        { texto: 'Restaurar', hint: ' · baja tus datos de Gist al abrir la app', activo: true },
        { texto: 'Respaldar', hint: ' · sube tus datos a Gist al abrir la app', activo: true }
    ];
    const c = configs[estado];
    _setBtnActivo(btn.id, c.activo);
    if (label) label.textContent = c.texto;
    if (hint) hint.textContent = c.hint;

    if (rangoEl) {
        const activo = estado === 1 || estado === 2;
        rangoEl.classList.toggle('disabled', !activo);
    }
}

function abrirGistEnBrowser() {
    const gistId = ($('gist-id')?.value || SincronizacionGist.getGistId() || '').trim();
    const url = SincronizacionGist.esGistIdValido(gistId) ? `https://gist.github.com/${gistId}` : 'https://gist.github.com';
    window.open(url, '_blank', 'noopener,noreferrer');
}

function _tipoSyncActual() {
    const estado = _gistEstadoAutoSyncActual();
    return estado === 1 ? 'bajar' : estado === 2 ? 'subir' : null;
}

function _actualizarCampoLimite(dir = 0) {
    const tipo = _tipoSyncActual();
    const contenedor = $('gist-limite-sync');
    if (!contenedor) return;
    if (!tipo) {
        contenedor.classList.add('disabled');
        _actualizarResumenLimites();
        return;
    }
    const limite = _gistLimitesTemp ? _gistLimitesTemp[tipo] : SincronizacionGist.getSyncLimite(tipo);
    const input = $('gist-limite-valor');
    const label = $('gist-limite-label');
    if (input) _animarValor(input, limite, dir);
    if (label) label.textContent = tipo === 'bajar' ? 'Límite bajadas por hora (0 = sin límite)' : 'Límite subidas por hora (0 = sin límite)';
    contenedor.classList.remove('disabled');
    _actualizarResumenLimites();
}

function cambiarLimiteSync(delta) {
    const tipo = _tipoSyncActual();
    if (!tipo) return;
    if (!_gistLimitesTemp) _gistLimitesTemp = { bajar: SincronizacionGist.getSyncLimite('bajar'), subir: SincronizacionGist.getSyncLimite('subir') };
    const previo = _gistLimitesTemp[tipo];
    _gistLimitesTemp[tipo] = Math.max(0, Math.min(99, previo + delta));
    _actualizarCampoLimite(Math.sign(_gistLimitesTemp[tipo] - previo));
}

const pressHoldLimite = _crearPressHold(delta => cambiarLimiteSync(delta));

async function _gistConSpinner(btnId, mensajeError, accion) {
    const btn = $(btnId);
    if (btn) btn.disabled = true;
    const iconoPerfil = $('header-profile-icon');
    iconoPerfil?.classList.add('icono-spin');
    _flashCampo('header-profile-btn');

    try {
        await accion();
    } catch (e) {
        console.error(`${mensajeError}:`, e);
        mostrarToast(mensajeError, 'error', undefined, e instanceof Error ? e.message : null);
    } finally {
        if (btn) btn.disabled = false;
        iconoPerfil?.classList.remove('icono-spin');
    }
}

const FALTA_FRASE_AUTO = 'El Gist está cifrado y falta la frase: cargala en Ajustes → GitHub Gist con «Recordar» activado';

/**
 * El texto a subir: cifrado si hay una frase cargada, en claro si no. Antes de pisar un Gist cifrado comprueba que la frase lo abra
 * (si no, quien tenga la frase anterior ya no podría leerlo): a mano pide confirmación y la subida automática se frena.
 * Devuelve null si la persona canceló.
 * @returns {Promise<{ texto: string, cifrado: boolean, recienCifrado: boolean } | null>}
 */
async function _contenidoParaSubir(respaldo, modoAutomatico) {
    const frase = FraseCifrado.disponible() ? FraseCifrado.actual() : '';
    if (!frase) {
        if (SincronizacionGist.getCifrado()) {
            if (modoAutomatico) throw new Error(FALTA_FRASE_AUTO);
            const seguir = await GestorModales.confirmar('Este Gist está cifrado y no hay una frase de cifrado cargada. Si seguís, se sube sin cifrar y cualquiera con el enlace puede leerlo.', 'Subir sin cifrar', '#icon-lock-open');
            if (!seguir) return null;
        }
        const salida = await ImportarExportar.textoRespaldo(respaldo);
        if ('error' in salida) throw new Error(salida.error);
        return { ...salida, recienCifrado: false };
    }

    let sal = null;
    let habiaEnClaro = false;
    const actual = await SincronizacionGist.leerActual();
    if (actual !== null) {
        const abierto = await RespaldoCifrado.abrir(actual, frase);
        if ('datos' in abierto) {
            sal = abierto.sal;   // la del sobre anterior se reutiliza: no hay que derivar la clave de nuevo
            habiaEnClaro = !abierto.cifrado;
        } else if (abierto.codigo === 'descifrado') {
            if (modoAutomatico) throw new Error('La frase guardada no abre el Gist (se cifró con otra): no se subió para no pisarlo');
            const seguir = await GestorModales.confirmar('La frase cargada no abre lo que hay en el Gist: se cifró con otra. Si seguís, se reemplaza y los dispositivos que tengan la frase anterior no van a poder leerlo.', 'Reemplazar', '#icon-upload');
            if (!seguir) return null;
        }
    }
    const salida = await ImportarExportar.textoRespaldo(respaldo, frase, { sal });
    if ('error' in salida) throw new Error(salida.error);
    return { ...salida, recienCifrado: habiaEnClaro };
}

async function gistSubir(modoAutomatico = false) {
    if (!_gistGuardarCredencialesSiModalAbierto()) return;
    await _gistConSpinner('btn-gist-subir', 'Error al subir', async () => {
        const contenido = await _contenidoParaSubir(await ImportarExportar.armarRespaldo(EstadoApp.registros()), modoAutomatico);
        if (!contenido) return;
        const nuevoId = await SincronizacionGist.subir(contenido.texto);
        SincronizacionGist.setCifrado(contenido.cifrado);
        const gistIdInput = $('gist-id');
        if (gistIdInput) gistIdInput.value = nuevoId;
        actualizarEstadoBotonesGist();   // un Gist recién creado: ya hay Gist ID, se habilita Bajar
        _mostrarUltimaSync();
        mostrarToast(contenido.cifrado ? 'Datos respaldados en Gist (cifrados)' : 'Datos respaldados en Gist', 'success');
        if (contenido.recienCifrado) mostrarToast('Las versiones anteriores del Gist siguen en claro en su historial: conviene crear un Gist nuevo y borrar el viejo', 'info', 9000);
    });
}

/**
 * Texto del Gist → respaldo. En claro se lee como siempre; cifrado se abre con la frase guardada y, si falta o no lo abre, con la
 * que se pide (a mano; la bajada automática se frena). La frase que abre el Gist queda como la frase de la app.
 * Devuelve null si la persona canceló.
 */
async function _abrirGist(texto, modoAutomatico) {
    let frase = FraseCifrado.disponible() ? FraseCifrado.actual() : '';
    for (;;) {
        const abierto = await RespaldoCifrado.abrir(texto, frase, { exigirCifrado: SincronizacionGist.getCifrado() });
        if ('datos' in abierto) {
            if (abierto.cifrado) {
                SincronizacionGist.setCifrado(true);
                if (frase !== FraseCifrado.actual()) {
                    FraseCifrado.guardar(frase, FraseCifrado.recordada());
                    if ($('modal-gist')?.classList.contains('show')) _campoFrase.cargar();
                }
            }
            return abierto.datos;
        }
        if (abierto.codigo === 'formato') throw new Error(abierto.error);
        if (abierto.codigo === 'sin-cifrar') {
            // Estaba cifrado y ahora está en claro: o lo cambió la misma persona desde otro dispositivo, o alguien lo reemplazó
            if (modoAutomatico) throw new Error(abierto.error);
            const seguir = await GestorModales.confirmar('Este Gist estaba cifrado y ahora está en claro. Si quitaste el cifrado desde otro dispositivo, podés seguir; si no, alguien lo cambió.', 'Usar igual', '#icon-lock-open');
            if (!seguir) return null;
            SincronizacionGist.setCifrado(false);
            continue;
        }
        if (modoAutomatico) throw new Error(abierto.codigo === 'sin-frase' ? FALTA_FRASE_AUTO : 'La frase guardada no abre el Gist (se cifró con otra)');
        const motivo = abierto.codigo === 'sin-frase' ? 'El Gist está cifrado. Escribí la frase con la que se subió.'
            : abierto.codigo === 'frase' ? abierto.error
                : 'La frase no abre el Gist (o su contenido fue alterado). Probá con otra.';
        const pedida = await FraseModal.pedir(motivo);
        if (pedida === null) return null;
        frase = pedida;
    }
}

async function gistBajar(modoAutomatico = false) {
    if (!_gistGuardarCredencialesSiModalAbierto()) return;
    _gistMergeDesdeModal = $('modal-gist')?.classList.contains('show') ?? false;
    await _gistConSpinner('btn-gist-bajar', 'Error al bajar', async () => {
        const data = await _abrirGist(await SincronizacionGist.bajar(), modoAutomatico);
        if (!data) return;
        const preparado = await ImportarExportar.prepararRespaldo(data, 'gist');
        if ('error' in preparado) return;
        const registrosNormalizados = preparado.registros;
        _gistMergeData = { registrosNormalizados, data };

        if (modoAutomatico) {
            await gistMergeAplicar(SincronizacionGist.getMergeBehavior(), true);
        } else {
            const diff = ImportarExportar.calcularDiferencias(registrosNormalizados);
            const configCambios = ImportarExportar.calcularCambiosConfigImport(data);
            const resumenEl = $('gist-merge-resumen');
            if (resumenEl) GistResumenMerge.construir(resumenEl, diff, registrosNormalizados, configCambios);
            if (_gistMergeDesdeModal) GestorModales.alternar('modal-gist', 'modal-gist-merge');
            else GestorModales.abrir('modal-gist-merge');
        }
    });
}

function bindEventos() {
    document.querySelector('.config-actions .btn-gist')?.addEventListener('click', () => abrirModalGist());
    document.querySelector('.config-actions .btn-backup')?.addEventListener('click', () => mostrarImportar());
    document.querySelector('.config-actions .btn-export')?.addEventListener('click', () => mostrarExportar());
    $('gist-token')?.addEventListener('input', () => actualizarEstadoBotonesGist());
    $('gist-id')?.addEventListener('input', () => actualizarEstadoBotonesGist());
    _campoFrase.vincular();
    FraseModal.bindEventos();
    RespaldoLocal.bindEventos();
    alClic({
        'btn-toggle-token': () => alternarVisibilidadClave($('gist-token')),
        'btn-crear-token': () => window.open('https://github.com/settings/tokens/new?description=Horarios+sync&scopes=gist', '_blank', 'noopener,noreferrer'),
        'btn-gist-abrir': () => abrirGistEnBrowser(),
        'btn-gist-subir': () => { IconosAnimados.animarFlecha($('btn-gist-subir'), 'subir'); gistSubir(); },
        'btn-gist-bajar': () => { IconosAnimados.animarFlecha($('btn-gist-bajar'), 'bajar'); gistBajar(); },
        'btn-toggle-gist-backup': () => toggleGistBackup(),
        'btn-toggle-gist-merge': () => toggleGistMerge(),
    });
    document.querySelectorAll('.gist-panel-toggle').forEach(b => b.addEventListener('click', () => toggleGistPanel(b.id)));
    const inputLimite = $('gist-limite-valor');
    if (inputLimite) {
        const btnDec = $('btn-gist-limite-dec') || inputLimite.closest('.input-number-group')?.querySelectorAll('.btn-increment')?.[0];
        const btnInc = $('btn-gist-limite-inc') || inputLimite.closest('.input-number-group')?.querySelectorAll('.btn-increment')?.[1];
        if (btnDec) pressHoldLimite.vincular(btnDec, -1);
        if (btnInc) pressHoldLimite.vincular(btnInc, 1);
    }

    $('btn-gist-guardar')?.addEventListener('click', () => guardarConfigGist());
    $('btn-gist-volver')?.addEventListener('click', () => cerrarModalGist());

    $('btn-gist-merge-aplicar')?.addEventListener('click', () => gistMergeAplicar($('gist-merge-resumen')?.dataset.modo === 'replace' ? 'replace' : 'merge'));
    $('btn-gist-merge-cancelar')?.addEventListener('click', () => gistMergeCancelar());

    alClic({
        'btn-seleccionar-archivo': () => $('file-import').click(),
        'btn-combinar': () => ImportarExportar.importarDatos($('file-import').files?.[0], 'merge'),
        'btn-reemplazar': () => ImportarExportar.importarDatos($('file-import').files?.[0], 'replace'),
        'btn-volver-importar': () => cerrarImportar(),
    });

    document.querySelector('#modal-exportar .btn-export')?.addEventListener('click', () => ejecutarExportacion());
    $('btn-volver-exportar')?.addEventListener('click', () => cerrarExportar());



    ['gist-rango-desde', 'gist-rango-hasta'].forEach(id => $(id)?.addEventListener('input', () => _actualizarResumenLimites()));
}

export const GistRespaldo = {
    bindEventos,
    actualizarBotonesHistorico,
    cerrarModalGist,
    gistMergeCancelar,
    gistSubir,
    gistBajar
};
