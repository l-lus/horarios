import { STORAGE_KEYS } from './constantes.js';
import { Almacenamiento } from './almacenamiento.js';
import { Preferencias } from './preferencias.js';
import { catalogoCiclico, opcionGuardada } from './catalogo.js';

// ====================================================================
// ESTILO DE LA TARJETA DE ESTADO
// ====================================================================
// Cómo se dibuja el registro del día en la tarjeta de arriba. La clásica (el predeterminado) y la barra con hitos (el antiguo "hint integrado") son la barra de
// siempre; los demás son diseños propios que reemplazan el número, la barra y los textos, tanto en la vista diaria como en la semanal. Es una opción de la
// instalación, no del perfil. Sin valor guardado se usa la barra con hitos, salvo que el interruptor antiguo HINT_INTEGRADO se hubiera apagado a propósito (entonces, la clásica).
export const ESTILOS_TARJETA = Object.freeze([
    { id: 'clasica', label: 'Clásica' },
    { id: 'linea', label: 'Línea de tiempo' },
    { id: 'filas', label: 'Lista de filas' },
    { id: 'anillo', label: 'Anillo' },
    { id: 'hitos', label: 'Barra con hitos' }
]);

/** Estilos con diseño propio: dibujan la tarjeta en `#stats-estilo` en vez de la barra. */
const ESTILOS_PROPIOS = Object.freeze(['linea', 'filas', 'anillo']);

// Subvariante del estilo "Línea de tiempo": en una tarjeta ancha (PC) elige cómo se reparte la tarjeta: el tiempo trabajado arriba de la línea (como en el móvil), el tiempo
// a la izquierda o a la derecha de la línea, o los mosaicos "Faltan" y "Banco de horas" apilados a la izquierda o a la derecha.
// El CSS solo mira <html data-disposicion-linea> (y el ancho de la tarjeta), así que cambiarla no redibuja nada.
export const DISPOSICIONES_LINEA = Object.freeze([
    { id: 'arriba', label: 'Arriba' },
    { id: 'izquierda', label: 'Tiempo a la izquierda' },
    { id: 'derecha', label: 'Tiempo a la derecha' },
    { id: 'mosaicos-izquierda', label: 'Mosaicos a la izquierda' },
    { id: 'mosaicos-derecha', label: 'Mosaicos a la derecha' }
]);

// Subvariante para la tarjeta angosta (móvil): los mosaicos "Faltan" y "Banco de horas" abajo (como siempre) o apilados a la derecha, al lado del tiempo y la línea.
export const MOSAICOS_LINEA = Object.freeze([
    { id: 'abajo', label: 'Horizontal' },   // los mosaicos en fila, abajo
    { id: 'derecha', label: 'Vertical' }     // los mosaicos apilados, a la derecha de la línea
]);

// Variantes del estilo "Anillo": el aro a la izquierda (el predeterminado) o a la derecha, intercambiando las columnas, y la fila Entrada / Salida / Con banco
// abajo (como siempre) o arriba de todo; y las variantes "intercambiado", donde los dos grupos de datos cambian de lugar: Entrada / Salida / Con banco quedan apilados al costado del aro
// y Faltan / Banco de horas (y Tiempo fuera) pasan a la fila de abajo. El CSS solo mira <html data-disposicion-anillo>, así que cambiarla no redibuja nada (cada grupo tiene su copia
// en el otro lugar, ver crearAnillo en ui/tarjeta-estilos.js, y el CSS muestra la que corresponde). Las etiquetas son cortas a propósito: son el valor de la fila «Disposición» del panel,
// que no se parte, y en un móvil angosto no entran más de unos 170 px.
export const DISPOSICIONES_ANILLO = Object.freeze([
    { id: 'izquierda', label: 'Anillo a la izquierda' },
    { id: 'derecha', label: 'Anillo a la derecha' },
    { id: 'arriba-izquierda', label: 'Fila arriba, anillo izq.' },
    { id: 'arriba-derecha', label: 'Fila arriba, anillo der.' },
    { id: 'intercambiado-izquierda', label: 'Intercambio, anillo izq.' },
    { id: 'intercambiado-derecha', label: 'Intercambio, anillo der.' }
]);

/** Sin elección guardada, en el móvil los mosaicos van apilados a la derecha de la línea ("Vertical"). */
const MOSAICOS_PREDETERMINADO = 'derecha';

