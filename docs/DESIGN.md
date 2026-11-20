# DESIGN — Arus

Spesifikasi visual v1. Pasangannya `docs/PRD.md`. Semua nilai di sini adalah token. Engineer tidak boleh memakai hex atau ukuran di luar token.

> Catatan: pemilik mendelegasikan keputusan desain sepenuhnya (2026-11-20); mockup tidak perlu persetujuan terpisah — spesifikasi ini langsung dipakai.

## 1. Arah visual: "Kertas & Tinta"

Arus harus terasa seperti buku catatan keuangan yang mahal: permukaan kertas hangat, tinta hampir hitam, dan **satu** warna aksen yang dalam (hijau-laut "Laut"). Kepercayaan datang dari ketenangan, bukan dekorasi. Semangatnya: ketegasan angka seperti Copilot Money, kerapian dan respons seperti Things 3, kualitas material seperti Apple Wallet. Ketiganya diterjemahkan ke identitas sendiri.

**Ciri khas Arus (identitas)**
1. **Angka sebagai pahlawan.** Nominal besar memakai SF Pro Rounded (`ui-rounded`), tabular, dengan "Rp" kecil berbobot ringan yang sejajar baseline. Tidak ada elemen lain yang lebih menonjol daripada angka.
2. **Garis rambut, bukan bayangan.** Pemisahan memakai hairline 0,5 px dan perbedaan nada permukaan. Bayangan hanya untuk benda yang benar-benar mengambang (sheet, toast, FAB).
3. **Satu aksen.** Laut dipakai untuk aksi utama, pemasukan, progres sehat, dan seleksi. Merah hanya untuk "lebih/hapus". Pengeluaran ditulis dengan tinta biasa, bukan merah. Mengeluarkan uang itu normal, tidak perlu dialarmkan.
4. **Garis periode.** Di bawah header saldo ada garis 2 px yang menunjukkan berapa persen periode sudah berjalan (track `line`, isi `ink-3`), dengan penanda titik kecil accent. Elemen ini berulang di Anggaran sebagai garis vertikal tipis "hari ini" di atas setiap bar progres.

**Dilarang**: gradien, ungu/neon, glassmorphism berlebih, emoji sebagai ikon, kartu dengan bayangan di setiap bagian, ilustrasi 3D/blob, font web dekoratif, teks seluruhnya kapital untuk judul, warna kategori jenuh penuh.

## 2. Warna

### 2.1 Token semantik
| Token | Light | Dark | Pemakaian |
|---|---|---|---|
| `--bg` | `#F5F4F0` | `#0B0C0D` | Latar app, body, status bar |
| `--surface` | `#FFFFFF` | `#151718` | Grup list, sheet, kartu |
| `--surface-2` | `#EDECE7` | `#1E2022` | Tombol keypad, chip, track segmented, field |
| `--surface-pressed` | `#E3E1DB` | `#2A2D30` | State tekan |
| `--line` | `#E2E0DA` | `#26292B` | Hairline, separator, track progres |
| `--ink` | `#15171A` | `#F2F1ED` | Teks utama, nominal pengeluaran |
| `--ink-2` | `#62666D` | `#A1A5AB` | Teks sekunder (kontras ≥ 4.5:1 di `bg` dan `surface`) |
| `--ink-3` | `#9EA1A6` | `#6A6E74` | Teks tersier, placeholder, ikon non-aktif (bukan informasi penting) |
| `--accent` | `#0B6B5D` | `#4CC3AE` | Aksi utama, seleksi, pemasukan, progres sehat |
| `--accent-soft` | `#0B6B5D1A` | `#4CC3AE24` | Latar seleksi, highlight baris baru |
| `--on-accent` | `#FFFFFF` | `#06231E` | Teks di atas accent |
| `--positive` | `= --accent` | `= --accent` | Nominal pemasukan, delta baik |
| `--negative` | `#C23B22` | `#FF7A63` | Lebih anggaran, hapus, saldo negatif, error |
| `--negative-soft` | `#C23B221A` | `#FF7A6324` | Latar tombol swipe hapus (teks `negative`) |
| `--warning` | `#9A6200` | `#F2B33D` | Anggaran 80–100%, backup terlambat |
| `--inverse-bg` | `#1B1D20` | `#F2F1ED` | Toast |
| `--inverse-ink` | `#F2F1ED` | `#15171A` | Teks toast |
| `--inverse-accent` | `#6FD6C2` | `#0B6B5D` | Aksi di toast ("Urungkan") |
| `--scrim` | `rgba(10,12,14,.32)` | `rgba(0,0,0,.56)` | Latar belakang sheet |

