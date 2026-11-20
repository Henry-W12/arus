# PRD — Arus v1

Aplikasi pencatat keuangan pribadi. Berupa PWA untuk iPhone, single-user, offline, data di perangkat (IndexedDB via Dexie), Rupiah saja, tanpa backend dan tanpa login.
Stack: Vite + React 19 + TypeScript + Dexie 4 (`dexie-react-hooks`/`useLiveQuery`) + vite-plugin-pwa. Hosting: Cloudflare Pages. Desain visual ada di `docs/DESIGN.md`, batasan iOS di `docs/IOS_PWA_NOTES.md`.

**Nama: Arus** ("arus kas"). Pendek, bahasa Indonesia, mudah diucapkan. Nama tampilan di Home Screen: `Arus`.

---

## 1. Tujuan, non-goal, metrik

### Tujuan
1. **Mencatat lebih cepat daripada membayar.** Satu transaksi tersimpan dalam waktu kurang dari 5 detik sejak ikon ditap, dengan 4 tap untuk kasus umum.
2. **Data bisa dipercaya.** Saldo dihitung dari transaksi dan bisa diaudit, tidak ada saldo "misterius", backup/restore cukup 1 tombol.
3. **Lengkap untuk dipakai sehari-hari** tanpa perlu belajar metodologi: multi-akun, transfer, anggaran, transaksi berulang, ringkasan bulanan.
4. **Terasa seperti app iOS native kelas atas** (lihat DESIGN.md).

### Non-goal v1
- Sync antarperangkat, akun/login, backend, bank feed, scan struk/OCR, AI.
- Multi-mata uang dan desimal. Semua nominal integer Rupiah.
- Double-entry accounting dan zero-based budgeting.
- Multi-user atau wallet bersama.
- Notifikasi push (pengingat backup ditampilkan di dalam app).
- Enkripsi data at rest (lihat §5.9 PIN).
- Dukungan Android/desktop sebagai target. App tetap harus berjalan di Chrome desktop untuk dev/QA, tetapi tidak dioptimalkan.

### Metrik keberhasilan
| Metrik | Target | Cara ukur |
|---|---|---|
| Waktu buka → tersimpan (cold start, kasus umum) | median < 5 dtk, p90 < 8 dtk | Uji manual di iPhone dengan stopwatch, 10 percobaan. Dev build mencatat `performance.now()` dari boot sampai save ke `console` |
| Jumlah tap kasus umum | ≤ 4 tap (3 digit + 1 kategori) | §4 |
| Konsistensi pemakaian | transaksi tercatat pada ≥ 25 dari 30 hari pertama | Data sendiri |
| Kehilangan data | 0 insiden | Backup dibuat ≥ 1× per 14 hari (`lastBackupAt`) |
| Akurasi saldo | saldo app = saldo nyata setelah 30 hari, atau selisih dapat dijelaskan lewat "Sesuaikan saldo" | Manual |
| Performa | TTI cold start < 1,5 dtk (iPhone 12-kelas). Scroll 5.000 transaksi tetap mulus. JS gz < 180 KB | Lighthouse, uji perangkat |
| Offline | Semua fitur jalan dalam mode pesawat setelah kunjungan pertama | QA |

---

## 2. Model data (Dexie)

### Prinsip
- **ID**: `string` dari `crypto.randomUUID()` (iOS 15.4+). Pilihan ini membuat backup/restore aman dan tidak bergantung pada auto-increment.
- **Nominal**: `number` integer Rupiah, `Number.isSafeInteger`, rentang 1 … 999.999.999.999 (maks. 12 digit). Selalu positif kecuali `adjustment` (bisa negatif, ≠ 0).
- **Tanggal transaksi**: `date: string` berformat `YYYY-MM-DD` **waktu lokal**. Tidak memakai `Date`/epoch untuk tanggal bisnis. Lihat §5.7.
- **Timestamp teknis**: `createdAt`, `updatedAt` berupa `number` (epoch ms).
- **Boolean yang diindeks** disimpan sebagai `0 | 1`, karena IndexedDB tidak bisa mengindeks boolean.
- **Saldo akun tidak disimpan.** Rumusnya `saldo = openingBalance + Σ(income) − Σ(expense) − Σ(transfer keluar) + Σ(transfer masuk) + Σ(adjustment)`, dihitung dari transaksi. Alasannya: (1) riset menyebut "saldo salah hitung" sebagai keluhan utama, dan saldo turunan tidak bisa *drift*; (2) volume data kecil (±3.000 transaksi/tahun) sehingga agregasi in-memory < 10 ms; (3) edit atau hapus transaksi lama otomatis benar tanpa logika rekonsiliasi. Implementasinya satu fungsi murni `computeBalances(accounts, txs)` dan satu hook `useBalances()` (`useLiveQuery` atas `transactions.toArray()`, di-memo). Jika suatu saat > 50.000 transaksi, tambahkan cache snapshot per bulan. Bukan untuk v1.

### Skema (`db.version(1)`)
```ts
db.version(1).stores({
  accounts:     'id, sortOrder, archived',
  categories:   'id, kind, [kind+sortOrder], archived',
  transactions: 'id, date, type, accountId, toAccountId, categoryId, recurringId, [accountId+date], [categoryId+date], createdAt',
  budgets:      'id, categoryId, [categoryId+startPeriod]',
  recurring:    'id, active, nextDate',
  templates:    'id, sortOrder, useCount',
  settings:     'key',
});
```
Migrasi berikutnya ditulis sebagai `db.version(n).stores(...).upgrade(...)` dan dijalankan saat app mulai, bukan di service worker. Tangani event `blocked`/`versionchange`: tutup DB lalu minta muat ulang.

### Tipe
```ts
type ID = string;
type LocalDate = string;   // 'YYYY-MM-DD'
type PeriodKey = string;   // 'YYYY-MM' (lihat §5.6)

interface Account {
  id: ID;
  name: string;                 // 1–30 karakter, unik (case-insensitive) di antara akun aktif
  type: 'cash' | 'bank' | 'ewallet' | 'other';
  icon: IconName;               // dari set ikon DESIGN.md
  color: ColorToken;            // 'c1'…'c12'
  openingBalance: number;       // integer, boleh negatif (mis. kartu kredit), default 0
  includeInTotal: 0 | 1;        // default 1
  sortOrder: number;
  archived: 0 | 1;
  createdAt: number; updatedAt: number;
}

interface Category {
  id: ID;
  kind: 'expense' | 'income';
  name: string;                 // 1–24 karakter, unik per kind
  icon: IconName;
  color: ColorToken;
  sortOrder: number;            // urutan manual. Grid input memakai urutan ini (lihat §5.10)
  archived: 0 | 1;              // diarsipkan = hilang dari grid, tetap tampil di riwayat/laporan
  createdAt: number; updatedAt: number;
}

interface Transaction {
  id: ID;
  type: 'expense' | 'income' | 'transfer' | 'adjustment';
  amount: number;               // >0. Khusus adjustment: ≠0 dan boleh negatif
  date: LocalDate;
  accountId: ID;                // akun sumber (transfer: dari)
  toAccountId?: ID;             // hanya transfer, ≠ accountId
  categoryId?: ID;              // wajib untuk expense/income, kosong untuk transfer/adjustment
  note?: string;                // 0–120 karakter, di-trim
  recurringId?: ID;             // jika dibuat oleh aturan berulang
  createdAt: number; updatedAt: number;
}

interface Budget {
  id: ID;
  categoryId: ID;               // hanya kategori expense
  amount: number;               // >0. Nilai 0 = "hapus anggaran mulai periode ini" (lihat §5.5)
  startPeriod: PeriodKey;       // berlaku mulai periode ini sampai ada record lebih baru
  createdAt: number; updatedAt: number;
}

interface RecurringRule {
  id: ID;
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  accountId: ID; toAccountId?: ID; categoryId?: ID; note?: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;             // 1–12, "setiap N <frekuensi>"
  anchorDate: LocalDate;        // tanggal kejadian pertama
  endDate?: LocalDate;          // inklusif, opsional
  generatedCount: number;       // jumlah kejadian yang sudah dibuat (indeks berikutnya)
  nextDate: LocalDate;          // = occurrence(anchorDate, generatedCount). Disimpan untuk indeks/tampilan
  active: 0 | 1;                // 0 = dijeda atau selesai
  createdAt: number; updatedAt: number;
}

interface Template {            // "Favorit" satu tap
  id: ID;
  label: string;                // mis. "Kopi"
  type: 'expense' | 'income';
  amount: number;
  categoryId: ID; accountId?: ID; // kosong = akun default saat dipakai
  note?: string;
  sortOrder: number;
  useCount: number;
  createdAt: number; updatedAt: number;
}

interface Setting { key: SettingKey; value: unknown; }
```

