import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/donasi"), changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/login"), changeFrequency: "yearly", priority: 0.3 },
  ];
}
