import type {Selection} from './sendthecart.server';

export function canApplyAutomatically(selection: Selection): boolean {
  return selection.review_required === false && !selection.reorder
    && selection.items.length > 0 && selection.items.every(item => !item.optional && item.available);
}
export function automaticFields(selection: Selection): Record<string,string> {
  if (!canApplyAutomatically(selection)) throw new Error('review');
  return {review_ticket:selection.ticket, ...(selection.recipe_token ? {recipe_token:selection.recipe_token} : {}),
    sets:'1', behavior:selection.behavior};
}
