import { $, alternarVisibilidadClave } from '../core/dom.js';
import { GestorModales } from './gestor-modales.js';

// ====================================================================
// PEDIR LA FRASE — cuando un archivo o un Gist cifrado no se abre con la frase guardada (o no hay ninguna)
// ====================================================================
// Usa el circuito de GestorModales.preguntar (el mismo de confirmar): se abre sobre el modal que esté a la vista y al terminar vuelve a él.
// Qué se hace con la frase escrita lo decide quien la pide (al importar un archivo vale solo para ese archivo).
const ID_MODAL = 'modal-frase';
const ESPERA_FOCO_MS = 150;

/**
 * Abre el modal y devuelve la frase escrita, o null si se cancela.
 * @param {string} motivo qué se le explica a la persona (por ejemplo «La frase no abre este archivo»)
 * @returns {Promise<string | null>}
 */
function pedir(motivo) {
    const campo = $('frase-pedida');
    const btnOk = $('btn-frase-aceptar');
    const btnCancel = $('btn-frase-cancelar');
    if (!campo || !btnOk || !btnCancel) return Promise.resolve(null);

    return GestorModales.preguntar(ID_MODAL, (/** @type {(valor: string | null) => void} */ responder) => {
        const elMotivo = $('modal-frase-motivo');
        if (elMotivo) elMotivo.textContent = motivo;
        campo.value = '';
        campo.type = 'password';

        const aceptar = () => { if (campo.value.trim()) responder(campo.value); };
        const cancelar = () => responder(null);
        /** @param {KeyboardEvent} e */
        const alTeclear = (e) => { if (e.key === 'Enter') aceptar(); };
        btnOk.addEventListener('click', aceptar);
        btnCancel.addEventListener('click', cancelar);
        campo.addEventListener('keydown', alTeclear);
        setTimeout(() => campo.focus(), ESPERA_FOCO_MS);
        return () => {
            btnOk.removeEventListener('click', aceptar);
            btnCancel.removeEventListener('click', cancelar);
            campo.removeEventListener('keydown', alTeclear);
            campo.value = '';   // la frase no queda escrita en el campo
        };
    }, null);
}

function bindEventos() {
    // Atrás o tocar fuera del modal equivalen a cancelar
    GestorModales.registrarAccionVolver(ID_MODAL, () => $('btn-frase-cancelar')?.click());
    $('btn-frase-pedida-ver')?.addEventListener('click', () => alternarVisibilidadClave($('frase-pedida')));
}

export const FraseModal = { pedir, bindEventos };
