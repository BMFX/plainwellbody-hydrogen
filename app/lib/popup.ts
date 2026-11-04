// Both the configured background and the public token are treated as untrusted.
export function popupPath(value: unknown): string {
  if (typeof value !== 'string' || value.length > 255
    || !/^\/(?:[A-Za-z0-9][A-Za-z0-9._~-]*(?:\/[A-Za-z0-9][A-Za-z0-9._~-]*)*\/?)?$/.test(value)
    || /(?:^|\/)\.{1,2}(?:\/|$)|^\/(?:a|apps|api|checkout|account|s|c)(?:\/|$)|^\/cart(?:[./]|$)/i.test(value)) return '/';
  return value;
}

export function popupToken(value: string | null): string | null {
  return value && value.length >= 3 && value.length <= 128
    && /^(?:[a-z0-9]+(?:-[a-z0-9]+)*|[A-Za-z0-9]{40,128})$/.test(value) ? value : null;
}

export function popupDestination(path: unknown, token: string, incoming: URL): string {
  const url = new URL(popupPath(path), incoming.origin);
  url.searchParams.set('stc_popup', token);
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    const value = incoming.searchParams.get(key);
    if (value) url.searchParams.set(key, value.slice(0, 255));
  }
  return url.pathname + url.search;
}