### `settings` (key → nilai default)
| key | tipe | default | catatan |
|---|---|---|---|
| `periodStartDay` | 1–28 | 1 | §5.6 |
| `theme` | `'system'\|'light'\|'dark'` | `'system'` | |
| `textScale` | `1 \| 1.12 \| 1.24` | 1 | Standar / Besar / Lebih besar |
| `defaultAccount` | `'last' \| ID` | `'last'` | |
| `lastAccountId` | ID | akun "Tunai" | diperbarui setiap simpan |
| `openToAdd` | boolean | true | cold start langsung membuka sheet input |
| `backupReminderDays` | `0\|7\|14\|30` | 7 | 0 = mati |
| `lastBackupAt` | number \| null | null | |
| `txCountAtLastBackup` | number | 0 | pengingat hanya muncul jika ada data baru |
| `persistGranted` | boolean \| null | null | hasil terakhir `storage.persist()` |
| `pin` | `{hash, salt, iterations} \| null` | null | §5.9 |
| `autoLockMinutes` | `0\|1\|5\|15` | 1 | 0 = setiap kali app ke background |
| `seededAt` | number | — | penanda seed pertama |
| `installHintDismissedAt` | number \| null | null | |

### Seed (saat pertama kali dibuka, di dalam satu transaksi Dexie)
- **Kategori expense** (urutan = sortOrder): Makan & Minum, Transportasi, Belanja Harian, Tagihan & Utilitas, Tempat Tinggal, Belanja, Hiburan & Langganan, Kesehatan, Keluarga & Sosial, Sedekah & Zakat, Pendidikan, Lainnya. Ikon/warna mengikuti tabel di DESIGN.md §6.
- **Kategori income**: Gaji, Bonus & THR, Usaha & Freelance, Investasi & Bunga, Hadiah, Lainnya.
- **Akun**: Tunai (cash), Rekening Bank (bank), E-Wallet (ewallet), semuanya dengan saldo awal 0.
- Tidak ada contoh transaksi dan tidak ada template awal.

### Integritas referensial (ditegakkan di lapisan repo `src/db/repo.ts`, bukan oleh Dexie)
- Akun/kategori yang punya transaksi **tidak bisa dihapus**, hanya diarsipkan. Yang belum punya transaksi boleh dihapus permanen.
- Mengarsipkan akun menonaktifkan aturan berulang yang memakainya (dengan konfirmasi yang menyebut jumlah aturannya).
- Minimal 1 akun aktif dan 1 kategori aktif per kind. Tombol arsip/hapus dinonaktifkan pada item terakhir.
- Semua tulis yang menyentuh lebih dari 1 tabel memakai `db.transaction('rw', …)`.

---

## 3. Layar & navigasi

### Struktur
Tab bar bawah dengan 4 tab, ditambah **tombol Tambah** mengambang (FAB 56 px, kanan bawah, di atas tab bar) yang tampil di tab Transaksi, Ringkasan, Anggaran, dan Akun. Pengaturan dibuka dari ikon gir di nav bar tab Akun.

| Tab | Route | Ikon |
|---|---|---|
| Transaksi | `/` | `list` |
| Ringkasan | `/ringkasan` | `chart-donut` |
| Anggaran | `/anggaran` | `gauge` |
| Akun | `/akun` | `wallet` |

Route lain: `/cari`, `/akun/:id`, `/pengaturan`, `/pengaturan/kategori`, `/pengaturan/favorit`, `/pengaturan/berulang`, `/pengaturan/data`, `/pengaturan/keamanan`. Sheet dibuka sebagai state di atas route (`?sheet=add`, `?sheet=tx&id=…`) agar gestur back menutup sheet.
- Router: kecil, buatan sendiri di atas History API (`pushState`/`popstate`), tanpa library. Cloudflare Pages otomatis melakukan SPA fallback, dan SW memakai `navigateFallback: 'index.html'`.
- Setiap layar turunan punya tombol back "‹ <judul induk>" di kiri nav bar dan mendukung swipe dari tepi kiri (≥ 24 px dari tepi, geser > 30% lebar).
- Tab bar dan FAB disembunyikan saat sheet terbuka atau keyboard aktif.
- Nav bar memakai gaya iOS: judul besar (Large Title) yang mengecil menjadi judul inline 17 px saat scroll.
- `?add=1` pada URL membuka sheet input (untuk Shortcuts). `start_url` manifest: `/?source=pwa`.

### 3.1 Transaksi (`/`)
**Elemen**
- Nav bar: Large Title "Transaksi" dan ikon cari (→ `/cari`).
- **Header saldo**: label "Total saldo", nominal besar (akun dengan `includeInTotal=1` yang tidak diarsipkan). Di bawahnya satu baris "Bulan ini: −Rp 3.240.000 keluar · +Rp 8.500.000 masuk" untuk periode berjalan. Tap header → tab Akun.
- **Banner kondisional** (maksimal 1, dengan prioritas): (1) Pasang ke Home Screen jika tidak standalone, (2) Pengingat backup, (3) "N transaksi berulang dicatat" (sekali per batch, bisa ditutup).
- **Daftar per hari**, terbaru di atas. Header hari sticky: kiri "Hari ini" / "Kemarin" / "Kam, 12 Nov" (tahun ditampilkan jika ≠ tahun ini), kanan total bersih hari itu (income − expense, transfer diabaikan).
- **Baris transaksi**: ikon kategori (transfer: ikon `arrows-swap` netral; adjustment: `scale`), judul = catatan jika ada, jika tidak nama kategori (transfer: "Tunai → BCA"). Subjudul = nama kategori (jika judul adalah catatan) · nama akun, ditambah ikon kecil `repeat` jika berasal dari aturan berulang. Kanan: nominal (expense "−Rp 25.000" warna teks utama, income "+Rp 8.500.000" warna `positive`, transfer tanpa tanda dengan warna sekunder).
- Daftar dimuat per periode (bulan berjalan dulu), lalu infinite scroll ke periode sebelumnya. Virtualisasi tidak wajib selama < 2.000 baris DOM. Lebih dari itu, render per periode dengan lazy-load.

**Aksi**: tap baris → sheet edit. Swipe kiri → tombol Hapus (merah) → hapus + toast Urungkan. FAB → sheet input. Pull-to-refresh tidak ada.

**State kosong**: ilustrasi garis tipis (ikon `list` 48 px, warna tersier), teks "Belum ada transaksi", subteks "Tap + untuk mencatat yang pertama. Biasanya cukup 4 tap.", tombol sekunder "Catat transaksi".

**Edge case**: transaksi bertanggal di masa depan (≤ 1 tahun) tampil di atas dengan label header "Terjadwal · Sel, 1 Des" dan nominal 60% opacity, tidak dihitung ke "Hari ini" tetapi dihitung ke saldo hanya ketika tanggalnya ≤ hari ini (§5.1). Pergantian hari saat app terbuka (lewat tengah malam): label "Hari ini" diperbarui saat `visibilitychange` atau tiap 60 detik. Catatan panjang di-ellipsis 1 baris.

### 3.2 Sheet Input / Edit transaksi
Bottom sheet tinggi penuh (detent tunggal, sudut atas radius 24). Detail lengkap ada di §4.
**Elemen (atas → bawah)**
1. Grabber dan baris aksi: kiri "Batal", tengah segmented **Keluar | Masuk | Transfer**, kanan kosong (mode baru) atau ikon `trash` (mode edit).
2. **Tampilan nominal**: "Rp" kecil + angka besar 48 px tabular, auto-shrink sampai 32 px untuk 12 digit. Placeholder "0" warna tersier.
3. **Baris konteks** (chip yang bisa ditap): `[ikon akun] Tunai ▾` · `Hari ini ▾` · `+ Catatan`. Pada mode Transfer: `Dari: Tunai ▾` → `Ke: BCA ▾`.
4. **Baris Favorit** (scroll horizontal, hanya mode baru, hanya jika ada template dan nominal masih 0): chip "Kopi · 25rb".
5. **Grid kategori**: 4 kolom × 3 baris (12 sel). Jika tinggi viewport < 700 px: 4 × 2 (8 sel). Jika kategori aktif lebih banyak daripada sel, sel terakhir menjadi "Lainnya…" yang membuka daftar lengkap. Mode Transfer: grid diganti dua daftar pilihan akun (Dari / Ke).
6. **Keypad kustom**: `1 2 3 / 4 5 6 / 7 8 9 / 000 0 ⌫`. Pada mode edit, transfer, atau saat kategori sudah terpilih, tombol **Simpan** lebar penuh tampil di atas keypad.

