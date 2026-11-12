#![allow(deprecated, unexpected_cfgs)]

use chrono::{Datelike, Local, Timelike};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, State, WebviewWindow,
};

// Keys and defaults match the 50-entry table at VA 0x1400e1320 in the reference binary.
pub const DEFAULT_SETTINGS: &[(&str, i32)] = &[
    ("sound", 1),
    ("lyrics", 1),
    ("todo_start", 1),
    ("todo_end", 1),
    ("snooze", 10),
    ("week_monday", 0),
    ("focus", 25),
    ("short_break", 5),
    ("long_break", 15),
    ("hud_volume", 1),
    ("hud_brightness", 1),
    ("hud_caps", 1),
    ("hud_language", 1),
    ("popup_battery", 1),
    ("popup_wifi", 1),
    ("popup_bluetooth", 1),
    ("open_click", 0),
    ("page_icons", 1),
    ("fast_animation", 0),
    ("shelf_clear", 0),
    ("calendar_week", 0),
    ("hide_fullscreen", 1),
    ("prayer", 1),
    ("prayer_city", 17),
    ("prayer_reminder", 1),
    ("prayer_early", 0),
    ("prayer_sound", 0),
    // Stored as (offset_minutes + 10) so unsigned integers in settings.txt represent -10..+10 min.
    ("prayer_adj_subuh", 10),
    ("prayer_adj_dzuhur", 10),
    ("prayer_adj_ashar", 10),
    ("prayer_adj_maghrib", 10),
    ("prayer_adj_isya", 10),
    ("prayer_pause_media", 0),
    ("clipboard", 1),
    ("clipboard_max", 1),
    ("clipboard_keep", 1),
    ("status_ring", 0),
    ("todo_ordered", 0),
    ("notch_style", 0),
    ("glass", 0),
    ("glass_tint", 40),
    ("notifications", 1),
    ("notification_preview", 0),
    ("today_page", 1),
    ("widgets_page", 1),
    ("widget_left", 0),
    ("widget_right", 1),
    ("widget_city1", 5),
    ("widget_city2", 13),
    ("widget_event", 1),
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrayerCity {
    pub index: usize,
    pub name: &'static str,
    pub province: &'static str,
    pub lat: f64,
    pub lon: f64,
    pub tz: i32,
}

pub const PRAYER_CITIES: &[PrayerCity] = &[
    PrayerCity { index: 0, name: "Banda Aceh", province: "Aceh", lat: 5.55, lon: 95.32, tz: 7 },
    PrayerCity { index: 1, name: "Lhokseumawe", province: "Aceh", lat: 5.18, lon: 97.14, tz: 7 },
    PrayerCity { index: 2, name: "Medan", province: "Sumatera Utara", lat: 3.59, lon: 98.67, tz: 7 },
    PrayerCity { index: 3, name: "Pematangsiantar", province: "Sumatera Utara", lat: 2.96, lon: 99.06, tz: 7 },
    PrayerCity { index: 4, name: "Binjai", province: "Sumatera Utara", lat: 3.60, lon: 98.49, tz: 7 },
    PrayerCity { index: 5, name: "Padang", province: "Sumatera Barat", lat: -0.95, lon: 100.35, tz: 7 },
    PrayerCity { index: 6, name: "Bukittinggi", province: "Sumatera Barat", lat: -0.31, lon: 100.37, tz: 7 },
    PrayerCity { index: 7, name: "Pekanbaru", province: "Riau", lat: 0.51, lon: 101.45, tz: 7 },
    PrayerCity { index: 8, name: "Dumai", province: "Riau", lat: 1.67, lon: 101.45, tz: 7 },
    PrayerCity { index: 9, name: "Batam", province: "Kepulauan Riau", lat: 1.05, lon: 104.03, tz: 7 },
    PrayerCity { index: 10, name: "Tanjungpinang", province: "Kepulauan Riau", lat: 0.92, lon: 104.46, tz: 7 },
    PrayerCity { index: 11, name: "Jambi", province: "Jambi", lat: -1.61, lon: 103.61, tz: 7 },
    PrayerCity { index: 12, name: "Palembang", province: "Sumatera Selatan", lat: -2.98, lon: 104.76, tz: 7 },
    PrayerCity { index: 13, name: "Lubuklinggau", province: "Sumatera Selatan", lat: -3.30, lon: 102.86, tz: 7 },
    PrayerCity { index: 14, name: "Pangkalpinang", province: "Kep. Bangka Belitung", lat: -2.13, lon: 106.12, tz: 7 },
    PrayerCity { index: 15, name: "Bengkulu", province: "Bengkulu", lat: -3.80, lon: 102.27, tz: 7 },
    PrayerCity { index: 16, name: "Bandar Lampung", province: "Lampung", lat: -5.43, lon: 105.27, tz: 7 },
    PrayerCity { index: 17, name: "Jakarta", province: "DKI Jakarta", lat: -6.20, lon: 106.85, tz: 7 },
    PrayerCity { index: 18, name: "Serang", province: "Banten", lat: -6.12, lon: 106.15, tz: 7 },
    PrayerCity { index: 19, name: "Tangerang", province: "Banten", lat: -6.18, lon: 106.63, tz: 7 },
    PrayerCity { index: 20, name: "Tangerang Selatan", province: "Banten", lat: -6.29, lon: 106.71, tz: 7 },
    PrayerCity { index: 21, name: "Cilegon", province: "Banten", lat: -6.00, lon: 106.04, tz: 7 },
    PrayerCity { index: 22, name: "Bandung", province: "Jawa Barat", lat: -6.92, lon: 107.62, tz: 7 },
    PrayerCity { index: 23, name: "Bekasi", province: "Jawa Barat", lat: -6.24, lon: 107.00, tz: 7 },
    PrayerCity { index: 24, name: "Depok", province: "Jawa Barat", lat: -6.40, lon: 106.82, tz: 7 },
    PrayerCity { index: 25, name: "Bogor", province: "Jawa Barat", lat: -6.60, lon: 106.80, tz: 7 },
    PrayerCity { index: 26, name: "Cirebon", province: "Jawa Barat", lat: -6.73, lon: 108.55, tz: 7 },
    PrayerCity { index: 27, name: "Tasikmalaya", province: "Jawa Barat", lat: -7.33, lon: 108.22, tz: 7 },
    PrayerCity { index: 28, name: "Sukabumi", province: "Jawa Barat", lat: -6.92, lon: 106.93, tz: 7 },
    PrayerCity { index: 29, name: "Karawang", province: "Jawa Barat", lat: -6.30, lon: 107.30, tz: 7 },
    PrayerCity { index: 30, name: "Garut", province: "Jawa Barat", lat: -7.22, lon: 107.90, tz: 7 },
    PrayerCity { index: 31, name: "Semarang", province: "Jawa Tengah", lat: -6.97, lon: 110.42, tz: 7 },
    PrayerCity { index: 32, name: "Surakarta", province: "Jawa Tengah", lat: -7.57, lon: 110.83, tz: 7 },
    PrayerCity { index: 33, name: "Pekalongan", province: "Jawa Tengah", lat: -6.89, lon: 109.68, tz: 7 },
    PrayerCity { index: 34, name: "Tegal", province: "Jawa Tengah", lat: -6.87, lon: 109.13, tz: 7 },
    PrayerCity { index: 35, name: "Magelang", province: "Jawa Tengah", lat: -7.48, lon: 110.22, tz: 7 },
    PrayerCity { index: 36, name: "Purwokerto", province: "Jawa Tengah", lat: -7.43, lon: 109.25, tz: 7 },
    PrayerCity { index: 37, name: "Kudus", province: "Jawa Tengah", lat: -6.80, lon: 110.84, tz: 7 },
    PrayerCity { index: 38, name: "Yogyakarta", province: "DI Yogyakarta", lat: -7.80, lon: 110.37, tz: 7 },
    PrayerCity { index: 39, name: "Surabaya", province: "Jawa Timur", lat: -7.26, lon: 112.75, tz: 7 },
    PrayerCity { index: 40, name: "Malang", province: "Jawa Timur", lat: -7.98, lon: 112.63, tz: 7 },
    PrayerCity { index: 41, name: "Kediri", province: "Jawa Timur", lat: -7.82, lon: 112.01, tz: 7 },
    PrayerCity { index: 42, name: "Madiun", province: "Jawa Timur", lat: -7.63, lon: 111.52, tz: 7 },
    PrayerCity { index: 43, name: "Jember", province: "Jawa Timur", lat: -8.17, lon: 113.70, tz: 7 },
    PrayerCity { index: 44, name: "Banyuwangi", province: "Jawa Timur", lat: -8.22, lon: 114.37, tz: 7 },
    PrayerCity { index: 45, name: "Sidoarjo", province: "Jawa Timur", lat: -7.45, lon: 112.72, tz: 7 },
    PrayerCity { index: 46, name: "Gresik", province: "Jawa Timur", lat: -7.16, lon: 112.65, tz: 7 },
    PrayerCity { index: 47, name: "Denpasar", province: "Bali", lat: -8.65, lon: 115.22, tz: 8 },
    PrayerCity { index: 48, name: "Singaraja", province: "Bali", lat: -8.11, lon: 115.09, tz: 8 },
    PrayerCity { index: 49, name: "Mataram", province: "Nusa Tenggara Barat", lat: -8.58, lon: 116.12, tz: 8 },
    PrayerCity { index: 50, name: "Bima", province: "Nusa Tenggara Barat", lat: -8.46, lon: 118.73, tz: 8 },
    PrayerCity { index: 51, name: "Kupang", province: "Nusa Tenggara Timur", lat: -10.18, lon: 123.58, tz: 8 },
    PrayerCity { index: 52, name: "Labuan Bajo", province: "Nusa Tenggara Timur", lat: -8.50, lon: 119.89, tz: 8 },
    PrayerCity { index: 53, name: "Pontianak", province: "Kalimantan Barat", lat: -0.03, lon: 109.33, tz: 7 },
    PrayerCity { index: 54, name: "Singkawang", province: "Kalimantan Barat", lat: 0.91, lon: 108.99, tz: 7 },
    PrayerCity { index: 55, name: "Palangkaraya", province: "Kalimantan Tengah", lat: -2.21, lon: 113.92, tz: 7 },
    PrayerCity { index: 56, name: "Banjarmasin", province: "Kalimantan Selatan", lat: -3.32, lon: 114.59, tz: 8 },
    PrayerCity { index: 57, name: "Banjarbaru", province: "Kalimantan Selatan", lat: -3.44, lon: 114.83, tz: 8 },
    PrayerCity { index: 58, name: "Samarinda", province: "Kalimantan Timur", lat: -0.50, lon: 117.15, tz: 8 },
    PrayerCity { index: 59, name: "Balikpapan", province: "Kalimantan Timur", lat: -1.27, lon: 116.83, tz: 8 },
    PrayerCity { index: 60, name: "Bontang", province: "Kalimantan Timur", lat: 0.13, lon: 117.50, tz: 8 },
    PrayerCity { index: 61, name: "Nusantara (IKN)", province: "Kalimantan Timur", lat: -0.97, lon: 116.71, tz: 8 },
    PrayerCity { index: 62, name: "Tarakan", province: "Kalimantan Utara", lat: 3.30, lon: 117.63, tz: 8 },
    PrayerCity { index: 63, name: "Tanjung Selor", province: "Kalimantan Utara", lat: 2.84, lon: 117.37, tz: 8 },
    PrayerCity { index: 64, name: "Manado", province: "Sulawesi Utara", lat: 1.49, lon: 124.84, tz: 8 },
    PrayerCity { index: 65, name: "Bitung", province: "Sulawesi Utara", lat: 1.44, lon: 125.18, tz: 8 },
    PrayerCity { index: 66, name: "Gorontalo", province: "Gorontalo", lat: 0.54, lon: 123.06, tz: 8 },
    PrayerCity { index: 67, name: "Palu", province: "Sulawesi Tengah", lat: -0.90, lon: 119.87, tz: 8 },
    PrayerCity { index: 68, name: "Mamuju", province: "Sulawesi Barat", lat: -2.68, lon: 118.89, tz: 8 },
    PrayerCity { index: 69, name: "Makassar", province: "Sulawesi Selatan", lat: -5.14, lon: 119.43, tz: 8 },
    PrayerCity { index: 70, name: "Parepare", province: "Sulawesi Selatan", lat: -4.01, lon: 119.63, tz: 8 },
    PrayerCity { index: 71, name: "Palopo", province: "Sulawesi Selatan", lat: -3.00, lon: 120.20, tz: 8 },
    PrayerCity { index: 72, name: "Kendari", province: "Sulawesi Tenggara", lat: -3.99, lon: 122.52, tz: 8 },
    PrayerCity { index: 73, name: "Baubau", province: "Sulawesi Tenggara", lat: -5.47, lon: 122.63, tz: 8 },
    PrayerCity { index: 74, name: "Ambon", province: "Maluku", lat: -3.69, lon: 128.18, tz: 9 },
    PrayerCity { index: 75, name: "Tual", province: "Maluku", lat: -5.63, lon: 132.75, tz: 9 },
    PrayerCity { index: 76, name: "Ternate", province: "Maluku Utara", lat: 0.79, lon: 127.38, tz: 9 },
    PrayerCity { index: 77, name: "Sofifi", province: "Maluku Utara", lat: 0.74, lon: 127.56, tz: 9 },
    PrayerCity { index: 78, name: "Jayapura", province: "Papua", lat: -2.53, lon: 140.72, tz: 9 },
    PrayerCity { index: 79, name: "Manokwari", province: "Papua Barat", lat: -0.86, lon: 134.08, tz: 9 },
    PrayerCity { index: 80, name: "Sorong", province: "Papua Barat Daya", lat: -0.88, lon: 131.26, tz: 9 },
    PrayerCity { index: 81, name: "Merauke", province: "Papua Selatan", lat: -8.49, lon: 140.40, tz: 9 },
    PrayerCity { index: 82, name: "Nabire", province: "Papua Tengah", lat: -3.37, lon: 135.50, tz: 9 },
    PrayerCity { index: 83, name: "Wamena", province: "Papua Pegunungan", lat: -4.10, lon: 138.95, tz: 9 },
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrayerSchedule {
    pub city: String,
    pub province: String,
    pub tz_label: String,
    pub subuh: String,
    pub dzuhur: String,
    pub ashar: String,
    pub maghrib: String,
    pub isya: String,
    pub next_name: String,
    pub next_time: String,
    pub minutes_until_next: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardItem {
    pub text: String,
    pub ts: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PomodoroState {
    pub active: bool,
    pub secs_left: u32,
    pub phase: String,
    pub round: u32,
    pub total_rounds: u32,
}

pub struct AppState {
    pub data_dir: PathBuf,
    pub settings: Mutex<BTreeMap<String, i32>>,
    pub clipboards: Mutex<Vec<ClipboardItem>>,
    pub pomo_state: Mutex<PomodoroState>,
}

impl AppState {
    pub fn new() -> Self {
        let base_dir = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
        let data_dir = base_dir.join("Kala");
        let _ = fs::create_dir_all(&data_dir);

        let mut map = BTreeMap::new();
        for (k, v) in DEFAULT_SETTINGS {
            map.insert((*k).to_string(), *v);
        }

        let kala_settings = data_dir.join("settings.txt");
        let legacy_nusa_settings = base_dir.join("Nusa").join("settings.txt");

        // Migrate existing Nusa settings if Kala has not written its own file yet.
        let file_to_read = if kala_settings.exists() {
            Some(kala_settings)
        } else if legacy_nusa_settings.exists() {
            Some(legacy_nusa_settings)
        } else {
            None
        };

        if let Some(path) = file_to_read {
            if let Ok(content) = fs::read_to_string(path) {
                for line in content.lines() {
                    if let Some((k, v)) = line.trim().split_once('=') {
                        if let Ok(parsed) = v.trim().parse::<i32>() {
                            if map.contains_key(k.trim()) {
                                map.insert(k.trim().to_string(), parsed);
                            }
                        }
                    }
                }
            }
        }

        let focus_mins = map.get("focus").copied().unwrap_or(25) as u32;

        Self {
            data_dir,
            settings: Mutex::new(map),
            clipboards: Mutex::new(Vec::new()),
            pomo_state: Mutex::new(PomodoroState {
                active: false,
                secs_left: focus_mins * 60,
                phase: "focus".to_string(),
                round: 1,
                total_rounds: 4,
            }),
        }
    }

    pub fn persist_settings(&self, map: &BTreeMap<String, i32>) {
        let mut out = String::new();
        for (k, _) in DEFAULT_SETTINGS {
            if let Some(val) = map.get(*k) {
                out.push_str(&format!("{}={}\n", k, val));
            }
        }
        let _ = fs::write(self.data_dir.join("settings.txt"), out);
    }
}

// Kemenag RI criteria: Subuh -20 deg, Maghrib -0.833 deg, Isya -18 deg, Shafi'i Ashar shadow + 2m Ihtiyath.
pub fn calculate_kemenag_prayer(city_index: usize, settings: &BTreeMap<String, i32>) -> PrayerSchedule {
    let city = PRAYER_CITIES
        .get(city_index)
        .unwrap_or(&PRAYER_CITIES[17]);

    let now = Local::now();
    let day_of_year = now.ordinal() as f64;
    let gamma = 2.0 * std::f64::consts::PI / 365.0 * (day_of_year - 1.0);

    let eq_time = 229.18
        * (0.000075 + 0.001868 * gamma.cos()
            - 0.032077 * gamma.sin()
            - 0.014615 * (2.0 * gamma).cos()
            - 0.040849 * (2.0 * gamma).sin());

    let decl = 0.006918 - 0.399912 * gamma.cos() + 0.070257 * gamma.sin()
        - 0.006758 * (2.0 * gamma).cos()
        + 0.000907 * (2.0 * gamma).sin()
        - 0.002697 * (3.0 * gamma).cos()
        + 0.00148 * (3.0 * gamma).sin();

    let lat_rad = city.lat.to_radians();
    let transit_hours = 12.0 + (city.tz as f64) - (city.lon / 15.0) - (eq_time / 60.0);

    let hour_angle = |altitude_deg: f64| -> f64 {
        let alt_rad = altitude_deg.to_radians();
        let cos_ha = (alt_rad.sin() - lat_rad.sin() * decl.sin()) / (lat_rad.cos() * decl.cos());
        cos_ha.clamp(-1.0, 1.0).acos().to_degrees() / 15.0
    };

    let ashar_alt = (1.0 / (1.0 + (lat_rad - decl).abs().tan())).atan().to_degrees();

    let adj = |key: &str| -> i32 { settings.get(key).copied().unwrap_or(10) - 10 };
    let to_minutes = |hours: f64, ihtiyat: i32, offset: i32| -> i32 {
        ((hours * 60.0).round() as i32 + ihtiyat + offset).rem_euclid(1440)
    };
    let fmt_hhmm = |mins: i32| -> String { format!("{:02}:{:02}", mins / 60, mins % 60) };

    let m_subuh = to_minutes(transit_hours - hour_angle(-20.0), 2, adj("prayer_adj_subuh"));
    let m_dzuhur = to_minutes(transit_hours, 2, adj("prayer_adj_dzuhur"));
    let m_ashar = to_minutes(transit_hours + hour_angle(ashar_alt), 2, adj("prayer_adj_ashar"));
    let m_maghrib = to_minutes(transit_hours + hour_angle(-0.833), 2, adj("prayer_adj_maghrib"));
    let m_isya = to_minutes(transit_hours + hour_angle(-18.0), 2, adj("prayer_adj_isya"));

    let now_mins = (now.hour() as i32) * 60 + (now.minute() as i32);
    let slots = [
        ("Subuh", m_subuh),
        ("Dzuhur", m_dzuhur),
        ("Ashar", m_ashar),
        ("Maghrib", m_maghrib),
        ("Isya", m_isya),
    ];

    let mut next_name = "Subuh".to_string();
    let mut next_mins = m_subuh;
    let mut found = false;
    for (name, mins) in slots {
        if mins > now_mins {
            next_name = name.to_string();
            next_mins = mins;
            found = true;
            break;
        }
    }
    let minutes_until_next = if found {
        next_mins - now_mins
    } else {
        (1440 - now_mins) + m_subuh
    };

    let tz_label = match city.tz {
        7 => "WIB (UTC+7)",
        8 => "WITA (UTC+8)",
        _ => "WIT (UTC+9)",
    };

    PrayerSchedule {
        city: city.name.to_string(),
        province: city.province.to_string(),
        tz_label: tz_label.to_string(),
        subuh: fmt_hhmm(m_subuh),
        dzuhur: fmt_hhmm(m_dzuhur),
        ashar: fmt_hhmm(m_ashar),
        maghrib: fmt_hhmm(m_maghrib),
        isya: fmt_hhmm(m_isya),
        next_name,
        next_time: fmt_hhmm(next_mins),
        minutes_until_next,
    }
}

#[cfg(target_os = "macos")]
mod macos_notch {
    use cocoa::appkit::{NSScreen, NSWindow, NSWindowCollectionBehavior};
    use cocoa::base::{id, nil, BOOL, NO, YES};
    use cocoa::foundation::{NSPoint, NSRect, NSSize, NSString};
    use objc::runtime::{Object, Sel};
    use objc::{msg_send, sel, sel_impl};
    use std::sync::Once;
    use tauri::WebviewWindow;

    extern "C" {
        fn class_replaceMethod(
            cls: *mut objc::runtime::Class,
            name: objc::runtime::Sel,
            imp: objc::runtime::Imp,
            types: *const std::os::raw::c_char,
        ) -> objc::runtime::Imp;
    }

    static PATCH_CONSTRAIN_ONCE: Once = Once::new();

    // AppKit's default constrainFrameRect:toScreen: pushes windows below the system menu bar.
    // Returning frame_rect unchanged lets the notch window sit flush with the top screen bezel (y = 0).
    extern "C" fn unconstrained_frame_rect(
        _this: &Object,
        _cmd: Sel,
        frame_rect: NSRect,
        _screen: id,
    ) -> NSRect {
        frame_rect
    }

    extern "C" fn can_become_key_window(_this: &Object, _cmd: Sel) -> BOOL {
        YES
    }

    pub fn place_at_top_bezel(window: &WebviewWindow, width: f64, height: f64) {
        let Ok(raw_ns_win) = window.ns_window() else {
            return;
        };
        unsafe {
            let ns_win = raw_ns_win as id;
            if ns_win == nil {
                return;
            }

            PATCH_CONSTRAIN_ONCE.call_once(|| {
                let cls: *mut objc::runtime::Class = msg_send![ns_win, class];
                if !cls.is_null() {
                    let sel = sel!(constrainFrameRect:toScreen:);
                    let imp: extern "C" fn(&Object, Sel, NSRect, id) -> NSRect =
                        unconstrained_frame_rect;
                    let types = b"{CGRect={CGPoint=dd}{CGSize=dd}}@:{CGRect={CGPoint=dd}{CGSize=dd}}@\0";
                    let _ = class_replaceMethod(
                        cls,
                        sel,
                        std::mem::transmute(imp),
                        types.as_ptr() as *const _,
                    );

                    let sel_key = sel!(canBecomeKeyWindow);
                    let imp_key: extern "C" fn(&Object, Sel) -> BOOL = can_become_key_window;
                    let _ = class_replaceMethod(
                        cls,
                        sel_key,
                        std::mem::transmute(imp_key),
                        b"c@:\0".as_ptr() as *const _,
                    );
                }
            });

            // Level 26 sits directly above NSMainMenuWindowLevel (24) and NSStatusWindowLevel (25).
            let _: () = msg_send![ns_win, setLevel: 26_i64];
            let _: () = msg_send![ns_win, setHasShadow: NO];
            let _: () = msg_send![ns_win, setOpaque: NO];

            let behavior = NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces
                | NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary
                | NSWindowCollectionBehavior::NSWindowCollectionBehaviorIgnoresCycle
                | NSWindowCollectionBehavior::NSWindowCollectionBehaviorFullScreenAuxiliary;
            ns_win.setCollectionBehavior_(behavior);

            let screen: id = msg_send![ns_win, screen];
            let target_screen = if screen != nil {
                screen
            } else {
                NSScreen::mainScreen(nil)
            };

            if target_screen != nil {
                let screen_frame: NSRect = NSScreen::frame(target_screen);
                let x = screen_frame.origin.x + (screen_frame.size.width - width) / 2.0;
                let y = screen_frame.origin.y + screen_frame.size.height - height;
                let rect = NSRect::new(NSPoint::new(x, y), NSSize::new(width, height));
                let _: () = msg_send![ns_win, setFrame: rect display: YES];
            }
        }
    }

    pub fn detect_hardware_notch(target_screen: id) -> (bool, f64, f64) {
        unsafe {
            if target_screen == nil {
                return (false, 0.0, 0.0);
            }
            let sel_tl = sel!(auxiliaryTopLeftArea);
            let sel_tr = sel!(auxiliaryTopRightArea);
            let responds_tl: bool = msg_send![target_screen, respondsToSelector: sel_tl];
            let responds_tr: bool = msg_send![target_screen, respondsToSelector: sel_tr];
            if responds_tl && responds_tr {
                let tl: NSRect = msg_send![target_screen, auxiliaryTopLeftArea];
                let tr: NSRect = msg_send![target_screen, auxiliaryTopRightArea];
                if tl.size.width > 0.0 && tr.size.width > 0.0 {
                    let notch_w = tr.origin.x - (tl.origin.x + tl.size.width);
                    let notch_h = tl.size.height;
                    if notch_w > 50.0 && notch_h > 10.0 {
                        return (true, notch_w, notch_h);
                    }
                }
            }
        }
        (false, 0.0, 0.0)
    }

    pub fn disable_app_nap() {
        unsafe {
            let process_info: id = msg_send![objc::class!(NSProcessInfo), processInfo];
            if process_info != nil {
                let reason = cocoa::foundation::NSString::alloc(nil).init_str("Kala desktop companion");
                let _: id = msg_send![
                    process_info,
                    beginActivityWithOptions: 0x00FFFFFF_u64
                    reason: reason
                ];
            }
        }
    }
}

fn apply_notch_geometry_dims(notch_win: &WebviewWindow, width: f64, height: f64) {
    let _ = notch_win.set_size(tauri::LogicalSize::new(width, height));

    #[cfg(target_os = "macos")]
    {
        macos_notch::place_at_top_bezel(notch_win, width, height);
    }

    #[cfg(not(target_os = "macos"))]
    {
        if let Ok(Some(monitor)) = notch_win.current_monitor() {
            let scale = monitor.scale_factor();
            let screen_width = monitor.size().width as f64 / scale;
            let x = (screen_width - width) / 2.0;
            let _ = notch_win.set_position(tauri::LogicalPosition::new(x, 0.0));
        }
    }
}

fn apply_notch_geometry(notch_win: &WebviewWindow, _expanded: bool) {
    apply_notch_geometry_dims(notch_win, 720.0, 160.0);
}

#[derive(serde::Serialize)]
pub struct ScreenNotchInfo {
    pub has_notch: bool,
    pub width: f64,
    pub height: f64,
}

#[tauri::command]
fn get_screen_notch_info(_app: AppHandle) -> ScreenNotchInfo {
    #[cfg(target_os = "macos")]
    {
        use cocoa::appkit::NSScreen;
        use cocoa::base::nil;
        let main_screen = unsafe { NSScreen::mainScreen(nil) };
        let (has_notch, width, height) = macos_notch::detect_hardware_notch(main_screen);
        return ScreenNotchInfo {
            has_notch,
            width,
            height,
        };
    }
    #[allow(unreachable_code)]
    ScreenNotchInfo {
        has_notch: false,
        width: 0.0,
        height: 0.0,
    }
}

#[tauri::command]
fn get_settings(state: State<'_, AppState>) -> BTreeMap<String, i32> {
    state.settings.lock().unwrap().clone()
}

#[tauri::command]
fn update_setting(
    key: String,
    value: i32,
    state: State<'_, AppState>,
    app: AppHandle,
) -> BTreeMap<String, i32> {
    let mut map = state.settings.lock().unwrap();
    if map.contains_key(&key) {
        map.insert(key, value);
        state.persist_settings(&map);
    }
    let snapshot = map.clone();
    let _ = app.emit("kala://settings-updated", &snapshot);
    snapshot
}

#[tauri::command]
fn set_setting(
    key: String,
    value: serde_json::Value,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    let int_val = match value {
        serde_json::Value::Number(n) => n.as_i64().unwrap_or(0) as i32,
        serde_json::Value::Bool(b) => if b { 1 } else { 0 },
        serde_json::Value::String(s) => s.parse::<i32>().unwrap_or(0),
        _ => 0,
    };
    update_setting(key, int_val, state, app);
    Ok(())
}

#[tauri::command]
fn reset_settings(state: State<'_, AppState>, app: AppHandle) -> BTreeMap<String, i32> {
    let mut map = state.settings.lock().unwrap();
    for (k, v) in DEFAULT_SETTINGS {
        map.insert((*k).to_string(), *v);
    }
    state.persist_settings(&map);
    let snapshot = map.clone();
    let _ = app.emit("kala://settings-updated", &snapshot);
    snapshot
}

#[tauri::command]
fn get_prayer_schedule(state: State<'_, AppState>) -> PrayerSchedule {
    let map = state.settings.lock().unwrap();
    let city_idx = map.get("prayer_city").copied().unwrap_or(17) as usize;
    calculate_kemenag_prayer(city_idx, &map)
}

fn url_encode(input: &str) -> String {
    let mut encoded = String::new();
    for b in input.bytes() {
        match b {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(b as char);
            }
            _ => {
                encoded.push_str(&format!("%{:02X}", b));
            }
        }
    }
    encoded
}

#[tauri::command]
fn fetch_lrclib_lyrics(track_name: String, artist_name: String) -> Result<serde_json::Value, String> {
    let clean_title = track_name.split('(').next().unwrap_or(&track_name).trim();
    let url = format!(
        "https://lrclib.net/api/search?track_name={}&artist_name={}",
        url_encode(clean_title),
        url_encode(&artist_name)
    );
    if let Ok(resp) = ureq::get(&url)
        .set("User-Agent", "Kala/1.0.2 (+https://github.com/kala-open/kala)")
        .call()
    {
        if let Ok(json) = resp.into_json::<serde_json::Value>() {
            if let Some(arr) = json.as_array() {
                if !arr.is_empty() {
                    return Ok(json);
                }
            }
        }
    }

    // Fallback: search with keyword query "clean_title artist_name"
    let query = format!("{} {}", clean_title, artist_name);
    let fallback_url = format!(
        "https://lrclib.net/api/search?q={}",
        url_encode(&query)
    );
    let fallback_resp = ureq::get(&fallback_url)
        .set("User-Agent", "Kala/1.0.2 (+https://github.com/kala-open/kala)")
        .call()
        .map_err(|e| format!("LRCLIB request failed: {}", e))?;
    fallback_resp.into_json::<serde_json::Value>()
        .map_err(|e| format!("Invalid LRCLIB JSON response: {}", e))
}

#[tauri::command]
fn resize_notch(
    width: Option<f64>,
    height: Option<f64>,
    expanded: Option<bool>,
    app: AppHandle,
) -> Result<(), String> {
    let (w, h) = if let (Some(w), Some(h)) = (width, height) {
        (w, h)
    } else if expanded.unwrap_or(false) {
        (720.0, 160.0)
    } else {
        (440.0, 48.0)
    };
    let app_handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        if let Some(notch_win) = app_handle.get_webview_window("notch") {
            apply_notch_geometry_dims(&notch_win, w, h);
        }
    });
    Ok(())
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn open_settings_window(app: AppHandle) -> Result<(), String> {
    let app_handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        #[cfg(target_os = "macos")]
        {
            use objc::{sel, sel_impl};
            unsafe {
                let ns_app = cocoa::appkit::NSApp();
                if ns_app != cocoa::base::nil {
                    let _: () = objc::msg_send![ns_app, activateIgnoringOtherApps: cocoa::base::YES];
                }
            }
        }

        if let Some(main_win) = app_handle.get_webview_window("main") {
            let _ = main_win.show();
            let _ = main_win.unminimize();
            let _ = main_win.set_focus();
        } else {
            let _ = tauri::WebviewWindowBuilder::new(
                &app_handle,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("Kala: Pengaturan")
            .inner_size(1080.0, 780.0)
            .resizable(true)
            .decorations(true)
            .build();
        }
    });
    Ok(())
}

pub fn get_system_battery() -> (f64, bool) {
    #[cfg(target_os = "macos")]
    {
        if let Ok(output) = std::process::Command::new("pmset").arg("-g").arg("batt").output() {
            let text = String::from_utf8_lossy(&output.stdout);
            let mut pct = 100.0;
            if let Some(idx) = text.find('%') {
                let prefix = &text[..idx];
                if let Some(start) = prefix.rfind(|c: char| !c.is_numeric()) {
                    if let Ok(p) = prefix[start + 1..].trim().parse::<f64>() {
                        pct = p;
                    }
                }
            }
            let is_charging = text.contains("charging") || text.contains("AC Power") || text.contains("charged");
            return (pct, is_charging);
        }
    }
    (100.0, true)
}

pub fn get_system_clipboard() -> Option<String> {
    #[cfg(target_os = "macos")]
    {
        if let Ok(output) = std::process::Command::new("pbpaste").output() {
            if output.status.success() {
                let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !text.is_empty() {
                    return Some(text);
                }
            }
        }
    }
    None
}

#[allow(unused_variables)]
pub fn set_system_clipboard(text: &str) {
    #[cfg(target_os = "macos")]
    {
        use std::io::Write;
        if let Ok(mut child) = std::process::Command::new("pbcopy")
            .stdin(std::process::Stdio::piped())
            .spawn()
        {
            if let Some(mut stdin) = child.stdin.take() {
                let _ = stdin.write_all(text.as_bytes());
            }
            let _ = child.wait();
        }
    }
}

#[allow(unused_variables)]
pub fn trigger_system_notification(title: &str, body: &str) {
    #[cfg(target_os = "macos")]
    {
        let script = format!(
            r#"display notification "{}" with title "{}" sound name "Glass""#,
            body.replace('"', "\\\""),
            title.replace('"', "\\\"")
        );
        let _ = std::process::Command::new("osascript").arg("-e").arg(script).spawn();
    }
}

pub fn get_macos_media_status() -> Option<serde_json::Value> {
    #[cfg(target_os = "macos")]
    {
        let script = r#"
        tell application "System Events"
            set isSpotify to (exists (processes where bundle identifier is "com.spotify.client"))
            set isMusic to (exists (processes where bundle identifier is "com.apple.Music"))
        end tell
        if isSpotify then
            tell application "Spotify"
                try
                    set s to (player state as string)
                    if s is "playing" or s is "paused" then
                        set tr to current track
                        set tName to (name of tr)
                        set tArtist to ""
                        try
                            set tArtist to (artist of tr)
                        end try
                        set tAlbum to ""
                        try
                            set tAlbum to (album of tr)
                        end try
                        set tArt to ""
                        try
                            set tArt to (artwork url of tr)
                        end try
                        set tDur to (((duration of tr) / 1000) as integer)
                        set tPos to ((player position) as integer)
                        return s & ":::" & tName & ":::" & tArtist & ":::" & tAlbum & ":::" & tDur & ":::" & tPos & ":::" & tArt
                    end if
                end try
            end tell
        end if
        if isMusic then
            tell application "Music"
                try
                    set s to (player state as string)
                    if s is "playing" or s is "paused" then
                        set tr to current track
                        set tName to (name of tr)
                        set tArtist to ""
                        try
                            set tArtist to (artist of tr)
                        end try
                        set tAlbum to ""
                        try
                            set tAlbum to (album of tr)
                        end try
                        set tArt to ""
                        set tDur to ((duration of tr) as integer)
                        set tPos to ((player position) as integer)
                        return s & ":::" & tName & ":::" & tArtist & ":::" & tAlbum & ":::" & tDur & ":::" & tPos & ":::" & tArt
                    end if
                end try
            end tell
        end if
        return "idle"
        "#;
        if let Ok(output) = std::process::Command::new("osascript").arg("-e").arg(script).output() {
            let res = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if res == "idle" {
                return Some(serde_json::json!({
                    "source": "idle",
                    "playing": false
                }));
            }
            let parts: Vec<&str> = res.split(":::").collect();
            if parts.len() >= 6 {
                let status = parts[0];
                let title = parts[1].to_string();
                let artist = parts[2].to_string();
                let album = parts[3].to_string();
                let duration = parts[4].replace(',', ".").trim().parse::<f64>().unwrap_or(200.0) as u32;
                let position = parts[5].replace(',', ".").trim().parse::<f64>().unwrap_or(0.0) as u32;
                let artwork = if parts.len() >= 7 {
                    parts[6].trim().to_string()
                } else {
                    String::new()
                };
                return Some(serde_json::json!({
                    "title": title,
                    "artist": artist,
                    "album": album,
                    "duration": duration,
                    "position": position,
                    "artwork": artwork,
                    "playing": status == "playing",
                    "source": "system"
                }));
            }
        }
    }
    None
}

fn start_background_workers(app: AppHandle) {
    std::thread::spawn(move || {
        let mut loop_count: u64 = 0;
        let mut last_minute: u32 = 99;
        let mut last_clipboard = String::new();

        loop {
            std::thread::sleep(Duration::from_millis(1000));
            loop_count = loop_count.wrapping_add(1);

            // 1. Clock Tick & Prayer Check
            let now = Local::now();
            let minute = now.minute();
            if minute != last_minute {
                last_minute = minute;
                let clock_str = now.format("%H:%M").to_string();
                let _ = app.emit("kala:clock-tick", serde_json::json!({
                    "time": clock_str,
                    "hour": now.hour(),
                    "minute": now.minute()
                }));

                if let Some(state) = app.try_state::<AppState>() {
                    let map = state.settings.lock().unwrap();
                    let city_idx = map.get("prayer_city").copied().unwrap_or(17) as usize;
                    let sched = calculate_kemenag_prayer(city_idx, &map);
                    if sched.minutes_until_next <= 0 && map.get("prayer_reminder").copied().unwrap_or(1) == 1 {
                        let title = format!("Waktunya Sholat {}", sched.next_name);
                        let body = format!("Adzan {} ({}) telah tiba", sched.next_name, sched.city);
                        trigger_system_notification(&title, &body);
                        let _ = app.emit("kala:notify", serde_json::json!({ "title": title, "body": body }));
                    }
                }
            }

            // 2. Native Pomodoro Tick in Background
            if let Some(state) = app.try_state::<AppState>() {
                let mut pomo = state.pomo_state.lock().unwrap();
                if pomo.active {
                    if pomo.secs_left > 0 {
                        pomo.secs_left -= 1;
                        let _ = app.emit("kala:pomo-tick", pomo.clone());
                    } else {
                        let was_focus = pomo.phase == "focus";
                        if was_focus {
                            pomo.round += 1;
                            if pomo.round > pomo.total_rounds {
                                pomo.round = 1;
                            }
                            let is_long = pomo.round % 4 == 0;
                            pomo.phase = if is_long { "long".to_string() } else { "short".to_string() };
                            let mins = if is_long { 15 } else { 5 };
                            pomo.secs_left = mins * 60;

                            let title = "Sesi Fokus Selesai! 🎉";
                            let body = if is_long {
                                "Kerja hebat! Ambil istirahat panjang 15 menit ☕"
                            } else {
                                "Saatnya istirahat sejenak 5 menit ☕"
                            };
                            trigger_system_notification(title, body);
                            let _ = app.emit("kala:notify", serde_json::json!({ "title": title, "body": body }));
                        } else {
                            pomo.phase = "focus".to_string();
                            pomo.secs_left = 25 * 60;
                            let title = "Waktu Istirahat Berakhir! 🚀";
                            let body = format!("Siap untuk ronde fokus ke-{}? Mari mulai!", pomo.round);
                            trigger_system_notification(title, &body);
                            let _ = app.emit("kala:notify", serde_json::json!({ "title": title, "body": body }));
                        }
                        let _ = app.emit("kala:pomo-tick", pomo.clone());
                    }
                }
            }

            // 3. Real System Battery Polling (every 5 seconds)
            if loop_count % 5 == 0 {
                let (pct, charging) = get_system_battery();
                let _ = app.emit("kala:battery", serde_json::json!({
                    "pct": pct,
                    "charging": charging
                }));
            }

            // 4. Real System Clipboard Polling (every 1 second)
            if let Some(clip_text) = get_system_clipboard() {
                if clip_text != last_clipboard && !clip_text.trim().is_empty() {
                    last_clipboard = clip_text.clone();
                    if let Some(state) = app.try_state::<AppState>() {
                        let mut list = state.clipboards.lock().unwrap();
                        list.retain(|item| item.text != clip_text);
                        list.insert(0, ClipboardItem {
                            text: clip_text,
                            ts: chrono::Utc::now().timestamp_millis(),
                        });
                        if list.len() > 20 {
                            list.truncate(20);
                        }
                        let _ = app.emit("kala:clipboard-update", serde_json::json!({ "items": *list }));
                    }
                }
            }

            // 5. Real Media Polling (every 2 seconds)
            if loop_count % 2 == 0 {
                if let Some(media) = get_macos_media_status() {
                    let _ = app.emit("kala:music-update", media);
                }
            }
        }
    });
}

#[tauri::command]
fn start_pomodoro(state: State<'_, AppState>, app: AppHandle) -> PomodoroState {
    let mut pomo = state.pomo_state.lock().unwrap();
    pomo.active = true;
    let snapshot = pomo.clone();
    let _ = app.emit("kala:pomo-tick", &snapshot);
    snapshot
}

#[tauri::command]
fn pause_pomodoro(state: State<'_, AppState>, app: AppHandle) -> PomodoroState {
    let mut pomo = state.pomo_state.lock().unwrap();
    pomo.active = false;
    let snapshot = pomo.clone();
    let _ = app.emit("kala:pomo-tick", &snapshot);
    snapshot
}

#[tauri::command]
fn reset_pomodoro(state: State<'_, AppState>, app: AppHandle) -> PomodoroState {
    let mut pomo = state.pomo_state.lock().unwrap();
    pomo.active = false;
    let map = state.settings.lock().unwrap();
    let mins = match pomo.phase.as_str() {
        "short" => map.get("short_break").copied().unwrap_or(5),
        "long" => map.get("long_break").copied().unwrap_or(15),
        _ => map.get("focus").copied().unwrap_or(25),
    };
    pomo.secs_left = (mins as u32) * 60;
    let snapshot = pomo.clone();
    let _ = app.emit("kala:pomo-tick", &snapshot);
    snapshot
}

#[tauri::command]
fn set_pomodoro_phase(phase: String, state: State<'_, AppState>, app: AppHandle) -> PomodoroState {
    let mut pomo = state.pomo_state.lock().unwrap();
    pomo.active = false;
    pomo.phase = phase.clone();
    let map = state.settings.lock().unwrap();
    let mins = match phase.as_str() {
        "short" => map.get("short_break").copied().unwrap_or(5),
        "long" => map.get("long_break").copied().unwrap_or(15),
        _ => map.get("focus").copied().unwrap_or(25),
    };
    pomo.secs_left = (mins as u32) * 60;
    let snapshot = pomo.clone();
    let _ = app.emit("kala:pomo-tick", &snapshot);
    snapshot
}

#[tauri::command]
fn get_pomodoro_state(state: State<'_, AppState>) -> PomodoroState {
    state.pomo_state.lock().unwrap().clone()
}

#[tauri::command]
fn get_clipboard_history(state: State<'_, AppState>) -> Vec<ClipboardItem> {
    state.clipboards.lock().unwrap().clone()
}

#[tauri::command]
fn copy_to_clipboard(text: String, state: State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    set_system_clipboard(&text);
    let mut list = state.clipboards.lock().unwrap();
    list.retain(|i| i.text != text);
    list.insert(0, ClipboardItem {
        text: text.clone(),
        ts: chrono::Utc::now().timestamp_millis(),
    });
    if list.len() > 20 {
        list.truncate(20);
    }
    let _ = app.emit("kala:clipboard-update", serde_json::json!({ "items": *list }));
    Ok(())
}

#[tauri::command]
#[allow(unused_variables)]
fn open_shelf_file(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let expanded = if path.starts_with("~/") {
            if let Ok(home) = std::env::var("HOME") {
                path.replacen('~', &home, 1)
            } else {
                path.clone()
            }
        } else {
            path.clone()
        };

        let p = std::path::Path::new(&expanded);
        if p.exists() {
            let _ = std::process::Command::new("open").arg(&expanded).spawn();
        } else if let Some(parent) = p.parent() {
            if parent.exists() {
                let _ = std::process::Command::new("open").arg(parent).spawn();
            }
        }
    }
    Ok(())
}

