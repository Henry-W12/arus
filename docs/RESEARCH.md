# Riset Produk: Money Tracker Pribadi

Tanggal: 20 Nov 2026. Sumbernya halaman App Store, review agregator (Justuseapp, Capterra, Trustpilot), dan blog review. Banyak blog review ditulis oleh pembuat aplikasi pesaing, jadi anggap bias. Harga berbeda per negara dan sering berubah. Angka bertanda **(?)** saling bertentangan antarsumber atau belum terverifikasi.

Target pengguna: satu orang, iPhone, Rupiah, PWA offline, tanpa login dan tanpa bank sync.

## 1. Perbandingan aplikasi

| Aplikasi | Fitur inti | Harga | Kekuatan | Kelemahan / keluhan |
|---|---|---|---|---|
| **Monefy** | Input manual dengan layar kalkulator + grid kategori, grafik donat | Gratis + Pro (harga ?) | Input tercepat: cukup nominal + 1 tap kategori; sering dipuji karena simpel | Manual saja; laporan dan anggaran dangkal |
| **Money Manager (Realbyte)** | Double-entry, banyak akun, transfer, kalender, passcode, backup | iOS: berbayar ~$5.99 versi tanpa iklan; sync $19.99/th (?) | Lengkap, rating iOS tinggi (~4.8), sangat populer di Asia | Tidak intuitif, harus belajar dulu, alur backup/restore membingungkan, iklan di versi gratis, font kecil |
| **Money Lover** | Dompet, anggaran, tagihan, wallet bersama | Freemium; Premium lifetime ~$20 / €23 | Populer di Indonesia/Asia Tenggara, fitur lengkap | Sync wallet bersama tidak andal, keluhan paywall + langganan, bagian anggaran dinilai "tidak terpakai", support lambat |
| **Wallet (BudgetBakers)** | Multi-mata uang, bank sync, investasi, anggaran | Premium ~$5.99/bln; lifetime $20–49 (?) | Multi-currency kuat, rating 4.6 | Bank sync sering putus, tidak bisa ganti mata uang dasar, salah hitung saldo, dinilai mahal, support 2–3 minggu |
| **Spendee** | Dompet, anggaran, wallet bersama, bank sync | Premium ~$22.99–35.99/th (?) | Visual bersih, murah dibanding YNAB | Bank sync gagal, ada learning curve, perubahan harga promo membuat kesal |
| **YNAB** | Zero-based budgeting ("beri tiap rupiah tugas") | $14.99/bln atau $109/th | Metodologi kuat, loyalitas pengguna tinggi | Learning curve berminggu-minggu, mahal, kenaikan harga mendadak (2021) |
| **Copilot Money** | Kategorisasi AI, bank sync, khusus Apple | ~$95–109/th (?) | Desain iOS terbaik di kelasnya, integrasi Apple | Hanya ada di AS, mahal, koneksi bank (Plaid) bermasalah, tidak ada envelope budgeting |
| **Toshl** | Gaya visual berkarakter, anggaran, tagihan berulang | Gratis (2 akun/2 anggaran), Pro ~€19.5/th, Medici ~$40/th | Free tier jelas, desain unik | Free tier sangat dibatasi, bank sync tergantung region, perlu waktu membiasakan diri dengan UI baru |
| **Bluecoins** | Double-entry, laporan detail, offline, backup ke cloud pribadi | Gratis + iklan; Premium sekali bayar (~$8–18 ?) | Offline, data di perangkat, **tanpa langganan** | Rating iOS rendah (~3.7, sedikit review), Premium tidak ikut pindah Android→iOS, batasan kategori |
| **Finku** (lokal) | Input via AI, Shortcuts, scan struk, upload mutasi PDF, target tabungan | Premium ~Rp15rb; gratis sampai Mar 2027 | Konteks Indonesia, banyak cara input, rating 4.6 | Label privasi mencantumkan pelacakan lintas aplikasi; perlu akun/cloud |

