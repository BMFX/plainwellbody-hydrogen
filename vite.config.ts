import { createRequestListener } from "@mjackson/node-fetch-server";
import { reactRouter } from "@react-router/dev/vite";
import { localHttps } from "@shopify/hydrogen/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv, type Plugin } from "vite";

import { createMemoryCache, publicRequest } from "./scripts/runtime.mjs";

const enabled = process.env.npm_lifecycle_event === "dev:https";
const httpsOptions = { enabled };

// Local development runs server.ts the way production does (scripts/serve.mjs): a Node
// request handler with the same bounded cache and request handling, so dev and Coolify
// share one runtime.
function nodeServer(): Plugin {
  return {
    name: "plainwell:node-server",
    configureServer(server) {
      const cache = createMemoryCache();
      const waitUntil = (promise: Promise<unknown>) => {
        Promise.resolve(promise).catch((error) => console.error("Background task failed", error));
      };
      const listener = createRequestListener(async (request, client) => {
        const { default: worker } = await server.ssrLoadModule("./server.ts");
        return worker.fetch(publicRequest(request, client.address, false), process.env, { cache, waitUntil });
      });
      // A post hook, so Vite serves its own modules and assets first.
      return () => {
        server.middlewares.use((req, res) => void listener(req, res));
      };
    },
  };
}

export default defineConfig(({ mode, isSsrBuild }) => {
  // .env for local development; variables already set in the shell win.
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), ""))) process.env[key] ??= value;

  return {
    plugins: [localHttps(httpsOptions), tailwindcss(), nodeServer(), reactRouter()],
    resolve: {
      tsconfigPaths: true,
    },
    build: {
      // Allow a strict Content-Security-Policy
      // without inlining assets as base64:
      assetsInlineLimit: 0,
      // The server build's entry is server.ts, which scripts/serve.mjs runs.
      ...(isSsrBuild ? { rollupOptions: { input: "./server.ts" } } : {}),
    },
    ssr: {
      optimizeDeps: {
        /**
         * Include dependencies here if they throw CJS<>ESM errors.
         * For example, for the following error:
         *
         * > ReferenceError: module is not defined
         * >   at /Users/.../node_modules/example-dep/index.js:1:1
         *
         * Include 'example-dep' in the array below.
         * @see https://vitejs.dev/config/dep-optimization-options
         */
        include: [
          "react",
          "react/jsx-runtime",
          "react/jsx-dev-runtime",
          "react-dom",
          "react-dom/server",
          "react-router > set-cookie-parser",
          "react-router > cookie",
          "react-router",
        ],
      },
    },
    server: {
      allowedHosts: [".tryhydrogen.dev"],
    },
  };
});
