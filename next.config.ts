import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf.js (inside pdf-parse) loads its worker at runtime; bundling it breaks that.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
