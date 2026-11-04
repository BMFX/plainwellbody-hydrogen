import {envContext} from '~/lib/env';
import {storefrontClientContext} from '~/lib/storefront';
import {requestTimingContext} from '~/lib/request-timing';
import {loadSelection} from '~/lib/sendthecart.server';
import type {Route} from './+types/popup-selection';

export async function loader({context, params, request}: Route.LoaderArgs) {
  const headers = {'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer'};
  try {
    const selection = await loadSelection(context.get(envContext), params.token!, request,
      context.get(storefrontClientContext), context.get(requestTimingContext));
    return Response.json({selection}, {headers});
  } catch {
    // A failed preview stays in the modal and never writes to the cart.
    return Response.json({failed:true}, {status:404, headers});
  }
}