Dark mode memakai hitam OLED (`#0B0C0D`, bukan `#000`), dan permukaan naik satu tingkat lebih terang per elevasi. Tidak ada bayangan di dark mode, hanya perbedaan nada dan hairline.

Implementasi: token didefinisikan di `:root` (light), dark lewat `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {…} }` dan `:root[data-theme="dark"] {…}`. `body { background: var(--bg) }` wajib, karena Safari 26 mengambil warna status bar dari sini. Atribut `<meta name="color-scheme" content="light dark">`.

### 2.2 Warna kategori (`c1`–`c12`)
Nada redup "tanah & mineral" yang setara kecerahannya, agar donat tidak berisik. Glyph ikon memakai warna penuh, dan latar ikon memakai warna yang sama dengan alfa 14% (light) / 22% (dark).

| Token | Nama | Light | Dark | Default untuk |
|---|---|---|---|---|
| `c1` | Tanah liat | `#B8562F` | `#E08862` | Makan & Minum |
| `c2` | Biru baja | `#3A64A8` | `#82A6DE` | Transportasi |
| `c3` | Zaitun | `#5F7F32` | `#A0BE6C` | Belanja Harian |
| `c4` | Kunyit | `#A97813` | `#E2B455` | Tagihan & Utilitas |
| `c5` | Plum | `#80476F` | `#C690B9` | Tempat Tinggal |
| `c6` | Mawar | `#B4465E` | `#E68C9F` | Belanja |
| `c7` | Nila | `#4D57A6` | `#959CE0` | Hiburan & Langganan |
| `c8` | Laut muda | `#23827A` | `#6ECAC1` | Kesehatan |
| `c9` | Sienna | `#8E5E33` | `#CC9C6E` | Keluarga & Sosial |
| `c10` | Sage | `#527F5E` | `#96C2A1` | Sedekah & Zakat |
| `c11` | Muara | `#33748F` | `#7DB7D1` | Pendidikan |
| `c12` | Batu | `#6F737A` | `#A5A9AF` | Lainnya |

Income default: Gaji `c10`, Bonus & THR `c4`, Usaha & Freelance `c11`, Investasi & Bunga `c3`, Hadiah `c6`, Lainnya `c12`. Akun default: Tunai `c3`, Rekening Bank `c2`, E-Wallet `c8`.

## 3. Tipografi

