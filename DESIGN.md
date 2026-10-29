# DESIGN.md: landing page Lajur

Arah visual untuk halaman publik (`src/app/page.tsx`). Berlaku hanya di landing; aplikasi di dalam memakai token yang sudah ada. Pemilik repo meminta gaya seperti sebuah shot Dribbble ("Sleek Landing Page for CoreShift", dilihat lewat rekaman video) pada 2026-10-27. Itu inspirasi, bukan salinan: tidak ada gambar, logo, atau teks dari karya itu. Arah lain (formulir dan stempel) disimpan di cabang `landing-formulir`.

## Pembacaan

Landing untuk pencari kerja Indonesia usia 20-an sampai 30-an yang banyak membuka lewat HP, dengan bahasa visual "jalur": satu simpul (Lajur) tersambung garis tipis ke tahap seleksi. Dial: ENERGY 2 / RHYTHM 2 / MOTION 3.

## Palet (3 inti + 1 aksen)

| Peran | Terang | Gelap |
|---|---|---|
| Dasar | `#F1F3F5` | `#0E1014` |
| Kartu | `#FFFFFF` | `#171A20` |
| Tinta (teks, tombol utama) | `#0B0D12` | `#ECEEF1` |
| Aksen: biru Lajur | `#1F5FD8` | `#6EA2FF` |

Aksen hanya untuk simpul tengah di hero, ikon kecil di ubin tahap seleksi (nada pucat dari aksen yang sama), batang contoh, dan kata raksasa di footer. Teks sekunder `#4A515E` (terang) dan `#A3A9B5` (gelap), kontras 7:1 ke atas. Bayangan lembut hanya untuk benda yang melayang: ubin hero, nav, dan tangkapan layar produk.

## Huruf

- Judul: Plus Jakarta Sans 600/800, rapat. Alasan: dirancang di Jakarta untuk pembaca Indonesia, dan tegas pada ukuran besar.
- Isi: Geist (sama dengan aplikasi).

## Motif identitas

Garis jalur: simpul tengah tersambung ke ubin tahap seleksi. Ubin miring sedikit. Kata "Lajur" raksasa terpotong di dasar halaman.

## Latar

Dua kolam gradien biru Lajur (`.landing-glow` di `globals.css`) melayang pelan di bawah halaman, tetap di tempat sementara bagian-bagian di-scroll di atasnya. Alasan: dasar `#F1F3F5` / `#0E1014` yang rata terasa polos, dan satu-satunya warna yang boleh menambah kedalaman adalah aksen biru merek, jadi gradiennya hanya biru itu pada opacity rendah (18% dan 12%), bukan biru-ungu atau warna baru. Hanya `transform` yang bergerak (26 dan 32 detik, bolak-balik), kontras teks sekunder tetap di atas 4,5:1 di titik terpekat, dan dengan `prefers-reduced-motion` kolamnya diam. Ini loop kedua di halaman, di samping carousel portal.

Di HP hero memakai hub yang sama dengan desktop: simpul di tengah, tiga tahap di tiap sisi, ubin ditumpuk (ikon di atas label) supaya muat.

## Gerak

GSAP + ScrollTrigger (`src/components/landing/landing-motion.tsx`), dibaca dari atribut `data-lm` di `page.tsx`. Dial MOTION 3, mengikuti rekaman referensi:

- Hero: ubin tahap dan simpul bergeser naik dengan kecepatan berbeda saat scroll; garis menghilang.
- Judul bagian: kata muncul satu per satu dari blur.
- Kartu UI melayang naik bergantian, lalu menyebar dengan kecepatan berbeda saat scroll (desktop).
- Kartu "untuk siapa" dan kartu langkah naik saat masuk; batang contoh tergambar dari kiri.
- Panel portal membesar dari 92% ke penuh; ubin naik; ubin yang terangkat berpindah tiap 1,7 detik (loop kedua setelah latar).
- Kata raksasa di footer naik dari blur.

Semua tampil utuh tanpa JS dan saat `prefers-reduced-motion` (tidak ada efek GSAP yang jalan). Loop portal berhenti saat panelnya keluar layar.

## Ikon dan logo

- Ikon ubin tahap (lucide-react): dokumen untuk Administrasi, monitor untuk Tes Online/TPA, otak untuk Psikotes, orang-orang untuk LGD, percakapan untuk Interview HR, stetoskop untuk MCU. Dipilih karena maknanya, bukan pustakanya.
- Logo portal di `public/portals`: SVG favicon resmi Jobstreet dan Glints, SVG "in" LinkedIn, dan ikon aplikasi Kalibrr 512px. Disajikan apa adanya (`unoptimized`) supaya tidak dikecilkan lalu dibesarkan lagi.

## Batas

- Tidak ada foto orang, testimoni, bintang, atau logo pelanggan (belum ada yang nyata).
- Ubin portal adalah portal yang benar-benar dibuka fitur Cari lowongan.
- Ubin tahap seleksi memakai nama tahap template BUMN yang nyata, 6 dari 8, tanpa nomor (dua tahap tidak muat, jadi nomor akan menampakkan celah).
