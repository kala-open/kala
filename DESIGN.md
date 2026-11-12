# Kala Open Source: Design System & Architecture (`DESIGN.md`)

## 1. Brand Identity & Design Intent
- **Brand Name**: **Kala** (sebelumnya Nusa)
  - **Tagline**: *pendamping setiap kala*
  - **Filosofi**: *Kala* berasal dari bahasa Sanskerta dan bahasa Indonesia yang bermakna waktu, masa, atau momen. Nama ini mencerminkan esensi aplikasi sebagai *living notch* yang menemani pengguna dalam mengelola waktu kerja (Pomodoro), waktu jeda (hidrasi air minum), waktu ibadah (jadwal sholat astronomis Kemenag RI), waktu santai (musik dan lirik sinkron), serta aktivitas desktop harian.
- **Kala Mascot (Maskot Hidup di Notch)**:
  - Karakter: Makhluk asisten berwujud bola hitam berbulu halus (*dust bunny* / *soot sprite*) dengan sepasang mata bulat ekspresif dan pendaran aura ungu-biru lembut (`#2D5BFF` ke `#7B4BFF`).
  - Ekspresi dan Mood:
    1. *Idle / Siaga*: Tubuh bernapas lembut, mata berkedip alami dengan gerakan pupil (*saccades*) santai.
    2. *Peek / Notifikasi*: Mengintip penasaran dari tepi bawah bezel dengan kedua cakar kecil bersandar di notch.
    3. *Sleep / Istirahat*: Mata terpejam membentuk lengkung tidur damai (`⌒ ⌒`) dengan ritme napas lambat.
    4. *Happy / Sapaan*: Bereaksi riang saat diklik atau saat target tercapai dengan mata busur bahagia (`^ ^`) dan bintang berkilau (*sparkles* `#F4CAA8`).
    5. *Focus / Pomodoro*: Mata menyipit terfokus mendampingi sesi produktivitas pengguna.
- **Tipe Produk**: *Living desktop notch* lintas platform untuk **macOS, Linux, dan Windows** berbasis Tauri v2 dan Rust.
- **Geometri Native Hardware Notch**:
  - **Mode Idle (Pill Compact)**: Ukuran `360px x 46px`. Mengambang di puncak tengah layar tepat di bawah atau menyatu dengan bezel kamera laptop/monitor. Latar belakang jendela transparan (*alpha channel 0*), hanya pil hitam obsidian (`#0B0D12`) yang terlihat.
  - **Mode Expanded (Dynamic Island)**: Ukuran `680px x 440px`. Meluncur turun secara halus dengan sudut membulat bawah 22px (`border-radius: 0 0 22px 22px` pada gaya Classic atau `22px` pada gaya Floating).
  - **Multi-Window Native**:
    1. Jendela `notch`: Selalu berada di lapisan teratas (`alwaysOnTop: true`), tanpa dekorasi bilah judul OS (`decorations: false`), tembus pandang (`transparent: true`), dan dapat diubah ukurannya secara dinamis melalui perintah IPC Rust `resize_notch`.
    2. Jendela `settings`: Jendela pengaturan penuh dengan dekorasi OS standar, dapat dibuka kapan saja melalui menu tray sistem atau ikon roda gigi di notch.
- **Visual Dial**: `ENERGY 2 / RHYTHM 2 / MOTION 2`
  - `ENERGY 2`: Palet monokromatik gelap obsidian (`#0B0D12`) dengan aksen tunggal amber hangat `#F59E0B` dan indikator status hijau zamrud `#34D399`.
  - `RHYTHM 2`: Keseimbangan ritme antara pil idle yang ringkas dan ruang kerja 7 tab yang rapi saat diperluas.
  - `MOTION 2`: Transisi dinamis berdurasi 180ms menggunakan kurva `cubic-bezier(0.22, 1, 0.36, 1)`, otomatis dinonaktifkan jika preferensi reduced-motion aktif.

## 2. Alasan Tertulis Keputusan Visual (R-31 & Kepatuhan Antislop)
1. **Latar Belakang Jendela Transparan**:
   - *Alasan*: Agar living notch tampak menyatu dengan perangkat keras layar tanpa meninggalkan kotak persegi buram di desktop.
2. **Angka Monospace Tabular (`tabular-nums`)**:
   - *Alasan*: Digit pada timer Pomodoro, jam dunia, dan jadwal sholat memiliki lebar tetap sehingga teks tidak bergeser saat detik bertambah.
3. **Pemisahan Jendela Notch dan Pengaturan**:
   - *Alasan*: Pengguna desktop membutuhkan notch yang senyap dan tidak mengganggu alur kerja, sementara pengaturan mendalam 50 opsi ditempatkan di jendela sekunder yang dapat diminimalkan ke baki sistem (*tray*).
4. **Pemberian Nama Kala**:
   - *Alasan*: Memberikan identitas terbuka yang lebih universal, berakar pada konsep waktu (*kala*) dan produktivitas harian.
5. **Aksesibilitas Tanpa Batasan Lisensi Pro**:
   - *Alasan*: Menghapus pembatasan buatan dari biner asli sehingga 50 slot riwayat clipboard dan penyimpanan permanen langsung aktif secara cuma-cuma.

## 3. Matriks Kontras Warna Terverifikasi (WCAG 2.1 AA)
- **Dark Theme (Hardware Notch & Ruang Kerja)**:
  - Teks utama `#F3F5F8` di atas canvas `#0F1218`: rasio **17.17:1** (AAA)
  - Teks sekunder `#A6B0C3` di atas surface `#161B24`: rasio **7.91:1** (AAA)
  - Teks tombol `#0B0D12` di atas aksen amber `#F59E0B`: rasio **9.05:1** (AAA)
  - Batas kontrol UI `#6B7892` di atas surface `#161B24`: rasio **3.89:1** (Lolos non-teks 3.0:1)
- **Light Theme (Ruang Kerja Pengaturan)**:
  - Teks utama `#0F172A` di atas canvas `#F8FAFC`: rasio **17.06:1** (AAA)
  - Teks sekunder `#334155` di atas surface `#FFFFFF`: rasio **10.35:1** (AAA)
  - Teks tombol `#FFFFFF` di atas aksen amber `#B45309`: rasio **5.02:1** (AA)
  - Batas kontrol UI `#64748B` di atas surface `#FFFFFF`: rasio **4.76:1** (Lolos non-teks 3.0:1)
