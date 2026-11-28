import test from 'node:test';
import assert from 'node:assert/strict';
import { jsSinComentarios, cssSinComentarios, htmlSinComentarios } from '../scripts/sin-comentarios.mjs';

// Lo publicado no lleva comentarios (scripts/publicar.mjs): sacarlos no puede cambiar nada más

test('sin comentarios: JS conserva textos, plantillas, expresiones regulares e imports', () => {
    const js = [
        'import { A } from "./a.js"; // uno',
        'import "./b.js";',
        '/** doc */',
        'const r = /\\/\\/ no/g; /* dos */',
        'const r2 = /[/*]+/;',
        'const u = "https://x.y/*z*/";',
        'const t = `// ${u} /* */`;',
        'export const x = /** @type {number} */ (1) + 2;',
    ].join('\n');
    const salida = jsSinComentarios(js, 'p.js');
    for (const conservado of ['import { A } from "./a.js";', 'import "./b.js";', '/\\/\\/ no/g', '/[/*]+/', '"https://x.y/*z*/"', '`// ${u} /* */`']) {
        assert.ok(salida.includes(conservado), conservado);
    }
    for (const comentario of ['// uno', '/* dos */', '/** doc */', '@type']) assert.ok(!salida.includes(comentario), comentario);
});

test('sin comentarios: un JS que no compila no se publica a medias', () => {
    assert.throws(() => jsSinComentarios('const = ;', 'roto.js'));
});

test('sin comentarios: CSS conserva lo que está entre comillas y quita las líneas vacías que quedan', () => {
    const css = '/* titulo */\n.a { content: "/* no */"; } /* fin */\n\n\n.b { background: url(\'x/*.png\'); }\n';
    assert.equal(cssSinComentarios(css), '\n.a { content: "/* no */"; }\n.b { background: url(\'x/*.png\'); }\n');
});

test('sin comentarios: HTML quita los comentarios (con su línea) y deja el resto igual', () => {
    const html = '<div>\n    <!-- nota -->\n    <p>Hola <!-- en línea --> mundo</p>\n</div>\n';
    assert.equal(htmlSinComentarios(html), '<div>\n    <p>Hola  mundo</p>\n</div>\n');   // los dos espacios se ven como uno
});
