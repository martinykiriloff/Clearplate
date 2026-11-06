import path from "node:path";
import type { NextConfig } from "next";

/**
 * The browser only ever talks to this origin. `/api/*` is proxied to the
 * NestJS API, so the httpOnly session cookie is first-party and OAuth
 * callbacks land on the web origin.
 *
 * Rewrites are resolved at build time: in Docker the API is reachable as
 * http://api:4000 (see Dockerfile build arg), locally on :4000. On Vercel the
 * top-level services rewrite in vercel.json sends /api to the API before this
 * app sees it, and there is no build-time API address to proxy to.
 */
const apiInternalUrl = (process.env.API_INTERNAL_URL ?? "http://localhost:4000").replace(/\/$/, "");
const proxyApi = !process.env.VERCEL;

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  transpilePackages: ["@clearplate/targets"],
  turbopack: {
    root: path.join(__dirname, "../../"),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    // beforeFiles: /api must win over the [lang] dynamic segment.
    const beforeFiles = proxyApi ? [{ source: "/api/:path*", destination: `${apiInternalUrl}/api/:path*` }] : [];
    return { beforeFiles, afterFiles: [], fallback: [] };
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
