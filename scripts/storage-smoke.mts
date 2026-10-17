// End-to-end check of src/lib/storage.ts against the real Neon bucket:
// upload a tiny PDF, fetch it via presigned URL, compare bytes, delete it.
// Run: pnpm storage:smoke
import { deleteObject, presignGet, putPdf } from "../src/lib/storage.ts";

const pdf = new TextEncoder().encode(
  "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);
const key = `smoke/${Date.now()}.pdf`;

await putPdf(key, pdf);
console.log("uploaded", key, pdf.byteLength, "bytes");

const url = await presignGet(key);
console.log("presigned host:", new URL(url).host);
const res = await fetch(url);
const got = new Uint8Array(await res.arrayBuffer());
const same = Buffer.from(got).equals(Buffer.from(pdf));
console.log("GET", res.status, res.headers.get("content-type"), "match:", same);

const anon = await fetch(url.split("?")[0]);
console.log("unsigned GET (should be 403):", anon.status);

await deleteObject(key);
const after = await fetch(await presignGet(key));
console.log("after delete GET (should be 404):", after.status);

if (!same || res.status !== 200 || anon.status < 400 || after.status !== 404) {
  process.exit(1);
}
console.log("storage OK");
