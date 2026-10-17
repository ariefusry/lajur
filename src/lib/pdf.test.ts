import { describe, expect, it } from "vitest";
import { MAX_PDF_BYTES, validatePdf } from "./pdf";

const pdf = new TextEncoder().encode("%PDF-1.4 ...");

describe("validatePdf", () => {
  it("accepts a real PDF header", () => {
    expect(validatePdf(pdf, "application/pdf")).toBeNull();
  });
  it("rejects wrong MIME, empty, oversize, and fake PDFs", () => {
    expect(validatePdf(pdf, "image/png")).toMatch(/PDF/);
    expect(validatePdf(new Uint8Array(), "application/pdf")).toMatch(/kosong/);
    const big = new Uint8Array(MAX_PDF_BYTES + 1);
    big.set(pdf);
    expect(validatePdf(big, "application/pdf")).toMatch(/4 MB/);
    expect(validatePdf(new TextEncoder().encode("MZ\x90\x00"), "application/pdf")).toMatch(/bukan PDF/);
  });
});