**Aksi**: lihat §4. Pilih akun → sheet kecil berisi daftar akun aktif + saldo. Pilih tanggal → sheet kecil: chip "Hari ini", "Kemarin", "2 hari lalu" + kalender bulan (grid 7 kolom, Senin di kiri). Catatan → input teks 17 px (≥ 16 px, mencegah zoom) dengan saran 5 catatan terakhir untuk kategori terpilih.
**State kosong**: tidak relevan. Jika semua kategori diarsipkan tidak mungkin terjadi karena minimal 1 aktif.
**Edge case**: nominal 0 + tap kategori → kategori terpilih saja (highlight), tidak menyimpan. Nominal 0 + Simpan → tombol nonaktif. Digit ke-13 diabaikan disertai animasi "geleng" pendek. Transfer dengan Dari = Ke → Simpan nonaktif dan teks "Pilih akun berbeda". Hanya 1 akun aktif → segmen Transfer nonaktif. Menutup sheet saat nominal > 0 (mode baru) → tidak ada dialog konfirmasi, draf dibuang (cepat > aman, karena entri murah). Mode edit dengan perubahan + Batal → action sheet "Buang perubahan?". Keyboard catatan terbuka → sheet memakai `visualViewport` agar tombol Simpan tetap terlihat.

### 3.3 Cari & filter (`/cari`)
**Elemen**: field cari (fokus otomatis, 17 px) dengan placeholder "Cari catatan, kategori, akun, nominal". Baris chip filter: Jenis (Semua/Keluar/Masuk/Transfer), Kategori (multi-pilih), Akun (multi-pilih), Tanggal (Bulan ini / Bulan lalu / 3 bulan / Tahun ini / Kustom), Nominal (min–maks, keypad). Di bawahnya ringkasan hasil "24 transaksi · −Rp 1.240.000", lalu daftar hasil per hari (komponen sama dengan 3.1).
**Pencocokan**: case- dan diakritik-insensitive (`normalize('NFD')` lalu hapus diakritik), substring pada catatan, nama kategori, dan nama akun. Jika query hanya berisi angka, titik, "rb", atau "jt", query di-parse sebagai nominal dan mencocokkan `amount` persis (mis. "25rb" → 25000, "1,2jt" → 1200000). Debounce 150 ms. Pemfilteran in-memory atas semua transaksi.
**Aksi**: tap hasil → sheet edit. "Reset" menghapus semua filter. Filter terakhir diingat selama sesi (bukan persisten).
**State kosong**: sebelum mengetik dan tanpa filter → tampilkan 5 kategori dan catatan yang sering dipakai sebagai saran. Tanpa hasil → "Tidak ada yang cocok" + tombol "Reset filter".
**Edge case**: masuk dari Ringkasan/Anggaran dengan filter terisi (kategori + periode) → chip menampilkan filter tersebut.

### 3.4 Ringkasan (`/ringkasan`)
**Elemen**
- Nav bar: navigator periode `‹  November 2026  ›` dengan subjudul rentang "25 Okt – 24 Nov" jika `periodStartDay ≠ 1`. Swipe horizontal pada konten juga berpindah periode. Tombol "›" nonaktif di periode berjalan.
- **Tiga angka**: Pemasukan, Pengeluaran, Selisih (+/−). Masing-masing disertai delta terhadap periode sebelumnya dalam % ("▲ 12%"; ▲ pada pengeluaran berwarna `negative`, ▼ berwarna `positive`; jika periode sebelumnya 0 → "—").
- Segmented **Pengeluaran | Pemasukan** untuk donat.
- **Donat**: maksimal 6 segmen terbesar + "Lainnya" (gabungan sisanya). Tengah donat: total dan label "Pengeluaran". Tap segmen → baris kategori di bawah ter-highlight dan teks tengah menampilkan nama kategori + nominal + %.
- **Daftar kategori** (berfungsi sebagai legenda): ikon, nama, bar tipis proporsional, nominal, persen, jumlah transaksi. Urut nominal menurun. Tap → `/cari` dengan filter kategori + periode.
- **Tren 6 periode**: bar chart (periode berjalan + 5 sebelumnya) berisi pengeluaran dan pemasukan berpasangan. Tap bar → pindah ke periode itu.
- Info kecil di bawah: "Transfer dan penyesuaian saldo tidak dihitung."

**State kosong** (periode tanpa transaksi expense/income): donat berupa ring abu-abu tipis, teks "Belum ada pengeluaran di periode ini". Tren tetap tampil jika periode lain punya data. Jika seluruh DB kosong: state kosong penuh + tombol "Catat transaksi".
**Edge case**: satu kategori 100% → donat penuh tanpa celah. Kategori diarsipkan tetap tampil di laporan. Nilai segmen < 1% tetap terlihat dengan sudut minimum 2°. Navigasi ke periode sebelum transaksi pertama dibatasi sampai periode transaksi pertama.

### 3.5 Anggaran (`/anggaran`)
**Elemen**
- Navigator periode yang sama dengan Ringkasan.
- **Kartu total**: "Sisa Rp 1.760.000 dari Rp 5.000.000". Bar progres total. Pada periode berjalan: "≈ Rp 117.000/hari untuk 15 hari lagi".
- **Daftar anggaran per kategori**: ikon, nama, "Rp 640.000 / Rp 1.500.000", bar progres 4 px, teks sisa ("Sisa Rp 860.000" atau "Lebih Rp 120.000" berwarna `negative`). Status warna: < 80% normal (accent), 80–100% `warning`, > 100% `negative`.
- Bagian **"Tanpa anggaran"**: kategori expense yang punya pengeluaran di periode ini tetapi tidak punya anggaran (nominal saja, tanpa bar), dengan aksi "Atur".
- Tombol nav bar "Atur" → mode edit: setiap kategori expense aktif ditampilkan dengan field nominal (keypad kustom di sheet kecil).

**Aksi**: tap baris → sheet: nominal anggaran (keypad), info "Berlaku mulai November 2026 dan seterusnya", tombol "Hapus anggaran". Tap kategori di daftar → `/cari` terfilter.
**State kosong**: "Belum ada anggaran" + "Anggaran membantu melihat sisa uang per kategori. Atur sekali, berlaku tiap bulan." + tombol "Atur anggaran".
**Edge case**: periode lampau menampilkan anggaran yang berlaku saat itu (§5.5), tanpa "per hari". Periode masa depan tidak bisa dinavigasi. Kategori yang punya anggaran lalu diarsipkan → tetap tampil di periode lampau, hilang dari periode baru.

### 3.6 Akun (`/akun`) & Detail akun (`/akun/:id`)
**Akun — elemen**: nav bar "Akun" + ikon gir (→ Pengaturan) + "+" (akun baru). Total saldo. Grup daftar akun aktif: ikon, nama, jenis (sekunder), saldo (negatif berwarna `negative`). Grup "Diarsipkan" dilipat. Tombol "Transfer" (membuka sheet input dalam mode Transfer). Drag handle untuk urutan di mode "Edit".
**Detail — elemen**: nama + saldo besar, info "Saldo awal Rp 0 · dibuat 1 Nov 2026". Aksi: "Sesuaikan saldo", "Edit", "Arsipkan". Daftar transaksi akun per hari **dengan saldo berjalan** di sisi kanan bawah setiap baris (kecil, tersier), untuk audit.
**Sheet akun baru/edit**: nama, jenis (segmented 4 opsi), ikon (grid 12), warna (12 swatch), saldo awal (keypad + toggle tanda −), toggle "Hitung ke total saldo".
**Sesuaikan saldo**: masukkan saldo nyata (keypad). App menghitung selisih dan menampilkan "Akan mencatat penyesuaian +Rp 12.500". Simpan membuat transaksi `adjustment` bertanggal hari ini dengan catatan "Penyesuaian saldo". Jika selisih 0, tombol nonaktif.
**State kosong**: tidak mungkin terjadi (minimal 1 akun). Detail akun tanpa transaksi: "Belum ada transaksi di akun ini".
**Edge case**: saldo negatif boleh. Nama duplikat ditolak ("Nama sudah dipakai"). Arsip akun yang dipakai `defaultAccount` → default kembali ke `'last'`, atau ke akun aktif pertama jika `lastAccountId` diarsipkan.

