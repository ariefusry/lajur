# CLAUDE.md — Lajur: Tracker Lamaran Kerja dengan Bantuan AI

> Taruh file ini di root repo. Claude Code membacanya otomatis setiap sesi.
> Nama aplikasi: **Lajur** (sebelumnya "Lamarin"). Produksi: https://lajur.vercel.app. Repo: `ariefusry/lajur`.
> Email akun demo tetap `demo@lamarin.local`, karena mengubahnya membuat reset harian membuat akun demo kedua.

---

## 1. Ringkasan produk

Web app untuk pencari kerja di Indonesia yang melamar ke banyak tempat sekaligus. Masalah yang diselesaikan:
- deadline pendaftaran dan jadwal tes terlupa
- tidak ingat versi CV mana yang dikirim ke perusahaan mana
- tidak tahu tahap seleksi mana yang paling sering membuat gagal
- syarat lowongan yang panjang (IPK minimal, batas usia, jurusan, ikatan dinas, penempatan) harus dibaca ulang terus

Pembeda dari Huntr/Teal: **konteks Indonesia**. Tahap seleksinya khas (administrasi, tes online/TPA, psikotes, LGD, interview HR, interview user, MCU, offering), ada cek kelayakan terhadap syarat administratif, dan UI-nya berbahasa Indonesia.

Pengguna pertama: pemilik repo sendiri. Aplikasinya harus enak dipakai setiap hari, bukan sekadar demo.

---

## 2. Tech stack (sudah diputuskan, jangan diganti tanpa bertanya)

| Lapisan | Pilihan |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript (strict) |
| UI | Tailwind CSS + shadcn/ui, ikon lucide-react |
| Drag-and-drop | @dnd-kit/core + @dnd-kit/sortable |
| Kalender | react-big-calendar atau komponen kalender shadcn |
| Chart | Recharts |
| Database | PostgreSQL di **Neon** (paket gratis, region AWS Singapore), diprovisi lewat `neon.ts` + Neon CLI (bagian 4a) |
| ORM | Prisma. Driver/adapter koneksi dipilih mengikuti skill agent Neon yang terinstal, sesuai runtime Vercel (bagian 4a) |
| Auth | Auth.js (NextAuth v5) dengan Google provider + Prisma adapter |
| File CV | **Neon Object Storage** (kompatibel S3), bucket **privat**, lewat `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` dengan `forcePathStyle: true`, akses lewat presigned URL. Cadangan: Cloudflare R2 dengan kode yang sama |
| Parsing PDF | pdf-parse |
| AI (abstraksi) | Vercel AI SDK (`ai`) dengan `generateObject` + skema Zod |
| AI (utama) | **OpenRouter** (`openrouter.ai`, model gratis non-Anthropic) via `@ai-sdk/openai-compatible`, model dari env `LLM_MODEL` (format `<provider>:<model id>`) |
| AI (cadangan) | NVIDIA API Catalog (`integrate.api.nvidia.com`, gratis), dari env `LLM_FALLBACK_MODEL`, opsional |
| **Dilarang** | API Anthropic/Claude dalam bentuk apa pun (lihat aturan 10) |
| Rate limit | Tabel `AiUsage` di Postgres (tanpa layanan tambahan) |
| Validasi | Zod (form, API, dan output AI) |
| Email | Resend |
| Cron | Vercel Cron |
| Test | Vitest (unit), Playwright (E2E) |
| CI | GitHub Actions: lint, typecheck, test |
| Deploy | Vercel |

Package manager: **pnpm**.

---

## 3. Aturan kerja untuk Claude

