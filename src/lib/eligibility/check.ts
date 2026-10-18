import type { Degree, EligibilityStatus, RequirementType } from "@/generated/prisma/enums";
import { toDateInput } from "@/lib/dates";

export type EligibilityProfile = {
  gpa: number | null;
  birthDate: Date | null; // @db.Date → UTC midnight of the birth date
  major: string | null;
  degree: Degree | null;
};

export type RequirementInput = { type: RequirementType; value: string; ageReferenceDate: Date | null };
export type CheckResult = { status: EligibilityStatus; reason: string };

const firstNumber = (s: string) => {
  const m = s.replace(/(\d),(\d)/g, "$1.$2").match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : NaN;
};

/**
 * Number that applies to the profile's degree when the value lists per-degree variants,
 * e.g. "3.00 (S1), 3.25 (S2)" or "26 tahun untuk S1 dan 28 tahun untuk S2"; otherwise the first number.
 */
export function numberForDegree(value: string, degree: Degree | null): number {
  const v = value.replace(/(\d),(\d)/g, "$1.$2");
  if (degree) {
    // number, then up to 20 non-digit chars, then the degree: "3.25 (S2)", "28 tahun untuk S2"
    const re = new RegExp(String.raw`(\d+(?:\.\d+)?)[^\d]{0,20}?\b${degree}\b`, "i");
    const m = v.match(re);
    if (m) return Number(m[1]);
  }
  return firstNumber(v);
}

/** Full years at `ref`. Born 29 Feb → birthday counts from 1 Mar in non-leap years. */
export function ageOn(birth: Date, ref: Date): number {
  const [ry, rm, rd] = toDateInput(ref).split("-").map(Number); // reference day in Jakarta
  const by = birth.getUTCFullYear(), bm = birth.getUTCMonth() + 1, bd = birth.getUTCDate();
  return ry - by - (rm < bm || (rm === bm && rd < bd) ? 1 : 0);
}

const MAJOR_SYNONYMS = [
  ["informatika", "teknik informatika", "ilmu komputer", "computer science", "informatics"],
  ["sistem informasi", "information systems", "information system"],
  ["teknik komputer", "computer engineering"],
  ["teknik elektro", "electrical engineering"],
  ["teknik industri", "industrial engineering"],
  ["teknik sipil", "civil engineering"],
  ["teknik mesin", "mechanical engineering"],
  ["teknik kimia", "chemical engineering"],
  ["arsitektur", "architecture"],
  ["akuntansi", "accounting", "akuntansi keuangan"],
  ["manajemen", "management", "manajemen bisnis", "administrasi bisnis", "business administration"],
  ["ekonomi", "ilmu ekonomi", "ekonomi pembangunan", "economics"],
  ["keuangan", "finance", "perbankan", "keuangan dan perbankan", "banking"],
  ["hukum", "ilmu hukum", "law"],
  ["psikologi", "psychology"],
  ["ilmu komunikasi", "komunikasi", "communication", "communications"],
  ["hubungan internasional", "international relations"],
  ["administrasi publik", "administrasi negara", "ilmu administrasi negara", "public administration"],
  ["statistika", "statistik", "statistics"],
  ["matematika", "mathematics"],
  ["kimia", "chemistry"],
  ["biologi", "biology"],
  ["farmasi", "pharmacy"],
  ["keperawatan", "ilmu keperawatan", "nursing"],
  ["kesehatan masyarakat", "public health"],
  ["kedokteran", "pendidikan dokter", "medicine"],
  ["gizi", "ilmu gizi", "nutrition"],
  ["pertanian", "agroteknologi", "agribisnis", "agriculture"],
  ["sastra inggris", "bahasa inggris", "pendidikan bahasa inggris", "english literature"],
  ["desain komunikasi visual", "dkv", "visual communication design"],
  ["logistik", "manajemen logistik", "logistics"],
  ["perhotelan", "hospitality", "pariwisata", "tourism"],
];
const ALL_MAJORS = /semua jurusan|segala jurusan|seluruh jurusan|all majors|any major/;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

function majorMatches(profileMajor: string, value: string) {
  const v = ` ${norm(value)} `;
  const p = norm(profileMajor);
  // Exact synonym first, else the longest synonym contained in the profile major
  // ("Manajemen Logistik" → logistik group via "manajemen logistik", not the shorter "manajemen").
  const exact = MAJOR_SYNONYMS.find((g) => g.includes(p));
  const contained = MAJOR_SYNONYMS.flatMap((g) => g.filter((syn) => p.includes(syn)).map((syn) => ({ g, len: syn.length })))
    .sort((a, b) => b.len - a.len)[0]?.g;
  const group = exact ?? contained ?? [p];
  return group.some((syn) => v.includes(` ${syn} `));
}

