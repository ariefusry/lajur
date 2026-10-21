import { describe, expect, it } from "vitest";
import { MAX_POSTER_BYTES, parseImageDataUrl, stripThinking } from "./poster";

const dataUrl = (type: string, bytes: number[]) => `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 1, 2, 3];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a];
const WEBP = [...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")];

describe("parseImageDataUrl", () => {
  it("accepts JPEG, PNG and WebP whose bytes match the declared type", () => {
    expect(parseImageDataUrl(dataUrl("image/jpeg", JPEG))?.mediaType).toBe("image/jpeg");
    expect(parseImageDataUrl(dataUrl("image/png", PNG))?.bytes).toEqual(Uint8Array.from(PNG));
    expect(parseImageDataUrl(dataUrl("image/webp", WEBP))?.mediaType).toBe("image/webp");
  });

  it("rejects a mismatched type, other types, non-data URLs and oversized files", () => {
    expect(parseImageDataUrl(dataUrl("image/png", JPEG))).toBeNull();
    expect(parseImageDataUrl(dataUrl("image/gif", [0x47, 0x49, 0x46]))).toBeNull();
    expect(parseImageDataUrl(dataUrl("application/pdf", [0x25, 0x50, 0x44, 0x46]))).toBeNull();
    expect(parseImageDataUrl("https://example.com/poster.jpg")).toBeNull();
    expect(parseImageDataUrl("data:image/jpeg;base64,")).toBeNull();
    expect(parseImageDataUrl(dataUrl("image/jpeg", [...JPEG, ...new Array(MAX_POSTER_BYTES)]))).toBeNull();
  });
});

describe("stripThinking", () => {
  it("drops inline reasoning, closed or cut off", () => {
    expect(stripThinking("<think>hmm</think>\nWE ARE HIRING")).toBe("WE ARE HIRING");
    expect(stripThinking("<think>never closed")).toBe("");
    expect(stripThinking("  plain text  ")).toBe("plain text");
  });
});