- **Teks**: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif` (SF Pro di iOS, tanpa unduhan font).
- **Angka hero & keypad**: `ui-rounded, "SF Pro Rounded", -apple-system, system-ui, sans-serif`.
- **Wajib**: `font-variant-numeric: tabular-nums` pada semua elemen yang menampilkan angka (`.num` utility + default di komponen Amount, ListRow trailing, chart label).
- `-webkit-font-smoothing: antialiased`. `text-rendering: optimizeLegibility`.
- Ukuran berbasis `rem`. `html { font-size: calc(16px * var(--text-scale)) }` dengan `--text-scale` = 1 / 1.12 / 1.24 (setting Ukuran teks). Input selalu `max(16px, 1rem)`.

| Token | Ukuran/Line | Bobot | Tracking | Pemakaian |
|---|---|---|---|---|
| `--t-hero` | 48/52 rounded | 600 | −0.02em | Nominal di sheet input, saldo detail akun |
| `--t-amount-l` | 34/40 rounded | 600 | −0.015em | Total saldo, angka ringkasan |
| `--t-large-title` | 34/41 | 700 | −0.012em | Large Title nav bar |
| `--t-title` | 22/28 | 600 | −0.01em | Judul sheet, angka kartu anggaran |
| `--t-headline` | 17/22 | 600 | −0.01em | Judul inline nav bar, label tombol |
| `--t-body` | 17/22 | 400 | −0.01em | Judul baris list, input |
| `--t-callout` | 16/21 | 400 | −0.005em | Isi banner |
| `--t-subhead` | 15/20 | 400 | 0 | Subjudul baris, chip |
| `--t-footnote` | 13/18 | 400 | 0 | Header hari, header grup, keterangan |
| `--t-caption` | 11/13 | 500 | +0.01em | Label tab bar, label sumbu chart |
| `--t-key` | 28/32 rounded | 500 | 0 | Digit keypad |

Prefiks "Rp" pada hero: 0,5× ukuran angka, bobot 500, warna `ink-2`, jarak 4 px, sejajar baseline. Nominal di baris list: `--t-body` bobot 500. Header hari dan header grup memakai sentence case (bukan kapital semua) `--t-footnote` 600 `ink-2`.

## 4. Spasi, radius, elevasi, layout

- **Skala spasi (4 pt)**: `--s-1:4px --s-2:8px --s-3:12px --s-4:16px --s-5:20px --s-6:24px --s-8:32px --s-10:40px --s-12:48px`.
- **Gutter layar**: 16 px (20 px jika lebar ≥ 428). Grup list inset: margin horizontal 16, radius 14.
- **Radius**: `--r-xs:6px` (badge), `--r-sm:10px` (chip, ikon kategori 32), `--r-md:14px` (grup list, kartu, field, tombol keypad), `--r-lg:20px` (kartu besar), `--r-sheet:24px` (sudut atas sheet), `--r-full:999px` (pill, toast, FAB).
- **Hairline**: `0.5px solid var(--line)`. Separator dalam grup dimulai dari tepi teks (inset 60 px dari kiri jika ada ikon), seperti iOS.
- **Elevasi** (light saja; dark = tanpa bayangan + `surface` lebih terang):
  - `--e-float`: `0 1px 2px rgba(20,22,25,.06), 0 8px 24px rgba(20,22,25,.10)`: sheet, FAB, toast.
  - `--e-thumb`: `0 1px 3px rgba(20,22,25,.12), 0 0 0 .5px rgba(20,22,25,.04)`: thumb segmented.
  - Komponen lain: **0**.
- **Target sentuh**: minimal 44×44.
- **Tinggi tetap**: nav bar 44 (+ Large Title 52), tab bar 49 + `safe-area-inset-bottom`, list row 60 (dengan subjudul) / 48 (tanpa), keypad key 54 (52 jika viewport < 700).
- Lebar konten maks 560 px, ditengahkan (untuk iPad/desktop).

## 5. Ikon

- **Set**: SVG inline buatan sendiri dengan gaya **"garis tipis iOS"**: viewBox 24, `stroke-width: 1.5` (1.75 pada ukuran ≤ 18), `stroke-linecap: round`, `stroke-linejoin: round`, `fill: none`, `stroke: currentColor`, padding optik 2 px. Path boleh diadaptasi dari Lucide (lisensi ISC, sertakan notice di `LICENSES.md`) dengan stroke diseragamkan ke 1.5.
- Satu komponen `<Icon name size>` dengan peta nama → path (tree-shakeable). Ukuran: 17 (inline teks), 20 (chip), 22 (nav bar), 24 (tab bar, list), 28 (tab aktif tidak membesar).
- **Tab bar**: ikon garis. Tab aktif: warna `accent` + ikon versi "isi" sederhana (path yang sama dengan `fill: currentColor` 12% + stroke). Tab tidak aktif: `ink-3`.
- **Ikon kategori**: glyph 18 px di dalam squircle 32 px (`r-sm`), latar warna kategori alfa 14%/22%, glyph warna kategori. Di grid input: squircle 44 px, glyph 22, label di bawahnya `--t-caption` 12 px `ink-2`, maksimal 2 baris.
- **Set ikon yang dibutuhkan** (nama): UI: `list, chart-donut, gauge, wallet, plus, search, gear, chevron-left, chevron-right, chevron-down, x, check, trash, backspace, calendar, note, repeat, arrows-swap, scale, lock, share, download, upload, info, alert, grip, archive, eye-off`. Kategori/akun (~40): `utensils, coffee, car, bike, bus, fuel, basket, receipt, bolt, wifi, phone, home, bag, shirt, gift, film, gamepad, music, heart-pulse, pill, users, hand-heart, book, graduation, briefcase, banknote, coins, trending-up, piggy, plane, paw, baby, wrench, sparkle, dumbbell, cash, bank, smartphone-wallet, card, dots`.
- Default kategori: Makan `utensils`, Transportasi `car`, Belanja Harian `basket`, Tagihan `bolt`, Tempat Tinggal `home`, Belanja `bag`, Hiburan `film`, Kesehatan `heart-pulse`, Keluarga `users`, Sedekah `hand-heart`, Pendidikan `book`, Lainnya `dots`. Gaji `briefcase`, Bonus `gift`, Usaha `coins`, Investasi `trending-up`, Hadiah `sparkle`, Lainnya `dots`. Akun: Tunai `cash`, Bank `bank`, E-Wallet `smartphone-wallet`.

## 6. Komponen inti

### 6.1 Keypad
- Grid 3×4, gap 8, padding horizontal 16, padding bawah `max(12px, safe-area-inset-bottom)`.
- Tombol: tinggi 54, `r-md`, latar `surface-2`, teks `--t-key` `ink`. Tombol `000` memakai teks 22 px. `⌫` memakai ikon `backspace` 26.
- Tekan: latar `surface-pressed` + `scale(.97)` selama 60 ms, kembali dalam 120 ms. Respons pada `pointerdown`.
- Tombol **Simpan** (jika tampil): lebar penuh, tinggi 52, `r-md`, `accent`/`on-accent`, `--t-headline`. Nonaktif: `surface-2` + `ink-3`.
- Tidak ada border dan tidak ada bayangan. Keypad duduk langsung di `surface` sheet.

### 6.2 Tampilan nominal (Amount display)
- Rata tengah. "Rp" + angka `--t-hero`. Auto-shrink: > 9 digit → 40 px, > 11 digit → 32 px.
- Setiap digit baru: digit masuk dengan `translateY(4px)→0` + opacity, 90 ms. Angka 0 placeholder memakai `ink-3`.
- Ditolak (digit ke-13): `translateX` ±4 px 3× dalam 180 ms.
- Mode Masuk: angka berwarna `positive`. Mode Keluar/Transfer: `ink`.

### 6.3 List row
- Tinggi 60. Padding 16 kiri/kanan. Ikon 32 (kiri) → gap 12 → judul `--t-body` (1 baris, ellipsis) + subjudul `--t-subhead` `ink-2` → kanan: nominal `--t-body` 500 tabular, dan opsional baris kecil `--t-footnote` `ink-3` (saldo berjalan di detail akun).
- Tekan: latar `surface-pressed` (tanpa delay, dilepas 150 ms).
- Swipe kiri: tombol Hapus selebar 88 px (`negative-soft` + teks `negative`). Swipe penuh > 60% → hapus langsung.
- Baris baru: latar `accent-soft` yang memudar dalam 1,2 dtk.
- Header hari: tinggi 32, sticky, latar `bg` dengan blur 12 px saat menempel, teks kiri/kanan `--t-footnote` 600 `ink-2`.
- Grup list: `surface`, `r-md`, hairline antarbaris.

### 6.4 Bottom sheet
- Latar `surface`, sudut atas `r-sheet`, `--e-float`, scrim `--scrim`.
- Grabber 36×5, `r-full`, `line`, 6 px dari atas.
- Detent: `full` (sheet input/edit: tinggi = viewport − safe-top − 8) dan `auto` (tinggi konten, maks 90%; dipakai pilih akun, tanggal, konfirmasi).
- Buka: `translateY(100%)→0`, 380 ms `cubic-bezier(.32,.72,0,1)`. Tutup: 260 ms dengan easing yang sama. Drag grabber/area atas untuk menutup. Lepas dengan offset > 25% atau kecepatan > 0,5 px/ms → tutup.
- Fokus terperangkap di dalam sheet. `Escape` menutup. Body di belakang tidak bisa di-scroll.
- Dialog destruktif memakai **action sheet** gaya iOS: grup tombol `surface` `r-md` dengan pilihan destruktif teks `negative`, dan tombol "Batal" terpisah di bawah dengan bobot 600.

### 6.5 Segmented control
- Track `surface-2`, tinggi 32, `r-sm` (9 px), padding 2.
- Thumb `surface` (light) / `#3A3D40` (dark), radius 7, `--e-thumb`. Bergeser 220 ms `cubic-bezier(.2,.8,.2,1)`.
- Label `--t-subhead` 500, aktif `ink`, tidak aktif `ink-2`. Segmen nonaktif: `ink-3`, tidak bisa ditap.

