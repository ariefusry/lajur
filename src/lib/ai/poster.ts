/** Job posters (e.g. Instagram) are transcribed by a vision model, then go through the normal text extraction. */

export const POSTER_SYSTEM =
  "Salin semua teks yang ada di gambar poster lowongan ini persis apa adanya, baris per baris, dalam bahasa aslinya. " +
  "Jangan menerjemahkan, meringkas, menambah, atau memberi komentar. Kalau tidak ada teks, balas dengan string kosong.";

// The client re-encodes to JPEG at ≤2000 px (a few hundred KB); this only stops abuse below Vercel's 4.5 MB body cap.
export const MAX_POSTER_BYTES = 3_000_000;

const MAGIC: Record<string, (b: Uint8Array) => boolean> = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  "image/webp": (b) =>
    String.fromCharCode(...b.subarray(0, 4)) === "RIFF" && String.fromCharCode(...b.subarray(8, 12)) === "WEBP",
};

/** "data:image/jpeg;base64,…" → bytes, only when the declared type matches the file's magic bytes. */
export function parseImageDataUrl(dataUrl: string): { bytes: Uint8Array; mediaType: string } | null {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!m) return null;
  const bytes = Uint8Array.from(Buffer.from(m[2], "base64"));
  if (bytes.length === 0 || bytes.length > MAX_POSTER_BYTES || !MAGIC[m[1]](bytes)) return null;
  return { bytes, mediaType: m[1] };
}

/** Some reasoning models put their thinking inline; only the transcription is kept. */
export const stripThinking = (text: string) => text.replace(/<think>[\s\S]*?(<\/think>|$)/gi, "").trim();
