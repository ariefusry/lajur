// Demo account data, shared by prisma/seed.mts and the dashboard unit test (so the test's hand-counted
// numbers are exactly what the seeded dashboard shows). Pure: no DB, no path aliases (Node runs the seed).
import type { JobSource } from "../generated/prisma/enums";
import { JOB_FIXTURES } from "./ai/job-fixtures.ts";

export const DEMO_RESUMES = ["CV BUMN v1", "CV Startup v2"] as const;

// BUMN template indices: 0 Wishlist, 1 Administrasi, 2 Tes Online/TPA, 3 Psikotes, 4 LGD,
// 5 Interview HR, 6 Interview User, 7 MCU, 8 Offering, 9 Ditolak.
// `failedAt` = last stage reached before landing in Ditolak. `resume` = index into DEMO_RESUMES.
export type DemoApp = {
  company: string;
  position: string;
  source: JobSource;
  stage: number;
  failedAt?: number;
  location: string;
  deadlineInDays?: number;
  resume?: 0 | 1;
  /** Saved posting text, so the demo can run the skill-gap analysis. */
  jobPostingText?: string;
};

export const DEMO_APPS: DemoApp[] = [
  { company: "PT Bank Mandiri (Persero) Tbk", position: "Officer Development Program IT", source: "BUMN_PORTAL", stage: 3, location: "Jakarta", resume: 0 },
  { company: "PT Bank Rakyat Indonesia", position: "BRILiaN Future Leader Program", source: "COMPANY_SITE", stage: 2, location: "Jakarta", deadlineInDays: 2, resume: 0, jobPostingText: JOB_FIXTURES[1].text },
  { company: "PT Telkom Indonesia", position: "Software Engineer", source: "BUMN_PORTAL", stage: 5, location: "Bandung", resume: 0, jobPostingText: JOB_FIXTURES[0].text },
  { company: "PT Pertamina (Persero)", position: "BPS Engineering", source: "BUMN_PORTAL", stage: 1, location: "Seluruh Indonesia", deadlineInDays: 10, resume: 0 },
  { company: "PT PLN (Persero)", position: "Engineer S1 Informatika", source: "BUMN_PORTAL", stage: 9, failedAt: 2, location: "Penempatan nasional", resume: 0 },
  { company: "PT Bank Central Asia Tbk", position: "PPA Bisnis IT", source: "JOBSTREET", stage: 4, location: "Jakarta", resume: 1 },
  { company: "PT Bank Negara Indonesia", position: "Officer Development Program", source: "LINKEDIN", stage: 9, failedAt: 3, location: "Jakarta", resume: 0 },
  { company: "Tokopedia", position: "Backend Engineer", source: "LINKEDIN", stage: 6, location: "Jakarta", resume: 1 },
  { company: "Gojek", position: "Frontend Engineer", source: "REFERRAL", stage: 9, failedAt: 6, location: "Jakarta", resume: 1 },
  { company: "PT Astra International Tbk", position: "Management Trainee IT", source: "KALIBRR", stage: 1, location: "Jakarta Utara", deadlineInDays: 5, resume: 1 },
  { company: "PT Kereta Api Indonesia", position: "Staf IT", source: "INSTAGRAM", stage: 0, location: "Bandung", deadlineInDays: 1 },
  { company: "Bank Syariah Indonesia", position: "ODP IT", source: "BUMN_PORTAL", stage: 7, location: "Jakarta", resume: 0 },
  { company: "Traveloka", position: "Software Engineer, Payments", source: "GLINTS", stage: 8, location: "Tangerang", resume: 1 },
  { company: "PT Angkasa Pura Indonesia", position: "Staf Teknologi Informasi", source: "BUMN_PORTAL", stage: 0, location: "Bekasi", deadlineInDays: 14 },
  { company: "eFishery", position: "Fullstack Engineer", source: "OTHER", stage: 9, failedAt: 1, location: "Bandung (remote)", resume: 1 },
];

// --- Second persona: S1 Manajemen, applying to banks, FMCG, retail and BUMN (same BUMN stage template). ---
export const DEMO_NONIT_RESUMES = ["CV Perbankan v1", "CV Marketing v2"] as const;

