# Catatan PWA iOS (riset Nov 2026)

Target: pencatat keuangan offline-first yang dipasang lewat "Add to Home Screen" di iPhone (iOS 17–26). Sumbernya campuran: dokumen resmi WebKit serta laporan bug dan forum. **Uji di perangkat asli.**

## 1. Persistensi IndexedDB
- **Batas 7 hari (ITP)**: berlaku untuk situs yang dibuka di tab Safari. Web app di Home Screen punya penghitung hari pemakaian sendiri, jadi praktis aman selama app tetap dibuka sesekali ([WebKit 2020](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)). Masih ada laporan data terhapus ([bug 237350](https://bugs.webkit.org/show_bug.cgi?id=237350), [bug 266559](https://bugs.webkit.org/show_bug.cgi?id=266559)).
- **Penyimpanan terpisah**: storage app Home Screen tidak dibagi dengan Safari. Data yang diisi di Safari tidak ikut terbawa ke app ([firt.dev](https://firt.dev/notes/pwa-ios/)).
- **Kuota (Safari 17+)**: maksimal sekitar 60% disk per origin dan 80% total. Web app Home Screen mendapat kuota yang sama dengan browser. Angka "50 MB" sudah usang ([WebKit Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/), [MDN](https://developer.mozilla.org/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)).
- **`navigator.storage.persist()`**: didukung. Izinnya diberikan lewat heuristik, salah satunya apakah app dibuka sebagai web app Home Screen. Pernah ada laporan selalu `false` ([bug 271401](https://bugs.webkit.org/show_bug.cgi?id=271401)). Panggil setiap kali app dibuka, catat hasilnya, dan tangani `QuotaExceededError`.
- **Kesimpulan**: IndexedDB cukup andal, tetapi **bukan cadangan**. Penghapusan data tetap bisa terjadi saat storage penuh, dan app yang dihapus dari Home Screen ikut menghapus datanya. Wajib ada ekspor rutin plus pengingat backup.

## 2. Manifest & meta
- iOS 26: setiap situs yang ditambahkan ke Home Screen otomatis terbuka sebagai web app. Manifest tetap dipakai (name, display `standalone`, icons, start_url, scope) ([WebKit WWDC25](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/), [firt.dev](https://firt.dev/notes/pwa-ios/)).
- **apple-touch-icon**: PNG 180×180, opak, tanpa sudut membulat. Tag ini mengalahkan ikon dari manifest. SVG hanya berlaku lewat manifest (iOS 26+). `maskable` diabaikan.
- **`apple-mobile-web-app-status-bar-style`**: berstatus deprecated, tetapi nilai `black-translucent` masih satu-satunya cara agar konten tergambar di belakang status bar. Ada laporan regresi di iOS 26.1 ([Glide](https://community.glideapps.com/t/webapp-status-bar-not-transparent-anymore/85272)). Saat Safari 26 memberi warna bar, warnanya mengikuti background halaman atau elemen fixed/sticky di tepi layar ([bug 301756](https://bugs.webkit.org/show_bug.cgi?id=301756)).
- **theme-color**: Safari 26 mengabaikannya. Warna bar diambil dari background `html`/`body`, jadi set background body dengan benar ([forum Apple](https://developer.apple.com/forums/thread/801239)).
- **Splash screen**: `apple-touch-startup-image` masih satu-satunya cara. Ukurannya harus persis per perangkat dan butuh meta `apple-mobile-web-app-capable`. Opsional: tanpa splash hanya muncul layar polos sebentar. Kalau mau dipakai, buat otomatis (`pwa-asset-generator`).
- **Viewport**: `width=device-width, initial-scale=1, viewport-fit=cover`, lalu padding memakai `env(safe-area-inset-top/bottom/left/right)`.

## 3. Gotcha UX standalone
- **Input zoom**: font input di bawah 16px membuat halaman zoom saat fokus. Pakai `font-size: 16px` minimal. Jangan memblokir zoom lewat `maximum-scale`.
- **Overscroll/bounce**: `overscroll-behavior: none` pada `html, body`. Jadikan `body` tetap dan gulir di container dalam.
- **Tinggi layar**: `100vh`, `svh`, dan `dvh` bermasalah di standalone, misalnya ada strip kosong selebar home indicator ([bug 254868](https://bugs.webkit.org/show_bug.cgi?id=254868), [bug 292603](https://bugs.webkit.org/show_bug.cgi?id=292603)). Pakai `100dvh` dengan fallback `100vh`, lalu uji.
- **Keyboard virtual**: `interactive-widget` tidak berlaku di WebKit. Gunakan `visualViewport` (height + offsetTop) untuk mengisi variabel CSS supaya tombol Simpan dan bottom sheet tetap di atas keyboard. Ada bug iOS 26: offsetTop tidak kembali ke 0 setelah keyboard ditutup ([forum Apple](https://developer.apple.com/forums/thread/800125)). `scrollIntoView` input saat fokus.
- **Haptics**: `navigator.vibrate` tidak ada. Trik `<input type=checkbox switch>` berjalan di iOS 17.4+, tetapi tidak resmi dan dilaporkan sudah ditambal di 26.5 ([ios-haptics](https://unpkg.com/ios-haptics@3.1.1/README.md)). Anggap sebagai bonus saja.
- **Tidak ada tombol back atau address bar**: sediakan navigasi back di UI dan gestur swipe. Pakai routing berbasis history. Link di luar scope terbuka di in-app browser.
- Tidak ada Background Sync. Push hanya untuk web app yang terpasang (iOS 16.4+).

## 4. Service worker
- Didukung sejak iOS 11.3, termasuk Cache Storage dan Navigation Preload (15.4). Background Sync dan Periodic Sync tidak didukung ([firt.dev](https://firt.dev/notes/pwa-ios/)).
- **Update**: pemeriksaan versi baru terjadi saat app dibuka atau navigasi. App standalone sering hanya di-resume dari background, jadi panggil `registration.update()` saat `visibilitychange` menjadi visible.
- **vite-plugin-pwa** ([docs](https://vite-pwa-org.netlify.app/guide/auto-update)):
  - `registerType: 'prompt'`: tampilkan toast "Versi baru – Muat ulang". Lebih aman untuk app data karena tidak mengganti versi di tengah pengisian form.
  - `workbox.globPatterns: ['**/*.{js,css,html,svg,png,woff2}']` untuk precache seluruh app shell. `navigateFallback: 'index.html'`.
  - Tidak butuh runtime caching API karena data ada di IndexedDB, bukan di SW.
  - Set header `Cache-Control: no-cache` untuk `sw.js` dan `index.html` di hosting.
  - Lakukan migrasi skema IndexedDB (versioning Dexie) saat app dimulai, bukan di SW.

## 5. Ekspor/impor backup
- **Andal: Web Share API dengan file** (`navigator.canShare({files})` → `navigator.share({files:[new File([json], 'backup.json', {type:'application/json'})]})`). Hasilnya share sheet iOS untuk "Save to Files", AirDrop, atau WhatsApp. Wajib dipicu oleh gestur pengguna ([web.dev](https://web.dev/patterns/files/share-files)).
- **Tidak andal: download blob `<a download>`** di mode standalone. Sering tidak terjadi apa-apa, atau app terjebak tanpa navigasi (iOS 18.4, [bug 290847](https://bugs.webkit.org/show_bug.cgi?id=290847), [bug 275288](https://bugs.webkit.org/show_bug.cgi?id=275288)). Pakai hanya sebagai fallback di desktop.
- **Impor: `<input type=file accept=".json,.csv,application/json,text/csv">`**: andal, karena membuka picker Files/iCloud. Baca dengan `file.text()`.
- CSV: tambahkan BOM UTF-8 supaya Excel dan Numbers membacanya dengan benar.

## 6. Hosting gratis (repo GitHub private)
| Opsi | Syarat/batas |
|---|---|
| **Cloudflare Pages** | Repo private didukung lewat GitHub App. Gratis: bandwidth statis tak terbatas, 500 build/bulan, 20.000 file, boleh komersial ([limits](https://developers.cloudflare.com/pages/platform/limits/)). Cloudflare kini juga mengarahkan project baru ke Workers Static Assets, yang tetap gratis. |
| Netlify | Repo private OK. Paket gratis berbasis kredit (300/bulan). Jika kredit habis, semua project di akun berhenti sampai siklus berikutnya. |
| Vercel Hobby | Repo private milik akun pribadi OK. **Non-komersial**. Repo milik organisasi butuh Pro. |
| GitHub Pages | Untuk repo private **butuh GitHub Pro/Team/Enterprise**. Situsnya tetap publik. Batas 1 GB, sekitar 100 GB/bulan. Tidak untuk komersial. |

**Rekomendasi: Cloudflare Pages.** Gratis tanpa batas bandwidth, mendukung repo private, dan header bisa diatur lewat file `_headers` (untuk `sw.js`). Opsional: Cloudflare Access gratis untuk mengunci URL hanya bagi email sendiri.

## 7. Alternatif tanpa biaya
- **Sideload dengan Apple ID gratis (AltStore/SideStore/Sideloadly)**: masa berlaku 7 hari, harus di-refresh, maksimal 3 app, dan butuh AltServer di PC. Jika lupa refresh, app tidak bisa dibuka. Membangun app native di iOS juga butuh Mac/Xcode atau layanan build cloud. **Tidak layak** untuk app harian.
- **AltStore PAL**: hanya untuk EU, dan developer tetap perlu Apple Developer Program ($99/tahun) untuk notarisasi.
- **Expo Go**: hanya untuk pengembangan, karena memuat dari dev server atau akun yang sama. Bukan sarana distribusi, dan penyimpanannya terikat sandbox Expo Go.
- **Penilaian**: PWA tetap pilihan terbaik tanpa biaya. Jika suatu saat butuh fitur native (widget, Face ID, iCloud sync), jalur yang realistis adalah Capacitor dengan Apple Developer berbayar.
