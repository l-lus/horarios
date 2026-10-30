import { STORAGE_KEYS } from '../core/constantes.js';
import { $ } from '../core/dom.js';
import { Movimiento } from '../core/movimiento.js';
import { InstaladorPWA } from '../services/instalador-pwa.js';
import { TiempoUtils } from '../core/tiempo-utils.js';
import { RecordatorioPush } from '../services/recordatorio-push.js';
import { Almacenamiento } from '../core/almacenamiento.js';
import { GestorTemas } from './gestor-temas.js';
import { GestorPerfiles } from '../services/gestor-perfiles.js';
import { GestorModales } from './gestor-modales.js';
import { GestorHistorial } from '../services/gestor-historial.js';
import { TiposRegistro } from '../services/tipos-registro.js';
import { UIBase } from './base.js';
import { Perfiles } from './perfiles.js';
import { Calendario } from './calendario.js';
import { SincronizacionGist } from '../services/sincronizacion-gist.js';
import { GistRespaldo } from './gist-respaldo.js';
import { Historico } from './historico.js';
import { Estadisticas } from './estadisticas.js';
import { TarjetaFichaje } from './tarjeta-fichaje.js';
import { OrdenTarjetas } from './orden-tarjetas.js';
import { Notificaciones } from './notificaciones.js';
import { Configuracion } from './configuracion.js';
import { HistorialDias } from './historial-dias.js';
import { SeguridadYUtils as S } from '../core/seguridad.js';
import { GestionDatos as D } from '../services/gestion-datos.js';

const {
    registrarSwipe, debounce, _actualizarOffsetsStickyMes, actualizarOffsetsStickyMesDebounced,
    mostrarError, limpiarError, obtenerNombrePerfilSafe, descargarJSON, mostrarToast,
    _habilitarCierreToast, resetearBoton, restaurarBotonGuardarEdicion, _esperarAnim, _avisarFichaje,
    aplicarFeedbackCampos, animarExitoFichaje
} = UIBase;

const {
    crearPerfilDesdeSelector, cerrarSelectorPerfiles, cerrarEditorPerfil
} = Perfiles;

const {
    _cerrarSelectorMeses, toggleVistaHistorico, setVistaHistoricoCalendario
} = Calendario;

const {
    mostrarImportar, cerrarImportar, cerrarExportar, toggleCamposRangoExport,
    actualizarBotonesHistorico, cerrarModalGist, gistMergeCancelar, gistSubir, gistBajar
} = GistRespaldo;

const {
    cerrarEdicion, setBloqueoEdicion, _actualizarHintEdicion, _initListenerAccionesLista,
    _initListenerToggleAnio, _initListenerToggleMes, actualizarHintGrupo, cerrarFiltros,
    iniciarTimerAutoCierreBotones, verificarBloqueoCredito, setBloqueoEdicionGrupo, cerrarEdicionGrupo,
    setTiempoExpansionBotones
} = Historico;

const {
    cerrarModalReporteSecciones, _bindStatItemPopups, toggleStats, setModoEstadisticas
} = Estadisticas;

const {
    setFondoCard, actualizarUI, alternarVista, _forzarVista, actualizarEstadoBotonTimerMain,
    toggleModoLote, poblarSelectoresTipos, actualizarBotonLote, toggleFormulario, setTimerAutoVista,
    _iniciarCicloStats, _detenerCicloStats, _prepararMostrarFaseAlRenderizar,
    _refrescarFormatoCortoStatsCache
} = TarjetaFichaje;

const {
    aplicarVisibilidadCards, obtenerOrdenCards, aplicarOrdenCards, iniciarDragOrdenCards, iniciarDragTarjetas
} = OrdenTarjetas;

const {
    actualizarEstadoBotonNotificaciones, actualizarEstadoBotonPushBuffer,
    actualizarEstadoBotonPushHabilitado, actualizarSelectPushAnticipacion,
    _suscribirCambiosPermisoNotificaciones, cerrarModalNotificaciones
} = Notificaciones;