### 3.7 Pengaturan (`/pengaturan`)
Daftar bergrup gaya iOS:
- **Tampilan**: Tema (Sistem/Terang/Gelap), Ukuran teks (Standar/Besar/Lebih besar, dengan pratinjau).
- **Pencatatan**: Akun default (Terakhir dipakai / pilih akun), Buka langsung ke input (toggle), Awal periode bulanan (tanggal 1–28, dengan penjelasan "Cocok untuk tanggal gajian").
- **Kelola**: Kategori ›, Favorit ›, Transaksi berulang ›.
- **Data & Backup** ›: lihat 3.8.
- **Keamanan** ›: PIN (§5.9).
- **Tentang**: versi app (hash build), "Periksa pembaruan", tautan teks singkat tentang privasi ("Semua data hanya ada di perangkat ini").

### 3.8 Data & Backup (`/pengaturan/data`)
- Status: "Backup terakhir: 3 hari lalu" (atau "Belum pernah", berwarna `warning`). Status penyimpanan: "Penyimpanan permanen: Aktif/Tidak aktif" + pemakaian (`navigator.storage.estimate()`, mis. "1,2 MB dipakai"). Jumlah data: "1.284 transaksi · 4 akun · 18 kategori".
- **Buat backup (JSON)**: tombol utama.
- **Ekspor CSV**: pilih rentang (Semua / Periode ini / Tahun ini).
- **Pulihkan dari backup**: `<input type=file accept=".json,application/json">`.
- Pengingat backup: Mati / 7 / 14 / 30 hari.
- **Zona berbahaya**: "Hapus semua data" (ketik `HAPUS` untuk konfirmasi), lalu seed ulang.
- Detail perilaku di §5.8.

### 3.9 Kategori (`/pengaturan/kategori`)
Segmented Pengeluaran/Pemasukan. Daftar dengan drag handle (urutan = urutan grid input). Tap → sheet edit: nama, ikon (grid ~40 ikon), warna (12). "+ Kategori baru". Arsip/hapus sesuai §2. Grup "Diarsipkan" bisa dipulihkan. Edge case: nama duplikat ditolak, dan item terakhir tidak bisa diarsipkan.

### 3.10 Favorit (`/pengaturan/favorit`)
Daftar template: label, kategori, nominal. Tambah/edit lewat sheet (label, jenis, nominal, kategori, akun opsional, catatan opsional). Tersedia juga aksi cepat "Jadikan favorit" di sheet edit transaksi. Urutan manual dengan drag. Maksimal 12 template. State kosong: "Simpan transaksi yang sering berulang, seperti Kopi 25rb, untuk dicatat dengan 1 tap."

### 3.11 Transaksi berulang (`/pengaturan/berulang`)
Daftar aturan: ikon kategori, catatan/nama kategori, "Rp 1.500.000 · tiap bulan tgl 1", "Berikutnya: 1 Des 2026". Badge "Dijeda" jika tidak aktif. Tap → sheet edit: jenis, nominal, kategori/akun (atau Dari/Ke), catatan, frekuensi (Harian/Mingguan/Bulanan/Tahunan) + "setiap N", tanggal mulai, berakhir (Tidak pernah / pada tanggal), toggle Aktif, tombol Hapus aturan (transaksi yang sudah dibuat tetap ada; opsi tambahan "Hapus juga transaksi masa depan" jika ada transaksi bertanggal > hari ini). Pembuatan aturan baru juga bisa dari sheet input: chip "Ulangi" di baris konteks (`+ Catatan · Ulangi`) membuka sheet frekuensi. State kosong: "Catat kos, langganan, atau cicilan sekali, lalu Arus akan mencatatnya otomatis."

### 3.12 Kunci PIN (overlay)
Layar penuh (warna `bg`), logo Arus kecil, "Masukkan PIN", 6 titik, keypad angka (komponen keypad tanpa `000`). Detail di §5.9.

### 3.13 Global
- **Toast**: satu pada satu waktu, di atas tab bar, 5 detik, swipe ke bawah untuk menutup.
- **Update SW**: toast persisten "Versi baru tersedia · Muat ulang". Tidak ditampilkan saat sheet input/edit terbuka dengan data terisi atau saat terkunci. Ditunda sampai sheet ditutup.
- **Error penyimpanan** (`QuotaExceededError`, DB gagal dibuka): layar/toast merah "Gagal menyimpan. Penyimpanan perangkat penuh. Buat backup lalu kosongkan ruang." Data di form tidak dibuang.

---

## 4. Alur input transaksi (detail)

### 4.1 Kasus umum: pengeluaran Rp 25.000 makan, akun terakhir, hari ini
| # | Aksi pengguna | Sistem | Tap |
|---|---|---|---|
| 0 | Tap ikon Arus di Home Screen | Cold start. `openToAdd=true` → route `/`, sheet input langsung terbuka **tanpa animasi** (agar tidak membuang 300 ms). Mode Keluar, akun = `lastAccountId`, tanggal = hari ini lokal | (0 di dalam app) |
| 1 | Tap `2` | Nominal "Rp 2" | 1 |
| 2 | Tap `5` | "Rp 25" | 2 |
| 3 | Tap `000` | "Rp 25.000" | 3 |
| 4 | Tap sel **Makan & Minum** | Validasi → tulis ke DB → haptic opsional → sheet menutup (animasi 280 ms) → daftar menampilkan baris baru dengan highlight 1,2 dtk → toast "Tersimpan · Makan & Minum −Rp 25.000 · **Urungkan**" (5 dtk). `lastAccountId` diperbarui | 4 |

Total: **4 tap, ±3 detik.** Jika app di-*resume* dari background (bukan cold start), app kembali ke layar terakhir. Pengguna menekan FAB, sehingga totalnya 5 tap.

### 4.2 Variasi
- **Kategori dulu** (gaya Monefy): tap kategori saat nominal 0 → kategori terpilih (cincin accent), tombol Simpan muncul (nonaktif). Ketik nominal → Simpan aktif → tap Simpan. Total = digit + 2.
- **Dengan detail** (akun/tanggal/catatan lain): ubah chip konteks **sebelum** tap kategori. Chip yang diubah tetap berlaku sampai simpan. Ubah akun: +2 tap (chip + pilih). Kemarin: +2 tap. Catatan: tap chip → ketik → "Selesai" pada keyboard kembali ke sheet, lalu tap kategori untuk menyimpan.
- **Pemasukan**: tap segmen "Masuk" (+1). Grid menampilkan kategori income. Sisanya sama.
- **Transfer**: tap "Transfer" (+1) → ketik nominal → pilih Dari (default = `lastAccountId`) → pilih Ke (wajib, belum terpilih) → Simpan. Minimal: 1 + digit + 1 + 1 tap.
- **Favorit**: tap chip favorit → langsung tersimpan dengan nominal/kategori/akun/catatan template, tanggal hari ini, lalu toast Urungkan. **1 tap** (+ FAB jika resume). `useCount++`. Tekan lama chip → isi form dari template tanpa menyimpan (untuk mengubah nominal).
- **Edit**: tap baris → sheet mode edit terisi data. Semua field bisa diubah, termasuk jenis (expense ↔ income mengosongkan kategori sehingga harus dipilih ulang; ke/dari transfer menyesuaikan field). Tap kategori **tidak** langsung menyimpan dalam mode edit; perubahan disimpan lewat tombol Simpan. Ikon trash → hapus + toast Urungkan.
- **Undo**: Urungkan setelah simpan baru menghapus transaksi itu. Urungkan setelah hapus memasukkan kembali record identik (id sama). Urungkan setelah edit mengembalikan nilai lama. Stack undo hanya 1 level.

### 4.3 Aturan keypad
- Digit masuk dari kanan. `0`/`000` saat nominal 0 diabaikan. `000` hanya menambah digit yang muat (maks. 12 digit total).
- `⌫`: hapus 1 digit. **Tekan lama 500 ms** → kosongkan.
- Tombol keypad memakai `pointerdown` (bukan `click`) untuk respons instan. Cegah double-tap zoom (`touch-action: manipulation`) dan seleksi teks (`user-select: none`).
- Tampilan diformat langsung: `Rp 1.250.000`.
- Keyboard fisik (desktop/dev): `0–9`, `Backspace`, `Enter` = Simpan jika valid, `Escape` = tutup.

---

## 5. Aturan bisnis

