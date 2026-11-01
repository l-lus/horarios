import { $ } from '../core/dom.js';
import { STORAGE_KEYS } from '../core/constantes.js';
import { Almacenamiento } from '../core/almacenamiento.js';
import { EventosApp } from '../core/eventos.js';
import { Movimiento } from '../core/movimiento.js';
import { EstiloCalendario } from '../core/estilo-calendario.js';
import { html, icono, montar } from '../core/html.js';
import { SincronizacionGist } from '../services/sincronizacion-gist.js';
import { MAX_ATAJOS, normalizarAtajos, alternarAtajo } from '../services/atajos.js';
import { GestorTemas } from './gestor-temas.js';
import { Configuracion } from './configuracion.js';
import { Notificaciones } from './notificaciones.js';
import { RespaldoLocal } from './respaldo-local.js';
import { UIBase } from './base.js';
import { mostrarToast } from './toast.js';

// ====================================================================
// UI QUICK ACTIONS MODULE (tarjeta de atajos: botones que el usuario elige, hasta MAX_ATAJOS)
// ====================================================================
const { _abrirModalConPadre, _cerrarModalConPadre } = UIBase;

const _tieneGist = () => SincronizacionGist.esGistIdValido(SincronizacionGist.getGistId());
// Muchas acciones ya existen como botones de otras tarjetas (aunque estén ocultas o colapsadas): se las dispara desde acá para que haya un solo camino
const _click = (id) => () => $(id)?.click();
const _ETIQUETAS_ANIMACIONES = { auto: 'Auto', on: 'Sí', off: 'No' };

/**
 * Catálogo de atajos. `estado()` devuelve lo que cambia con la situación (ícono, título, si está desactivado); `accion()` lo que hace.
 * El orden de este arreglo es el de la lista del selector.
 * @type {ReadonlyArray<{ id: string, nombre: string, descripcion: string,
 *   estado: () => { icono: string, titulo: string, desactivado?: boolean }, accion: () => void }>}
 */
