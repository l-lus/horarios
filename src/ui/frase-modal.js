import { $, alternarVisibilidadClave } from '../core/dom.js';
import { GestorModales } from './gestor-modales.js';
import { Controles } from './controles.js';

// ====================================================================
// PEDIR LA FRASE — cuando un archivo o un Gist cifrado no se abre con la frase guardada (o no hay ninguna)
// ====================================================================
// Usa el circuito de GestorModales.preguntar (el mismo de confirmar): se abre sobre el modal que esté a la vista y al terminar vuelve a él.
// Qué se hace con la frase escrita y con «Recordar en este navegador» lo decide quien la pide (al importar un archivo, sin «Recordar» vale
// solo para ese archivo).
const ID_MODAL = 'modal-frase';
const ESPERA_FOCO_MS = 150;

/**
 * Abre el modal y devuelve la frase escrita y cómo quedó el interruptor «Recordar», o null si se cancela.
 * @param {string} motivo qué se le explica a la persona (por ejemplo «La frase no abre este archivo»)
 * @param {{ recordar: boolean, detalle: string }} opciones estado inicial del interruptor y qué pasa según se lo active o no
 * @returns {Promise<{ frase: string, recordar: boolean } | null>}
 */
function pedir(motivo, { recordar, detalle }) {
    const campo = $('frase-pedida');
    const btnOk = $('btn-frase-aceptar');
    const btnCancel = $('btn-frase-cancelar');
    const btnRecordar = $('btn-frase-recordar');
    if (!campo || !btnOk || !btnCancel || !btnRecordar) return Promise.resolve(null);

    return GestorModales.preguntar(ID_MODAL, (/** @type {(valor: { frase: string, recordar: boolean } | null) => void} */ responder) => {
        const elMotivo = $('modal-frase-motivo');
        if (elMotivo) elMotivo.textContent = motivo;
        campo.value = '';
        campo.type = 'password';
        const elDetalle = $('frase-recordar-desc');
        if (elDetalle) elDetalle.textContent = detalle;
        const marcar = (/** @type {boolean} */ v) => {
            Controles.setBtnActivo(btnRecordar, v);
            btnRecordar.setAttribute('aria-pressed', String(v));
        };
        marcar(recordar);

        const alternarRecordar = () => marcar(!Controles.esBtnActivo(btnRecordar));
        const aceptar = () => { if (campo.value.trim()) responder({ frase: campo.value, recordar: Controles.esBtnActivo(btnRecordar) }); };
        const cancelar = () => responder(null);
        /** @param {KeyboardEvent} e */
        const alTeclear = (e) => { if (e.key === 'Enter') aceptar(); };
        btnOk.addEventListener('click', aceptar);
        btnCancel.addEventListener('click', cancelar);
        campo.addEventListener('keydown', alTeclear);
        btnRecordar.addEventListener('click', alternarRecordar);
        setTimeout(() => campo.focus(), ESPERA_FOCO_MS);
        return () => {
            btnOk.removeEventListener('click', aceptar);
            btnCancel.removeEventListener('click', cancelar);
            campo.removeEventListener('keydown', alTeclear);
            btnRecordar.removeEventListener('click', alternarRecordar);
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