### 5.1 Perhitungan umum
- **Pemasukan/Pengeluaran periode** = Σ amount transaksi `income`/`expense` dengan `date` di dalam rentang periode **dan `date ≤ hari ini`**. `transfer` dan `adjustment` **tidak** dihitung di ringkasan, anggaran, maupun total harian.
- **Transaksi terjadwal** (`date > hari ini`) tampil di grup "Terjadwal" tetapi **tidak** dihitung di total/ringkasan/tren/anggaran/saldo maupun jumlah hasil pencarian sampai tanggalnya tiba (Cari menampilkan "n terjadwal belum dihitung"). Satu-satunya implementasi aturan ini: `src/lib/effective.ts`.
- **Saldo akun** = rumus di §2, hanya atas transaksi dengan `date ≤ hari ini`. Transaksi bertanggal masa depan (dari input manual atau aturan berulang) ditampilkan sebagai "Terjadwal" dan baru memengaruhi saldo pada hari tersebut. Detail akun menampilkan "Saldo setelah terjadwal: Rp …" jika ada.
- **Total saldo** = Σ saldo akun aktif dengan `includeInTotal=1`. Akun yang diarsipkan tidak dihitung (pengguna disarankan menyesuaikan saldo ke 0 sebelum mengarsipkan; tampilkan peringatan jika saldo ≠ 0).

### 5.2 Transfer
- Disimpan sebagai **satu record** `type='transfer'` dengan `accountId` (dari) dan `toAccountId` (ke). Tidak memakai dua record berpasangan, sehingga tidak ada risiko salah satunya yatim.
- Efek: saldo `accountId` − amount, saldo `toAccountId` + amount.
- Tanpa kategori dan tanpa biaya admin (v1). Biaya admin dicatat sebagai pengeluaran terpisah (kategori Tagihan). Tampilkan hint di sheet transfer: "Ada biaya admin? Catat sebagai pengeluaran terpisah."
- Di daftar akun detail: tampil di kedua akun (keluar "−" di akun asal, masuk "+" di akun tujuan).
- Tidak dihitung di ringkasan/anggaran. Pencarian dengan filter Akun = X menampilkan transfer yang `accountId` **atau** `toAccountId` = X.

### 5.3 Transaksi berulang
**Kalkulasi kejadian**: `occurrence(anchor, k)`
- daily: anchor + k·interval hari
- weekly: anchor + 7·k·interval hari
- monthly: tahun/bulan anchor + k·interval bulan, **hari = min(anchor.day, jumlah hari bulan itu)** (anchor tgl 31 → 30 Nov, 28/29 Feb, 31 Mar). Selalu dihitung dari anchor, bukan dari kejadian sebelumnya, agar tidak bergeser permanen ke tgl 28.
- yearly: sama, dalam satuan 12 bulan (29 Feb → 28 Feb di tahun non-kabisat).

**Generator `runRecurring(today)`** dijalankan (a) saat app mulai setelah DB siap, (b) saat `visibilitychange → visible`, (c) saat tanggal lokal berubah ketika app terbuka (dicek tiap 60 dtk). Prosesnya dalam satu `db.transaction('rw', [recurring, transactions])`:
```
for rule of recurring.where('active').equals(1):
  loop:
    d = occurrence(rule.anchorDate, rule.generatedCount)
    if d > today or (rule.endDate and d > rule.endDate): break
    if akun/kategori rule diarsipkan/hilang: rule.active=0; break
    insert Transaction{type, amount, accountId, toAccountId, categoryId, note, date:d, recurringId:rule.id}
    rule.generatedCount++
    guard: maks 400 kejadian per rule per run (cegah loop "harian sejak 2 tahun lalu")
  rule.nextDate = occurrence(anchor, generatedCount)
  if endDate and nextDate > endDate: rule.active = 0
```
- **Idempoten** lewat `generatedCount`, bukan lewat cek keberadaan transaksi. Menghapus transaksi hasil generate **tidak** membuatnya muncul lagi.
- Kejadian yang terlewat (app tidak dibuka beberapa hari) dibuat semua dengan tanggal aslinya (catch-up). Setelahnya tampil banner "3 transaksi berulang dicatat · Lihat" (→ `/cari?recurring=1&since=…`).
- Kejadian dibuat **hanya sampai hari ini**, tidak ada pre-generate ke masa depan.
- Mengedit aturan hanya memengaruhi kejadian berikutnya. Jika `anchorDate`/frekuensi/interval diubah: `anchorDate` diset ke tanggal baru yang dipilih dan `generatedCount=0`. Jika tanggal mulai baru ≤ hari ini, tampilkan konfirmasi "Akan mencatat N transaksi sejak <tanggal>".
- Mengedit transaksi hasil generate hanya mengubah transaksi itu (tetap ber-`recurringId`).
- Membuat aturan dengan `anchorDate` = hari ini langsung menghasilkan kejadian pertama (transaksi hari ini). Dari sheet input, "Ulangi" + Simpan = membuat aturan + kejadian pertama sekaligus, tanpa duplikat.
- Menjeda (`active=0`) lalu mengaktifkan lagi: tampilkan pilihan "Catat yang terlewat (N)" atau "Lewati, mulai dari kejadian berikutnya". "Lewati" berarti `generatedCount` dimajukan sampai kejadian > hari ini tanpa membuat transaksi.

### 5.4 Favorit (template)
Saran urutan di sheet input: `sortOrder` manual. `useCount` hanya statistik. Memakai favorit = simpan instan (§4.2).

### 5.5 Anggaran
- Hanya untuk kategori **expense**. Satu nominal per kategori per periode. **Nilai yang berlaku pada periode P** = record `budgets` untuk kategori itu dengan `startPeriod` terbesar yang ≤ P. Jika nominal record tersebut 0 atau tidak ada record, kategori tidak punya anggaran.
- Mengatur/mengubah anggaran saat melihat periode P akan meng-*upsert* record `[categoryId+startPeriod=P]`, sehingga periode sebelum P tetap memakai nilai lama (riwayat terjaga). "Hapus anggaran" = upsert dengan `amount=0`.
- Hanya periode berjalan dan periode lampau yang bisa diedit. Mengedit periode lampau memunculkan peringatan "Juga berlaku untuk bulan-bulan sesudahnya sampai ada perubahan berikutnya".
- `terpakai` = Σ expense kategori itu di periode P. `sisa = anggaran − terpakai` (boleh negatif). `persen = terpakai / anggaran`.
- **Sisa per hari** (hanya periode berjalan) = `max(0, sisa) / hariTersisa`, dengan `hariTersisa` = jumlah hari dari hari ini (inklusif) sampai akhir periode. Dibulatkan ke bawah ke ribuan.
- Total = Σ semua kategori yang punya anggaran. Pengeluaran kategori tanpa anggaran tidak masuk total anggaran, tetapi tampil di grup "Tanpa anggaran".
- Tidak ada rollover sisa ke bulan berikutnya (v1).

### 5.6 Periode bulan
- `periodStartDay` = S ∈ 1…28. (29–31 tidak diizinkan agar setiap bulan punya hari mulai yang pasti; jelaskan di UI.)
- Periode untuk tanggal d: jika `d.day ≥ S` → mulai = (d.year, d.month, S), jika tidak → mulai = (bulan sebelumnya, S). Akhir = mulai + 1 bulan − 1 hari.
- **Kunci & label periode = bulan dari tanggal akhir.** S=1: 1–30 Nov → "November 2026" (`2026-11`). S=25: 25 Okt–24 Nov → "November 2026" (`2026-11`), karena gaji tgl 25 Okt membiayai November. Subjudul menampilkan rentang.
- Fungsi murni: `periodOf(date, S) → {key, start, end}`, `periodByKey(key, S)`, `shiftPeriod(key, ±n)`.
- Mengubah S hanya mengubah pengelompokan tampilan. Data tidak berubah. Kunci `startPeriod` anggaran tetap ditafsirkan dengan S yang baru.
- Minggu dimulai hari **Senin** (kalender pemilih tanggal).

### 5.7 Tanggal & zona waktu
- Semua tanggal bisnis memakai **zona waktu lokal perangkat**. "Hari ini" = `toLocalDate(new Date())` dengan getter lokal (`getFullYear/getMonth/getDate`).
- **Dilarang** memakai `toISOString().slice(0,10)` untuk tanggal, karena di WIB (UTC+7) hasilnya adalah tanggal kemarin sebelum pukul 07:00. Buat lint rule atau tes untuk ini.
- Parsing `YYYY-MM-DD` dilakukan manual menjadi `new Date(y, m-1, d)` (bukan `new Date('2026-11-20')`, yang ditafsirkan sebagai UTC).
- Aritmetika tanggal memakai utilitas sendiri (`addDays`, `addMonthsClamped`, `daysInMonth`) atas komponen y/m/d. Tidak perlu library tanggal.
- Urutan dalam satu hari: `createdAt` menurun.
- Format tampilan memakai `Intl.DateTimeFormat('id-ID')`: "Jumat, 20 November 2026" (detail), "Kam, 20 Nov" (header hari), "Nov 2026" (chart).