// Ciclo y etiqueta de cada lista (un id desconocido cuenta como la primera, salvo en los mosaicos: como la predeterminada)
const _estilos = catalogoCiclico(ESTILOS_TARJETA);
const _disposiciones = catalogoCiclico(DISPOSICIONES_LINEA);
const _posMosaicos = catalogoCiclico(MOSAICOS_LINEA, { porDefecto: MOSAICOS_PREDETERMINADO });
const _anillos = catalogoCiclico(DISPOSICIONES_ANILLO);

export const siguienteEstilo = _estilos.siguiente;
export const etiquetaEstilo = _estilos.etiqueta;
export const siguienteDisposicion = _disposiciones.siguiente;
export const etiquetaDisposicion = _disposiciones.etiqueta;
export const siguienteMosaicos = _posMosaicos.siguiente;
export const etiquetaMosaicos = _posMosaicos.etiqueta;
export const siguienteAnillo = _anillos.siguiente;
export const etiquetaAnillo = _anillos.etiqueta;

export const esEstiloPropio = id => ESTILOS_PROPIOS.includes(id);

// Sin estilo guardado: la barra con hitos, salvo que el interruptor antiguo se hubiera apagado a propósito (entonces, la clásica)
const _estiloGuardado = opcionGuardada(STORAGE_KEYS.ESTILO_TARJETA, _estilos, () => {
    const hintGuardado = Almacenamiento.getItem(STORAGE_KEYS.HINT_INTEGRADO, null);
    return hintGuardado !== null && !Preferencias.HINT_INTEGRADO.get() ? 'clasica' : 'hitos';
});
const _disposicionGuardada = opcionGuardada(STORAGE_KEYS.LINEA_DISPOSICION, _disposiciones);
const _mosaicosGuardados = opcionGuardada(STORAGE_KEYS.LINEA_MOSAICOS, _posMosaicos);
const _anilloGuardado = opcionGuardada(STORAGE_KEYS.ANILLO_DISPOSICION, _anillos);
const _GUARDADAS = [_estiloGuardado, _disposicionGuardada, _mosaicosGuardados, _anilloGuardado];

const actual = () => _estiloGuardado.get();
const disposicion = () => _disposicionGuardada.get();
const mosaicos = () => _mosaicosGuardados.get();
const anillo = () => _anilloGuardado.get();

function _aplicar() {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-estilo-tarjeta', actual());
    document.documentElement.setAttribute('data-disposicion-linea', disposicion());
    document.documentElement.setAttribute('data-mosaicos-linea', mosaicos());
    document.documentElement.setAttribute('data-disposicion-anillo', anillo());
}

/** Guarda la opción (si es válida) y la aplica. @param {ReturnType<typeof opcionGuardada>} opcion @param {any} id */
function _fijar(opcion, id) {
    if (opcion.set(id)) _aplicar();
}

/** @param {any} id */ const setEstilo = id => _fijar(_estiloGuardado, id);
/** @param {any} id */ const setDisposicion = id => _fijar(_disposicionGuardada, id);
/** @param {any} id */ const setMosaicos = id => _fijar(_mosaicosGuardados, id);
/** @param {any} id */ const setAnillo = id => _fijar(_anilloGuardado, id);

function init() {
    _aplicar();
}

function siguiente() {
    setEstilo(siguienteEstilo(actual()));
}

/** Vuelve a leer el estilo guardado (después de restaurar un respaldo, que escribe el almacenamiento por su cuenta). */
function releer() {
    _GUARDADAS.forEach(o => o.olvidar());
    _aplicar();
}

/** Un respaldo viejo solo trae el interruptor del hint integrado: equivale a la barra con hitos o a la clásica. */
function desdeHintIntegrado(activo) {
    setEstilo(activo ? 'hitos' : 'clasica');
}

export const EstiloTarjeta = {
    init, actual, setEstilo, siguiente, releer, desdeHintIntegrado, disposicion, setDisposicion,
    siguienteDisposicion: () => setDisposicion(siguienteDisposicion(disposicion())),
    etiquetaDisposicion: () => etiquetaDisposicion(disposicion()),
    mosaicos, setMosaicos,
    siguienteMosaicos: () => setMosaicos(siguienteMosaicos(mosaicos())),
    etiquetaMosaicos: () => etiquetaMosaicos(mosaicos()),
    anillo, setAnillo,
    siguienteAnillo: () => setAnillo(siguienteAnillo(anillo())),
    etiquetaAnillo: () => etiquetaAnillo(anillo()),
    etiqueta: () => etiquetaEstilo(actual()),
    /** ¿La barra lleva los hitos dibujados encima (el antiguo hint integrado)? */
    hintIntegrado: () => actual() === 'hitos',
    /** ¿La vista diaria usa un diseño propio en vez de la barra? */
    propio: () => esEstiloPropio(actual())
};
