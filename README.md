# Kala: Living Desktop Notch (Tauri v2 & Rust)

> **Kala** (tagline: *pendamping setiap kala*) adalah aplikasi *living desktop notch* lintas platform untuk **macOS, Linux, dan Windows** yang dibangun dengan **Tauri v2** dan **Rust**, terinspirasi dari https://rama2555.github.io/nusa/.

Proyek ini menghadirkan pengalaman antarmuka *hardware notch* modern yang hidup di desktop pengguna, didampingi maskot interaktif, kalkulator jadwal sholat metode Kemenag RI untuk 84 kota di 38 provinsi, lirik lagu tersinkronisasi via LRCLIB, pengatur fokus Pomodoro, pelacak hidrasi air minum, rak berkas (*file shelf*), riwayat clipboard 50 slot permanen, serta dasbor pengaturan lengkap dengan 50 kunci konfigurasi asli (`settings.txt`).

---

## Arsitektur Dua Jendela (Multi-Window Architecture)

Aplikasi Kala menggunakan arsitektur dua jendela native independen:

1. **Jendela Desktop Notch (`notch.html` + `src/notch.js`)**:
   - Jendela transparan di puncak layar (`alwaysOnTop: true`, `decorations: false`, `transparent: true`).
   - Pada macOS, jendela ditempatkan tepat di tepi atas bezel kamera laptop/monitor menggunakan Cocoa AppKit patch (`place_at_top_bezel`).
   - Mendukung navigasi halus 7 mode widget: Musik & Lirik, Pomodoro, Air Minum, File Shelf, Clipboard, To-Do List, dan Jadwal Sholat.
   - Dilengkapi maskot kanvas prosedural hidup (*soot sprite* / *dust bunny*) yang bereaksi terhadap kursor mouse, ketukan, dan status tugas.

2. **Jendela Pengaturan & Dasbor (`index.html` + `src/app.js`)**:
   - Jendela aplikasi reguler bertajuk *Kala: Pengaturan*.
   - Menyediakan antarmuka manajemen tugas harian (`tasks.txt`), pelacak hidrasi air minum, pratinjau sholat 84 kota, rak berkas, dan 50 opsi setelan kustom.
   - Terhubung secara persisten dengan notch melalui `kala_todos_v1` dan `kala_settings_v1`.
   - Menggunakan mekanisme *hide-on-close* sehingga penutupan jendela (`✕`) tidak mematikan aplikasi dan dapat dimunculkan kembali seketika via menu klik kanan notch atau menu tray.

---

## Struktur Berkas Proyek

```text
kala/
├── package.json               # Konfigurasi skrip npm dan CLI Tauri v2
├── README.md                  # Panduan pengembang, arsitektur, dan cara build
├── DESIGN.md                  # Panduan desain, filosofi brand Kala, dan audit aksesibilitas
├── LICENSE                    # Lisensi MIT
├── index.html                 # Antarmuka jendela Pengaturan & Dasbor Utama
├── notch.html                 # Antarmuka jendela Desktop Living Notch
├── src/
│   ├── app.js                 # Logika kontrol jendela Pengaturan, To-Do CRUD, dan form UI
│   ├── notch.js               # Runtime jendela notch, transisi kartu, dan sinkronisasi IPC
│   ├── mascot.js              # Mesin maskot kanvas (animasi bernapas, saccades mata, reaksi emosi)
│   ├── audio.js               # Sintesis efek suara UI dan lo-fi generator via Web Audio API
│   ├── data.js                # Definisi 50 preferensi, kalkulator Kemenag RI, dan daftar 84 kota
│   ├── styles.css             # Sistem desain CSS (Dark & Light theme, glassmorphism, responsif)
│   └── assets/                # Aset ikon dan grafis aplikasi
└── src-tauri/
    ├── Cargo.toml             # Konfigurasi dependensi Rust (Tauri 2.2, Cocoa, WebKit)
    ├── build.rs               # Skrip kompilasi aset Tauri
    ├── tauri.conf.json        # Konfigurasi jendela multi-window, izin IPC, dan bundle OS
    ├── capabilities/
    │   └── default.json       # Kebijakan izin keamanan jendela (permissions)
    ├── icons/                 # Berkas ikon multi-resolusi untuk berbagai sistem operasi
    └── src/
        ├── main.rs            # Titik masuk biner desktop
        └── lib.rs             # Backend Rust: IPC commands, background workers, Cocoa AppKit windowing
```

---

## Fitur Utama