const {
    actualizarEstadoBotonIgnorarTF, actualizarEstadoBotonHoverPopup,
    actualizarEstadoBotonLogicaCubierto, actualizarEstadoBotonObjetivoPorRegistro,
    actualizarEstadoBotonFormatoCortoStats, actualizarEstadoBotonMetricaUso, actualizarEstadoBotonAplicarHoras, cerrarConfig,
    cerrarModalAyuda, refrescarConfigSiVisible, formatearInput
} = Configuracion;

const {
    cerrarModalHistorialDias, cerrarEditorTramoDias
} = HistorialDias;

function _initGlobales() {
    GestorPerfiles.inicializar();
    
    D.configurarNotificaciones({
        abrirModal: GestorModales.abrir,
        actualizarEstadoBotonTimerMain, actualizarHintGrupo, actualizarUI,
        animarExitoFichaje, aplicarFeedbackCampos, cerrarEdicion, cerrarEdicionGrupo, cerrarFiltros, cerrarImportar,
        cerrarTodosModales: GestorModales.cerrarTodos,
        confirmarModal: GestorModales.confirmar,
        descargarJSON, avisarFichaje: _avisarFichaje, iniciarTimerAutoCierreBotones, limpiarError, mostrarError, mostrarToast,
        obtenerNombrePerfilSafe, resetearBoton, restaurarBotonGuardarEdicion, setBloqueoEdicion,
        setBloqueoEdicionGrupo, temaGuardado: GestorTemas.temaGuardado, verificarBloqueoCredito,
        forzarVista: _forzarVista, prepararMostrarFaseAlRenderizar: _prepararMostrarFaseAlRenderizar, refrescarConfigSiVisible
    });
    Almacenamiento.configurarNotificaciones({ mostrarToast });
    RecordatorioPush.configurarNotificaciones({ mostrarToast });

    GestorModales.registrarAccionVolver('modal-gist', cerrarModalGist);
    GestorModales.registrarAccionVolver('modal-gist-merge', gistMergeCancelar);
    GestorModales.registrarAccionVolver('modal-config', cerrarConfig);
    GestorModales.registrarAccionVolver('modal-selector-perfiles', cerrarSelectorPerfiles);
    GestorModales.registrarAccionVolver('modal-editar', cerrarEdicion);
    GestorModales.registrarAccionVolver('modal-importar', cerrarImportar);
    GestorModales.registrarAccionVolver('modal-exportar', cerrarExportar);
    GestorModales.registrarAccionVolver('modal-editar-perfil', cerrarEditorPerfil);
    GestorModales.registrarAccionVolver('modal-editar-grupo', cerrarEdicionGrupo);
    GestorModales.registrarAccionVolver('modal-reporte-secciones', cerrarModalReporteSecciones);
    GestorModales.registrarAccionVolver('modal-ayuda', cerrarModalAyuda);
    GestorModales.registrarAccionVolver('modal-historial-dias', cerrarModalHistorialDias);
    GestorModales.registrarAccionVolver('modal-notificaciones', cerrarModalNotificaciones);
    GestorModales.registrarAccionVolver('modal-editar-tramo-dias', cerrarEditorTramoDias);
}

function _initListenersFormulario() {
    const verificarBloqueCreditoDebounced = debounce(verificarBloqueoCredito, 200);

    ['entrada', 'salida'].forEach(id => {
        const el = $(id);
        if (el) el.addEventListener('input', formatearInput);
        if (el) el.addEventListener('input', () => limpiarError(id, null));
    });
    $('fecha')?.addEventListener('change', () => limpiarError('fecha', null));

    ['edit-entrada', 'edit-salida'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', (e) => { formatearInput(e); verificarBloqueCreditoDebounced(); });
        el.addEventListener('change', verificarBloqueoCredito);
    });

    $('calendario-selector-meses')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) _cerrarSelectorMeses();
    });

    const tf = document.getElementById('edit-tiempo-fuera');
    if (tf) tf.addEventListener('input', (e) => { formatearInput(e); verificarBloqueCreditoDebounced(); });

    const notasEl = document.getElementById('edit-notas');
    if (notasEl) notasEl.addEventListener('input', () => {
        const v = notasEl.value;
        const filtrado = S.sanitizeNotas(v);
        if (filtrado !== v) {
            const pos = notasEl.selectionStart - (v.length - filtrado.length);
            notasEl.value = filtrado;
            notasEl.setSelectionRange(pos, pos);
        }
    });

    ['gist-rango-desde', 'gist-rango-hasta'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', formatearInput);
    });

    ['edit-entrada', 'edit-salida', 'edit-tiempo-fuera'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', _actualizarHintEdicion);
    });
}

