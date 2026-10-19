# Update dari Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** User menempel email rekrutmen. AI membacanya, lalu Lajur mengusulkan perubahan (pindah tahap, jadwal dengan rentang waktu, catatan berisi kredensial, tandai Gagal) yang diperiksa user sebelum diterapkan.

**Architecture:**
- **Bagian murni yang bisa diuji tanpa AI**, di `src/lib/email-update/`: membaca dan memverifikasi jawaban AI, mencocokkan lamaran, dan menyusun usulan perubahan.
- **Route `POST /api/ai/email-update`:** menyamarkan email, memanggil `generateStructured`, lalu mengembalikan usulan dalam JSON (tanpa streaming).
- **Server action `applyEmailUpdate`:** menerapkan usulan yang dicentang dalam satu transaksi, memakai `changeStage` yang dipindah ke `src/lib/stage-change.ts`.
- **Kolom baru:** `Event.opensAt` untuk rentang waktu jadwal, dan `User.emailAiNoticeAt` untuk pemberitahuan persetujuan.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Prisma 7 (Neon), Zod 4, Vercel AI SDK via `lib/ai/provider.ts`, Vitest, Playwright, Tailwind + shadcn.

**Spec:** `docs/superpowers/specs/2026-10-19-update-dari-email-design.md`

## Global Constraints

- Semua teks UI berbahasa Indonesia, sedangkan identifier dan kode berbahasa Inggris (CLAUDE.md aturan 3).
- Setiap query DB difilter `userId` dari session (`requireUser()`/`auth()`), termasuk id dari client (applicationId, stageId).
- Semua panggilan LLM lewat `generateStructured` (`lib/ai/provider.ts`) dengan `feature: "EMAIL_UPDATE"`. Isi email wajib melewati `redactPII` sebelum dikirim. Isi email, kredensial, dan prompt tidak boleh ditulis ke log.
- Isi email dipotong `MAX_EMAIL_TEXT = 12_000` karakter.
- Mode demo read-only menolak "Baca dengan AI" dan "Terapkan" dengan `DEMO_READ_ONLY_MESSAGE`.
- Modul yang diimpor script di `scripts/` memakai import relatif `.ts`, bukan alias `@/` (lihat `src/lib/text.ts`).
- Jadwal rentang memakai `startsAt` sebagai waktu **tutup** dan `opensAt` sebagai waktu **buka**. Pengingat H-3/H-1 tetap berpatokan ke `startsAt`.
- Batas tanpa jam berarti pukul **23.59 WIB** di tanggal itu.
- Catatan baru **ditambahkan** di bawah catatan lama, diawali tanggal hari ini (`formatDate`), dan tidak pernah menimpanya.
- Tidak ada perubahan yang tersimpan sebelum user menekan "Terapkan". Penerapan berlangsung dalam satu `db.$transaction`.
- Di akhir setiap task jalankan `pnpm lint && pnpm typecheck && pnpm test`. Di akhir rencana jalankan juga `pnpm check:llm-provider` dan `pnpm test:e2e`.

## Review Focus

1. **Email dengan header Gmail** ("Fri, Sep 18, 3:22 PM") atau kutipan email lama. Tanggal kirim email bukan jadwal. Verifikasi kutipan tidak bisa menyaringnya, karena header memang ada di teks, jadi perlindungannya ada di dua tempat:
   - `EMAIL_SYSTEM` melarang memakai tanggal kirim atau header sebagai jadwal (Task 6);
   - `planEmailUpdate` tidak membuat jadwal untuk `REJECTION`/`APPLICATION_RECEIVED` (Task 7, test "no events from a rejection").
   Fixture ISS dan BNI di Task 5 **menyertakan** header Gmail-nya, dan Task 13 memeriksa bahwa ISS hanya menghasilkan satu `DEADLINE` pada 24 Sep.
2. **Email yang sama ditempel dua kali** tidak boleh menggandakan jadwal. Jadwal yang jenis, `startsAt`, dan `opensAt`-nya sama dengan jadwal yang sudah ada tidak diusulkan (Task 7, test "skips an event the application already has").
3. **Nama perusahaan berbeda bentuk**: "PT Bank Negara Indonesia (Persero) Tbk" vs "Bank Negara Indonesia", "ISS Indonesia" vs "PT ISS Indonesia". Keduanya harus cocok (Task 7, test `matchApplications`).
4. **Kredensial dengan spasi atau tab berlebih** ("Password     :     YAt3ycdU") harus tersamarkan untuk AI dan kembali utuh ke catatan (Task 5).
5. **Jawaban AI dengan tanggal yang tidak valid** ("1 Okt", tanggal tanpa tahun, jam 24.00) tidak boleh menyebabkan crash atau jadwal yang salah. Event tersebut dibuang (Task 6, test "drops events with an unparseable time").