1. **Living Notch & Maskot Kala**:
   - Mode istirahat (*pet/idle*) dengan maskot bola bulu yang bernapas dan melacak posisi kursor.
   - Mode diperluas (*expanded*) dengan tombol navigasi carousel dan auto-collapse saat kursor menjauh.
   - Menu konteks klik kanan: beralih mode maskot, buka Pengaturan, atau keluar aplikasi.

2. **Musik & Lirik Bersinkronisasi**:
   - Pemutar audio terintegrasi dengan gelombang visualiser suara.
   - Pengambilan lirik bersinkronisasi waktu nyata dari API LRCLIB (`https://lrclib.net/`).
   - Tampilan lirik berpusat vertikal (*vertical mask scrolling*) dengan opsi *click-to-seek*.

3. **Pomodoro Focus Timer**:
   - Siklus 4 ronde fokus dengan durasi fokus, istirahat pendek, dan istirahat panjang yang dapat disesuaikan.
   - Timer native berjalan stabil di thread latar belakang Rust.

4. **To-Do List Harian Terintegrasi**:
   - Penambahan tugas baru via jendela Pengaturan atau pintasan pada notch.
   - Checkbox penyelesaian tugas yang langsung memberikan reaksi bahagia pada maskot Kala.
   - Sinkronisasi instan dua arah antara jendela Pengaturan dan Desktop Notch.

5. **Pelacak Hidrasi Air Minum**:
   - Visualisasi status botol minum dan progres harian terhadap target cairan pengguna.
   - Tombol cepat catat konsumsi segelas air (200 ml), isi ulang botol, dan reset.

6. **Jadwal Sholat Astronomis Kemenag RI**:
   - Mendukung 84 kota acuan di seluruh 38 provinsi di Indonesia.
   - Rumus perhitungan hisab astronomis resmi Kementerian Agama RI dengan sudut Subuh `-20°`, Ashar Syafi'i, Maghrib `-0.833°`, Isya `-18°`, serta penyesuaian waktu ihtiyat (+2 menit).
   - Opsi penyesuaian koreksi menit individual per waktu sholat (`prayer_adj_*`).

7. **File Shelf & Riwayat Clipboard**:
   - Tempat meletakkan berkas, berkas `.kalatext`, atau URL cepat (`shelf.txt`).
   - Riwayat 50 entri papan klip tersimpan permanen antar sesi tanpa batasan.

---

## Panduan Memulai untuk Pengembang

### 1. Prasyarat Sistem
- **Node.js**: Versi 18 ke atas.
- **Rust Toolchain**: `rustup` dengan Rust stable versi terbaru.
- **Dependensi OS**:
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`).
  - **Linux**: `libwebkit2gtk-4.1-dev`, `build-essential`, `curl`, `wget`, `file`, `libssl-dev`, `libayatana-appindicator3-dev`.
  - **Windows**: Microsoft Visual Studio C++ Build Tools & WebView2.

### 2. Menjalankan Server Pengembangan

Jalankan server file lokal untuk frontend:
```bash
npm run dev
```

Di terminal terpisah, jalankan aplikasi desktop Tauri:
```bash
npm run tauri:dev
```

### 3. Memeriksa dan Membangun Proyek

Untuk memeriksa validitas kode Rust:
```bash
npm run check
```

Untuk mengompilasi biner mode debug secara langsung:
```bash
npm run build:rust
```

Untuk memaketkan paket instalasi rilis (.dmg di macOS, .deb/.AppImage di Linux, .msi di Windows):
```bash
npm run tauri:build
```

---

## Konvensi Kode & Kontribusi
- **Gaya Penulisan**: Mengutamakan kode yang bersih, mudah dipahami, minim dependensi luar yang berlebihan, dan menjaga kompatibilitas format berkas status asli.
- **Aksesibilitas (A11y)**: Memenuhi rasio kontras WCAG 2.1 AA/AAA pada tema gelap maupun terang.
- **Bebas Em Dash**: Seluruh teks UI, salinan kode, dan dokumentasi konsisten menggunakan tanda baca standar seperti titik dua, koma, titik, atau tanda kurung.

---

## Inspirasi & Kredit

Proyek ini terinspirasi dari https://rama2555.github.io/nusa/ oleh [@rama2555](https://github.com/rama2555). Dikembangkan ulang sebagai aplikasi desktop open-source lintas platform yang menyatukan estetika hardware notch, maskot interaktif, sinkronisasi lirik LRCLIB, pengatur fokus Pomodoro, pelacak hidrasi, jadwal sholat astronomis Kemenag RI, serta kontrol preferensi lengkap.

