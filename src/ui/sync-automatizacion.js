import { $ } from '../core/dom.js';
import { TiempoUtils } from '../core/tiempo-utils.js';
import { UIBase } from './base.js';
import { setIconoBtn } from './boton-fichar.js';
import { _crearPressHold } from './gestos.js';
import { Animaciones } from './animaciones.js';
import { mostrarToast } from './toast.js';

// ====================================================================
// AUTOMATIZACIÓN DE LA SINCRONIZACIÓN — la sección «Sincronización automática» del modal de respaldo (centro-respaldo.js)
// ====================================================================
// Sincronización automática (manual / restaurar / respaldar al abrir la app), comportamiento al bajar, límites por hora y
// franja horaria. Es una sola por perfil y corre con el destino principal. Todo se guarda en vivo, al tocar cada control (el rango
// horario, al salir del campo y solo si es válido). Los ids llevan el prefijo dado: btn-toggle-sync-backup, sync-rango-desde, …
const { _setBtnDisabled, _setBtnActivo } = UIBase;
const { _animarValor } = Animaciones;

/**
 * @typedef {{
 *   getAutoSync: () => number, setAutoSync: (v: number) => void, getMergeBehavior: () => string, setMergeBehavior: (v: string) => void,
 *   getSyncLimite: (tipo: string) => number, setSyncLimite: (tipo: string, v: number) => void,
 *   getRangoHorario: () => { desde: string, hasta: string }, setRangoHorario: (desde: string, hasta: string) => void,
 *   RANGO_HORARIO_DEFAULT: { desde: string, hasta: string }
 * }} ConfigProveedor
 */

/**
 * @param {{ prefijo: string, servicio: ConfigProveedor, nombre: () => string, alCambiar?: () => void }} opciones
 *   nombre: el del destino principal ('Gist' o 'Drive'), para las pistas; alCambiar: se cambió el modo
 */
