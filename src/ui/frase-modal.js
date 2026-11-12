import { $, alternarVisibilidadClave } from '../core/dom.js';
import { GestorModales } from './gestor-modales.js';

// ====================================================================
// PEDIR LA FRASE — cuando un archivo o un Gist cifrado no se abre con la frase guardada (o no hay ninguna)
// ====================================================================
// Mismo circuito que GestorModales.confirmar: se abre sobre el modal que esté a la vista y al terminar vuelve a él.
// Qué se hace con la frase escrita lo decide quien la pide (al importar un archivo vale solo para ese archivo).
const ID_MODAL = 'modal-frase';
const ESPERA_FOCO_MS = 150;

/**
 * Abre el modal y devuelve la frase escrita, o null si se cancela.
 * @param {string} motivo qué se le explica a la persona (por ejemplo «La frase no abre este archivo»)
 * @returns {Promise<string | null>}
 */
function pedir(motivo) {
    return new Promise((resolve) => {
        const campo = $('frase-pedida');
        const btnOk = $('btn-frase-aceptar');
        const btnCancel = $('btn-frase-cancelar');
        const elMotivo = $('modal-frase-motivo');
        if (!campo || !btnOk || !btnCancel) { resolve(null); return; }

        if (elMotivo) elMotivo.textContent = motivo;
        campo.value = '';
        campo.type = 'password';

        const modalPadreId = document.querySelector('.modal.show')?.id ?? null;

        function quitarEscuchas() {
            btnOk.removeEventListener('click', aceptar);
            btnCancel.removeEventListener('click', cancelar);
            campo.removeEventListener('keydown', alTeclear);
            window.removeEventListener('popstate', alRetroceder);
        }
        /** @param {string | null} valor */
        function terminar(valor) {
            quitarEscuchas();
            campo.value = '';
            if (modalPadreId) GestorModales.alternar(ID_MODAL, modalPadreId);
            else GestorModales.cerrar(ID_MODAL);
            resolve(valor);
        }
        function aceptar() { if (campo.value.trim()) terminar(campo.value); }
        function cancelar() { terminar(null); }
        /** @param {KeyboardEvent} e */
        function alTeclear(e) { if (e.key === 'Enter') aceptar(); }
        function alRetroceder() { quitarEscuchas(); resolve(null); }

        btnOk.addEventListener('click', aceptar);
        btnCancel.addEventListener('click', cancelar);
        campo.addEventListener('keydown', alTeclear);
        window.addEventListener('popstate', alRetroceder, { once: true });

        if (modalPadreId) GestorModales.alternar(modalPadreId, ID_MODAL);
        else GestorModales.abrir(ID_MODAL);
        setTimeout(() => campo.focus(), ESPERA_FOCO_MS);
    });
}

function bindEventos() {
    // Atrás o tocar fuera del modal equivalen a cancelar
    GestorModales.registrarAccionVolver(ID_MODAL, () => $('btn-frase-cancelar')?.click());
    $('btn-frase-pedida-ver')?.addEventListener('click', () => alternarVisibilidadClave($('frase-pedida')));
}

export const FraseModal = { pedir, bindEventos };
