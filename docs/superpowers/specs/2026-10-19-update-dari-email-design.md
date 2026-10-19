# Update lamaran dari email (AI)

Tanggal: 2026-10-19. Status: desain, belum dibangun.

## Intent

Selama seleksi, perusahaan mengabarkan perkembangan lewat email: undangan tes atau asesmen, permintaan berkas, konfirmasi lamaran terkirim, dan penolakan. Email-email ini panjang, dan informasi pentingnya tersebar: tahap barunya, rentang waktu pengerjaan, syarat teknis, link platform, bahkan username dan password. Saat ini pemilik repo menempelkan email seperti itu ke Gemini supaya jadwalnya masuk ke Google Calendar, sementara Lajur tidak tahu apa-apa: kartu tetap di kolom lama dan jadwalnya tidak tercatat.

Fitur ini: user menempel isi email ke Lajur, AI membacanya, lalu Lajur **mengusulkan** perubahan pada lamaran yang bersangkutan. User memeriksa, bisa mengubah, lalu menerapkannya. Setelah diterapkan, pengingat H-3/H-1 dan tombol "Tambah ke Google Calendar" yang sudah ada langsung berlaku untuk jadwal baru, sehingga langkah Gemini tidak perlu lagi.

## Contoh email nyata (acuan dan fixture uji)

Empat jenis yang harus ditangani, diambil dari email asli pemilik repo:

1. **Undangan tes atau asesmen.**
   - *Apple Developer Academy Indonesia*: Online Entry Test (Logic + Programming), 120 menit, buka 17 Sep 2026 08.00 WIB, tutup 24 Sep 2026 11.00 WIB. Wajib PC dengan webcam dan mikrofon, login dengan email dan nomor KTP yang sama dengan formulir, dilarang pindah tab.
   - *Peepl*: asesmen online lewat platform Nucleus, mulai 29 Sep 2026 14.00 WIB, selesai 1 Okt 2026 09.00 WIB. Email ini memuat username, password, dan link.
2. **Permintaan berkas.** *ISS Indonesia*: kirim CV terbaru dan sertifikat TOEFL ≥ 500 atau IELTS ≥ 6.0 ke email balasan, dengan format nama file `CV_[Nama]` dan `EnglishCertificate_[Nama]`, paling lambat Kamis 24 Sep 2026.
3. **Konfirmasi lamaran terkirim.** Email portal Astra yang berupa tabel: Function "Information Technology", Vacancy "Mobile Developer - GSI", Company "PT Global Service Indonesia", dan link lowongannya.
4. **Penolakan.** *BNI*: "Saudara tidak dapat melanjutkan ke tahapan seleksi berikutnya" setelah tahap Online Assessment, program ODP IT.

Email bisa berbahasa Indonesia atau Inggris, dan bisa memuat header Gmail (pengirim, tanggal, "to me").

## Goals

- Satu halaman **"Update dari email"**: tempel email → AI membaca → daftar usulan perubahan → user menerapkan.
- Usulan yang didukung:
  1. **Pindah tahap**, ke tahap user yang paling sesuai.
  2. **Tambah jadwal (Event)**, satu atau lebih per email.
  3. **Catatan**, berisi instruksi penting dari email, termasuk link dan kredensial login asesmen.
  4. **Hasil tahap**: untuk email penolakan, tahap terakhir sebelum Ditolak ditandai **Gagal** (`StageResult.FAILED`), supaya dashboard bisa menunjukkan di tahap mana user paling sering gugur.
- **Lamaran dicocokkan otomatis** dengan lamaran user, tapi user bisa menggantinya.
- **Kalau perusahaannya belum ada di Lajur**, user diberi tahu bahwa lamaran itu belum tercatat, lalu ditawari tombol untuk menambahkannya dengan data dari email yang sudah terisi.

## Non-goals

- Membaca email otomatis dari Gmail atau inbox. CLAUDE.md sudah mencatatnya sebagai ide v2 dan di luar cakupan.
- Mengubah jadwal yang sudah ada, misalnya email "jadwal interview diundur". Untuk v1, usulan selalu berupa jadwal **baru**, dan jadwal lama dihapus manual oleh user. Lihat "Diserahkan ke builder".
- Membalas email atau mengirim berkas.

## Anti-goals (gagal walau "jalan")

- **AI mengarang tanggal, jam, atau tahap.** Usulan apa pun tanpa kutipan yang benar-benar ada di teks email harus dibuang di server. Pola ini sudah dipakai ekstraksi lowongan (`verifyQuotes`).
- **Data berubah tanpa persetujuan user.** Tidak ada yang tersimpan sebelum user menekan "Terapkan".
- **Data pribadi atau kredensial terkirim ke AI.** Lihat bagian Privasi.
- **Salah lamaran tanpa disadari.** Lamaran hasil pencocokan harus terlihat jelas (nama perusahaan dan posisi), dan mudah diganti.

