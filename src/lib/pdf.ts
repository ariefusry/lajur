export const MAX_PDF_BYTES = 4 * 1024 * 1024; // Vercel request body limit is ~4.5 MB

/** Returns an Indonesian error message, or null if the upload is an acceptable PDF. */
export function validatePdf(bytes: Uint8Array, mimeType: string): string | null {
  if (mimeType !== "application/pdf") return "File harus berformat PDF.";
  if (bytes.byteLength === 0) return "File kosong.";
  if (bytes.byteLength > MAX_PDF_BYTES) return "Ukuran file maksimal 4 MB.";
  // Magic bytes: "%PDF"
  if (bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) {
    return "Isi file bukan PDF yang valid.";
  }
  return null;
}