1. **Kerjakan satu fase dalam satu waktu** (lihat bagian 8). Di akhir fase, jalankan `pnpm lint && pnpm typecheck && pnpm test`, laporkan hasilnya, lalu berhenti dan tunggu konfirmasi.
2. **Tanya dulu** sebelum menambah dependency di luar daftar di atas, mengubah skema database secara besar, atau menghapus file.
3. Nama identifier dan kode pakai **bahasa Inggris**. Semua teks UI pakai **bahasa Indonesia**.
4. **Jangan pernah** menulis secret ke kode atau commit. Pakai `.env.local`, dan perbarui `.env.example` (nama variabel saja, tanpa nilai).
5. Setiap query database **wajib** difilter `userId` dari session. Tidak boleh ada endpoint yang mengembalikan data milik pengguna lain. Buat helper `requireUser()` dan pakai di semua server action atau route.
6. Mutasi data lewat **Server Actions** dengan validasi Zod. Route Handler (`app/api/...`) hanya untuk cron, upload, AI, dan health check (`/api/health`, tanpa data pribadi).
7. Fitur AI **opsional**: kalau tidak ada API key yang terpasang, atau provider utama dan cadangan sama-sama gagal, aplikasi tetap jalan dan user bisa mengisi manual.
7a. **Jangan pernah mengirim teks CV utuh atau data pribadi ke LLM.** Semua input ke LLM yang berasal dari CV wajib melewati `lib/ai/redact.ts` lebih dulu (lihat 7.5). Endpoint gratis NVIDIA dan model gratis OpenRouter bisa memakai data yang dikirim untuk melatih model.
7b. Semua panggilan LLM wajib lewat `lib/ai/provider.ts`. Jangan memanggil SDK provider langsung dari route atau komponen.
8. Commit kecil dan sering, format Conventional Commits (`feat:`, `fix:`, `test:`, `chore:`).
9. Jangan menjalankan `prisma migrate reset` atau perintah yang menghapus data tanpa izin.
10. **Aplikasi ini TIDAK BOLEH memakai API Anthropic/Claude.** Pemilik repo tidak ingin akun Claude-nya dipakai atau ditagih oleh aplikasi ini. Artinya:
    - Jangan menginstal `@anthropic-ai/sdk`, `@ai-sdk/anthropic`, atau SDK lain yang memanggil `api.anthropic.com`.
    - Jangan menulis atau membaca variabel `ANTHROPIC_API_KEY` (atau `CLAUDE_*`) di kode, `.env.example`, `.env.local`, maupun konfigurasi CI/Vercel.
    - Provider LLM yang diizinkan hanya **NVIDIA API Catalog** (`integrate.api.nvidia.com`, `NVIDIA_API_KEY`) dan **OpenRouter** (`openrouter.ai`, `OPENROUTER_API_KEY`). OpenRouter ditambahkan atas persetujuan pemilik repo pada 2026-10-18.
    - OpenRouter juga menyediakan model Anthropic/Claude: **jangan pernah** memakai model itu. `lib/ai/provider.ts` menolak ID model yang mengandung nama vendor tersebut. Jangan memakai router acak seperti `openrouter/free`, karena modelnya tidak bisa dikendalikan.
    - Kalau suatu saat butuh provider lain, **tanya dulu**. Jangan menambahkannya sendiri.
    - Di akhir setiap fase, jalankan `pnpm check:llm-provider` (lihat bagian 9) dan pastikan hasilnya bersih.

---

## 4. Environment variables (`.env.example`)

```
# --- Neon (Postgres + Object Storage) ---
# JANGAN diisi manual. Variabel-variabel ini ditulis otomatis oleh `neon deploy` ke .env.local (bagian 4a).
# Setelah `neon deploy`, salin NAMA variabel yang dihasilkannya (tanpa nilai) ke bagian ini,
# lalu hapus komentar ini. Pakai nama-nama itu persis di kode. Jangan mengarang nama sendiri.

AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
# AI — provider utama (NVIDIA API Catalog, gratis)
NVIDIA_API_KEY=
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
LLM_MODEL=deepseek-ai/deepseek-v4.1-flash   # ID sesuai contoh kode resmi di build.nvidia.com
# AI — model cadangan (opsional): ID model gratis lain dari build.nvidia.com, memakai NVIDIA_API_KEY yang sama.
# Kosongkan kalau tidak dipakai. JANGAN isi dengan model Claude/Anthropic.
LLM_FALLBACK_MODEL=
# AI — batas pemakaian
AI_DAILY_LIMIT_PER_USER=30
AI_DAILY_LIMIT_DEMO=10
RESEND_API_KEY=
EMAIL_FROM=
CRON_SECRET=
APP_URL=http://localhost:3000
```

Semua kredensial database dan storage hanya dipakai di server (`lib/db.ts` dan `lib/storage.ts` diberi `import "server-only"`), jangan pernah diimpor di komponen client. Jangan pernah memakai variabel berawalan `NEXT_PUBLIC_` untuk secret.

---

## 4a. Setup Neon (langkah pertama Fase 1, setelah scaffold Next.js)

Project Neon sudah dibuat oleh pemilik repo (region AWS Asia Pacific 1, Singapore). Jalankan langkah berikut **di root project, setelah scaffold Next.js selesai**:

1. Instal CLI: `npm i -g neon@latest`. Kalau gagal, pakai `npx neon@latest` setiap kali perintah di bawah menyebut `neon`.
   - Kalau perintah `neon` membuka sign-in di browser, **berhenti dan minta pemilik repo menyelesaikannya di browser**.
   - Kalau sign-in timeout atau gagal, minta pemilik repo menjalankan `neon login` sendiri, lalu ulangi perintahnya.
2. Inisialisasi:
   ```
   neon init -y --org-id org-delicate-flower-88481685 --project-id mute-mud-50782304 --branch production --services postgres,object-storage
   ```
   Perintah ini membuat `neon.ts`. File itu di-commit (tidak berisi secret).
