import {automaticDocument} from "~/lib/automatic-selection.server";
import {canApplyAutomatically} from "~/lib/automatic-selection";
import type {Selection} from "~/lib/sendthecart.server";

import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import { ServerRouter, type EntryContext, type RouterContextProvider } from "react-router";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  reactRouterContext: EntryContext,
  _context: RouterContextProvider,
) {
  const selection = reactRouterContext.staticHandlerContext.loaderData["routes/sendthecart"]?.selection as Selection | undefined;
  if (request.method === "GET" && responseStatusCode < 400 && !reactRouterContext.staticHandlerContext.errors
    && selection && canApplyAutomatically(selection)) {
    return automaticDocument(request, selection, responseHeaders);
  }
  const body = await renderToReadableStream(
    <ServerRouter context={reactRouterContext} url={request.url} />,
    {
      signal: request.signal,
      onError(error) {
        console.error(error);
        responseStatusCode = 500;
      },
    },
  );

  if (isbot(request.headers.get("user-agent"))) {
    await body.allReady;
  }

  responseHeaders.set("Content-Type", "text/html");

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