---

### Task 1: Migrasi database

**Files:**
- Modify: `prisma/schema.prisma` (model `User`, model `Event`, enum `AiFeature`)
- Create: `prisma/migrations/<timestamp>_email_update/migration.sql` (dibuat oleh Prisma)

**Interfaces:**
- Produces: `Event.opensAt: Date | null`, `User.emailAiNoticeAt: Date | null`, `AiFeature.EMAIL_UPDATE`.

- [ ] **Step 1:** Tambahkan `opensAt DateTime?` di `Event` (setelah `startsAt`), `emailAiNoticeAt DateTime?` di `User` (dekat `aiConsentAt`), dan `EMAIL_UPDATE` di `enum AiFeature`.
- [ ] **Step 2:** Jalankan `pnpm exec prisma migrate dev --name email_update`. Hasil yang diharapkan: migrasi baru berisi 2× `ALTER TABLE ... ADD COLUMN` dan 1× `ALTER TYPE "AiFeature" ADD VALUE 'EMAIL_UPDATE'`, tanpa `DROP`. **Jangan** pernah menjalankan `migrate reset`.
- [ ] **Step 3:** `pnpm typecheck` lolos (client Prisma sudah di-generate ulang).
- [ ] **Step 4:** Commit `feat(db): event open time, email AI notice, EMAIL_UPDATE feature`.

### Task 2: Format dan tautan kalender untuk jadwal rentang

**Files:**
- Modify: `src/lib/dates.ts`, `src/lib/google-calendar.ts`
- Test: `src/lib/dates.test.ts`, `src/lib/google-calendar.test.ts`

**Interfaces:**
- Produces:
  - `formatEventWhen(e: { startsAt: Date; opensAt: Date | null }): string` (format panjang, memakai `formatDateTime`)
  - `formatEventWhenShort(e: { startsAt: Date; opensAt: Date | null }): string` (memakai `formatShortDateTime`)
  - `googleCalendarUrl({ ..., start, end? })`: kalau `end` ada, rentangnya `start`–`end`.

- [ ] **Step 1: Tes yang gagal**
  ```ts
  it("formats a window as open – close", () => {
    const e = { opensAt: new Date("2026-09-29T07:00:00Z"), startsAt: new Date("2026-10-01T02:00:00Z") };
    expect(formatEventWhenShort(e)).toBe("Sel, 29 Sep, 14.00 – Kam, 1 Okt, 09.00");
    expect(formatEventWhenShort({ ...e, opensAt: null })).toBe("Kam, 1 Okt, 09.00");
  });
  it("uses the window for Google Calendar", () => {
    const url = googleCalendarUrl({ title: "T", start: new Date("2026-09-29T07:00:00Z"), end: new Date("2026-10-01T02:00:00Z") });
    expect(new URL(url).searchParams.get("dates")).toBe("20260929T070000Z/20261001T020000Z");
  });
  ```
- [ ] **Step 2:** `pnpm exec vitest run src/lib/dates.test.ts src/lib/google-calendar.test.ts` → FAIL.
- [ ] **Step 3:** Implementasikan. Pemisahnya ` – ` (spasi, en dash, spasi). `end` mengabaikan `allDay`.
- [ ] **Step 4:** Tes lulus. Commit `feat: format and calendar link for events with an open time`.

### Task 3: Isian "Mulai bisa dikerjakan" di jadwal

**Files:**
- Modify: `src/lib/validation.ts` (`eventSchema`), `src/actions/events.ts` (create/update), `src/components/application/event-form.tsx`, `src/app/(app)/applications/[id]/page.tsx` (defaults EventForm + `AddToCalendar` `end`), `src/lib/application-snapshot.ts`, `src/actions/applications.ts` (`restoreApplication` events), `src/lib/demo-data.ts:66` (ekspor CSV)
- Test: `src/lib/validation.test.ts`

**Interfaces:**
- Consumes: Task 1 (`opensAt`), Task 2 (`googleCalendarUrl` `end`).
- Produces: `eventSchema` dengan field opsional `opensAt` (`"YYYY-MM-DDTHH:mm"` → `Date`, kosong → `null`).

