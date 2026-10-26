import { STORAGE_KEYS } from '../core/constants.js';
import { $ } from '../core/dom.js';
import { TimeUtils } from '../core/time-utils.js';
import { PushReminder } from '../services/push-reminder.js';
import { StorageHelper } from '../core/storage.js';
import { PerfilManager } from '../services/perfil-manager.js';
import { ModalManager } from './modal-manager.js';
import { UICore } from './ui-core.js';
import { SecurityAndUtils as S } from '../core/security.js';

// ====================================================================
//                     UI PROFILES MODULE
// ====================================================================
const { mostrarToast, setIconoBtn, _scrollA } = UICore;

let perfilEnEdicion = null;

const REGEX_NOMBRE_PERFIL = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\-_ ]+$/;

function _obtenerTodosPerfilesSafe() {
    return PerfilManager ? PerfilManager.obtenerTodosPerfiles() : {};
}

function _guardarPerfilesConManejo(perfiles, contextoError = 'Error al guardar perfil:') {
    try {
        if (!StorageHelper.setItem(STORAGE_KEYS.PERFILES, perfiles)) throw new Error('quota');
        return true;
    } catch (e) {
        console.error(contextoError, e);
        mostrarToast('Error al guardar: almacenamiento lleno', 'error');
        return false;
    }
}

function renderizarListaPerfiles(animarCrecimiento = false) {
    const lista = document.getElementById('lista-perfiles-botones');
    if (!lista) return;

    const alturaAnterior = animarCrecimiento ? lista.getBoundingClientRect().height : null;
    if (animarCrecimiento) {
        lista.style.transition = '';
        lista.style.height = alturaAnterior + 'px';
        lista.style.overflowY = 'hidden';
    }

    lista.innerHTML = '';
    PerfilManager.obtenerListaPerfiles().forEach(p => {
        const container = Object.assign(document.createElement('div'), {
            className: `btn-perfil-select ${p.esActual ? 'activo' : ''}`
        });

        const countText = `${p.totalRegistros} registro${TimeUtils.pluralizar(p.totalRegistros)}`;
        const infoSection = Object.assign(document.createElement('div'), { className: 'btn-perfil-info' });
        const nombreEl = Object.assign(document.createElement('div'), { className: 'btn-perfil-nombre' });
        nombreEl.appendChild(Object.assign(document.createElement('span'), {
            className: 'btn-perfil-nombre-texto',
            textContent: p.nombre
        }));
        if (p.esActual) {
            nombreEl.appendChild(Object.assign(document.createElement('span'), {
                className: 'btn-perfil-estado',
                textContent: 'Activo'
            }));
        }
        infoSection.appendChild(nombreEl);
        infoSection.appendChild(Object.assign(document.createElement('div'), {
            className: 'btn-perfil-detalle',
            textContent: countText
        }));

        const editBtn = Object.assign(document.createElement('button'), {
            className: 'btn-perfil-edit',
            innerHTML: '<svg class="icon"><use href="#icon-edit"/></svg>',
            title: 'Editar perfil',
            onclick: (e) => { e.stopPropagation(); abrirEditorPerfil(p.id); }
        });

        container.onclick = () => { if (!p.esActual) PerfilManager.cambiarPerfil(p.id); };
        container.appendChild(infoSection);
        container.appendChild(editBtn);
        lista.appendChild(container);
    });

    if (animarCrecimiento) {
        const alturaNueva = lista.scrollHeight;
        requestAnimationFrame(() => {
            lista.style.transition = `height var(--dur-collapse) ease-out`;
            lista.style.height = alturaNueva + 'px';
        });
        lista.addEventListener('transitionend', function _limpiarAlturaLista(e) {
            if (e.target !== lista || e.propertyName !== 'height') return;
            lista.removeEventListener('transitionend', _limpiarAlturaLista);
            lista.style.transition = '';
            lista.style.height = '';
            lista.style.overflowY = '';
        }, { once: false });
    }
}

function abrirSelectorPerfiles() {
    ModalManager.abrir('modal-selector-perfiles', () => {
        const inputNuevo = document.getElementById('nombre-nuevo-perfil-selector');
        if (inputNuevo) inputNuevo.value = '';

        renderizarListaPerfiles();

        const esClaro = !document.documentElement.classList.contains('dark-mode')
            && !document.documentElement.getAttribute('data-theme');
        const toggleBtnModal = document.getElementById('theme-toggle-modal');

        if (toggleBtnModal) setIconoBtn(toggleBtnModal, esClaro ? '#icon-moon' : '#icon-sun');
    });
}

