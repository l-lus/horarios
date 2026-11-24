import { bytesABase64Url } from '../core/codificacion.js';

// ====================================================================
// OAUTH 2.0 CON PKCE — state, code_verifier y code_challenge (RFC 7636)
// ====================================================================
// Sin DOM ni almacenamiento: solo números al azar y SHA-256. `crypto` se puede inyectar para los tests.

const VERIFICADOR_REGEX = /^[A-Za-z0-9._~-]{43,128}$/;

const base64Url = bytesABase64Url;

/** Texto al azar en base64url de `n` bytes (32 bytes → 43 caracteres). */
function aleatorio(n = 32, cripto = globalThis.crypto) {
    return base64Url(cripto.getRandomValues(new Uint8Array(n)));
}

/** El code_challenge S256 de un code_verifier. */
async function desafioS256(verificador, cripto = globalThis.crypto) {
    const digest = await cripto.subtle.digest('SHA-256', new TextEncoder().encode(verificador));
    return base64Url(new Uint8Array(digest));
}

/**
 * Un pedido de autorización nuevo: el state (contra CSRF en el retorno), el code_verifier (queda en el dispositivo)
 * y el code_challenge (viaja a Google).
 * @returns {Promise<{ state: string, verificador: string, desafio: string }>}
 */
async function nuevoPedido(cripto = globalThis.crypto) {
    const verificador = aleatorio(48, cripto);   // 64 caracteres
    return { state: aleatorio(32, cripto), verificador, desafio: await desafioS256(verificador, cripto) };
}

function esVerificadorValido(v) { return typeof v === 'string' && VERIFICADOR_REGEX.test(v); }

export const OAuthPKCE = { aleatorio, desafioS256, nuevoPedido, esVerificadorValido, base64Url };