- [ ] **Step 1: Tes yang gagal**
  ```ts
  it("accepts an optional open time before the close time, rejects one after", () => {
    const base = { type: "ONLINE_TEST", startsAt: "2026-10-01T09:00" };
    expect(eventSchema.parse({ ...base, opensAt: "" }).opensAt).toBeNull();
    expect(eventSchema.parse({ ...base, opensAt: "2026-09-29T14:00" }).opensAt).toEqual(new Date("2026-09-29T07:00:00Z"));
    const bad = eventSchema.safeParse({ ...base, opensAt: "2026-10-02T09:00" });
    expect(bad.success).toBe(false);
    expect(z.flattenError(bad.error!).fieldErrors.opensAt?.[0]).toBe("Waktu mulai harus sebelum batas akhir");
  });
  ```
- [ ] **Step 2:** Jalankan dan pastikan FAIL.
- [ ] **Step 3:** Tambahkan `opensAt` di `eventSchema` (pakai `fromDateTimeInput`, dengan refine dan path `["opensAt"]`), lalu simpan di `createEvent`/`updateEvent`. `updateEvent` tetap me-reset flag pengingat seperti sekarang. Di form, label `"Mulai bisa dikerjakan (opsional)"` dengan `type="datetime-local"`, dan defaults edit `toDateTimeInput(e.opensAt)`. Ubah juga label `startsAt` menjadi `"Tanggal & jam (WIB) / batas akhir"`. Snapshot dan restore membawa `opensAt` (`z.date().nullable().default(null)`), dan baris CSV memakai `formatEventWhen`.
- [ ] **Step 4:** Tes lulus, lalu `pnpm typecheck`. Commit `feat(events): optional open time for test windows`.

### Task 4: Tampilkan rentang di semua daftar jadwal

**Files:**
- Modify: `src/app/(app)/applications/[id]/page.tsx` (daftar jadwal + `NextStep`), `src/app/(app)/calendar/page.tsx`, `src/app/(app)/dashboard/page.tsx` ("7 hari ke depan"), `src/app/(app)/(lamaran)/board/page.tsx` (select `opensAt` di `events`), `src/components/board/board.tsx` (`nextEvent.opensAt`, label `formatEventWhenShort`)

**Interfaces:**
- Consumes: Task 2 (`formatEventWhen`, `formatEventWhenShort`).

- [ ] **Step 1:** Setiap tempat yang sekarang menulis `formatDateTime(e.startsAt)` atau `formatShortDateTime(...)` untuk sebuah Event diganti ke `formatEventWhen(e)` atau `formatEventWhenShort(e)`, dan query-nya ikut memilih `opensAt`. Di kalender, jadwal tetap ditaruh di **tanggal `startsAt`** (tidak digambar di setiap hari dalam rentang).
- [ ] **Step 2:** `pnpm typecheck && pnpm lint` lolos. Lalu build terpisah (`NEXT_DIST_DIR=.next-check pnpm build`), buat satu jadwal dengan `opensAt` di akun demo lokal, dan pastikan rentangnya tampil di detail, kalender, board, dan dashboard. Hapus jadwal uji itu sesudahnya.
- [ ] **Step 3:** Commit `feat(events): show open–close windows wherever events are listed`.

### Task 5: Penyamaran kredensial

**Files:**
- Modify: `src/lib/ai/redact.ts`
- Create: `src/lib/email-update/fixtures.ts` (4 email contoh dari spec, dengan nama, kode, dan kredensial **karangan**; tanpa import `@/`)
- Test: `src/lib/ai/redact.test.ts`

**Interfaces:**
- Produces:
  - `redactPII` juga mengganti nilai kredensial dengan `[CRED_n]`.
  - `PLACEHOLDER` mengenali `CRED`.
  - `EMAIL_FIXTURES: { name: string; text: string; userName: string; expect: {...} }[]` (field `expect` diisi di Task 7).