function _validarNombrePerfil(nombre, perfiles) {
    if (!nombre) return 'Ingresá un nombre para el perfil';
    if (!REGEX_NOMBRE_PERFIL.test(nombre)) return 'El nombre contiene caracteres no válidos.\n Solo letras, números y espacios.';
    if (Object.values(perfiles).some(p => p.nombre.toLowerCase().trim() === nombre.toLowerCase().trim())) return 'Ya existe un perfil con ese nombre';
    if (Object.keys(perfiles).length >= PerfilManager.MAX_PERFILES) return `Máximo de perfiles alcanzado (${PerfilManager.MAX_PERFILES})`;
    return null;
}

function crearPerfilDesdeSelector() {
    const input = document.getElementById('nombre-nuevo-perfil-selector');
    if (!input) return;
    const nombre = S.sanitizeString(input.value.trim(), 30);
    const perfiles = _obtenerTodosPerfilesSafe();

    const error = _validarNombrePerfil(nombre, perfiles);
    if (error) { mostrarToast(error, 'error'); return; }

    const id = 'perfil_' + S.generarIDSeguro();
    perfiles[id] = { nombre, registros: [], diasHabiles: [1, 2, 3, 4, 5], horasDiarias: 7 };

    if (!_guardarPerfilesConManejo(perfiles)) { delete perfiles[id]; return; }

    if (PerfilManager) PerfilManager.inicializar();
    mostrarToast(`Perfil "${nombre}" creado`, 'success');
    input.value = '';
    renderizarListaPerfiles(true);
    requestAnimationFrame(() => {
        const ultimo = document.getElementById('lista-perfiles-botones')?.lastElementChild;
        if (ultimo) { ultimo.classList.add('add-perfil'); _scrollA(ultimo); }
    });
}

function cerrarSelectorPerfiles() {
    ModalManager.cerrar('modal-selector-perfiles');
}

function abrirEditorPerfil(perfilId) {
    perfilEnEdicion = perfilId;
    const perfiles = _obtenerTodosPerfilesSafe();
    const perfil = perfiles[perfilId];

    if (!perfil) {
        mostrarToast('Perfil no encontrado', 'error');
        return;
    }

    document.getElementById('nombre-perfil-editar').value = perfil.nombre;

    const btnEliminar = document.getElementById('btn-eliminar-perfil-editor');
    if (btnEliminar) {
        btnEliminar.disabled = (perfilId === 'default');
    }

    ModalManager.alternar('modal-selector-perfiles', 'modal-editar-perfil');
}

function cerrarEditorPerfil() {
    perfilEnEdicion = null;
    ModalManager.alternar('modal-editar-perfil', 'modal-selector-perfiles', null, () => {
        const inputNuevo = document.getElementById('nombre-nuevo-perfil-selector');
        if (inputNuevo) inputNuevo.value = '';
        renderizarListaPerfiles();
        const btnEliminar = document.getElementById('btn-eliminar-perfil-editor');
        if (btnEliminar) btnEliminar.disabled = true;
    });
}

function _validarNombrePerfilEdicion(nuevoNombre, perfiles, excluirId) {
    if (!nuevoNombre) return 'Ingresá un nombre válido';
    if (!REGEX_NOMBRE_PERFIL.test(nuevoNombre)) return 'Caracteres no permitidos en el nombre.';
    if (!perfiles[excluirId]) return 'Perfil no encontrado';
    const norm = nuevoNombre.toLowerCase().trim();
    if (Object.entries(perfiles).some(([id, p]) => id !== excluirId && p.nombre.toLowerCase().trim() === norm)) return 'Ya existe otro perfil con ese nombre';
    return null;
}

function guardarEdicionPerfil() {
    if (!perfilEnEdicion) return;
    const nuevoNombre = S.sanitizeString(document.getElementById('nombre-perfil-editar').value.trim(), 30);
    const perfiles = _obtenerTodosPerfilesSafe();

    const error = _validarNombrePerfilEdicion(nuevoNombre, perfiles, perfilEnEdicion);
    if (error) { mostrarToast(error, 'error'); return; }

    if (perfiles[perfilEnEdicion].nombre === nuevoNombre) {
        mostrarToast('Sin cambios', 'info'); cerrarEditorPerfil(); return;
    }

    const nombreAnterior = perfiles[perfilEnEdicion].nombre;
    perfiles[perfilEnEdicion].nombre = nuevoNombre;
    if (!_guardarPerfilesConManejo(perfiles)) { perfiles[perfilEnEdicion].nombre = nombreAnterior; return; }

    if (perfilEnEdicion === PerfilManager?.obtenerPerfilActual()) {
        const btnTexto = document.getElementById('nombre-perfil-header');
        if (btnTexto) btnTexto.textContent = nuevoNombre;
    }
    if (PerfilManager) PerfilManager.inicializar();
    mostrarToast('Perfil actualizado', 'success');
    cerrarEditorPerfil();
}

