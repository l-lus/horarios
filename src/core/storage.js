import { SecurityAndUtils } from './security.js';

// ====================================================================
// STORAGE HELPER MODULE
// ====================================================================
let notify = { mostrarToast: () => { } };
let _profileKeyResolver = (key) => `${key}_default`;

function configurarNotificaciones(handlers) { notify = { ...notify, ...handlers }; }
function setProfileKeyResolver(fn) {
    if (typeof fn === 'function') _profileKeyResolver = fn;
}

function _getKey(key, useProfile) {
    return useProfile ? _profileKeyResolver(key) : key;
}

function setItem(key, value, useProfile = false) {
    try {
        const finalKey = _getKey(key, useProfile);
        const valueToStore = typeof value === 'object' ? JSON.stringify(value) : String(value);
        localStorage.setItem(finalKey, valueToStore);
        return true;
    } catch (e) {
        console.error(`Error guardando en Storage (${key}):`, e);
        if (e.name === 'QuotaExceededError' || e.code === 22) {
            notify.mostrarToast('Almacenamiento lleno, no se pudo guardar', 'error');
        }
        return false;
    }
}

function getItem(key, defaultValue = null, useProfile = false) {
    try {
        const value = localStorage.getItem(_getKey(key, useProfile));
        return value !== null ? value : defaultValue;
    } catch (e) {
        return defaultValue;
    }
}

function getBoolean(key, defaultValue = false, useProfile = false) {
    const val = getItem(key, null, useProfile);
    if (val === null) return defaultValue;
    return val === 'true';
}

function getNumber(key, defaultValue = 0, useProfile = false) {
    const val = getItem(key, null, useProfile);
    if (val === null) return defaultValue;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? defaultValue : parsed;
}

function getObject(key, defaultValue = null, useProfile = false) {
    const val = getItem(key, null, useProfile);
    if (!val) return defaultValue;
    try {
        return JSON.parse(val, SecurityAndUtils.reviverJSONSeguro);
    } catch (e) {
        return defaultValue;
    }
}

function removeItem(key, useProfile = false) {
    try {
        localStorage.removeItem(_getKey(key, useProfile));
    } catch (e) { }
}

export const StorageHelper = {
    setItem,
    getItem,
    getBoolean,
    getNumber,
    getObject,
    removeItem,
    configurarNotificaciones,
    setProfileKeyResolver
};
