import {createHash} from 'node:crypto';
import type {Selection} from './sendthecart.server';

import {automaticFields} from './automatic-selection';

const escape = (value:string) => value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
const submitScript = 'document.getElementById("stc-quick-add").submit()';

// GET only supplies a per-visit, single-use confirmation attempt. Cart writes
// remain in the existing same-origin POST action, with no automatic retries.
export function automaticDocument(request:Request, selection:Selection, headers:Headers):Response {
  const url = new URL(request.url);
  if (request.method !== 'GET' || !/^\/a\/cart\/[A-Za-z0-9-]+$/.test(url.pathname)) throw new Error('handoff');
  const inputs = Object.entries(automaticFields(selection)).map(([name,value]) => `<input type="hidden" name="${name}" value="${escape(value)}">`).join('');
  const responseHeaders = new Headers(headers);
  responseHeaders.set('Content-Type','text/html; charset=utf-8');
  responseHeaders.set('Cache-Control','private, no-store');
  responseHeaders.set('Referrer-Policy','same-origin');
  responseHeaders.set('X-Robots-Tag','noindex, nofollow');
  responseHeaders.set('Content-Security-Policy',`default-src 'none'; script-src 'sha256-${createHash('sha256').update(submitScript).digest('base64')}'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`);
  return new Response(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title></title></head><body><form id="stc-quick-add" method="post" action="${escape(url.pathname+url.search)}" hidden>${inputs}</form><script>${submitScript}</script></body></html>`,{headers:responseHeaders});
}
