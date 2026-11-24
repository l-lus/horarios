import { Almacenamiento } from './almacenamiento.js';

// ====================================================================
// CATÁLOGOS DE OPCIONES QUE SE RECORREN EN CICLO (estilos, disposiciones, temas, modos)
// ====================================================================
// Cada botón de Ajustes que "pasa a la opción siguiente" recorre una lista fija de { id, label }: acá están, una sola vez, el ciclo,
// la etiqueta, la validación y la lectura cacheada del valor guardado.

/** El id que sigue a `id` en `ids` (vuelve al primero al terminar; uno desconocido da el primero). @param {readonly string[]} ids @param {any} id */
export function siguienteEnCiclo(ids, id) {
    return ids[(ids.indexOf(id) + 1) % ids.length];
}

/**
 * @param {readonly { id: string, label: string }[]} lista
 * @param {{ porDefecto?: string, desconocidoEsPorDefecto?: boolean }} [opciones] `porDefecto` (el primero si no se indica) es lo que vale un id desconocido
 *   para la etiqueta y la normalización; con `desconocidoEsPorDefecto` también para el ciclo (si no, un id desconocido pasa al primero).
 */
export function catalogoCiclico(lista, { porDefecto = lista[0].id, desconocidoEsPorDefecto = false } = {}) {
    const ids = lista.map(x => x.id);
    /** @param {any} id */
    const esValido = id => ids.includes(id);
    /** @param {any} id */
    const normalizar = id => (esValido(id) ? id : porDefecto);
    return Object.freeze({
        porDefecto,
        esValido,
        normalizar,
        /** @param {any} id */
        siguiente: id => siguienteEnCiclo(ids, desconocidoEsPorDefecto ? normalizar(id) : id),
        /** @param {any} id */
        etiqueta: id => lista[ids.indexOf(normalizar(id))].label
    });
}

/**
 * Una opción de un catálogo guardada en el almacenamiento (de la instalación): se lee una vez y queda en memoria.
 * @param {string} clave
 * @param {ReturnType<typeof catalogoCiclico>} catalogo
 * @param {() => string} [porDefecto] lo que vale sin nada guardado (o con algo inválido); por defecto, el del catálogo
 */
export function opcionGuardada(clave, catalogo, porDefecto = () => catalogo.porDefecto) {
    /** @type {string | null} */
    let valor = null;
    return {
        /** @returns {string} */
        get() {
            if (valor === null) {
                const guardado = Almacenamiento.getItem(clave, null);
                valor = catalogo.esValido(guardado) ? guardado : porDefecto();
            }
            return /** @type {string} */ (valor);
        },
        /** Guarda `id` si es del catálogo. @param {any} id @returns {boolean} si lo guardó */
        set(id) {
            if (!catalogo.esValido(id)) return false;
            valor = id;
            Almacenamiento.setItem(clave, id);
            return true;
        },
        /** Olvida lo leído: la próxima lectura vuelve al almacenamiento (después de restaurar un respaldo). */
        olvidar() { valor = null; }
    };
}