### 6.6 Toast
- Pill `inverse-bg`, `r-full`, tinggi 44, padding 16/8, `--e-float`, maks. lebar 520. Posisi: 12 px di atas tab bar (atau di atas safe-area jika tab bar tersembunyi).
- Teks `--t-subhead` `inverse-ink`, aksi `--t-subhead` 600 `inverse-accent` di kanan, dengan pemisah hairline.
- Masuk: `translateY(12px)→0` + fade, 200 ms. Keluar: fade 160 ms. Durasi 5 dtk (toast update persisten). `role="status"` `aria-live="polite"`.

### 6.7 Chip
- Tinggi 32, `r-full`, latar `surface-2`, padding 12, `--t-subhead` `ink`, ikon 17 di kiri, `chevron-down` 14 `ink-3` jika membuka pilihan. Aktif/terisi (filter): latar `accent-soft`, teks `accent`.

### 6.8 Sel kategori (grid input)
- Sel 1/4 lebar, tinggi 76: squircle 44 + label. Tekan: squircle `scale(.92)` 80 ms.
- Terpilih: cincin 2 px `accent` dengan jarak 2 px di sekitar squircle. Kategori terakhir dipakai: titik 4 px `accent` di kanan atas squircle.

### 6.9 Nav bar & tab bar
- Nav bar: latar `bg`. Saat konten tergulir, muncul hairline bawah dan latar `color-mix(in srgb, var(--bg) 82%, transparent)` + `backdrop-filter: blur(20px) saturate(1.4)`. Large Title 34 kiri, menyusut ke judul inline 17 600 di tengah saat scroll > 40 px.
- Tab bar: latar yang sama dengan nav bar tergulir (blur), hairline atas, 4 item dengan ikon 24 + label 11.
- FAB: 56 px, `r-full`, `accent`, ikon `plus` 26 stroke 2 `on-accent`, `--e-float`, posisi kanan 16 px dan 16 px di atas tab bar. Tekan `scale(.94)`.

