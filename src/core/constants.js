// ====================================================================
// STORAGE KEYS — MODULE
// ====================================================================
export const STORAGE_KEYS = Object.freeze({
    TEMA_OSCURO: 'temaOscuro',
    VISTA_ACTUAL: 'vistaActual',
    MODO_ESTADISTICAS: 'modoEstadisticas',
    HOVER_POPUP: 'hoverPopupCalendario',
    REDUCIR_ANIMACIONES: 'reducirAnimaciones',
    FORMATO_CORTO_STATS: 'formatoCortoStats',
    DIAS_HABILES: 'diasHabiles',
    HISTORIAL_DIAS_HABILES: 'historialDiasHabiles',
    HORAS_DIARIAS: 'horasDiarias',
    VISTA_HISTORICO_CAL: 'vistaHistoricoCalendario',
    IGNORAR_TF: 'ignorarTiempoFuera',
    IGNORAR_LOGICA_CUBIERTO: 'ignorarLogicaCubierto',
    IGNORAR_OBJETIVO_POR_REGISTRO: 'ignorarObjetivoPorRegistro',
    FONDO_CARD: 'fondoCard',
    PERSISTIR_TARJETAS: 'persistirTarjetas',
    ORDEN_CARDS: 'ordenCards',
    FORMULARIO_EXPANDIDO: 'formularioExpandido',
    STATS_EXPANDIDO: 'statsExpandido',
    HISTORICO_EXPANDIDO: 'historicoExpandido',
    PERFIL_ACTIVO: 'perfilActivo',
    PERFILES: 'perfiles',
    HISTORY: 'history',
    GIST_TOKEN: 'gistToken',
    BIENVENIDA_VISTA: 'bienvenidaVista',
    FERIADOS_PROCESADOS: 'feriadosAR_procesados',
    PUSH_ANTICIPACION_MIN: 'pushAnticipacionMin',
    PUSH_USAR_BUFFER_SEMANAL: 'pushUsarBufferSemanal',
    PUSH_BUFFER_SOLO_ULTIMO_DIA: 'pushBufferSoloUltimoDia',
    PUSH_HABILITADO: 'pushHabilitado',
    PUSH_INFO_ACTIVA: 'pushInfoActiva',
    PUSH_AVISOS_RESTANTES: 'pushAvisosRestantes',

    BREAK_TIME: (perfilId) => `breakStartTime_${perfilId}`,
    GIST_LIMITE: (tipo) => `gistSyncLimite_${tipo}`,
    MES_EXPANDIDO: (clave) => `mes-${clave}-expandido`,
    ANIO_EXPANDIDO: (anioId) => `anio-${anioId}-expandido`,
    CARD_VISIBLE: (cual) => `cardVisible_${cual}`,
});


// ====================================================================
// NUMERIC PRECISION — shared helper
// ====================================================================
export const EPS_HORAS = 1e-6;
export const horasGte = (valor, objetivo) => (valor - objetivo) > -EPS_HORAS;
export const horasEq = (valor, objetivo) => Math.abs(valor - objetivo) < EPS_HORAS;