const DEGREE_RANK: Record<Degree, number> = { SMA: 0, D1: 1, D2: 2, D3: 3, D4: 4, S1: 4, S2: 5, S3: 6 };
const DEGREE_PATTERNS: [RegExp, Degree][] = [
  [/\b(sma|smk|slta|ma)\b/, "SMA"],
  // "di" alone is the Indonesian preposition, so D1 is only matched in unambiguous spellings.
  [/\b(d1|diploma 1|diploma i)\b/, "D1"],
  [/\b(d2|d ii|dii|diploma 2|diploma ii)\b/, "D2"],
  [/\b(d3|d iii|diii|diploma 3|diploma iii)\b/, "D3"],
  [/\b(d4|d iv|div|diploma 4|diploma iv|sarjana terapan)\b/, "D4"],
  [/\b(s1|sarjana|bachelor)\b/, "S1"],
  [/\b(s2|magister|master)\b/, "S2"],
  [/\b(s3|doktor|doctor|doctoral|phd)\b/, "S3"],
];

/** Lowest degree mentioned ("D3/S1" → D3), or null if none. */
export function parseMinDegree(value: string): Degree | null {
  const v = norm(value).replace(/sarjana terapan/g, "d4");
  const found = DEGREE_PATTERNS.filter(([re]) => re.test(v)).map(([, d]) => d);
  if (!found.length) return null;
  return found.reduce((min, d) => (DEGREE_RANK[d] < DEGREE_RANK[min] ? d : min));
}

/** Pure, deterministic eligibility check (no AI). */
export function checkRequirement(req: RequirementInput, profile: EligibilityProfile, today: Date): CheckResult {
  switch (req.type) {
    case "MIN_GPA": {
      const min = numberForDegree(req.value, profile.degree);
      if (Number.isNaN(min)) return { status: "UNKNOWN", reason: "Nilai IPK minimal tidak terbaca." };
      if (profile.gpa === null) return { status: "UNKNOWN", reason: "Isi IPK di Pengaturan untuk mengecek syarat ini." };
      // Compare in hundredths to dodge float noise (3.00 vs 2.9999…).
      return Math.round(profile.gpa * 100) >= Math.round(min * 100)
        ? { status: "MEETS", reason: `IPK kamu ${profile.gpa.toFixed(2)} ≥ ${min.toFixed(2)}.` }
        : { status: "FAILS", reason: `IPK kamu ${profile.gpa.toFixed(2)} di bawah minimal ${min.toFixed(2)}.` };
    }
    case "MAX_AGE": {
      const max = numberForDegree(req.value, profile.degree);
      if (Number.isNaN(max)) return { status: "UNKNOWN", reason: "Batas usia tidak terbaca." };
      if (!profile.birthDate) return { status: "UNKNOWN", reason: "Isi tanggal lahir di Pengaturan untuk mengecek syarat ini." };
      const ref = req.ageReferenceDate ?? today;
      const age = ageOn(profile.birthDate, ref);
      const when = req.ageReferenceDate ? `per ${toDateInput(req.ageReferenceDate)}` : "hari ini";
      return age <= max
        ? { status: "MEETS", reason: `Usia kamu ${age} tahun ${when} (maks. ${max}).` }
        : { status: "FAILS", reason: `Usia kamu ${age} tahun ${when}, melewati batas ${max}.` };
    }
    case "MAJOR": {
      if (ALL_MAJORS.test(req.value.toLowerCase())) return { status: "MEETS", reason: "Terbuka untuk semua jurusan." };
      if (!profile.major) return { status: "UNKNOWN", reason: "Isi jurusan di Pengaturan untuk mengecek syarat ini." };
      return majorMatches(profile.major, req.value)
        ? { status: "MEETS", reason: `Jurusan ${profile.major} sesuai.` }
        : { status: "WARNING", reason: `Jurusan ${profile.major} tidak tercantum. Cek apakah termasuk "jurusan terkait".` };
    }
    case "MIN_DEGREE": {
      const min = parseMinDegree(req.value);
      if (!min) return { status: "UNKNOWN", reason: "Jenjang pendidikan minimal tidak terbaca." };
      if (!profile.degree) return { status: "UNKNOWN", reason: "Isi pendidikan terakhir di Pengaturan untuk mengecek syarat ini." };
      return DEGREE_RANK[profile.degree] >= DEGREE_RANK[min]
        ? { status: "MEETS", reason: `Pendidikan ${profile.degree} memenuhi minimal ${min}.` }
        : { status: "FAILS", reason: `Pendidikan ${profile.degree} di bawah minimal ${min}.` };
    }
    case "PLACEMENT":
    case "SERVICE_BOND":
      return { status: "WARNING", reason: "Perlu dipertimbangkan." };
    case "OTHER":
      return { status: "UNKNOWN", reason: "Cek manual." };
  }
}

const SEVERITY: EligibilityStatus[] = ["FAILS", "WARNING", "UNKNOWN", "MEETS"];

/** Worst status wins; null when there is nothing to check. */
export function overallStatus(statuses: EligibilityStatus[]): EligibilityStatus | null {
  return SEVERITY.find((s) => statuses.includes(s)) ?? null;
}

export const ELIGIBILITY_LABELS: Record<EligibilityStatus, string> = {
  MEETS: "Memenuhi",
  WARNING: "Perlu dicek",
  FAILS: "Tidak memenuhi",
  UNKNOWN: "Belum bisa dicek",
};