- [ ] **Step 1: Tes yang gagal**
  ```ts
  it("hides login credentials and puts them back exactly", () => {
    const text = "Username     :     APSC0099999\nPassword\t:\tXk9#pq!L\nKata sandi: rahasia123\nLink : https://contoh.tech/login";
    const { text: out, map } = redactPII(text);
    expect(out).not.toMatch(/APSC0099999|Xk9#pq!L|rahasia123|contoh\.tech/);
    expect(out).toMatch(/Username\s+:\s+\[CRED_1\]/);
    expect(rehydrate(out, map)).toBe(text);
  });
  it("leaves no name, contact, code or credential from the email fixtures", () => {
    for (const f of EMAIL_FIXTURES) {
      const { text } = redactPII(f.text, { name: f.userName });
      for (const secret of f.secrets) expect(text).not.toContain(secret);
    }
  });
  ```
  (`secrets: string[]` adalah field tambahan di setiap fixture: nama lengkap, kode peserta, username, password.)
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Regex label (tidak peka huruf besar-kecil): `Username|User ID|User name|Login ID|Password|Kata sandi|PIN|Token|Kode akses`, diikuti spasi/tab, `:` atau `=`, spasi/tab, lalu **satu token tanpa spasi** sebagai nilai. Kredensial disamarkan **sebelum** URL dan ID, supaya password yang mirip angka panjang tetap jadi CRED.
- [ ] **Step 4:** Lulus, termasuk semua tes redact lama. Commit `feat(ai): redact login credentials before an email reaches the AI`.

### Task 6: Skema, prompt, dan verifikasi jawaban AI

**Files:**
- Create: `src/lib/email-update/reading.ts` (tanpa import `@/`)
- Test: `src/lib/email-update/reading.test.ts`

**Interfaces:**
- Produces:
  - `MAX_EMAIL_TEXT = 12_000`; `normalizeEmailText(text: string): string` (rapikan spasi dan potong).
  - `EmailReading` (Zod) dan `type EmailReading`:
    ```ts
    {
      company: string | null; companyQuote: string | null; position: string | null;
      kind: "TEST_INVITE" | "DOCUMENT_REQUEST" | "INTERVIEW" | "MCU" | "OFFER" | "REJECTION" | "APPLICATION_RECEIVED" | "OTHER";
      kindQuote: string;
      stageName: string | null;           // as written, e.g. "Online Assessment"
      events: { type: EventType; opensAt: string | null; closesAt: string; quote: string }[]; // "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm", WIB
      notes: string[];                    // short points; may contain placeholders
      sourceUrl: string | null;
    }
    ```
  - `EMAIL_SYSTEM: string`: instruksi berbahasa Indonesia. Hanya isi yang tertulis di email; kutipan harus berupa substring persis; tanggal dalam WIB; kalau hanya tanggal, isi tanggalnya saja; rentang ditulis sebagai `opensAt`/`closesAt`; placeholder `[...]` disalin apa adanya; catatan berisi instruksi penting (durasi, syarat perangkat, berkas dan format nama file, link, info login); tanpa saran dan tanpa basa-basi.
  - `verifyReading(r: EmailReading, text: string): EmailReading`: membuang event yang kutipannya tidak ada di `text` (pakai `fold`/`squash` dari `src/lib/text.ts`) atau tanggalnya tidak bisa di-parse; `company`/`companyQuote` → `null` kalau kutipannya tidak ada; `kind` → `"OTHER"` kalau `kindQuote` tidak ada.
  - `parseWib(s: string): Date | null`: `"YYYY-MM-DD"` → 23.59 WIB, `"YYYY-MM-DDTHH:mm"` → jam itu WIB, selain itu `null`.

- `reading.ts` dan `plan.ts` diimpor juga oleh script Node dan oleh komponen client. Jadi tanpa `server-only`, tanpa import `@/`, nilai enum ditulis literal di Zod (`z.enum(["DEADLINE", "ONLINE_TEST", …])`), dan tipe Prisma hanya lewat `import type`.

- [ ] **Step 1: Tes yang gagal**: `parseWib("2026-09-24")` → `2026-09-24T16:59:00.000Z`; `parseWib("2026-10-01T09:00")` → `2026-10-01T02:00:00.000Z`; `parseWib("1 Okt")` dan `parseWib("2026-10-01T24:00")` → `null`. Lalu `verifyReading` membuang event dengan kutipan karangan, membuang event `closesAt: "1 Okt"` (**drops events with an unparseable time**), dan menyimpan event yang kutipannya beda spasi atau baris saja.
- [ ] **Step 2:** FAIL. **Step 3:** Implementasikan. **Step 4:** Lulus. Commit `feat(email-update): reading schema, prompt and quote check`.

### Task 7: Pencocokan lamaran dan penyusunan usulan

**Files:**
- Create: `src/lib/email-update/plan.ts`
- Test: `src/lib/email-update/plan.test.ts`

