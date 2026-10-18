// Serveur local de test : node serve.mjs [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8' };
const port = Number(process.argv[2] || 4173);
createServer(async (req, res) => {
  let chemin = normalize(decodeURIComponent(new URL(req.url, 'http://local').pathname)).replace(/^(\.\.[/\\])+/, '');
  if (chemin.endsWith('/')) chemin += 'index.html';
  try {
    const contenu = await readFile(join('dist', chemin));
    res.writeHead(200, { 'content-type': types[extname(chemin)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(contenu);
  } catch {
    res.writeHead(404); res.end('Introuvable');
  }
}).listen(port, () => console.log(`http://localhost:${port}/`));
