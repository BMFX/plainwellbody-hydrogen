import type {SelectionItem} from './sendthecart.server';

/** Display estimate only; confirmation always rechecks current Shopify prices. */
export function selectionSummary(items: SelectionItem[], optionalKeys: string[], sets: number) {
  const chosen = items.filter(item => !item.optional || optionalKeys.includes(item.key));
  const count = chosen.reduce((sum, item) => sum + item.quantity * sets, 0);
  const currency = chosen[0]?.currency;
  if (!Number.isInteger(sets) || sets < 1 || sets > 10 || !currency || chosen.some(item =>
    !item.available || item.currency !== currency || item.price === null || item.price.trim() === '' ||
    !Number.isFinite(Number(item.price)) || Number(item.price) < 0)) return {count, total:null};
  try {
    const formatter = new Intl.NumberFormat('en-US', {style:'currency', currency});
    const scale = 10 ** (formatter.resolvedOptions().maximumFractionDigits ?? 2);
    const minor = chosen.reduce((sum, item) => sum + Math.round(Number(item.price) * scale) * item.quantity * sets, 0);
    return {count, total: Number.isSafeInteger(minor) ? formatter.format(minor / scale) : null};
  } catch {return {count, total:null};}
}
