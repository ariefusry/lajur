import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

// Only the public pages are crawlable; the app behind login also sends noindex ((app)/layout.tsx).
const PRIVATE_PATHS = [
  "/api/",
  "/dashboard",
  "/board",
  "/applications",
  "/calendar",
  "/resumes",
  "/settings",
  "/analytics",
  "/jobs",
  "/mulai",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/", "/donasi", "/login"], disallow: PRIVATE_PATHS },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