3. Provisioning: `neon deploy`. Perintah ini menyiapkan layanan yang ada di `neon.ts`, lalu menarik env var-nya ke `.env.local` (atau `.env` kalau file itu sudah ada).
   - Sebelum menjalankannya, pastikan `.env`, `.env.local`, dan `.env*.local` sudah ada di `.gitignore`.
   - Setelah selesai, pastikan variabel lain yang sudah ada di `.env.local` (AUTH, NVIDIA, dll.) tidak tertimpa. Kalau tertimpa, laporkan dan minta pemilik repo mengisinya ulang. Jangan mengarang nilainya.
   - Salin **nama** variabel Neon yang dihasilkan ke `.env.example` (bagian 4).
4. Sambungkan setiap layanan ke kode memakai env var tersebut:
   - **Baca dulu skill agent Neon yang terinstal** dan ikuti best practice-nya, terutama soal driver database yang tepat untuk Prisma di Next.js yang di-deploy ke Vercel (serverless). Contohnya: perlu driver serverless/adapter Neon atau tidak, connection string pooled vs langsung, dan URL mana yang dipakai untuk migrasi. Tulis keputusan dan alasannya di README.
   - **Postgres** → `lib/db.ts` (Prisma client singleton).
   - **Object Storage** → `lib/storage.ts` (lihat 7.2).
5. **Buktikan semuanya jalan:**
   - `pnpm build` harus lolos.
   - Jalankan aplikasi (`pnpm dev` atau `pnpm start`), lalu uji setiap layanan dari ujung ke ujung:
     - **Postgres:** `pnpm db:migrate` berhasil, lalu sebuah request ke aplikasi membaca dan menulis satu baris sungguhan (misalnya health check di `/api/health` yang menjalankan `SELECT 1` dan menghitung jumlah `User`).
     - **Object Storage:** upload sebuah PDF kecil lewat `/api/resumes/upload` (atau script uji di `scripts/`), buka presigned URL-nya dan pastikan isinya sama, lalu hapus objeknya.
6. **Laporkan:** apa saja yang berubah (file dan dependency), output perintah yang membuktikan langkah 5, dan apa pun yang gagal. Jangan menyatakan berhasil tanpa output sebagai bukti.

Catatan:
- Instruksi asli Neon memakai `npm run build`. Project ini memakai pnpm, jadi pakai `pnpm build`. CLI `neon` sendiri boleh diinstal global lewat npm.
- Layanan Neon lain (Functions, AI gateway, Realtime, Neon Auth) **tidak dipakai**. Jangan menambahkannya ke `neon.ts`. AI gateway khususnya dilarang, karena satu-satunya provider LLM adalah NVIDIA (aturan 10).
- Region function di Vercel harus diset ke Singapore (`sin1`), sama dengan region database, misalnya lewat `"regions": ["sin1"]` di `vercel.json`.

---

## 5. Struktur folder

```
src/
  app/
    (auth)/login/page.tsx
    (app)/
      layout.tsx                 # sidebar + guard login
      dashboard/page.tsx         # analitik
      board/page.tsx             # kanban
      applications/[id]/page.tsx # detail lamaran
      applications/new/page.tsx  # form + tempel lowongan
      calendar/page.tsx
      resumes/page.tsx
      settings/page.tsx          # profil (IPK, tgl lahir, jurusan, domisili) + tahap
    api/
      auth/[...nextauth]/route.ts
      resumes/upload/route.ts
      ai/extract/route.ts
      ai/skill-gap/route.ts
      cron/reminders/route.ts
  components/                    # ui/ (shadcn), board/, application/, charts/
  lib/
    auth.ts                      # Auth.js config + requireUser()
    db.ts                        # Prisma client singleton
    storage.ts                   # klien S3 ke Neon Object Storage: upload, hapus, presigned URL (server-only)
    ai/
      provider.ts                # pilih model utama/cadangan, retry, fallback
      usage.ts                   # rate limit harian per user (tabel AiUsage)
      redact.ts                  # hapus data pribadi dari teks CV
      redact.test.ts
      extract-job.ts             # prompt + Zod schema ekstraksi
      extract-job.test.ts        # 3 contoh lowongan nyata sebagai fixture
      skill-gap.ts
      skill-aliases.ts           # "JS" = "JavaScript", dst.
    eligibility/
      check.ts                   # logika cek kelayakan (deterministik, TANPA AI)
      check.test.ts
    reminders.ts
    stage-templates.ts
  actions/                       # server actions per domain
neon.ts                          # dibuat oleh `neon init`, daftar layanan Neon (di-commit)
prisma/
  schema.prisma
  seed.ts                        # akun demo + data dummy
e2e/
  application-flow.spec.ts
```

---

## 6. Skema database (Prisma)

Koneksi ke Neon memakai env var yang ditulis `neon deploy` (bagian 4a). Biasanya aplikasi memakai connection string pooled, sedangkan `prisma migrate` memakai koneksi langsung. Ikuti skill agent Neon dan cara konfigurasi di versi Prisma yang terinstal (`directUrl` di blok `datasource`, atau `prisma.config.ts` untuk versi yang memakainya). Cek dokumentasinya, jangan menebak. Database gratis Neon tidur setelah 5 menit tidak dipakai, jadi request pertama setelahnya bisa sedikit lambat. Itu normal, bukan bug.

