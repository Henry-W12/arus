# QA Report — Arus v1 (fase 4)

Tanggal uji: 20–21 Nov 2026. Penguji: QA otomatis (Playwright) + eksplorasi via skrip. Build: produksi (`vite build` + `vite preview`).

## Ringkasan

- **Lingkungan**: Playwright 1.65 WebKit, iPhone 390×844 @3x (`isMobile`, `hasTouch`), iPhone SE 375×667, locale `id-ID`, `timezoneId: Asia/Jakarta`. Jam dipalsukan (`page.clock`) ke **Jum 20 Nov 2026 10:00 WIB** kecuali tes tanggal. Offline/SW diuji di Chromium karena WebKit Playwright di Windows tidak menjalankan service worker.
- **Suite e2e**: 97 tes di `e2e/` (`npm run e2e`). Hasil run penuh terakhir: **89 lulus, 8 gagal**. Tujuh kegagalan sengaja dibiarkan karena bug aplikasi (BUG-01 ×3, BUG-02 ×2, BUG-04, BUG-05). Satu kegagalan adalah AC-IN-01 yang flaky saat dijalankan paralel (lihat catatan di tabel). Unit test vitest: 144/144 lulus.
- **Acceptance criteria** (96): **83 lulus, 2 gagal, 5 lulus sebagian, 6 tidak dapat diuji lewat e2e** (3 di antaranya sudah ditutup unit test vitest).
- **Bug**: **1 Kritis, 1 Tinggi, 4 Sedang, 7 Rendah**.
- Temuan paling serius: setelah toast "Tersimpan" hilang sendiri, elemennya tetap ada dan menangkap tap. Tap tombol ⌫ di sheet berikutnya ternyata menekan "Urungkan" yang tak terlihat, sehingga transaksi terakhir **terhapus diam-diam** (BUG-02).
- Bug yang dicurigai sebelumnya **terkonfirmasi**: Ringkasan, Anggaran, dan Tren menghitung transaksi Terjadwal, sedangkan header "Bulan ini" tidak (BUG-01). Dengan data demo, selisihnya tepat Rp 1.250.000 (premi asuransi terjadwal 26 Nov).

Cara menjalankan:
```
npm run e2e                                   # semua project (build + vite preview otomatis)
npx playwright test --project=iphone          # 390×844 saja
npx playwright test e2e/explore.spec.ts       # eksplorasi + screenshot qa-*
```

## Tabel acceptance criteria

L = lulus, G = gagal, S = lulus sebagian, T = tidak dapat diuji (e2e).

