# Persiapan & latihan interview — rancangan

**Status:** disimpan, belum dikerjakan (2026-10-23). Menunggu tiga keputusan pemilik repo (lihat bagian akhir).

Latar: chatbot umum ditolak untuk sekarang (kuota Groq gratis, data pribadi di catatan, jawaban bebas tidak bisa diverifikasi, dan pertanyaan umum sudah dijawab Dashboard/Analytics/Kalender). Gantinya: fitur AI yang terarah ke satu lowongan dan satu tahap.

## Tahap 1 — Persiapan interview

### Tempat
- **Rekomendasi:** tab "Cek CV" di detail lamaran diganti nama menjadi **"Persiapan"**, berisi Cek CV (sudah ada) + Persiapan interview. Jumlah tab tetap 5, jadi tetap muat di HP tanpa digulir.
- Alternatif: tab baru "Interview" (6 tab; di HP deretan tab kembali digulir).
- Pintasan: tombol "Siapkan interview" di kartu "Langkah berikutnya" (Ringkasan) kalau ada jadwal interview; tautan dari baris interview di Dashboard "7 hari ke depan".

### Input ke AI
| Data | Dikirim? | Alasan |
|---|---|---|
| Teks lowongan (`jobPostingText`) | ya | publik |
| Nama + jenis tahap saat ini | ya | pertanyaan disesuaikan tahap |
| Syarat `PLACEMENT` / `SERVICE_BOND` | ya | sering ditanya di interview HR BUMN |
| CV | ya, **lewat `redact()`** | sama dengan Cek CV (CLAUDE.md 7a, 7.5) |
| Catatan riwayat tahap | **tidak** | teks bebas, sulit dijamin bebas data pribadi |

Tanpa teks lowongan: tetap jalan dengan perusahaan + posisi saja, hasil lebih umum, UI menyarankan menempel teks lowongan di "Ubah data".

### Output (skema Zod)
- 8–10 pertanyaan, kategori: motivasi, perilaku, teknis, situasional, HR.
- Per pertanyaan: `question`, `why` + `quote` (substring teks lowongan, boleh null), `answerPoints` berpola STAR + `cvQuote` (substring CV teredaksi, boleh null), `tip`.
- Disesuaikan tahap: Interview HR (motivasi, kelebihan/kekurangan, ekspektasi gaji dari `expectedSalary`, kesediaan penempatan/ikatan dinas); Interview User (teknis dari skill lowongan); LGD (tips + contoh topik). Psikotes/TPA/MCU: bukan interview, tidak ditawarkan.
- `questionsToAsk`: 3 pertanyaan untuk diajukan ke pewawancara.

### Penjagaan (seperti fitur AI lain)
- `quote` dan `cvQuote` diverifikasi di server; yang tidak ditemukan dibuang, dan poin jawaban yang mengaku dari CV diubah jadi arahan umum ("kalau pernah X, ceritakan itu").
- Prompt melarang fakta tentang perusahaan yang tidak ada di lowongan.

### Kuota & penyimpanan
- 1 kuota per pembuatan; hasil disimpan di lamaran, dibuka ulang tanpa kuota.
- Disimpan per tahap; pindah tahap → tombol "Buat untuk <tahap baru>". Tombol "Buat ulang" (1 kuota).

### Perubahan sistem
- Skema: satu kolom JSON di `Application` (seperti `cvTweaks`) + nilai enum `AiFeature.INTERVIEW_PREP`. **Butuh persetujuan** (aturan 3.2).
- Kode: `lib/ai/interview-prep.ts` (prompt, skema, verifikasi kutipan) + unit test, satu route AI, komponen UI.
- Perkiraan: ±1 hari kerja.

## Tahap 2 — Latihan interview (setelah tahap 1 terbukti berguna)
- Pilih 3–5 pertanyaan dari daftar persiapan.
- AI bertanya → pengguna mengetik jawaban → AI memberi masukan: yang sudah bagus, yang kurang (hasil tidak terukur, terlalu panjang, tidak menjawab inti), dan kerangka jawaban lebih baik yang **disusun ulang dari jawaban pengguna + isi CV saja**, tanpa pengalaman fiktif.
- Ringkasan akhir sesi: kekuatan + hal yang perlu dilatih.
- 1 kuota per jawaban. Jawaban yang diketik lewat `redactPII` dulu. Sesi tidak disimpan; ringkasan boleh disimpan sebagai catatan riwayat tahap atas pilihan pengguna.
- Perkiraan: ±1 hari kerja.

## Keputusan yang belum diambil
1. Tempat: gabung ke tab "Persiapan" (rekomendasi) atau tab baru "Interview"?
2. Boleh menambah satu kolom JSON + satu nilai `AiFeature`?
3. Cakupan: tahap 1 dulu (rekomendasi) atau langsung keduanya?