Model Auth.js (`Account`, `Session`, `VerificationToken`) ditambahkan sesuai dokumentasi adapter. Model aplikasi:

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  // profil untuk cek kelayakan
  gpa           Decimal?  @db.Decimal(3, 2)   // skala 4.00
  birthDate     DateTime? @db.Date
  major         String?                       // contoh: "Informatika"
  degree        Degree?
  domicile      String?                       // contoh: "Bekasi"
  createdAt     DateTime  @default(now())

  accounts      Account[]
  sessions      Session[]
  resumes       Resume[]
  stages        Stage[]
  applications  Application[]
}

enum Degree { SMA D3 D4 S1 S2 }

model Resume {
  id            String   @id @default(cuid())
  userId        String
  versionName   String                        // contoh: "CV Fullstack v2"
  filePath      String                        // path di bucket, BUKAN URL publik
  extractedText String?  @db.Text
  createdAt     DateTime @default(now())
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  applications  Application[]
  @@index([userId])
}

model Stage {
  id        String  @id @default(cuid())
  userId    String
  name      String                            // contoh: "Psikotes"
  order     Int
  kind      StageKind @default(IN_PROGRESS)
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  applications Application[]
  history   StageHistory[]
  @@index([userId, order])                  // bukan unique, supaya reorder tidak bentrok
}

enum StageKind { WISHLIST IN_PROGRESS OFFER REJECTED WITHDRAWN }

model Application {
  id             String   @id @default(cuid())
  userId         String
  resumeId       String?
  currentStageId String
  company        String
  position       String
  source         JobSource
  url            String?
  jobPostingText String?  @db.Text
  location       String?
  deadline       DateTime?
  expectedSalary Int?                          // rupiah per bulan
  notes          String?  @db.Text
  appliedAt      DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  resume       Resume?  @relation(fields: [resumeId], references: [id], onDelete: SetNull)
  currentStage Stage    @relation(fields: [currentStageId], references: [id])
  history      StageHistory[]
  events       Event[]
  requirements Requirement[]
  skillGaps    SkillGap[]
  @@index([userId, currentStageId])
}

enum JobSource { JOBSTREET KALIBRR GLINTS LINKEDIN COMPANY_SITE BUMN_PORTAL INSTAGRAM REFERRAL OTHER }

model StageHistory {
  id            String   @id @default(cuid())
  applicationId String
  stageId       String
  enteredAt     DateTime @default(now())
  result        StageResult?
  notes         String?  @db.Text             // pertanyaan wawancara, kesan, alasan gagal
  application   Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  stage         Stage       @relation(fields: [stageId], references: [id])
  @@index([applicationId])
}

enum StageResult { PASSED FAILED PENDING }

model Event {
  id            String    @id @default(cuid())
  applicationId String
  type          EventType
  startsAt      DateTime
  locationOrUrl String?
  remindedH3At  DateTime?
  remindedH1At  DateTime?
  application   Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  @@index([startsAt])
}

enum EventType { DEADLINE ONLINE_TEST PSYCHOTEST LGD INTERVIEW_HR INTERVIEW_USER MCU OTHER }

model Requirement {
  id            String   @id @default(cuid())
  applicationId String
  type          RequirementType
  value         String                         // nilai mentah, contoh "3.00" atau "25"
  sourceQuote   String   @db.Text              // kutipan asli dari lowongan (wajib)
  status        EligibilityStatus @default(UNKNOWN)
  reason        String?
  editedByUser  Boolean  @default(false)
  application   Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
}

enum RequirementType { MIN_GPA MAX_AGE MAJOR MIN_DEGREE PLACEMENT SERVICE_BOND OTHER }
enum EligibilityStatus { MEETS WARNING FAILS UNKNOWN }

model AiUsage {
  id        String   @id @default(cuid())
  userId    String
  day       DateTime @db.Date                 // tanggal Asia/Jakarta
  feature   AiFeature
  model     String                            // ID model NVIDIA yang dipakai (utama atau cadangan)
  count     Int      @default(0)
  @@unique([userId, day, feature, model])
}

enum AiFeature { EXTRACT_JOB SKILL_GAP }

model ExtractionCache {
  id         String   @id @default(cuid())
  textHash   String   @unique                 // sha256 dari teks lowongan yang sudah dinormalisasi
  result     Json
  model      String
  createdAt  DateTime @default(now())
}

