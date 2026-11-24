// ====================================================================
// CODIFICACIÓN DE BYTES Y VALORES AL AZAR (sin DOM; `crypto` se puede inyectar para los tests)
// ====================================================================
// base64 (el sobre cifrado), base64url (PKCE y la clave VAPID de Web Push), hex (hashes y tokens) e ids al azar, en un solo lugar.

/** base64 estándar, por tramos: un archivo grande no desborda la pila. @param {Uint8Array} bytes */
export function bytesABase64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, /** @type {any} */ (bytes.subarray(i, i + 0x8000)));
    return btoa(s);
}

/** Bytes de un texto base64 estándar (sin validar: quien lo llama decide qué formato acepta). @param {string} texto */
export function base64ABytes(texto) {
    const s = atob(texto);
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
}

/** base64url sin relleno (RFC 4648 §5). @param {Uint8Array} bytes */
export function bytesABase64Url(bytes) {
    return bytesABase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Bytes de un texto base64url (con o sin relleno). @param {string} texto */
export function base64UrlABytes(texto) {
    const relleno = '='.repeat((4 - texto.length % 4) % 4);
    return base64ABytes((texto + relleno).replace(/-/g, '+').replace(/_/g, '/'));
}

/** @param {Uint8Array} bytes */
export function bytesAHex(bytes) {
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/** `n` bytes al azar en hex (32 bytes → 64 caracteres). */
export function hexAleatorio(n = 32, cripto = globalThis.crypto) {
    return bytesAHex(cripto.getRandomValues(new Uint8Array(n)));
}

/** UUID al azar; sin `crypto.randomUUID` (contexto no seguro), un id con la hora y Math.random precedido de `prefijo`. */
export function uuidAleatorio(prefijo = '', cripto = globalThis.crypto) {
    return cripto?.randomUUID ? cripto.randomUUID() : `${prefijo}${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
