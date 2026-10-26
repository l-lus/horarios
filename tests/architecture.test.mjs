import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function walkJs(dir) {
    let results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results = results.concat(walkJs(fullPath));
        } else if (entry.name.endsWith('.js')) {
            results.push(fullPath.split(path.sep).join('/'));
        }
    }
    return results.sort();
}

const srcFiles = walkJs('src');

function buildDependencyGraph() {
    const graph = {};
    const rawImports = {};
    for (const file of srcFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const resolvedList = [];
        const rawList = [];
        const regex = /import\s+[\s\S]*?from\s+['"]([^'"]+)['"]/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
            const spec = match[1];
            rawList.push(spec);
            const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
            resolvedList.push(resolved);
        }
        graph[file] = resolvedList;
        rawImports[file] = rawList;
    }
    return { graph, rawImports };
}

test('Arquitectura: Todos los imports relativos tienen extensión .js explícita y apuntan a archivos existentes', () => {
    const { graph, rawImports } = buildDependencyGraph();
    for (const file of srcFiles) {
        for (const spec of rawImports[file]) {
            assert.ok(spec.startsWith('.'), `${file}: el import "${spec}" debe ser relativo`);
            assert.ok(spec.endsWith('.js'), `${file}: el import "${spec}" debe incluir extensión .js para funcionar en el navegador`);
        }
        for (const target of graph[file]) {
            assert.ok(fs.existsSync(target), `${file}: el archivo importado "${target}" no existe`);
        }
    }
});

test('Arquitectura: Cero violaciones de capas (data <= core <= services <= ui <= main.js)', () => {
    const { graph } = buildDependencyGraph();
    const layerRank = {
        data: 0,
        core: 1,
        services: 2,
        ui: 3,
        'main.js': 4
    };
    const getLayer = (f) => f.split('/')[1];

    const violations = [];
    for (const [file, imports] of Object.entries(graph)) {
        const fromLayer = getLayer(file);
        for (const target of imports) {
            const toLayer = getLayer(target);
            if (layerRank[toLayer] > layerRank[fromLayer]) {
                violations.push(`${file} (${fromLayer}) -> ${target} (${toLayer})`);
            }
        }
    }
    assert.deepEqual(violations, [], `Se encontraron violaciones de capa:\n${violations.join('\n')}`);
});

test('Arquitectura: Grafo de módulos acíclico (cero dependencias circulares)', () => {
    const { graph } = buildDependencyGraph();
    const visited = new Set();
    const stack = [];
    const onStack = new Set();
    const cycles = [];

    function dfs(node) {
        visited.add(node);
        stack.push(node);
        onStack.add(node);
        for (const next of (graph[node] || [])) {
            if (!visited.has(next)) {
                dfs(next);
            } else if (onStack.has(next)) {
                const idx = stack.indexOf(next);
                cycles.push(stack.slice(idx).concat(next).join(' -> '));
            }
        }
        stack.pop();
        onStack.delete(node);
    }

    for (const file of srcFiles) {
        if (!visited.has(file)) dfs(file);
    }

    assert.deepEqual(cycles, [], `Se encontraron ciclos de dependencias:\n${cycles.join('\n')}`);
});

test('Service Worker (sw.js): Todos los módulos de src/ están en urlsToCache y todas las rutas existen', () => {
    const swContent = fs.readFileSync('sw.js', 'utf8');
    const match = swContent.match(/const\s+urlsToCache\s*=\s*\[([\s\S]*?)\];/);
    assert.ok(match, 'No se encontró urlsToCache en sw.js');

    const cachedPaths = [];
    const strRegex = /['"]([^'"]+)['"]/g;
    let m;
    while ((m = strRegex.exec(match[1])) !== null) {
        cachedPaths.push(m[1]);
    }

    for (const cached of cachedPaths) {
        if (cached === './') continue;
        const diskPath = cached.replace(/^\.\//, '');
        assert.ok(fs.existsSync(diskPath), `Ruta en sw.js urlsToCache no existe en disco: ${cached}`);
    }

    const cachedNormalized = new Set(cachedPaths.map(p => p.replace(/^\.\//, '')));
    const missingFromSw = srcFiles.filter(f => !cachedNormalized.has(f));
    assert.deepEqual(missingFromSw, [], `Módulos de src/ faltantes en sw.js urlsToCache:\n${missingFromSw.join('\n')}`);
});

test('Arquitectura CSS: Las 5 capas de assets/styles/ se cargan en orden de cascada en index.html y están en sw.js', () => {
    const expectedCssOrder = [
        'assets/styles/tokens.css',
        'assets/styles/base.css',
        'assets/styles/tarjetas-vistas.css',
        'assets/styles/modales-funciones.css',
        'assets/styles/responsivo-movimiento.css'
    ];

    const cssFilesOnDisk = fs.readdirSync('assets/styles')
        .filter(f => f.endsWith('.css'))
        .map(f => `assets/styles/${f}`)
        .sort();
    assert.deepEqual(cssFilesOnDisk, [...expectedCssOrder].sort(), 'Los archivos en assets/styles/ deben coincidir exactamente con las 5 capas definidas');

    const html = fs.readFileSync('index.html', 'utf8');
    const linkRegex = /<link\s+rel="stylesheet"\s+href="\.\/([^"]+)"/g;
    const htmlLinks = [];
    let m;
    while ((m = linkRegex.exec(html)) !== null) {
        htmlLinks.push(m[1]);
    }
    assert.deepEqual(htmlLinks, expectedCssOrder, 'index.html debe cargar las 5 hojas CSS en el orden exacto de cascada');

    const swContent = fs.readFileSync('sw.js', 'utf8');
    for (const cssPath of expectedCssOrder) {
        assert.ok(swContent.includes(`./${cssPath}`), `Falta ./${cssPath} en sw.js urlsToCache`);
    }
});

