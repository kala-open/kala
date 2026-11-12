// Reconstructed 50 settings keys and default values from nusa.exe VA 0x1400e1320
export const DEFAULT_SETTINGS = {
  sound: 1,
  lyrics: 1,
  todo_start: 1,
  todo_end: 1,
  snooze: 10,
  week_monday: 0,
  focus: 25,
  short_break: 5,
  long_break: 15,
  hud_volume: 1,
  hud_brightness: 1,
  hud_caps: 1,
  hud_language: 1,
  popup_battery: 1,
  popup_wifi: 1,
  popup_bluetooth: 1,
  open_click: 0,
  page_icons: 1,
  fast_animation: 0,
  shelf_clear: 0,
  calendar_week: 0,
  hide_fullscreen: 1,
  prayer: 1,
  prayer_city: 17,
  prayer_reminder: 1,
  prayer_early: 0,
  prayer_sound: 0,
  // Stored as (offset_minutes + 10) in settings.txt so 10 = 0 min offset
  prayer_adj_subuh: 10,
  prayer_adj_dzuhur: 10,
  prayer_adj_ashar: 10,
  prayer_adj_maghrib: 10,
  prayer_adj_isya: 10,
  prayer_pause_media: 0,
  clipboard: 1,
  clipboard_max: 1,
  clipboard_keep: 1,
  status_ring: 0,
  todo_ordered: 0,
  notch_style: 0,
  glass: 1,
  glass_tint: 40,
  notifications: 1,
  notification_preview: 1,
  today_page: 1,
  widgets_page: 1,
  widget_left: 1,
  widget_right: 3,
  widget_city1: 5,
  widget_city2: 13,
  widget_event: 1
};

