import { STORAGE_KEYS } from './constantes.js';
import { Almacenamiento } from './almacenamiento.js';

// ====================================================================
// PREFERENCIAS BOOLEANAS (clave, valor por defecto y si van por perfil, en un solo lugar)
// ====================================================================
const _pref = (clave, porDefecto, porPerfil = false) => Object.freeze({
    clave,
    get: () => Almacenamiento.getBoolean(clave, porDefecto, porPerfil),
    /** @param {boolean} valor */
    set: (valor) => Almacenamiento.setItem(clave, valor, porPerfil),
});

/** Si el perfil todavía no tiene el valor y queda el de antes (de toda la instalación), lo pasa al perfil y lo devuelve; si no, null. */
function _moverAPerfil(clave) {
    if (Almacenamiento.getItem(clave, null, true) !== null) return null;
    const anterior = Almacenamiento.getItem(clave, null, false);
    if (anterior === null) return null;
    const valor = anterior === 'true';
    Almacenamiento.setItem(clave, valor, true);
    Almacenamiento.removeItem(clave, false);
    return valor;
}

/** Preferencia por perfil que antes era de la instalación: al leerla se migra el valor viejo. */
const _prefMovidaAPerfil = (clave, porDefecto) => {
    const pref = _pref(clave, porDefecto, true);
    return Object.freeze({ ...pref, get: () => _moverAPerfil(clave) ?? pref.get() });
};

export const Preferencias = Object.freeze({
    // Por perfil
    IGNORAR_TF: _pref(STORAGE_KEYS.IGNORAR_TF, false, true),
    IGNORAR_LOGICA_CUBIERTO: _pref(STORAGE_KEYS.IGNORAR_LOGICA_CUBIERTO, false, true),
    IGNORAR_OBJETIVO_POR_REGISTRO: _pref(STORAGE_KEYS.IGNORAR_OBJETIVO_POR_REGISTRO, false, true),
    // Por perfil, antes de la instalación (aviso de fin de jornada)
    PUSH_HABILITADO: _prefMovidaAPerfil(STORAGE_KEYS.PUSH_HABILITADO, false),
    PUSH_USAR_BUFFER_SEMANAL: _prefMovidaAPerfil(STORAGE_KEYS.PUSH_USAR_BUFFER_SEMANAL, false),
    PUSH_BUFFER_SOLO_ULTIMO_DIA: _prefMovidaAPerfil(STORAGE_KEYS.PUSH_BUFFER_SOLO_ULTIMO_DIA, false),
    // De la instalación
    HINT_INTEGRADO: _pref(STORAGE_KEYS.HINT_INTEGRADO, false),
    DESC_HITOS_NUMERO: _pref(STORAGE_KEYS.DESC_HITOS_NUMERO, true),
    CICLO_HINT_AUTO: _pref(STORAGE_KEYS.CICLO_HINT_AUTO, true),
    RUEDA_CALENDARIO: _pref(STORAGE_KEYS.RUEDA_CALENDARIO, true),
    PERSISTIR_TARJETAS: _pref(STORAGE_KEYS.PERSISTIR_TARJETAS, true),
    STATS_HABILITADO: _pref(STORAGE_KEYS.STATS_HABILITADO, true),
    FORMATO_CORTO_STATS: _pref(STORAGE_KEYS.FORMATO_CORTO_STATS, false),
    HOVER_POPUP: _pref(STORAGE_KEYS.HOVER_POPUP, false),
});
