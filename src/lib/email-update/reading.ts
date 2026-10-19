import { z } from "zod";
import { rehydrate, type PiiMap } from "../ai/redact.ts";
import { fold } from "../text.ts";

// Same budget as job postings: with the prompt and the answer this stays inside Groq's free 8K tokens/minute.
export const MAX_EMAIL_TEXT = 12_000;

export const EmailReading = z.object({
  company: z.string().nullable(),
  companyQuote: z.string().nullable(),
  position: z.string().nullable(),
  kind: z.enum([
    "TEST_INVITE",
    "DOCUMENT_REQUEST",
    "INTERVIEW",
    "MCU",
    "OFFER",
    "REJECTION",
    "APPLICATION_RECEIVED",
    "OTHER",
  ]),
  kindQuote: z.string(),
  stageName: z.string().nullable(), // as written, e.g. "Online Assessment"
  events: z.array(
    z.object({
      type: z.enum(["DEADLINE", "ONLINE_TEST", "PSYCHOTEST", "LGD", "INTERVIEW_HR", "INTERVIEW_USER", "MCU", "OTHER"]),
      // "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm", Asia/Jakarta. Checked by parseWib, not by the schema.
      opensAt: z.string().nullable(),
      closesAt: z.string(),
      quote: z.string(), // exact substring of the email
    }),
  ),
  notes: z.array(z.string()), // short points; may contain placeholders such as [CRED_1]
  sourceUrl: z.string().nullable(),
});
export type EmailReading = z.infer<typeof EmailReading>;

export const EMAIL_SYSTEM = `Kamu membaca email dari perusahaan kepada pelamar kerja (bahasa Indonesia atau Inggris) dan mengekstrak data terstruktur. Teks email sudah disamarkan: data pribadi diganti placeholder seperti [NAME_1], [EMAIL_1], [URL_1], [CRED_1].

Aturan:
- Hanya ambil informasi yang TERTULIS di email. Kalau tidak ada, isi null atau array kosong. Dilarang menebak, dilarang memberi saran, tanpa basa-basi.
- quote pada setiap event WAJIB memuat tanggal (dan jam, kalau ada) yang dimaksud; untuk rentang waktu, kutip baris penutupnya.
- Setiap "quote" (kindQuote, companyQuote, quote pada events) WAJIB berupa potongan teks yang disalin persis karakter demi karakter dari email. Jangan parafrase, jangan terjemahkan.
- kind: TEST_INVITE (undangan tes online/psikotes), DOCUMENT_REQUEST (permintaan berkas), INTERVIEW, MCU, OFFER, REJECTION (tidak lolos), APPLICATION_RECEIVED (konfirmasi lamaran diterima atau terkirim, termasuk email portal karier yang hanya berisi tabel posisi, perusahaan, dan link), atau OTHER. kindQuote WAJIB berisi kalimat email yang menunjukkan jenis itu (untuk REJECTION: kalimat penolakannya). Hanya kalau email sama sekali tidak punya kalimat seperti itu (misalnya tabel portal), isi "" (string kosong), jangan null.
- stageName: nama tahap seleksi disalin persis seperti ditulis di email, termasuk salah ketik, jangan dikoreksi. Untuk REJECTION, isi dengan tahap terakhir yang diikuti pelamar kalau email menyebutnya (contoh: "terima kasih telah mengikuti seleksi sampai tahap Psikotes" → "Psikotes"), kalau tidak null.
- Untuk APPLICATION_RECEIVED isi company, position, dan sourceUrl (link yang tertulis di email) kalau ada.
- events: jadwal atau batas waktu yang disebut. type: DEADLINE, ONLINE_TEST, PSYCHOTEST, LGD, INTERVIEW_HR, INTERVIEW_USER, MCU, atau OTHER.
- Semua waktu dalam WIB (Asia/Jakarta). Format "YYYY-MM-DD" atau "YYYY-MM-DDTHH:mm" (24 jam). Kalau email hanya menyebut tanggal, isi tanggalnya saja tanpa jam. Kalau tahun tidak disebut, jangan buat event itu.
- Rentang waktu ("dibuka ... ditutup ...", "open ... close ...") ditulis sebagai opensAt (buka) dan closesAt (tutup). Untuk satu waktu saja, opensAt null dan closesAt berisi waktunya.
- Jangan pernah memakai tanggal kirim email atau baris header email (contoh "Fri, Sep 18, 3:22 PM") sebagai jadwal.
- Salin placeholder seperti [CRED_1] atau [URL_1] persis apa adanya, jangan diganti atau ditebak.
- notes: poin singkat berisi instruksi penting, yaitu durasi, syarat perangkat, berkas yang diminta beserta format nama file, dan info login. Tulis link, username, dan password sebagai baris terpisah: "Link: [URL_1]", "Username: [CRED_1]", "Password: [CRED_2]".`;