model SkillGap {
  id            String  @id @default(cuid())
  applicationId String
  skill         String
  inResume      Boolean
  suggestion    String?
  sourceQuote   String? @db.Text
  application   Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
}
```

Saat user pertama kali login, buat tahap default dari template di `lib/stage-templates.ts`:
- **BUMN/Bank**: Wishlist → Administrasi → Tes Online/TPA → Psikotes → LGD → Interview HR → Interview User → MCU → Offering → Ditolak
- **Startup**: Wishlist → Melamar → Technical Test → Interview HR → Interview User → Offering → Ditolak

---

## 7. Spesifikasi fitur penting

### 7.1 Kanban
- Kolom = `Stage` milik user, urut berdasarkan `order`.
- Drag kartu ke kolom lain → update `currentStageId` + tambah `StageHistory`, dalam satu transaksi.
- Optimistic update di client. Kalau server gagal, rollback + tampilkan toast.
- Kartu menampilkan perusahaan, posisi, sumber, deadline terdekat (merah kalau ≤ 3 hari), dan badge kelayakan.

### 7.2 Upload CV (Neon Object Storage)
Klien S3 di `lib/storage.ts`. Endpoint, kredensial, region, dan nama bucket diambil dari env var yang ditulis `neon deploy`. Cek nama persisnya di `.env.local`, dan ikuti skill agent Neon untuk object storage:

```ts
import "server-only";
import { S3Client } from "@aws-sdk/client-s3";

