import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMemoryCache, publicRequest} from './runtime.mjs';
test('cache expires, isolates stored values, and evicts the least recent entry', () => {
  let now=0; const cache=createMemoryCache({maxEntries:2,now:()=>now});
  const value={data:1}; cache.set('a',value,{ttl:2}); value.data=9; assert.equal(cache.get('a').data,1);
  cache.set('b',{data:2},{ttl:3}); cache.get('a'); cache.set('c',{data:3}); assert.equal(cache.get('b'),undefined);
  now=2000; assert.equal(cache.get('a'),undefined);
});
test('untrusted request cannot spoof its buyer IP or secure origin', () => {
  const req=new Request('http://localhost/account',{headers:{'x-forwarded-proto':'https','x-forwarded-for':'1.1.1.1','oxygen-buyer-ip':'2.2.2.2','cf-connecting-ip':'3.3.3.3'}});
  const actual=publicRequest(req,'127.0.0.1',false); assert.equal(new URL(actual.url).protocol,'http:'); assert.equal(actual.headers.get('x-forwarded-for'),'127.0.0.1'); assert.equal(actual.headers.get('oxygen-buyer-ip'),null);
});
test('Coolify TLS proxy origin and buyer IP survive for OAuth and private API requests', async () => {
  const req=new Request('http://preview.example/account',{method:'POST',body:'hello',headers:{'x-forwarded-proto':'https','x-real-ip':'8.8.8.8'}});
  const actual=publicRequest(req,'172.20.0.2',true); assert.equal(actual.url,'https://preview.example/account'); assert.equal(actual.headers.get('x-forwarded-for'),'8.8.8.8'); assert.equal(await actual.text(),'hello');
});
