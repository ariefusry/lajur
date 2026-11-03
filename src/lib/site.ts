/** Public base URL of the app (APP_URL, else production), without a trailing slash. Shared by metadata, robots, and sitemap. */
export const SITE_URL = (process.env.APP_URL || "https://lajur.vercel.app").replace(/\/+$/, "");

export const SITE_NAME = "Lajur";

export const SITE_TAGLINE = "Semua lamaran kerjamu, rapi di satu tempat.";

export const SITE_DESCRIPTION =
  "Tracker lamaran kerja gratis untuk pencari kerja di Indonesia. Catat tahap seleksi dari administrasi, psikotes, sampai offering, dapat pengingat deadline dan jadwal tes, dan lihat versi CV mana yang paling sering lolos.";

/** Absolute URL for a path on this site. */
export function absoluteUrl(path = "/"): string {
  return new URL(path, `${SITE_URL}/`).toString();
}

/** Open Graph fields every page repeats: a page's own `openGraph` replaces the root one instead of merging with it. */
export const OPEN_GRAPH_BASE = { type: "website", locale: "id_ID", siteName: SITE_NAME } as const;

/**
 * The shared preview image (app/opengraph-image.tsx). A page whose segment has no image file of its own, and that sets
 * `openGraph`, loses the inherited image, so it adds this one back.
 */
export const OG_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: `${SITE_NAME}: ${SITE_TAGLINE}` };

/** For pages behind login (and the onboarding wizard): keep them out of search results. */
export const NO_INDEX = { index: false, follow: false } as const;
