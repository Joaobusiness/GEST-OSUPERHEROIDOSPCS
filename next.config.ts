import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const security = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Not a full script-src CSP: Next injects inline scripts, so that needs nonces (follow-up). These directives are safe now.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: security }];
  },
  // Every page here is per-user (session cookie + tenant data), so nothing is prerendered.
  cacheComponents: false,
  partialPrefetching: false,
  turbopack: {
    root: fileURLToPath(new URL(".", import.meta.url)),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
