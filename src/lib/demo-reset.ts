// Rebuilds the demo account's content, dated relative to today. Shared by `pnpm db:seed` (prisma/seed.mts, run by
// Node directly) and the daily cron (/api/cron/demo-reset), so: no path aliases for values, and DB/storage are
// passed in instead of imported (lib/db and lib/storage are server-only).
import type { PrismaClient } from "../generated/prisma/client.ts";
import { fromDateInput, toDateInput } from "./dates.ts";
import { DEMO_APPS, DEMO_RESUMES, demoTimeline } from "./demo-data.ts";
import { DEMO_EMAIL } from "./demo.ts";
import { templateStageRows } from "./stage-templates.ts";

const DAY = 86_400_000;

type Deps = {
  db: PrismaClient;
  putPdf: (key: string, body: Uint8Array) => Promise<unknown>;
  deleteObject: (key: string) => Promise<unknown>;
};

// Fake CV content (fake contact details on purpose: shows what redaction strips before AI sees it).
const CV_TEXT: Record<(typeof DEMO_RESUMES)[number], string[]> = {
  "CV BUMN v1": [
    "Akun Demo",
    "demo@lajur.local | 0812-3456-7890 | linkedin.com/in/akundemo",
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
    "+62 812 3456 7890 | demo@lajur.local | instagram.com/akundemo",
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

const PROFILE = {
  name: "Akun Demo",
  gpa: "3.45",
  birthDate: new Date("2001-05-14"),
  major: "Manajemen",
  degree: "S1",
  domicile: "Bekasi",
} as const;

/** Minimal valid one-page PDF with a text layer, so pdf-parse-style extraction works on it. */
export function demoPdf(lines: string[]) {
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

/**
 * Wipes and rebuilds the demo account's stages, CVs and 15 applications. The user row itself (and so any
 * visitor's demo session) is kept; it's created on first run. Touches nothing outside the demo account.
 * The demo timeline is dated relative to `today` (midnight in Jakarta).
 */
export async function resetDemoAccount(
  { db, putPdf, deleteObject }: Deps,
  today = fromDateInput(toDateInput(new Date())),
) {
  const user = await db.user.upsert({
    where: { email: DEMO_EMAIL },
    update: PROFILE,
    create: { email: DEMO_EMAIL, ...PROFILE },
    include: { resumes: { select: { filePath: true } } },
  });

  // New CV files first (outside the transaction; an orphaned object is harmless, a missing one is not).
  const resumes: { id: string; userId: string; versionName: string; filePath: string; extractedText: string }[] = [];
  for (const versionName of DEMO_RESUMES) {
    const id = crypto.randomUUID();
    const filePath = `cv/${user.id}/${id}.pdf`;
    await putPdf(filePath, demoPdf(CV_TEXT[versionName]));
    resumes.push({ id, userId: user.id, versionName, filePath, extractedText: CV_TEXT[versionName].join("\n") });
  }

  await db.$transaction(
    async (tx) => {
      // Applications first: their history rows reference stages (no cascade from Stage).
      await tx.application.deleteMany({ where: { userId: user.id } });
      await tx.resume.deleteMany({ where: { userId: user.id } });
      await tx.stage.deleteMany({ where: { userId: user.id } });
      await tx.aiUsage.deleteMany({ where: { userId: user.id } });

      await tx.stage.createMany({ data: templateStageRows("BUMN", user.id) });
      const stages = await tx.stage.findMany({ where: { userId: user.id }, orderBy: { order: "asc" } });
      await tx.resume.createMany({ data: resumes });

      for (const [i, app] of DEMO_APPS.entries()) {
        const { appliedAt, history } = demoTimeline(app, i, today);
        await tx.application.create({
          data: {
            userId: user.id,
            company: app.company,
            position: app.position,
            source: app.source,
            location: app.location,
            jobPostingText: app.jobPostingText ?? null,
            currentStageId: stages[app.stage].id,
            resumeId: app.resume === undefined ? null : resumes[app.resume].id,
            appliedAt,
            deadline: app.deadlineInDays !== undefined ? new Date(today.getTime() + app.deadlineInDays * DAY) : null,
            history: {
              create: history.map((h) => ({
                stageId: stages[h.stageIndex].id,
                enteredAt: h.enteredAt,
                result: h.result,
              })),
            },
          },
        });
      }
    },
    { timeout: 30_000 },
  );
  // Old files go only once the new data is in, so a failed reset leaves the previous demo intact.
  for (const r of user.resumes) {
    await deleteObject(r.filePath).catch((e: Error) => console.warn("demo reset: old CV not deleted", e.message));
  }

  return { stages: templateStageRows("BUMN", user.id).length, resumes: resumes.length, applications: DEMO_APPS.length };
}
