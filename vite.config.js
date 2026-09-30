import { defineConfig } from 'vite';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

export default defineConfig({
  base: './',
  plugins: [{
    name: 'offline-shell',
    closeBundle() {
      const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
      const files = walk('dist').filter(f => !f.endsWith('sw.js'));
      const version = createHash('sha256').update(Buffer.concat(files.map(f => readFileSync(f)))).digest('hex').slice(0, 16);
      const urls = files.map(f => './' + relative('dist', f).replaceAll('\\', '/'));
      writeFileSync('dist/sw.js', `
const CACHE = 'pgpwa-${version}';
const ASSETS = ${JSON.stringify(urls)};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if ((key.startsWith('pgpwa-') || key.startsWith('sealed-')) && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (event.request.mode === 'navigate') return await cache.match('./index.html');
    // Static same-origin assets can be fetched with different Origin headers
    // during precaching versus module loading (Vite serves Vary: Origin).
    return await cache.match(event.request, { ignoreVary: true }) || fetch(event.request);
  })());
});
`);
    }
  }],
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' }
});