**Interfaces:**
- Consumes: Task 6 (`EmailReading`, `parseWib`).
- Produces:
  - `normalizeCompany(name: string): string`: lowercase; buang `pt`, `tbk`, `persero`, `(…)`, tanda baca; rapikan spasi.
  - `matchApplications(company: string | null, apps: { id: string; company: string }[]): string[]`: id terurut dari yang paling cocok. Nilainya: sama persis setelah normalisasi > salah satu memuat yang lain > tidak cocok (tidak dimasukkan).
  - `type Change` (dipakai Task 8, 9, 10):
    ```ts
    | { id: string; kind: "move"; stageId: string; quote: string }
    | { id: string; kind: "event"; type: EventType; startsAt: string; opensAt: string | null; locationOrUrl: string | null; quote: string } // ISO strings
    | { id: string; kind: "fail"; stageId: string; quote: string }   // mark this stage's step FAILED (adding the step if missing)
    | { id: string; kind: "notes"; text: string }
    ```
  - `planEmailUpdate(reading, ctx: { stages: { id: string; name: string; order: number; kind: StageKind }[]; app: { currentStageId: string; history: { stageId: string; result: StageResult | null }[]; events: { type: EventType; startsAt: Date; opensAt: Date | null }[] } | null }): Change[]`
- Aturan (dari spec):
  - **`stageName` → tahap user:** kecocokan nama, misalnya "Online Assessment"/"Online Test"/"TPA" → tahap yang namanya mengandung "Tes Online", "Online", atau "TPA"; psikotes → "Psikotes"; dan seterusnya. Simpan tabel sinonim kecil di file ini.
  - **Kalau tidak cocok,** pakai pemetaan dari `kind`: `TEST_INVITE` → tahap yang cocok dengan `events[0].type`; `INTERVIEW` → "Interview"; `MCU` → "MCU"; `OFFER` → `kind: OFFER`; `REJECTION` → `kind: REJECTED`; `DOCUMENT_REQUEST`, `APPLICATION_RECEIVED`, dan `OTHER` → tidak ada `move`.
  - Tidak ada `move` ke tahap yang sedang aktif.
  - **`REJECTION`:**
    - `move` ke tahap `REJECTED`, tanpa event;
    - `fail` untuk tahap dari `stageName` kalau cocok;
    - kalau tidak cocok, `fail` untuk langkah terakhir yang bukan `REJECTED`, kecuali langkah itu sudah punya `result`.
  - **Event:** `startsAt = parseWib(closesAt)` dan `opensAt = parseWib(opensAt)`. `locationOrUrl = reading.sourceUrl`. Jadwal yang jenis dan waktunya sama dengan jadwal yang sudah ada tidak diusulkan.
  - **`notes`:** kalau `reading.notes` tidak kosong, satu `Change` dengan `text = notes.map(n => "- " + n).join("\n")`.
  - **`id`:** stabil per indeks, misalnya `"move"`, `"event-0"`, `"fail"`, `"notes"`.

- [ ] **Step 1: Tes yang gagal**, menggunakan stages template BUMN (seperti `stage-history.test.ts`):
  - `matchApplications("PT ISS Indonesia", [{id:"a",company:"ISS Indonesia"}, {id:"b",company:"PT Indosat"}])` → `["a"]`
  - `matchApplications("PT Bank Negara Indonesia (Persero) Tbk", [{id:"x",company:"Bank Negara Indonesia"}])` → `["x"]`; `matchApplications(null, ...)` → `[]`
  - **Peepl** (`TEST_INVITE`, rentang): `move` ke Tes Online/TPA, plus satu `event` `ONLINE_TEST` dengan `opensAt` `2026-09-29T07:00:00.000Z` dan `startsAt` `2026-10-01T02:00:00.000Z`, plus `notes`.
  - **ISS** (`DOCUMENT_REQUEST`, `closesAt: "2026-09-24"`): tanpa `move`, plus `event` `DEADLINE` dengan `startsAt` `2026-09-24T16:59:00.000Z`.
  - **BNI** (`REJECTION`, `stageName: "Online Assessment"`, kartu di Administrasi): `move` ke Ditolak, `fail` untuk Tes Online/TPA, dan **tanpa event** (*no events from a rejection*).
  - **Penolakan tanpa `stageName`**, history `[W, ADM]`: `fail` untuk ADM.
  - ***skips an event the application already has*:** app sudah punya jadwal yang sama → tidak ada `event`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementasikan. **Step 4:** Lulus. Isi juga `expect` di `EMAIL_FIXTURES` (Task 5) dengan bentuk ringkas hasil ini, untuk script live. Commit `feat(email-update): match the application and plan the changes`.