### 5.8 Backup, restore, ekspor
**Format JSON** (`arus-backup-YYYY-MM-DD.json`):
```json
{ "app": "arus", "format": 1, "schemaVersion": 1, "exportedAt": "2026-11-20T08:15:00.000+07:00",
  "counts": { "transactions": 1284, "accounts": 4, ... },
  "data": { "accounts": [], "categories": [], "transactions": [], "budgets": [], "recurring": [], "templates": [], "settings": [] } }
```
- `settings` tidak menyertakan `pin`, `persistGranted`, `lastBackupAt`, dan `installHintDismissedAt`.
- **Membuat backup**: serialisasi → `new File([json], name, {type:'application/json'})` → jika `navigator.canShare({files})` → `navigator.share({files})` (dipanggil langsung dari handler tap). Jika tidak bisa → fallback `<a download>` (desktop). **Setelah share resolve** (bukan reject/AbortError): set `lastBackupAt=now` dan `txCountAtLastBackup`, lalu toast "Backup dibuat". Batal → tidak ada perubahan.
- **Pengingat**: banner di tab Transaksi jika `backupReminderDays>0` dan `now − lastBackupAt ≥ N hari` (atau belum pernah dan ada ≥ 20 transaksi) **dan** jumlah transaksi ≠ `txCountAtLastBackup`. Aksi banner: "Backup sekarang" (langsung memicu share) dan "Nanti" (sembunyi 24 jam).
- **Restore** (mode tunggal v1: **ganti semua data**):
  1. Pilih file → `file.text()` → `JSON.parse`.
  2. Validasi penuh sebelum menulis apa pun: `app==='arus'`, `format` didukung, setiap record valid (tipe, amount integer, `date` valid, referensi akun/kategori ada, transfer punya `toAccountId ≠ accountId`). Kumpulkan error. Jika ada error, tolak dengan pesan "File backup tidak valid: 3 transaksi merujuk akun yang tidak ada" dan tidak ada yang ditulis.
  3. Sheet pratinjau: "Backup 18 Nov 2026 · 1.284 transaksi · 4 akun. **Semua data saat ini (1.290 transaksi) akan diganti.**" Tombol merah "Ganti data" dan "Batal".
  4. Tulis dalam satu `db.transaction('rw', semuaTabel)`: clear semua tabel lalu `bulkAdd`. Jika gagal, transaksi rollback dan data lama tetap utuh.
  5. Jalankan `runRecurring`, toast "Data dipulihkan".
  - `schemaVersion` lebih lama → jalankan fungsi migrasi JSON sebelum validasi. Lebih baru → tolak ("Perbarui app dulu").
- **Ekspor CSV** (`arus-transaksi-<rentang>.csv`): UTF-8 dengan BOM, pemisah `,`, CRLF, quoting RFC 4180. Kolom: `Tanggal` (YYYY-MM-DD), `Jenis` (Pengeluaran/Pemasukan/Transfer/Penyesuaian), `Nominal` (integer, negatif untuk pengeluaran dan transfer keluar), `Kategori`, `Akun`, `Akun Tujuan`, `Catatan`. Transfer = 1 baris. Dibagikan lewat mekanisme share yang sama. CSV bukan backup dan tidak memengaruhi `lastBackupAt`.
- **Hapus semua data**: konfirmasi ketik `HAPUS` → clear semua tabel → seed ulang → kembali ke `/`.

### 5.9 PIN (keputusan: **dibuat, opsional, default mati**)
Alasan dibuat: biayanya kecil, mencegah orang lain yang meminjam iPhone yang sudah terbuka melihat isi keuangan, dan aplikasi rujukan seperti Money Manager menjadikannya fitur dasar. **Kejujuran wajib**: di layar Keamanan tampilkan teks:
> "PIN hanya mengunci tampilan Arus. Data di perangkat tidak dienkripsi, dan file backup tidak dilindungi PIN. Jika lupa PIN, satu-satunya jalan adalah menghapus data lalu memulihkan dari backup."

- 6 digit. Disimpan sebagai `{hash, salt, iterations: 150000}` dengan PBKDF2-SHA-256 via WebCrypto (salt acak 16 byte). Tidak pernah disimpan dalam bentuk plaintext.
- Atur PIN: masukkan 2× (harus sama). Ubah PIN: PIN lama → baru 2×. Matikan: masukkan PIN.
- **Terkunci** saat cold start dan saat kembali dari background setelah ≥ `autoLockMinutes` (0 = selalu). Waktu background dicatat pada `visibilitychange → hidden`. Saat terkunci, konten app **tidak dirender** (bukan sekadar ditutupi overlay) dan generator berulang tetap berjalan.
- Saat `visibilitychange → hidden` dengan PIN aktif, render layar kosong polos agar thumbnail app switcher tidak menampilkan data (upaya terbaik, tidak dijamin di iOS).
- Salah 5× → tunggu 30 dtk. Setiap 5 kesalahan berikutnya, waktu tunggu digandakan (maks. 15 menit). Penghitung disimpan di settings agar tidak reset saat reload.
- "Lupa PIN?" → penjelasan + tombol "Hapus semua data" (konfirmasi ketik `HAPUS`).
- Face ID/WebAuthn: tidak di v1 (lihat Nanti).

### 5.10 Format Rupiah & angka
- Penuh: `formatIDR(n)` = `"Rp " + Intl.NumberFormat('id-ID').format(|n|)` → `Rp 1.250.000`. Tanda: `−Rp 25.000` (U+2212 minus) / `+Rp 25.000` (`+` hanya di konteks income/delta). Spasi setelah "Rp" adalah U+00A0 (tidak putus baris).
- Singkat `formatIDRShort(n)` (chart, chip favorit, label sempit), dipotong ke bawah (truncate, bukan dibulatkan) ke 1 desimal, dan ",0" dibuang:
  - < 1.000 → `950`
  - < 1.000.000 → `25rb`, `1,5rb`, `999rb`
  - < 1.000.000.000 → `1,2jt` (1.250.000), `12jt`, `999,9jt`
  - < 10¹² → `1,2M` (miliar)
  - Prefiks "Rp" opsional (`withRp`). Tanpa spasi antara angka dan satuan.
- Parsing teks (pencarian): `25rb`, `25k`, `25.000`, `1,2jt`, `1.2jt` → integer.
- Semua angka di UI memakai `font-variant-numeric: tabular-nums`.
- Persen: bilangan bulat ("64%"), kecuali < 1% → "<1%".

### 5.11 Urutan grid kategori
Urutan = `sortOrder` manual (diatur di Kategori). Riset menyarankan urutan frekuensi, tetapi urutan yang berubah-ubah merusak memori otot. Keputusan: posisi tetap (manual), dengan default seed sudah urut frekuensi. Sel kategori yang terakhir dipakai diberi titik kecil accent sebagai petunjuk.

### 5.12 Platform & PWA
- **`navigator.storage.persist()`** dipanggil di setiap start (jika `persisted()` false). Hasilnya disimpan ke `persistGranted`. Jika false dan app standalone → tidak perlu mengganggu pengguna, cukup tampilkan di Data & Backup dan perketat pengingat backup (7 hari dipaksa meski setting 14/30).
- **Standalone check**: `navigator.standalone === true || matchMedia('(display-mode: standalone)').matches`. Jika tidak standalone (dibuka di tab Safari): banner "Pasang Arus ke Home Screen: tap Bagikan → Tambah ke Layar Utama. Data di Safari dan di app Home Screen terpisah." Bisa ditutup (tampil lagi setelah 7 hari).
- **Service worker**: vite-plugin-pwa `registerType: 'prompt'`, precache `**/*.{js,css,html,svg,png,woff2}`, `navigateFallback: 'index.html'`. `registration.update()` dipanggil saat `visibilitychange → visible` (throttle 1×/30 menit). Toast update seperti §3.13. "Muat ulang" → `updateSW(true)`.
- **Cloudflare `_headers`**: `/sw.js` dan `/index.html` → `Cache-Control: no-cache`. `/assets/*` → `public, max-age=31536000, immutable`.
- **Manifest**: name/short_name "Arus", `display: standalone`, `start_url: '/?source=pwa'`, `scope: '/'`, `background_color` = `bg` light, ikon 192/512 + `apple-touch-icon` 180 PNG opak. Meta `apple-mobile-web-app-status-bar-style=black-translucent`, viewport `viewport-fit=cover`. Body background diset per tema (Safari 26 mengambil warna bar dari situ).
- **Layout**: `html, body { overscroll-behavior: none; height: 100% }`, scroll di container dalam. Padding `env(safe-area-inset-*)`. Tinggi `100dvh` dengan fallback `100vh`. Semua input ≥ 16 px.

---

## 6. Acceptance criteria