/** Trim + tidy whitespace; the normalized text is what gets redacted, sent, and quote-checked. */
export function normalizeEmailText(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_EMAIL_TEXT);
}

/** "YYYY-MM-DD" is 23.59 WIB, "YYYY-MM-DDTHH:mm" is that time in WIB (UTC+7, no DST); anything else is null. */
export function parseWib(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(s.trim());
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const [h, mi] = m[4] === undefined ? [23, 59] : [+m[4], +m[5]];
  if (h > 23 || mi > 59) return null;
  const date = new Date(Date.UTC(y, mo - 1, d, h - 7, mi));
  // Rejects overflow such as 30 February.
  const day = new Date(Date.UTC(y, mo - 1, d));
  return day.getUTCMonth() === mo - 1 && day.getUTCDate() === d ? date : null;
}

const hasNumber = (s: string, n: number) => new RegExp(`(?<!\\d)0?${n}(?!\\d)`).test(s);

/**
 * Nothing the model made up survives: quotes must be exact substrings of the (redacted) email (line breaks and
 * case forgiven); an event stays only if its quote carries the closing day (a window quoted by its opening line
 * gets the next line of the email added to its quote); opensAt stays only if it is before closesAt and its day
 * appears in the email; company, position, stage and link are nulled unless written in the email; the kind falls
 * back to OTHER without evidence.
 */
export function verifyReading(r: EmailReading, text: string): EmailReading {
  const haystack = fold(text);
  const found = (q: string | null) => !!q && fold(q).length > 0 && haystack.includes(fold(q));
  const lines = text.split("\n");
  const withNextLine = (q: string) => {
    const i = lines.findIndex((l) => fold(l).includes(fold(q)));
    const next = i < 0 ? undefined : lines.slice(i + 1).find((l) => l.trim());
    return next ? `${lines[i]}\n${next}` : q;
  };
  const kept = r.events.flatMap((e) => {
    const close = parseWib(e.closesAt);
    if (!close || !found(e.quote)) return [];
    const day = +e.closesAt.slice(8, 10);
    const quote = hasNumber(e.quote, day) || !e.opensAt ? e.quote : withNextLine(e.quote);
    if (!hasNumber(quote, day)) return [];
    const open = e.opensAt ? parseWib(e.opensAt) : null;
    const opensOk = !!open && open < close && hasNumber(text, +e.opensAt!.slice(8, 10));
    return [{ ...e, quote, opensAt: opensOk ? e.opensAt : null }];
  });
  // Models sometimes add the close line of a window again as an event of its own.
  const events = kept.filter(
    (e) => e.opensAt || !kept.some((w) => w.opensAt && w.type === e.type && w.closesAt === e.closesAt),
  );
  // Either is enough: models often name the company but leave companyQuote null.
  const companyOk = found(r.companyQuote) || found(r.company);
  const position = found(r.position) ? r.position : null;
  const sourceUrl = found(r.sourceUrl) ? r.sourceUrl : null;
  // A portal's "application received" table has no sentence to quote; the company, position or link written in it
  // is the evidence, and this kind moves no stage.
  const received = r.kind === "APPLICATION_RECEIVED" && (companyOk || !!position || !!sourceUrl);
  return {
    ...r,
    company: companyOk ? r.company : null,
    companyQuote: found(r.companyQuote) ? r.companyQuote : null,
    position,
    stageName: found(r.stageName) ? r.stageName : null,
    sourceUrl,
    kind: found(r.kindQuote) || received ? r.kind : "OTHER",
    events,
  };
}

/** The user's real text back in every field shown on the review screen (dates and the kind stay as they are). */
export function rehydrateReading(r: EmailReading, map: PiiMap): EmailReading {
  const back = (s: string | null) => (s === null ? null : rehydrate(s, map));
  return {
    ...r,
    company: back(r.company),
    companyQuote: back(r.companyQuote),
    position: back(r.position),
    kindQuote: rehydrate(r.kindQuote, map),
    stageName: back(r.stageName),
    events: r.events.map((e) => ({ ...e, quote: rehydrate(e.quote, map) })),
    notes: r.notes.map((n) => rehydrate(n, map)),
    sourceUrl: back(r.sourceUrl),
  };
}