const CATALOGO = [
    {
        id: 'bajar', nombre: 'Bajar / Restaurar', descripcion: 'Baja de Gist si lo tenés configurado; si no, restaura desde un archivo',
        estado: () => _tieneGist() ? { icono: '#icon-cloud-download', titulo: 'Bajar de Gist' } : { icono: '#icon-upload', titulo: 'Restaurar' },
        accion: _click('btn-hist-restaurar')
    },
    {
        id: 'subir', nombre: 'Subir / Respaldar', descripcion: 'Sube a Gist si lo tenés configurado; si no, guarda un archivo de respaldo',
        estado: () => _tieneGist() ? { icono: '#icon-cloud-upload', titulo: 'Subir a Gist' } : { icono: '#icon-download', titulo: 'Respaldar' },
        accion: _click('btn-hist-respaldar')
    },
    {
        id: 'exportar', nombre: 'Exportar a archivo', descripcion: 'Guarda tus registros en un archivo, uses o no Gist',
        estado: () => ({ icono: '#icon-download', titulo: 'Exportar a archivo' }),
        accion: () => RespaldoLocal.mostrarExportar(true)
    },
    {
        id: 'importar', nombre: 'Importar desde archivo', descripcion: 'Carga registros desde un archivo, uses o no Gist',
        estado: () => ({ icono: '#icon-upload', titulo: 'Importar desde archivo' }),
        accion: () => RespaldoLocal.mostrarImportar(true)
    },
    {
        id: 'deshacer', nombre: 'Deshacer', descripcion: 'Deshace el último cambio en los registros',
        estado: () => ({ icono: '#icon-undo', titulo: 'Deshacer (Ctrl+Z)', desactivado: !!$('btn-undo')?.disabled }),
        accion: _click('btn-undo')
    },
    {
        id: 'rehacer', nombre: 'Rehacer', descripcion: 'Vuelve a aplicar el cambio deshecho',
        estado: () => ({ icono: '#icon-redo', titulo: 'Rehacer (Ctrl+Y)', desactivado: !!$('btn-redo')?.disabled }),
        accion: _click('btn-redo')
    },
    {
        id: 'tema', nombre: 'Cambiar tema', descripcion: 'Pasa al siguiente tema de color',
        estado: () => ({ icono: GestorTemas.temaGuardado() === 'light' ? '#icon-moon' : '#icon-sun', titulo: 'Cambiar tema' }),
        accion: () => Configuracion.alternarTema()
    },
    {
        id: 'ayuda', nombre: 'Ayuda', descripcion: 'Abre la ayuda con buscador',
        estado: () => ({ icono: '#icon-help', titulo: 'Ayuda' }),
        accion: () => Configuracion.abrirModalAyuda()
    },
    {
        id: 'ajustes', nombre: 'Ajustes', descripcion: 'Abre los ajustes de la app',
        estado: () => ({ icono: '#icon-settings', titulo: 'Ajustes' }),
        accion: () => Configuracion.abrirConfig()
    },
    {
        id: 'notificaciones', nombre: 'Notificaciones', descripcion: 'Activa o configura el aviso de horario cumplido',
        estado: () => ({ icono: '#icon-bell', titulo: 'Notificaciones' }),
        accion: () => Notificaciones.abrirModalNotificaciones()
    },
    {
        id: 'animaciones', nombre: 'Reducir animaciones', descripcion: 'Alterna entre Auto, Sí y No',
        estado: () => ({ icono: '#icon-activity', titulo: `Reducir animaciones: ${_ETIQUETAS_ANIMACIONES[Movimiento.modo()]}` }),
        accion: () => { Movimiento.siguienteModo(); mostrarToast(`Reducir animaciones: ${_ETIQUETAS_ANIMACIONES[Movimiento.modo()]}`, 'info'); }
    },
    {
        id: 'estilo-calendario', nombre: 'Estilo del calendario', descripcion: 'Pasa al siguiente estilo de los días con registro',
        estado: () => ({ icono: '#icon-calendar-simple', titulo: `Estilo del calendario: ${EstiloCalendario.etiqueta()}` }),
        accion: () => EstiloCalendario.siguiente()
    },
    {
        id: 'perfiles', nombre: 'Perfiles', descripcion: 'Abre el selector de perfiles',
        estado: () => ({ icono: '#icon-briefcase', titulo: 'Perfiles' }),
        accion: _click('header-profile-btn')
    },
    {
        id: 'fichar', nombre: 'Fichar', descripcion: 'Registra la entrada o la salida ahora',
        estado: () => ({ icono: '#icon-clock', titulo: 'Fichar' }),
        accion: _click('btn-agregar')
    },
    {
        id: 'tiempo-fuera', nombre: 'Tiempo fuera', descripcion: 'Inicia o termina un tiempo fuera',
        estado: () => ({ icono: '#icon-exit', titulo: 'Tiempo fuera' }),
        accion: _click('btn-timer-main')
    },
    {
        id: 'reporte', nombre: 'Reporte', descripcion: 'Genera el reporte del período',
        estado: () => ({ icono: '#icon-stats', titulo: 'Reporte' }),
        accion: _click('btn-reporte')
    },
];

const _IDS = CATALOGO.map(a => a.id);
const _porId = (id) => CATALOGO.find(a => a.id === id);

function obtenerAtajos() {
    return normalizarAtajos(Almacenamiento.getObject(STORAGE_KEYS.ATAJOS, null), _IDS);
}

function _guardar(lista) {
    Almacenamiento.setItem(STORAGE_KEYS.ATAJOS, lista);
}

function _aplicarEstado(btn, def) {
    const { icono: href, titulo, desactivado } = def.estado();
    btn.title = titulo;
    btn.setAttribute('aria-label', titulo);
    btn.disabled = !!desactivado;
    btn.querySelector('use')?.setAttribute('href', href);
}

