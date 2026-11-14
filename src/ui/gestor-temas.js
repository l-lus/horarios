import { $ } from '../core/dom.js';
import { STORAGE_KEYS } from '../core/constantes.js';
import { Almacenamiento } from '../core/almacenamiento.js';

// ====================================================================
// THEME MANAGER MODULE
// ====================================================================
const TEMAS = ['light', 'dark', 'medianoche', 'pink', 'green', 'blue', 'lilac', 'crema'];

// Cómo se ve cada tema en sus muestras (la vista previa del tema): nombre, color de fondo y de acento. Copias de --bg-body y --c-active (o --c-blue si el tema no
// tiene acento propio) de assets/styles/tokens.css: un test (architecture.test.mjs) verifica que coincidan.
const MUESTRAS = Object.freeze({
    light: { etiqueta: 'Claro', fondo: '#f5f6fa', acento: 'rgba(76, 114, 172, 0.8)' },
    dark: { etiqueta: 'Oscuro', fondo: '#131314', acento: 'rgba(76, 114, 172, 0.8)' },
    medianoche: { etiqueta: 'Medianoche', fondo: '#0b1120', acento: 'rgba(8, 145, 178, 0.9)' },
    pink: { etiqueta: 'Rosa', fondo: '#fdf1f6', acento: 'rgba(194, 85, 127, 0.9)' },
    green: { etiqueta: 'Verde', fondo: '#f0f8f2', acento: 'rgba(63, 143, 99, 0.9)' },
    blue: { etiqueta: 'Azul', fondo: '#eef4fc', acento: 'rgba(76, 114, 172, 0.8)' },
    lilac: { etiqueta: 'Lila', fondo: '#f6f3fc', acento: 'rgba(124, 92, 191, 0.9)' },
    crema: { etiqueta: 'Crema', fondo: '#fbf6ee', acento: 'rgba(176, 106, 50, 0.9)' }
});

// Énfasis de color: se combinan con cualquier tema (<html data-enfasis>, ver el final de tokens.css). 'predeterminado' no pone nada. `acento` es el --c-enfasis tal como vale
// en los temas oscuros (un test verifica que coincida con tokens.css) y `fondo` sigue al tema que está puesto.
const ENFASIS = ['predeterminado', 'lima', 'naranja', 'neutro', 'violeta', 'azul'];
const FONDO_MUESTRA_ENFASIS = 'var(--bg-body)';   // la mitad del círculo es el fondo del tema actual (oscuro o claro), no un color fijo
const MUESTRAS_ENFASIS = Object.freeze({
    predeterminado: { etiqueta: 'Predeterminado', fondo: FONDO_MUESTRA_ENFASIS, acento: 'rgba(76, 114, 172, 0.8)' },
    lima: { etiqueta: 'Lima', fondo: FONDO_MUESTRA_ENFASIS, acento: '#a3e635' },
    naranja: { etiqueta: 'Naranja', fondo: FONDO_MUESTRA_ENFASIS, acento: '#fb923c' },
    neutro: { etiqueta: 'Neutro', fondo: FONDO_MUESTRA_ENFASIS, acento: '#e4e4e7' },
    violeta: { etiqueta: 'Violeta', fondo: FONDO_MUESTRA_ENFASIS, acento: '#8b7cf6' },
    azul: { etiqueta: 'Azul', fondo: FONDO_MUESTRA_ENFASIS, acento: '#3b82f6' }
});

/** Los temas, en el orden en que rota el botón de tema, con lo necesario para dibujar su muestra. */
function muestras() {
    return TEMAS.map(id => ({ id, ...MUESTRAS[id] }));
}

/** Los énfasis, en el orden en que se muestran, con lo necesario para dibujar su muestra. */
function muestrasEnfasis() {
    return ENFASIS.map(id => ({ id, ...MUESTRAS_ENFASIS[id] }));
}

function enfasisGuardado() {
    const raw = Almacenamiento.getItem(STORAGE_KEYS.ENFASIS, null);
    return ENFASIS.includes(raw) ? raw : 'predeterminado';
}

function aplicarEnfasis(enfasis) {
    if (enfasis === 'predeterminado' || !ENFASIS.includes(enfasis)) document.documentElement.removeAttribute('data-enfasis');
    else document.documentElement.setAttribute('data-enfasis', enfasis);
    sincronizarBarraDelSistema();
}

function temaGuardado() {
    const raw = Almacenamiento.getItem(STORAGE_KEYS.TEMA_OSCURO, null);
    if (raw === null) return 'dark';
    if (raw === 'true') return 'dark';
    if (raw === 'false') return 'light';
    return TEMAS.includes(raw) ? raw : 'dark';
}

function aplicarTema(tema) {
    document.documentElement.classList.toggle('dark-mode', tema === 'dark');
    if (tema === 'light' || tema === 'dark') {
        document.documentElement.removeAttribute('data-theme');
    } else {
        document.documentElement.setAttribute('data-theme', tema);
    }
    const esClaro = tema === 'light';
    ['theme-toggle', 'theme-toggle-config', 'btn-tema-selector'].forEach(id => {
        const icon = $(id)?.querySelector('use');
        if (icon) icon.setAttribute('href', esClaro ? '#icon-moon' : '#icon-sun');
    });
    sincronizarBarraDelSistema();
}

function sincronizarBarraDelSistema() {
    const color = getComputedStyle(document.body).getPropertyValue('--bg-body').trim();
    if (!/^#[0-9a-f]{3,8}$/i.test(color)) return;
    /** @type {HTMLMetaElement|null} */
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
    }
    meta.setAttribute('content', color);
}


function siguienteTema(temaActual) {
    const idx = TEMAS.indexOf(temaActual);
    return TEMAS[(idx + 1) % TEMAS.length];
}

export const GestorTemas = { temaGuardado, aplicarTema, siguienteTema, muestras, MUESTRAS, enfasisGuardado, aplicarEnfasis, muestrasEnfasis, MUESTRAS_ENFASIS };
