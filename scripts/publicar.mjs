// Copia la versión actual (lo commiteado) al repo de producción, sin los comentarios de JS, CSS y HTML.
// El código fuente no cambia: los comentarios quedan en este repo y solo se sacan de lo que baja cada usuario.
// Uso: npm run publicar [-- <carpeta del repo de producción>]   (por defecto ../horarios-pruduction)
// Después: revisar, commitear y hacer push en ese repo (la prueba de humo sobre la copia: npm run test:humo:publicado).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { jsSinComentarios, cssSinComentarios, htmlSinComentarios } from './sin-comentarios.mjs';

const destino = path.resolve(process.argv[2] ?? '../horarios-pruduction');
const git = (args, cwd = '.') => execFileSync('git', args, { cwd, encoding: 'utf8' });

if (git(['status', '--porcelain']).trim()) {
    console.error('Hay cambios sin commitear: se publica solo lo commiteado. Commitealos (o descartalos) y volvé a correrlo.');
    process.exit(1);
}
if (!fs.existsSync(path.join(destino, '.git'))) {
    console.error(`${destino} no es un repo de git (¿el de producción?)`);
    process.exit(1);
}

// Lo mismo que se copiaba con `git archive`: todo lo versionado menos lo que es solo de este repo
const NO_SE_PUBLICA = (f) => f.startsWith('.github/') || f === '.gitignore';
const archivos = git(['ls-files']).split('\n').filter(f => f && !NO_SE_PUBLICA(f));

// Lo que corre en el navegador (los tests, scripts y docs se copian tal cual)
const esJsPublicado = (f) => f === 'sw.js' || (f.startsWith('src/') && f.endsWith('.js'));
const esCssPublicado = (f) => f.startsWith('assets/') && f.endsWith('.css');
const esHtmlPublicado = (f) => !f.includes('/') && f.endsWith('.html');

const gzip = (b) => zlib.gzipSync(b, { level: 9 }).length;
const totales = { antes: 0, despues: 0, antesGz: 0, despuesGz: 0 };

for (const archivo of archivos) {
    const original = fs.readFileSync(archivo);
    let salida = original;
    if (esJsPublicado(archivo)) salida = Buffer.from(jsSinComentarios(original.toString('utf8'), archivo));
    else if (esCssPublicado(archivo)) salida = Buffer.from(cssSinComentarios(original.toString('utf8')));
    else if (esHtmlPublicado(archivo)) salida = Buffer.from(htmlSinComentarios(original.toString('utf8')));
    if (esJsPublicado(archivo) || esCssPublicado(archivo) || esHtmlPublicado(archivo)) {
        totales.antes += original.length; totales.despues += salida.length;
        totales.antesGz += gzip(original); totales.despuesGz += gzip(salida);
    }
    const ruta = path.join(destino, archivo);
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    fs.writeFileSync(ruta, salida);
}

// Lo que ya no existe en esta versión se borra también en producción
const publicados = new Set(archivos);
const borrados = git(['ls-files'], destino).split('\n').filter(f => f && !publicados.has(f));
borrados.forEach(f => fs.rmSync(path.join(destino, f)));

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const version = (fs.readFileSync('sw.js', 'utf8').match(/CACHE_NAME\s*=\s*`\$\{CACHE_PREFIX\}([^`]+)-cache`/) ?? [])[1] ?? '?';
console.log(`Copiados ${archivos.length} archivos a ${destino}${borrados.length ? `, borrados ${borrados.length} que ya no existen (${borrados.join(', ')})` : ''}`);
console.log(`Versión ${version}. JS, CSS y HTML sin comentarios: ${kb(totales.antes)} → ${kb(totales.despues)} (comprimido ${kb(totales.antesGz)} → ${kb(totales.despuesGz)})`);
console.log('Siguiente: npm run test:humo:publicado, y después commit y push en el repo de producción.');