| AC | Status | Tes / catatan |
|---|---|---|
| AC-IN-01 | L | `input.spec` · goto → sheet terlihat ±1,0 dtk (WebKit desktop, terisolasi). Saat 2 worker paralel kadang > 1,5 dtk, jadi angka ini bukan ukuran iPhone. Mode Keluar, akun terakhir, dan "Hari ini" sesuai. |
| AC-IN-02 | L | 4 tap (2, 5, 000, kategori), toast Urungkan, baris teratas "Hari ini" |
| AC-IN-03 | L | Urungkan menghapus transaksi dan saldo kembali |
| AC-IN-04 | L | |
| AC-IN-05 | L | 12 digit, `000` hanya menambah 2 digit |
| AC-IN-06 | L | tekan lama ⌫ 700 ms |
| AC-IN-07 | L | |
| AC-IN-08 | L | "Rp 1.250.000", tanpa desimal |
| AC-IN-09 | L | |
| AC-IN-10 | L | 05:30 WIB → 2026-11-20 |
| AC-IN-11 | L | favorit 1 tap |
| AC-IN-12 | L | |
| AC-IN-13 | S | Font input catatan ≥ 16 px: lulus. Posisi Simpan di atas keyboard virtual tidak bisa diuji di Playwright. |
| AC-IN-14 | L | `small.spec` 375×667: grid 4×2, keypad, dan nominal tanpa scroll |
| AC-IN-15 | L | |
| AC-LS-01 | L | |
| AC-LS-02 | L | transfer & penyesuaian diabaikan |
| AC-LS-03 | L | swipe → Hapus → Urungkan mengembalikan id yang sama |
| AC-LS-04 | L | createdAt tetap, updatedAt berubah |
| AC-LS-05 | L | |
| AC-LS-06 | L | |
| AC-LS-07 | S | Diuji dengan 1.406 transaksi (bukan 5.000): tab tampil 772 ms, 250 baris DOM awal. Frame terburuk saat scroll 140 ms ketika halaman berikutnya dimuat (rata-rata 20 ms). Ini WebKit desktop, bukan iPhone. |
| AC-SM-01 | L | Lulus untuk skenario AC. Jika ada transaksi terjadwal di periode berjalan → BUG-01. |
| AC-SM-02 | L | 67/33, tap segmen → teks tengah + highlight, tap baris → `/cari` terfilter |
| AC-SM-03 | L | 6 + "Lainnya" |
| AC-SM-04 | L | ›/‹, batas transaksi pertama, "—". Lihat BUG-05 untuk delta Selisih. |
| AC-SM-05 | L | 6 bar, tap bar → pindah periode |
| AC-SM-06 | L | |
| AC-AC-01 | T | Fungsi murni; ditutup unit test `balances.test.ts` (12 kasus, lulus). Konsistensi saldo juga dicek e2e. |
| AC-AC-02 | L | transfer lewat UI |
| AC-AC-03 | L | |
| AC-AC-04 | L | adjustment −12.500, ringkasan tidak berubah; tombol nonaktif bila selisih 0 |
| AC-AC-05 | L | hanya "Arsipkan", hilang dari pemilih & total, riwayat tetap |
| AC-AC-06 | S | Nama duplikat ditolak: lulus. Akun terakhir tidak bisa diarsipkan: tidak diuji e2e (ada di kode `AccountSheet` `lastActive`). |
| AC-AC-07 | L | termasuk "Saldo setelah terjadwal" |
| AC-AC-08 | L | |
| AC-BG-01 | L | 85% warning, "Sisa Rp 150.000" |
| AC-BG-02 | L | |
| AC-BG-03 | L | "≈ Rp 13.000/hari untuk 11 hari lagi" |
| AC-BG-04 | L | |
| AC-BG-05 | L | record `amount=0` mulai Nov |
| AC-BG-06 | L | |
| AC-BG-07 | L | Transfer & income tidak dihitung. Lihat BUG-01: transaksi terjadwal ikut terhitung. |
| AC-PR-01 | L | tidak langsung: tautan Ringkasan → `/cari?from=2026-11-01&to=2026-11-30`; unit test `period.test.ts` |
| AC-PR-02 | L | S=25 pada 26 Nov → "Desember 2026" (25 Nov–24 Des), ‹ → November |
| AC-PR-03 | T | Fungsi murni; unit test `period.test.ts` lulus |
| AC-PR-04 | L | data transaksi tidak berubah |
| AC-PR-05 | L | pemilih tidak menawarkan 29–31 |
| AC-RC-01 | L | 31 Jan, 28 Feb, 31 Mar, 30 Apr 2027 |
| AC-RC-02 | L | Jam dilompatkan 31 Okt → 3 Des: 2 transaksi + banner "2 transaksi berulang dicatat" |
| AC-RC-03 | L | reload + `visibilitychange` → tanpa duplikat |
| AC-RC-04 | L | |
| AC-RC-05 | L | |
| AC-RC-06 | L | 2, 16, 30 Nov |
| AC-RC-07 | L | chip Ulangi → 1 transaksi + `generatedCount=1` |
| AC-RC-08 | L | 400 per run, 731 setelah run kedua. Catatan: reload + generate 400 ≈ 6,6 dtk (BUG-12). |
| AC-RC-09 | L | "Catat yang terlewat (3)" & "Lewati" |
| AC-RC-10 | L | |
| AC-SR-01 | L | "kopi" ↔ "KOPI"; "cafe" ↔ "café" |
| AC-SR-02 | L | |
| AC-SR-03 | L | "2 transaksi · −Rp 600.000" |
| AC-SR-04 | L | |
| AC-SR-05 | L | batas inklusif |
| AC-SR-06 | L | |
| AC-CT-01 | L | Grid sudah penuh 12 sel, jadi kategori baru hanya muncul lewat "Lainnya…" (sesuai PRD §3.2) |
| AC-CT-02 | L | Diuji dengan keyboard (panah). Drag sentuh tidak diuji. |
| AC-CT-03 | L | |
| AC-CT-04 | L | |
| AC-CT-05 | L | |
| AC-BK-01 | S | Share sheet iOS asli tidak bisa diuji. `navigator.share` di-stub: resolve → `lastBackupAt` terbarui, AbortError → tidak. Nama file `arus-backup-2026-11-20.json`. |
| AC-BK-02 | L | Backup → Hapus semua (HAPUS) → restore: 7 tabel deep-equal (kecuali setting perangkat) |
| AC-BK-03 | L | JSON rusak, bukan Arus, referensi akun salah → ditolak, data utuh |
| AC-BK-04 | L | "5 transaksi … Semua data saat ini (0 transaksi) akan diganti" |
| AC-BK-05 | T | Tidak bisa disuntik di build produksi; unit test `backup.test.ts` lulus |
| AC-BK-06 | L | schemaVersion 99 → "Perbarui app" |
| AC-BK-07 | L | BOM, CRLF, header kolom, quoting koma/kutip/baris baru, "é —", tanda negatif |
| AC-BK-08 | L | |
| AC-BK-09 | L | Seed ulang 18 kategori. Lihat BUG-11 (huruf kecil diterima). |
| AC-BK-10 | L | hash PIN tidak ada di file |
| AC-PW-01 | L | Chromium: SW aktif → offline → reload, deep link `/ringkasan`, `/?add=1`, simpan transaksi |
| AC-PW-02 | L | status & pemakaian tampil, `persistGranted` tersimpan |
| AC-PW-03 | T | butuh dua deploy berbeda |
| AC-PW-04 | L | banner tampil di tab browser, bisa ditutup |
| AC-PW-05 | T | safe-area/notch/bounce perlu iPhone asli |
| AC-PW-06 | T | QuotaExceededError tidak bisa dipicu andal di build produksi |
| AC-UI-01 | L | Sistem live, Terang/Gelap memaksa, warna body ikut |
| AC-UI-02 | L | 375 px + "Lebih besar": tanpa overflow horizontal di 6 layar |
| AC-UI-03 | **G** | target < 44 px (BUG-06), kontras `ink-3` pada teks informatif (BUG-10) |
| AC-UI-04 | L | sheet hanya transisi opacity 0,12 dtk |
| AC-UI-05 | **G** | `font-variant-numeric` terhitung `normal` pada nominal (BUG-04) |
| AC-UI-06 | S | Semua tombol punya nama (0 tanpa label di 7 layar). Segmen donat & bar tren tidak bisa difokus/dioperasikan keyboard/VoiceOver. VoiceOver asli tidak diuji. |
| AC-PN-01 | L | konten tidak ada di DOM saat terkunci |
| AC-PN-02 | L | `visibilityState` disimulasikan + jam: 30 dtk tidak terkunci, 70 dtk terkunci |
| AC-PN-03 | L | 5× salah → 30 dtk, bertahan setelah reload |
| AC-PN-04 | L | hanya `{hash, salt, iterations}`, disclaimer tampil |
| AC-PN-05 | L | |