### 6.10 Progress bar (anggaran)
- Tinggi 4 (kartu total: 6), `r-full`, track `line`, isi `accent` / `warning` / `negative` sesuai status. Lebih dari 100% → bar penuh `negative`.
- Penanda "hari ini" (periode berjalan): garis vertikal 1 px × 10 px `ink-3` pada posisi % hari berjalan. Jika isi melewati penanda, pengeluaran berjalan lebih cepat daripada waktu, dan pengguna langsung bisa melihatnya tanpa teks.

### 6.11 Banner
- Di dalam alur list (bukan overlay). `surface`, `r-md`, hairline, padding 14/16. Ikon 20 di kiri (`info`, atau `alert` dengan warna `warning`), teks `--t-callout`, tombol teks `accent` 600, dan `x` 17 `ink-3` di kanan atas.

### 6.12 State kosong
- Rata tengah, 48 px dari atas konten. Ikon garis 40 px `ink-3`, judul `--t-headline` `ink`, deskripsi `--t-subhead` `ink-2` maks. 280 px, lalu tombol sekunder (chip besar: tinggi 40, `accent-soft`, teks `accent`). Tanpa ilustrasi.

### 6.13 Layar kunci PIN
- Latar `bg`. Logo-mark 40 px di 20% atas, "Masukkan PIN" `--t-headline`, 6 titik 12 px (kosong: border 1.5 `ink-3`, terisi: `ink`). Salah: titik bergoyang + teks `negative` "PIN salah". Keypad tanpa `000` (sel kiri bawah kosong).

## 7. Chart

Dibuat dengan **SVG buatan sendiri** (tanpa library chart) agar ringan dan presisi.
- **Donat**: diameter 184, ketebalan 16, ujung datar, celah antarsegmen 2 px (stroke warna `surface` di antara busur, atau sudut celah ≈ 1°). Mulai dari jam 12, searah jarum jam, urut terbesar. Warna = warna kategori. "Lainnya" = `ink-3`. Tengah: nominal `--t-amount-l` dikecilkan ke 26 px + label `--t-footnote` `ink-2`. Segmen terpilih: ketebalan 20, dan segmen lain opacity .35. Animasi masuk: sapuan 0→360° selama 500 ms `cubic-bezier(.2,.8,.2,1)` hanya saat pertama tampil. Kosong: ring `line`.
- **Bar tren 6 periode**: tinggi area 140. Setiap periode berisi pasangan bar 8 px dengan gap 3 px, sudut atas radius 3. Pengeluaran `ink` (periode berjalan) / `ink-3` (lainnya). Pemasukan `accent` (berjalan) / `accent` opacity .4. Tanpa gridline. Hanya baseline hairline `line`. Label bulan `--t-caption` `ink-2` ("Jun"…"Nov"). Nilai maksimum ditandai satu label singkat di kiri atas (`1,2jt`). Tap area kolom (lebar penuh 1/6) memilih periode.
- **Bar proporsi di daftar kategori**: 3 px, warna kategori, track tanpa warna.
- Semua label nominal di chart memakai `formatIDRShort`. Tidak ada legenda terpisah. Daftar kategori adalah legendanya.
- Aksesibilitas: `role="img"` + `aria-label` ringkasan ("Pengeluaran November: Makan 42%, Transportasi 21%, …").

