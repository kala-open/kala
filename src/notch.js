/*
 * notch.js - runtime logic for the Kala living notch window.
 *
 * Runs inside notch.html (the Tauri "notch" window).
 * Owns: authentic dynamic island navigation, mode transitions, hover expansion & auto-collapse,
 * real OS battery, real system audio/lo-fi synth, native Pomodoro focus countdown,
 * interactive water reminder, real file shelf drag-and-drop, clipboard sync, to-do list,
 * prayer times, and window geometry.
 */

window.addEventListener('error', e => {
  console.error('[NOTCH_ERROR]', e.message, e.filename, e.lineno, e.colno, e.error);
  try {
    const el = document.getElementById('notif-body');
    if (el) el.textContent = `JS: ${e.message} (${e.lineno})`;
  } catch (_) {}
});
window.addEventListener('unhandledrejection', e => {
  console.error('[NOTCH_REJECTION]', e.reason);
});

import {
  DEFAULT_SETTINGS,
  DEMO_TRACKS,
  PRAYER_CITIES,
  computeKemenagPrayerSchedule,
} from './data.js';
import { mountMascot } from './mascot.js';
import { kalaAudio } from './audio.js';

/* ── Tauri IPC bridge ────────────────────────────────────────────── */
const invoke = (() => {
  if (window.__TAURI__ !== undefined && window.__TAURI__.core !== undefined) {
    return window.__TAURI__.core.invoke;
  }
  if (window.__TAURI_INTERNALS__ !== undefined && typeof window.__TAURI_INTERNALS__.invoke === 'function') {
    return window.__TAURI_INTERNALS__.invoke;
  }
  const stubSettings = { ...DEFAULT_SETTINGS };
  return async (cmd, args = {}) => {
    if (cmd === 'get_settings') return stubSettings;
    if (cmd === 'update_setting' || cmd === 'set_setting') {
      stubSettings[args.key] = args.value;
      return stubSettings;
    }
    if (cmd === 'get_battery_status') return { pct: 85, charging: false };
    if (cmd === 'get_clipboard_history') return [];
    if (cmd === 'get_pomodoro_state') {
      return { active: false, secs_left: 1500, phase: 'focus', round: 1, total_rounds: 4 };
    }
    return null;
  };
})();

/* ── State ───────────────────────────────────────────────────────── */
const PAGES = ['music', 'pomo', 'water', 'shelf', 'clip', 'todo', 'prayer'];
let mode = 'pet';
let lastActiveWidget = 'music';
let collapseTimer = null;
let settings = { ...DEFAULT_SETTINGS };

// Music & audio state
let isPlaying = false;
let mediaSource = 'internal'; // 'system' | 'internal'
let currentTrackIdx = 0;
let trackPos = 0;
let trackLen = 214;
let trackTitle = 'Sore di Taman Kota';
let trackArtist = 'Hindia';
let trackAlbum = '';
let trackAlbumArt = '';
let systemLyrics = [];
let lastLyricsKey = '';
let isFetchingLyrics = false;

// Pomodoro state (synced with Rust background worker)
let pomoActive = false;
let pomoPhase = 'focus';
let pomoSecs = 25 * 60;
let pomoRound = 1;
let pomoTotal = 4;

// Water state
let waterMl = 1500;
let waterGoalMl = 2000;
let waterLog = [
  { hour: 9, ml: 250 },
  { hour: 11, ml: 350 },
  { hour: 13, ml: 450 },
  { hour: 15, ml: 250 },
  { hour: 17, ml: 200 },
];

// File Shelf state
let shelfItems = [];

// Clipboard state
let clipItems = [
  { text: 'Meeting moved to 3 PM, see agenda', ts: Date.now() - 60000 },
  { text: 'git commit -m "feat: living notch navigation"', ts: Date.now() - 300000 },
  { text: 'https://kala.app/desktop', ts: Date.now() - 900000 },
];

let prayerData = null;
let mascot = null;

/* ── DOM refs ────────────────────────────────────────────────────── */
const mn = document.getElementById('mn');
const ctxMenu = document.getElementById('ctx-menu');

/* ── Window & Mode transitions ───────────────────────────────────── */
export function setMode(next) {
  if (!next) return;
  mode = next;

  if (PAGES.includes(next)) {
    lastActiveWidget = next;
  }

  if (mn) mn.dataset.s = next;

  // Update dots indicator
  const dots = document.querySelectorAll('#notch-dots i');
  dots.forEach(dot => {
    dot.classList.toggle('active', dot.dataset.p === next);
  });

  // Mascot mood reflection
  if (mascot) {
    if (next === 'pet' || next === 'idle') {
      mascot.setMood('idle');
    } else if (next === 'pomo') {
      mascot.setMood(pomoActive ? 'focus' : 'idle');
    } else if (next === 'music' || next === 'lyrics') {
      mascot.setMood('happy');
    } else if (next === 'notif') {
      mascot.setMood('peek');
    }
  }

  // Adjust native Tauri window geometry
  const sizes = {
    pet: { w: 440, h: 48 },
    idle: { w: 440, h: 48 },
    music: { w: 560, h: 160 },
    lyrics: { w: 720, h: 160 },
    pomo: { w: 560, h: 160 },
    water: { w: 560, h: 160 },
    shelf: { w: 560, h: 160 },
    clip: { w: 560, h: 160 },
    todo: { w: 560, h: 160 },
    prayer: { w: 560, h: 160 },
    charge: { w: 440, h: 72 },
    notif: { w: 440, h: 72 },
    remind: { w: 440, h: 72 },
  };

  const dim = sizes[next] || sizes.pet;
  invoke('resize_notch', { width: dim.w, height: dim.h }).catch(() => { });
}

export function prevPage() {
  const curIdx = PAGES.indexOf(mode);
  const nextIdx = curIdx <= 0 ? PAGES.length - 1 : curIdx - 1;
  setMode(PAGES[nextIdx]);
}

export function nextPage() {
  const curIdx = PAGES.indexOf(mode);
  const nextIdx = curIdx >= PAGES.length - 1 ? 0 : curIdx + 1;
  setMode(PAGES[nextIdx]);
}

