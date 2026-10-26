import { STORAGE_KEYS } from '../core/constants.js';
import { $ } from '../core/dom.js';
import { TimeUtils } from '../core/time-utils.js';
import { StorageHelper } from '../core/storage.js';
import { PerfilManager } from './perfil-manager.js';
import { HistoryManager } from './history-manager.js';
import { TiposRegistro } from './tipos-registro.js';
import { SecurityAndUtils as S } from '../core/security.js';
import { AppState as D } from './app-state.js';
import { Compensatorios } from './compensatorios.js';

// ====================================================================
//           IMPORT / EXPORT & BACKUP NORMALIZATION MODULE
// ====================================================================
function normalizarRegistrosImportados(rawList, calcularHorasFn) {
    const validarHora = (h) => TimeUtils.validarHora(h) ? S.sanitizeString(h, 5) : null;
    const hoy = TimeUtils.obtenerFechaHoy();
    const descartadosFuturos = rawList.filter(r =>
        S.validarRegistroSeguro(r) && r.fecha > hoy && !TiposRegistro.esRegistroEspecial(r.entrada, r.salida)
    ).length;
    if (descartadosFuturos > 0)
        D._notify().mostrarToast(`${descartadosFuturos} registro${TimeUtils.pluralizar(descartadosFuturos)} normal${descartadosFuturos > 1 ? 'es' : ''} con fecha futura omitido${TimeUtils.pluralizar(descartadosFuturos)}`, 'warning');
    const normalizados = rawList
        .filter(r => S.validarRegistroSeguro(r))
        .filter(r => {
            if (r.fecha <= hoy) return true;
            return TiposRegistro.esRegistroEspecial(r.entrada, r.salida);
        })
        .map(r => ({
            id: (r.id && S.REGEX_PATTERNS.ID.test(r.id)) ? r.id : S.generarIDSeguro(),
            fecha: S.sanitizeString(r.fecha, 10),
            entrada: validarHora(r.entrada), salida: validarHora(r.salida), tiempoFuera: validarHora(r.tiempoFuera),
            horas: Math.max(0, Math.min(24, parseFloat(r.horas) || 0)),
            minutos: Math.max(0, Math.min(59, parseFloat(r.minutos) || 0)),
            total: Math.max(0, Math.min(24, parseFloat(r.total) || 0)),
            credito: validarHora(r.credito),
            notas: (r.notas && typeof r.notas === 'string') ? S.sanitizeString(r.notas, S.SECURITY_LIMITS.MAX_NOTAS_LENGTH) || null : null,
            objetivoHoras: (typeof r.objetivoHoras === 'number' && Number.isFinite(r.objetivoHoras))
                ? Math.max(0, Math.min(24, r.objetivoHoras))
                : undefined,
            referenciaCompensatorio: (typeof r.referenciaCompensatorio === 'string' && TimeUtils.validarFecha(r.referenciaCompensatorio))
                ? r.referenciaCompensatorio
                : undefined,
        }));

    normalizados.forEach(r => {
        if (TiposRegistro.esRegistroEspecial(r.entrada, r.salida)) return;
        D._aplicarCalculoHoras(r, r.entrada, r.salida, r.tiempoFuera || null, r.credito || null, calcularHorasFn);
    });
    return normalizados;
}

async function exportarJSON() {
    const data = {
        registros: D.registros(), diasHabiles: D.diasHabiles(), horasDiarias: D.horasDiarias(), historialDiasHabiles: D.historialDiasHabiles(),
        fecha: TimeUtils.fechaLocalISOFull(), version: S.SECURITY_LIMITS.SCHEMA_VERSION,
        hash: await S.calcularHashSHA256(D.registros()), timestamp: Date.now()
    };
    try {
        const nombreSafe = D._notify().obtenerNombrePerfilSafe();
        const fechaHoy = TimeUtils.fechaLocalISOFull().slice(0, 10);
        D._notify().descargarJSON(data, `Horarios_${nombreSafe}_${fechaHoy}.json`);
        D._notify().mostrarToast('Datos exportados', 'success');
        D._notify().cerrarTodosModales();
    } catch (e) {
        console.error(e);
        D._notify().mostrarToast('Error al exportar', 'error');
    }
}

