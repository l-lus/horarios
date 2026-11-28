import { Preferencias } from '../core/preferencias.js';
import { STORAGE_KEYS } from '../core/constantes.js';
import { $, esPunteroFino } from '../core/dom.js';
import { EventosApp } from '../core/eventos.js';
import { Almacenamiento } from '../core/almacenamiento.js';
import { EstiloCalendario } from '../core/estilo-calendario.js';
import { EstiloTarjeta } from '../core/estilo-tarjeta.js';
import { GestorTemas } from './gestor-temas.js';
import { GestorModales } from './gestor-modales.js';
import { TarjetaFondos } from './tarjeta-fondos.js';
import { TarjetaEstilos } from './tarjeta-estilos.js';
import { Animaciones } from './animaciones.js';
import { VistaPrevia } from './vista-previa.js';
import { AccionesUI } from './acciones-ui.js';

// ====================================================================
// PERSONALIZACIÓN (tema y énfasis, estilo de la tarjeta de estado y del calendario, en vivo)
// ====================================================================
// Tres vistas previas integradas en un panel abajo de la página: Tarjeta de estado, Calendario y Tema (desde el panel se pasa de una a otra).
// Se abren desde Ajustes (Personalizar paneles), desde el botón de tema del selector de perfiles, desde la tarjeta de atajos o manteniendo y
// soltando una tarjeta (evento 'tarjeta:personalizar'). Este módulo no conoce Ajustes: quien abre una vista le pasa qué hacer antes de mostrarla
// y al cerrarla (`antes` y `alCerrar`, ver VistaPrevia.abrir), así Ajustes puede cerrarse durante la vista previa y reabrirse al terminar.
/** @typedef {{ antes?: () => void, alCerrar?: () => void }} AlAbrir */

const { actualizarUI } = AccionesUI;
const { getFondoCard, _getLabelFondo, toggleFondoCard } = TarjetaFondos;

// --------------------------------------------------------------------
// Tema y énfasis
// --------------------------------------------------------------------
function elegirTema(tema) {
    Almacenamiento.setItem(STORAGE_KEYS.TEMA_OSCURO, tema);
    GestorTemas.aplicarTema(tema);
}

function elegirEnfasis(enfasis) {
    GestorTemas.guardarEnfasis(enfasis);
    GestorTemas.aplicarEnfasis(enfasis);
}

function alternarTema() {
    elegirTema(GestorTemas.siguienteTema(GestorTemas.temaGuardado()));
}

// --------------------------------------------------------------------
// Estilo de la tarjeta de estado
// --------------------------------------------------------------------
// El estilo rota con un solo botón. Con "Barra con hitos" (el antiguo hint integrado) aparece la animación de los hitos, con tres estados en un solo botón:
// Desactivado (sin ciclo automático del número grande), Barra (cada hito con su descripción desplegada en la barra) y Texto (el nombre del hito en el número grande, el predeterminado).
// Se guardan en CICLO_HINT_AUTO (false = desactivado) y DESC_HITOS_NUMERO (barra o texto).
const _MODOS_ANIM_HINT = ['off', 'barra', 'texto'];
const _ETIQUETAS_ANIM_HINT = { off: 'Desactivado', barra: 'Barra', texto: 'Texto' };

function _modoAnimHint() {
    if (!Preferencias.CICLO_HINT_AUTO.get()) return 'off';
    return Preferencias.DESC_HITOS_NUMERO.get() ? 'texto' : 'barra';
}

/** PC (mouse): mismo criterio que .config-solo-pc / .config-solo-movil en responsivo-movimiento.css. Las subopciones de la línea de tiempo se muestran según el dispositivo. */
const _esPC = esPunteroFino;