### Task 8: `changeStage` jadi modul server bersama

**Files:**
- Create: `src/lib/stage-change.ts` (`import "server-only"`)
- Modify: `src/actions/applications.ts` (hapus fungsi lokal, import dari modul baru)

**Interfaces:**
- Produces: `changeStage(tx: Prisma.TransactionClient, id: string, userId: string, stageId: string): Promise<void>` (perilaku sama persis, dipindahkan apa adanya).

- [ ] **Step 1:** Pindahkan fungsinya. Jangan diekspor dari file `"use server"`, karena di sana setiap ekspor otomatis jadi server action.
- [ ] **Step 2:** `pnpm typecheck && pnpm test` lolos. Lalu `pnpm test:e2e` (drag di board), harus 3 passed.
- [ ] **Step 3:** Commit `refactor: share changeStage outside the actions file`.

### Task 9: Route `POST /api/ai/email-update`

**Files:**
- Create: `src/app/api/ai/email-update/route.ts`, `src/lib/email-update/read.server.ts`

**Interfaces:**
- Consumes: Task 5 (`redactPII`, `rehydrate`), Task 6 (`EmailReading`, `EMAIL_SYSTEM`, `normalizeEmailText`, `verifyReading`), Task 7 (`matchApplications`, `planEmailUpdate`, `Change`).
- Produces:
  - Response 200:
    ```ts
    { reading: { company: string | null; position: string | null; sourceUrl: string | null; kind: EmailReading["kind"]; stageName: string | null },
      candidates: { id: string; company: string; position: string;     // matches first, then the rest
                    currentStageId: string; history: { stageId: string; result: StageResult | null }[];
                    events: { type: EventType; startsAt: string; opensAt: string | null }[] }[],
      stages: { id: string; name: string; order: number; kind: StageKind }[],
      matchedId: string | null,
      changes: Change[] }   // planned for matchedId (or for a new application when null); the client re-plans with
                            // planEmailUpdate when the user picks another candidate
    ```
  - Error JSON `{ error }` mengikuti pola `cv-check/route.ts`:
    - 401 belum masuk; 403 demo atau persetujuan; 409 pemberitahuan email belum dikonfirmasi (`"emailAiNoticeAt"` null); 429 kuota; 503 `AiUnavailableError`; 422 `kind === "OTHER"` tanpa event dan tanpa notes → `"Tidak ada info seleksi yang bisa dicatat dari email ini."`
- `readEmail(text, user: { id, name }): Promise<{ reading: EmailReading }>` di `read.server.ts`. Isinya: normalisasi → `redactPII(text, { name: user.name })` → `generateStructured({ schema: EmailReading, system: EMAIL_SYSTEM, prompt: redacted, feature: "EMAIL_UPDATE", userId })` → `verifyReading(object, redacted)` → `rehydrate` di `notes`, `sourceUrl`, `company`, dan `position`.
- Route memuat lamaran user (`id`, `company`, `position`, `currentStageId`, `history { stageId, result }`, `events { type, startsAt, opensAt }`) dan stages, lalu menyusun `changes` untuk lamaran teratas. Kalau tidak ada yang cocok, `changes` disusun dengan `app: null`. Body divalidasi dengan Zod: `text` minimal 30 dan maksimal 100.000 karakter.

- [ ] **Step 1:** Implementasikan.
- [ ] **Step 2:** `pnpm typecheck && pnpm lint`.
- [ ] **Step 3:** Uji live di build lokal dengan AI terpasang. Login demo lokal, setujui AI dan pemberitahuan, lalu `fetch` keempat `EMAIL_FIXTURES` lewat script Playwright sementara. Bandingkan `changes` dengan `expect` di fixture. Tulis hasilnya di laporan task.
- [ ] **Step 4:** Commit `feat(email-update): read a pasted email with AI`.

### Task 10: Server action `applyEmailUpdate`

**Files:**
- Create: `src/actions/email-update.ts`
- Test: `src/lib/email-update/plan.test.ts` (tambah tes untuk `appendNotes`)

