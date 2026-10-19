import { describe, expect, it } from "vitest";
import { EMAIL_FIXTURES } from "../email-update/fixtures";
import { MAX_REDACTED_CHARS, redact, redactPII, rehydrate } from "./redact";

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
Lajur - tracker lamaran kerja (Next.js, Prisma), demo di lajur.vercel.app

REFERENSI
Budi Santoso - 0811 2222 3333`;

const { text: out, map } = redact(CV, { name: "Rina Kartika Sari" });

describe("redact", () => {
  it("leaves no email, phone number, URL or ID number", () => {
    expect(out).not.toMatch(/@/);
    expect(out).not.toMatch(/0812|0857|0813|0811|\+62|62-813|3456|7890|9999/);
    expect(out).not.toMatch(/linkedin|github|https?:|www\.|\.dev|\.app|\.co\.id/i);
    expect(out).not.toMatch(/3275|8901/);
  });

  it("leaves no part of the owner's name, in any case", () => {
    expect(out).not.toMatch(/rina|kartika|sari/i);
    const lower = redact("KEAHLIAN\nSQL (rina) dan RINA-style", { name: "Rina" }).text;
    expect(lower).not.toMatch(/rina/i);
  });

  it("drops address lines", () => {
    expect(out).not.toMatch(/Kenanga|RT 03|Margahayu|Bekasi|17113/);
  });

  it("keeps only skills/experience/project sections", () => {
    expect(out).toContain("KEAHLIAN");
    expect(out).toContain("TypeScript, React.js, Next.js, PostgreSQL, Docker, Git");
    expect(out).toContain("Frontend Developer Intern - PT Contoh Digital (2024 - 2025)");
    expect(out).toContain("Lajur - tracker lamaran kerja (Next.js, Prisma)");
    // Profile, education and references are not relevant to a skill match.
    expect(out).not.toMatch(/antusias|Gunadarma|Santoso/);
  });

  it("keeps years and short numbers", () => {
    expect(out).toContain("2024 - 2025");
    expect(redact("PENGALAMAN\nMenangani 1200 transaksi per hari").text).toContain("1200");
  });

  it("falls back to the whole (scrubbed) text when there are no headings", () => {
    const flat = redact("Budi Santoso\nbudi@mail.com\nPython, SQL, Excel\nAnalis data 2 tahun", {
      name: "Budi Santoso",
    }).text;
    expect(flat).toContain("Python, SQL, Excel");
    expect(flat).not.toMatch(/budi|santoso|@/i);
  });

  it("caps the output length", () => {
    expect(redact(`SKILLS\n${"SQL, ".repeat(5000)}`).text.length).toBeLessThanOrEqual(MAX_REDACTED_CHARS);
  });

  it("puts the name back into what the AI wrote", () => {
    expect(out).toContain('kerja [NAME_1] rapi"');
    expect(rehydrate("Tonjolkan dashboard [NAME_1] di bagian atas.", map)).toBe(
      "Tonjolkan dashboard Rina di bagian atas.",
    );
  });
});

describe("redactPII", () => {
  const phones = [
    "+62 812-3456-7890",
    "0857 1234 5678",
    "62-813.9876.5432",
    "081234567890",
    "+6281298765432",
    "0821-1111-2222",
  ];

  it("replaces emails and Indonesian phone numbers in every common format", () => {
    const { text, map } = redactPII(`Email rina@mail.id, HP ${phones.join(" / ")}`);
    expect(text).toBe("Email [EMAIL_1], HP [PHONE_1] / [PHONE_2] / [PHONE_3] / [PHONE_4] / [PHONE_5] / [PHONE_6]");
    expect(Object.values(map)).toEqual(["rina@mail.id", ...phones]);
  });

  it("replaces the known name and address, reusing a placeholder for repeats", () => {
    const { text } = redactPII("Rina Sari tinggal di Bekasi Timur. Rina suka SQL.", {
      name: "Rina Sari",
      address: "Bekasi Timur",
    });
    expect(text).toBe("[NAME_1] [NAME_2] tinggal di [ADDRESS_1]. [NAME_1] suka SQL.");
  });

  it("round-trips: rehydrate(redactPII(x)) gives x back", () => {
    const input = `Halo, saya Rina Kartika (rina.k@contoh.com, ${phones[0]}), domisili Bekasi, NIK 3275012345678901.`;
    const { text, map } = redactPII(input, { name: "Rina Kartika", address: "Bekasi" });
    expect(text).not.toMatch(/rina|kartika|bekasi|@|3275|812/i);
    expect(rehydrate(text, map)).toBe(input);
  });

  it("leaves placeholders it doesn't know alone", () => {
    expect(rehydrate("[NAME_9] dan [nama]", {})).toBe("[NAME_9] dan [nama]");
  });

  it("hides login credentials and puts them back exactly", () => {
    const text =
      "Username     :     APSC0099999\nPassword\t:\tXk9#pq!L\nKata sandi: rahasia123\nLink : https://contoh.tech/login";
    const { text: out, map } = redactPII(text);
    expect(out).not.toMatch(/APSC0099999|Xk9#pq!L|rahasia123|contoh\.tech/);
    expect(out).toMatch(/Username\s+:\s+\[CRED_1\]/);
    expect(rehydrate(out, map)).toBe(text);
  });

  it("hides credentials when the separator holds non-breaking spaces", () => {
    const text = "Username  : APSC0099999\nPassword : Qm7rT2xa";
    const { text: out, map } = redactPII(text);
    expect(out).not.toMatch(/APSC0099999|Qm7rT2xa/);
    expect(rehydrate(out, map)).toBe(text);
  });

  it.each([
    ["Password Anda : Xk9pqL77", ["Xk9pqL77"]],
    ["Kata Sandi (case sensitive) : Xk9pqL77", ["Xk9pqL77"]],
    ["Username/Password : budi01 / Xk9pqL77", ["budi01", "Xk9pqL77"]],
    ["User ID dan Password : budi01 dan Xk9pqL77", ["budi01", "Xk9pqL77"]],
    ["Username\nbudi01\nPassword\nXk9pqL77", ["budi01", "Xk9pqL77"]],
    ["Username:\nbudi01\nPassword :\nXk9pqL77", ["budi01", "Xk9pqL77"]],
    ["Access Code: AB12CD", ["AB12CD"]],
    ["ID Peserta: APSC0012345", ["APSC0012345"]],
    ["Nomor Peserta : A1234", ["A1234"]],
    ["No. Peserta: A1234", ["A1234"]],
    ["UserID: budi01", ["budi01"]],
    ["User-ID: budi01", ["budi01"]],
    ["Password：Xk9pqL77", ["Xk9pqL77"]],
    ["Password: Qm7rT2xa. Gunakan Qm7rT2xa sekali saja", ["Qm7rT2xa"]],
  ])("hides the credential in %j and puts it back exactly", (text, secrets) => {
    const { text: out, map } = redactPII(text);
    for (const s of secrets) expect(out).not.toContain(s);
    expect(out).toMatch(/\[CRED_1\]/);
    if (secrets.length > 1) expect(out).toMatch(/\[CRED_2\]/);
    expect(rehydrate(out, map)).toBe(text);
  });

  it("leaves ordinary sentences about passwords and PINs alone", () => {
    for (const text of [
      "Lupa password? klik di sini",
      "Masukkan PIN Anda di halaman login",
      "Username\nPassword",
      "Silakan login dengan username dan password berikut:\nLink ujian dikirim terpisah.",
    ]) {
      expect(redactPII(text).text).toBe(text);
    }
  });

  it("leaves no name, contact, code or credential from the email fixtures", () => {
    for (const f of EMAIL_FIXTURES) {
      const { text } = redactPII(f.text, { name: f.userName });
      for (const secret of f.secrets) expect(text).not.toContain(secret);
    }
  });
});