// Cada toque pasa al estilo siguiente y redibuja la tarjeta
function toggleEstiloTarjeta() {
    EstiloTarjeta.siguiente();
    EventosApp.emit('config:hint-integrado');
    // todo el contenido de la tarjeta se funde del diseño anterior al nuevo, igual que al pasar de día a semana (y el alto se anima, ver _animarAlturaCard)
    AccionesUI.cambiarConFundido(() => actualizarUI());
}

// Las subopciones solo cambian un atributo de <html>: el CSS reacciona al instante y lo que se mueve en la tarjeta viaja a su lugar nuevo
const toggleDisposicionLinea = () => TarjetaEstilos.reubicar(() => EstiloTarjeta.siguienteDisposicion());
const toggleDisposicionAnillo = () => TarjetaEstilos.reubicar(() => EstiloTarjeta.siguienteAnillo());
const toggleMosaicosLinea = () => TarjetaEstilos.reubicar(() => EstiloTarjeta.siguienteMosaicos());

function toggleAnimacionHint() {
    const siguiente = _MODOS_ANIM_HINT[(_MODOS_ANIM_HINT.indexOf(_modoAnimHint()) + 1) % _MODOS_ANIM_HINT.length];
    Preferencias.CICLO_HINT_AUTO.set(siguiente !== 'off');
    if (siguiente !== 'off') Preferencias.DESC_HITOS_NUMERO.set(siguiente === 'texto');
    EventosApp.emit('config:hint-integrado');
    actualizarUI();
}

// --------------------------------------------------------------------
// Estilo del calendario
// --------------------------------------------------------------------
// Estilo y variante solo cambian atributos de <html>: el calendario cambia al instante. Los estilos miden distinto (el alto de las celdas cambia):
// la tarjeta de Registros acompaña el cambio con una transición de alto
const toggleEstiloCalendario = () => Animaciones._animarAlturaCambio($('card-historico'), () => EstiloCalendario.siguiente());
const toggleVarianteCalendario = () => Animaciones._animarAlturaCambio($('card-historico'), () => EstiloCalendario.siguienteVariante());

// --------------------------------------------------------------------
// Las tres vistas previas
// --------------------------------------------------------------------
/** @param {AlAbrir} [alAbrir] */
function _configTarjeta({ antes, alCerrar } = {}) {
    return {
        id: 'tarjeta',
        titulo: 'Tarjeta de estado',
        idObjetivo: 'stats-card',
        antes,
        alCerrar,
        // las subopciones arriba y las filas fijas (estilo y fondo) al final: el panel crece hacia arriba y esas filas no cambian de lugar (ver VistaPrevia.abrir)
        filas: [
            {
                etiqueta: 'Disposición', valor: () => EstiloTarjeta.etiquetaDisposicion(),
                alTocar: toggleDisposicionLinea, visible: () => EstiloTarjeta.actual() === 'linea' && _esPC()
            },
            {
                etiqueta: 'Disposición', valor: () => EstiloTarjeta.etiquetaMosaicos(),
                alTocar: toggleMosaicosLinea, visible: () => EstiloTarjeta.actual() === 'linea' && !_esPC()
            },
            {
                etiqueta: 'Disposición', valor: () => EstiloTarjeta.etiquetaAnillo(),
                alTocar: toggleDisposicionAnillo, visible: () => EstiloTarjeta.actual() === 'anillo'
            },
            {
                etiqueta: 'Animación', icono: '#icon-eye', valor: () => _ETIQUETAS_ANIM_HINT[_modoAnimHint()],
                alTocar: toggleAnimacionHint, visible: () => EstiloTarjeta.hintIntegrado()
            },
            { etiqueta: 'Estilo', valor: () => EstiloTarjeta.etiqueta(), alTocar: toggleEstiloTarjeta },
            // siempre visible (no es una subopción de un estilo): el fondo de la tarjeta, el mismo de Ajustes > Apariencia
            { etiqueta: 'Fondo', icono: '#icon-landscape', valor: () => _getLabelFondo(getFondoCard()), alTocar: toggleFondoCard }
        ]
    };
}

