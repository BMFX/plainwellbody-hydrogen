import {isIP} from 'node:net';

// Bounded, per-process cache. Hydrogen supplies retention TTLs for its public queries.
export function createMemoryCache({maxEntries = 200, now = Date.now} = {}) {
  const entries = new Map();
  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= now()) { entries.delete(key); return undefined; }
      entries.delete(key); entries.set(key, entry);
      return structuredClone(entry.value);
    },
    set(key, value, {ttl = 60} = {}) {
      entries.delete(key);
      if (ttl <= 0) return;
      entries.set(key, {value: structuredClone(value), expiresAt: now() + ttl * 1000});
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
    },
    delete(key) { return entries.delete(key); },
  };
}

// Only trust forwarding headers behind Coolify's private reverse-proxy network.
export function publicRequest(request, clientAddress, trustProxy) {
  const headers = new Headers(request.headers);
  const forwarded = headers.get('x-forwarded-for')?.split(',').at(-1)?.trim();
  const candidate = trustProxy ? headers.get('x-real-ip') || forwarded : null;
  const buyerIp = candidate && isIP(candidate) ? candidate : clientAddress;
  headers.delete('cf-connecting-ip');
  headers.delete('oxygen-buyer-ip');
  headers.set('x-forwarded-for', buyerIp);
  const url = new URL(request.url);
  if (trustProxy && headers.get('x-forwarded-proto')?.split(',')[0]?.trim() === 'https') url.protocol = 'https:';
  headers.delete('x-forwarded-proto');
  return new Request(new Request(url, request), {headers});
}