## Bug (urut keparahan)

### Kritis

**BUG-02 · Toast yang sudah hilang tetap menangkap tap → "Urungkan" tak terlihat menghapus transaksi**
- Langkah: catat transaksi (mis. 1.000 Makan) → toast "Tersimpan · Urungkan" muncul → tunggu > 5 dtk sampai toast hilang → tap + → tap ⌫ (atau 0/000) di baris bawah keypad.
- Diharapkan: ⌫ menghapus digit. Toast sudah tidak ada di DOM.
- Aktual: elemen `.ui-toast.is-leaving` tetap ada (opacity 0, `pointer-events: auto`) di atas baris bawah keypad, dan tidak pernah di-unmount. Tap di posisi ⌫ mengenai tombol "Urungkan" → transaksi tadi **terhapus tanpa umpan balik** (jumlah transaksi 1 → 0). Di layar Transaksi, toast tak terlihat yang sama menutupi area tepat di atas FAB/tab bar, jadi tap baris daftar di area itu juga bisa memicu Urungkan aksi terakhir (termasuk "Urungkan hapus/edit").
- Sebab (dari kode): `src/ui/Toast.tsx` baris 53–79. `dismiss()` menyimpan timer unmount 160 ms ke `timer.current`. Lalu efek `[item, leaving]` dijalankan ulang (karena `leaving` berubah), dan cleanup-nya `clearTimeout(timer.current)` membatalkan timer unmount itu. Akibatnya `setItem(null)` tidak pernah dipanggil.
- Tes: `e2e/input.spec.ts` "BUG-02 · …" dan `e2e/recurring.spec.ts` "Simpan transaksi pukul 23:59:59…" (gagal karena tap keypad tertutup toast).