**Interfaces:**
- Consumes: Task 7 (`Change`), Task 8 (`changeStage`).
- Produces:
  - `applyEmailUpdate(input: { applicationId: string | null; newApplication: { company: string; position: string; source: JobSource; url: string | null } | null; changes: Change[] }): Promise<{ ok: true; applicationId: string } | { ok: false; message: string }>`
  - `appendNotes(existing: string | null, text: string, today: Date): string` (murni, di `plan.ts`): `existing` kosong → `"<tanggal>\n<text>"`; selain itu `existing + "\n\n<tanggal>\n<text>"`, dengan tanggal dari `formatDate(today)`.
- Urutan dalam satu `db.$transaction`:
  1. Kalau `newApplication`, buat lamaran (`userId` dari session) di tahap Wishlist user, dengan history awal. Kalau tidak, pastikan `applicationId` milik user.
  2. Validasi semua `stageId` milik user.
  3. Untuk setiap `fail`: kalau langkah tahap itu belum ada di history, panggil `changeStage` ke tahap itu, lalu set `result: "FAILED"` di langkah terakhirnya.
  4. `move` → `changeStage`.
  5. Buat setiap `event`.
  6. `notes` → `appendNotes` ke `StageHistory.notes` di langkah tahap terakhir (sesudah move).
  7. `revalidatePath` untuk `/board`, `/applications/${id}`, `/calendar`, dan `/dashboard`.
- Diawali `requireUser()`. Kalau `isReadOnly(user)`, kembalikan `{ ok: false, message: DEMO_READ_ONLY_MESSAGE }`.
- Input divalidasi dengan Zod. `changes` yang ada di input sudah difilter oleh client sesuai centang dan sudah diubah lewat "Ubah". Server **tidak** memanggil AI lagi.

- [ ] **Step 1: Tes `appendNotes`** (gagal, lalu lulus) dengan nilai tanggal `formatDate(new Date("2026-10-19T03:00:00Z"))`.
- [ ] **Step 2:** Implementasikan action-nya. `pnpm typecheck`.
- [ ] **Step 3:** Uji live di build lokal untuk tiga kasus fixture: Peepl (lamaran ada), BNI (`fail` + `move`), dan Astra (`newApplication`). Lalu cek riwayat, jadwal, dan catatan di halaman detail. Bersihkan data uji sesudahnya.
- [ ] **Step 4:** Commit `feat(email-update): apply the reviewed changes in one transaction`.

### Task 11: Persetujuan AI diperbarui dan pemberitahuan email

**Files:**
- Modify: `src/components/ai-consent.tsx` (teks), `src/actions/settings.ts`
- Create: `src/components/email-update/email-ai-notice.tsx`

**Interfaces:**
- Produces: `acknowledgeEmailNotice(): Promise<{ ok: boolean; message?: string }>` (set `emailAiNoticeAt = now` untuk user session; demo read-only ditolak). `<EmailAiNotice onDone={() => void} />`.

- [ ] **Step 1:** Ubah kalimat pertama di `ai-consent.tsx` menjadi: "Fitur AI (isi otomatis dari lowongan, cek CV, update dari email, draf follow-up) mengirim teks ke penyedia AI pihak ketiga…". Tambahkan kalimat: "Isi email yang kamu tempel dikirim setelah nama, kontak, kode peserta, dan info login diganti tanda."
- [ ] **Step 2:** Pemberitahuan berisi: apa yang dikirim (isi email yang ditempel), apa yang disamarkan (nama, kontak, kode peserta, username dan password), dan bahwa info login disimpan di catatan lamaranmu. Tombolnya **Saya mengerti**. Persetujuan saat setuju pertama kali (`setAiConsent(true)` untuk user baru) juga mengisi `emailAiNoticeAt`, supaya pengguna baru tidak melihat pemberitahuan dua kali.
- [ ] **Step 3:** `pnpm typecheck && pnpm lint`. Commit `feat(email-update): consent copy and one-time email notice`.

### Task 12: Halaman "Update dari email" dan navigasi

**Files:**
- Create: `src/app/(app)/applications/update/page.tsx`, `src/components/email-update/email-update.tsx` (client: kotak tempel + status), `src/components/email-update/review-list.tsx` (client: daftar usulan)
- Modify: `src/components/nav-links.tsx` (sub-menu), `src/app/(app)/(lamaran)/layout.tsx` (tombol HP), `e2e/application-flow.spec.ts`

**Interfaces:**
- Consumes: Task 9 (route + bentuk response), Task 10 (`applyEmailUpdate`), Task 11 (`EmailAiNotice`, `AiConsent`).

