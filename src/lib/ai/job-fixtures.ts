// Three postings in the style of real Indonesian job ads (BUMN, bank, startup), used by
// extract-job.test.ts and scripts/extract-fixtures.mts (live run against NVIDIA).
// `expected` lists what a correct extraction must contain.

export const JOB_FIXTURES = [
  {
    name: "BUMN",
    text: `Rekrutmen Bersama BUMN 2026
PT Telkom Indonesia (Persero) Tbk

Posisi: Associate Software Engineer
Lokasi Kerja: Bandung, Jawa Barat (penempatan dapat di seluruh wilayah operasional Telkom)

Persyaratan Umum:
1. Warga Negara Indonesia
2. Pendidikan minimal S1 Teknik Informatika, Ilmu Komputer, atau Sistem Informasi
3. IPK minimal 3.00 (skala 4.00)
4. Usia maksimal 25 tahun per 1 Desember 2026
5. Bersedia ditempatkan di seluruh wilayah operasional Telkom
6. Bersedia menandatangani ikatan dinas selama 3 tahun

Kualifikasi Teknis:
- Menguasai Java atau Go
- Memahami REST API dan PostgreSQL
- Terbiasa menggunakan Git

Pendaftaran dibuka 20 Oktober 2026 dan ditutup 10 November 2026 melalui portal rekrutmenbersama.fhcibumn.id.`,
    expected: {
      company: /telkom/i,
      position: /software engineer/i,
      deadline: "2026-11-10",
      requirementTypes: ["MIN_GPA", "MAX_AGE", "MAJOR", "MIN_DEGREE", "PLACEMENT", "SERVICE_BOND"],
      gpa: "3.00",
      maxAge: "25",
      ageReferenceDate: "2026-12-01",
      skills: [/java/i, /postgres/i, /git/i],
    },
  },
  {
    name: "Bank",
    text: `PT Bank Rakyat Indonesia (Persero) Tbk membuka kesempatan berkarier melalui program BRILiaN Future Leader Program (BFLP) Specialist - IT.

Kualifikasi:
• Pendidikan S1/S2 dari jurusan Teknik Informatika, Sistem Informasi, Teknik Komputer, Matematika, atau Statistika
• IPK minimal 3,00 untuk S1 dan 3,25 untuk S2
• Usia maksimal 26 tahun untuk S1 dan 28 tahun untuk S2 pada saat pendaftaran
• Belum menikah dan bersedia tidak menikah selama masa pendidikan
• Bersedia ditempatkan di seluruh unit kerja BRI di Indonesia
• Bersedia menjalani ikatan dinas selama 2 tahun setelah pendidikan

Diutamakan menguasai Python, SQL, dan memiliki pengalaman dengan cloud (AWS/GCP).

Lokasi: Kantor Pusat BRI, Jakarta Pusat
Batas akhir pendaftaran: 30 November 2026`,
    expected: {
      company: /bank rakyat indonesia|bri/i,
      position: /brilian|bflp|future leader/i,
      deadline: "2026-11-30",
      requirementTypes: ["MIN_GPA", "MAX_AGE", "MAJOR", "MIN_DEGREE", "PLACEMENT", "SERVICE_BOND", "OTHER"],
      gpa: "3.00",
      maxAge: "26",
      ageReferenceDate: null,
      skills: [/python/i, /sql/i],
    },
  },
  {
    name: "Startup",
    text: `We're hiring! 🚀

Frontend Engineer (React) at Pintu Kripto Digital
Jakarta Selatan (Hybrid, 3 days WFO)

What you'll do:
- Build and maintain our web trading platform using React and TypeScript
- Collaborate with designers to implement pixel-perfect UI
- Write unit tests with Jest / React Testing Library

Requirements:
- Bachelor's degree in Computer Science or related field, or equivalent experience
- 2+ years of experience with React.js and TypeScript
- Familiar with Next.js and Tailwind CSS
- Good communication in English

Apply before 15 December 2026.`,
    expected: {
      company: /pintu/i,
      position: /frontend engineer/i,
      deadline: "2026-12-15",
      requirementTypes: ["MIN_DEGREE", "MAJOR"],
      gpa: null,
      maxAge: null,
      ageReferenceDate: null,
      skills: [/react/i, /typescript/i, /next/i, /tailwind/i],
    },
  },
] as const;
