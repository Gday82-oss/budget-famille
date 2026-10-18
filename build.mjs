// Construit l'appli dans dist/ : bundle (esbuild), fichiers statiques, service worker versionné.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');

await build({
  entryPoints: ['src/main.jsx'],
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['chrome100'],
  outfile: 'dist/app.js',
  jsx: 'automatic',
  loader: { '.woff': 'file' },
  assetNames: 'polices/[name]-[hash]',
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'none',
  logLevel: 'warning',
});
cpSync('public', 'dist', { recursive: true });
cpSync('src/fonts', 'dist/polices', { recursive: true, filter: (f) => !f.endsWith('.woff') });

const liste = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? liste(p) : [p];
});
const fichiers = liste('dist').map((p) => relative('dist', p).split('\\').join('/')).filter((f) => f !== 'sw.js').sort();
const empreinte = createHash('sha256');
for (const f of fichiers) empreinte.update(f).update(readFileSync(join('dist', f)));
const version = empreinte.digest('hex').slice(0, 12);
const precache = ['./', ...fichiers.filter((f) => !f.endsWith('.txt'))];
writeFileSync('dist/sw.js', readFileSync('src/sw.js', 'utf8')
  .replace('__VERSION__', version)
  .replace('__FICHIERS__', JSON.stringify(precache)));
console.log(`Construit : ${fichiers.length + 1} fichiers, version ${version}`);