#[tauri::command]
fn get_battery_status() -> serde_json::Value {
    let (pct, charging) = get_system_battery();
    serde_json::json!({ "pct": pct, "charging": charging })
}

#[tauri::command]
#[allow(unused_variables)]
fn system_media_control(action: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let (cmd_music, cmd_spotify) = match action.as_str() {
            "playpause" => ("playpause", "playpause"),
            "next" => ("next track", "next track"),
            "prev" => ("previous track", "previous track"),
            _ => return Ok(()),
        };
        let script = format!(
            r#"
            tell application "System Events"
                set isMusic to (exists (processes where bundle identifier is "com.apple.Music"))
                set isSpotify to (exists (processes where bundle identifier is "com.spotify.client"))
            end tell
            if isMusic then
                tell application "Music" to {}
            else if isSpotify then
                tell application "Spotify" to {}
            end if
            "#,
            cmd_music, cmd_spotify
        );
        let _ = std::process::Command::new("osascript").arg("-e").arg(script).spawn();
    }
    Ok(())
}

#[tauri::command]
fn trigger_notification(title: String, body: String) {
    trigger_system_notification(&title, &body);
}

fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let open_settings = MenuItem::with_id(app, "settings", "Pengaturan Kala...", true, None::<&str>)?;
    let toggle_mascot = MenuItem::with_id(app, "mascot", "Kala Mascot", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Keluar", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&open_settings, &toggle_mascot, &sep, &quit])?;

    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("Kala: Living Notch")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "settings" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            "mascot" => {
                let _ = app.emit("kala://toggle-mascot", ());
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(AppState::new())
        .setup(|app| {
            let _ = setup_tray(app.handle());

            #[cfg(target_os = "macos")]
            {
                macos_notch::disable_app_nap();
            }

            if let Some(notch_win) = app.get_webview_window("notch") {
                apply_notch_geometry(&notch_win, false);
            }

            start_background_workers(app.handle().clone());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            update_setting,
            set_setting,
            reset_settings,
            get_prayer_schedule,
            fetch_lrclib_lyrics,
            resize_notch,
            open_settings_window,
            quit_app,
            start_pomodoro,
            pause_pomodoro,
            reset_pomodoro,
            set_pomodoro_phase,
            get_pomodoro_state,
            get_clipboard_history,
            copy_to_clipboard,
            open_shelf_file,
            get_battery_status,
            system_media_control,
            trigger_notification,
            get_screen_notch_info,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Kala Tauri application");
}