window.setKalaMode = setMode;
window.nextPage = nextPage;
window.prevPage = prevPage;

/* ── Hover Expansion & Auto-Collapse ─────────────────────────────── */
function cancelCollapse() {
  if (collapseTimer) {
    clearTimeout(collapseTimer);
    collapseTimer = null;
  }
}

function scheduleCollapse() {
  cancelCollapse();
  if (mode === 'pet' || mode === 'idle') return;
  collapseTimer = setTimeout(() => {
    setMode('pet');
  }, 2500);
}

/* ── Clock & Date & Battery Status ───────────────────────────────── */
function updateClockText(timeStr, dateStr) {
  document.querySelectorAll('.js-time').forEach(el => {
    el.textContent = timeStr;
  });
  if (dateStr) {
    document.querySelectorAll('.js-date').forEach(el => {
      el.textContent = dateStr;
    });
  }
}

function updateBattery(pct) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  document.querySelectorAll('.ring').forEach(r => {
    r.style.setProperty('--p', `${clamped}%`);
  });
  const chPct = document.getElementById('ch-pct');
  if (chPct) chPct.textContent = `${clamped}%`;
}

function syncWaves() {
  const waves = [document.getElementById('hdr-wave'), document.getElementById('idle-wave')];
  waves.forEach(w => {
    if (w) w.classList.toggle('paused', !isPlaying);
  });
}

function fmtTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* ── Music & Lyrics Logic ────────────────────────────────────────── */
function loadTrack(idx) {
  if (!DEMO_TRACKS || DEMO_TRACKS.length === 0) return;
  currentTrackIdx = ((idx % DEMO_TRACKS.length) + DEMO_TRACKS.length) % DEMO_TRACKS.length;
  const track = DEMO_TRACKS[currentTrackIdx];
  trackTitle = track.title;
  trackArtist = track.artist;
  trackAlbum = track.album || '';
  trackAlbumArt = track.cover || '';
  trackLen = track.durationSec || 214;
  trackPos = 0;
  mediaSource = 'internal';

  if (isPlaying) {
    kalaAudio.setTrack(currentTrackIdx);
    kalaAudio.start(currentTrackIdx);
  }
  syncWaves();
  renderMusic();
  renderLyrics();
}

function formatArtistSubtitle(artist, album) {
  if (artist && album) return `${artist} - ${album}`;
  return artist || album || '';
}

function updateMusicPanelFields(prefix, subtitle, pct, elapsed, remain, playPath) {
  const titleEl = document.getElementById(`${prefix}-title`);
  const artistEl = document.getElementById(`${prefix}-artist`);
  const elapsedEl = document.getElementById(`${prefix}-elapsed`);
  const remainEl = document.getElementById(`${prefix}-remain`);
  const barEl = document.getElementById(`${prefix}-bar`);
  const playIcon = document.getElementById(`btn-${prefix}-play-icon`);

  if (titleEl) titleEl.textContent = trackTitle;
  if (artistEl) artistEl.textContent = subtitle;
  if (elapsedEl) elapsedEl.textContent = elapsed;
  if (remainEl) remainEl.textContent = remain;
  if (barEl) barEl.style.width = `${pct.toFixed(1)}%`;
  if (playIcon) playIcon.setAttribute('d', playPath);
}

function renderMusic() {
  const pct = trackLen > 0 ? (trackPos / trackLen) * 100 : 0;
  const subtitle = formatArtistSubtitle(trackArtist, trackAlbum);
  const elapsed = fmtTime(trackPos);
  const remain = `-${fmtTime(Math.max(0, trackLen - trackPos))}`;
  const playPath = isPlaying ? 'M7 5h4v14H7zM13 5h4v14h-4z' : 'M8 5v14l11-7z';

  updateMusicPanelFields('mu', subtitle, pct, elapsed, remain, playPath);
  updateMusicPanelFields('lyr', subtitle, pct, elapsed, remain, playPath);

  // Update album artwork covers
  const muArt = document.getElementById('mu-art');
  const lyrArt = document.getElementById('lyr-art');
  const artUrl = trackAlbumArt || '';

  [muArt, lyrArt].forEach(el => {
    if (!el) return;
    if (artUrl) {
      el.style.backgroundImage = `url("${artUrl}")`;
      el.classList.add('has-cover');
    } else {
      el.style.backgroundImage = '';
      el.classList.remove('has-cover');
    }
  });
}

let isFetchingArtwork = false;
async function fetchArtworkFallback(title, artist) {
  if (!title || isFetchingArtwork) return;
  isFetchingArtwork = true;
  try {
    const q = encodeURIComponent(`${title} ${artist}`);
    const resp = await fetch(`https://itunes.apple.com/search?term=${q}&entity=song&limit=1`);
    if (resp.ok) {
      const data = await resp.json();
      if (data.results && data.results.length > 0 && data.results[0].artworkUrl100) {
        const highRes = data.results[0].artworkUrl100.replace('100x100bb', '512x512bb');
        trackAlbumArt = highRes;
        renderMusic();
      }
    }
  } catch (_) {
    // Ignore fallback errors
  } finally {
    isFetchingArtwork = false;
  }
}

function parseLRC(lrcText) {
  if (!lrcText) return [];
  const lines = lrcText.split('\n');
  const result = [];
  const timeRegex = /\[(\d{1,2}):(\d{2}(?:\.\d+)?)\](.*)/;
  for (const line of lines) {
    const match = line.match(timeRegex);
    if (match) {
      const min = Number.parseInt(match[1], 10);
      const sec = Number.parseFloat(match[2]);
      const text = match[3].trim();
      if (text) {
        result.push({ time: Math.round(min * 60 + sec), text });
      }
    }
  }
  return result;
}

