// Sacar comentarios de JS, CSS y HTML sin tocar nada más (lo usa scripts/publicar.mjs; probado en tests/sin-comentarios.test.mjs).
import ts from 'typescript';

/** JS sin comentarios: el compilador de TypeScript lo vuelve a escribir igual, sin ellos (respeta textos, plantillas y expresiones regulares). */
export function jsSinComentarios(texto, archivo) {
    const { outputText, diagnostics } = ts.transpileModule(texto, {
        fileName: archivo,
        reportDiagnostics: true,
        compilerOptions: { removeComments: true, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, allowJs: true },
    });
    if (diagnostics?.length) throw new Error(`${archivo}: ${ts.flattenDiagnosticMessageText(diagnostics[0].messageText, '\n')}`);
    return outputText;
}

/** CSS sin comentarios: se recorre respetando lo que está entre comillas. También se sacan las líneas que quedan vacías. */
export function cssSinComentarios(texto) {
    let salida = '';
    let comilla = null;
    for (let i = 0; i < texto.length; i++) {
        const c = texto[i];
        if (comilla) {
            salida += c;
            if (c === '\\') salida += texto[++i] ?? '';
            else if (c === comilla) comilla = null;
        } else if (c === '"' || c === "'") {
            comilla = c;
            salida += c;
        } else if (c === '/' && texto[i + 1] === '*') {
            const fin = texto.indexOf('*/', i + 2);
            i = fin === -1 ? texto.length : fin + 1;
        } else {
            salida += c;
        }
    }
    return salida.replace(/[ \t]+$/gm, '').replace(/\n{2,}/g, '\n');
}

/**
 * HTML sin comentarios (no hay scripts ni estilos en línea: los prohíbe la CSP). Un comentario solo en su línea se va con la línea;
 * uno en medio de un texto se saca sin tocar los espacios de alrededor (si no, se pegarían las palabras).
 */
export const htmlSinComentarios = (texto) => texto
    .replace(/^[ \t]*<!--(?!\[)[\s\S]*?-->[ \t]*\n/gm, '')
    .replace(/<!--(?!\[)[\s\S]*?-->/g, '');