/** @param {AlAbrir} [alAbrir] */
function _configCalendario({ antes, alCerrar } = {}) {
    return {
        id: 'calendario',
        titulo: 'Calendario',
        idObjetivo: 'card-historico',
        antes,
        alCerrar,
        // la variante arriba y el estilo al final (como en la tarjeta de estado): el panel crece hacia arriba y Estilo no cambia de lugar
        filas: [
            { etiqueta: 'Variante', valor: () => EstiloCalendario.etiquetaVariante(), alTocar: toggleVarianteCalendario },
            { etiqueta: 'Estilo', icono: '#icon-calendar-simple', valor: () => EstiloCalendario.etiqueta(), alTocar: toggleEstiloCalendario }
        ]
    };
}

// El tema no tiene tarjeta ni filas: se ve toda la página y se elige con círculos de color
/** @param {AlAbrir} [alAbrir] */
function _configTema({ antes, alCerrar } = {}) {
    return {
        id: 'tema',
        titulo: 'Tema',
        sinVelo: true,
        antes,
        alCerrar,
        filas: [],
        circulos: [
            { titulo: 'Color de fondo', opciones: GestorTemas.muestras(), actual: () => GestorTemas.temaGuardado(), alElegir: elegirTema },
            { titulo: 'Énfasis', opciones: GestorTemas.muestrasEnfasis(), actual: () => GestorTemas.enfasisGuardado(), alElegir: elegirEnfasis }
        ]
    };
}

const _VISTAS = { tarjeta: _configTarjeta, calendario: _configCalendario, tema: _configTema };

// Las tres están integradas: desde el panel se pasa de una a otra (tocando las flechas del título o deslizando en pantallas táctiles)
VistaPrevia.registrarVista('tarjeta', () => _configTarjeta());
VistaPrevia.registrarVista('calendario', () => _configCalendario());
VistaPrevia.registrarVista('tema', () => _configTema());
VistaPrevia.definirOrden(['tarjeta', 'calendario', 'tema']);

/**
 * Abre una vista previa (si no hay otra abierta). Sin `alAbrir`, no hay nada que cerrar antes ni a qué volver al terminar.
 * @param {'tarjeta' | 'calendario' | 'tema'} [vista] por defecto, Tema
 * @param {AlAbrir} [alAbrir]
 */
function abrir(vista = 'tema', alAbrir = {}) {
    if (!VistaPrevia.activa()) VistaPrevia.abrir(_VISTAS[vista](alAbrir));
}

// Atajo desde las tarjetas y el encabezado (mantener y soltar sin mover, ver orden-tarjetas.js y header-posicion.js): abre la vista de esa
// parte, salvo que haya un modal u otra vista previa
EventosApp.on('tarjeta:personalizar', (datos) => {
    if (document.querySelector('.modal.show') || document.body.classList.contains('config-onboarding')) return;
    const vista = { estado: 'tarjeta', calendario: 'calendario', tema: 'tema' }[datos?.tarjeta];
    if (vista) abrir(/** @type {'tarjeta' | 'calendario' | 'tema'} */ (vista));
});

function bindEventos() {
    VistaPrevia.bindEventos();
    // En el selector de perfiles el botón de tema abre la vista del tema: el selector se oculta mientras (conservando su entrada del historial) y se reabre al terminar
    $('theme-toggle-modal')?.addEventListener('click', () => abrir('tema', {
        antes: () => GestorModales.cerrar('modal-selector-perfiles', null, { sinHistorial: true }),
        alCerrar: () => GestorModales.abrir('modal-selector-perfiles', null, { sinHistorial: true })
    }));
    // El de Ajustes (que solo se ve en la configuración inicial) cambia el tema directo
    $('theme-toggle-config')?.addEventListener('click', () => alternarTema());
}

export const Personalizacion = { abrir, alternarTema, bindEventos };