### Tinggi

**BUG-01 · Transaksi Terjadwal (tanggal > hari ini) ikut dihitung di Ringkasan, Anggaran, dan Tren, tetapi tidak di header "Bulan ini"**
- Langkah: pada 20 Nov, catat pengeluaran 100.000 (10 Nov) dan pengeluaran Terjadwal 1.250.000 (26 Nov) → lihat header Transaksi lalu tab Ringkasan dan Anggaran.
- Diharapkan: angka "Pengeluaran" bulan ini sama di semua layar. PRD §3.1/§5.1 menyatakan transaksi terjadwal belum berlaku sebelum tanggalnya. Minimal harus konsisten, atau Ringkasan diberi label "termasuk terjadwal".
- Aktual: header "Bulan ini −Rp 100.000"; Ringkasan Pengeluaran Rp 1.350.000. Data demo: header Rp 6.437.191 vs Ringkasan Rp 7.687.191 (selisih tepat Rp 1.250.000). Anggaran Makan: pengeluaran terjadwal 400.000 (28 Nov) membuat "Sisa Rp 500.000", bukan 900.000. Sisa per hari dan status warning/lebih ikut terpengaruh.
- Dicurigai: `src/lib/hooks.ts` `usePeriodSummary` (baris ±228, filter tanpa `date <= today`; `periodTrend` di baris 244 juga), `useBudgetOverview` → `src/lib/budget.ts` `budgetOverview`. Sebagai pembanding, `src/screens/Transactions.tsx` memfilter `t.date <= today`. Hasil Cari dengan filter "Bulan ini" juga menjumlah transaksi terjadwal; ini wajar untuk pencarian, tetapi perlu diputuskan.
- Catatan PRD: §5.1 kalimat pertama ("Σ dalam rentang periode") ambigu. Keputusan produk perlu ditulis di PRD.
- Tes: `money.spec.ts` "BUG-01 · …" (2 tes), `explore.spec.ts` "BUG-01 dengan data demo". Screenshot: `docs/screens/qa-transactions-light.png` vs `qa-summary-light.png`.

### Sedang

**BUG-03 · Tombol back browser saat sub-sheet terbuka meninggalkan sub-sheet yatim**
- Langkah: tap baris transaksi (sheet edit) → tap chip tanggal (sheet "Tanggal") → back browser / gestur back.
- Diharapkan: yang tertutup hanya sub-sheet, atau kedua sheet tertutup dengan rapi.
- Aktual: URL kembali ke `/` dan sheet edit tertutup, tetapi sheet "Tanggal" tetap terbuka di atas daftar tanpa induk. Memilih tanggal di situ tidak berdampak apa-apa. Back kedua keluar dari app.
- Dicurigai: `src/screens/TxSheet.tsx` (state `sub` baris 142 tidak di-reset saat `open` menjadi false; sub-sheet dirender dengan `open={sub === 'date'}`). Di iPhone standalone tidak ada tombol back, jadi dampaknya terbatas pada Safari tab, Android, dan desktop.
- Screenshot: `docs/screens/qa-back-orphan-datepicker.png`.

