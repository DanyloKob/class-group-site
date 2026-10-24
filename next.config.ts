import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js locks a single dev server per distDir (keyed by path, not port) -
  // running 3 concurrent `next dev` instances from this same project for the
  // 3 local role ports needs 3 distinct build directories to avoid tripping
  // that lock. See package.json's "dev" script for NEXT_DIST_DIR per port.
  distDir: process.env.NEXT_DIST_DIR || ".next",

  // Trims the production build to a self-contained server + only the
  // node_modules it actually uses (see .next/standalone) instead of the full
  // node_modules tree - the prod VM is a 1GB-RAM Always Free instance, so a
  // smaller footprint on disk and at boot matters there.
  output: "standalone",

  // sharp ships native (.node) binary addons - bundling it (webpack or
  // Turbopack) fails because the bundler tries to statically chunk its
  // internal module-loading code. Keep it as a real Node `require` at
  // runtime instead of a bundled module.
  serverExternalPackages: ["sharp"],

  images: {
    // Configuring localPatterns at all turns it into an allowlist - every
    // local path rendered through next/image needs its own entry here, or
    // it silently 400s (this bit the login page's static emblem once
    // already, when only /uploads/** was listed).
    localPatterns: [
      // Avatar URLs carry a "?v=<timestamp>" cache-buster (a fresh Telegram
      // sync must never show the old, browser/optimizer-cached photo), and
      // that value is different on every refresh - there's no fixed string
      // to pin `search` to. `search` is deliberately omitted (allow-any)
      // rather than pinned, but the risk that opens is scoped tightly by
      // `pathname`: this only ever covers server-written upload filenames,
      // never a user-supplied path.
      { pathname: "/uploads/**" },
      // Static build asset, never has a query string - pin `search` to
      // exact-empty for the tighter of the two allowances above.
      { pathname: "/emblem.png", search: "" },
    ],
  },
};

export default nextConfig;
