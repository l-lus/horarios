import { $ } from '../core/dom.js';
import { STORAGE_KEYS } from '../core/constantes.js';
import { Almacenamiento } from '../core/almacenamiento.js';
import { EventosApp } from '../core/eventos.js';
import { Movimiento } from '../core/movimiento.js';
import { html, montar } from '../core/html.js';
import { DestinoRespaldo } from '../services/destino-respaldo.js';
import { MAX_ATAJOS, normalizarAtajos, alternarAtajo } from '../services/atajos.js';
import { Animaciones } from './animaciones.js';
import { GestorModales } from './gestor-modales.js';
import { Configuracion } from './configuracion.js';
import { CentroRespaldo } from './centro-respaldo.js';
import { Notificaciones } from './notificaciones.js';
import { RespaldoLocal } from './respaldo-local.js';
import { IconosAnimados } from './iconos-animados.js';
import { OrdenTarjetas } from './orden-tarjetas.js';
import { mostrarToast } from './toast.js';

// ====================================================================
// TARJETA DE ATAJOS (botones que el usuario elige, hasta MAX_ATAJOS; la lista es de cada perfil)
// ====================================================================
// Muchas acciones ya existen como botones de otras tarjetas (aunque estén ocultas o colapsadas): se las dispara desde acá para que haya
// un solo camino. Subir y Bajar usan los botones de Registros, que van al destino principal de Respaldo y sincronización.
const _ETIQUETAS_ANIMACIONES = { auto: 'Auto', on: 'Sí', off: 'No' };
const _NOMBRE_NUBE = { gist: 'Gist', drive: 'Drive' };

/** Ícono de Subir y Bajar: la nube (Gist), Drive o la bandeja (archivo), con la flecha que se anima al tocar. Igual que en Registros. */
function _flechaRespaldo(tipo) {
    const nube = DestinoRespaldo.nubeActiva();
    if (nube) {
        return {
            flecha: { base: nube === 'drive' ? 'drive' : 'nube', sentido: tipo },
            titulo: `${tipo === 'subir' ? 'Subir a' : 'Bajar de'} ${_NOMBRE_NUBE[nube]}`
        };
    }
    // sin nube: Respaldar guarda un archivo (la flecha baja a la bandeja) y Restaurar lo carga (sube)
    return tipo === 'subir'
        ? { flecha: { base: 'bandeja', sentido: 'bajar' }, titulo: 'Respaldar' }
        : { flecha: { base: 'bandeja', sentido: 'subir' }, titulo: 'Restaurar' };
}

/**
 * Catálogo de atajos. `estado()` devuelve lo que cambia con la situación (ícono o ícono con flecha, título, si está desactivado);
 * `accion(btn)` lo que hace. El orden de este arreglo es el de la lista del selector.
 * @typedef {{ icono?: string, flecha?: { base: string, sentido: 'subir' | 'bajar' }, titulo: string, desactivado?: boolean }} EstadoAtajo
 * @type {ReadonlyArray<{ id: string, nombre: string, descripcion: string, estado: () => EstadoAtajo, accion: (btn: HTMLElement) => void }>}
 */
