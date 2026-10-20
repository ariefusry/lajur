import "server-only";
import { PDFParse } from "pdf-parse";
// A static import, so the deploy bundle includes @napi-rs/canvas: pdf.js needs it for DOMMatrix on Node, and
// without it every upload failed on Vercel with "DOMMatrix is not defined".
import { CanvasFactory } from "pdf-parse/worker";

/** Best-effort text extraction; scanned/broken PDFs return null instead of failing the upload. */
export async function extractPdfText(bytes: Uint8Array): Promise<string | null> {
  // pdf.js may transfer/detach the buffer it gets, so hand it a copy.
  const parser = new PDFParse({ data: bytes.slice(), CanvasFactory });
  try {
    // Default joiner inserts "-- 1 of 2 --" markers into the text.
    const { text } = await parser.getText({ pageJoiner: "\n" });
    return text.trim() || null;
  } catch (error) {
    console.warn("pdf text extraction failed", error instanceof Error ? error.message : error);
    return null;
  } finally {
    await parser.destroy();
  }
}
