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

const POSTING_CS = `Officer Customer Service & Teller - Bank Syariah Indonesia (contoh)

Persyaratan:
- Pendidikan minimal D3/S1 Manajemen, Perbankan, Akuntansi, atau Ekonomi
- IPK minimal 3.00
- Usia maksimal 27 tahun
- Pelayanan pelanggan yang prima, komunikasi efektif
- Memahami akuntansi dasar dan Microsoft Excel
- Bahasa Inggris pasif`;

// A mix of fields (banking, finance, marketing, operations, HR, IT), since visitors come from any major.
export const DEMO_APPS: DemoApp[] = [
  {
    company: "PT Bank Mandiri (Persero) Tbk",
    position: "Officer Development Program",
    source: "BUMN_PORTAL",
    stage: 3,
    location: "Jakarta",
    resume: 0,
  },
  {
    company: "PT Bank Rakyat Indonesia",
    position: "BRILiaN Future Leader Program",
    source: "COMPANY_SITE",
    stage: 2,
    location: "Jakarta",
    deadlineInDays: 2,
    resume: 0,
    jobPostingText: JOB_FIXTURES[1].text,
  },
  {
    company: "PT Telkom Indonesia",
    position: "Software Engineer",
    source: "BUMN_PORTAL",
    stage: 5,
    location: "Bandung",
    resume: 0,
    jobPostingText: JOB_FIXTURES[0].text,
  },
  {
    company: "PT Pertamina (Persero)",
    position: "Staf Keuangan",
    source: "BUMN_PORTAL",
    stage: 1,
    location: "Seluruh Indonesia",
    deadlineInDays: 10,
    resume: 0,
  },
  {
    company: "PT PLN (Persero)",
    position: "Staf Administrasi Umum",
    source: "BUMN_PORTAL",
    stage: 9,
    failedAt: 2,
    location: "Penempatan nasional",
    resume: 0,
  },
  {
    company: "PT Bank Central Asia Tbk",
    position: "Program Pendidikan Akuntansi",
    source: "JOBSTREET",
    stage: 4,
    location: "Jakarta",
    resume: 1,
  },
  {
    company: "PT Bank Negara Indonesia",
    position: "Officer Development Program",
    source: "LINKEDIN",
    stage: 9,
    failedAt: 3,
    location: "Jakarta",
    resume: 0,
  },
  {
    company: "Tokopedia",
    position: "Marketing Associate",
    source: "LINKEDIN",
    stage: 6,
    location: "Jakarta",
    resume: 1,
  },
  {
    company: "Gojek",
    position: "Frontend Engineer",
    source: "REFERRAL",
    stage: 9,
    failedAt: 6,
    location: "Jakarta",
    resume: 1,
  },
  {
    company: "PT Astra International Tbk",
    position: "Management Trainee",
    source: "KALIBRR",
    stage: 1,
    location: "Jakarta Utara",
    deadlineInDays: 5,
    resume: 1,
  },
  {
    company: "PT Kereta Api Indonesia",
    position: "Staf Human Capital",
    source: "INSTAGRAM",
    stage: 0,
    location: "Bandung",
    deadlineInDays: 1,
  },
  {
    company: "Bank Syariah Indonesia",
    position: "Officer Customer Service & Teller",
    source: "BUMN_PORTAL",
    stage: 7,
    location: "Jakarta",
    resume: 0,
    jobPostingText: POSTING_CS,
  },
  { company: "Traveloka", position: "Data Analyst", source: "GLINTS", stage: 8, location: "Tangerang", resume: 1 },
  {
    company: "PT Angkasa Pura Indonesia",
    position: "Staf Pelayanan Pelanggan",
    source: "BUMN_PORTAL",
    stage: 0,
    location: "Bekasi",
    deadlineInDays: 14,
  },
  {
    company: "eFishery",
    position: "Sales Associate",
    source: "OTHER",
    stage: 9,
    failedAt: 1,
    location: "Bandung",
    resume: 1,
  },
];

const DAY = 86_400_000;

/**
 * Days since each demo app's last stage change, so the demo always looks current: mostly recent, three going
 * quiet (BCA 16, Tokopedia 21, BSI 18), Pertamina ghosted (33), Astra and BRI applied this week.
 */
const DAYS_SINCE_LAST_MOVE = [2, 2, 4, 33, 6, 16, 3, 21, 5, 3, 0, 18, 1, 0, 7];

/**
 * Stage path and dates for demo app #i: one stage every 3–7 days (varied so the dashboard's median response
 * time is a meaningful, hand-checkable number), ending DAYS_SINCE_LAST_MOVE[i] days before today.
 */
export function demoTimeline(app: DemoApp, i: number, today: Date) {
  const reached = app.stage === 9 ? app.failedAt! : app.stage;
  const path =
    app.stage === 0 ? [0] : [...Array.from({ length: reached }, (_, k) => k + 1), ...(app.stage === 9 ? [9] : [])];
  const stepDays = 3 + (i % 5);
  const daysAgo = (path.length - 1) * stepDays + DAYS_SINCE_LAST_MOVE[i];
  const appliedAt = app.stage === 0 ? null : new Date(today.getTime() - daysAgo * DAY);
  const history = path.map((stageIndex, step) => ({
    stageIndex,
    enteredAt: appliedAt ? new Date(appliedAt.getTime() + step * stepDays * DAY) : today,
    // The stage before Ditolak is where the candidate failed.
    result: (stageIndex === 9
      ? null
      : path[step + 1] === 9
        ? "FAILED"
        : step === path.length - 1
          ? "PENDING"
          : "PASSED") as "FAILED" | "PENDING" | "PASSED" | null,
  }));
  return { appliedAt, history };
}