function _initListenersTeclado() {
    const bindEnter = (id, handler) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            handler(el);
        });
    };
    bindEnter('entrada', () => document.getElementById('salida')?.focus());
    bindEnter('salida', (el) => { el.blur(); const b = document.getElementById('btn-agregar'); if (b && !b.disabled) b.click(); });
    bindEnter('edit-entrada', () => document.getElementById('edit-salida')?.focus());
    bindEnter('edit-salida', () => document.getElementById('edit-tiempo-fuera')?.focus());
    bindEnter('edit-tiempo-fuera', (el) => { el.blur(); const b = document.querySelector('#modal-editar .btn-edit'); if (b && !b.disabled) b.click(); });
    bindEnter('nombre-nuevo-perfil-selector', (el) => { el.blur(); crearPerfilDesdeSelector(); });
    bindEnter('nombre-perfil-editar', (el) => { el.blur(); const b = document.querySelector('#modal-editar-perfil .btn-edit'); if (b && !b.disabled) b.click(); });
}

function _initSwipesYStats() {
    _habilitarCierreToast();
    registrarSwipe(document.getElementById('stats-card'), () => alternarVista());
    registrarSwipe(document.getElementById('form-registro'), dir => {
        document.activeElement?.blur?.();
        toggleModoLote(dir);
    });

    const anchor = document.getElementById('stat-items-tipos-anchor');
    if (anchor) {
        TiposRegistro.obtenerTodosLosTipos().forEach(t => {
            const item = document.createElement('div');
            item.className = 'stat-item';
            const label = Object.assign(document.createElement('div'), { className: 'stat-label', textContent: t.labelPlural });
            const value = Object.assign(document.createElement('div'), { className: 'stat-value', id: `stat-${TiposRegistro.claveStat(t)}`, textContent: '0' });
            item.appendChild(label);
            item.appendChild(value);
            anchor.parentNode.insertBefore(item, anchor);
        });
    }
    _bindStatItemPopups(document.querySelector('.stats-grid'));
}

function _initDatosYConfig() {
    const config = D.cargarConfiguracion();
    D.setVistaActual(config.vistaActual);
    D.setIgnorarTiempoFuera(config.ignorarTiempoFuera || false);
    actualizarEstadoBotonIgnorarTF();
    poblarSelectoresTipos();
    actualizarEstadoBotonHoverPopup();
    actualizarEstadoBotonLogicaCubierto();
    actualizarEstadoBotonObjetivoPorRegistro();
    actualizarEstadoBotonFormatoCortoStats();
    actualizarEstadoBotonMetricaUso();
    _refrescarFormatoCortoStatsCache();
    actualizarEstadoBotonAplicarHoras();
    actualizarEstadoBotonPushBuffer();
    actualizarEstadoBotonPushHabilitado();
    actualizarEstadoBotonNotificaciones();
    actualizarSelectPushAnticipacion();
    aplicarVisibilidadCards();
    aplicarOrdenCards(obtenerOrdenCards());
    iniciarDragOrdenCards();
    iniciarDragTarjetas();
    setFondoCard(config.fondoCard || 'golden-gate');
    setModoEstadisticas(config.modoEstadisticas || 'mensual');

    const perfilActual = GestorPerfiles.obtenerDatosPerfil();
    D.setDiasHabiles(Array.isArray(perfilActual.diasHabiles) ? perfilActual.diasHabiles : [1, 2, 3, 4, 5]);
    const hdPerfil = parseFloat(perfilActual.horasDiarias);
    D.setHorasDiarias(Number.isFinite(hdPerfil) && hdPerfil >= 0 && hdPerfil <= 24 ? hdPerfil : 7);
    const historialGuardado = D.sanitizarHistorialDiasHabiles(perfilActual.historialDiasHabiles);
    D.setHistorialDiasHabiles(
        historialGuardado && historialGuardado.length > 0
            ? historialGuardado
            : [{ desde: '0001-01-01', dias: D.diasHabiles() }]
    );
    D.registros().splice(0, D.registros().length, ...(perfilActual.registros || []));

    const historialCargado = GestorHistorial.loadFromLocalStorage();
    if (historialCargado) {
        const estadoActual = GestorHistorial.getCurrentState();
        if (estadoActual !== null && estadoActual !== undefined) {
            D.registros().splice(0, D.registros().length, ...estadoActual);
        } else {
            console.warn('Historial corrupto, descartado. Usando registros del perfil.');
            GestorHistorial.clear();
        }
    }
    D.recalcularTotalesEnMemoria();
    if (!historialCargado) {
        GestorHistorial.saveState(D.registros());
    }

    const migrados = D.migrarObjetivoHorasFaltante();
    if (migrados > 0) {
        console.info(`Migración: ${migrados} registro(s) sin objetivo estampado, asignado el valor global vigente (${D.horasDiarias()}h).`);
        GestorHistorial.parchearRegistrosEnHistorial(r => {
            if (typeof r.objetivoHoras !== 'number' || !Number.isFinite(r.objetivoHoras)) {
                r.objetivoHoras = D.horasDiarias();
                return true;
            }
            return false;
        });
        if (GestorPerfiles) GestorPerfiles.guardarDatosPerfilActual();
    }

    GestorHistorial.updateButtons();
}

