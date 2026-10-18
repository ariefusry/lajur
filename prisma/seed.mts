// Two demo accounts (IT graduate: 15 applications; Manajemen graduate: 12), 2 CV versions each.
// Re-running resets ONLY the demo accounts. Run: pnpm db:seed   (one persona: pnpm prisma db seed -- --only=nonit)
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { DEMO_APPS, DEMO_NONIT_APPS, DEMO_NONIT_RESUMES, DEMO_RESUMES, demoTimeline } from "../src/lib/demo-data.ts";
import { DEMO_EMAIL, DEMO_NONIT_EMAIL } from "../src/lib/demo.ts";
import { templateStageRows } from "../src/lib/stage-templates.ts";

const BUCKET = "resumes"; // as in neon.ts / src/lib/storage.ts
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const s3 = new S3Client({ forcePathStyle: true }); // AWS_* env vars from `neon deploy`

// Fake CV content (fake contact details on purpose: shows what redaction strips before AI sees it).
const CV_TEXT: Record<string, string[]> = {
  "CV BUMN v1": [
    "Akun Demo",
    "demo@lamarin.local | 0812-3456-7890 | linkedin.com/in/akundemo",
    "Jl. Merdeka No. 1, Bekasi 17111",
    "PENDIDIKAN",
    "S1 Informatika, Universitas Contoh, IPK 3.45",
    "KEAHLIAN",
    "Java, SQL, PostgreSQL, Git, Microsoft Excel, analisis data",
    "PENGALAMAN",
    "Magang IT Support - PT Contoh Persero (2025)",
    "Membuat laporan otomatis dengan Excel dan SQL untuk tim operasional",
    "ORGANISASI",
    "Ketua Divisi Teknologi, Himpunan Mahasiswa Informatika",
  ],
  "CV Startup v2": [
    "Akun Demo",
    "+62 812 3456 7890 | demo@lamarin.local | github.com/akundemo",
    "PROFIL",
    "Fresh graduate yang suka membangun produk web.",
    "SKILLS",
    "TypeScript, React.js, Next.js, Node.js, Postgres, Tailwind CSS, Git",
    "EXPERIENCE",
    "Frontend Engineer Intern - Startup Contoh (2025)",
    "Built a customer dashboard with React and REST APIs, wrote unit tests with Jest",
    "PROJECTS",
    "Lamarin: job application tracker (Next.js, Prisma)",
  ],
  "CV Perbankan v1": [
    "Akun Demo Manajemen",
    "demo.nonit@lamarin.local | 0813-9876-5432 | linkedin.com/in/akundemomanajemen",
    "Jl. Pahlawan No. 5, Jakarta Timur 13430",
    "PENDIDIKAN",
    "S1 Manajemen, Universitas Contoh, IPK 3.52",
    "KEAHLIAN",
    "Microsoft Excel, akuntansi dasar, pelayanan pelanggan, komunikasi efektif, bahasa Inggris (TOEFL 560)",
    "PENGALAMAN",
    "Magang Customer Service - Bank Contoh (2025)",
    "Melayani 40+ nasabah per hari dan menyusun laporan harian transaksi dengan Excel",
    "ORGANISASI",
    "Bendahara, Badan Eksekutif Mahasiswa Fakultas Ekonomi",
  ],
  "CV Marketing v2": [
    "Akun Demo Manajemen",
    "+62 813 9876 5432 | demo.nonit@lamarin.local | instagram.com/akundemomanajemen",
    "PROFIL",
    "Fresh graduate Manajemen yang tertarik pada pemasaran dan penjualan FMCG.",
    "KEAHLIAN",
    "Digital marketing, media sosial, Canva, penulisan konten, Google Analytics, public speaking, kepemimpinan",
    "PENGALAMAN",
    "Magang Marketing Communications - Brand Contoh (2025)",
    "Mengelola kalender konten Instagram dan menaikkan engagement 30% dalam 3 bulan",
    "PROYEK",
    "Kampanye penjualan produk lokal, juara 2 kompetisi bisnis kampus",
    "ORGANISASI",
    "Ketua Divisi Humas, Himpunan Mahasiswa Manajemen",
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

const PERSONAS = [
  {
    key: "it",
    email: DEMO_EMAIL,
    name: "Akun Demo",
    profile: { gpa: "3.45", birthDate: new Date("2001-05-14"), major: "Informatika", degree: "S1", domicile: "Bekasi" },
    resumes: DEMO_RESUMES as readonly string[],
    apps: DEMO_APPS,
  },
  {
    key: "nonit",
    email: DEMO_NONIT_EMAIL,
    name: "Akun Demo (Manajemen)",
    profile: { gpa: "3.52", birthDate: new Date("2000-09-03"), major: "Manajemen", degree: "S1", domicile: "Jakarta Timur" },
    resumes: DEMO_NONIT_RESUMES as readonly string[],
    apps: DEMO_NONIT_APPS,
  },
] as const;
const only = process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length);

for (const persona of PERSONAS) {
  if (only && only !== persona.key) continue;

  const existing = await db.user.findUnique({ where: { email: persona.email }, include: { resumes: true } });
  if (existing) {
    for (const r of existing.resumes) {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: r.filePath })).catch((e) => console.warn("old CV not deleted:", e.message));
    }
    // Applications first: their history rows reference stages (no cascade from Stage).
    await db.application.deleteMany({ where: { userId: existing.id } });
    await db.user.delete({ where: { id: existing.id } });
  }

  const user = await db.user.create({ data: { email: persona.email, name: persona.name, ...persona.profile } });
  await db.stage.createMany({ data: templateStageRows("BUMN", user.id) });
  const stages = await db.stage.findMany({ where: { userId: user.id }, orderBy: { order: "asc" } });

  const resumeIds: string[] = [];
  for (const versionName of persona.resumes) {
    const id = crypto.randomUUID();
    const filePath = `cv/${user.id}/${id}.pdf`;
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: filePath, Body: pdf(CV_TEXT[versionName]), ContentType: "application/pdf" }));
    await db.resume.create({ data: { id, userId: user.id, versionName, filePath, extractedText: CV_TEXT[versionName].join("\n") } });
    resumeIds.push(id);
  }

  for (const [i, app] of persona.apps.entries()) {
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

  console.log(`Seeded ${persona.email}: ${stages.length} stages, ${resumeIds.length} CVs, ${persona.apps.length} applications.`);
}
await db.$disconnect();
