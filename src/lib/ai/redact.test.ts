import { describe, expect, it } from "vitest";
import { MAX_REDACTED_CHARS, redact } from "./redact";

const CV = `Rina Kartika Sari
rina.kartika+cv@contohmail.com | +62 812-3456-7890 | 0857 1234 5678 | 62-813.9876.5432
linkedin.com/in/rina-kartika · https://github.com/rinakartika · www.rinakartika.dev
Jl. Kenanga No. 12 RT 03/RW 05, Kel. Margahayu, Kec. Bekasi Timur
Kota Bekasi, Jawa Barat 17113
NIK: 3275 0123 4567 8901

PROFIL
Rina adalah lulusan Informatika yang antusias.

PENDIDIKAN
S1 Informatika, Universitas Gunadarma, IPK 3.45

KEAHLIAN
TypeScript, React.js, Next.js, PostgreSQL, Docker, Git

PENGALAMAN KERJA
Frontend Developer Intern - PT Contoh Digital (2024 - 2025)
- Membangun dashboard dengan React; dipuji Pak Budi sebagai "kerja Rina rapi"
- Kontak atasan: budi@contoh.co.id, 0812 9999 8888

PROYEK
Lamarin - tracker lamaran kerja (Next.js, Prisma), demo di lamarin.vercel.app

REFERENSI
Budi Santoso - 0811 2222 3333`;

const out = redact(CV, "Rina Kartika Sari");

describe("redact", () => {
  it("leaves no email, phone number, URL or ID number", () => {
    expect(out).not.toMatch(/@/);
    expect(out).not.toMatch(/0812|0857|0813|0811|\+62|62-813|3456|7890|9999/);
    expect(out).not.toMatch(/linkedin|github|https?:|www\.|\.dev|\.app|\.co\.id/i);
    expect(out).not.toMatch(/3275|8901/);
  });

  it("leaves no part of the owner's name, in any case", () => {
    expect(out).not.toMatch(/rina|kartika|sari/i);
    const lower = redact("KEAHLIAN\nSQL (rina) dan RINA-style", "Rina");
    expect(lower).not.toMatch(/rina/i);
  });

  it("drops address lines", () => {
    expect(out).not.toMatch(/Kenanga|RT 03|Margahayu|Bekasi|17113/);
  });

  it("keeps only skills/experience/project sections", () => {
    expect(out).toContain("KEAHLIAN");
    expect(out).toContain("TypeScript, React.js, Next.js, PostgreSQL, Docker, Git");
    expect(out).toContain("Frontend Developer Intern - PT Contoh Digital (2024 - 2025)");
    expect(out).toContain("Lamarin - tracker lamaran kerja (Next.js, Prisma)");
    // Profile, education and references are not relevant to a skill match.
    expect(out).not.toMatch(/antusias|Gunadarma|Santoso/);
  });

  it("keeps years and short numbers", () => {
    expect(out).toContain("2024 - 2025");
    expect(redact("PENGALAMAN\nMenangani 1200 transaksi per hari", null)).toContain("1200");
  });

  it("falls back to the whole (scrubbed) text when there are no headings", () => {
    const flat = redact("Budi Santoso\nbudi@mail.com\nPython, SQL, Excel\nAnalis data 2 tahun", "Budi Santoso");
    expect(flat).toContain("Python, SQL, Excel");
    expect(flat).not.toMatch(/budi|santoso|@/i);
  });

  it("caps the output length", () => {
    expect(redact(`SKILLS\n${"SQL, ".repeat(5000)}`, null).length).toBeLessThanOrEqual(MAX_REDACTED_CHARS);
  });
});
