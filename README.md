# Lamarin

Tracker lamaran kerja dengan bantuan AI, untuk pencari kerja di Indonesia. Spesifikasi lengkap ada di `CLAUDE.md`.

## Setup lokal

```bash
pnpm install                 # juga menjalankan `prisma generate`
npm i -g neon@latest && neon login
neon deploy                  # provisi Postgres + bucket `resumes`, tulis env ke .env.local
pnpm db:migrate
pnpm db:seed                 # akun demo (demo@lamarin.local) + 15 lamaran dummy; hanya me-reset akun demo
pnpm dev
```

Isi variabel non-Neon (AUTH, NVIDIA, Resend, dll.) di `.env.local` sesuai `.env.example`.

Uji layanan:

- `GET /api/health`: `SELECT 1` + jumlah `User`.
- `pnpm storage:smoke`: upload PDF ke bucket, unduh lewat presigned URL, bandingkan isinya, lalu hapus.

## Keputusan desain

### Koneksi database (Neon + Prisma 7)

- **Runtime:** Prisma Client dengan driver adapter `@prisma/adapter-pg` (node-postgres) ke `DATABASE_URL`, yaitu connection string **pooled** (`-pooler`, PgBouncer). Skill agent Neon merekomendasikan node-postgres untuk Vercel (Fluid compute, pool dipakai ulang antar request). Driver HTTP `@neondatabase/serverless` hanya disarankan untuk runtime edge, dan kita tidak memakai edge.
- **Migrasi:** `prisma.config.ts` memakai `DATABASE_URL_UNPOOLED` (koneksi langsung). Prisma Migrate lewat PgBouncer mode transaksi bisa gagal (`prepared statement "s0" already exists`). Prisma 7 tidak lagi memakai `directUrl` di `schema.prisma`; URL CLI ada di `prisma.config.ts`, URL runtime ada di `src/lib/db.ts`.
- Database gratis Neon tidur setelah 5 menit tidak dipakai, jadi request pertama setelahnya bisa lambat.

### File CV (Neon Object Storage)

- `src/lib/storage.ts`: `S3Client` dengan `forcePathStyle: true`. Endpoint, region, dan kredensial dibaca otomatis oleh AWS SDK dari variabel standar `AWS_*` yang ditulis `neon deploy`.
- Bucket `resumes` dideklarasikan **privat** di `neon.ts`. File hanya dibuka lewat presigned URL berumur 60 detik.

### Auth

- Auth.js v5, Google provider, Prisma adapter, session **database** (bukan JWT), jadi session bisa dicabut dengan menghapus baris `Session`.
- Tidak ada middleware: guard login ada di `src/app/(app)/layout.tsx`, dan setiap server action/halaman memanggil `requireUser()` lalu memfilter query dengan `userId`.
- Login pertama otomatis membuat tahap dari template BUMN/Bank. Template bisa diganti di Pengaturan selama belum ada lamaran.
- `pnpm start` di lokal butuh `AUTH_TRUST_HOST=true` (`pnpm dev` dan Vercel tidak butuh).

### Seed

`prisma/seed.mts` dijalankan langsung oleh Node (tanpa `tsx`). Prisma Client digenerate dengan `importFileExtension = "ts"` supaya Node bisa mengimpornya.

### CV, jadwal, pengingat

- Upload CV lewat `POST /api/resumes/upload`: validasi MIME + magic bytes `%PDF` + maks. 4 MB, teks diekstrak dengan pdf-parse (`serverExternalPackages` di `next.config.ts`), lalu disimpan di `cv/{userId}/{resumeId}.pdf`. Membuka CV memakai server action yang membuat presigned URL 60 detik.
- Kalender: grid bulanan buatan sendiri (tanpa library kalender), menampilkan event + deadline lamaran.
- Pengingat: Vercel Cron `0 0 * * *` (07.00 WIB) → `/api/cron/reminders` dengan `Authorization: Bearer $CRON_SECRET`. Reminder H-3 juga dikirim pada H-2 kalau H-3 terlewat. Kolom `remindedH3At`/`remindedH1At` di-*claim* (update bersyarat) **sebelum** email dikirim, jadi run ganda/bersamaan tidak mengirim dua kali; kalau Resend gagal, claim dilepas supaya bisa dicoba lagi. Event yang dijadwal ulang mendapat pengingat baru.
- Tanpa domain sendiri, `EMAIL_FROM=onboarding@resend.dev` hanya bisa mengirim ke email pemilik akun Resend.