async function _validarDatosImport(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) { D._notify().mostrarToast('Estructura de archivo inválida', 'error'); return false; }
    if (!data.registros || !Array.isArray(data.registros)) { D._notify().mostrarToast('Archivo inválido o corrupto', 'error'); return false; }
    const allowedRootKeys = ['registros', STORAGE_KEYS.DIAS_HABILES, STORAGE_KEYS.HORAS_DIARIAS, STORAGE_KEYS.HISTORIAL_DIAS_HABILES, 'fecha', 'version', 'hash', 'timestamp', 'rangoExportado'];
    if (Object.keys(data).some(k => !allowedRootKeys.includes(k))) { D._notify().mostrarToast('Archivo con estructura sospechosa', 'error'); return false; }
    if (data.version && data.version > S.SECURITY_LIMITS.SCHEMA_VERSION) {
        D._notify().mostrarToast(`Archivo de versión más nueva (v${data.version}). Algunos datos pueden no importarse correctamente.`, 'warning', 4000);
    }
    if (data.rangoExportado !== undefined) {
        const rangoSafe = S.sanitizeString(String(data.rangoExportado), 100);
        if (!/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s\-:]+$/.test(rangoSafe)) { D._notify().mostrarToast('Metadatos de rango inválidos', 'error'); return false; }
    }
    if (data.hash) {
        if (await S.calcularHashSHA256(data.registros) !== data.hash) {
            D._notify().mostrarToast('⚠️ El archivo puede estar corrupto o modificado', 'warning');
            if (!(await D._notify().confirmarModal('El hash de integridad no coincide. ¿Restaurar de todas formas?', 'Restaurar', '#icon-upload'))) return false;
        }
    } else {
        if (!(await D._notify().confirmarModal('Este archivo no tiene verificación de integridad. ¿Restaurar de todas formas?', 'Restaurar', '#icon-upload'))) return false;
    }
    if (data.registros.length > S.SECURITY_LIMITS.MAX_REGISTROS) { D._notify().mostrarToast(`Máximo ${S.SECURITY_LIMITS.MAX_REGISTROS} registros permitidos`, 'error'); return false; }
    return true;
}

function _aplicarMergeImport(registrosImportados) {
    const fechasExistentes = new Set(D.registros().map(r => r.fecha));
    const nuevos = registrosImportados.filter(imp => !fechasExistentes.has(imp.fecha));
    const complementarios = registrosImportados.filter(imp => {
        if (!fechasExistentes.has(imp.fecha)) return false;
        const local = D.registroPorFecha(imp.fecha);
        return local && ((!local.salida && imp.salida) || (!local.tiempoFuera && imp.tiempoFuera));
    });
    if (nuevos.length === 0 && complementarios.length === 0) { D._notify().mostrarToast('No hay días nuevos ni datos para completar', 'info'); return; }
    if (!D._hayEspacioParaRegistros(nuevos.length)) { D._notify().mostrarToast(`Límite alcanzado. Solo se pueden agregar ${S.SECURITY_LIMITS.MAX_REGISTROS - D.registros().length} registros más`, 'error'); return; }
    complementarios.forEach(imp => {
        const local = D.registroPorFecha(imp.fecha);
        if (!local) return;
        if (!local.salida && imp.salida) local.salida = imp.salida;
        if (!local.tiempoFuera && imp.tiempoFuera) local.tiempoFuera = imp.tiempoFuera;
        D._recalcularHorasSiValido(local);
    });
    D._setRegistros(D.registros().concat(nuevos));
    const partes = [];
    const p = (n, sustantivo, adjetivo) => `${n} ${sustantivo}${TimeUtils.pluralizar(n)} ${adjetivo}${TimeUtils.pluralizar(n)}`;
    if (nuevos.length > 0) partes.push(p(nuevos.length, 'día', 'nuevo'));
    if (complementarios.length > 0) partes.push(p(complementarios.length, 'registro', 'completado'));
    finalizarImportacionAndSave(`Combinado: ${partes.join(', ')}`, 'combinar datos importados');
}