**BUG-04 · `tabular-nums` hilang pada nominal (AC-UI-05)**
- Aktual: computed `font-variant-numeric` = `normal` pada nominal baris daftar dan total saldo (WebKit).
- Sebab (kemungkinan besar): `src/styles/components.css` baris 412–416. `.ui-amount--body/title/amount-l/hero/inherit { font: … }` memakai shorthand `font`, yang me-reset `font-variant-numeric` yang dipasang `.ui-amount` (baris 410). Hal yang sama mungkin berlaku untuk `.num` yang dikombinasikan dengan aturan `font:` lain.
- Tes: `misc.spec.ts` "AC-UI-05".

**BUG-05 · Delta % "Selisih" terbalik bila periode sebelumnya negatif**
- Langkah: Okt pengeluaran 200rb (selisih −200rb), Nov pengeluaran 100rb (selisih −100rb) → Ringkasan Nov.
- Diharapkan: perbaikan (defisit mengecil) tampil sebagai ▲ / warna baik.
- Aktual: "▼ 50%" berwarna `negative` (is-bad).
- Dicurigai: `src/lib/summary.ts` `deltaRatio` (baris 81) membagi dengan `previous` yang negatif. Pakai `Math.abs(previous)`.
- Tes: `money.spec.ts` "BUG-05".

**BUG-06 · Target sentuh < 44 px (AC-UI-03)**
- Segmented control (Ringkasan Pengeluaran/Pemasukan, Tema, Ukuran teks) 28 px tinggi. Chip filter & saran di Cari 32 px. Tombol "Transfer" di Akun 40 px. "Urutkan" 42 px.
- Hasil ukur: `explore.spec.ts` "aksesibilitas dasar". DESIGN.md §4 menetapkan minimal 44×44. Area sentuh bisa diperbesar tanpa mengubah tampilan (padding/pseudo-element).

### Rendah

**BUG-07 · Angka Ringkasan terpotong untuk nominal besar.** Pemasukan/Pengeluaran 12 digit tampil "Rp 999.999.9…" (ellipsis, tanpa auto-shrink). Dicurigai `.s-stats__value` di `src/styles/screens.css`. Screenshot `docs/screens/qa-summary-max-amount.png`. Layar lain (daftar, total saldo, akun, sheet input) menampilkan Rp 999.999.999.999 utuh.

**BUG-08 · Kilasan nilai salah saat memuat.** Header menampilkan "Total saldo Rp 0" dan "Bulan ini Rp 0" sebelum data siap (`src/screens/Transactions.tsx` baris 99, `bal?.total ?? 0`). Ringkasan sempat kosong total (hanya judul). Untuk app keuangan, "Rp 0" sesaat bisa membuat pengguna kaget. Lebih baik placeholder/skeleton. Terlihat saat screenshot diambil sebelum data selesai dimuat.

**BUG-09 · FAB menutupi konten paling bawah** saat belum di-scroll: nominal baris di daftar Transaksi, bar periode berjalan di Tren, dan nilai Anggaran (`qa-transactions-light.png`, `qa-budgets-light.png`, `qa-summary-max-amount.png`). Tidak pasti apakah ruang scroll bawah sudah cukup untuk membebaskan baris terakhir. Perlu dicek di iPhone.

**BUG-10 · Kontras `ink-3` dipakai untuk informasi.** `ink-3` = 2,35:1 (light, di `bg`) / 2,59:1 (di `surface`). Dipakai untuk saldo berjalan "Saldo Rp …" di Detail akun (`.ui-row__trail-sub`, informasi audit) dan "vs bln lalu"/"—". DESIGN.md menyatakan `ink-3` bukan untuk informasi penting. Kontras teks utama/sekunder lulus: ink-2 5,24–5,77 (light), 6,6–7,9 (dark).

