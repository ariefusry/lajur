/**
 * Strips personal data from CV text before any of it reaches an LLM (CLAUDE.md rule 7a / 7.5).
 * Free model endpoints may train on what they receive, so only the skills/experience-type sections leave,
 * with contact details, addresses, ID numbers and the owner's name removed.
 */

export const MAX_REDACTED_CHARS = 6000;

const RELEVANT_HEADING =
  /^(skills?|technical skills?|hard skills?|keahlian|kemampuan|kompetensi|experiences?|work experiences?|professional experiences?|pengalaman( kerja| profesional| organisasi)?|projects?|proyek|portofolio proyek|organi[sz]ations?|organisasi|organizational experiences?|certifications?|sertifikasi)$/i;
const OTHER_HEADING =
  /^(profil|profile|about( me)?|tentang( saya)?|summary|ringkasan|contacts?|kontak|data diri|personal (data|information|details)|informasi pribadi|education|pendidikan|riwayat pendidikan|references?|referensi|hobbies|hobi|interests?|minat|languages?|bahasa|awards?|penghargaan)$/i;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// +62 / 62 / 08xx numbers with spaces, dots or dashes in between.
const PHONE = /(?:\+?62|\b0)[\s.-]?8\d{1,3}(?:[\s.-]?\d{2,5}){2,3}\b/g;
const URL = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|id|io|dev|me|net|org|co|app|site|xyz|tech)(?:\/\S*)?/gi;
// NIK (16 digits) and other long ID numbers, allowing separators.
const LONG_NUMBER = /\b\d(?:[\s.-]?\d){9,}\b/g;
const ADDRESS_LINE =
  /\b(jl|jln|jalan)\b\.?|\brt\.?\s*\/?\s*rw\b|\brt\.?\s*\d+\s*\/\s*rw|\b(kel|kec|kab)\.|\b(kelurahan|kecamatan|kabupaten|kota|kode\s?pos)\b|,\s*\d{5}\b/i;

const isHeading = (line: string) => line.length <= 40 && /^[\p{L} &/]+:?$/u.test(line);
const headingText = (line: string) => line.replace(/:$/, "").trim();

/** Keeps only relevant sections; if the CV has no recognizable headings, keeps everything (still scrubbed). */
function relevantSections(lines: string[]): string[] {
  const hasHeadings = lines.some((l) => isHeading(l) && (RELEVANT_HEADING.test(headingText(l)) || OTHER_HEADING.test(headingText(l))));
  if (!hasHeadings) return lines;
  const kept: string[] = [];
  let inRelevant = false; // text before the first heading (name, contacts) is dropped
  for (const line of lines) {
    if (isHeading(line)) {
      const h = headingText(line);
      if (RELEVANT_HEADING.test(h)) {
        inRelevant = true;
        kept.push(h);
        continue;
      }
      if (OTHER_HEADING.test(h)) {
        inRelevant = false;
        continue;
      }
    }
    if (inRelevant) kept.push(line);
  }
  return kept;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function redact(cvText: string, ownerName: string | null): string {
  const lines = cvText
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean);

  // Every word of the owner's name (3+ letters), case-insensitive: "Rina Kartika Sari" → rina|kartika|sari.
  const nameWords = (ownerName ?? "")
    .split(/[\s.,]+/)
    .filter((w) => w.length >= 3)
    .map(escapeRegExp);
  const NAME = nameWords.length ? new RegExp(`(?<![\\p{L}])(?:${nameWords.join("|")})(?![\\p{L}])`, "giu") : null;

  const scrubbed = relevantSections(lines)
    .filter((l) => !ADDRESS_LINE.test(l))
    .map((l) => {
      let out = l.replace(EMAIL, "[email]").replace(URL, "[url]").replace(PHONE, "[telepon]").replace(LONG_NUMBER, "[angka]");
      if (NAME) out = out.replace(NAME, "[nama]");
      return out;
    })
    // Drop lines that were nothing but contact details.
    .filter((l) => l.replace(/\[(email|url|telepon|angka|nama)\]|[\s|,•·-]/g, "").length > 0);

  return scrubbed.join("\n").slice(0, MAX_REDACTED_CHARS);
}
