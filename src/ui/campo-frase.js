import { $, alternarVisibilidadClave } from '../core/dom.js';
import { FraseCifrado } from '../services/frase-cifrado.js';
import { mostrarToast } from './toast.js';

// ====================================================================
// CAMPO DE FRASE — el bloque «frase de cifrado» que comparten el modal de Gist y el de Respaldar
// ====================================================================
// Cada modal tiene su propio marcado (con sus ids); esta clase le da el comportamiento: mostrar u ocultar la frase, generar una al azar,
// el interruptor «Recordar en este navegador» (solo en Gist) y guardarla validando el largo mínimo.

/** @typedef {{ input: string, ojo?: string, generar?: string, recordar?: string }} IdsCampoFrase */

export class CampoFrase {
    /** @param {IdsCampoFrase} ids @param {() => void} [alCambiar] se llama cuando cambia lo escrito o el interruptor (para refrescar resúmenes) */
    constructor(ids, alCambiar = () => { }) {
        this.ids = ids;
        this.alCambiar = alCambiar;
    }

    /** Conecta los controles del bloque (una sola vez, al iniciar la app). */
    vincular() {
        const { input, ojo, generar, recordar } = this.ids;
        $(input)?.addEventListener('input', () => this.alCambiar());
        if (ojo) $(ojo)?.addEventListener('click', () => this.alternarVisible());
        if (generar) $(generar)?.addEventListener('click', () => this.generar());
        if (recordar) $(recordar)?.addEventListener('click', () => { $(recordar)?.classList.toggle('btn-activo'); this.alCambiar(); });
    }

    /** Lo que muestra el campo al abrir el modal: la frase guardada (oculta) y el interruptor según esté recordada. */
    cargar() {
        const campo = $(this.ids.input);
        if (campo) { campo.value = FraseCifrado.actual(); campo.type = 'password'; }
        if (this.ids.recordar) $(this.ids.recordar)?.classList.toggle('btn-activo', FraseCifrado.recordada());
        this.alCambiar();
    }

    alternarVisible() {
        alternarVisibilidadClave($(this.ids.input));
    }

    /** Pone una frase nueva al azar, a la vista para poder anotarla. */
    generar() {
        const campo = $(this.ids.input);
        if (!campo) return;
        campo.value = FraseCifrado.generar();
        campo.type = 'text';
        this.alCambiar();
        mostrarToast('Frase generada: anotala en un lugar seguro. Sin ella no se puede recuperar lo cifrado', 'info', 7000);
    }

    /** Lo que hay escrito en el campo. @returns {string} */
    valor() {
        return $(this.ids.input)?.value ?? '';
    }

    /** ¿Está activado «Recordar en este navegador»? Sin interruptor propio se mantiene como ya estaba guardada. */
    recordar() {
        return this.ids.recordar ? !!$(this.ids.recordar)?.classList.contains('btn-activo') : FraseCifrado.recordada();
    }

    /** ¿Lo escrito (y el interruptor) difiere de lo guardado? */
    cambio() {
        const frase = FraseCifrado.evaluar(this.valor()).frase;
        return frase !== FraseCifrado.actual() || (frase !== '' && this.recordar() !== FraseCifrado.recordada());
    }

    /**
     * Valida la frase escrita y la guarda (en la sesión o, con «Recordar», en este navegador). Un campo vacío olvida la frase
     * (sin cifrado), salvo con `permitirVacia` false, donde es un error. Devuelve false si lo escrito no sirve.
     * Con `avisar` false no muestra nada (para guardar sin molestar).
     * @param {{ avisar?: boolean, permitirVacia?: boolean }} [opciones]
     */
    confirmar({ avisar = true, permitirVacia = true } = {}) {
        const frase = this.valor();
        if (!frase.trim()) {
            if (!permitirVacia) {
                if (avisar) mostrarToast('Escribí o generá una frase de cifrado', 'error');
                return false;
            }
            FraseCifrado.olvidar();
            return true;
        }
        const evaluada = FraseCifrado.evaluar(frase);
        if (!evaluada.ok) {
            if (avisar) mostrarToast(evaluada.motivo, 'error');
            return false;
        }
        if (!FraseCifrado.guardar(frase, this.recordar()) && avisar) mostrarToast('No se pudo guardar la frase en este navegador', 'warning');
        if (evaluada.debil && avisar) mostrarToast(evaluada.motivo, 'warning', 5000);
        return true;
    }
}