Catatan: aplikasi lokal lain (Catatan Keuangan, Dompetku, Money+) muncul di daftar blog Indonesia, tetapi saya tidak menemukan cukup data untuk menilainya.

## 2. Fitur wajib vs pembeda

**Wajib (table stakes)**
- Catat pengeluaran/pemasukan: nominal, kategori, tanggal, catatan opsional
- Beberapa akun/dompet (Tunai, Bank, e-wallet) + transfer antarakun
- Ringkasan bulanan + grafik per kategori
- Kategori yang bisa diedit (nama, ikon, warna)
- Edit/hapus transaksi, riwayat yang bisa dicari
- Backup/ekspor (CSV) dan kunci aplikasi

**Pembeda yang paling dihargai**
- **Kecepatan input** (alasan utama Monefy disukai)
- **Tanpa langganan / sekali bayar / data lokal** (Bluecoins, keluhan di Wallet/Money Lover/YNAB)
- Desain yang benar-benar bagus (Copilot)
- Anggaran per kategori dengan sisa yang terlihat jelas
- Transaksi berulang/tagihan
- Input alternatif: Shortcuts/Siri, scan struk (Finku)

## 3. Pola UX input cepat (terpenting)

Prinsip yang berulang di diskusi pengguna: **mencatat harus lebih cepat daripada membayar**. Pola umumnya: semangat di minggu pertama, kendur di minggu kedua, berhenti di akhir bulan pertama, biasanya karena setiap entri terasa seperti "mengisi formulir pajak mini" (kategori, subkategori, tag, catatan).

Pola yang direkomendasikan:
1. **Buka aplikasi = langsung layar input.** Tombol "+" besar di bawah (zona jempol), atau mode "buka langsung ke keypad".
2. **Target 2–3 tap**: ketik nominal, tap kategori, selesai (simpan otomatis). Tanggal default hari ini, akun default yang terakhir dipakai, catatan opsional.
3. **Keypad kustom**, bukan keyboard iOS: tombol `000` (penting untuk Rupiah), backspace, operator `+ −` untuk menjumlah struk, format `Rp 25.000` langsung saat diketik. Tanpa desimal.
4. **Grid kategori 8–12 ikon** di satu layar tanpa scroll, diurutkan berdasarkan frekuensi pemakaian. Pilih kategori sebelum atau sesudah nominal (Monefy memulai dari kategori).
5. **Saran cerdas**: kategori/catatan terakhir, template "favorit" (contoh: "Kopi 25rb", "Parkir 5rb") untuk satu tap.
6. **Toggle Pengeluaran/Pemasukan** berupa segmented control di atas, default Pengeluaran.
7. **Undo lewat snackbar** setelah simpan, bukan dialog konfirmasi.
8. **Pintasan iOS**: PWA tidak bisa membuat widget, tetapi bisa memakai URL `?add=1` (dibuka dari ikon Home Screen atau Shortcuts) dan haptic/animasi singkat sebagai umpan balik.
9. Detail lanjutan (tanggal lain, akun lain, catatan, foto) dilipat di baris "Detail", tidak pernah wajib.

## 4. Kategori default (Indonesia)

**Pengeluaran** (urutan sesuai perkiraan frekuensi):
1. Makan & Minum (warteg, kopi, GoFood)
2. Transportasi (bensin, ojol, parkir, tol, KRL)
3. Belanja Harian (minimarket, pasar)
4. Tagihan & Utilitas (listrik/token PLN, air, internet, pulsa/paket data)
5. Tempat Tinggal (kos/sewa/KPR)
6. Belanja (fashion, elektronik, marketplace)
7. Hiburan & Langganan (streaming, game, nongkrong)
8. Kesehatan (obat, dokter, BPJS)
9. Keluarga & Sosial (kirim ke orang tua, kondangan, arisan)
10. Sedekah & Zakat
11. Pendidikan & Pengembangan Diri
12. Lainnya

