/// <reference types="vite/client" />
/// <reference types="react-router" />

import type { CacheInstance } from "@shopify/hydrogen";

import type { Env as AppEnv } from "./app/lib/env";

type RequestContext = {
  cache: CacheInstance;
  env: Env;
  waitUntil: WaitUntil;
};

declare module "react-router" {
  interface AppLoadContext extends RequestContext {}
  interface RouterContextProvider extends RequestContext {}
}

declare global {
  interface Env extends AppEnv {}
  /** Keeps background work (cache refreshes, analytics) running after the response. */
  type WaitUntil = (promise: Promise<unknown>) => void;
  /** What the Node server passes to server.ts for each request. */
  type ServerContext = { cache: CacheInstance; waitUntil: WaitUntil };
}
