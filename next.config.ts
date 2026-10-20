import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A separate build dir (NEXT_DIST_DIR=.next-check) lets a production build run while `next dev` uses .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // pdf.js (inside pdf-parse) loads its worker at runtime; bundling it breaks that.
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
};

export default nextConfig;
