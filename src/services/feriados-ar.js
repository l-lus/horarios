import { STORAGE_KEYS } from '../core/constants.js';
import { FERIADOS_AR } from '../data/feriados.js';
import { TimeUtils } from '../core/time-utils.js';
import { SecurityAndUtils } from '../core/security.js';
import { StorageHelper } from '../core/storage.js';
import { DataManagement } from './data-management.js';

// ====================================================================
// HOLIDAYS MODULE
// ====================================================================
const SK_PROCESADOS = STORAGE_KEYS.FERIADOS_PROCESADOS;
const FERIADOS = FERIADOS_AR || {};

function _cargarProcesados() {
    const raw = StorageHelper.getItem(SK_PROCESADOS, null, true);
    try {
        if (!raw) return new Set();
        const parsed = JSON.parse(raw, SecurityAndUtils.reviverJSONSeguro);
        if (!Array.isArray(parsed)) return new Set();
        return new Set(parsed.filter(f => typeof f === 'string' && TimeUtils.validarFecha(f)));
    } catch { return new Set(); }
}

function _marcarProcesado(fecha) {
    const set = _cargarProcesados();
    set.add(fecha);
    const limite = new Date();
    limite.setDate(limite.getDate() - 60);
    const limiteStr = TimeUtils.formatearFechaLocal(limite);
    set.forEach(f => { if (f < limiteStr) set.delete(f); });
    StorageHelper.setItem(SK_PROCESADOS, JSON.stringify([...set]), true);
}

function _getFeriadosDelMes() {
    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const mesActual = TimeUtils._pad2(hoy.getMonth() + 1);
    const prefijoMes = `${anioActual}-${mesActual}`;
    const pool = FERIADOS[anioActual] || [];
    return { prefijoMes, feriados: pool.filter(f => f.fecha.startsWith(prefijoMes)) };
}

async function chequearYNotificar() {
    const { prefijoMes, feriados: candidatos } = _getFeriadosDelMes();
    if (!candidatos.length) return;

    const procesados = _cargarProcesados();
    const yaExisteRegistro = fecha => DataManagement.existeRegistroEnFecha(fecha);

    const pendientes = candidatos.filter(f => {
        if (procesados.has(f.fecha)) return false;
        if (yaExisteRegistro(f.fecha)) { _marcarProcesado(f.fecha); return false; }
        return true;
    });

    if (!pendientes.length) return;

    while (
        document.querySelector('.modal.show') ||
        document.body.classList.contains('config-onboarding')
    ) {
        await TimeUtils.esperar(2000);
    }

    const nombreMes = TimeUtils.formatoTituloMes(prefijoMes).split(' ')[0];
    const lineas = pendientes.map(f => `🎉 ${TimeUtils.obtenerNombreDia(f.fecha)} ${parseInt(f.fecha.slice(8), 10)} — ${f.nombre}`);
    const pregunta = pendientes.length > 1 ? `¿Querés agregar estos ${pendientes.length} días como Feriado?` : '¿Querés agregar este día como Feriado?';
    const texto = `${lineas.join('\n')}\n\n${pregunta}`;

    const confirmo = await DataManagement._notify().confirmarModal(texto, 'Sí', '#icon-check', {
        titulo: pendientes.length > 1 ? `Feriados de ${nombreMes}` : `Feriado de ${nombreMes}`,
        labelCancel: 'No'
    });

    pendientes.forEach(f => _marcarProcesado(f.fecha));

    if (confirmo) {
        for (const feriado of pendientes) {
            try { await DataManagement.registrarDiaEspecial(feriado.fecha, 'feriado'); } catch (e) { console.error('Error registrando feriado:', e); }
        }
    }
}

export const FeriadosAR = { chequearYNotificar };