## Keputusan pemilik repo

1. **Lokasi: sub-menu di sidebar.** Menu "Lamaran" punya dua anak menu: **Lihat lamaran** (board dan daftar yang sudah ada) dan **Update dari email** (halaman baru). Di HP, karena tab bar tidak punya sub-menu, "Update dari email" muncul sebagai tombol di halaman Lamaran.
2. **Perusahaan belum ada di Lajur:** beri tahu dulu, lalu rekomendasikan untuk menambahkannya ke daftar lamaran.
3. **Kredensial disimpan.** Username, password, dan link login asesmen disimpan di catatan lamaran supaya tidak perlu mencari di email lagi.
4. **Layar pemeriksaan: daftar perubahan yang bisa dicentang**, masing-masing ditulis sebagai kalimat dan disertai kutipan bukti dari email. Setiap baris tetap **bisa diubah atau dicek lebih lengkap** lewat tombol "Ubah" yang membuka isiannya: tahap, jenis jadwal, tanggal dan jam, serta catatan. Tombol utamanya "Terapkan N perubahan".
5. **Persetujuan AI diperbarui.** Teks persetujuan AI yang sudah ada (`src/components/ai-consent.tsx`) ditambah dengan "isi email dari perusahaan". Pengguna yang sudah menyetujui teks lama melihat **pemberitahuan singkat satu kali** di halaman Update dari email, berisi apa yang dikirim dan apa yang disamarkan, dengan tombol "Saya mengerti". Fitur baru aktif setelah tombol itu ditekan. Pengguna baru cukup menyetujui teks yang sudah diperbarui. Penanda pemberitahuan disimpan di database (kolom baru `User.emailAiNoticeAt DateTime?`), bukan di browser.
6. **Jadwal punya rentang waktu.** Tabel `Event` mendapat kolom baru `opensAt DateTime?` (waktu buka). `startsAt` tetap waktu tutup atau waktu acara, jadi pengingat H-3/H-1 dan urutan jadwal tidak berubah. Kalau `opensAt` terisi:
   - jadwal tampil sebagai rentang ("29 Sep 14.00 – 1 Okt 09.00") di halaman detail, kalender, kartu board, dan dashboard;
   - tombol "Tambah ke Google Calendar" membuat acara dari `opensAt` sampai `startsAt`, bukan acara 1 jam;
   - form jadwal (tambah dan ubah) punya isian opsional "Mulai bisa dikerjakan", dengan validasi bahwa `opensAt` tidak boleh setelah `startsAt`.
   Di halaman kalender, jadwal rentang tampil pada **tanggal tutupnya** dengan label rentang, tidak digambar di setiap hari dalam rentang.

Mockup yang disetujui untuk layar pemeriksaan:

```
Peepl · Software Engineer                       Bukan yang ini? ▾
┌───────────────────────────────────────────────────────────────┐
│ ☑ Pindahkan ke [Tes Online/TPA]                         Ubah  │
│   "kami mengundang Anda untuk mengikuti rangkaian asesmen…"   │
│ ☑ Tambah jadwal Tes online/TPA · tutup Kam, 1 Okt, 09.00 Ubah │
│   (buka 29 Sep 14.00)  "Selesai : 01 October 2026 09:00 WIB"  │
│ ☑ Simpan catatan: link Nucleus, username, password, …   Ubah  │
└───────────────────────────────────────────────────────────────┘
[ Terapkan 3 perubahan ]  [ Batal ]
```

## Keputusan builder (bisa dibantah pemilik repo)

- **Pencocokan lamaran dilakukan di server, bukan oleh AI.** AI hanya mengekstrak nama perusahaan, posisi, dan nama program kalau ada. Server lalu mencocokkannya ke lamaran milik user, dengan menormalkan huruf besar-kecil, "PT", "Tbk", "(Persero)", tanda baca, dan memakai pencocokan sebagian. Alasannya, daftar lamaran user tidak perlu dikirim ke AI, dan hasilnya bisa diuji tanpa AI.
  - Kalau ada **lebih dari satu kandidat**, yang ditampilkan adalah yang paling cocok, dan dropdown "Bukan yang ini?" berisi semua lamaran user, dengan kandidat lain di urutan atas.
  - Kalau **tidak ada kandidat**, alurnya "belum ada di Lajur" (keputusan 2).