export const storage = new S3Client({
  region: /* dari env Neon, atau "auto" jika skill Neon menyarankan begitu */,
  endpoint: /* endpoint S3 dari env Neon */,
  credentials: { accessKeyId: /* env Neon */, secretAccessKey: /* env Neon */ },
  forcePathStyle: true, // WAJIB: Neon hanya mendukung path-style addressing
});
```

- Neon hanya mendukung SigV4 (bawaan AWS SDK v3, tidak perlu diatur).
- `DeleteObject` di Neon melakukan soft-delete di branch aktif. Itu wajar.
- Bucket harus tetap **privat** (bawaan Neon). Jangan diubah ke `public_read`.
- **Cadangan:** kalau batas gratis Neon Object Storage tidak cukup, ganti ke Cloudflare R2 cukup dengan mengubah konfigurasi klien di file ini (endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, region `auto`). Bagian kode lain tidak perlu berubah. Tanya pemilik repo dulu sebelum pindah.

- **Upload lewat server** (`POST /api/resumes/upload`), bukan langsung dari browser, supaya file bisa divalidasi sebelum disimpan.
- Hanya PDF, **maksimal 4 MB**. Batas ini dipilih karena request body ke fungsi Vercel dibatasi sekitar 4,5 MB, dan CV biasanya di bawah 1 MB. Validasi di server: MIME `application/pdf` dan magic bytes `%PDF`.
- Key objek: `cv/{userId}/{resumeId}.pdf`, disimpan dengan `PutObjectCommand` (`ContentType: application/pdf`). Kolom `Resume.filePath` menyimpan key ini, bukan URL.
- Ekstrak teks dengan pdf-parse dari buffer yang sama, lalu simpan ke `extractedText`.
- **Membuka file:** server action memeriksa bahwa resume itu milik user yang login, lalu membuat presigned URL `GetObjectCommand` yang berlaku **60 detik** (`ResponseContentDisposition: inline`). Bucket tidak boleh punya akses publik atau custom domain publik.
- **Menghapus resume:** hapus objek di storage (`DeleteObjectCommand`) dan baris di database. Kalau penghapusan di storage gagal, catat di log dan jangan batalkan penghapusan di database.
- Di unit test, mock `lib/storage.ts`. Storage sungguhan hanya dipakai di uji ujung ke ujung (bagian 4a langkah 5).

### 7.3 Ekstraksi lowongan (AI)
`POST /api/ai/extract` dengan body `{ text?: string, url?: string }`. Kalau ada URL, ambil HTML-nya di server, buang tag, lalu potong maksimal 20.000 karakter.

Alur:
1. Normalisasi teks (trim, rapikan spasi), hitung `sha256`. Kalau ada di `ExtractionCache`, kembalikan langsung tanpa memanggil LLM dan tanpa memotong kuota.
2. Cek kuota (7.8). Kalau habis, kembalikan 429 dengan pesan "Kuota AI hari ini habis, isi manual dulu ya".
3. Panggil `generateObject` lewat `lib/ai/provider.ts` dengan skema di bawah.
4. Validasi kutipan, lalu simpan ke cache.

Teks lowongan bersifat publik, jadi boleh dikirim ke provider gratis. Skema Zod-nya:

```ts
const ExtractedJob = z.object({
  company: z.string().nullable(),
  position: z.string().nullable(),
  location: z.string().nullable(),
  deadline: z.string().date().nullable(),          // YYYY-MM-DD
  skills: z.array(z.object({ name: z.string(), quote: z.string() })),
  requirements: z.array(z.object({
    type: z.enum(["MIN_GPA","MAX_AGE","MAJOR","MIN_DEGREE","PLACEMENT","SERVICE_BOND","OTHER"]),
    value: z.string(),
    ageReferenceDate: z.string().date().nullable(), // contoh "per 31 Desember 2026"
    quote: z.string(),                               // kutipan persis dari teks lowongan
  })),
});
```

Aturan prompt:
- Hanya ekstrak informasi yang **tertulis** di lowongan. Kalau tidak ada, isi `null` atau array kosong. Dilarang menebak.
- `quote` harus berupa substring persis dari teks. Di server, buang item yang `quote`-nya tidak ditemukan di teks asli.
- Hasilnya hanya mengisi form sebagai draf. User meninjau dan bisa mengedit sebelum menyimpan.

### 7.4 Cek kelayakan (deterministik, tanpa AI)
`lib/eligibility/check.ts`, berupa fungsi murni `checkRequirement(req, profile, today) → { status, reason }`:
- `MIN_GPA`: profil ≥ nilai → MEETS, kurang → FAILS. Profil kosong → UNKNOWN.
- `MAX_AGE`: hitung usia pada `ageReferenceDate` (default: hari ini). ≤ batas → MEETS. Usia tepat di batas tetap MEETS.
- `MAJOR`: cocokkan tanpa membedakan huruf besar-kecil, dengan sinonim (Informatika ≈ Teknik Informatika ≈ Ilmu Komputer ≈ Computer Science ≈ "semua jurusan"). Tidak cocok → WARNING, bukan FAILS, karena seringnya ada "jurusan terkait".
- `MIN_DEGREE`: urutan SMA < D3 < D4 = S1 < S2.
- `PLACEMENT` dan `SERVICE_BOND`: selalu WARNING dengan alasan "perlu dipertimbangkan".
- `OTHER`: UNKNOWN.

Tulis unit test untuk setiap cabang, termasuk kasus batas usia dan tanggal lahir 29 Februari.

### 7.5 Analisis gap skill (AI, dengan perlindungan data pribadi)
Input berupa daftar skill hasil ekstraksi + `extractedText` dari CV yang dipilih.

1. **Tanpa AI dulu:** cocokkan skill dengan teks CV secara case-insensitive memakai alias di `skill-aliases.ts` ("JS" = "JavaScript", "Postgres" = "PostgreSQL", "React.js" = "React"). Skill yang ketemu langsung ditandai ✅ tanpa LLM.
2. **Redaksi:** `redact(cvText)` di `lib/ai/redact.ts`:
   - Ambil hanya bagian yang relevan (judul bagian seperti Skills/Keahlian, Experience/Pengalaman, Projects/Proyek, Organisasi). Buang bagian lain.
   - Hapus email, nomor HP (`+62`, `08xx`), URL (LinkedIn, GitHub, portofolio), NIK/angka panjang, dan alamat (baris yang mengandung Jl., RT/RW, Kel., Kec., Kota, kode pos).
   - Hapus nama pemilik akun (dari `User.name`) beserta variasi tiap katanya.
   - Potong maksimal 6.000 karakter.
   - Unit test wajib: pastikan email, nomor HP, URL, dan nama tidak tersisa di output.
3. **Baru ke LLM:** hanya skill yang belum ketemu + teks yang sudah diredaksi. LLM mengembalikan `{ skill, inResume, suggestion, quote }`. Kalau `quote` tidak ada di teks redaksi, set `inResume=false`.
4. Tampilkan sebagai daftar ✅ ada / ❌ belum ada + saran.
5. Di UI, tampilkan catatan kecil: "Hanya bagian keahlian dan pengalaman (tanpa nama dan kontak) yang dikirim ke AI."

### 7.6 Pengingat
- `vercel.json`: cron harian `0 0 * * *` (07.00 WIB) ke `/api/cron/reminders`.
- Route memverifikasi header `Authorization: Bearer ${CRON_SECRET}`.
- Kirim email untuk event yang jatuh H-3 dan H-1 (zona waktu Asia/Jakarta) dan belum diingatkan, lalu isi `remindedH3At` / `remindedH1At`. Proses harus idempoten.

### 7.7 Dashboard analitik
- **Funnel**: jumlah lamaran yang pernah mencapai tiap tahap (dari `StageHistory`), plus persentase lanjut antar tahap.
- **Per sumber**: jumlah lamaran dan tingkat lolos administrasi per `JobSource`.
- **Per versi CV**: tingkat lolos administrasi per `Resume`.
- **Waktu respons**: median hari dari `appliedAt` sampai perpindahan tahap pertama.
- Semua agregasi dilakukan di server (Prisma/SQL), bukan di client.

### 7.8 Provider AI, fallback, dan rate limit
`lib/ai/provider.ts` mengekspor `generateStructured({ schema, system, prompt, feature, userId })`:

```ts
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const nvidia = createOpenAICompatible({
  name: "nvidia",
  baseURL: process.env.NVIDIA_BASE_URL!,
  apiKey: process.env.NVIDIA_API_KEY,
});
// primary  = nvidia(process.env.LLM_MODEL)
// fallback = nvidia(process.env.LLM_FALLBACK_MODEL)  -> hanya jika LLM_FALLBACK_MODEL diisi
// Tidak ada provider lain. Base URL harus selalu integrate.api.nvidia.com.
```

Contoh resmi NVIDIA untuk model ini memakai package `openai` langsung:

```ts
import OpenAI from "openai";
const openai = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: "https://integrate.api.nvidia.com/v1",
});
await openai.chat.completions.create({ model: "deepseek-ai/deepseek-v4.1-flash", messages, ... });
```

Endpoint dan format request-nya sama dengan `createOpenAICompatible` di atas, jadi tetap pakai AI SDK. Kalau AI SDK bermasalah dengan model ini (misalnya structured output tidak jalan), boleh ganti implementasi di dalam `provider.ts` ke package `openai` seperti contoh di atas, asalkan antarmuka `generateStructured` tidak berubah.

**Jangan salin parameter dari contoh NVIDIA.** Contoh itu dibuat untuk demo deskripsi gambar (`temperature: 1`, `top_p: 0.95`, `max_tokens: 262144`). Untuk ekstraksi data terstruktur pakai:

Perilaku:
- `temperature: 0`, `maxOutputTokens: 4000`, timeout 60 detik. Output **di-stream** (diputuskan 2026-10-18 atas permintaan pemilik repo) hanya supaya UI bisa menampilkan temuan AI saat itu juga; validasi Zod, cek kutipan, retry, dan fallback tetap memakai hasil akhir. Tanpa `response_format`, karena OpenRouter menahan seluruh jawaban kalau `response_format` JSON dipakai; skema JSON ditulis di prompt, dan teks jawaban dibersihkan dari fence/teks tambahan sebelum divalidasi (dinaikkan dari 30 detik pada 2026-10-17; percobaan dengan reasoning menyala butuh ±45 detik).
- Urutan percobaan (diputuskan 2026-10-18 dari uji 3 fixture): model utama dengan **reasoning mati** (±10 detik) → kalau output gagal divalidasi Zod, ulang **sekali** dengan **reasoning menyala** dan pesan error validasinya → kalau masih gagal, atau kena error 429/5xx/timeout, pindah ke model cadangan (jika `LLM_FALLBACK_MODEL` diisi) dengan urutan yang sama → kalau semua gagal, lempar `AiUnavailableError` yang di UI ditampilkan sebagai "AI sedang tidak tersedia, silakan isi manual".
- Mode output: teks biasa berisi JSON, dengan skema JSON di prompt (lihat poin di atas dan README). AI SDK v7 tidak lagi punya `generateObject({ mode })`; dipakai `streamText` + `parsePartialJson` untuk temuan sementara.
- Catat setiap panggilan yang berhasil ke `AiUsage` (model yang benar-benar dipakai).
- Saat aplikasi start, kalau `NVIDIA_BASE_URL` tidak mengarah ke `integrate.api.nvidia.com`, matikan provider NVIDIA dan tulis peringatan di log. Base URL OpenRouter di-hardcode ke `https://openrouter.ai/api/v1`.
- **Rate limit:** sebelum memanggil, jumlahkan `AiUsage.count` hari ini untuk user tersebut. Lewat `AI_DAILY_LIMIT_PER_USER` (akun demo: `AI_DAILY_LIMIT_DEMO`) → tolak dengan 429. Cache hit tidak menambah hitungan.
- Jangan pernah log isi prompt atau CV ke console di production. Log hanya fitur, provider, durasi, dan status.

