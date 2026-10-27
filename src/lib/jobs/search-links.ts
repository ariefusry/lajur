export type SearchProfile = { role: string; skill: string | null; city: string };
/** `logo` is a file in public/portals (vector, or 512px for Kalibrr: the screens show it up to ~120px). */
export type SearchLink = { id: string; portal: string; logo: string; url: string; note: string | null };

/** The search words: the role plus at most one skill (more makes portals return almost nothing). */
export function searchKeywords({ role, skill }: Pick<SearchProfile, "role" | "skill">) {
  return [role, skill]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(" ");
}

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// The profile domicile is "Kota Bekasi"; portals know "Bekasi".
const bareCity = (city: string) => city.trim().replace(/^(kota|kabupaten|kab\.)\s+/i, "");

/**
 * Search pages on the job portals for one role/skill/city. Nothing is fetched: the user's browser opens them.
 * The URL shapes were checked by hand in a browser (2026-10-27); portals change them without notice, so they all
 * live here. Only LinkedIn takes a freshness filter (past week); Kalibrr's path takes no city.
 */
export function buildSearchLinks(profile: SearchProfile): SearchLink[] {
  if (!profile.role.trim()) return [];
  const keywords = searchKeywords(profile);
  const city = bareCity(profile.city);
  const q = encodeURIComponent(keywords);
  return [
    {
      id: "jobstreet",
      logo: "/portals/jobstreet.svg",
      portal: "Jobstreet",
      url: `https://id.jobstreet.com/id/${slug(keywords)}-jobs${city ? `/in-${encodeURIComponent(city)}` : ""}`,
      note: null,
    },
    {
      id: "glints",
      logo: "/portals/glints.svg",
      portal: "Glints",
      url: `https://glints.com/id/opportunities/jobs/explore?keyword=${q.replace(/%20/g, "+")}&country=ID${
        city ? `&locationName=${encodeURIComponent(city)}` : ""
      }`,
      note: null,
    },
    {
      id: "linkedin",
      logo: "/portals/linkedin.svg",
      portal: "LinkedIn",
      url: `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${encodeURIComponent(
        city ? `${city}, Indonesia` : "Indonesia",
      )}&f_TPR=r604800`,
      note: "7 hari terakhir",
    },
    {
      id: "kalibrr",
      logo: "/portals/kalibrr.png",
      portal: "Kalibrr",
      url: `https://www.kalibrr.com/id-ID/job-board/te/${slug(keywords)}/1`,
      note: "tanpa filter kota",
    },
  ];
}