async function loadSystemLyrics(title, artist) {
  if (!title) {
    systemLyrics = [];
    renderLyrics();
    return;
  }
  const key = `${title}:::${artist}`.toLowerCase();
  if (key === lastLyricsKey) return;
  lastLyricsKey = key;
  isFetchingLyrics = true;
  systemLyrics = [{ time: 0, text: `Mencari lirik untuk ${title}...` }];
  renderLyrics();

  try {
    let res = null;
    try {
      res = await invoke('fetch_lrclib_lyrics', {
        trackName: title,
        artistName: artist,
      });
    } catch (_) {
      const cleanTitle = title.split('(')[0].trim();
      const url = `https://lrclib.net/api/search?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(artist)}`;
      const r = await fetch(url);
      res = await r.json();
    }

    if (Array.isArray(res) && res.length > 0) {
      const item = res.find(i => i.syncedLyrics) || res[0];
      if (item?.syncedLyrics) {
        systemLyrics = parseLRC(item.syncedLyrics);
      } else if (item?.plainLyrics) {
        const plainLines = item.plainLyrics.split('\n').map(l => l.trim()).filter(Boolean);
        systemLyrics = plainLines.map((text, idx) => ({ time: idx * 4, text }));
      } else {
        systemLyrics = [{ time: 0, text: 'Lirik sinkron tidak tersedia' }];
      }
    } else {
      systemLyrics = [{ time: 0, text: 'Lirik tidak ditemukan di LRCLIB' }];
    }
  } catch (err) {
    console.error('Failed to load lyrics:', err);
    systemLyrics = [{ time: 0, text: 'Gagal memuat lirik' }];
  } finally {
    isFetchingLyrics = false;
    renderLyrics();
  }
}

function renderLyrics() {
  const ol = document.getElementById('lyr');
  if (!ol) return;

  let lyrics = systemLyrics;
  if (mediaSource !== 'system') {
    lyrics = DEMO_TRACKS[currentTrackIdx]?.lyrics || [];
  }

  if (!lyrics || lyrics.length === 0) {
    ol.innerHTML = '<li class="on">Lirik tidak tersedia</li>';
    ol.style.transform = 'translateY(0px)';
    return;
  }

  let activeIdx = 0;
  for (let i = 0; i < lyrics.length; i++) {
    if (trackPos >= lyrics[i].time) {
      activeIdx = i;
    }
  }

  ol.innerHTML = lyrics.map((l, i) => `
    <li class="${i === activeIdx ? 'on' : ''}" data-idx="${i}">${escHtml(l.text)}</li>
  `).join('');

  const activeLi = ol.children[activeIdx];
  if (activeLi) {
    const offset = activeLi.offsetTop - 36;
    ol.style.transform = `translateY(-${Math.max(0, offset)}px)`;
  }
}

function tickTrack() {
  if (!isPlaying || trackLen <= 0) return;
  trackPos++;
  if (mediaSource === 'internal' && trackPos > trackLen) {
    loadTrack(currentTrackIdx + 1);
    return;
  }
  renderMusic();
  renderLyrics();
}

/* ── Pomodoro Focus Logic ────────────────────────────────────────── */
function renderPomo() {
  const timeEl = document.getElementById('fo-time');
  const sessionEl = document.getElementById('fo-session');
  const untilEl = document.getElementById('fo-until');
  const barEl = document.getElementById('fo-bar');
  const ringEl = document.getElementById('fo-ring');
  const toggleBtn = document.getElementById('btn-fo-toggle');

  if (timeEl) timeEl.textContent = fmtTime(pomoSecs);

  const phaseNames = {
    focus: 'Fokus',
    short: 'Istirahat',
    long: 'Istirahat Panjang',
  };
  if (sessionEl) {
    sessionEl.textContent = `${phaseNames[pomoPhase] || 'Fokus'} · ${pomoRound} dari ${pomoTotal}`;
  }

  const totalMap = {
    focus: (Number.parseInt(settings.focus, 10) || 25) * 60,
    short: (Number.parseInt(settings.short_break, 10) || 5) * 60,
    long: (Number.parseInt(settings.long_break, 10) || 15) * 60,
  };
  const total = totalMap[pomoPhase] || 1500;
  const pct = Math.max(0, Math.min(100, ((total - pomoSecs) / total) * 100));

  if (barEl) barEl.style.width = `${Math.round(1.28 * pct)}px`;
  if (ringEl) ringEl.style.setProperty('--pm-pct', `${pct.toFixed(1)}%`);
  if (untilEl) untilEl.textContent = fmtTime(pomoSecs);

  if (toggleBtn) {
    toggleBtn.textContent = pomoActive ? 'Jeda' : 'Mulai';
  }

  document.querySelectorAll('.fo-preset').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.pomo === pomoPhase);
  });
}

/* ── Water Reminder Logic ────────────────────────────────────────── */
function renderWater() {
  const amountEl = document.getElementById('wa-amount');
  const goalEl = document.getElementById('wa-goal');
  const pctEl = document.getElementById('wa-pct');
  const barEl = document.getElementById('wa-bar');
  const chartEl = document.getElementById('wa-chart');

  const pct = Math.min(100, Math.round((waterMl / waterGoalMl) * 100));
  if (amountEl) amountEl.textContent = (waterMl / 1000).toFixed(1);
  if (goalEl) goalEl.textContent = `/ ${(waterGoalMl / 1000).toFixed(1)} L`;
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (barEl) barEl.style.width = `${Math.round(1.52 * pct)}px`;

  if (chartEl) {
    chartEl.innerHTML = waterLog.map(item => {
      const h = Math.max(6, Math.min(50, Math.round((item.ml / 500) * 44)));
      return `<div class="wchart-col" style="height:${h}px;" title="${item.hour}:00 (${item.ml} ml)"></div>`;
    }).join('');
  }
}