// Reconstructed 84 Indonesian cities across 38 provinces from nusa.exe VA 0x1400df470
export const PRAYER_CITIES = [
  { index: 0, name: "Banda Aceh", province: "Aceh", lat: 5.55, lon: 95.32, tz: 7 },
  { index: 1, name: "Lhokseumawe", province: "Aceh", lat: 5.18, lon: 97.14, tz: 7 },
  { index: 2, name: "Medan", province: "Sumatera Utara", lat: 3.59, lon: 98.67, tz: 7 },
  { index: 3, name: "Pematangsiantar", province: "Sumatera Utara", lat: 2.96, lon: 99.06, tz: 7 },
  { index: 4, name: "Binjai", province: "Sumatera Utara", lat: 3.60, lon: 98.49, tz: 7 },
  { index: 5, name: "Padang", province: "Sumatera Barat", lat: -0.95, lon: 100.35, tz: 7 },
  { index: 6, name: "Bukittinggi", province: "Sumatera Barat", lat: -0.31, lon: 100.37, tz: 7 },
  { index: 7, name: "Pekanbaru", province: "Riau", lat: 0.51, lon: 101.45, tz: 7 },
  { index: 8, name: "Dumai", province: "Riau", lat: 1.67, lon: 101.45, tz: 7 },
  { index: 9, name: "Batam", province: "Kepulauan Riau", lat: 1.05, lon: 104.03, tz: 7 },
  { index: 10, name: "Tanjungpinang", province: "Kepulauan Riau", lat: 0.92, lon: 104.46, tz: 7 },
  { index: 11, name: "Jambi", province: "Jambi", lat: -1.61, lon: 103.61, tz: 7 },
  { index: 12, name: "Palembang", province: "Sumatera Selatan", lat: -2.98, lon: 104.76, tz: 7 },
  { index: 13, name: "Lubuklinggau", province: "Sumatera Selatan", lat: -3.30, lon: 102.86, tz: 7 },
  { index: 14, name: "Pangkalpinang", province: "Kep. Bangka Belitung", lat: -2.13, lon: 106.12, tz: 7 },
  { index: 15, name: "Bengkulu", province: "Bengkulu", lat: -3.80, lon: 102.27, tz: 7 },
  { index: 16, name: "Bandar Lampung", province: "Lampung", lat: -5.43, lon: 105.27, tz: 7 },
  { index: 17, name: "Jakarta", province: "DKI Jakarta", lat: -6.20, lon: 106.85, tz: 7 },
  { index: 18, name: "Serang", province: "Banten", lat: -6.12, lon: 106.15, tz: 7 },
  { index: 19, name: "Tangerang", province: "Banten", lat: -6.18, lon: 106.63, tz: 7 },
  { index: 20, name: "Tangerang Selatan", province: "Banten", lat: -6.29, lon: 106.71, tz: 7 },
  { index: 21, name: "Cilegon", province: "Banten", lat: -6.00, lon: 106.04, tz: 7 },
  { index: 22, name: "Bandung", province: "Jawa Barat", lat: -6.92, lon: 107.62, tz: 7 },
  { index: 23, name: "Bekasi", province: "Jawa Barat", lat: -6.24, lon: 107.00, tz: 7 },
  { index: 24, name: "Depok", province: "Jawa Barat", lat: -6.40, lon: 106.82, tz: 7 },
  { index: 25, name: "Bogor", province: "Jawa Barat", lat: -6.60, lon: 106.80, tz: 7 },
  { index: 26, name: "Cirebon", province: "Jawa Barat", lat: -6.73, lon: 108.55, tz: 7 },
  { index: 27, name: "Tasikmalaya", province: "Jawa Barat", lat: -7.33, lon: 108.22, tz: 7 },
  { index: 28, name: "Sukabumi", province: "Jawa Barat", lat: -6.92, lon: 106.93, tz: 7 },
  { index: 29, name: "Karawang", province: "Jawa Barat", lat: -6.30, lon: 107.30, tz: 7 },
  { index: 30, name: "Garut", province: "Jawa Barat", lat: -7.22, lon: 107.90, tz: 7 },
  { index: 31, name: "Semarang", province: "Jawa Tengah", lat: -6.97, lon: 110.42, tz: 7 },
  { index: 32, name: "Surakarta", province: "Jawa Tengah", lat: -7.57, lon: 110.83, tz: 7 },
  { index: 33, name: "Pekalongan", province: "Jawa Tengah", lat: -6.89, lon: 109.68, tz: 7 },
  { index: 34, name: "Tegal", province: "Jawa Tengah", lat: -6.87, lon: 109.13, tz: 7 },
  { index: 35, name: "Magelang", province: "Jawa Tengah", lat: -7.48, lon: 110.22, tz: 7 },
  { index: 36, name: "Purwokerto", province: "Jawa Tengah", lat: -7.43, lon: 109.25, tz: 7 },
  { index: 37, name: "Kudus", province: "Jawa Tengah", lat: -6.80, lon: 110.84, tz: 7 },
  { index: 38, name: "Yogyakarta", province: "DI Yogyakarta", lat: -7.80, lon: 110.37, tz: 7 },
  { index: 39, name: "Surabaya", province: "Jawa Timur", lat: -7.26, lon: 112.75, tz: 7 },
  { index: 40, name: "Malang", province: "Jawa Timur", lat: -7.98, lon: 112.63, tz: 7 },
  { index: 41, name: "Kediri", province: "Jawa Timur", lat: -7.82, lon: 112.01, tz: 7 },
  { index: 42, name: "Madiun", province: "Jawa Timur", lat: -7.63, lon: 111.52, tz: 7 },
  { index: 43, name: "Jember", province: "Jawa Timur", lat: -8.17, lon: 113.70, tz: 7 },
  { index: 44, name: "Banyuwangi", province: "Jawa Timur", lat: -8.22, lon: 114.37, tz: 7 },
  { index: 45, name: "Sidoarjo", province: "Jawa Timur", lat: -7.45, lon: 112.72, tz: 7 },
  { index: 46, name: "Gresik", province: "Jawa Timur", lat: -7.16, lon: 112.65, tz: 7 },
  { index: 47, name: "Denpasar", province: "Bali", lat: -8.65, lon: 115.22, tz: 8 },
  { index: 48, name: "Singaraja", province: "Bali", lat: -8.11, lon: 115.09, tz: 8 },
  { index: 49, name: "Mataram", province: "Nusa Tenggara Barat", lat: -8.58, lon: 116.12, tz: 8 },
  { index: 50, name: "Bima", province: "Nusa Tenggara Barat", lat: -8.46, lon: 118.73, tz: 8 },
  { index: 51, name: "Kupang", province: "Nusa Tenggara Timur", lat: -10.18, lon: 123.58, tz: 8 },
  { index: 52, name: "Labuan Bajo", province: "Nusa Tenggara Timur", lat: -8.50, lon: 119.89, tz: 8 },
  { index: 53, name: "Pontianak", province: "Kalimantan Barat", lat: -0.03, lon: 109.33, tz: 7 },
  { index: 54, name: "Singkawang", province: "Kalimantan Barat", lat: 0.91, lon: 108.99, tz: 7 },
  { index: 55, name: "Palangkaraya", province: "Kalimantan Tengah", lat: -2.21, lon: 113.92, tz: 7 },
  { index: 56, name: "Banjarmasin", province: "Kalimantan Selatan", lat: -3.32, lon: 114.59, tz: 8 },
  { index: 57, name: "Banjarbaru", province: "Kalimantan Selatan", lat: -3.44, lon: 114.83, tz: 8 },
  { index: 58, name: "Samarinda", province: "Kalimantan Timur", lat: -0.50, lon: 117.15, tz: 8 },
  { index: 59, name: "Balikpapan", province: "Kalimantan Timur", lat: -1.27, lon: 116.83, tz: 8 },
  { index: 60, name: "Bontang", province: "Kalimantan Timur", lat: 0.13, lon: 117.50, tz: 8 },
  { index: 61, name: "Nusantara (IKN)", province: "Kalimantan Timur", lat: -0.97, lon: 116.71, tz: 8 },
  { index: 62, name: "Tarakan", province: "Kalimantan Utara", lat: 3.30, lon: 117.63, tz: 8 },
  { index: 63, name: "Tanjung Selor", province: "Kalimantan Utara", lat: 2.84, lon: 117.37, tz: 8 },
  { index: 64, name: "Manado", province: "Sulawesi Utara", lat: 1.49, lon: 124.84, tz: 8 },
  { index: 65, name: "Bitung", province: "Sulawesi Utara", lat: 1.44, lon: 125.18, tz: 8 },
  { index: 66, name: "Gorontalo", province: "Gorontalo", lat: 0.54, lon: 123.06, tz: 8 },
  { index: 67, name: "Palu", province: "Sulawesi Tengah", lat: -0.90, lon: 119.87, tz: 8 },
  { index: 68, name: "Mamuju", province: "Sulawesi Barat", lat: -2.68, lon: 118.89, tz: 8 },
  { index: 69, name: "Makassar", province: "Sulawesi Selatan", lat: -5.14, lon: 119.43, tz: 8 },
  { index: 70, name: "Parepare", province: "Sulawesi Selatan", lat: -4.01, lon: 119.63, tz: 8 },
  { index: 71, name: "Palopo", province: "Sulawesi Selatan", lat: -3.00, lon: 120.20, tz: 8 },
  { index: 72, name: "Kendari", province: "Sulawesi Tenggara", lat: -3.99, lon: 122.52, tz: 8 },
  { index: 73, name: "Baubau", province: "Sulawesi Tenggara", lat: -5.47, lon: 122.63, tz: 8 },
  { index: 74, name: "Ambon", province: "Maluku", lat: -3.69, lon: 128.18, tz: 9 },
  { index: 75, name: "Tual", province: "Maluku", lat: -5.63, lon: 132.75, tz: 9 },
  { index: 76, name: "Ternate", province: "Maluku Utara", lat: 0.79, lon: 127.38, tz: 9 },
  { index: 77, name: "Sofifi", province: "Maluku Utara", lat: 0.74, lon: 127.56, tz: 9 },
  { index: 78, name: "Jayapura", province: "Papua", lat: -2.53, lon: 140.72, tz: 9 },
  { index: 79, name: "Manokwari", province: "Papua Barat", lat: -0.86, lon: 134.08, tz: 9 },
  { index: 80, name: "Sorong", province: "Papua Barat Daya", lat: -0.88, lon: 131.26, tz: 9 },
  { index: 81, name: "Merauke", province: "Papua Selatan", lat: -8.49, lon: 140.40, tz: 9 },
  { index: 82, name: "Nabire", province: "Papua Tengah", lat: -3.37, lon: 135.50, tz: 9 },
  { index: 83, name: "Wamena", province: "Papua Pegunungan", lat: -4.10, lon: 138.95, tz: 9 }
];