**BUG-11 · Konfirmasi "Hapus semua data" menerima `hapus` (huruf kecil).** `src/screens/shared.tsx` baris 808 (`toUpperCase()`). PRD meminta ketik `HAPUS`. Mungkin disengaja (autoCapitalize), tetapi melemahkan friksi pada aksi destruktif.

**BUG-12 · Generator berulang besar lambat (tidak pasti).** Reload + 400 kejadian ≈ 6,6 dtk (reload biasa ≈ 1 dtk) di WebKit desktop. App tetap jalan, tetapi di iPhone lama bisa terasa beku. Perlu diukur di perangkat.

**BUG-13 · Landscape / viewport pendek (tidak pasti).** Pada 844×390, `/?sheet=add` tidak memperlihatkan keypad utuh dan sheet tidak tampak di screenshot (`qa-landscape-input.png`). Manifest `orientation: portrait`, tetapi iOS tidak selalu mengunci orientasi web app. Prioritas rendah.

### Observasi lain (bukan bug / perlu keputusan)
- Lebar 320 px dan nama kategori 24 karakter: tidak ada overflow horizontal. Label kategori panjang di-ellipsis rapi (`qa-transactions-long-note.png`, `qa-summary-long-category.png`).
- Catatan dengan emoji dipotong di 120 unit UTF-16, tidak memotong surrogate pair pada kasus uji. Nominal 0: tombol Simpan nonaktif. Digit ke-13 ditolak.
- Double-tap kategori dan double-tap Simpan: **tidak** menghasilkan duplikat.
- 29 Feb 2028: input tersimpan 2028-02-29. Aturan tahunan → 28 Feb 2029. Pergantian 23:59 → 00:00 saat app terbuka: label "Hari ini" bergeser dan kejadian berulang 1 Des dibuat tanpa reload (`page.clock.fastForward`).
- Console: tidak ada error di 14 route (hanya peringatan "Service Worker registration blocked" dari Playwright).
- Fokus keyboard terperangkap di sheet input. Setelah sheet ditutup dengan Escape, `activeElement` sesaat masih tombol keypad di sheet yang sedang keluar. Tidak pasti apakah fokus kembali ke FAB setelah animasi.
- Ringkasan dengan hanya transfer menampilkan statistik Rp 0 (bukan state kosong penuh). Masih sesuai PRD.

## Review visual (screenshot)

`docs/screens/qa-*.png` (WebKit 390×844, dikecilkan ke 585 px lebar, palet 256 warna):
- Layar utama light/dark dengan data demo: `qa-{transactions,summary,budgets,accounts,account-detail,search,input,settings,data}-{light,dark}.png`. Tidak ditemukan teks terpotong, tumpang tindih, atau warna di luar token, selain BUG-07/09. Dark mode konsisten dengan DESIGN.md §2 (hitam `#0B0C0D`, tanpa bayangan).
- Nilai ekstrem: `qa-input-max-amount.png`, `qa-transactions-max-amount.png`, `qa-summary-max-amount.png` (BUG-07), `qa-accounts-max-amount.png`.
- Teks panjang: `qa-input-long-note.png`, `qa-transactions-long-note.png`, `qa-summary-long-category.png`.
- Navigasi: `qa-back-orphan-datepicker.png` (BUG-03). Viewport: `qa-landscape-input.png`, `qa-w320-input.png`.

## Batasan pengujian
- WebKit Playwright di Windows ≠ Safari iOS: tidak ada keyboard virtual, safe-area, share sheet, haptic, mode standalone, atau SW. Angka performa diukur di PC, bukan iPhone.
- Data uji ditulis langsung ke IndexedDB (`e2e/helpers.ts`) karena `scripts/demo-seed.ts` hanya tersedia lewat dev server.
- Uji wajib di iPhone asli sebelum rilis: AC-PW-03/05, AC-IN-13 (keyboard), swipe/drag sentuh, VoiceOver, share sheet backup, dan performa 5.000 transaksi.