/* ── Prayer Schedule Logic ───────────────────────────────────────── */
function renderPrayer() {
  if (!prayerData) return;
  const iconEl = document.getElementById('pr-icon');
  const nameEl = document.getElementById('pr-name');
  const subEl = document.getElementById('pr-sub');
  const timeEl = document.getElementById('pr-time');

  const icons = {
    Subuh: '★',
    Dzuhur: '☀️',
    Ashar: '⛅',
    Maghrib: '🌙',
    Isya: '✨',
  };

  const name = prayerData.nextName || 'Sholat';
  if (iconEl) iconEl.textContent = icons[name] || '🌙';
  if (nameEl) nameEl.textContent = name;
  if (subEl) subEl.textContent = `${prayerData.minutesUntilNext} mnt lagi`;
  if (timeEl) timeEl.textContent = prayerData.nextTime || '--:--';
}

/* ── Shelf & Clipboard Logic ─────────────────────────────────────── */
function escHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function relTime(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'Baru saja';
  if (diff < 3600) return `${Math.floor(diff / 60)} mnt lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return `${Math.floor(diff / 86400)} hari lalu`;
}

function parseClipboardItem(item) {
  if (typeof item === 'string') {
    return { text: item, ts: Date.now() };
  }
  if (typeof item === 'object' && item !== null) {
    let text = item.text;
    while (typeof text === 'object' && text !== null) {
      text = text.text || JSON.stringify(text);
    }
    return {
      text: typeof text === 'string' ? text : String(text || ''),
      ts: typeof item.ts === 'number' ? item.ts : Date.now(),
    };
  }
  return { text: String(item || ''), ts: Date.now() };
}

/* ── File Shelf Sync & Logic ─────────────────────────────────────── */
const SHELF_STORAGE_KEY = 'kala_shelf_v1';

function parseShelfItem(item) {
  if (typeof item === 'string') {
    const parts = item.split(/[/\\]/);
    const name = parts.at(-1) || item;
    return { name, size: 'Berkas', path: item };
  }
  if (typeof item === 'object' && item !== null) {
    let name = item.name || item.path || 'Berkas';
    while (typeof name === 'object' && name !== null) {
      name = name.name || name.path || JSON.stringify(name);
    }
    const parts = String(name).split(/[/\\]/);
    const shortName = parts.at(-1) || String(name);
    let resolvedPath = '';
    if (typeof item.path === 'string') {
      resolvedPath = item.path;
    } else if (typeof item.name === 'string') {
      resolvedPath = item.name;
    }
    return {
      name: shortName,
      size: typeof item.size === 'string' ? item.size : 'Berkas',
      path: resolvedPath,
    };
  }
  return { name: String(item || 'Berkas'), size: 'Berkas', path: '' };
}

function loadNotchShelf() {
  try {
    const raw = localStorage.getItem(SHELF_STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(parseShelfItem);
    }
  } catch (_) {
    // Abaikan kegagalan parsing cache shelf lokal dan gunakan data default
  }
  return [
    { name: 'laporan-keuangan.pdf', size: '2.4 MB', path: '~/Documents/laporan-keuangan.pdf' },
    { name: 'screenshot-desain.png', size: '840 KB', path: '~/Desktop/screenshot-desain.png' },
    { name: 'source-code.rs', size: '48 KB', path: '~/src/lib.rs' },
  ];
}

function saveNotchShelf(items) {
  try {
    localStorage.setItem(SHELF_STORAGE_KEY, JSON.stringify(items));
  } catch (_) { }
}

function getFileIcon(name = '') {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'heic'].includes(ext)) return '🖼️';
  if (['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg'].includes(ext)) return '🎵';
  if (['mp4', 'mov', 'mkv', 'webm'].includes(ext)) return '🎬';
  if (['pdf'].includes(ext)) return '📕';
  if (['zip', 'tar', 'gz', 'dmg', 'rar', '7z'].includes(ext)) return '📦';
  if (['rs', 'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'py', 'sh'].includes(ext)) return '💻';
  if (['txt', 'md', 'doc', 'docx'].includes(ext)) return '📝';
  return '📄';
}

function renderShelf() {
  const zoneEl = document.getElementById('sh-zone');
  const listEl = document.getElementById('sh-file-list');
  if (!zoneEl || !listEl) return;

  if (!Array.isArray(shelfItems) || shelfItems.length === 0) {
    zoneEl.style.display = 'flex';
    listEl.style.display = 'none';
    return;
  }

  zoneEl.style.display = 'none';
  listEl.style.display = 'flex';

  const cardsHtml = shelfItems.slice(0, 3).map((raw, idx) => {
    const item = parseShelfItem(raw);
    const icon = getFileIcon(item.name);
    return `
      <div class="sh-file-card" data-idx="${idx}" title="Klik untuk membuka: ${escHtml(item.name)}" style="cursor:pointer;">
        <span style="font-size:24px;">${icon}</span>
        <span style="font-size:10px;max-width:68px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;">${escHtml(item.name)}</span>
        <span style="font-size:8.5px;color:var(--mist);">${escHtml(item.size)}</span>
      </div>`;
  }).join('');

  const addMoreHtml = `
    <div class="sh-file-card" id="btn-sh-add-more" title="Tambah berkas lain" style="cursor:pointer;border:1px dashed rgba(255,255,255,0.3);display:flex;flex-direction:column;align-items:center;justify-content:center;">
      <span style="font-size:18px;">➕</span>
      <span style="font-size:9px;color:var(--mist);">Tambah</span>
    </div>
  `;

  listEl.innerHTML = cardsHtml + addMoreHtml;
}

function renderClip() {
  const listEl = document.getElementById('cl-card-list');
  if (!listEl) return;
  if (!Array.isArray(clipItems) || clipItems.length === 0) return;

  listEl.innerHTML = clipItems.slice(0, 3).map((raw, idx) => {
    const item = parseClipboardItem(raw);
    return `
      <div class="cl-item" data-idx="${idx}" title="Klik untuk menyalin">
        <span class="cl-item-txt">${escHtml(item.text)}</span>
        <span class="cl-item-when">${relTime(item.ts)}</span>
      </div>
    `;
  }).join('');
}

/* ── To-Do Sync & Persistence ────────────────────────────────────── */
const TODO_STORAGE_KEY = 'kala_todos_v1';
const DEFAULT_TODOS = [
  { id: 'td-1', title: 'Review pull request arsitektur Tauri v2', time: '10:00', duration: 45, done: true },
  { id: 'td-2', title: 'Validasi kalkulasi jadwal sholat Kemenag RI', time: '14:00', duration: 30, done: false },
  { id: 'td-3', title: 'Sinkronisasi lirik LRCLIB pada visual notch', time: '16:30', duration: 60, done: false },
];

function loadNotchTodos() {
  try {
    const raw = localStorage.getItem(TODO_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {
    // Abaikan kegagalan baca cache todo lokal dan gunakan daftar default
  }
  return [...DEFAULT_TODOS];
}

function saveNotchTodos(items) {
  try {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(items));
  } catch (_) {
    // Abaikan kegagalan simpan cache todo lokal
  }
}

function renderNotchTodos() {
  const items = loadNotchTodos();
  const total = items.length;
  const done = items.filter(t => t.done).length;
  const countEl = document.getElementById('todo-count');
  if (countEl) countEl.textContent = `${done}/${total}`;

  const container = document.getElementById('todo-items-container');
  if (!container) return;
  container.innerHTML = '';

  items.slice(0, 3).forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = `a trow ${item.done ? 'done' : ''}`;
    row.style.top = `${34 + idx * 31}px`;
    row.dataset.id = item.id;

    const chk = document.createElement('span');
    chk.className = 'chk';
    chk.innerHTML = '<svg viewBox="0 0 10 10"><path d="m2 5.2 2 2 4-4.4"/></svg>';

    const txt = document.createElement('span');
    txt.className = 'trow-text';
    txt.textContent = item.title;

    row.appendChild(chk);
    row.appendChild(txt);

    row.addEventListener('click', (e) => {
      e.stopPropagation();
      cancelCollapse();
      item.done = !item.done;
      saveNotchTodos(items);
      renderNotchTodos();
      if (mascot && item.done) {
        mascot.setMood('happy');
      }
    });

    container.appendChild(row);
  });
}

/* ── Settings Sync ───────────────────────────────────────────────── */
async function loadSettings() {
  try {
    const backendSettings = await invoke('get_settings');
    if (backendSettings && typeof backendSettings === 'object') {
      settings = { ...DEFAULT_SETTINGS, ...backendSettings };
    }
  } catch (_) {
    // Abaikan kegagalan koneksi backend settings dan gunakan pengaturan default
  }

  waterGoalMl = Number.parseInt(settings.water_daily_goal_ml || settings.water_goal, 10) || 2000;

  const cityIdx = typeof settings.prayer_city === 'number'
    ? settings.prayer_city
    : PRAYER_CITIES.findIndex(c => String(c.name) === String(settings.prayer_city));
  prayerData = computeKemenagPrayerSchedule(cityIdx >= 0 ? cityIdx : 17, settings);
}

/* ── Event Bindings ──────────────────────────────────────────────── */
function setupContextMenuEvents() {
  document.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (!ctxMenu) return;
    ctxMenu.style.left = `${Math.min(e.clientX, window.innerWidth - 160)}px`;
    ctxMenu.style.top = `${Math.min(e.clientY, window.innerHeight - 100)}px`;
    ctxMenu.classList.add('open');
  });

  document.addEventListener('click', () => {
    if (ctxMenu) ctxMenu.classList.remove('open');
  });

  const ctxIdle = document.getElementById('ctx-idle');
  if (ctxIdle) ctxIdle.addEventListener('click', () => setMode('pet'));

  const ctxSettings = document.getElementById('ctx-settings');
  if (ctxSettings) ctxSettings.addEventListener('click', () => invoke('open_settings_window'));

  const ctxQuit = document.getElementById('ctx-quit');
  if (ctxQuit) ctxQuit.addEventListener('click', () => invoke('quit_app'));
}

function setupNotchHoverEvents() {
  let hasEntered = false;
  if (!mn) return;

  mn.addEventListener('mouseenter', () => {
    hasEntered = true;
    cancelCollapse();
    if (mode === 'pet' || mode === 'idle') {
      setMode(lastActiveWidget);
    }
  });

  mn.addEventListener('mouseleave', () => {
    if (!hasEntered) return;
    scheduleCollapse();
  });

  mn.addEventListener('click', e => {
    hasEntered = true;
    cancelCollapse();
    if (ctxMenu?.classList.contains('open')) return;
    if (e.target.closest('button, .arw, .dots, .ctl, .bub, .pill, .wbtn, .sw, .trow, .cl-item, .sh-file-card')) return;
    if (mode === 'pet' || mode === 'idle') {
      if (mascot) mascot.reactClick();
      setMode(lastActiveWidget);
    }
  });

  const btnCollapse = document.getElementById('btn-collapse-notch');
  if (btnCollapse) {
    btnCollapse.addEventListener('click', e => {
      e.stopPropagation();
      setMode('pet');
    });
  }

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      setMode('pet');
    }
  });
}

function setupNavigationEvents() {
  document.querySelectorAll('.btn-next-page').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      cancelCollapse();
      nextPage();
    });
  });

  document.querySelectorAll('.btn-prev-page').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      cancelCollapse();
      prevPage();
    });
  });

  document.querySelectorAll('#notch-dots i').forEach(dot => {
    dot.addEventListener('click', e => {
      e.stopPropagation();
      cancelCollapse();
      setMode(dot.dataset.p);
    });
  });
}

function setupMusicEvents() {
  const btnMuPlay = document.getElementById('btn-mu-play');
  if (btnMuPlay) {
    btnMuPlay.addEventListener('click', e => {
      e.stopPropagation();
      cancelCollapse();
      isPlaying = !isPlaying;
      if (mediaSource === 'system') {
        invoke('system_media_control', { action: 'playpause' }).catch(() => { });
      } else if (isPlaying) {
        kalaAudio.start(currentTrackIdx);
      } else {
        kalaAudio.stop();
      }
      syncWaves();
      renderMusic();
    });
  }

  const btnMuPrev = document.getElementById('btn-mu-prev');
  if (btnMuPrev) {
    btnMuPrev.addEventListener('click', e => {
      e.stopPropagation();
      cancelCollapse();
      if (mediaSource === 'system') {
        invoke('system_media_control', { action: 'prev' }).catch(() => { });
      } else {
        loadTrack(currentTrackIdx - 1);
      }
    });
  }

  const btnMuNext = document.getElementById('btn-mu-next');
  if (btnMuNext) {
    btnMuNext.addEventListener('click', e => {
      e.stopPropagation();
      cancelCollapse();
      if (mediaSource === 'system') {
        invoke('system_media_control', { action: 'next' }).catch(() => { });
      } else {
        loadTrack(currentTrackIdx + 1);
      }
    });
  }

  const muProg = document.getElementById('mu-prog');
  if (muProg) {
    muProg.addEventListener('click', e => {
      e.stopPropagation();
      cancelCollapse();
      const rect = muProg.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      trackPos = Math.round(pct * trackLen);
      renderMusic();
      renderLyrics();
    });
  }

  const btnMuLyric = document.getElementById('btn-mu-lyric');
  if (btnMuLyric) {
    btnMuLyric.addEventListener('click', e => {
      e.stopPropagation();
      cancelCollapse();
      setMode('lyrics');
      if (mediaSource === 'system' && (!systemLyrics || systemLyrics.length === 0)) {
        void loadSystemLyrics(trackTitle, trackArtist);
      }
      renderLyrics();
    });
  }

  const btnLyrBack = document.getElementById('btn-lyr-back');
  if (btnLyrBack) {
    btnLyrBack.addEventListener('click', e => {
      e.stopPropagation();
      cancelCollapse();
      setMode('music');
    });
  }

  const btnLyrPlay = document.getElementById('btn-lyr-play');
  if (btnLyrPlay) {
    btnLyrPlay.addEventListener('click', e => {
      e.stopPropagation();
      cancelCollapse();
      isPlaying = !isPlaying;
      if (mediaSource === 'system') {
        invoke('system_media_control', { action: 'playpause' }).catch(() => { });
      } else if (isPlaying) {
        kalaAudio.start(currentTrackIdx);
      } else {
        kalaAudio.stop();
      }
      syncWaves();
      renderMusic();
    });
  }

  const btnLyrPrev = document.getElementById('btn-lyr-prev');
  if (btnLyrPrev) {
    btnLyrPrev.addEventListener('click', e => {
      e.stopPropagation();
      cancelCollapse();
      if (mediaSource === 'system') {
        invoke('system_media_control', { action: 'prev' }).catch(() => { });
      } else {
        loadTrack(currentTrackIdx - 1);
      }
    });
  }

  const btnLyrNext = document.getElementById('btn-lyr-next');
  if (btnLyrNext) {
    btnLyrNext.addEventListener('click', e => {
      e.stopPropagation();
      cancelCollapse();
      if (mediaSource === 'system') {
        invoke('system_media_control', { action: 'next' }).catch(() => { });
      } else {
        loadTrack(currentTrackIdx + 1);
      }
    });
  }

  const lyrOl = document.getElementById('lyr');
  if (lyrOl) {
    lyrOl.addEventListener('click', e => {
      const li = e.target.closest('li');
      if (!li) return;
      e.stopPropagation();
      cancelCollapse();
      const idx = Number.parseInt(li.dataset.idx, 10);
      let lyrics = systemLyrics;
      if (mediaSource !== 'system') {
        lyrics = DEMO_TRACKS[currentTrackIdx]?.lyrics || [];
      }
      if (lyrics?.[idx]) {
        trackPos = lyrics[idx].time;
        renderMusic();
        renderLyrics();
      }
    });
  }
}

function setupPomodoroEvents() {
  const btnFoToggle = document.getElementById('btn-fo-toggle');
  if (btnFoToggle) {
    btnFoToggle.addEventListener('click', e => {
      e.stopPropagation();
      cancelCollapse();
      if (pomoActive) {
        invoke('pause_pomodoro').catch(() => { });
        pomoActive = false;
      } else {
        invoke('start_pomodoro').catch(() => { });
        pomoActive = true;
      }
      renderPomo();
    });
  }

  const btnFoReset = document.getElementById('btn-fo-reset');
  if (btnFoReset) {
    btnFoReset.addEventListener('click', e => {
      e.stopPropagation();
      cancelCollapse();
      invoke('reset_pomodoro').catch(() => { });
      pomoActive = false;
      pomoSecs = 1500;
      renderPomo();
    });
  }

  document.querySelectorAll('.fo-preset').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      cancelCollapse();
      const phase = btn.dataset.pomo;
      invoke('set_pomodoro_phase', { phase }).catch(() => { });
      pomoPhase = phase;
      const totalMap = { focus: 1500, short: 300, long: 900 };
      pomoSecs = totalMap[phase] || 1500;
      renderPomo();
    });
  });
}

function setupWidgetEvents() {
  // Water controls
  const btnWaDrink = document.getElementById('btn-wa-drink');
  if (btnWaDrink) {
    btnWaDrink.addEventListener('click', e => {
      e.stopPropagation();
      cancelCollapse();
      waterMl = Math.min(waterGoalMl + 500, waterMl + 250);
      const curHour = new Date().getHours();
      const rec = waterLog.find(r => r.hour === curHour);
      if (rec) rec.ml += 250;
      else waterLog.push({ hour: curHour, ml: 250 });
      renderWater();
      if (mascot) mascot.setMood('happy');
      invoke('set_setting', { key: 'water_ml_today', value: waterMl }).catch(() => { });
    });
  }

  const waSw = document.getElementById('wa-sw');
  if (waSw) {
    waSw.addEventListener('click', e => {
      e.stopPropagation();
      cancelCollapse();
      const isChecked = waSw.getAttribute('aria-checked') !== 'true';
      waSw.setAttribute('aria-checked', String(isChecked));
      invoke('set_setting', { key: 'water_reminder_on', value: isChecked ? 1 : 0 }).catch(() => { });
    });
  }

  // To-do
  renderNotchTodos();

  const btnAddTodo = document.getElementById('btn-add-todo');
  if (btnAddTodo) {
    btnAddTodo.addEventListener('click', e => {
      e.stopPropagation();
      cancelCollapse();
      invoke('open_settings_window');
    });
  }

  window.addEventListener('storage', e => {
    if (e.key === TODO_STORAGE_KEY) {
      renderNotchTodos();
    }
  });

  // Clipboard copy
  const clList = document.getElementById('cl-card-list');
  if (clList) {
    clList.addEventListener('click', e => {
      const itemEl = e.target.closest('.cl-item');
      if (!itemEl) return;
      e.stopPropagation();
      cancelCollapse();
      const idx = Number.parseInt(itemEl.dataset.idx, 10);
      const raw = clipItems[idx];
      if (raw) {
        const item = parseClipboardItem(raw);
        invoke('copy_to_clipboard', { text: item.text }).catch(() => {
          if (navigator.clipboard) navigator.clipboard.writeText(item.text).catch(() => { });
        });
        itemEl.classList.add('copied');
        setTimeout(() => itemEl.classList.remove('copied'), 1200);
        if (mascot) mascot.setMood('happy');
      }
    });
  }

  // File shelf drop zone & click-to-pick
  const zone = document.getElementById('sh-zone');
  const shFileInput = document.getElementById('sh-file-input');

  if (zone) {
    zone.addEventListener('click', e => {
      e.stopPropagation();
      cancelCollapse();
      if (shFileInput) shFileInput.click();
    });

    zone.addEventListener('dragover', e => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.add('hover');
    });

    zone.addEventListener('dragleave', e => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove('hover');
    });

    zone.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove('hover');
      cancelCollapse();
      if (e.dataTransfer?.files?.length > 0) {
        for (const file of e.dataTransfer.files) {
          const sz = file.size > 1048576
            ? `${(file.size / 1048576).toFixed(1)} MB`
            : `${Math.round(file.size / 1024)} KB`;
          shelfItems.unshift({ name: file.name, size: sz, path: file.name });
        }
        saveNotchShelf(shelfItems);
        renderShelf();
        if (mascot) mascot.setMood('happy');
      }
    });
  }

  if (shFileInput) {
    shFileInput.addEventListener('change', () => {
      if (shFileInput.files?.length > 0) {
        for (const file of shFileInput.files) {
          const sz = file.size > 1048576
            ? `${(file.size / 1048576).toFixed(1)} MB`
            : `${Math.round(file.size / 1024)} KB`;
          shelfItems.unshift({ name: file.name, size: sz, path: file.name });
        }
        shFileInput.value = '';
        saveNotchShelf(shelfItems);
        renderShelf();
        if (mascot) mascot.setMood('happy');
      }
    });
  }

  const listEl = document.getElementById('sh-file-list');
  if (listEl) {
    listEl.addEventListener('click', e => {
      const card = e.target.closest('.sh-file-card');
      if (!card) return;
      e.stopPropagation();
      cancelCollapse();
      if (card.id === 'btn-sh-add-more') {
        if (shFileInput) shFileInput.click();
        return;
      }
      const idx = Number.parseInt(card.dataset.idx, 10);
      const item = shelfItems[idx];
      if (item) {
        const path = item.path || item.name;
        invoke('open_shelf_file', { path }).catch(() => { });
        if (mascot) mascot.setMood('happy');
      }
    });
  }

  const btnShClear = document.getElementById('btn-sh-clear');
  if (btnShClear) {
    btnShClear.addEventListener('click', e => {
      e.stopPropagation();
      cancelCollapse();
      shelfItems = [];
      saveNotchShelf(shelfItems);
      renderShelf();
    });
  }

  window.addEventListener('storage', e => {
    if (e.key === SHELF_STORAGE_KEY) {
      shelfItems = loadNotchShelf();
      renderShelf();
    }
  });
}

function setupEvents() {
  setupContextMenuEvents();
  setupNotchHoverEvents();
  setupNavigationEvents();
  setupMusicEvents();
  setupPomodoroEvents();
  setupWidgetEvents();
}

/* ── Native Tauri Backend Events (Running continuously in background) ── */
function listenTauri() {
  const listen = window.__TAURI__?.event?.listen;
  if (typeof listen !== 'function') return;

  // Real Pomodoro tick from Rust thread
  listen('kala:pomo-tick', ({ payload }) => {
    pomoSecs = payload.secs_left;
    pomoPhase = payload.phase;
    pomoRound = payload.round;
    pomoTotal = payload.total_rounds;
    pomoActive = payload.active === true;
    if (mascot && mode === 'pomo') mascot.setMood(pomoActive ? 'focus' : 'idle');
    renderPomo();
  });

  // Accurate Clock tick from OS
  listen('kala:clock-tick', ({ payload }) => {
    updateClockText(payload.time, payload.date);
  });

  // Real system media update (Apple Music / Spotify)
  listen('kala:music-update', ({ payload }) => {
    if (payload.source === 'system') {
      mediaSource = 'system';
      const trackChanged = (trackTitle !== payload.title) || (trackArtist !== payload.artist);
      trackTitle = payload.title || '';
      trackArtist = payload.artist || '';
      trackAlbum = payload.album || '';
      trackLen = payload.duration || 200;
      trackPos = payload.position || 0;
      isPlaying = payload.playing === true;
      if (payload.artwork) {
        trackAlbumArt = payload.artwork;
      } else if (trackChanged) {
        trackAlbumArt = '';
        void fetchArtworkFallback(trackTitle, trackArtist);
      }
      kalaAudio.stop();
      syncWaves();
      renderMusic();
      if (trackChanged) {
        void loadSystemLyrics(trackTitle, trackArtist);
      } else {
        renderLyrics();
      }
    } else if (payload.source === 'idle' && mediaSource === 'system') {
      mediaSource = 'internal';
      trackAlbumArt = DEMO_TRACKS[currentTrackIdx]?.cover || '';
      renderMusic();
      renderLyrics();
    }
  });

  // Real native OS notification
  listen('kala:notify', ({ payload }) => {
    const titleEl = document.getElementById('notif-title');
    const bodyEl = document.getElementById('notif-body');
    if (titleEl) titleEl.textContent = payload.title || 'Notifikasi';
    if (bodyEl) bodyEl.textContent = payload.body || '';
    if (mascot) mascot.setMood('peek');
    setMode('notif');
    setTimeout(() => {
      if (mode === 'notif') setMode('pet');
    }, 4500);
  });

  // Real OS Battery (pmset)
  let lastChargingState = null;
  listen('kala:battery', ({ payload }) => {
    updateBattery(payload.pct);
    if (lastChargingState !== null && payload.charging && !lastChargingState && mode === 'pet') {
      setMode('charge');
      setTimeout(() => {
        if (mode === 'charge') setMode('pet');
      }, 4000);
    }
    lastChargingState = Boolean(payload.charging);
  });

  // Real System Clipboard update
  listen('kala:clipboard-update', ({ payload }) => {
    if (payload && Array.isArray(payload.items) && payload.items.length > 0) {
      clipItems = payload.items.map(parseClipboardItem);
      renderClip();
    }
  });

  // Native OS File Drag and Drop from macOS Finder
  listen('tauri://drag-drop', ({ payload }) => {
    cancelCollapse();
    const paths = payload?.paths || (Array.isArray(payload) ? payload : (payload?.data?.paths || []));
    if (Array.isArray(paths) && paths.length > 0) {
      paths.forEach(p => {
        const pathStr = typeof p === 'string' ? p : (p?.path || p?.name || String(p));
        const parts = pathStr.split(/[/\\]/);
        const name = parts[parts.length - 1] || pathStr;
        shelfItems.unshift({ name, size: 'Berkas', path: pathStr });
      });
      // Deduplicate
      shelfItems = shelfItems.filter((item, idx, self) =>
        idx === self.findIndex(t => (t.path && t.path === item.path) || t.name === item.name)
      );
      saveNotchShelf(shelfItems);
      renderShelf();
      setMode('shelf');
      if (mascot) mascot.setMood('happy');
    }
  });

  listen('tauri://drag-over', () => {
    cancelCollapse();
    if (mode !== 'shelf') setMode('shelf');
    const z = document.getElementById('sh-zone');
    if (z) z.classList.add('hover');
  });

  listen('tauri://drag-leave', () => {
    const z = document.getElementById('sh-zone');
    if (z) z.classList.remove('hover');
  });

  listen('kala://settings-updated', ({ payload }) => {
    settings = { ...settings, ...payload };
    waterGoalMl = Number.parseInt(settings.water_daily_goal_ml || settings.water_goal, 10) || 2000;
  });

  listen('kala://set-mode', ({ payload }) => {
    cancelCollapse();
    if (payload && payload.mode) {
      setMode(payload.mode);
    }
  });
}

/* ── App Initialization ──────────────────────────────────────────── */
async function initHardwareNotch() {
  try {
    const info = await invoke('get_screen_notch_info');
    if (info && info.has_notch) {
      const hwW = Math.round(info.width);
      const hwH = Math.round(info.height);
      document.documentElement.style.setProperty('--hw-w', `${hwW}px`);
      document.documentElement.style.setProperty('--hw-h', `${hwH}px`);
      document.body.classList.add('has-hw-notch');
      if (mn) mn.classList.add('has-hw-notch');
    }
  } catch (_) {
    // Ignore fallback if command is not available
  }
}

async function init() {
  await initHardwareNotch();
  await loadSettings();

  // Load initial demo track
  if (DEMO_TRACKS?.length > 0) {
    const t = DEMO_TRACKS[0];
    trackTitle = t.title;
    trackArtist = t.artist;
    trackAlbum = t.album || '';
    trackLen = t.durationSec;
    trackPos = 0;
  }

  // Query initial OS battery
  try {
    const bat = await invoke('get_battery_status');
    if (bat && typeof bat.pct === 'number') {
      updateBattery(bat.pct);
    }
  } catch (_) {
    // Abaikan kegagalan baca status baterai awal
  }

  // Query initial real clipboard history
  try {
    const clips = await invoke('get_clipboard_history');
    if (Array.isArray(clips) && clips.length > 0) {
      clipItems = clips.map(parseClipboardItem);
    }
  } catch (_) {
    // Abaikan kegagalan baca riwayat clipboard awal
  }

  // Query initial Pomodoro state
  try {
    const pomo = await invoke('get_pomodoro_state');
    if (pomo && typeof pomo.secs_left === 'number') {
      pomoSecs = pomo.secs_left;
      pomoPhase = pomo.phase;
      pomoRound = pomo.round;
      pomoTotal = pomo.total_rounds;
      pomoActive = pomo.active;
    }
  } catch (_) {
    // Abaikan kegagalan baca status pomodoro awal
  }

  // Mount living mascot
  const mountEl = document.getElementById('kala-mascot-mount');
  if (mountEl) {
    mascot = mountMascot(mountEl, {
      size: 40,
      mood: 'idle',
      interactive: true,
    });
  }

  renderMusic();
  renderLyrics();
  renderPomo();
  renderWater();
  renderPrayer();
  shelfItems = loadNotchShelf();
  if (!shelfItems || shelfItems.length === 0) {
    shelfItems = [
      { name: 'laporan-keuangan.pdf', size: '2.4 MB', path: '~/Documents/laporan-keuangan.pdf' },
      { name: 'screenshot-desain.png', size: '840 KB', path: '~/Desktop/screenshot-desain.png' },
      { name: 'source-code.rs', size: '48 KB', path: '~/src/lib.rs' },
    ];
  }
  renderShelf();
  renderClip();
  renderNotchTodos();
  syncWaves();

  // Format initial date and clock
  const now = new Date();
  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const dateStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  updateClockText(`${hh}:${mm}`, dateStr);

  setInterval(tickTrack, 1000);

  setupEvents();
  listenTauri();

  // Start in resting pet mode
  setMode('pet');
}

await init();