// Reconstructed 18 World Clock cities from nusa.exe widget table
export const WORLD_CITIES = [
  { index: 0, name: "Jakarta", offset: 7 },
  { index: 1, name: "Makassar", offset: 8 },
  { index: 2, name: "Jayapura", offset: 9 },
  { index: 3, name: "Singapore", offset: 8 },
  { index: 4, name: "Kuala Lumpur", offset: 8 },
  { index: 5, name: "Tokyo", offset: 9 },
  { index: 6, name: "Seoul", offset: 9 },
  { index: 7, name: "Sydney", offset: 10 },
  { index: 8, name: "Makkah", offset: 3 },
  { index: 9, name: "Madinah", offset: 3 },
  { index: 10, name: "Dubai", offset: 4 },
  { index: 11, name: "Istanbul", offset: 3 },
  { index: 12, name: "Cairo", offset: 2 },
  { index: 13, name: "London", offset: 0 },
  { index: 14, name: "Paris", offset: 1 },
  { index: 15, name: "Berlin", offset: 1 },
  { index: 16, name: "New York", offset: -5 },
  { index: 17, name: "Los Angeles", offset: -8 }
];

// Reconstructed 6 Countdown events from nusa.exe
export const COUNTDOWN_EVENTS = [
  { index: 0, name: "New Year", month: 1, day: 1 },
  { index: 1, name: "Ramadan", month: 2, day: 18 },
  { index: 2, name: "Eid al-Fitr", month: 3, day: 20 },
  { index: 3, name: "Eid al-Adha", month: 5, day: 27 },
  { index: 4, name: "Independence Day (RI)", month: 8, day: 17 },
  { index: 5, name: "Christmas", month: 12, day: 25 }
];

