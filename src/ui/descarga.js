import { GestorPerfiles } from '../services/gestor-perfiles.js';

// ====================================================================
// DESCARGAS — bajar un archivo generado en el navegador (respaldos y reportes)
// ====================================================================

/** El nombre del perfil activo apto para un nombre de archivo. */
function obtenerNombrePerfilSafe() {
    const nombre = String(GestorPerfiles.obtenerDatosPerfil()?.nombre ?? 'Backup');
    return nombre.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ'\-_ ]/g, '').trim().replace(/\s+/g, '_');
}

/** @param {string} contenido @param {string} nombreArchivo @param {string} mime */
function descargarArchivo(contenido, nombreArchivo, mime) {
    const blob = new Blob([contenido], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: nombreArchivo });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export const Descarga = { obtenerNombrePerfilSafe, descargarArchivo };