function _limpiarClavesPerfil(pid) {
    ['breakStartTime', STORAGE_KEYS.HISTORY, STORAGE_KEYS.FONDO_CARD, STORAGE_KEYS.IGNORAR_TF, STORAGE_KEYS.IGNORAR_LOGICA_CUBIERTO, STORAGE_KEYS.IGNORAR_OBJETIVO_POR_REGISTRO,
        'cardVisible_registrar', 'cardVisible_estadisticas', 'cardVisible_historico', STORAGE_KEYS.ORDEN_CARDS,
        STORAGE_KEYS.PUSH_HABILITADO, STORAGE_KEYS.PUSH_ANTICIPACION_MIN, STORAGE_KEYS.PUSH_USAR_BUFFER_SEMANAL, STORAGE_KEYS.PUSH_BUFFER_SOLO_ULTIMO_DIA, STORAGE_KEYS.PUSH_INFO_ACTIVA, STORAGE_KEYS.PUSH_AVISOS_RESTANTES
    ].forEach(k => StorageHelper.removeItem(`${k}_${pid}`));
}

async function eliminarPerfilDesdeEditor() {
    if (!perfilEnEdicion || perfilEnEdicion === 'default') {
        mostrarToast('No se puede eliminar el perfil Principal', 'error'); return;
    }
    const perfiles = _obtenerTodosPerfilesSafe();
    const perfil = perfiles[perfilEnEdicion];
    if (!perfil) { mostrarToast('Perfil no encontrado', 'error'); return; }

    const tieneRegistros = Array.isArray(perfil.registros) && perfil.registros.length > 0;
    if (tieneRegistros) {
        if (!await ModalManager.confirmar(`¿Estás seguro de que querés eliminar el perfil "${perfil.nombre}"? Esta acción no se puede deshacer.`, 'Eliminar')) return;
    }

    PushReminder.cancelarFinDeJornada(TimeUtils.obtenerFechaHoy(), perfilEnEdicion);
    _limpiarClavesPerfil(perfilEnEdicion);
    delete perfiles[perfilEnEdicion];
    if (!_guardarPerfilesConManejo(perfiles, 'Error al eliminar perfil:')) return;

    if (perfilEnEdicion === PerfilManager?.obtenerPerfilActual()) {
        try {
            if (!StorageHelper.setItem(STORAGE_KEYS.PERFIL_ACTIVO, 'default')) throw new Error('quota');
        } catch (e) {
            console.error('Error al guardar perfil activo:', e); mostrarToast('Error al guardar: almacenamiento lleno', 'error'); return;
        }
        mostrarToast('Perfil eliminado. Recargando...', 'success');
        setTimeout(() => location.reload(), 1000);
    } else {
        PerfilManager?.inicializar();
        mostrarToast('Perfil eliminado', 'success');
        cerrarEditorPerfil();
    }
}

function bindEventos() {
    document.querySelector('.header-profile-btn')?.addEventListener('click', () => abrirSelectorPerfiles());

    document.querySelector('#modal-selector-perfiles .btn-cancel')?.addEventListener('click', () => cerrarSelectorPerfiles());
    $('btn-crear-perfil')?.addEventListener('click', () => crearPerfilDesdeSelector());

    document.querySelector('#modal-editar-perfil .btn-edit')?.addEventListener('click', () => guardarEdicionPerfil());
    $('btn-eliminar-perfil-editor')?.addEventListener('click', () => eliminarPerfilDesdeEditor());
    document.querySelector('#modal-editar-perfil .btn-cancel')?.addEventListener('click', () => cerrarEditorPerfil());

}

export const UIPerfiles = {
    bindEventos,
    renderizarListaPerfiles,
    abrirSelectorPerfiles,
    crearPerfilDesdeSelector,
    cerrarSelectorPerfiles,
    abrirEditorPerfil,
    cerrarEditorPerfil,
    guardarEdicionPerfil,
    eliminarPerfilDesdeEditor,
    _limpiarClavesPerfil
};