export const WIDGET_TYPES = [
  { index: 0, name: "This week" },
  { index: 1, name: "Next prayer" },
  { index: 2, name: "Focus today" },
  { index: 3, name: "World clock" },
  { index: 4, name: "Moon phase" },
  { index: 5, name: "Countdown" }
];

export const DEMO_TRACKS = [
  {
    id: "nusa-1",
    title: "Sore di Taman Kota",
    artist: "Hindia",
    album: "Lagipula Hidup Akan Berakhir",
    durationSec: 214,
    lyrics: [
      { time: 0, text: "Menatap langit sore dari balik jendela" },
      { time: 18, text: "Langkah kaki pelan menyusuri trotoar kota" },
      { time: 42, text: "Di antara deru mesin dan lampu jalanan" },
      { time: 75, text: "Kita belajar bernapas di sela kesibukan" },
      { time: 120, text: "Semoga hari esok membawa teduh yang baru" }
    ]
  },
  {
    id: "nusa-2",
    title: "Evaluasi",
    artist: "Hindia",
    album: "Menari Dengan Bayangan",
    durationSec: 195,
    lyrics: [
      { time: 0, text: "Yang tak membuatmu mati, membuatmu lebih kuat" },
      { time: 24, text: "Basuh mukamu, lihat ke cermin hari ini" },
      { time: 58, text: "Semua masalah yang terasa berat kemarin" },
      { time: 96, text: "Perlahan terurai satu demi satu" },
      { time: 140, text: "Istirahatlah sejenak, esok kita mulai lagi" }
    ]
  },
  {
    id: "nusa-3",
    title: "Monokrom",
    artist: "Tulus",
    album: "Monokrom",
    durationSec: 216,
    lyrics: [
      { time: 0, text: "Lembaran foto hitam putih" },
      { time: 28, text: "Aku coba ingat lagi warna bajumu kala itu" },
      { time: 65, text: "Kali pertama di hidupku manusia lain memelukku" },
      { time: 112, text: "Di mana pun kalian berada, kukirimkan terima kasih" },
      { time: 165, text: "Untuk warna dalam hidupku dan banyak kenangan indah" }
    ]
  }
];

