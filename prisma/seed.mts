// Demo account + 15 dummy applications (mixed fields) + 2 CV versions. Re-running resets ONLY the demo account.
// Run: pnpm db:seed
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { DEMO_APPS, DEMO_RESUMES, demoTimeline } from "../src/lib/demo-data.ts";
import { DEMO_EMAIL } from "../src/lib/demo.ts";
import { templateStageRows } from "../src/lib/stage-templates.ts";

const BUCKET = "resumes"; // as in neon.ts / src/lib/storage.ts
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const s3 = new S3Client({ forcePathStyle: true }); // AWS_* env vars from `neon deploy`

// Fake CV content (fake contact details on purpose: shows what redaction strips before AI sees it).
const CV_TEXT: Record<(typeof DEMO_RESUMES)[number], string[]> = {
  "CV BUMN v1": [
    "Akun Demo",
    "demo@lamarin.local | 0812-3456-7890 | linkedin.com/in/akundemo",
    "Jl. Merdeka No. 1, Bekasi 17111",
    "PENDIDIKAN",
    "S1 Manajemen, Universitas Contoh, IPK 3.45",
    "KEAHLIAN",
    "Microsoft Excel, akuntansi dasar, analisis data, pelayanan pelanggan, komunikasi efektif, bahasa Inggris (TOEFL 550)",
    "PENGALAMAN",
    "Magang Administrasi Keuangan - PT Contoh Persero (2025)",
    "Menyusun laporan harian transaksi dan rekap anggaran dengan Excel",
    "ORGANISASI",
    "Bendahara, Badan Eksekutif Mahasiswa Fakultas Ekonomi",
  ],
  "CV Startup v2": [
    "Akun Demo",
    "+62 812 3456 7890 | demo@lamarin.local | instagram.com/akundemo",
    "PROFIL",
    "Fresh graduate yang suka mengolah data dan membangun produk digital.",
    "KEAHLIAN",
    "SQL, Microsoft Excel, Google Analytics, digital marketing, Canva, HTML, JavaScript, public speaking",
    "PENGALAMAN",
    "Magang Growth & Marketing - Startup Contoh (2025)",
    "Membuat dashboard penjualan dengan SQL dan menaikkan engagement media sosial 30% dalam 3 bulan",
    "PROYEK",
    "Website toko UMKM dengan HTML dan JavaScript, juara 2 kompetisi bisnis kampus",
  ],
};

/** Minimal valid one-page PDF with a text layer, so pdf-parse-style extraction works on it. */
function pdf(lines: string[]) {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  const stream = `BT /F1 10 Tf 40 800 Td 14 TL ${lines.map((l) => `(${esc(l)}) '`).join(" ")} ET`;
  const objs = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>",
    `<</Length ${stream.length}>>\nstream\n${stream}\nendstream`,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ];
  let out = "%PDF-1.4\n";
  const offsets = objs.map((o, i) => {
    const at = out.length;
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
    return at;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

const today = new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date())}T00:00:00+07:00`);

const existing = await db.user.findUnique({ where: { email: DEMO_EMAIL }, include: { resumes: true } });
if (existing) {
  for (const r of existing.resumes) {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: r.filePath })).catch((e) => console.warn("old CV not deleted:", e.message));
  }
  // Applications first: their history rows reference stages (no cascade from Stage).
  await db.application.deleteMany({ where: { userId: existing.id } });
  await db.user.delete({ where: { id: existing.id } });
}

const user = await db.user.create({ data: { email: DEMO_EMAIL, name: "Akun Demo", gpa: "3.45", birthDate: new Date("2001-05-14"), major: "Manajemen", degree: "S1", domicile: "Bekasi" } });
await db.stage.createMany({ data: templateStageRows("BUMN", user.id) });
const stages = await db.stage.findMany({ where: { userId: user.id }, orderBy: { order: "asc" } });

const resumeIds: string[] = [];
for (const versionName of DEMO_RESUMES) {
  const id = crypto.randomUUID();
  const filePath = `cv/${user.id}/${id}.pdf`;
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: filePath, Body: pdf(CV_TEXT[versionName]), ContentType: "application/pdf" }));
  await db.resume.create({ data: { id, userId: user.id, versionName, filePath, extractedText: CV_TEXT[versionName].join("\n") } });
  resumeIds.push(id);
}

for (const [i, app] of DEMO_APPS.entries()) {
  const { appliedAt, history } = demoTimeline(app, i, today);
  await db.application.create({
    data: {
      userId: user.id,
      company: app.company,
      position: app.position,
      source: app.source,
      location: app.location,
      jobPostingText: app.jobPostingText ?? null,
      currentStageId: stages[app.stage].id,
      resumeId: app.resume === undefined ? null : resumeIds[app.resume],
      appliedAt,
      deadline: app.deadlineInDays !== undefined ? new Date(today.getTime() + app.deadlineInDays * 86_400_000) : null,
      history: { create: history.map((h) => ({ stageId: stages[h.stageIndex].id, enteredAt: h.enteredAt, result: h.result })) },
    },
  });
}

console.log(`Seeded ${DEMO_EMAIL}: ${stages.length} stages, ${resumeIds.length} CVs, ${DEMO_APPS.length} applications.`);
await db.$disconnect();