const POSTING_MT = `Management Trainee Program 2026 - PT Unilever Indonesia Tbk (contoh)

Persyaratan:
- Pendidikan minimal S1 semua jurusan
- IPK minimal 3.00 (skala 4.00)
- Usia maksimal 25 tahun
- Menguasai Microsoft Excel dan PowerPoint
- Kemampuan komunikasi dan negosiasi yang baik
- Bahasa Inggris aktif (TOEFL minimal 500)
- Kepemimpinan dan kerja tim, terbiasa berorganisasi
- Bersedia ditempatkan di seluruh Indonesia

Pendaftaran ditutup 30 November 2026.`;

const POSTING_CS = `Officer Customer Service & Teller - Bank Syariah Indonesia (contoh)

Persyaratan:
- Pendidikan minimal D3/S1 Manajemen, Perbankan, Akuntansi, atau Ekonomi
- IPK minimal 3.00
- Usia maksimal 27 tahun
- Pelayanan pelanggan yang prima, komunikasi efektif
- Memahami akuntansi dasar dan Microsoft Excel
- Bahasa Inggris pasif`;

export const DEMO_NONIT_APPS: DemoApp[] = [
  { company: "PT Bank Mandiri (Persero) Tbk", position: "Officer Development Program", source: "BUMN_PORTAL", stage: 3, location: "Jakarta", resume: 0 },
  { company: "PT Bank Central Asia Tbk", position: "Management Trainee Bisnis", source: "JOBSTREET", stage: 4, location: "Jakarta", resume: 0 },
  { company: "PT Unilever Indonesia Tbk", position: "Management Trainee, Marketing", source: "LINKEDIN", stage: 5, location: "Tangerang", resume: 1, jobPostingText: POSTING_MT },
  { company: "PT Indofood Sukses Makmur Tbk", position: "Management Trainee", source: "KALIBRR", stage: 2, location: "Jakarta", resume: 1 },
  { company: "PT Pertamina (Persero)", position: "Staf Keuangan", source: "BUMN_PORTAL", stage: 1, location: "Seluruh Indonesia", deadlineInDays: 6, resume: 0 },
  { company: "PT Telkom Indonesia", position: "Staf Human Capital", source: "BUMN_PORTAL", stage: 9, failedAt: 2, location: "Bandung", resume: 0 },
  { company: "Bank Syariah Indonesia", position: "Officer Customer Service & Teller", source: "BUMN_PORTAL", stage: 7, location: "Jakarta", resume: 0, jobPostingText: POSTING_CS },
  { company: "PT Sumber Alfaria Trijaya Tbk", position: "Management Trainee Operasional", source: "COMPANY_SITE", stage: 1, location: "Tangerang", deadlineInDays: 3, resume: 1 },
  { company: "Kompas Gramedia", position: "Marketing Communications Officer", source: "INSTAGRAM", stage: 9, failedAt: 1, location: "Jakarta", resume: 1 },
  { company: "PT Danone Indonesia", position: "Sales Supervisor Trainee", source: "GLINTS", stage: 8, location: "Jakarta", resume: 1 },
  { company: "Shopee Indonesia", position: "Operations Associate", source: "REFERRAL", stage: 9, failedAt: 5, location: "Jakarta", resume: 1 },
  { company: "PT Kereta Api Indonesia", position: "Staf Administrasi Umum", source: "OTHER", stage: 0, location: "Bandung", deadlineInDays: 12 },
];

const DAY = 86_400_000;

/**
 * Stage path and dates for demo app #i: applied 60-2i days ago, then one stage every 3–7 days
 * (varied so the dashboard's median response time is a meaningful, hand-checkable number).
 */
export function demoTimeline(app: DemoApp, i: number, today: Date) {
  const reached = app.stage === 9 ? app.failedAt! : app.stage;
  const path = app.stage === 0 ? [0] : [...Array.from({ length: reached }, (_, k) => k + 1), ...(app.stage === 9 ? [9] : [])];
  const appliedAt = app.stage === 0 ? null : new Date(today.getTime() - (60 - i * 2) * DAY);
  const stepDays = 3 + (i % 5);
  const history = path.map((stageIndex, step) => ({
    stageIndex,
    enteredAt: appliedAt ? new Date(appliedAt.getTime() + step * stepDays * DAY) : today,
    // The stage before Ditolak is where the candidate failed.
    result: (stageIndex === 9 ? null : path[step + 1] === 9 ? "FAILED" : step === path.length - 1 ? "PENDING" : "PASSED") as
      | "FAILED"
      | "PENDING"
      | "PASSED"
      | null,
  }));
  return { appliedAt, history };
}