**Pemasukan**: Gaji, Bonus/THR, Usaha/Freelance, Investasi/Bunga, Hadiah/Angpao, Lainnya.

**Akun default**: Tunai, Rekening Bank, E-Wallet (GoPay/OVO/DANA/ShopeePay, nama bisa diedit).

## 5. Anti-pattern yang harus dihindari

- **Formulir panjang** dengan field wajib (subkategori, tag, catatan)
- **Paywall untuk fitur dasar** atau batas akun/anggaran yang sempit (Toshl, Money Lover)
- **Iklan** di layar input
- **Backup/restore yang membingungkan** (Money Manager). Ekspor dan impor harus 1 tombol dan jelas
- **Saldo yang salah hitung** atau mata uang dasar yang tidak bisa diubah (Wallet). Saldo harus dihitung dari transaksi dan bisa diaudit
- **Learning curve metodologi** (YNAB). Jangan paksakan sistem budgeting
- **Kehilangan data** saat ganti perangkat. Untuk PWA di iOS ini risiko nyata: Safari bisa menghapus storage situs yang tidak dipakai, dan data PWA terpisah dari Safari
- **Font kecil** atau UI padat yang tidak bisa diatur
- Sync dan bank feed yang tidak andal. Ini memang tidak dibuat, jadi tidak perlu dijanjikan

## 6. Rekomendasi MVP (PWA offline, single-user)

**P0 (wajib untuk rilis pertama)**
- Layar input cepat: keypad kustom (`000`, backspace), format Rupiah, grid kategori, simpan dalam 2–3 tap, undo
- Toggle pengeluaran/pemasukan, tanggal default hari ini (bisa diubah)
- Kategori default Indonesia (bagian 4), bisa ditambah/diedit/diurutkan
- Daftar transaksi per hari dengan total harian; edit dan hapus
- Ringkasan bulan berjalan: pemasukan, pengeluaran, selisih, donat per kategori
- Penyimpanan IndexedDB + `navigator.storage.persist()`, service worker offline, bisa dipasang ke Home Screen
- **Ekspor/impor JSON + ekspor CSV** sebagai backup manual, dengan pengingat backup berkala

**P1 (segera setelah MVP)**
- Beberapa akun + transfer, saldo per akun
- Anggaran bulanan per kategori (progress bar, sisa per hari)
- Template/favorit satu tap dan saran berdasarkan riwayat
- Pencarian dan filter (kategori, rentang tanggal, nominal)
- Transaksi berulang (kos, langganan, cicilan)
- Navigasi antarbulan dan tren 6 bulan
- Mode gelap, ukuran teks yang bisa diatur
- PIN opsional (PWA tidak bisa memakai Face ID secara native, kecuali lewat WebAuthn, yang perlu diuji)

**P2 (nanti / opsional)**
- Target tabungan (dana darurat, liburan)
- Kalkulator `+ −` di keypad dan split transaksi
- Foto struk (disimpan lokal, perhatikan kuota storage)
- Deep link untuk iOS Shortcuts (`/add?amount=25000&cat=makan`)
- Insight sederhana ("pengeluaran makan naik 20% dari bulan lalu")
- Backup otomatis ke file/iCloud Drive lewat Share Sheet

**Prioritas desain**: kecepatan input dan kepercayaan pada data (saldo akurat, backup jelas) lebih penting daripada banyaknya fitur. Ukuran keberhasilan: transaksi tercatat dalam waktu kurang dari 5 detik sejak aplikasi dibuka.

## Sumber utama
- App Store: Monefy, Finku, Money Lover, Wallet, Bluecoins, Toshl, Money Manager, Copilot
- Justuseapp (Money Lover, Wallet), Capterra/Makerstack (Spendee), Finder UK & Trustpilot (Wallet), CHOICE (Toshl, Money Manager)
- Penny Hoarder (Copilot), Pocketclear/Fortune (YNAB, bias pesaing), bluecoinsapp.com (FAQ)
- Diskusi Product Hunt / DEV.to soal friksi input manual (anekdotal)
