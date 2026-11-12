import { APP_STORAGE_PREFIX } from '../core/constantes.js';
import { Secretos } from '../core/secretos.js';
import { normalizarFrase, evaluarFrase, generarFrase, olvidarClave } from '../core/cifrado.js';

// ====================================================================
// FRASE DE CIFRADO — la frase opcional con la que se cierran el Gist y los respaldos exportados (sin DOM)
// ====================================================================
// Una sola para toda la app (como el token de GitHub). Vive en la sesión y solo se guarda en este navegador si la persona activa «Recordar»
// (core/secretos.js). Nunca va en el respaldo, en un log ni en un mensaje. Si se pierde, lo cifrado con ella no se puede recuperar.
// Sin frase la app funciona como siempre: Gist y archivos en claro.
// La clave no está en STORAGE_KEYS a propósito: así no entra en la migración de claves heredadas ni en ningún respaldo.
const CLAVE = `${APP_STORAGE_PREFIX}fraseCifrado`;

/** La frase guardada ('' si no hay). */
const actual = () => normalizarFrase(Secretos.leer(CLAVE));

/** ¿Hay una frase guardada y válida (con el largo mínimo)? */
const disponible = () => evaluarFrase(actual()).ok;

/** ¿Está guardada de forma permanente en este navegador? */
const recordada = () => Secretos.esRecordado(CLAVE);

/** Guarda la frase (solo para la sesión o, con `recordar`, en este navegador); vacía la olvida. Devuelve false si no se pudo guardar. @param {string} frase @param {boolean} [recordar] */
const guardar = (frase, recordar = false) => {
    if (normalizarFrase(frase) !== actual()) olvidarClave();
    return Secretos.guardar(CLAVE, normalizarFrase(frase), recordar);
};

const olvidar = () => { olvidarClave(); Secretos.olvidar(CLAVE); };

/** Una frase nueva al azar (5 palabras pronunciables, unos 95 bits). */
const generar = () => generarFrase((n) => globalThis.crypto.getRandomValues(new Uint8Array(n)));

export const FraseCifrado = { actual, disponible, recordada, guardar, olvidar, generar, evaluar: evaluarFrase };