export function computeKemenagPrayerSchedule(cityIndex, settings, referenceDate = new Date()) {
  const city = PRAYER_CITIES[cityIndex] || PRAYER_CITIES[17];
  const startOfYear = new Date(referenceDate.getFullYear(), 0, 0);
  const diff = referenceDate - startOfYear;
  const dayOfYear = Math.floor(diff / 86400000);

  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1);
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const latRad = (city.lat * Math.PI) / 180;
  const transitHours = 12 + city.tz - city.lon / 15 - eqTime / 60;

  const hourAngle = (altitudeDeg) => {
    const altRad = (altitudeDeg * Math.PI) / 180;
    const cosHa =
      (Math.sin(altRad) - Math.sin(latRad) * Math.sin(decl)) /
      (Math.cos(latRad) * Math.cos(decl));
    const clamped = Math.max(-1, Math.min(1, cosHa));
    return (Math.acos(clamped) * 180) / Math.PI / 15;
  };

  const asharAltDeg =
    (Math.atan(1 / (1 + Math.tan(Math.abs(latRad - decl)))) * 180) / Math.PI;

  const adj = (key) => (Number(settings[key] ?? 10) - 10);
  const toMinutes = (hours, ihtiyat, offset) =>
    (((Math.round(hours * 60) + ihtiyat + offset) % 1440) + 1440) % 1440;
  const fmt = (mins) =>
    `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

  const mSubuh = toMinutes(transitHours - hourAngle(-20.0), 2, adj("prayer_adj_subuh"));
  const mDzuhur = toMinutes(transitHours, 2, adj("prayer_adj_dzuhur"));
  const mAshar = toMinutes(transitHours + hourAngle(asharAltDeg), 2, adj("prayer_adj_ashar"));
  const mMaghrib = toMinutes(transitHours + hourAngle(-0.833), 2, adj("prayer_adj_maghrib"));
  const mIsya = toMinutes(transitHours + hourAngle(-18.0), 2, adj("prayer_adj_isya"));

  const nowMins = referenceDate.getHours() * 60 + referenceDate.getMinutes();
  const slots = [
    { name: "Subuh", mins: mSubuh, time: fmt(mSubuh), key: "prayer_adj_subuh" },
    { name: "Dzuhur", mins: mDzuhur, time: fmt(mDzuhur), key: "prayer_adj_dzuhur" },
    { name: "Ashar", mins: mAshar, time: fmt(mAshar), key: "prayer_adj_ashar" },
    { name: "Maghrib", mins: mMaghrib, time: fmt(mMaghrib), key: "prayer_adj_maghrib" },
    { name: "Isya", mins: mIsya, time: fmt(mIsya), key: "prayer_adj_isya" }
  ];

  let nextSlot = slots[0];
  let found = false;
  for (const s of slots) {
    if (s.mins > nowMins) {
      nextSlot = s;
      found = true;
      break;
    }
  }
  const minutesUntilNext = found ? nextSlot.mins - nowMins : 1440 - nowMins + mSubuh;
  const tzLabel = city.tz === 7 ? "WIB (UTC+7)" : city.tz === 8 ? "WITA (UTC+8)" : "WIT (UTC+9)";

  return {
    city: city.name,
    province: city.province,
    lat: city.lat,
    lon: city.lon,
    tzLabel,
    slots,
    nextName: nextSlot.name,
    nextTime: nextSlot.time,
    minutesUntilNext
  };
}

export function computeMoonPhase(date = new Date()) {
  const synodicMonth = 29.53058867;
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14, 0);
  const daysSince = (date.getTime() - knownNewMoon) / 86400000;
  const phase = ((daysSince % synodicMonth) + synodicMonth) % synodicMonth;
  const normalized = phase / synodicMonth;
  const illumination = Math.round(((1 - Math.cos(normalized * 2 * Math.PI)) / 2) * 100);
  const fullMoonAge = synodicMonth / 2;
  const daysToFull =
    phase <= fullMoonAge
      ? Math.max(0, Math.round(fullMoonAge - phase))
      : Math.round(synodicMonth - phase + fullMoonAge);

  let phaseName = "Waxing Crescent";
  if (normalized < 0.03 || normalized > 0.97) phaseName = "New Moon";
  else if (normalized < 0.22) phaseName = "Waxing Crescent";
  else if (normalized < 0.28) phaseName = "First Quarter";
  else if (normalized < 0.47) phaseName = "Waxing Gibbous";
  else if (normalized < 0.53) phaseName = "Full Moon";
  else if (normalized < 0.72) phaseName = "Waning Gibbous";
  else if (normalized < 0.78) phaseName = "Last Quarter";
  else phaseName = "Waning Crescent";

  return { illumination, daysToFull, phaseName };
}
