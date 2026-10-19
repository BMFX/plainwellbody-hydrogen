import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {Readable} from 'node:stream';
import {createRequestListener} from '@mjackson/node-fetch-server';
import worker from '../dist/server/index.js';
import {createMemoryCache, publicRequest} from './runtime.mjs';

const port = Number(process.env.PORT || 3000);
const clientRoot = resolve('dist/client');
const cache = createMemoryCache();
const background = new Set();
const mime = {'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.ico':'image/x-icon','.woff2':'font/woff2','.woff':'font/woff','.json':'application/json','.txt':'text/plain; charset=utf-8','.webmanifest':'application/manifest+json'};
function waitUntil(promise) {
  const task = Promise.resolve(promise).catch(error => console.error('Background task failed', error));
  background.add(task); task.finally(() => background.delete(task));
}
async function staticResponse(request) {
  if (!['GET','HEAD'].includes(request.method)) return null;
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url).pathname); } catch { return new Response('Bad request',{status:400}); }
  const path = resolve(clientRoot, '.' + pathname);
  if (!path.startsWith(clientRoot + sep)) return null;
  const file = await stat(path).catch(() => null);
  if (!file?.isFile()) return null;
  return new Response(request.method === 'HEAD' ? null : Readable.toWeb(createReadStream(path)), {headers:{
    'content-type':mime[extname(path)] || 'application/octet-stream',
    'content-length':String(file.size),
    'cache-control':pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
    'x-content-type-options':'nosniff',
  }});
}
const server = createServer(createRequestListener(async (rawRequest, client) => {
  if (new URL(rawRequest.url).pathname === '/healthz') return new Response('ok',{headers:{'cache-control':'no-store'}});
  const asset = await staticResponse(rawRequest);
  if (asset) return asset;
  const request = publicRequest(rawRequest, client.address, process.env.TRUST_PROXY === 'true');
  return worker.fetch(request, process.env, {cache,waitUntil});
}));
server.listen(port, '0.0.0.0', () => console.log(`Plainwell listening on port ${port}`));
for (const signal of ['SIGTERM','SIGINT']) process.once(signal, () => {
  const timeout = setTimeout(() => process.exit(1), 10000); timeout.unref();
  server.close(async () => { await Promise.allSettled([...background]); clearTimeout(timeout); process.exit(0); });
});