Catatan: endpoint NVIDIA berstatus trial (sekitar 40 request/menit, sering penuh) dan model gratis OpenRouter punya batas harian. Model bisa berubah, karena itu ID model disimpan di env, bukan di-hardcode.

---

## 8. Fase pengerjaan

Centang setiap item setelah selesai. Berhenti di akhir setiap fase.

### Fase 1 — Fondasi (minggu 1)
- [x] Scaffold Next.js + TS strict + Tailwind + shadcn/ui + ESLint + Prettier
- [x] Setup Neon sesuai bagian 4a: `neon init`, `neon deploy`, sambungkan Postgres + Object Storage, `pnpm build` lolos, uji kedua layanan dari ujung ke ujung, lalu laporkan output-nya. **Berhenti dan tunggu konfirmasi sebelum lanjut.**
- [x] Skema Prisma di atas + migrasi pertama ke Neon
- [x] Auth.js Google login, `requireUser()`, layout dengan sidebar
- [x] Halaman Settings: profil + kelola tahap (tambah, ubah nama, urutkan) + pilih template
- [x] CRUD lamaran (form dengan validasi Zod)
- [x] Kanban drag-and-drop dengan pencatatan `StageHistory`
- [x] Seed: akun demo + 15 lamaran dummy di berbagai tahap
- **Selesai jika:** bisa login, membuat lamaran, dan menggesernya antar kolom. Setelah refresh, posisinya tetap, dan riwayatnya tercatat.

