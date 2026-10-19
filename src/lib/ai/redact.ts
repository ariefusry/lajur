/**
 * Strips personal data from CV text before any of it reaches an LLM: only the skills/experience-type sections
 * leave, with address lines dropped and contact details, ID numbers and the owner's name/address swapped for
 * placeholders.
 */
import { escapeRegExp } from "../text.ts";

export const MAX_REDACTED_CHARS = 6000;

const RELEVANT_HEADING =
  /^(skills?|technical skills?|hard skills?|keahlian|kemampuan|kompetensi|experiences?|work experiences?|professional experiences?|pengalaman( kerja| profesional| organisasi)?|projects?|proyek|portofolio proyek|organi[sz]ations?|organisasi|organizational experiences?|certifications?|sertifikasi)$/i;
const OTHER_HEADING =
  /^(profil|profile|about( me)?|tentang( saya)?|summary|ringkasan|contacts?|kontak|data diri|personal (data|information|details)|informasi pribadi|education|pendidikan|riwayat pendidikan|references?|referensi|hobbies|hobi|interests?|minat|languages?|bahasa|awards?|penghargaan)$/i;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// +62 / 62 / 08xx numbers with spaces, dots or dashes in between.
const PHONE = /(?:\+?62|\b0)[\s.-]?8\d{1,3}(?:[\s.-]?\d{2,5}){2,3}\b/g;
const URL =
  /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|id|io|dev|me|net|org|co|app|site|xyz|tech)(?:\/\S*)?/gi;
const CRED_LABEL = String.raw`(?:user ?name|user[- ]?id|login id|password|kata sandi|pin|token|kode akses|kode id|kode peserta|access code|passcode|id peserta|nomor peserta|no\.? peserta)\b`;
// A token, minus the full stop or comma that ends the sentence around it.
const VALUE = String.raw`\S*[^\s.,;)]`;
// "Label … : value" carrying login credentials or participant codes, with a few words allowed before the separator
// ("Password Anda :", "Kata Sandi (case sensitive) :"). The value is one token, or two after a paired label
// ("Username/Password : budi01 / Xk9pqL77").
const CREDENTIAL = new RegExp(
  String.raw`(\b${CRED_LABEL}[^:=：?\n]{0,30}?[^\S\r\n]*[:=：][^\S\r\n]*)(${VALUE})((?:[^\S\r\n]*(?:\/|\bdan\b)[^\S\r\n]*)(${VALUE}))?`,
  "gi",
);
const PAIRED_LABEL = /\/|\bdan\b/i;
// A table pasted from Gmail: the label alone on its line, the value alone on the next.
const CREDENTIAL_BELOW = new RegExp(
  String.raw`^([^\S\r\n]*${CRED_LABEL}[^\S\r\n]*[:：]?[^\S\r\n]*\r?\n[^\S\r\n]*)(?!${CRED_LABEL})(\S+)(?=[^\S\r\n]*(?:\r?\n|$))`,
  "gim",
);
// NIK (16 digits) and other long ID numbers, allowing separators.
const LONG_NUMBER = /\b\d(?:[\s.-]?\d){9,}\b/g;
const ADDRESS_LINE =
  /\b(jl|jln|jalan)\b\.?|\brt\.?\s*\/?\s*rw\b|\brt\.?\s*\d+\s*\/\s*rw|\b(kel|kec|kab)\.|\b(kelurahan|kecamatan|kabupaten|kota|kode\s?pos)\b|,\s*\d{5}\b/i;

const isHeading = (line: string) => line.length <= 40 && /^[\p{L} &/]+:?$/u.test(line);
const headingText = (line: string) => line.replace(/:$/, "").trim();