function crear({ prefijo, servicio, nombre, alCambiar = () => { } }) {
    const id = (patron) => patron.replace('{p}', prefijo);
    let _habilitado = false;

    function estadoActual() { return servicio.getAutoSync(); }
    function _tipoSyncActual() {
        const estado = estadoActual();
        return estado === 1 ? 'bajar' : estado === 2 ? 'subir' : null;
    }

    function actualizarResumen() {
        const el = $(id('{p}-limites-resumen'));
        if (!el) return;
        const tipo = _tipoSyncActual();
        if (!tipo) { el.textContent = 'Desactivado'; return; }
        const limite = servicio.getSyncLimite(tipo);
        const desde = $(id('{p}-rango-desde'))?.value || '--:--';
        const hasta = $(id('{p}-rango-hasta'))?.value || '--:--';
        el.textContent = `${limite === 0 ? 'Sin límite' : `${limite} por hora`} · ${desde} – ${hasta}`;
    }

    /** Habilita o no los controles según el destino principal sea un servicio listo para sincronizar. */
    function setHabilitado(conectado) {
        _habilitado = conectado;
        _setBtnDisabled(id('btn-toggle-{p}-backup'), !conectado);
        _setBtnDisabled(id('btn-toggle-{p}-merge'), !(conectado && estadoActual() === 1));
        actualizarBotonBackup();
        actualizarBotonMerge();
        actualizarResumen();
    }

    function actualizarBotonMerge() {
        const hint = $(id('hint-{p}-merge'));
        const iconEl = $(id('icon-{p}-merge'));
        const esMerge = servicio.getMergeBehavior() === 'merge';
        if (hint) hint.textContent = esMerge ? 'Combinar' : 'Reemplazar';
        const desc = $(id('desc-{p}-merge'));
        if (desc) desc.textContent = esMerge ? ' · une lo bajado con tus datos locales' : ' · sustituye tus datos locales';
        if (iconEl) setIconoBtn(iconEl, esMerge ? '#icon-combine' : '#icon-replace-swap');
    }

    function toggleMerge() {
        servicio.setMergeBehavior(servicio.getMergeBehavior() === 'merge' ? 'replace' : 'merge');
        actualizarBotonMerge();
    }

    function actualizarBotonBackup() {
        const btn = $(id('btn-toggle-{p}-backup'));
        const hint = $(id('hint-{p}-backup'));
        const label = $(id('label-{p}-backup'));
        const rangoEl = $(id('{p}-rango-horario'));
        const estado = estadoActual();
        if (!btn) return;

        const configs = [
            { texto: 'Sin automatizar', hint: ' · solo sincronizás de forma manual', activo: false },
            { texto: 'Restaurar', hint: ` · baja tus datos de ${nombre()} al abrir la app`, activo: true },
            { texto: 'Respaldar', hint: ` · sube tus datos a ${nombre()} al abrir la app`, activo: true }
        ];
        const c = configs[estado];
        _setBtnActivo(btn.id, c.activo);
        if (label) label.textContent = c.texto;
        if (hint) hint.textContent = _habilitado ? c.hint : ' · necesita Gist o Drive conectado como destino principal';
        rangoEl?.classList.toggle('disabled', !(estado === 1 || estado === 2));
    }

    function _actualizarCampoLimite(dir = 0) {
        const tipo = _tipoSyncActual();
        const contenedor = $(id('{p}-limite-sync'));
        if (!contenedor) return;
        if (!tipo) {
            contenedor.classList.add('disabled');
            actualizarResumen();
            return;
        }
        const limite = servicio.getSyncLimite(tipo);
        const input = $(id('{p}-limite-valor'));
        const label = $(id('{p}-limite-label'));
        if (input) _animarValor(input, limite, dir);
        if (label) label.textContent = tipo === 'bajar' ? 'Límite bajadas por hora (0 = sin límite)' : 'Límite subidas por hora (0 = sin límite)';
        contenedor.classList.remove('disabled');
        actualizarResumen();
    }

    function toggleBackup() {
        servicio.setAutoSync((estadoActual() + 1) % 3);
        actualizarBotonBackup();
        alCambiar();
        _actualizarCampoLimite();
    }

    function cambiarLimite(delta) {
        const tipo = _tipoSyncActual();
        if (!tipo) return;
        const previo = servicio.getSyncLimite(tipo);
        const nuevo = Math.max(0, Math.min(99, previo + delta));
        if (nuevo === previo) return;
        servicio.setSyncLimite(tipo, nuevo);
        _actualizarCampoLimite(Math.sign(nuevo - previo));
    }

    const pressHoldLimite = _crearPressHold(delta => cambiarLimite(delta));

    /** Al abrir el modal: los controles con lo guardado. */
    function cargar() {
        const rango = servicio.getRangoHorario();
        const desdeEl = $(id('{p}-rango-desde'));
        const hastaEl = $(id('{p}-rango-hasta'));
        if (desdeEl) desdeEl.value = rango.desde;
        if (hastaEl) hastaEl.value = rango.hasta;
        actualizarBotonBackup();
        actualizarBotonMerge();
        _actualizarCampoLimite();
    }

    function leerRango() {
        const desdeRaw = $(id('{p}-rango-desde'))?.value || '';
        const hastaRaw = $(id('{p}-rango-hasta'))?.value || '';
        const desdeValida = !desdeRaw || TiempoUtils.validarHora(desdeRaw);
        const hastaValida = !hastaRaw || TiempoUtils.validarHora(hastaRaw);
        return {
            desde: desdeRaw || servicio.RANGO_HORARIO_DEFAULT.desde,
            hasta: hastaRaw || servicio.RANGO_HORARIO_DEFAULT.hasta,
            desdeInvalida: desdeRaw !== '' && !desdeValida,
            hastaInvalida: hastaRaw !== '' && !hastaValida,
            valida: desdeValida && hastaValida
        };
    }

    /** Guarda el rango horario si es válido; si no, avisa y deja lo guardado. */
    function _guardarRango() {
        const { desde, hasta, desdeInvalida, valida } = leerRango();
        if (!valida) {
            mostrarToast(desdeInvalida ? 'Hora inicial inválida.' : 'Hora final inválida.', 'error');
            return;
        }
        servicio.setRangoHorario(desde, hasta);
        alCambiar();
    }

    function bindEventos() {
        $(id('btn-toggle-{p}-backup'))?.addEventListener('click', () => toggleBackup());
        $(id('btn-toggle-{p}-merge'))?.addEventListener('click', () => toggleMerge());
        const btnDec = $(id('btn-{p}-limite-dec'));
        const btnInc = $(id('btn-{p}-limite-inc'));
        if (btnDec) pressHoldLimite.vincular(btnDec, -1);
        if (btnInc) pressHoldLimite.vincular(btnInc, 1);
        [id('{p}-rango-desde'), id('{p}-rango-hasta')].forEach(i => {
            $(i)?.addEventListener('input', () => actualizarResumen());
            $(i)?.addEventListener('change', () => _guardarRango());
        });
    }

    return { estadoActual, setHabilitado, actualizarResumen, cargar, leerRango, bindEventos };
}

export const SyncAutomatizacion = { crear };
