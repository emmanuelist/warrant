import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

import { handle, type RelayConfig } from "./relay/relay.ts";

/** The two faces every first paint needs (Latin subsets); the rest load on demand by unicode-range. */
const CRITICAL_FONTS = [
  /mona-sans-latin-standard-normal-[\w-]+\.woff2$/,
  /atkinson-hyperlegible-mono-latin-wght-normal-[\w-]+\.woff2$/,
];

/**
 * Static hosting without rewrites: `/account` gets its own copy of the shell, so a hard reload or
 * a shared link works on any host. Link-preview image tags need an absolute URL, so they are
 * written only when VITE_SITE_URL is set for the build. The critical fonts are preloaded so text
 * paints in its own face instead of swapping (the fallbacks are metric-matched for the rest).
 */
function staticRoutes(): Plugin {
  let siteUrl: string | undefined;
  let base = "/";
  return {
    name: "warrant-static-routes",
    apply: "build",
    enforce: "post",
    configResolved(config) {
      siteUrl = config.env.VITE_SITE_URL as string | undefined;
      base = config.base;
    },
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const fonts = Object.keys(ctx.bundle ?? {}).filter((file) => CRITICAL_FONTS.some((pattern) => pattern.test(file)));
        const preload = fonts.map((file) => `    <link rel="preload" href="${base}${file}" as="font" type="font/woff2" crossorigin />\n`).join("");
        const site = siteUrl?.replace(/\/$/, "");
        const social = site
          ? `    <meta property="og:url" content="${site}/" />\n    <meta property="og:image" content="${site}/og.png" />\n    <meta name="twitter:image" content="${site}/og.png" />\n`
          : "";
        return html.replace("</head>", `${preload}${social}  </head>`);
      },
    },
    generateBundle(_options, bundle) {
      const shell = bundle["index.html"];
      if (shell?.type !== "asset") this.error("index.html was not emitted before warrant-static-routes ran");
      this.emitFile({ type: "asset", fileName: "account/index.html", source: shell.source });
    },
  };
}

/**
 * Dev only: serves the relayer (relay/relay.ts, D-030) at /api/relay with the devnet account and
 * key that tests/devnet.rs writes. They have no VITE_ prefix, so they never reach the bundle.
 */
function devRelay(): Plugin {
  return {
    name: "warrant-dev-relay",
    apply: "serve",
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.envDir, "");
      if (!env.RELAY_ACCOUNT_ID || !env.RELAY_SECRET_KEY) return;
      const cfg: RelayConfig = {
        rpcUrls: [env.VITE_RPC_URL ?? ""],
        intents: env.VITE_INTENTS_CONTRACT ?? "",
        options: env.VITE_OPTIONS_CONTRACT ?? "",
        accountId: env.RELAY_ACCOUNT_ID,
        secretKey: env.RELAY_SECRET_KEY,
      };
      server.middlewares.use("/api/relay", (incoming, res) => {
        // Node's request is an async iterable of byte chunks (no @types/node in this project).
        const req = incoming as unknown as AsyncIterable<Uint8Array<ArrayBuffer>> & { method?: string };
        void (async () => {
          const chunks: Uint8Array<ArrayBuffer>[] = [];
          for await (const chunk of req) chunks.push(chunk);
          const body = req.method === "POST" ? new Blob(chunks) : undefined;
          const response = await handle(new Request("http://localhost/api/relay", { method: req.method, body }), cfg);
          res.statusCode = response.status;
          res.setHeader("content-type", "application/json");
          res.end(await response.text());
        })();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), staticRoutes(), devRelay()],
});
