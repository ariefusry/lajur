import { z } from "zod";
import { Degree, EventType, JobSource, RequirementType, StageKind, StageResult } from "@/generated/prisma/enums";
import { fromDateInput, fromDateTimeInput } from "@/lib/dates";

// FormData gives strings; empty optional fields become null.
const optionalText = (max: number) =>
  z.string().trim().max(max, `Maksimal ${max} karakter`).default("").transform((v) => v || null);

const optionalDate = z
  .string()
  .default("")
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Tanggal tidak valid")
  .transform((v) => (v ? fromDateInput(v) : null));

export const JOB_SOURCE_LABELS: Record<JobSource, string> = {
  JOBSTREET: "JobStreet",
  KALIBRR: "Kalibrr",
  GLINTS: "Glints",
  LINKEDIN: "LinkedIn",
  COMPANY_SITE: "Situs perusahaan",
  BUMN_PORTAL: "Portal BUMN (Rekrutmen Bersama)",
  INSTAGRAM: "Instagram",
  REFERRAL: "Referral",
  OTHER: "Lainnya",
};

export const applicationSchema = z.object({
  company: z.string().trim().min(1, "Nama perusahaan wajib diisi").max(200),
  position: z.string().trim().min(1, "Posisi wajib diisi").max(200),
  source: z.enum(JobSource, "Pilih sumber lowongan"),
  currentStageId: z.string().min(1, "Pilih tahap"),
  resumeId: z.string().default("").transform((v) => v || null),
  url: z
    .string()
    .trim()
    .default("")
    .refine((v) => v === "" || z.url({ protocol: /^https?$/ }).safeParse(v).success, "URL tidak valid")
    .transform((v) => v || null),
  location: optionalText(200),
  deadline: optionalDate,
  appliedAt: optionalDate,
  expectedSalary: z
    .string()
    .trim()
    .default("")
    .transform((v) => v.replace(/[.\s]/g, "")) // "8.000.000" → "8000000"
    .refine((v) => v === "" || /^\d{1,10}$/.test(v), "Isi angka rupiah, contoh 8000000")
    .transform((v) => (v ? Number(v) : null)),
  notes: optionalText(10_000),
});

export type ApplicationInput = z.infer<typeof applicationSchema>;

export const profileSchema = z.object({
  gpa: z
    .string()
    .trim()
    .default("")
    .transform((v) => v.replace(",", "."))
    .refine((v) => v === "" || (/^\d(\.\d{1,2})?$/.test(v) && Number(v) <= 4), "IPK 0.00–4.00")
    .transform((v) => (v ? v : null)),
  birthDate: optionalDate,
  major: optionalText(100),
  degree: z.union([z.literal(""), z.enum(Degree)]).default("").transform((v) => v || null),
  domicile: optionalText(100),
});

export const stageNameSchema = z.string().trim().min(1).max(50);
export const stageKindSchema = z.enum(StageKind);

export const STAGE_KIND_LABELS: Record<StageKind, string> = {
  WISHLIST: "Wishlist",
  IN_PROGRESS: "Proses seleksi",
  OFFER: "Offering",
  REJECTED: "Ditolak",
  WITHDRAWN: "Mengundurkan diri",
};

export const resumeNameSchema = z.string().trim().min(1).max(100);

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  DEADLINE: "Deadline",
  ONLINE_TEST: "Tes online/TPA",
  PSYCHOTEST: "Psikotes",
  LGD: "LGD",
  INTERVIEW_HR: "Interview HR",
  INTERVIEW_USER: "Interview user",
  MCU: "MCU",
  OTHER: "Lainnya",
};

export const eventSchema = z.object({
  type: z.enum(EventType, "Pilih jenis jadwal"),
  startsAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Isi tanggal dan jam")
    .transform(fromDateTimeInput),
  locationOrUrl: optionalText(500),
});

export const STAGE_RESULT_LABELS: Record<StageResult, string> = {
  PENDING: "Menunggu",
  PASSED: "Lolos",
  FAILED: "Gagal",
};

export const stageHistorySchema = z.object({
  result: z.union([z.literal(""), z.enum(StageResult)]).default("").transform((v) => v || null),
  notes: optionalText(10_000),
});

export const REQUIREMENT_TYPE_LABELS: Record<RequirementType, string> = {
  MIN_GPA: "IPK minimal",
  MAX_AGE: "Usia maksimal",
  MAJOR: "Jurusan",
  MIN_DEGREE: "Pendidikan minimal",
  PLACEMENT: "Penempatan",
  SERVICE_BOND: "Ikatan dinas",
  OTHER: "Lainnya",
};

/** Hidden "draft" field on the new-application form: AI-extracted requirements the user reviewed. */
export const draftSchema = z.object({
  jobPostingText: z.string().max(20_000).nullable(),
  requirements: z
    .array(
      z.object({
        type: z.enum(RequirementType),
        value: z.string().trim().min(1).max(200),
        sourceQuote: z.string().trim().min(1).max(2000),
        ageReferenceDate: z.iso.date().nullable(),
        editedByUser: z.boolean(),
      }),
    )
    .max(30),
});
export type Draft = z.infer<typeof draftSchema>;

export type FormState = { errors?: Record<string, string[] | undefined>; message?: string; ok?: boolean };
