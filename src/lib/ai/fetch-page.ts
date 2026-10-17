import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class FetchPageError extends Error {}

const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 3;

/** True for loopback, private, link-local, CGNAT, multicast/reserved and unspecified addresses. */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivateAddress(v.slice(7)); // IPv4-mapped
    return v === "::" || v === "::1" || /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith("ff");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

// ponytail: resolve-then-fetch leaves a DNS-rebinding window; pin the resolved IP if this ever handles untrusted traffic at scale.
async function assertPublicUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchPageError("URL tidak valid.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new FetchPageError("URL harus http atau https.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (!addresses.length) throw new FetchPageError("Alamat situs tidak ditemukan.");
  if (addresses.some(isPrivateAddress)) throw new FetchPageError("URL ini tidak bisa diambil.");
  return url;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)\b[^>]*>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

const JOB_KEYWORDS =
  /kualifikasi|persyaratan|syarat|requirements?|qualifications?|deskripsi pekerjaan|job description|tanggung jawab|responsibilit|rincian lowongan|jurusan|ipk|pendidikan|pengalaman|batas (akhir )?pendaftaran|deadline|penempatan|apply|lamar/gi;

/**
 * Long pages (menus, filters, lists of other vacancies) can bury the ad far past the length cap: on one real
 * site it started at char 122k of 125k, after a filter repeating "pendidikan" 105 times. Picks the `max`-char
 * window with the most *distinct* job keywords (an ad mentions many kinds; a filter repeats one).
 */
export function focusJobText(text: string, max: number): string {
  if (text.length <= max) return text;
  const hits = [...text.matchAll(JOB_KEYWORDS)].map((m) => ({ at: m.index!, word: m[0].toLowerCase() }));
  if (!hits.length) return text.slice(0, max);
  const LEAD = 1500; // keep the title/heading just above the first keyword
  let best = 0;
  let bestScore = -1;
  // ponytail: O(hits²) scan; fine for a few hundred keyword hits per page.
  for (const h of hits) {
    const start = Math.min(Math.max(0, h.at - LEAD), text.length - max);
    const inWindow = hits.filter((x) => x.at >= start && x.at < start + max);
    const score = new Set(inWindow.map((x) => x.word)).size * 1000 + inWindow.length; // distinct first, then volume
    if (score > bestScore) {
      bestScore = score;
      best = start;
    }
  }
  return text.slice(best, best + max);
}

type JsonLd = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * Many job sites render with JavaScript but embed the full ad as schema.org JobPosting JSON-LD (for Google Jobs).
 * Returns it as readable text, or "" if the page has none.
 */
export function jobPostingFromJsonLd(html: string): string {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const nodes: JsonLd[] = blocks.flatMap(([, json]) => {
    try {
      const data = JSON.parse(json);
      return (Array.isArray(data) ? data : [data, ...(Array.isArray(data?.["@graph"]) ? data["@graph"] : [])]) as JsonLd[];
    } catch {
      return [];
    }
  });
  const posting = nodes.find((n) => [n?.["@type"]].flat().includes("JobPosting"));
  if (!posting) return "";

  const org = posting.hiringOrganization as JsonLd | undefined;
  const places = [posting.jobLocation].flat().filter(Boolean) as JsonLd[];
  const location = places
    .map((p) => {
      const a = (p.address ?? {}) as JsonLd;
      return [str(a.addressLocality), str(a.addressRegion), str(a.addressCountry)].filter(Boolean).join(", ");
    })
    .filter(Boolean)
    .join("; ");
  return [
    str(posting.title) && `Posisi: ${str(posting.title)}`,
    str(org?.name) && `Perusahaan: ${str(org?.name)}`,
    location && `Lokasi: ${location}`,
    str(posting.validThrough) && `Batas pendaftaran: ${str(posting.validThrough).slice(0, 10)}`,
    htmlToText(str(posting.description)),
    str(posting.qualifications) && htmlToText(str(posting.qualifications)),
  ]
    .filter(Boolean)
    .join("\n");
}

/** Fetches a public job page and returns its visible text (caller normalizes and caps length). */
export async function fetchJobPageText(raw: string): Promise<string> {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(url, {
      redirect: "manual", // re-validate every redirect target
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Lamarin/1.0)", Accept: "text/html,text/plain" },
    }).catch(() => {
      throw new FetchPageError("Halaman tidak bisa diambil. Salin teks lowongannya saja.");
    });

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = await assertPublicUrl(new URL(res.headers.get("location")!, url).toString());
      continue;
    }
    if (!res.ok) throw new FetchPageError(`Situs menolak permintaan (HTTP ${res.status}). Salin teks lowongannya saja.`);
    if (!/text\/(html|plain)/.test(res.headers.get("content-type") ?? "")) {
      throw new FetchPageError("Halaman bukan teks/HTML. Salin teks lowongannya saja.");
    }
    if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) throw new FetchPageError("Halaman terlalu besar.");
    const body = (await res.text()).slice(0, MAX_BYTES);
    if (!res.headers.get("content-type")!.includes("html")) return body;
    // Structured JobPosting first (complete even on JS-rendered pages), the page title (often names the
    // company), then the most job-like part of the visible text.
    const title = htmlToText(body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
    const visible = htmlToText(body).replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n");
    return [jobPostingFromJsonLd(body), title && `Judul halaman: ${title}`, focusJobText(visible, 18_000)]
      .filter(Boolean)
      .join("\n\n");
  }
  throw new FetchPageError("Terlalu banyak redirect.");
}