## 8. Motion

| Token | Durasi | Easing | Pemakaian |
|---|---|---|---|
| `--m-instant` | 80 ms | `ease-out` | Tekan tombol, digit |
| `--m-quick` | 160 ms | `cubic-bezier(.2,.8,.2,1)` | Fade, toast keluar, state tekan |
| `--m-base` | 220 ms | `cubic-bezier(.2,.8,.2,1)` | Segmented, chip, highlight |
| `--m-sheet` | 380 ms | `cubic-bezier(.32,.72,0,1)` | Sheet buka, push layar |
| `--m-chart` | 500 ms | `cubic-bezier(.2,.8,.2,1)` | Masuk chart |

- Push/pop layar: layar baru `translateX(100%)→0`, layar lama `translateX(-25%)` + redup, `--m-sheet`. Ganti tab: tanpa animasi (seperti iOS).
- Yang dianimasikan hanya `transform` dan `opacity`.
- Cold start dengan `openToAdd`: sheet tampil langsung tanpa animasi.
- **`prefers-reduced-motion: reduce`**: semua translate/scale/sapuan dimatikan dan diganti fade ≤ 120 ms. Highlight baris baru tetap ada tanpa transisi (cukup latar statis 1,2 dtk).
- Haptic (trik switch iOS 17.4+) hanya dipakai saat simpan dan hapus, sebagai bonus yang tidak boleh diandalkan.

## 9. Nada teks (copy)

- Bahasa Indonesia santai-sopan, pendek, tanpa "Anda" berlebihan, dan tanpa tanda seru. Contoh: "Tersimpan", "Urungkan", "Belum ada transaksi", "Sisa Rp 150.000", "Lebih Rp 120.000".
- Kata kerja di tombol: "Simpan", "Buat backup", "Pulihkan", "Ganti data", "Hapus".
- Angka selalu diformat (§5.10 PRD), tidak pernah "25000".

## 10. Ikon app & identitas

- **Nama**: Arus. **Logo-mark**: dua garis arus horizontal sejajar, sedikit bergelombang (sinus satu periode). Garis atas sedikit lebih panjang dan naik ke kanan. Stroke tebal 2.25 (pada 24 viewBox) dengan ujung membulat.
- **Ikon Home Screen** (180/192/512 PNG opak): latar `#0F1513` (tinta kehijauan), mark berwarna `#4CC3AE`, berukuran 52% kanvas, ditengahkan secara optik. Tanpa teks dan tanpa gradien. Sediakan juga `icon.svg` untuk manifest (iOS 26+).
- Wordmark (jika perlu, mis. layar kunci/Tentang): "Arus" dengan SF Pro Rounded 600, tracking −0.02em.

## 11. Checklist implementasi desain
- [ ] `src/styles/tokens.css` berisi semua token di atas (warna light/dark, tipografi, spasi, radius, elevasi, motion) sebagai custom properties.
- [ ] Tidak ada hex di luar `tokens.css` (lint grep di CI: `#[0-9a-fA-F]{3,8}` di `src/**/*.tsx|css` selain tokens).
- [ ] Utility `.num { font-variant-numeric: tabular-nums }` dipakai di semua nominal.
- [ ] Semua ikon lewat `<Icon>`, dengan stroke 1.5 yang seragam.
- [ ] Uji kontras token teks di kedua tema (≥ 4.5:1 untuk `ink`, `ink-2`, `accent` di atas `bg`/`surface`).
- [ ] Uji di iPhone dengan lebar 375 (SE/mini), 390, dan 430 px, dalam kedua tema dan ketiga ukuran teks.