Format: **ID** · Given / When / Then. Lingkungan uji: iPhone Safari standalone (manual) + Playwright WebKit viewport 390×844 (otomatis). Fungsi murni (format, periode, recurring, saldo, CSV, validasi backup) wajib punya unit test Vitest.

### A. Input cepat
- **AC-IN-01** · Given app terpasang, `openToAdd=true`, DB berisi seed · When cold start · Then sheet input terbuka dalam ≤ 1,5 dtk dengan mode Keluar, akun = terakhir dipakai, tanggal = hari ini lokal.
- **AC-IN-02** · Given sheet terbuka · When tap `2`,`5`,`000`, lalu tap "Makan & Minum" · Then 1 transaksi expense 25000 tersimpan dengan tanggal hari ini, sheet tertutup, toast "Tersimpan…Urungkan" tampil, baris muncul paling atas di "Hari ini". Total 4 tap.
- **AC-IN-03** · Given toast Urungkan tampil · When tap Urungkan dalam 5 dtk · Then transaksi terhapus dan saldo kembali seperti semula.
- **AC-IN-04** · Given nominal 0 · When tap kategori · Then tidak ada yang tersimpan, kategori ter-highlight, tombol Simpan tampil nonaktif. When kemudian ketik `5000` → Simpan aktif → tap → tersimpan.
- **AC-IN-05** · Given nominal 12 digit · When tap digit lagi · Then nominal tidak berubah. `000` pada nominal 10 digit hanya menambah 2 digit.
- **AC-IN-06** · When tekan lama `⌫` ≥ 500 ms · Then nominal menjadi 0.
- **AC-IN-07** · Given nominal 0 · When tap `0` atau `000` · Then tampilan tetap "0".
- **AC-IN-08** · Tampilan nominal 1250000 = "Rp 1.250.000" dan tidak pernah memakai desimal.
- **AC-IN-09** · When ubah tanggal ke "Kemarin" lalu simpan · Then `date` = kemarin lokal dan transaksi muncul di grup "Kemarin".
- **AC-IN-10** · Given waktu perangkat 05:30 WIB · When simpan · Then `date` = tanggal lokal hari itu (bukan tanggal UTC kemarin).
- **AC-IN-11** · Given favorit "Kopi 25rb" · When tap chip favorit · Then tersimpan dalam 1 tap dengan data template + tanggal hari ini, dan toast Urungkan tampil.
- **AC-IN-12** · Given mode edit dengan perubahan · When tap Batal · Then muncul "Buang perubahan?". Mode baru dengan nominal > 0 + Batal → tertutup tanpa dialog.
- **AC-IN-13** · When field catatan difokuskan · Then halaman tidak zoom (font ≥ 16 px) dan tombol Simpan tetap terlihat di atas keyboard.
- **AC-IN-14** · Given viewport tinggi 667 · Then grid kategori 4×2, keypad, dan nominal terlihat tanpa scroll.
- **AC-IN-15** · Given URL `/?add=1` · Then sheet input terbuka.

### B. Daftar transaksi
- **AC-LS-01** · Transaksi dikelompokkan per `date` menurun. Di dalam hari diurutkan `createdAt` menurun. Header menampilkan "Hari ini"/"Kemarin"/"Kam, 12 Nov".
- **AC-LS-02** · Total header hari = Σ income − Σ expense hari itu. Transfer dan adjustment tidak dihitung.
- **AC-LS-03** · When swipe kiri lalu Hapus · Then transaksi hilang + toast Urungkan. Urungkan mengembalikan record dengan `id` sama.
- **AC-LS-04** · When tap baris, ubah nominal, Simpan · Then baris dan saldo terbarui, `updatedAt` berubah, `createdAt` tetap.
- **AC-LS-05** · DB kosong → state kosong dengan tombol "Catat transaksi".
- **AC-LS-06** · Transaksi bertanggal besok tampil di grup "Terjadwal" dan tidak memengaruhi saldo hari ini.
- **AC-LS-07** · Dengan 5.000 transaksi, scroll tidak tersendat dan tab Transaksi tampil < 1 dtk.

### C. Ringkasan
- **AC-SM-01** · Given expense 100rb (Makan) + 50rb (Transport) dan income 1jt di periode ini, plus transfer 200rb · Then Pengeluaran Rp 150.000, Pemasukan Rp 1.000.000, Selisih +Rp 850.000. Transfer tidak terhitung.
- **AC-SM-02** · Donat menampilkan Makan 67% dan Transportasi 33%. Daftar urut menurun. Tap baris → `/cari` dengan filter kategori + periode.
- **AC-SM-03** · Lebih dari 7 kategori → 6 terbesar + "Lainnya" yang nilainya = sisa.
- **AC-SM-04** · `‹` berpindah ke periode sebelumnya. `›` nonaktif di periode berjalan. Delta % benar, dan "—" jika periode sebelumnya 0.
- **AC-SM-05** · Tren menampilkan 6 periode. Tap bar → pindah ke periode itu.
- **AC-SM-06** · Periode kosong → state kosong dengan ring abu-abu.

### D. Akun & transfer
- **AC-AC-01** · Saldo = openingBalance + income − expense ± transfer + adjustment (tes unit dengan ≥ 10 skenario, termasuk edit dan hapus transaksi lama).
- **AC-AC-02** · Given Tunai 500rb, BCA 0 · When transfer 200rb Tunai→BCA · Then Tunai 300rb, BCA 200rb, total saldo tetap 500rb, ringkasan tidak berubah.
- **AC-AC-03** · Transfer dengan Dari = Ke → Simpan nonaktif. Hanya 1 akun aktif → segmen Transfer nonaktif.
- **AC-AC-04** · Sesuaikan saldo Tunai (app 300rb, nyata 287.500) → tercipta adjustment −12.500. Saldo = 287.500. Ringkasan tidak berubah.
- **AC-AC-05** · Akun yang punya transaksi: tombol Hapus tidak ada, hanya Arsipkan. Akun yang diarsipkan hilang dari pemilih akun dan total, tetapi riwayatnya tetap tampil.
- **AC-AC-06** · Akun terakhir yang aktif tidak bisa diarsipkan. Nama duplikat ditolak.
- **AC-AC-07** · Detail akun menampilkan saldo berjalan yang konsisten dengan saldo akhir.
- **AC-AC-08** · `includeInTotal=0` → saldo akun tampil tetapi tidak dijumlah ke total.

### E. Anggaran
- **AC-BG-01** · Given anggaran Makan 1jt mulai Nov, expense Makan 850rb di Nov · Then 85%, status warning, "Sisa Rp 150.000".
- **AC-BG-02** · Expense 1,12jt → "Lebih Rp 120.000", status negative, bar penuh.
- **AC-BG-03** · Sisa per hari pada 20 Nov (S=1, sisa 150rb, 11 hari tersisa termasuk hari ini) = Rp 13.000 (dibulatkan ke bawah ke ribuan).
- **AC-BG-04** · Given anggaran 1jt mulai Okt · When di periode Nov diubah ke 1,5jt · Then Okt tetap 1jt, Nov dan Des 1,5jt.
- **AC-BG-05** · Hapus anggaran di Nov → Nov dan seterusnya tanpa anggaran, Okt tetap.
- **AC-BG-06** · Kategori dengan pengeluaran tanpa anggaran tampil di "Tanpa anggaran".
- **AC-BG-07** · Transfer dan income tidak memengaruhi anggaran.

### F. Periode
- **AC-PR-01** · S=1: 20 Nov 2026 → `2026-11`, 1–30 Nov.
- **AC-PR-02** · S=25: 24 Nov → `2026-11` (25 Okt–24 Nov). 25 Nov → `2026-12` (25 Nov–24 Des). 10 Jan 2027 → `2027-01` (25 Des–24 Jan).
- **AC-PR-03** · S=28, Februari non-kabisat: periode `2027-03` = 28 Feb–27 Mar.
- **AC-PR-04** · Mengubah S langsung mengubah pengelompokan Ringkasan/Anggaran tanpa mengubah data transaksi.
- **AC-PR-05** · Pemilih S hanya menawarkan 1–28.