### Fase 2 — CV, timeline, pengingat (minggu 2)
- [x] Upload CV lewat `lib/storage.ts` (Neon Object Storage) + daftar versi + preview via presigned URL
- [x] Tautkan CV ke lamaran
- [x] Halaman detail lamaran: timeline tahap + catatan per tahap
- [x] CRUD event + halaman kalender
- [x] Cron pengingat + template email (Resend)
- **Selesai jika:** email pengingat H-1 terkirim untuk event uji coba, dan tidak terkirim dua kali kalau cron dijalankan ulang.

### Fase 3 — AI ekstraksi + cek kelayakan (minggu 3)
- [x] `lib/ai/provider.ts` (NVIDIA + model cadangan NVIDIA + retry) dan `lib/ai/usage.ts` (rate limit)
- [x] Uji model NVIDIA dengan 3 fixture lowongan, lalu putuskan `generateObject` biasa atau `mode: "json"`
- [x] `/api/ai/extract` + `ExtractionCache` + UI "Tempel lowongan" yang mengisi form sebagai draf
- [x] Tampilkan kutipan bukti di samping setiap field hasil ekstraksi
- [x] `checkRequirement` + unit test lengkap
- [x] Badge kelayakan di kartu kanban dan detail lamaran
- [x] Fallback: tanpa API key, tombol AI disembunyikan dan form manual tetap jalan
- **Selesai jika:** menempel 3 contoh lowongan nyata (BUMN, bank, startup) menghasilkan field yang benar dengan kutipan valid, dan semua test lulus.

### Fase 4 — Gap skill + analitik (minggu 4)
- [x] `lib/ai/redact.ts` + unit test (tidak ada email, nomor HP, URL, atau nama yang lolos)
- [x] Analisis gap skill per lamaran (pencocokan string dulu, LLM hanya untuk sisanya)
- [x] Dashboard: funnel, per sumber, per versi CV, waktu respons
- [x] Empty state yang jelas untuk pengguna yang belum punya data
- **Selesai jika:** dashboard dengan data seed menampilkan angka yang cocok dengan hitungan manual.

### Fase 5 — Kualitas + rilis (minggu 5)
- [x] Test E2E Playwright: login demo → buat lamaran → geser tahap → cek dashboard
- [x] GitHub Actions: lint, typecheck, unit test, E2E
- [x] Deploy ke Vercel + tombol "Masuk sebagai demo" (akun read-only atau di-reset harian)
- [x] README: screenshot, diagram arsitektur, ERD (Mermaid), cara setup lokal, keputusan desain
- [x] Audit keamanan: semua query terfilter `userId`, tidak ada secret di client bundle, bucket CV privat, tidak ada teks CV mentah yang dikirim ke LLM atau ditulis ke log
- **Selesai jika:** URL produksi bisa dipakai, CI hijau, README lengkap.

---

## 9. Perintah

```
pnpm dev            # jalankan lokal
pnpm lint
pnpm typecheck      # tsc --noEmit
pnpm test           # vitest
pnpm test:e2e       # playwright
pnpm db:migrate     # prisma migrate dev
pnpm db:seed        # prisma db seed
pnpm check:llm-provider   # gagal jika ada jejak SDK/API Anthropic di repo
```

Buat file `scripts/check-llm-provider.sh`:

```bash
#!/usr/bin/env bash
# Gagal jika repo memakai SDK/API Anthropic. Pemilik repo melarangnya (CLAUDE.md aturan 10).
set -euo pipefail
if git grep -nIiE 'anthropic|api\.anthropic\.com' -- . \
     ':!CLAUDE.md' ':!.claude/' ':!scripts/check-llm-provider.sh'; then
  echo "DITOLAK: ditemukan jejak Anthropic di atas. Hapus sebelum commit." >&2
  exit 1
fi
echo "OK: tidak ada SDK/API Anthropic."
```

Lalu di `package.json`: `"check:llm-provider": "bash scripts/check-llm-provider.sh"`. Pola pencarian sengaja ditaruh di file terpisah supaya `package.json` dan file CI tidak ikut cocok dengan polanya sendiri. `pnpm-lock.yaml` tetap ikut diperiksa, jadi dependency tidak langsung pun akan ketahuan.

Jalankan `pnpm check:llm-provider` sebagai langkah di GitHub Actions, supaya CI gagal kalau ada yang menambahkan API Anthropic.

Tambahkan script-script ini ke `package.json` di Fase 1.

---

## 10. Di luar cakupan (jangan dikerjakan kecuali diminta)
- Pengingat WhatsApp (Fonnte), simpan sebagai ide v2
- Ekstraksi lowongan dari **gambar poster** (misalnya lowongan di Instagram). Model DeepSeek V4.1 Flash mendukung input gambar, jadi ini kandidat kuat untuk v2. Poster lowongan bersifat publik, jadi aman dikirim ke endpoint gratis.
- Membaca email lamaran otomatis (Gmail API)
- Aplikasi mobile native
- Multi-bahasa
- Fitur berbayar atau payment gateway