- **Tahap tujuan dipilih dari tahap milik user.** AI mengembalikan *jenis* kejadian (`TEST_INVITE`, `DOCUMENT_REQUEST`, `INTERVIEW`, `MCU`, `OFFER`, `REJECTION`, `APPLICATION_RECEIVED`, `OTHER`) plus nama tahap seperti yang tertulis di email, misalnya "Online Assessment" atau "Psikotes". Server memetakannya ke tahap user lewat kecocokan nama (Psikotes, LGD, Interview HR, MCU, dan sejenisnya), lalu lewat `kind` (penolakan → tahap berjenis `REJECTED`, offering → `OFFER`). Kalau tidak ada yang cocok, tidak ada usulan pindah tahap. Usulan pindah tahap juga tidak dibuat kalau tujuannya sama dengan tahap saat ini.
- **Jadwal dengan rentang waktu** (buka sampai tutup): `startsAt` diisi waktu **tutup** dan `opensAt` diisi waktu **buka** (keputusan 6). `locationOrUrl` hanya berisi link atau tempat.
- **Jenis jadwal** dipetakan ke `EventType` yang sudah ada: tes online/TPA → `ONLINE_TEST`, psikotes → `PSYCHOTEST`, LGD → `LGD`, interview HR/user → `INTERVIEW_HR`/`INTERVIEW_USER`, MCU → `MCU`, batas kirim berkas → `DEADLINE`, lainnya → `OTHER`. Kalau hanya ada tanggal tanpa jam, misalnya "paling lambat Kamis 24 Sep 2026", jamnya 23.59 WIB.
- **Catatan disimpan di `StageHistory.notes`**, pada langkah tahap yang dituju. Kalau tidak ada perpindahan tahap, catatan masuk ke langkah tahap saat ini. Catatan yang sudah ada **tidak ditimpa**: teks baru ditambahkan di bawahnya, diawali tanggal hari ini.
- **Penolakan:** kalau email menyebut tahap tempat user gugur (misalnya BNI: "Online Assessment") dan nama itu cocok dengan salah satu tahap user, tahap itu **dicatat dulu** di riwayat (kalau belum ada), lalu ditandai **Gagal**, baru kemudian lamaran dipindah ke Ditolak. Contohnya, kartu BNI yang masih di Administrasi akan memiliki riwayat Administrasi → Tes Online/TPA (Gagal) → Ditolak. Kalau email tidak menyebut tahapnya, atau namanya tidak cocok dengan tahap mana pun, yang ditandai Gagal adalah langkah terakhir sebelum Ditolak, kecuali langkah itu sudah punya hasil. Pindah tahapnya memakai `changeStage` di `src/actions/applications.ts`, yang menjaga riwayat tetap urut dan mengunci baris lamaran. Jalur "catat tahap yang disebut lalu tandai Gagal" butuh unit test tersendiri.
- **Menerapkan perubahan berlangsung dalam satu transaksi.** Semua perubahan yang dicentang berhasil, atau tidak ada satu pun yang tersimpan.
- **Batas teks:** isi email dipotong 12.000 karakter, sama seperti teks lowongan, karena batas token gratis Groq.
- **Provider dan kuota:** lewat `generateStructured` di `lib/ai/provider.ts` dengan skema Zod. Pemanggilan dihitung ke kuota harian (`assertQuota`/`recordUsage`), dan butuh persetujuan AI (`assertAiConsent`) plus pemberitahuan email (keputusan 5).
- **Migrasi database** (satu migrasi, semuanya aditif, tanpa menghapus data): nilai enum `AiFeature.EMAIL_UPDATE`, kolom `Event.opensAt DateTime?`, dan kolom `User.emailAiNoticeAt DateTime?`. Fitur yang menyalin jadwal, yaitu snapshot "Urungkan" hapus lamaran, ekspor CSV, dan reset akun demo, ikut membawa `opensAt`.
- **Mode demo read-only:** halaman tetap bisa dibuka, tapi tombol "Baca dengan AI" ditolak dengan pesan demo yang sudah ada, sama seperti ekstraksi lowongan.
- **AI tidak tersedia atau kuota habis:** tampilkan pesan yang sama dengan fitur AI lain. User tetap bisa memperbarui lamaran secara manual.

## Privasi

Sebelum dikirim ke AI, isi email melewati penyamaran di `lib/ai/redact.ts`, mengikuti aturan 7a di CLAUDE.md:

- Email, nomor HP, URL, dan angka panjang (NIK, kode peserta) sudah ditangani `redactPII`.
- Nama user dari `User.name`, termasuk variasi tiap kata dan sapaan seperti "Sdr. Arief Muhammad Usry", "Hi Arief Usry", "Dear Arief".
- **Kredensial (baru):** nilai setelah label seperti `Username`, `User ID`, `Password`, `Kata sandi`, `PIN`, `Token`, `Kode akses`, `Login ID` diganti placeholder `[CRED_n]`. Placeholder ini harus ikut dikenali oleh pola `PLACEHOLDER` dan oleh `rehydrate`.

AI hanya melihat placeholder. Nilai aslinya dikembalikan dengan `rehydrate` **di server**, saat catatan disusun untuk ditampilkan dan disimpan, sehingga catatan yang tersimpan berisi link, username, dan password asli (keputusan 3). Isi email, kredensial, dan prompt tidak pernah ditulis ke log.

Unit test wajib memastikan nama, email, nomor HP, URL, kode peserta, dan kredensial dari keempat contoh email tidak tersisa di teks yang dikirim ke AI.

## Alur layar

1. Sidebar → Lamaran → **Update dari email** (`/applications/update`). Kalau belum ada persetujuan AI, tampilkan komponen persetujuan yang sudah ada.
2. Kotak tempel email dengan tombol **Baca dengan AI**. Di atas kotak ada petunjuk (permintaan pemilik repo) supaya user menyalin **seluruh** isi email beserta semua informasi pentingnya: nama perusahaan, tanggal dan jam, link, serta username dan password kalau ada. Contohnya: "Salin seluruh isi email, termasuk nama perusahaan, tanggal dan jam, link, dan info login kalau ada. Bagian yang tidak ikut disalin tidak bisa dibaca AI." Di bawah kotak ada catatan kecil: "Nama, kontak, dan kredensial disamarkan sebelum dikirim ke AI."
3. Tampilkan progres seperti ekstraksi lowongan (membaca, memverifikasi).
4. Hasilnya salah satu dari:
   - **Lamaran ditemukan:** layar pemeriksaan (keputusan 4).
   - **Lamaran belum ada:** "Lamaran ke *PT Global Service Indonesia* belum ada di Lajur", dengan tombol **Tambahkan ke lamaran**. Usulan lain dari email yang sama (jadwal, catatan, kredensial) **tidak boleh hilang** dan tidak boleh butuh panggilan AI kedua. Keputusan builder: lamaran baru dibuat langsung dari layar pemeriksaan. Isian lamaran baru tampil sebagai baris pertama yang bisa diubah (perusahaan, posisi, sumber, link, tahap), lalu "Terapkan" membuat lamaran sekaligus menerapkan jadwal dan catatan dalam satu transaksi. Form Lamaran baru yang lama tidak dipakai di alur ini. Field wajib yang tidak ada di email, misalnya sumber lowongan, harus diisi user sebelum "Terapkan" aktif.
   - **Tidak ada yang bisa diperbarui:** misalnya email promosi. Tampilkan "Tidak ada info seleksi yang bisa dicatat dari email ini."
5. Setelah **Terapkan**, buka halaman detail lamaran itu (tab Riwayat atau Jadwal) dan tampilkan toast ringkasan.

## Pengujian

- **Unit:**
  - penyamaran, termasuk kredensial dan semua placeholder bisa dikembalikan;
  - pencocokan lamaran (normalisasi nama perusahaan, banyak kandidat, tidak ada kandidat);
  - pemetaan jenis kejadian ke tahap dan `EventType`;
  - pemilihan waktu tutup untuk rentang waktu;
  - verifikasi kutipan (usulan tanpa kutipan dibuang);
  - catatan tidak menimpa catatan lama;
  - langkah yang ditandai Gagal pada penolakan.
- **Fixture:** keempat email contoh di atas, dengan nama dan kredensial diganti data karangan, beserta hasil yang diharapkan. Fixture ini juga dipakai script uji live seperti `pnpm ai:fixtures`.
- **E2E:** dengan AI dimatikan, halaman terbuka dan menampilkan pesan AI tidak tersedia. Alur penuh dengan AI diuji manual.

## Diserahkan ke builder

- Nama route dan struktur komponen. `/applications/update` hanya usulan, dan harus tetap di bawah route group yang tidak memunculkan header Board/Daftar.
- Wording teks UI, selama berbahasa Indonesia dan tidak terdengar seperti AI.
- Detail tampilan sub-menu di sidebar, termasuk kapan anak menu terbuka (misalnya selalu terlihat, atau hanya saat berada di halaman Lamaran).
- Apakah jadwal yang **sama persis** dengan jadwal yang sudah ada (jenis dan waktu sama) dilewati otomatis untuk mencegah duplikat ketika email yang sama ditempel dua kali. Disarankan ya.