function _restaurarEstadoVisual() {
    const config = D.cargarConfiguracion();
    GestorTemas.aplicarTema(config.tema);
    Movimiento.init();

    $('fecha').value = TiempoUtils.obtenerFechaHoy();

    try {
        const persistir = Almacenamiento.getBoolean(STORAGE_KEYS.PERSISTIR_TARJETAS, true);
        if (persistir && Almacenamiento.getBoolean(STORAGE_KEYS.FORMULARIO_EXPANDIDO)) toggleFormulario();
        if (persistir && Almacenamiento.getBoolean(STORAGE_KEYS.STATS_EXPANDIDO)) toggleStats();

        const estadoHistorico = persistir ? Almacenamiento.getItem(STORAGE_KEYS.HISTORICO_EXPANDIDO, 'cerrado') : 'cerrado';
        if (estadoHistorico === 'meses' || estadoHistorico === 'completo') {
            const contenido = $('contenido-historico');
            const icon = $('icon-indicator-historico');
            if (contenido) contenido.classList.add('expanded');
            if (estadoHistorico === 'meses') {
                if (icon) { icon.classList.remove('icon-rotate-neg90'); icon.classList.add('rotated'); }
            } else {
                const botones = $('botones-historico');
                if (botones) { botones.classList.add('expanded'); setTiempoExpansionBotones(Date.now()); }
                if (icon) { icon.classList.remove('rotated'); icon.classList.add('icon-rotate-neg90'); }
            }
        }

        const usarCalendario = Almacenamiento.getBoolean(STORAGE_KEYS.VISTA_HISTORICO_CAL, true);
        if (usarCalendario) {
            if ($('contenido-historico')?.classList.contains('expanded')) {
                setVistaHistoricoCalendario(false);
                toggleVistaHistorico();
            } else {
                setVistaHistoricoCalendario(true);
            }
        }
    } catch (e) {
        console.warn('Error restaurando estado visual:', e);
    }
}

function _initAutoSync() {
    const _tieneCredenciales = SincronizacionGist.getToken() && SincronizacionGist.esGistIdValido(SincronizacionGist.getGistId());
    if (!_tieneCredenciales) return;
    const estado = SincronizacionGist.getAutoSync();
    if (estado === 1 && SincronizacionGist.dentroDelRangoHorario() && !SincronizacionGist.superaLimite('bajar')) {
        setTimeout(async () => { await gistBajar(true); SincronizacionGist.marcarSync('bajar'); }, 2000);
    } else if (estado === 2 && SincronizacionGist.dentroDelRangoHorario() && !SincronizacionGist.superaLimite('subir')) {
        setTimeout(async () => { await gistSubir(); SincronizacionGist.marcarSync('subir'); }, 2000);
    }
}

let _relojUIInterval = null;

function _iniciarRelojUI() {
    if (_relojUIInterval) return;
    _relojUIInterval = setInterval(() => actualizarUI(null, true), 20000);
}

function _detenerRelojUI() {
    clearInterval(_relojUIInterval);
    _relojUIInterval = null;
}