// Actualiza ícono, título y desactivado de los botones ya dibujados (sin recrearlos, para no perder el foco del teclado)
function actualizarEstados() {
    const grilla = $('atajos-botones');
    if (!grilla) return;
    grilla.querySelectorAll('button[data-atajo]').forEach(btn => {
        const def = _porId(/** @type {HTMLElement} */ (btn).dataset.atajo);
        if (def) _aplicarEstado(/** @type {HTMLButtonElement} */ (btn), def);
    });
}

function renderizar() {
    const grilla = $('atajos-botones');
    if (!grilla) return;
    const defs = obtenerAtajos().flatMap(id => _porId(id) ?? []);
    montar(grilla, html`${defs.map(def => html`<button class="atajo-btn" id="atajo-${def.id}" data-atajo="${def.id}" type="button">${icono(def.estado().icono)}</button>`)}`);
    actualizarEstados();
}

function _renderizarSelector() {
    const lista = $('lista-atajos-opciones');
    if (!lista) return;
    const elegidos = obtenerAtajos();
    const llena = elegidos.length >= MAX_ATAJOS;
    montar(lista, html`${CATALOGO.map(def => {
        const activo = elegidos.includes(def.id);
        return html`<button type="button" class="${activo ? 'btn-activo' : ''}" data-atajo="${def.id}" ${!activo && llena ? 'disabled' : ''}>
            ${icono(def.estado().icono)}
            <span class="settings-list-text"><span>${def.nombre}</span><span class="settings-list-desc">${def.descripcion}</span></span>
            <span class="toggle-switch" aria-hidden="true"></span>
        </button>`;
    })}`);
    const contador = $('atajos-contador');
    if (contador) contador.textContent = `${elegidos.length}/${MAX_ATAJOS}`;
}

function abrirSelectorAtajos() {
    _abrirModalConPadre('modal-atajos', _renderizarSelector);
}

function cerrarModalAtajos() {
    _cerrarModalConPadre('modal-atajos');
}

function _alternarDesdeSelector(id) {
    const { lista, lleno } = alternarAtajo(obtenerAtajos(), id);
    if (lleno) { mostrarToast(`Máximo ${MAX_ATAJOS} atajos`, 'error'); return; }
    _guardar(lista);
    _renderizarSelector();
    renderizar();
}

function bindEventos() {
    $('atajos-botones')?.addEventListener('click', (e) => {
        const btn = /** @type {HTMLElement} */ (e.target).closest('button[data-atajo]');
        if (!btn) return;
        const def = _porId(/** @type {HTMLElement} */ (btn).dataset.atajo);
        if (!def || /** @type {HTMLButtonElement} */ (btn).disabled) return;
        def.accion();
        actualizarEstados();
    });
    $('btn-atajos-agregar')?.addEventListener('click', () => abrirSelectorAtajos());
    $('lista-atajos-opciones')?.addEventListener('click', (e) => {
        const btn = /** @type {HTMLElement} */ (e.target).closest('button[data-atajo]');
        if (btn) _alternarDesdeSelector(/** @type {HTMLElement} */ (btn).dataset.atajo);
    });
    document.querySelector('#modal-atajos .btn-cancel')?.addEventListener('click', () => cerrarModalAtajos());
}

// Lo que cambia solo (deshacer/rehacer disponibles, Gist configurado o no, perfil) se refleja sin volver a dibujar la tarjeta.
// Se escucha desde la carga del módulo: los primeros eventos llegan antes de que se enlace el DOM
EventosApp.on('historial:cambio', actualizarEstados);
EventosApp.on('historico:botones', actualizarEstados);
EventosApp.on('perfil:cambio', actualizarEstados);
EventosApp.on('config:atajos', renderizar);   // al restaurar un respaldo o bajar de Gist

export const Atajos = { renderizar, actualizarEstados, obtenerAtajos, cerrarModalAtajos, bindEventos };