- [ ] **Step 1: Halaman**
  - **Urutan gerbang:** tanpa persetujuan AI → `<AiConsent>`; disetujui tapi `emailAiNoticeAt` kosong → `<EmailAiNotice>`; AI tidak terpasang (`!aiEnabled()`) → "AI sedang tidak tersedia. Kamu tetap bisa memperbarui lamaran secara manual di halamannya."
  - **Teks di atas kotak (persis):** "Salin seluruh isi email, termasuk nama perusahaan, tanggal dan jam, link, dan info login kalau ada. Bagian yang tidak ikut disalin tidak bisa dibaca AI."
  - **Teks di bawah kotak (persis):** "Nama, kontak, dan kredensial disamarkan sebelum dikirim ke AI."
  - **Tombol:** **Baca dengan AI**. Saat berjalan tampil `"Membaca email… (Ns)"`.
- [ ] **Step 2: Daftar usulan** (mockup di spec):
  - **Judul:** perusahaan · posisi, plus `<Select>` "Bukan yang ini?" berisi `candidates`. Kalau pilihan diganti, `changes` disusun ulang di client dengan `planEmailUpdate(reading, { stages, app: kandidat })`, memakai data dari response Task 9 (tanggal ISO diubah ke `Date`).
  - **Setiap `Change`:** checkbox (default tercentang), kalimat, kutipan miring, dan tombol **Ubah** yang membuka isian. Isiannya: `move`/`fail` → Select tahap; `event` → Select jenis, "Mulai bisa dikerjakan", dan "Batas akhir" (`datetime-local`); `notes` → Textarea.
  - **Tombol:** "Terapkan N perubahan" (N = jumlah yang dicentang; nonaktif kalau 0) dan "Batal".
  - **Kalau `matchedId` null:** pesan "Lamaran ke **{company}** belum ada di Lajur." dan baris pertama "Tambahkan ke lamaran" dengan isian perusahaan, posisi, sumber (wajib, `<Select>` `JOB_SOURCE_LABELS`), dan link. "Terapkan" nonaktif sampai sumber dipilih.
  - **Sesudah sukses:** `router.push("/applications/" + id + "?tab=riwayat")` dan toast `"Lamaran diperbarui."`.
- [ ] **Step 3: Navigasi**
  - **Desktop:** di `NavLinks`, "Lamaran" diikuti dua anak menu, **Lihat lamaran** (`/board`, aktif juga di `/applications` kecuali `/applications/update`) dan **Update dari email** (`/applications/update`).
  - **HP:** tombol outline "Update dari email" di header `(lamaran)/layout.tsx` dengan `md:hidden`.
  - Tab bar tidak berubah.
- [ ] **Step 4: E2E**, di `e2e/application-flow.spec.ts` blok "all main pages render": tambahkan `["/applications/update", "Update dari email"]`, lalu pastikan heading-nya tampil.
- [ ] **Step 5:** `pnpm lint && pnpm typecheck && pnpm test && pnpm check:llm-provider && pnpm test:e2e`.
- [ ] **Step 6:** Uji manual di build lokal: tempel email Peepl, ubah jam lewat "Ubah", terapkan, lalu cek tab Riwayat, Jadwal (rentang), dan catatan (kredensial asli). Ulangi dengan BNI dan Astra. Cek juga lebar HP 390px tanpa scroll horizontal. Bersihkan data uji.
- [ ] **Step 7:** Commit `feat: update applications from a pasted email`.

### Task 13: Script uji live

**Files:**
- Create: `scripts/email-fixtures.mts`
- Modify: `package.json` (`"ai:email": "node --no-warnings --env-file=.env.local scripts/email-fixtures.mts"`)

**Interfaces:**
- Consumes: `EMAIL_FIXTURES` (Task 5/7), `reading.ts` (Task 6), `plan.ts` (Task 7), dan `scripts/llm-call.mts` (pola `configuredRefs`, seperti `extract-fixtures.mts`).

- [ ] **Step 1:** Untuk setiap model yang terpasang dan setiap fixture: redact → panggil model → `verifyReading` → `planEmailUpdate` dengan stages template BUMN. Bandingkan dengan `expect`, lalu cetak `console.table` berisi kolom model, fixture, skor, dan field yang gagal. Script ini tidak mencetak key.
- [ ] **Step 2:** `pnpm ai:email` berjalan. Catat skornya di laporan.
- [ ] **Step 3:** Commit `test: live email-update fixtures script`.
