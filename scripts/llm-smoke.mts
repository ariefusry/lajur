// Live smoke test of the production LLM providers (Groq, Cloudflare Workers AI), each model separately, with two
// made-up postings (Indonesian + English). A provider without a key in .env.local is skipped, not failed.
// Run: pnpm ai:smoke
import { EXTRACT_SYSTEM, ExtractedJob, normalizeJobText, verifyQuotes } from "../src/lib/ai/extract-job.ts";
import { callOnce, configuredRefs, describeError } from "./llm-call.mts";

// Fictional companies and data.
const POSTINGS = [
  {
    name: "id",
    text: `LOWONGAN KERJA — PT Sinar Nusantara Logistik
Posisi: Staf Admin Gudang (Kontrak 1 tahun)
Lokasi: Cikarang, Bekasi (WFO)
Gaji: Rp5.500.000 – Rp6.500.000 per bulan

Kualifikasi:
- Pendidikan minimal D3 semua jurusan
- IPK minimal 2,75
- Usia maksimal 27 tahun per 1 Januari 2027
- Menguasai Microsoft Excel (VLOOKUP, pivot table)
- Bersedia ditempatkan di seluruh cabang Jawa Barat

Kirim lamaran paling lambat 30 November 2026 melalui https://karier.sinarnusantara.example/admin-gudang`,
  },
  {
    name: "en",
    text: `Kopi Kita Digital is hiring a Junior Data Analyst (Full-time, hybrid, Jakarta).

Requirements:
- Bachelor's degree (S1) in Statistics, Mathematics, or Computer Science
- Minimum GPA 3.20
- Solid SQL and Python; experience with Looker Studio is a plus
- Fluent English

Salary: IDR 9–11 million/month. Apply before 15 December 2026.`,
  },
];

const { refs, skipped } = configuredRefs(["groq", "cloudflare"]);
for (const s of skipped) console.log(`SKIP ${s}`);
if (!refs.length) {
  console.log("Tidak ada provider produksi yang bisa diuji. Isi GROQ_* dan/atau CLOUDFLARE_* di .env.local (lihat .env.example).");
  process.exit(0);
}

const rows = [];
for (const ref of refs) {
  for (const posting of POSTINGS) {
    const text = normalizeJobText(posting.text);
    try {
      const r = await callOnce(ref, ExtractedJob, EXTRACT_SYSTEM, text);
      const v = r.data && verifyQuotes(r.data, text);
      rows.push({
        provider: ref.provider,
        model: ref.model,
        posting: posting.name,
        schemaOk: r.data ? "ya" : "tidak",
        ms: r.ms,
        tokensIn: r.tokensIn,
        tokensOut: r.tokensOut,
        found: v ? `${v.company ?? "-"} | ${v.position ?? "-"} | ${v.deadline ?? "-"} | lang=${v.language}` : "",
        quotesKept: v && r.data ? `${v.skills.length + v.requirements.length}/${r.data.skills.length + r.data.requirements.length}` : "",
        error: r.schemaError ?? "",
      });
    } catch (error) {
      rows.push({ provider: ref.provider, model: ref.model, posting: posting.name, schemaOk: "tidak", ms: "", tokensIn: "", tokensOut: "", found: "", quotesKept: "", error: describeError(error) });
    }
  }
}
console.table(rows);
process.exitCode = rows.every((r) => r.schemaOk === "ya") ? 0 : 1;