### G. Transaksi berulang
- **AC-RC-01** · Given aturan bulanan anchor 31 Jan 2027 · Then kejadian: 31 Jan, 28 Feb, 31 Mar, 30 Apr (tidak bergeser ke 28).
- **AC-RC-02** · Given aturan bulanan tgl 1, app tidak dibuka 1 Nov–3 Des · When dibuka 3 Des · Then tercipta 1 Nov dan 1 Des (jika belum), banner "2 transaksi berulang dicatat".
- **AC-RC-03** · Generator dijalankan 2× berturut-turut → tidak ada duplikat.
- **AC-RC-04** · Hapus transaksi hasil generate lalu buka ulang app → tidak dibuat ulang.
- **AC-RC-05** · `endDate` terlewati → aturan menjadi tidak aktif dan tidak ada kejadian setelah endDate.
- **AC-RC-06** · Aturan mingguan interval 2 anchor Senin 2 Nov → 2, 16, 30 Nov.
- **AC-RC-07** · Aturan dibuat dari sheet input (chip Ulangi) dengan tanggal hari ini → tepat 1 transaksi hari ini + aturan dengan `generatedCount=1`.
- **AC-RC-08** · Aturan harian anchor 2 tahun lalu → maks. 400 kejadian per run, app tetap responsif, sisanya dibuat pada run berikutnya.
- **AC-RC-09** · Aktifkan kembali aturan yang dijeda → pilihan "Catat yang terlewat (N)" / "Lewati" berfungsi sesuai §5.3.
- **AC-RC-10** · Akun aturan diarsipkan → aturan dinonaktifkan dan tidak ada transaksi baru.

### H. Cari & filter
- **AC-SR-01** · Query "kopi" cocok dengan catatan "Kopi Kenangan" dan "KOPI". Query "cafe" cocok dengan "café".
- **AC-SR-02** · Query "25rb" cocok dengan transaksi amount 25000 saja.
- **AC-SR-03** · Filter Kategori (Makan, Transport) + Bulan lalu → hanya transaksi yang memenuhi semua filter. Ringkasan hasil menampilkan jumlah dan total.
- **AC-SR-04** · Filter Akun = BCA mencakup transfer dari/ke BCA.
- **AC-SR-05** · Filter nominal min 100rb maks 500rb inklusif.
- **AC-SR-06** · Tanpa hasil → "Tidak ada yang cocok" + Reset filter.

### I. Kategori & favorit
- **AC-CT-01** · Tambah kategori "Kopi" (ikon, warna) → muncul di grid input sesuai urutan.
- **AC-CT-02** · Drag ubah urutan → urutan grid input ikut berubah.
- **AC-CT-03** · Kategori yang punya transaksi → hanya bisa diarsipkan. Setelah diarsipkan hilang dari grid, tetap tampil di riwayat dan laporan. Pulihkan → kembali ke grid.
- **AC-CT-04** · Ganti nama kategori → semua transaksi lama menampilkan nama baru.
- **AC-CT-05** · Maksimal 12 favorit. Tombol tambah nonaktif pada favorit ke-12.

### J. Backup & data
- **AC-BK-01** · When tap "Buat backup" di iPhone · Then share sheet iOS muncul dengan file `arus-backup-YYYY-MM-DD.json`. Setelah disimpan, `lastBackupAt` terbarui. Batal → tidak terbarui.
- **AC-BK-02** · Round-trip: backup → hapus semua data → restore → semua tabel identik (deep equal kecuali field yang dikecualikan), saldo identik.
- **AC-BK-03** · File rusak, file bukan Arus, atau referensi tidak valid → ditolak dengan pesan spesifik, tanpa perubahan data.
- **AC-BK-04** · Pratinjau restore menampilkan jumlah data backup vs data saat ini sebelum konfirmasi.
- **AC-BK-05** · Simulasi gagal di tengah restore (throw di `bulkAdd`) → data lama utuh.
- **AC-BK-06** · Backup dengan `schemaVersion` lebih tinggi → ditolak dengan "Perbarui app dulu".
- **AC-BK-07** · CSV dibuka di Numbers/Excel: karakter "é", "—" tampil benar (BOM), catatan yang mengandung koma/kutip/baris baru tidak merusak kolom. Kolom sesuai §5.8.
- **AC-BK-08** · Pengingat muncul jika > N hari sejak backup **dan** ada transaksi baru. "Nanti" menyembunyikan 24 jam. Pengingat tidak muncul jika setting Mati.
- **AC-BK-09** · Hapus semua data memerlukan ketik `HAPUS`. Setelahnya data seed tersedia kembali.
- **AC-BK-10** · Backup tidak memuat hash PIN.

### K. Platform
- **AC-PW-01** · Setelah kunjungan pertama, mode pesawat + cold start → app terbuka, semua fitur berjalan.
- **AC-PW-02** · `storage.persist()` dipanggil setiap start. Status tampil di Data & Backup.
- **AC-PW-03** · Deploy versi baru → saat app dibuka atau di-resume, toast "Versi baru tersedia · Muat ulang" muncul (tidak saat sheet input berisi data). Tap → app memuat versi baru dan data tetap ada.
- **AC-PW-04** · Dibuka di tab Safari → banner instruksi pasang. Standalone → tidak ada banner.
- **AC-PW-05** · Konten tidak tertutup notch atau home indicator di iPhone dengan Face ID (safe-area). Tidak ada bounce pada body.
- **AC-PW-06** · `QuotaExceededError` saat menyimpan → pesan error tampil dan form tidak hilang.

### L. Tampilan & aksesibilitas
- **AC-UI-01** · Tema Sistem mengikuti `prefers-color-scheme` secara live. Terang/Gelap memaksa tema. Warna status bar/body ikut tema.
- **AC-UI-02** · Ukuran teks Besar/Lebih besar memperbesar seluruh teks tanpa elemen terpotong pada lebar 375 px.
- **AC-UI-03** · Semua target sentuh ≥ 44×44 pt. Kontras teks ≥ 4.5:1 (teks utama/sekunder) di kedua tema.
- **AC-UI-04** · `prefers-reduced-motion: reduce` → tidak ada animasi transform/slide, hanya fade ≤ 120 ms.
- **AC-UI-05** · Semua angka nominal memakai tabular-nums, sehingga digit sejajar pada kolom nominal.
- **AC-UI-06** · Tombol ikon punya `aria-label` bahasa Indonesia. Keypad bisa dioperasikan dengan VoiceOver.

### M. PIN
- **AC-PN-01** · Aktifkan PIN (6 digit, 2× sama) → cold start menampilkan layar kunci, dan konten tidak ada di DOM sampai PIN benar.
- **AC-PN-02** · `autoLockMinutes=1`: background 30 dtk → tidak terkunci. 70 dtk → terkunci.
- **AC-PN-03** · Salah 5× → input nonaktif 30 dtk. Reload tidak mereset penghitung.
- **AC-PN-04** · Settings menyimpan hash + salt, bukan PIN. Teks disclaimer "kunci tampilan, bukan enkripsi" tampil di layar Keamanan.
- **AC-PN-05** · Lupa PIN → hapus semua data (konfirmasi `HAPUS`) → app kembali ke kondisi seed tanpa PIN.

---

## 7. Struktur kode yang disarankan
```
src/
  db/        schema.ts, seed.ts, repo.ts (semua tulis), backup.ts, csv.ts, migrations.ts
  domain/    money.ts (format/parse), dates.ts, period.ts, balances.ts, budget.ts, recurring.ts, search.ts
  state/     settings.ts (hook), router.ts, undo.ts, toast.ts, lock.ts, sw.ts
  ui/        komponen dasar: Keypad, ListRow, Sheet, Segmented, Toast, NavBar, TabBar, Chip, Icon, Donut, Bars, Progress
  screens/   Transactions, AddSheet, Search, Summary, Budgets, Accounts, AccountDetail, Settings/*
  styles/    tokens.css (DESIGN.md), base.css
```
`domain/*` berisi fungsi murni tanpa Dexie dan merupakan target utama unit test.

---

## 8. Nanti (P2, bukan v1)
- Target tabungan (dana darurat, liburan) dengan progres.
- Operator `+ −` di keypad untuk menjumlah struk. Split transaksi ke beberapa kategori.
- Foto struk (lokal, dengan kompresi, perhatikan kuota).
- Deep link Shortcuts berparameter: `/?add=1&amount=25000&cat=<id>&note=…` (langsung simpan atau prefill).
- Insight sederhana ("Makan naik 20% dari bulan lalu").
- Backup otomatis berkala ke Files/iCloud Drive (iOS butuh gestur pengguna, jadi hanya bisa dibuat semi-otomatis).
- Restore mode **gabung** (merge berdasarkan `id` + `updatedAt`).
- Face ID lewat WebAuthn (passkey lokal) untuk membuka kunci. Enkripsi data at rest (AES-GCM dengan kunci turunan PIN), dengan konsekuensi data hilang jika lupa PIN.
- Rollover sisa anggaran. Anggaran total tanpa kategori.
- Biaya admin pada transfer. Tag/label.
- Subkategori (sengaja tidak di v1, lihat anti-pattern riset).
- Splash screen `apple-touch-startup-image`.