Uji cron manual: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders`

### AI: ekstraksi lowongan dan cek kelayakan (Fase 3)

**Provider dan model** (diputuskan 2026-10-18, lihat `CLAUDE.md` aturan 10 dan 7.8):

```
LLM_MODEL=openrouter:nvidia/nemotron-3-super-120b-a12b:free     # utama
LLM_FALLBACK_MODEL=nvidia:nvidia/nemotron-3-super-120b-a12b     # cadangan
```

Urutan di `src/lib/ai/provider.ts`: model utama dengan reasoning **mati** → kalau output gagal validasi Zod, ulang sekali dengan reasoning **menyala** + pesan error → kalau gagal/429/5xx/timeout (60 detik), model cadangan dengan urutan yang sama → `AiUnavailableError` ("AI sedang tidak tersedia, silakan isi manual"). Model dengan nama vendor yang dilarang ditolak saat start.

Uji 3 fixture (`src/lib/ai/job-fixtures.ts`, skor 8 poin: perusahaan, posisi, deadline, jenis syarat, IPK, usia, tanggal acuan usia, skill):

| Kandidat | BUMN | Bank | Startup |
|---|---|---|---|
| DeepSeek V4.1 Flash, GLM 5.3 Flash (NVIDIA) | timeout >90 dtk | – | – |
| Nemotron Super, NVIDIA, reasoning on | 8/8 · 43–56 dtk | timeout | 8/8 · 28–53 dtk |
| Nemotron Super, NVIDIA, reasoning off | 8/8 · 15 dtk | 8/8 · 20 dtk | JSON tidak valid |
| **Nemotron Super, OpenRouter, reasoning off** | **8/8 · 10 dtk** | **8/8 · 13 dtk** | **8/8 · 6 dtk** |
| Nemotron Super, OpenRouter, reasoning on | 8/8 · 37 dtk | 8/8 · 51 dtk | 8/8 · 48 dtk |
| Nemotron Nano (NVIDIA), Gemma 4 / Nemotron 3.5 VL (OpenRouter) | sering timeout / 429 / 502 | | |

Reasoning tidak menaikkan skor di tugas ekstraksi ini, tapi 4–5× lebih lambat dan sering timeout, jadi hanya dipakai saat percobaan ulang. Router acak `openrouter/free` tidak dipakai: modelnya berganti tiap request dan tidak bisa dikendalikan.

**Mode output dan progres langsung:** jawaban AI di-stream sebagai teks biasa berisi JSON (skema JSON ditulis di prompt), lalu `parsePartialJson` mengubahnya jadi temuan sementara yang tampil di form ("Perusahaan: …", "Skill: …", "Syarat IPK: …"). `response_format` sengaja tidak dikirim: diukur di Fase 3, dengan `json_object` maupun `json_schema` OpenRouter menahan seluruh jawaban jadi satu potongan, sedangkan tanpa itu token dikirim satu per satu (temuan pertama ±2 detik). Hasil akhir dibersihkan dari fence/teks tambahan (`src/lib/ai/json-text.ts`), lalu divalidasi Zod; gagal → retry dengan reasoning. Route `/api/ai/extract` membalas NDJSON: `status` (membaca / membaca ulang / pindah ke cadangan / memeriksa kutipan), `partial`, lalu `result` atau `error`.

**Alur `/api/ai/extract`:** normalisasi teks → cache (`sha256(prompt + teks)`, jadi mengubah prompt otomatis membatalkan cache lama) → kuota harian (`AiUsage`) → LLM → buang item yang kutipannya tidak ada di teks → simpan cache. URL lowongan diambil di server dengan pengaman SSRF (alamat privat/loopback ditolak, redirect divalidasi ulang).

**Syarat per jenjang** ("IPK 3,00 untuk S1 dan 3,25 untuk S2") diekstrak sebagai satu item `3.00 (S1), 3.25 (S2)`, lalu `checkRequirement` memakai angka untuk jenjang di profil.

**Cek kelayakan** (`src/lib/eligibility/check.ts`) murni deterministik, tanpa AI, dan dihitung saat halaman dibuka (bukan disimpan), supaya selalu mengikuti profil terbaru. Status keseluruhan = status terburuk (Tidak memenuhi > Perlu dicek > Belum bisa dicek > Memenuhi).

Uji live ulang: `pnpm ai:fixtures` (memakai konfigurasi `.env.local`, hanya mengirim teks fixture publik).

### Gap skill dan redaksi CV (Fase 4)

`POST /api/ai/skill-gap { applicationId }`:

1. Skill lowongan diambil dari `ExtractionCache` (teks lowongan tersimpan di `Application.jobPostingText`).
2. **Tanpa AI:** skill dicocokkan dengan teks CV memakai alias (`src/lib/ai/skill-aliases.ts`, termasuk tools non-IT: Excel, SAP, Accurate, AutoCAD, Canva, bahasa Inggris/TOEFL, Brevet, K3, dll.). Yang ketemu langsung ✅.
3. Sisanya + CV yang sudah melewati `redact()` (`src/lib/ai/redact.ts`: hanya bagian keahlian/pengalaman/proyek/organisasi; email, nomor HP, URL, NIK/angka panjang, baris alamat, dan setiap kata nama pemilik dihapus; maks. 6.000 karakter) dikirim ke LLM. Klaim "ada di CV" tanpa kutipan yang benar-benar ada di teks redaksi diturunkan jadi ❌.
4. Tanpa AI (key kosong, kuota habis, server down), hasil pencocokan teks tetap disimpan.

### Dashboard (Fase 4)

Semua angka dihitung di server oleh fungsi murni `computeDashboard` (`src/lib/dashboard.ts`), lalu dirender sebagai HTML/CSS biasa (bar satu warna + label langsung + tabel), tanpa library chart dan tanpa JS di client. Recharts belum dipakai; tambahkan kalau perlu grafik tren waktu.

- **Funnel:** lamaran yang pernah mencapai tiap tahap seleksi (tahap terjauh yang IN_PROGRESS/OFFER di `StageHistory`; Ditolak tidak dihitung sebagai kemajuan) + persentase lanjut dari tahap sebelumnya.
- **Lolos administrasi** (per sumber, per versi CV): sudah melewati tahap seleksi pertama, dihitung dari lamaran yang sudah sampai tahap itu.
- **Waktu respons:** median hari dari `appliedAt` ke perpindahan tahap pertama.

`src/lib/dashboard.test.ts` memakai data demo yang sama dengan `pnpm db:seed` (`src/lib/demo-data.ts`) dan mencocokkan setiap angka dengan hitungan manual (funnel 13 → 10 → 8 → 6 → 5 → 4 → 2 → 1, median 5 hari, dst.).

### Region

Database dan bucket di AWS `ap-southeast-1` (Singapore). Fungsi Vercel diset ke `sin1` di `vercel.json`.