/** Keeps only relevant sections; if the CV has no recognizable headings, keeps everything (still scrubbed). */
function relevantSections(lines: string[]): string[] {
  const hasHeadings = lines.some(
    (l) => isHeading(l) && (RELEVANT_HEADING.test(headingText(l)) || OTHER_HEADING.test(headingText(l))),
  );
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

/** Whole-word, case-insensitive match of any of the given words. */
function wordsRegExp(words: string[]) {
  const alts = [...new Set(words)].sort((a, b) => b.length - a.length).map(escapeRegExp);
  return alts.length ? new RegExp(`(?<![\\p{L}])(?:${alts.join("|")})(?![\\p{L}])`, "giu") : null;
}

/** Placeholder → the original text it replaced, for putting personal data back into the AI's answer. */
export type PiiMap = Record<string, string>;
export type KnownPii = { name?: string | null; address?: string | null };

export const PLACEHOLDER = /\[(?:EMAIL|PHONE|URL|ID|NAME|ADDRESS|CRED)_\d+\]/g;

/**
 * Swaps personal data for numbered placeholders ([EMAIL_1], [PHONE_1], [NAME_1], …): emails, Indonesian phone
 * numbers, URLs, long ID numbers (NIK), login credentials and participant codes ([CRED_1]), and the user's own name
 * and address from the profile.
 * The same value always gets the same placeholder.
 */
export function redactPII(text: string, known: KnownPii = {}): { text: string; map: PiiMap } {
  const map: PiiMap = {};
  const seen = new Map<string, string>();
  const counts: Record<string, number> = {};
  const swap = (kind: string) => (value: string) => {
    let placeholder = seen.get(`${kind}\0${value}`);
    if (!placeholder) {
      counts[kind] = (counts[kind] ?? 0) + 1;
      placeholder = `[${kind}_${counts[kind]}]`;
      seen.set(`${kind}\0${value}`, placeholder);
      map[placeholder] = value;
    }
    return placeholder;
  };

  // Every word of the name (3+ letters): "Rina Kartika Sari" → rina|kartika|sari. The address as a whole.
  const NAME = wordsRegExp((known.name ?? "").split(/[\s.,]+/).filter((w) => w.length >= 3));
  const ADDRESS = wordsRegExp(known.address?.trim() ? [known.address.trim()] : []);

  // Credentials first, so a password that looks like a URL or long number still becomes CRED.
  const cred = swap("CRED");
  let out = text
    .replace(CREDENTIAL, (_, label: string, value: string, pair: string | undefined, second: string | undefined) =>
      pair && PAIRED_LABEL.test(label)
        ? label + cred(value) + pair.slice(0, -second!.length) + cred(second!)
        : label + cred(value) + (pair ?? ""),
    )
    .replace(CREDENTIAL_BELOW, (_, label: string, value: string) => label + cred(value))
    .replace(EMAIL, swap("EMAIL"))
    .replace(URL, swap("URL"))
    .replace(PHONE, swap("PHONE"))
    .replace(LONG_NUMBER, swap("ID"));
  if (ADDRESS) out = out.replace(ADDRESS, swap("ADDRESS"));
  if (NAME) out = out.replace(NAME, swap("NAME"));
  // The same credential written again without its label ("Gunakan Qm7rT2xa sekali saja").
  for (const [placeholder, value] of Object.entries(map)) {
    if (!placeholder.startsWith("[CRED_") || value.length < 4 || !/[\p{L}\p{N}]/u.test(value)) continue;
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(value)}(?![\\p{L}\\p{N}])`, "gu"), placeholder);
  }
  return { text: out, map };
}

/** Puts the originals back into text the AI wrote from redacted input. Unknown placeholders stay as they are. */
export function rehydrate(text: string, map: PiiMap): string {
  return text.replace(PLACEHOLDER, (p) => map[p] ?? p);
}

/**
 * CV text for an LLM: only the relevant sections, address lines dropped, everything personal swapped for
 * placeholders (redactPII), capped in length.
 */
export function redact(cvText: string, known: KnownPii = {}): { text: string; map: PiiMap } {
  const lines = cvText
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean);

  const { text, map } = redactPII(
    relevantSections(lines)
      .filter((l) => !ADDRESS_LINE.test(l))
      .join("\n"),
    known,
  );
  const kept = text
    .split("\n")
    // Drop lines that were nothing but contact details.
    .filter((l) => l.replace(PLACEHOLDER, "").replace(/[\s|,•·-]/g, "").length > 0);

  return { text: kept.join("\n").slice(0, MAX_REDACTED_CHARS), map };
}