function _initListenerVisibility() {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            _detenerRelojUI();
            _detenerCicloStats();
        } else {
            actualizarUI(null, true);
            _iniciarRelojUI();
            _iniciarCicloStats();
        }
    });
}

function _initListenerEscape() {
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const modal = document.querySelector('.modal.show');
        if (!modal) return;
        e.preventDefault();
        GestorModales.ejecutarAccionCierre(modal.id);
    });
}

function _initListenerUndoRedo() {
    document.addEventListener('keydown', (e) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        const tag = e.target.tagName;
        const esCampoEditable = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;
        if (esCampoEditable) return;
        if (e.key === 'z' || e.key === 'Z') {
            e.preventDefault();
            document.getElementById('btn-undo')?.click();
        } else if (e.key === 'y' || e.key === 'Y') {
            e.preventDefault();
            document.getElementById('btn-redo')?.click();
        }
    });
}

function _initListenersOtros() {
    const actualizarBotonLoteDebounced = debounce(actualizarBotonLote, 300);
    const agregarListenersFecha = (el) => {
        if (!el) return;
        el.addEventListener('change', () => actualizarBotonLote());
        el.addEventListener('input', () => actualizarBotonLoteDebounced());
    };
    agregarListenersFecha(document.getElementById('lote-fecha-desde'));
    agregarListenersFecha(document.getElementById('lote-fecha-hasta'));

    document.getElementById('tipo-exportacion')?.addEventListener('change', () => toggleCamposRangoExport());

    const fileInput = document.getElementById('file-import');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const nombreEl = document.getElementById('nombre-archivo-seleccionado');
            const btnCombinar = document.getElementById('btn-combinar');
            const btnReemplazar = document.getElementById('btn-reemplazar');
            const hayArchivo = e.target.files.length > 0;
            if (hayArchivo) {
                if (nombreEl) { nombreEl.textContent = `✓ ${e.target.files[0].name}`; nombreEl.style.display = 'block'; }
                if (btnCombinar) btnCombinar.disabled = false;
                if (btnReemplazar) btnReemplazar.disabled = false;
            } else {
                if (nombreEl) { nombreEl.style.display = 'none'; nombreEl.textContent = ''; }
                if (btnCombinar) btnCombinar.disabled = true;
                if (btnReemplazar) btnReemplazar.disabled = true;
            }
        });
    }
}

async function init() {
    if (typeof Storage === 'undefined') { alert('Tu navegador no soporta localStorage.'); return; }
    Almacenamiento.migrarClavesLegadas();

    _initGlobales();
    _initListenersFormulario();
    _initListenersTeclado();
    _initSwipesYStats();
    _initDatosYConfig();
    _restaurarEstadoVisual();
    setBloqueoEdicion(true);
    setBloqueoEdicionGrupo(true);
    const btnEliminarPerfil = $('btn-eliminar-perfil-editor');
    if (btnEliminarPerfil) btnEliminarPerfil.disabled = true;

    InstaladorPWA.init();
    _suscribirCambiosPermisoNotificaciones();
    actualizarUI(null, false, false, true, true);
    Calendario.animarEntradaInicial();
    _iniciarCicloStats();
    actualizarBotonesHistorico();

    const hoy = TiempoUtils.obtenerFechaHoy();
    const hoyEsLaborable = TiempoUtils.esFechaHabil(hoy, D.diasHabilesEnFecha(hoy));
    if (D.vistaActual() === 'semana' && hoyEsLaborable) {
        setTimerAutoVista(setTimeout(() => {
            setTimerAutoVista(null);
            alternarVista();
            _esperarAnim().then(() => _iniciarCicloStats());
        }, 2500));
    }

    _initAutoSync();
    _iniciarRelojUI();
    _initListenerVisibility();

    _initListenerEscape();
    _initListenerUndoRedo();
    const lista = document.getElementById('lista-registros');
    if (lista) {
        _initListenerAccionesLista(lista);
        _initListenerToggleAnio(lista);
        _initListenerToggleMes(lista);
    }
    _initListenersOtros();

    _actualizarOffsetsStickyMes();
    window.addEventListener('resize', actualizarOffsetsStickyMesDebounced);
}

export const OrquestadorUI = { init };