const CATALOGO = [
    {
        id: 'bajar', nombre: 'Bajar / Restaurar', descripcion: 'Baja del destino principal (Gist o Drive); si es un archivo, restaura desde uno',
        estado: () => _flechaRespaldo('bajar'),
        accion: (btn) => { IconosAnimados.animarFlecha(btn, DestinoRespaldo.nubeActiva() ? 'bajar' : 'subir'); $('btn-hist-restaurar')?.click(); }
    },
    {
        id: 'subir', nombre: 'Subir / Respaldar', descripcion: 'Sube al destino principal (Gist o Drive); si es un archivo, guarda uno de respaldo',
        estado: () => _flechaRespaldo('subir'),
        accion: (btn) => { IconosAnimados.animarFlecha(btn, DestinoRespaldo.nubeActiva() ? 'subir' : 'bajar'); $('btn-hist-respaldar')?.click(); }
    },
    {
        id: 'exportar', nombre: 'Exportar a archivo', descripcion: 'Guarda tus registros en un archivo, uses o no la nube',
        estado: () => ({ icono: '#icon-download', titulo: 'Exportar a archivo' }),
        accion: () => RespaldoLocal.mostrarExportar(true)
    },
    {
        id: 'importar', nombre: 'Importar desde archivo', descripcion: 'Carga registros desde un archivo, uses o no la nube',
        estado: () => ({ icono: '#icon-upload', titulo: 'Importar desde archivo' }),
        accion: () => RespaldoLocal.mostrarImportar(true)
    },
    {
        id: 'deshacer', nombre: 'Deshacer', descripcion: 'Deshace el último cambio en los registros',
        estado: () => ({ icono: '#icon-undo', titulo: 'Deshacer (Ctrl+Z)', desactivado: !!(/** @type {HTMLButtonElement | null} */ ($('btn-undo'))?.disabled) }),
        accion: (btn) => { IconosAnimados.girarIcono(btn, -1); $('btn-undo')?.click(); }
    },
    {
        id: 'rehacer', nombre: 'Rehacer', descripcion: 'Vuelve a aplicar el cambio deshecho',
        estado: () => ({ icono: '#icon-redo', titulo: 'Rehacer (Ctrl+Y)', desactivado: !!(/** @type {HTMLButtonElement | null} */ ($('btn-redo'))?.disabled) }),
        accion: (btn) => { IconosAnimados.girarIcono(btn, 1); $('btn-redo')?.click(); }
    },
    {
        id: 'personalizar', nombre: 'Personalizar', descripcion: 'Abre la personalización: tema, énfasis, tarjeta de estado y calendario',
        estado: () => ({ icono: '#icon-grid-group', titulo: 'Personalizar' }),
        accion: () => Configuracion.abrirPersonalizacion()
    },
    {
        id: 'respaldo', nombre: 'Respaldo y sincronización', descripcion: 'Abre el respaldo: destinos, cifrado y sincronización automática',
        estado: () => ({ icono: '#icon-cloud', titulo: 'Respaldo y sincronización' }),
        accion: () => CentroRespaldo.abrir()
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
];

const _IDS = CATALOGO.map(a => a.id);
const _porId = (id) => CATALOGO.find(a => a.id === id);

function obtenerAtajos() {
    return normalizarAtajos(Almacenamiento.getObject(STORAGE_KEYS.ATAJOS, null, true), _IDS);
}

function _guardar(lista) {
    Almacenamiento.setItem(STORAGE_KEYS.ATAJOS, lista, true);
}

/**
 * Pone el ícono en el `<svg>` del botón: uno simple, o el de respaldo con su flecha (ver IconosAnimados.ponerIconoFlecha).
 * Si es el mismo que ya tiene no lo toca: rearmarlo cortaría la animación de la flecha o del giro recién empezada.
 */
function _ponerIcono(btn, est) {
    const svg = btn.querySelector('svg');
    if (!svg) return;
    const clave = est.flecha ? `${est.flecha.base}-${est.flecha.sentido}` : (est.icono ?? '');
    if (svg.dataset.icono === clave) return;
    svg.dataset.icono = clave;
    if (est.flecha) { IconosAnimados.ponerIconoFlecha(btn, est.flecha.base, est.flecha.sentido); return; }
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', clave);
    svg.replaceChildren(use);
}

function _aplicarEstado(btn, def) {
    const est = def.estado();
    btn.title = est.titulo;
    btn.setAttribute('aria-label', est.titulo);
    btn.disabled = !!est.desactivado;
    _ponerIcono(btn, est);
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

function _dibujar() {
    const grilla = $('atajos-botones');
    if (!grilla) return;
    const defs = obtenerAtajos().flatMap(id => _porId(id) ?? []);
    montar(grilla, html`${defs.map(def => html`<button class="atajo-btn" id="atajo-${def.id}" data-atajo="${def.id}" type="button"><svg class="icon"></svg></button>`)}`);
    actualizarEstados();
}

// Agregar o quitar un atajo puede sumar o quitar una fila: el alto de la tarjeta se anima (ver CLAUDE.md). Al arrancar la app, no.
function renderizar(animar = true) {
    if (animar) Animaciones._animarAlturaCambio($('card-atajos'), _dibujar);
    else _dibujar();
}

// Con la lista ya dibujada solo se actualiza el estado de cada fila (no se vuelve a armar), para que los interruptores se animen al cambiar
function _sincronizarSelector() {
    const lista = $('lista-atajos-opciones');
    if (!lista) return;
    const elegidos = obtenerAtajos();
    const llena = elegidos.length >= MAX_ATAJOS;
    lista.querySelectorAll('button[data-atajo]').forEach(btn => {
        const activo = elegidos.includes(/** @type {HTMLElement} */ (btn).dataset.atajo ?? '');
        btn.classList.toggle('btn-activo', activo);
        /** @type {HTMLButtonElement} */ (btn).disabled = !activo && llena;
    });
    const contador = $('atajos-contador');
    if (contador) contador.textContent = `${elegidos.length}/${MAX_ATAJOS}`;
}

function _renderizarSelector() {
    const lista = $('lista-atajos-opciones');
    if (!lista) return;
    const elegidos = obtenerAtajos();
    const llena = elegidos.length >= MAX_ATAJOS;
    montar(lista, html`${CATALOGO.map(def => {
        const activo = elegidos.includes(def.id);
        return html`<button type="button" class="${activo ? 'btn-activo' : ''}" data-atajo="${def.id}" ${!activo && llena ? 'disabled' : ''}>
            <svg class="icon"></svg>
            <span class="settings-list-text"><span>${def.nombre}</span><span class="settings-list-desc">${def.descripcion}</span></span>
            <span class="toggle-switch" aria-hidden="true"></span>
        </button>`;
    })}`);
    // el ícono de cada fila (los de respaldo, con su flecha), como en la tarjeta
    lista.querySelectorAll('button[data-atajo]').forEach(btn => {
        const def = _porId(/** @type {HTMLElement} */ (btn).dataset.atajo);
        if (def) _ponerIcono(btn, def.estado());
    });
    const contador = $('atajos-contador');
    if (contador) contador.textContent = `${elegidos.length}/${MAX_ATAJOS}`;
}

function abrirSelectorAtajos() {
    GestorModales.abrirConPadre('modal-atajos', _renderizarSelector);
}

function cerrarModalAtajos() {
    GestorModales.cerrarConPadre('modal-atajos');
}

// Ocultar desde el selector: se cierra el modal y se oculta la tarjeta con el aviso de siempre (cómo volver a mostrarla; tocarlo la muestra otra vez)
function _ocultarTarjeta() {
    cerrarModalAtajos();
    OrdenTarjetas.ocultarConAviso('atajos');
}

function _alternarDesdeSelector(id) {
    const { lista, lleno } = alternarAtajo(obtenerAtajos(), id);
    if (lleno) { mostrarToast(`Máximo ${MAX_ATAJOS} atajos`, 'error'); return; }
    _guardar(lista);
    _sincronizarSelector();
    renderizar();
}

function bindEventos() {
    $('atajos-botones')?.addEventListener('click', (e) => {
        const btn = /** @type {HTMLElement} */ (e.target).closest('button[data-atajo]');
        if (!btn) return;
        const def = _porId(/** @type {HTMLElement} */ (btn).dataset.atajo);
        if (!def || /** @type {HTMLButtonElement} */ (btn).disabled) return;
        def.accion(/** @type {HTMLElement} */ (btn));
        actualizarEstados();
    });
    $('btn-atajos-agregar')?.addEventListener('click', () => abrirSelectorAtajos());
    $('lista-atajos-opciones')?.addEventListener('click', (e) => {
        const btn = /** @type {HTMLElement} */ (e.target).closest('button[data-atajo]');
        if (btn) _alternarDesdeSelector(/** @type {HTMLElement} */ (btn).dataset.atajo ?? '');
    });
    document.querySelector('#modal-atajos .btn-cancel')?.addEventListener('click', () => cerrarModalAtajos());
    $('btn-atajos-ocultar')?.addEventListener('click', () => _ocultarTarjeta());
    GestorModales.registrarAccionVolver('modal-atajos', cerrarModalAtajos);
}

// Lo que cambia solo (deshacer/rehacer disponibles, destino principal) se refleja sin volver a dibujar la tarjeta.
// Se escucha desde la carga del módulo: los primeros eventos llegan antes de que se enlace el DOM
EventosApp.on('historial:cambio', actualizarEstados);
EventosApp.on('historico:botones', actualizarEstados);   // cambió el destino principal (los botones de Registros se rearmaron)
EventosApp.on('config:atajos', () => renderizar());              // al restaurar un respaldo o bajar de la nube

export const Atajos = { renderizar, actualizarEstados, obtenerAtajos, cerrarModalAtajos, bindEventos };
