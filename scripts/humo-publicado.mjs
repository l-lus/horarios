// Prueba de humo sobre la copia de producción que deja scripts/publicar.mjs (sin comentarios), antes de commitearla.
// Uso: npm run test:humo:publicado [-- <carpeta del repo de producción>]   (por defecto ../horarios-pruduction)
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const raiz = path.resolve(process.argv[2] ?? '../horarios-pruduction');
const r = spawnSync(process.execPath, ['--test', 'tests/e2e/humo.test.mjs'], { stdio: 'inherit', env: { ...process.env, HORARIOS_RAIZ: raiz } });
process.exit(r.status ?? 1);
