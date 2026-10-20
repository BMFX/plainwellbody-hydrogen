import { createRequestHandler, RouterContextProvider } from "react-router";
import * as serverBuild from "virtual:react-router/server-build";

import { envContext } from "~/lib/env";

/**
 * A Web fetch handler. scripts/serve.mjs (production) and the Vite plugin in
 * vite.config.ts (development) call it with the environment, a cache and waitUntil.
 */
export default {
  async fetch(rawRequest: Request, env: Env, context: ServerContext): Promise<Response> {
    try {
      const request = toPublicRequest(rawRequest);
      const method = request.method;
      if ((method === "GET" || method === "HEAD") && request.body) {
        return new Response(`${method} requests cannot have a body`, { status: 400 });
      }

      const url = new URL(request.url);
      if (url.pathname.includes("//")) {
        return new Response(null, {
          status: 301,
          headers: { location: url.pathname.replace(/[/]+/g, "/") },
        });
      }

      const routerContext = new RouterContextProvider();
      routerContext.cache = context.cache;
      routerContext.set(envContext, env);
      routerContext.env = env;
      routerContext.waitUntil = context.waitUntil;

      const handleRequest = createRequestHandler(serverBuild, process.env.NODE_ENV);
      return handleRequest(request, routerContext as never);
    } catch (error) {
      console.error(error);
      return new Response("An unexpected error occurred", { status: 500 });
    }
  },
};

// Behind a proxy that terminates TLS, such as a tunnel, the worker sees `http:`
// with `x-forwarded-proto: https`. Customer Account OAuth needs the public
// `https:` origin.
function toPublicRequest(request: Request): Request {
  const url = new URL(request.url);
  if (url.protocol !== "http:" || request.headers.get("x-forwarded-proto") !== "https") {
    return request;
  }
  url.protocol = "https:";
  return new Request(url, request);
}