function importarDatos(modo = 'replace') {
    const fileInput = $('file-import');
    const file = fileInput.files[0];
    if (!file) { D._notify().mostrarToast('Seleccioná un archivo primero', 'error'); return; }
    if (file.size > S.SECURITY_LIMITS.MAX_JSON_SIZE) { D._notify().mostrarToast('Archivo muy grande', 'error'); return; }
    if (!file.type || file.type !== 'application/json') { D._notify().mostrarToast('Solo se permiten archivos JSON', 'error'); return; }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const contenido = e.target.result;
            if (!contenido || contenido.trim().length === 0) { D._notify().mostrarToast('Archivo vacío', 'error'); return; }
            if (contenido.length > S.SECURITY_LIMITS.MAX_JSON_SIZE) { D._notify().mostrarToast('Contenido del archivo demasiado grande', 'error'); return; }

            const data = JSON.parse(contenido, S.reviverJSONSeguro);
            if (!await _validarDatosImport(data)) return;

            const registrosImportados = normalizarRegistrosImportados(data.registros, D.calcularHoras);
            if (registrosImportados.length === 0) { D._notify().mostrarToast('No se encontraron registros válidos', 'warning'); return; }

            if (modo === 'replace') {
                D._setRegistros(registrosImportados);
                if (Array.isArray(data.diasHabiles)) {
                    const diasValidos = data.diasHabiles.filter(d => Number.isInteger(d) && d >= 0 && d <= 6);
                    if (diasValidos.length > 0) D.setDiasHabiles(diasValidos);
                }
                if (data.horasDiarias !== undefined) {
                    const h = typeof data.horasDiarias === 'string' ? parseFloat(data.horasDiarias) : data.horasDiarias;
                    if (Number.isFinite(h) && h >= 0 && h <= 24) D.setHorasDiarias(h);
                }
                const historialImportado = Compensatorios._sanitizarHistorialDiasHabiles(data.historialDiasHabiles);
                D._setHistorialDiasHabilesRaw(historialImportado || [{ desde: '0001-01-01', dias: D.diasHabiles() }]);
                D.setDiasHabiles(Compensatorios.diasHabilesEnFecha(TimeUtils.obtenerFechaHoy()));
                const n = registrosImportados.length;
                finalizarImportacionAndSave(`Se reemplazaron los datos por ${n === 1 ? '1 registro' : `${n} registros`}`, 'restauración local');
            } else if (modo === 'merge') {
                _aplicarMergeImport(registrosImportados);
            }
        } catch (err) {
            console.error('Error en importación:', err);
            D._notify().mostrarToast(err instanceof SyntaxError ? 'Archivo JSON mal formado' : 'Error al procesar el archivo', 'error');
        }
    };
    reader.onerror = () => { D._notify().mostrarToast('Error al leer el archivo', 'error'); };
    reader.readAsText(file);
}

async function finalizarImportacionAndSave(mensajeExito, descripcion = null) {
    D._ordenarRegistros();
    Compensatorios.migrarObjetivoHorasFaltante();
    D.sincronizarPushHoy();
    HistoryManager.saveState(D.registros(), descripcion || mensajeExito);
    if (await D.guardarYActualizar()) {
        const esPerfilDefault = PerfilManager && PerfilManager.esPerfilDefault();
        if (esPerfilDefault) {
            StorageHelper.setItem(STORAGE_KEYS.DIAS_HABILES, D.diasHabiles());
            StorageHelper.setItem(STORAGE_KEYS.HORAS_DIARIAS, D.horasDiarias());
            StorageHelper.setItem(STORAGE_KEYS.HISTORIAL_DIAS_HABILES, D.historialDiasHabiles());
        }
        D._notify().mostrarToast(mensajeExito, 'success');
        D._notify().cerrarImportar();
        $('file-import').value = '';
        D._notify().refrescarConfigSiVisible();
    }
}

export const ImportExportData = {
    normalizarRegistrosImportados,
    exportarJSON,
    _validarDatosImport,
    _aplicarMergeImport,
    importarDatos,
    finalizarImportacionAndSave
};
