import {
  DEFAULT_SETTINGS,
  PRAYER_CITIES,
  WORLD_CITIES,
  COUNTDOWN_EVENTS,
  DEMO_TRACKS,
  computeKemenagPrayerSchedule,
  computeMoonPhase
} from "./data.js";

// Storage keys
const SETTINGS_STORAGE_KEY = "kala_settings_v1";
const TODO_STORAGE_KEY = "kala_todos_v1";
const WATER_STORAGE_KEY = "kala_water_v1";
const SHELF_STORAGE_KEY = "kala_shelf_v1";
const CLIP_STORAGE_KEY = "kala_clip_v1";
const FOCUS_STORAGE_KEY = "kala_focus_v1";

const DEFAULT_INITIAL_TODOS = [
  { id: "td-1", title: "Review pull request arsitektur Tauri v2", time: "10:00", duration: 45, done: true },
  { id: "td-2", title: "Validasi kalkulasi jadwal sholat Kemenag RI", time: "14:00", duration: 30, done: false },
  { id: "td-3", title: "Sinkronisasi lirik LRCLIB pada visual notch", time: "16:30", duration: 60, done: false }
];

function loadStoredTodos() {
  try {
    const raw = localStorage.getItem(TODO_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {
    // Abaikan kegagalan baca cache todo lokal dan gunakan daftar default
  }
  return [...DEFAULT_INITIAL_TODOS];
}

function saveStoredTodos() {
  try {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos));
  } catch (_) {
    // Abaikan kegagalan simpan cache todo lokal
  }
}

// State
let currentSettings = { ...DEFAULT_SETTINGS };
let currentTrackIndex = 0;
let isPlaying = true;
let playerProgressSec = 74;
let playerTimer = null;
let activeLyrics = [];

let pomoMode = "focus"; // "focus", "short", "long"
let pomoSecondsLeft = 25 * 60;
let pomoRunning = false;
let pomoTimer = null;
let pomoSessionsCompleted = 2;
let pomoRound = 1;

let waterState = {
  bottle: 600,
  goal: 2000,
  start: 8,
  end: 22,
  taken: 1200,
  inb: 300
};

let todos = loadStoredTodos();

function loadStoredShelf() {
  try {
    const raw = localStorage.getItem(SHELF_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {
    // Abaikan kegagalan baca cache shelf lokal dan gunakan daftar default
  }
  return [
    "~/Documents/projects/nusa/README.md",
    "~/Desktop/desain-living-notch.png"
  ];
}

function saveStoredShelf() {
  try {
    localStorage.setItem(SHELF_STORAGE_KEY, JSON.stringify(shelfItems));
  } catch (_) {
    // Abaikan kegagalan simpan cache shelf lokal
  }
}

let shelfItems = loadStoredShelf();

let clipItems = [
  "cargo tauri dev",
  "git checkout -b feature/kemenag-prayer-times",
  "npm run dev"
];

// Tauri IPC Bridge
const isTauri = window.__TAURI_INTERNALS__ !== undefined;

async function tauriInvoke(cmd, args = {}) {
  if (isTauri && window.__TAURI__?.core) {
    try {
      return await window.__TAURI__.core.invoke(cmd, args);
    } catch (e) {
      console.warn(`[Tauri IPC fallback: ${cmd}]`, e);
    }
  }
  return null;
}

// Settings Persistence
function loadStoredSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      currentSettings = { ...DEFAULT_SETTINGS, ...parsed };
      return;
    }
  } catch (e) {
    console.error("Gagal membaca settings dari localStorage:", e);
  }
  currentSettings = { ...DEFAULT_SETTINGS };
}

function saveSetting(key, val) {
  currentSettings[key] = Number(val);
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(currentSettings));
  } catch (e) {
    console.error("Gagal menyimpan setting:", e);
  }
  void tauriInvoke("update_setting", { key, value: Number(val) });
  applySettingsToUI();
}

function resetAllSettings() {
  currentSettings = { ...DEFAULT_SETTINGS };
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(currentSettings));
  } catch (e) {
    console.error("Gagal reset setting:", e);
  }
  void tauriInvoke("reset_settings");
  applySettingsToUI();
  renderAllSettingPanels();
}

// DOM References
const notchStage = document.getElementById("notch-stage");
const notchShell = document.getElementById("notch-shell");
const notchClock = document.getElementById("notch-clock-text");
const statusRingPill = document.getElementById("status-ring-pill");
const statusRingDot = document.getElementById("status-ring-dot");
const statusRingText = document.getElementById("status-ring-text");
const notchMiniWave = document.getElementById("notch-mini-wave");
const notchMiniTrack = document.getElementById("notch-mini-track");
const btnToggleNotch = document.getElementById("btn-toggle-notch");
const btnToggleNotchLabel = document.getElementById("btn-toggle-notch-label");
const notchExpandedBody = document.getElementById("notch-expanded-body");
const hudToast = document.getElementById("hud-toast");
const hudToastText = document.getElementById("hud-toast-text");
const mascotStatusBadge = document.getElementById("mascot-status-badge");
const mascotMoodText = document.getElementById("mascot-mood-text");

// Theme
const btnThemeToggle = document.getElementById("btn-theme-toggle");

function initTheme() {
  const saved = localStorage.getItem("nusa_theme") || "dark";
  document.documentElement.dataset.theme = saved;
  updateThemeButton(saved);
}

function updateThemeButton(theme) {
  if (!btnThemeToggle) return;
  const isDark = theme === "dark";
  btnThemeToggle.setAttribute("aria-pressed", isDark ? "false" : "true");
  btnThemeToggle.textContent = isDark ? "Tema: Gelap (Beralih ke Terang)" : "Tema: Terang (Beralih ke Gelap)";
}

btnThemeToggle?.addEventListener("click", () => {
  const current = document.documentElement.dataset.theme || "dark";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("nusa_theme", next);
  updateThemeButton(next);
});

// Clock & Timers
function updateClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  if (notchClock) notchClock.textContent = `${hh}:${mm}`;
}

// Status Ring
function updateStatusRing() {
  if (!statusRingPill) return;
  const mode = currentSettings.status_ring; // 0=battery, 1=water, 2=tasks, 3=none
  if (mode === 3) {
    statusRingPill.style.display = "none";
    return;
  }
  statusRingPill.style.display = "inline-flex";

  const ringConfigs = {
    0: { color: "#34D399", text: "Baterai 92%" },
    1: { color: "#38BDF8", text: `Air: ${Math.min(100, Math.round((waterState.taken / waterState.goal) * 100))}%` },
    2: { color: "#F59E0B", text: `Tugas: ${todos.filter((t) => t.done).length}/${todos.length}` }
  };
  const cfg = ringConfigs[mode];
  if (cfg) {
    if (statusRingDot) statusRingDot.style.background = cfg.color;
    if (statusRingText) statusRingText.textContent = cfg.text;
  }
}

// Apply 50 Settings to Visual System
function applySettingsToUI() {
  // notch_style: 0=Classic (attached to top), 1=Floating
  if (notchStage) {
    if (currentSettings.notch_style === 1) {
      notchStage.classList.add("is-floating");
    } else {
      notchStage.classList.remove("is-floating");
    }
  }

  // glass & glass_tint
  if (notchShell) {
    if (currentSettings.glass === 1) {
      notchShell.classList.add("is-glass");
    } else {
      notchShell.classList.remove("is-glass");
    }
  }

  updateStatusRing();
  renderWidgetsStage();
  renderPrayerUI();
  updateRawSettingsPreview();
}

// Notch Expand/Collapse
let isNotchExpanded = true;
function setNotchExpanded(expanded) {
  isNotchExpanded = expanded;
  if (btnToggleNotch) btnToggleNotch.setAttribute("aria-expanded", String(expanded));
  if (btnToggleNotchLabel) btnToggleNotchLabel.textContent = expanded ? "Tutup Notch" : "Buka Notch";

  if (notchShell) {
    if (expanded) {
      notchShell.classList.add("is-expanded");
    } else {
      notchShell.classList.remove("is-expanded");
    }
  }
  if (notchExpandedBody) notchExpandedBody.hidden = !expanded;
}

btnToggleNotch?.addEventListener("click", () => {
  setNotchExpanded(!isNotchExpanded);
});

// Notch Tabs
const notchTabButtons = document.querySelectorAll("[data-notch-tab]");
notchTabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tabName = btn.dataset.notchTab;
    switchNotchTab(tabName);
  });
});

function switchNotchTab(target) {
  notchTabButtons.forEach((btn) => {
    const isTarget = btn.dataset.notchTab === target;
    btn.setAttribute("aria-selected", String(isTarget));
    const panel = document.getElementById(`npanel-${btn.dataset.notchTab}`);
    if (panel) panel.hidden = !isTarget;
  });
}

// Music Player & LRCLIB Sync
const playerTrackTitle = document.getElementById("player-track-title");
const playerTrackArtist = document.getElementById("player-track-artist");
const playerTimeCurrent = document.getElementById("player-time-current");
const playerTimeTotal = document.getElementById("player-time-total");
const playerProgressFill = document.getElementById("player-progress-fill");
const btnTrackPlay = document.getElementById("btn-track-play");
const btnTrackPrev = document.getElementById("btn-track-prev");
const btnTrackNext = document.getElementById("btn-track-next");
const lyricsContainer = document.getElementById("lyrics-container");
const lyricsStatusBanner = document.getElementById("lyrics-status-banner");
const formLrclibSearch = document.getElementById("form-lrclib-search");
const inputLrclibQuery = document.getElementById("input-lrclib-query");
const btnLrclibSimError = document.getElementById("btn-lrclib-sim-error");

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function loadTrack(index) {
  currentTrackIndex = (index + DEMO_TRACKS.length) % DEMO_TRACKS.length;
  const track = DEMO_TRACKS[currentTrackIndex];
  if (playerTrackTitle) playerTrackTitle.textContent = track.title;
  if (playerTrackArtist) playerTrackArtist.textContent = `${track.artist}, ${track.album}`;
  if (notchMiniTrack) notchMiniTrack.textContent = `${track.artist}: ${track.title}`;
  playerProgressSec = 0;
  if (playerTimeTotal) playerTimeTotal.textContent = formatTime(track.durationSec);
  activeLyrics = track.lyrics;
  if (lyricsContainer) renderLyrics(activeLyrics);
  updatePlayerUI();
}

function renderLyrics(lyrics) {
  if (!lyricsContainer) return;
  lyricsContainer.innerHTML = "";
  if (!lyrics || lyrics.length === 0) {
    if (lyricsStatusBanner) {
      lyricsStatusBanner.hidden = false;
      lyricsStatusBanner.className = "state-banner";
      lyricsStatusBanner.textContent = "Tidak ada lirik tersinkron untuk lagu ini. Coba gunakan kolom pencarian LRCLIB di atas.";
    }
    return;
  }
  if (lyricsStatusBanner) lyricsStatusBanner.hidden = true;
  lyrics.forEach((item, idx) => {
    const p = document.createElement("p");
    p.className = "lyric-line";
    p.dataset.time = item.time;
    p.dataset.index = idx;
    p.textContent = item.text;
    lyricsContainer.appendChild(p);
  });
}

function updateLyricsHighlight(currentSec) {
  if (!lyricsContainer) return;
  const lines = lyricsContainer.querySelectorAll(".lyric-line");
  let activeIndex = -1;
  lines.forEach((line, idx) => {
    const t = Number(line.dataset.time);
    if (currentSec >= t) {
      activeIndex = idx;
    }
  });

  lines.forEach((line, idx) => {
    if (idx === activeIndex) {
      line.classList.add("is-active");
      line.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } else {
      line.classList.remove("is-active");
    }
  });
}

function updatePlayerUI() {
  const track = DEMO_TRACKS[currentTrackIndex];
  if (playerTimeCurrent) playerTimeCurrent.textContent = formatTime(playerProgressSec);
  const pct = Math.min(100, Math.round((playerProgressSec / track.durationSec) * 100));
  if (playerProgressFill) playerProgressFill.style.width = `${pct}%`;
  updateLyricsHighlight(playerProgressSec);

  if (btnTrackPlay) btnTrackPlay.textContent = isPlaying ? "Jeda" : "Putar";
  if (notchMiniWave) {
    if (isPlaying) {
      notchMiniWave.classList.add("is-playing");
    } else {
      notchMiniWave.classList.remove("is-playing");
    }
  }
}

btnTrackPlay?.addEventListener("click", () => {
  isPlaying = !isPlaying;
  updatePlayerUI();
});

btnTrackPrev?.addEventListener("click", () => {
  loadTrack(currentTrackIndex - 1);
});

btnTrackNext?.addEventListener("click", () => {
  loadTrack(currentTrackIndex + 1);
});

function parseSyncedLrc(lrcText) {
  if (!lrcText) return [];
  return lrcText
    .split("\n")
    .map((line) => {
      const m = line.match(/\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
      if (!m) return null;
      const sec = Number.parseInt(m[1], 10) * 60 + Number.parseFloat(m[2]);
      return { time: Math.floor(sec), text: m[3].trim() };
    })
    .filter(Boolean);
}

function applyLrclibMatch(match) {
  if (match.syncedLyrics) {
    const parsed = parseSyncedLrc(match.syncedLyrics);
    if (playerTrackTitle) playerTrackTitle.textContent = match.trackName;
    if (playerTrackArtist) playerTrackArtist.textContent = `${match.artistName}, ${match.albumName || "LRCLIB"}`;
    if (notchMiniTrack) notchMiniTrack.textContent = `${match.artistName}: ${match.trackName}`;
    activeLyrics = parsed;
    renderLyrics(activeLyrics);
    if (lyricsStatusBanner) {
      lyricsStatusBanner.hidden = false;
      lyricsStatusBanner.className = "state-banner";
      lyricsStatusBanner.textContent = `Lirik bersinkronisasi ditemukan: "${match.trackName}" oleh ${match.artistName}.`;
    }
  } else if (match.plainLyrics) {
    const plain = match.plainLyrics
      .split("\n")
      .filter((l) => l.trim())
      .map((text, i) => ({ time: i * 5, text }));
    if (playerTrackTitle) playerTrackTitle.textContent = match.trackName;
    if (playerTrackArtist) playerTrackArtist.textContent = match.artistName;
    if (notchMiniTrack) notchMiniTrack.textContent = `${match.artistName}: ${match.trackName}`;
    activeLyrics = plain;
    renderLyrics(activeLyrics);
    if (lyricsStatusBanner) {
      lyricsStatusBanner.hidden = false;
      lyricsStatusBanner.className = "state-banner";
      lyricsStatusBanner.textContent = `Lirik teks biasa ditemukan untuk "${match.trackName}" oleh ${match.artistName} (estimasi 5 detik per baris).`;
    }
  } else {
    throw new Error("Lirik kosong pada hasil pencarian.");
  }
}

formLrclibSearch?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const query = inputLrclibQuery ? inputLrclibQuery.value.trim() : "";
  if (!query) return;

  if (lyricsStatusBanner) {
    lyricsStatusBanner.hidden = false;
    lyricsStatusBanner.className = "state-banner";
    lyricsStatusBanner.textContent = `Sedang mengambil lirik dari LRCLIB untuk "${query}"...`;
  }

  try {
    const resp = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`, {
      headers: {
        "Lrclib-Client": "Kala/1.0.1 (https://github.com/kala-open/kala)",
      },
    });
    if (!resp.ok) throw new Error(`HTTP status: ${resp.status}`);
    const data = await resp.json();

    if (Array.isArray(data) && data.length > 0) {
      const match = data.find((d) => d.syncedLyrics) || data[0];
      applyLrclibMatch(match);
    } else if (lyricsStatusBanner) {
      lyricsStatusBanner.hidden = false;
      lyricsStatusBanner.className = "state-banner";
      lyricsStatusBanner.textContent = `Lirik tidak ditemukan di LRCLIB untuk "${query}". Coba kata kunci judul lagu lain.`;
    }
  } catch (err) {
    if (lyricsStatusBanner) {
      lyricsStatusBanner.hidden = false;
      lyricsStatusBanner.className = "state-banner is-error";
      lyricsStatusBanner.textContent = `Koneksi ke LRCLIB gagal: ${err.message}. Periksa jaringan Anda atau coba lagi nanti.`;
    }
  }
});

btnLrclibSimError?.addEventListener("click", () => {
  lyricsStatusBanner.hidden = false;
  lyricsStatusBanner.className = "state-banner is-error";
  lyricsStatusBanner.textContent = "Simulasi kegagalan API LRCLIB (Status 503 Layanan Sibuk): Lirik offline tetap aman.";
});

function tickPlayer() {
  if (isPlaying) {
    playerProgressSec += 1;
    const track = DEMO_TRACKS[currentTrackIndex];
    if (playerProgressSec >= track.durationSec) {
      loadTrack(currentTrackIndex + 1);
    } else {
      updatePlayerUI();
    }
  }
}

// Pomodoro Timer
const pomoPhaseTitle = document.getElementById("pomo-phase-title");
const pomoTimerDisplay = document.getElementById("pomo-timer-display");
const pomoSummaryText = document.getElementById("pomo-summary-text");
const btnPomoToggle = document.getElementById("btn-pomo-toggle");
const btnPomoSkip = document.getElementById("btn-pomo-skip");
const btnPomoReset = document.getElementById("btn-pomo-reset");
const pomoModeButtons = document.querySelectorAll("[data-pomo-mode]");

function updatePomoDisplay() {
  const mins = Math.floor(pomoSecondsLeft / 60);
  const secs = pomoSecondsLeft % 60;
  if (pomoTimerDisplay) pomoTimerDisplay.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  if (btnPomoToggle) btnPomoToggle.textContent = pomoRunning ? "Jeda Fokus" : "Mulai Fokus";

  if (pomoPhaseTitle) {
    if (pomoMode === "focus") {
      pomoPhaseTitle.textContent = `Sesi Fokus (Ronde ${pomoRound} dari 4)`;
    } else if (pomoMode === "short") {
      pomoPhaseTitle.textContent = `Istirahat Pendek (Ronde ${pomoRound} dari 4)`;
    } else {
      pomoPhaseTitle.textContent = "Istirahat Panjang (Selesai 4 Ronde)";
    }
  }
  if (pomoSummaryText) {
    pomoSummaryText.textContent = `Sesi selesai hari ini: ${pomoSessionsCompleted} sesi (${pomoSessionsCompleted * currentSettings.focus} menit fokus)`;
  }
}

function setPomoMode(mode) {
  pomoMode = mode;
  pomoRunning = false;
  if (mode === "focus") {
    pomoSecondsLeft = currentSettings.focus * 60;
  } else if (mode === "short") {
    pomoSecondsLeft = currentSettings.short_break * 60;
  } else {
    pomoSecondsLeft = currentSettings.long_break * 60;
  }
  updatePomoDisplay();
}

pomoModeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    setPomoMode(btn.dataset.pomoMode);
  });
});

btnPomoToggle?.addEventListener("click", () => {
  pomoRunning = !pomoRunning;
  updatePomoDisplay();
});

btnPomoSkip?.addEventListener("click", () => {
  if (pomoMode === "focus") {
    pomoSessionsCompleted += 1;
    if (pomoRound >= 4) {
      pomoRound = 1;
      setPomoMode("long");
    } else {
      pomoRound += 1;
      setPomoMode("short");
    }
  } else {
    setPomoMode("focus");
  }
});

btnPomoReset?.addEventListener("click", () => {
  setPomoMode("focus");
});

function tickPomodoro() {
  if (pomoRunning) {
    if (pomoSecondsLeft > 0) {
      pomoSecondsLeft -= 1;
      updatePomoDisplay();
    } else {
      // Completed phase
      pomoRunning = false;
      showHudToast(`Pomodoro: Fase ${pomoMode} selesai`);
      if (pomoMode === "focus") {
        pomoSessionsCompleted += 1;
        if (pomoRound >= 4) {
          pomoRound = 1;
          setPomoMode("long");
        } else {
          pomoRound += 1;
          setPomoMode("short");
        }
      } else {
        setPomoMode("focus");
      }
    }
  }
}

// To-Do & Tasks Manager
const formAddTodo = document.getElementById("form-add-todo");
const inputTodoTitle = document.getElementById("input-todo-title");
const inputTodoTime = document.getElementById("input-todo-time");
const inputTodoDuration = document.getElementById("input-todo-duration");
const todoEmptyBanner = document.getElementById("todo-empty-banner");
const todoList = document.getElementById("todo-list");

function renderTodoList() {
  todoList.innerHTML = "";
  if (todos.length === 0) {
    todoEmptyBanner.hidden = false;
    return;
  }
  todoEmptyBanner.hidden = true;

  todos.forEach((item) => {
    const li = document.createElement("li");
    li.className = "item-row";

    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.alignItems = "center";
    left.style.gap = "10px";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = item.done;
    checkbox.setAttribute("aria-label", `Tandai selesai: ${item.title}`);
    checkbox.style.width = "18px";
    checkbox.style.height = "18px";
    checkbox.addEventListener("change", () => {
      item.done = checkbox.checked;
      saveStoredTodos();
      renderTodoList();
      updateStatusRing();
    });

    const info = document.createElement("div");
    const titleSpan = document.createElement("span");
    titleSpan.style.display = "block";
    titleSpan.style.fontSize = "14px";
    titleSpan.style.fontWeight = "600";
    if (item.done) {
      titleSpan.style.textDecoration = "line-through";
      titleSpan.style.color = "var(--text-muted)";
    } else {
      titleSpan.style.color = "var(--text-primary)";
    }
    titleSpan.textContent = item.title;

    const timeSpan = document.createElement("span");
    timeSpan.style.fontSize = "12px";
    timeSpan.style.color = "var(--text-secondary)";
    timeSpan.className = "tabular-nums";
    timeSpan.textContent = `${item.time} (${item.duration} menit)`;

    info.appendChild(titleSpan);
    info.appendChild(timeSpan);
    left.appendChild(checkbox);
    left.appendChild(info);

    const btnDelete = document.createElement("button");
    btnDelete.type = "button";
    btnDelete.className = "btn";
    btnDelete.style.padding = "4px 10px";
    btnDelete.style.fontSize = "12px";
    btnDelete.textContent = "Hapus";
    btnDelete.addEventListener("click", () => {
      todos = todos.filter((t) => t.id !== item.id);
      saveStoredTodos();
      renderTodoList();
      updateStatusRing();
    });

    li.appendChild(left);
    li.appendChild(btnDelete);
    todoList.appendChild(li);
  });
}

formAddTodo?.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = inputTodoTitle.value.trim();
  if (!title) return;
  todos.push({
    id: `td-${Date.now()}`,
    title,
    time: inputTodoTime.value || "12:00",
    duration: Number(inputTodoDuration.value) || 30,
    done: false
  });
  inputTodoTitle.value = "";
  saveStoredTodos();
  renderTodoList();
  updateStatusRing();
});

window.addEventListener("storage", (e) => {
  if (e.key === TODO_STORAGE_KEY) {
    todos = loadStoredTodos();
    renderTodoList();
    updateStatusRing();
  }
});

// Water Hydration Tracker
const waterProgressLabel = document.getElementById("water-progress-label");
const waterProgressFill = document.getElementById("water-progress-fill");
const waterBottleStatus = document.getElementById("water-bottle-status");
const btnWaterDrink = document.getElementById("btn-water-drink");
const btnWaterRefill = document.getElementById("btn-water-refill");
const btnWaterReset = document.getElementById("btn-water-reset");
const selectWaterGoal = document.getElementById("select-water-goal");
const selectWaterBottle = document.getElementById("select-water-bottle");

function updateWaterUI() {
  const pct = Math.min(100, Math.round((waterState.taken / waterState.goal) * 100));
  waterProgressLabel.textContent = `${waterState.taken} ml dari ${waterState.goal} ml (${pct}%)`;
  waterProgressFill.style.width = `${pct}%`;
  waterBottleStatus.textContent = `Sisa di botol (${waterState.bottle} ml): ${waterState.inb} ml (Jam aktif ${String(waterState.start).padStart(2, "0")}:00 ke ${String(waterState.end).padStart(2, "0")}:00)`;
  updateStatusRing();
}

btnWaterDrink?.addEventListener("click", () => {
  const drinkAmt = 250;
  waterState.taken += drinkAmt;
  waterState.inb = Math.max(0, waterState.inb - drinkAmt);
  updateWaterUI();
  showHudToast(`Air: +${drinkAmt} ml dicatat`);
});

btnWaterRefill?.addEventListener("click", () => {
  waterState.inb = waterState.bottle;
  updateWaterUI();
  showHudToast(`Botol diisi penuh: ${waterState.bottle} ml`);
});

btnWaterReset?.addEventListener("click", () => {
  waterState.taken = 0;
  waterState.inb = waterState.bottle;
  updateWaterUI();
});

selectWaterGoal?.addEventListener("change", (e) => {
  waterState.goal = Number(e.target.value);
  updateWaterUI();
});

selectWaterBottle?.addEventListener("change", (e) => {
  waterState.bottle = Number(e.target.value);
  waterState.inb = waterState.bottle;
  updateWaterUI();
});

// Prayer Times (Kemenag RI 84 Indonesian Cities)
const prayerCityHeading = document.getElementById("prayer-city-heading");
const prayerNextSummary = document.getElementById("prayer-next-summary");
const prayerSlotsGrid = document.getElementById("prayer-slots-grid");
const notchSelectPrayerCity = document.getElementById("notch-select-prayer-city");

function populatePrayerCityDropdown() {
  if (!notchSelectPrayerCity) return;
  notchSelectPrayerCity.innerHTML = "";
  PRAYER_CITIES.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.index;
    opt.textContent = `${c.name} (${c.province})`;
    if (c.index === currentSettings.prayer_city) {
      opt.selected = true;
    }
    notchSelectPrayerCity.appendChild(opt);
  });
}

function renderPrayerUI() {
  const cityIndex = currentSettings.prayer_city;
  const schedule = computeKemenagPrayerSchedule(cityIndex, currentSettings);

  prayerCityHeading.textContent = `Jadwal Sholat Kemenag RI: ${schedule.city}, ${schedule.province}`;
  prayerNextSummary.textContent = `Berikutnya: ${schedule.nextName} pukul ${schedule.nextTime} (${schedule.tzLabel}) • ${schedule.minutesUntilNext} menit lagi`;

  prayerSlotsGrid.innerHTML = "";
  schedule.slots.forEach((s) => {
    const isNext = s.name === schedule.nextName;
    const card = document.createElement("div");
    card.className = `prayer-slot ${isNext ? "is-next" : ""}`;

    const nameSpan = document.createElement("span");
    nameSpan.className = "prayer-slot-name";
    nameSpan.textContent = s.name;

    const timeSpan = document.createElement("span");
    timeSpan.className = "prayer-slot-time";
    timeSpan.textContent = s.time;

    card.appendChild(nameSpan);
    card.appendChild(timeSpan);
    prayerSlotsGrid.appendChild(card);
  });
}

notchSelectPrayerCity?.addEventListener("change", (e) => {
  saveSetting("prayer_city", e.target.value);
});

// File Shelf & Clipboard
const formAddShelf = document.getElementById("form-add-shelf");
const inputShelfItem = document.getElementById("input-shelf-item");
const shelfList = document.getElementById("shelf-list");
const shelfEmptyBanner = document.getElementById("shelf-empty-banner");
const btnClearShelf = document.getElementById("btn-clear-shelf");

const formAddClip = document.getElementById("form-add-clip");
const inputClipItem = document.getElementById("input-clip-item");
const clipList = document.getElementById("clip-list");
const clipEmptyBanner = document.getElementById("clip-empty-banner");
const btnClearClip = document.getElementById("btn-clear-clip");

function renderShelfList() {
  shelfList.innerHTML = "";
  if (shelfItems.length === 0) {
    shelfEmptyBanner.hidden = false;
    return;
  }
  shelfEmptyBanner.hidden = true;
  shelfItems.forEach((raw, idx) => {
    const path = typeof raw === 'object' && raw !== null ? (raw.path || raw.name || '') : String(raw);
    const li = document.createElement("li");
    li.className = "item-row";

    const span = document.createElement("span");
    span.style.fontSize = "13px";
    span.style.wordBreak = "break-all";
    span.textContent = path;

    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.className = "btn";
    btnDel.style.padding = "4px 8px";
    btnDel.style.fontSize = "12px";
    btnDel.textContent = "Hapus";
    btnDel.addEventListener("click", () => {
      shelfItems.splice(idx, 1);
      saveStoredShelf();
      renderShelfList();
    });

    li.appendChild(span);
    li.appendChild(btnDel);
    shelfList.appendChild(li);
  });
}

function renderClipList() {
  clipList.innerHTML = "";
  if (clipItems.length === 0) {
    clipEmptyBanner.hidden = false;
    return;
  }
  clipEmptyBanner.hidden = true;
  clipItems.forEach((raw, idx) => {
    let text = typeof raw === 'object' && raw !== null ? (raw.text || JSON.stringify(raw)) : String(raw ?? '');
    while (typeof text === 'object' && text !== null) {
      text = text.text || JSON.stringify(text);
    }
    const li = document.createElement("li");
    li.className = "item-row";

    const span = document.createElement("span");
    span.style.fontSize = "13px";
    span.style.fontFamily = "monospace";
    span.style.whiteSpace = "nowrap";
    span.style.overflow = "hidden";
    span.style.textOverflow = "ellipsis";
    span.style.maxWidth = "260px";
    span.textContent = text;

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "6px";

    const btnCopy = document.createElement("button");
    btnCopy.type = "button";
    btnCopy.className = "btn";
    btnCopy.style.padding = "4px 8px";
    btnCopy.style.fontSize = "12px";
    btnCopy.textContent = "Salin";
    btnCopy.addEventListener("click", () => {
      void navigator.clipboard.writeText(text);
      showHudToast("Teks disalin ke papan klip");
    });

    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.className = "btn";
    btnDel.style.padding = "4px 8px";
    btnDel.style.fontSize = "12px";
    btnDel.textContent = "Hapus";
    btnDel.addEventListener("click", () => {
      clipItems.splice(idx, 1);
      renderClipList();
    });

    row.appendChild(btnCopy);
    row.appendChild(btnDel);
    li.appendChild(span);
    li.appendChild(row);
    clipList.appendChild(li);
  });
}

formAddShelf?.addEventListener("submit", (e) => {
  e.preventDefault();
  const val = inputShelfItem.value.trim();
  if (!val) return;
  shelfItems.unshift(val);
  inputShelfItem.value = "";
  saveStoredShelf();
  renderShelfList();
});

btnClearShelf?.addEventListener("click", () => {
  shelfItems = [];
  saveStoredShelf();
  renderShelfList();
});

window.addEventListener("storage", (e) => {
  if (e.key === SHELF_STORAGE_KEY) {
    shelfItems = loadStoredShelf();
    renderShelfList();
  }
});

formAddClip?.addEventListener("submit", (e) => {
  e.preventDefault();
  const val = inputClipItem.value.trim();
  if (!val) return;
  clipItems.unshift(val);
  if (clipItems.length > 50) clipItems.pop();
  inputClipItem.value = "";
  renderClipList();
});

btnClearClip?.addEventListener("click", () => {
  clipItems = [];
  renderClipList();
});

// Today & Widgets Stage
const widgetsStageGrid = document.getElementById("widgets-stage-grid");

function createWidgetCard(title, contentEl) {
  const card = document.createElement("div");
  card.className = "notch-card";
  const h = document.createElement("h2");
  h.className = "notch-card-title";
  h.textContent = title;
  card.appendChild(h);
  card.appendChild(contentEl);
  return card;
}

function buildWidgetContent(typeIndex) {
  // 0: This week, 1: Next prayer, 2: Focus today, 3: World clock, 4: Moon phase, 5: Countdown
  const div = document.createElement("div");

  if (typeIndex === 0) {
    div.innerHTML = `
      <p class="notch-card-sub">Ringkasan Aktivitas Mingguan</p>
      <div style="font-size: 13px; color: #D0D7E6; display: flex; flex-direction: column; gap: 4px;">
        <span>Fokus selesai: 14 sesi (350 menit)</span>
        <span>Target air tercapai: 5 dari 7 hari</span>
        <span>Tugas diselesaikan: 19 tugas</span>
      </div>
    `;
  } else if (typeIndex === 1) {
    const sched = computeKemenagPrayerSchedule(currentSettings.prayer_city, currentSettings);
    div.innerHTML = `
      <p class="notch-card-sub">${sched.city} (${sched.tzLabel})</p>
      <p style="font-size: 20px; font-weight: 700; color: #F59E0B; margin: 4px 0;" class="tabular-nums">${sched.nextName}: ${sched.nextTime}</p>
      <span style="font-size: 12px; color: #B6C0D4;">${sched.minutesUntilNext} menit menuju waktu sholat</span>
    `;
  } else if (typeIndex === 2) {
    div.innerHTML = `
      <p class="notch-card-sub">Statistik Fokus Hari Ini</p>
      <p style="font-size: 24px; font-weight: 800; color: #34D399; margin: 4px 0;" class="tabular-nums">${pomoSessionsCompleted} Sesi</p>
      <span style="font-size: 12px; color: #B6C0D4;">Total durasi: ${pomoSessionsCompleted * currentSettings.focus} menit produktif</span>
    `;
  } else if (typeIndex === 3) {
    const city1 = WORLD_CITIES[currentSettings.widget_city1] || WORLD_CITIES[5];
    const city2 = WORLD_CITIES[currentSettings.widget_city2] || WORLD_CITIES[13];
    const nowUtc = Date.now() + new Date().getTimezoneOffset() * 60000;
    const t1 = new Date(nowUtc + city1.offset * 3600000);
    const t2 = new Date(nowUtc + city2.offset * 3600000);
    const f = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    div.innerHTML = `
      <p class="notch-card-sub">Jam Dunia (Pilihan Setelan)</p>
      <div style="display: flex; justify-content: space-between; font-size: 14px; color: #F3F5F8; margin-top: 6px;" class="tabular-nums">
        <div><strong>${city1.name}</strong>: ${f(t1)}</div>
        <div><strong>${city2.name}</strong>: ${f(t2)}</div>
      </div>
    `;
  } else if (typeIndex === 4) {
    const moon = computeMoonPhase();
    div.innerHTML = `
      <p class="notch-card-sub">${moon.phaseName}</p>
      <p style="font-size: 22px; font-weight: 700; color: #F3F5F8; margin: 4px 0;" class="tabular-nums">${moon.illumination}% Terang</p>
      <span style="font-size: 12px; color: #B6C0D4;">${moon.daysToFull} hari menuju Bulan Purnama</span>
    `;
  } else {
    const evt = COUNTDOWN_EVENTS[currentSettings.widget_event] || COUNTDOWN_EVENTS[1];
    div.innerHTML = `
      <p class="notch-card-sub">Hari Besar Terdekat</p>
      <p style="font-size: 20px; font-weight: 700; color: #F59E0B; margin: 4px 0;">${evt.name}</p>
      <span style="font-size: 12px; color: #B6C0D4;">Peringatan kalender tahunan aktif</span>
    `;
  }

  return div;
}

function renderWidgetsStage() {
  if (!widgetsStageGrid) return;
  widgetsStageGrid.innerHTML = "";
  const leftType = currentSettings.widget_left;
  const rightType = currentSettings.widget_right;
  widgetsStageGrid.appendChild(createWidgetCard(`Widget Kiri (${getWidgetName(leftType)})`, buildWidgetContent(leftType)));
  widgetsStageGrid.appendChild(createWidgetCard(`Widget Kanan (${getWidgetName(rightType)})`, buildWidgetContent(rightType)));
}

function getWidgetName(idx) {
  const names = ["This week", "Next prayer", "Focus today", "World clock", "Moon phase", "Countdown"];
  return names[idx] || "Widget";
}

// HUD Toast Simulator
let hudTimer = null;
function showHudToast(text) {
  if (!hudToast || !hudToastText) return;
  hudToastText.textContent = text;
  hudToast.hidden = false;
  if (hudTimer) clearTimeout(hudTimer);
  hudTimer = setTimeout(() => {
    hudToast.hidden = true;
  }, 2600);
}

document.getElementById("btn-dismiss-hud")?.addEventListener("click", () => {
  hudToast.hidden = true;
});

document.getElementById("btn-test-hud")?.addEventListener("click", () => {
  showHudToast("Volume Audio: 84% • Headset Bluetooth Terhubung");
});

// Mascot badge click interaction
mascotStatusBadge?.addEventListener("click", () => {
  const moods = ["Siaga", "Ceria", "Fokus", "Haus", "Mengantuk"];
  const randomMood = moods[Math.floor(Math.random() * moods.length)];
  if (mascotMoodText) mascotMoodText.textContent = `Nusa Mascot: ${randomMood}`;
  showHudToast(`Mascot: Mode ${randomMood} diaktifkan`);
});

// Settings Navigation Tabs
const settingsNavButtons = document.querySelectorAll("[data-settings-tab]");
settingsNavButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.settingsTab;
    switchSettingsTab(tab);
  });
});

function switchSettingsTab(target) {
  settingsNavButtons.forEach((btn) => {
    const isTarget = btn.dataset.settingsTab === target;
    btn.setAttribute("aria-selected", String(isTarget));
    const panel = document.getElementById(`spanel-${btn.dataset.settingsTab}`);
    if (panel) panel.hidden = !isTarget;
  });
}

// 50 Settings Definitions & Renderers
const SETTINGS_CATEGORIES = {
  general: [
    { key: "sound", label: "Efek Suara UI", help: "Mainkan efek audio halus saat mengubah status atau tombol.", type: "toggle" },
    { key: "open_click", label: "Buka Notch dengan Klik", help: "Notch akan terbuka saat diklik (bukan hanya saat kursor mendekat).", type: "toggle" },
    { key: "page_icons", label: "Ikon Halaman", help: "Tampilkan ikon pada tab navigasi Living Notch.", type: "toggle" },
    { key: "fast_animation", label: "Animasi Cepat", help: "Percepat durasi transisi membuka/menutup notch.", type: "toggle" },
    { key: "hide_fullscreen", label: "Sembunyikan di Layar Penuh", help: "Otomatis sembunyikan notch saat jendela aplikasi lain berada dalam mode fullscreen.", type: "toggle" },
    {
      key: "status_ring",
      label: "Indikator Status Ring",
      help: "Pilih status yang dilingkarkan pada pill notch compact.",
      type: "select",
      options: [
        { value: 0, text: "Baterai pada Laptop" },
        { value: 1, text: "Progres Air Minum Hari Ini" },
        { value: 2, text: "Tugas Selesai Hari Ini" },
        { value: 3, text: "Tanpa Ring (Nonaktif)" }
      ]
    }
  ],
  appearance: [
    {
      key: "notch_style",
      label: "Gaya Bentuk Notch",
      help: "Classic menyatu dengan bezel atas layar, Floating melayang tepat di bawah tepi.",
      type: "select",
      options: [
        { value: 0, text: "Classic (Menyatu di Bezel Atas Layar)" },
        { value: 1, text: "Floating (Mengambang Bebas di Bawah Tepi)" }
      ]
    },
    { key: "glass", label: "Efek Kaca Transparan (Glassmorphism)", help: "Aktifkan efek blur akrilik/mika pada latar belakang notch.", type: "toggle" },
    { key: "glass_tint", label: "Intensitas Tint Kaca", help: "Tingkat kegelapan lapisan kaca (0 hingga 100).", type: "range", min: 0, max: 100 }
  ],
  music: [
    { key: "lyrics", label: "Lirik Lagu Otomatis", help: "Tampilkan lirik sinkron dari API LRCLIB saat memutar musik.", type: "toggle" },
    { key: "hud_volume", label: "Overlay HUD Volume", help: "Tampilkan toast HUD saat tombol volume keyboard ditekan.", type: "toggle" },
    { key: "hud_brightness", label: "Overlay HUD Kecerahan Layar", help: "Tampilkan level kecerahan layar saat disesuaikan.", type: "toggle" },
    { key: "hud_caps", label: "Overlay HUD Caps Lock", help: "Tampilkan status Caps Lock Aktif/Mati saat tombol ditekan.", type: "toggle" },
    { key: "hud_language", label: "Overlay HUD Bahasa Input", help: "Tampilkan notifikasi saat tata letak keyboard berganti.", type: "toggle" },
    { key: "popup_battery", label: "Popup Peringatan Baterai", help: "Notifikasi visual saat baterai berada di bawah 20%.", type: "toggle" },
    { key: "popup_wifi", label: "Popup Status Wi-Fi", help: "Tampilkan indikator saat jaringan Wi-Fi terputus atau tersambung.", type: "toggle" },
    { key: "popup_bluetooth", label: "Popup Perangkat Bluetooth", help: "Tampilkan notifikasi saat headset atau mouse Bluetooth terhubung.", type: "toggle" }
  ],
  productivity: [
    { key: "focus", label: "Durasi Sesi Fokus (Menit)", help: "Panjang waktu fokus kerja Pomodoro.", type: "range", min: 10, max: 60 },
    { key: "short_break", label: "Durasi Istirahat Pendek (Menit)", help: "Waktu istirahat setelah satu sesi fokus selesai.", type: "range", min: 2, max: 15 },
    { key: "long_break", label: "Durasi Istirahat Panjang (Menit)", help: "Waktu istirahat setelah 4 sesi fokus selesai.", type: "range", min: 10, max: 30 },
    { key: "todo_start", label: "Pengingat Tugas Dimulai", help: "Kirim notifikasi tepat saat jam mulai tugas tercapai.", type: "toggle" },
    { key: "todo_end", label: "Pengingat Waktu Habis", help: "Kirim notifikasi saat alokasi durasi tugas telah usai.", type: "toggle" },
    {
      key: "snooze",
      label: "Durasi Tunda (Snooze)",
      help: "Waktu tunda pengingat tugas.",
      type: "select",
      options: [
        { value: 5, text: "5 Menit" },
        { value: 10, text: "10 Menit" },
        { value: 15, text: "15 Menit" }
      ]
    },
    { key: "week_monday", label: "Mulai Pekan Hari Senin", help: "Kalender mingguan dimulai pada hari Senin (bukan Minggu).", type: "toggle" },
    { key: "calendar_week", label: "Tampilkan Nomor Minggu", help: "Sertakan nomor minggu tahunan pada tampilan kalender.", type: "toggle" },
    { key: "todo_ordered", label: "Urutkan Tugas Berdasarkan Waktu", help: "Susun daftar tugas harian secara kronologis.", type: "toggle" }
  ],
  prayer: [
    { key: "prayer", label: "Aktifkan Jadwal Sholat Kemenag RI", help: "Hitung dan tampilkan 5 waktu sholat harian.", type: "toggle" },
    {
      key: "prayer_city",
      label: "Kota Acuan (84 Kota / 38 Provinsi)",
      help: "Pilih kota untuk perhitungan astronomis posisi matahari.",
      type: "select",
      options: PRAYER_CITIES.map((c) => ({ value: c.index, text: `${c.name} (${c.province})` }))
    },
    { key: "prayer_reminder", label: "Pengingat Masuk Waktu Sholat", help: "Kirim notifikasi saat azan tiba.", type: "toggle" },
    { key: "prayer_early", label: "Pengingat 10 Menit Lebih Awal", help: "Kirim peringatan bersiap 10 menit sebelum waktu sholat.", type: "toggle" },
    { key: "prayer_sound", label: "Bunyikan Nada Pengingat", help: "Mainkan nada halus saat pengingat sholat muncul.", type: "toggle" },
    { key: "prayer_pause_media", label: "Jeda Musik Otomatis Saat Sholat", help: "Otomatis hentikan sementara pemutaran media saat waktu sholat masuk.", type: "toggle" },
    { key: "prayer_adj_subuh", label: "Koreksi Menit Subuh", help: "Nilai 10 berarti 0 menit offset (-10 sampai +10 menit).", type: "range", min: 0, max: 20 },
    { key: "prayer_adj_dzuhur", label: "Koreksi Menit Dzuhur", help: "Nilai 10 berarti 0 menit offset.", type: "range", min: 0, max: 20 },
    { key: "prayer_adj_ashar", label: "Koreksi Menit Ashar", help: "Nilai 10 berarti 0 menit offset.", type: "range", min: 0, max: 20 },
    { key: "prayer_adj_maghrib", label: "Koreksi Menit Maghrib", help: "Nilai 10 berarti 0 menit offset.", type: "range", min: 0, max: 20 },
    { key: "prayer_adj_isya", label: "Koreksi Menit Isya", help: "Nilai 10 berarti 0 menit offset.", type: "range", min: 0, max: 20 }
  ],
  widgets: [
    { key: "today_page", label: "Halaman Today di Notch", help: "Aktifkan tab Today pada Living Notch.", type: "toggle" },
    { key: "widgets_page", label: "Halaman Widgets di Notch", help: "Aktifkan tab Widgets dengan dua modul pilihan.", type: "toggle" },
    {
      key: "widget_left",
      label: "Modul Widget Kiri",
      help: "Pilih informasi yang ditampilkan pada kartu kiri.",
      type: "select",
      options: [
        { value: 0, text: "This week (Ringkasan Pekan)" },
        { value: 1, text: "Next prayer (Waktu Sholat Berikutnya)" },
        { value: 2, text: "Focus today (Sesi Fokus Hari Ini)" },
        { value: 3, text: "World clock (Jam Dunia)" },
        { value: 4, text: "Moon phase (Fase & Iluminasi Bulan)" },
        { value: 5, text: "Countdown (Hitung Mundur Hari Besar)" }
      ]
    },
    {
      key: "widget_right",
      label: "Modul Widget Kanan",
      help: "Pilih informasi yang ditampilkan pada kartu kanan.",
      type: "select",
      options: [
        { value: 0, text: "This week (Ringkasan Pekan)" },
        { value: 1, text: "Next prayer (Waktu Sholat Berikutnya)" },
        { value: 2, text: "Focus today (Sesi Fokus Hari Ini)" },
        { value: 3, text: "World clock (Jam Dunia)" },
        { value: 4, text: "Moon phase (Fase & Iluminasi Bulan)" },
        { value: 5, text: "Countdown (Hitung Mundur Hari Besar)" }
      ]
    },
    {
      key: "widget_city1",
      label: "Kota Jam Dunia 1",
      help: "Kota pertama untuk modul World Clock.",
      type: "select",
      options: WORLD_CITIES.map((c) => ({ value: c.index, text: c.name }))
    },
    {
      key: "widget_city2",
      label: "Kota Jam Dunia 2",
      help: "Kota kedua untuk modul World Clock.",
      type: "select",
      options: WORLD_CITIES.map((c) => ({ value: c.index, text: c.name }))
    },
    {
      key: "widget_event",
      label: "Hari Besar Hitung Mundur",
      help: "Pilih perayaan tahunan yang ingin dipantau.",
      type: "select",
      options: COUNTDOWN_EVENTS.map((e) => ({ value: e.index, text: e.name }))
    },
    { key: "shelf_clear", label: "Pembersihan Otomatis File Shelf", help: "Kosongkan berkas shelf setiap berganti hari.", type: "toggle" },
    { key: "clipboard", label: "Perekam Riwayat Papan Klip", help: "Simpan riwayat cuplikan teks yang disalin.", type: "toggle" },
    { key: "clipboard_max", label: "Kapasitas Riwayat Maksimal (50 Slot)", help: "Di edisi open source ini, 50 slot aktif tanpa syarat lisensi pro.", type: "toggle" },
    { key: "clipboard_keep", label: "Pertahankan Riwayat Antar Sesi", help: "Simpan riwayat ke berkas clipboard.txt secara permanen.", type: "toggle" },
    { key: "notifications", label: "Notifikasi Sistem Aktif", help: "Izinkan pengiriman pemberitahuan desktop.", type: "toggle" },
    { key: "notification_preview", label: "Tinjauan Teks Notifikasi", help: "Sertakan cuplikan isi pesan dalam notifikasi pop-up.", type: "toggle" }
  ]
};

function createSettingRow(item) {
  const row = document.createElement("div");
  row.className = "setting-row";

  const meta = document.createElement("div");
  meta.className = "setting-meta";

  const label = document.createElement("label");
  label.className = "setting-label";
  label.htmlFor = `ctrl-${item.key}`;
  label.textContent = item.label;

  const help = document.createElement("span");
  help.className = "setting-help";
  help.textContent = item.help;

  meta.appendChild(label);
  meta.appendChild(help);
  row.appendChild(meta);

  const ctrlWrapper = document.createElement("div");
  ctrlWrapper.className = "setting-control";

  const currentVal = currentSettings[item.key] ?? DEFAULT_SETTINGS[item.key] ?? 0;

  if (item.type === "toggle") {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toggle-btn";
    btn.id = `ctrl-${item.key}`;
    const isOn = currentVal === 1;
    btn.setAttribute("aria-pressed", String(isOn));
    btn.textContent = isOn ? "Aktif" : "Nonaktif";
    btn.addEventListener("click", () => {
      const nextVal = currentSettings[item.key] === 1 ? 0 : 1;
      saveSetting(item.key, nextVal);
      btn.setAttribute("aria-pressed", String(nextVal === 1));
      btn.textContent = nextVal === 1 ? "Aktif" : "Nonaktif";
    });
    ctrlWrapper.appendChild(btn);
  } else if (item.type === "select") {
    const select = document.createElement("select");
    select.className = "select-field";
    select.id = `ctrl-${item.key}`;
    item.options.forEach((opt) => {
      const el = document.createElement("option");
      el.value = opt.value;
      el.textContent = opt.text;
      if (opt.value === currentVal) el.selected = true;
      select.appendChild(el);
    });
    select.addEventListener("change", (e) => {
      saveSetting(item.key, Number(e.target.value));
    });
    ctrlWrapper.appendChild(select);
  } else if (item.type === "range") {
    const range = document.createElement("input");
    range.type = "range";
    range.id = `ctrl-${item.key}`;
    range.min = item.min;
    range.max = item.max;
    range.value = currentVal;
    range.style.flex = "1";

    const badge = document.createElement("span");
    badge.className = "tabular-nums";
    badge.style.fontSize = "13px";
    badge.style.minWidth = "40px";
    badge.style.textAlign = "right";

    if (item.key.startsWith("prayer_adj_")) {
      const offset = currentVal - 10;
      badge.textContent = `${offset >= 0 ? "+" : ""}${offset}m`;
    } else {
      badge.textContent = `${currentVal}`;
    }

    range.addEventListener("input", (e) => {
      const val = Number(e.target.value);
      if (item.key.startsWith("prayer_adj_")) {
        const offset = val - 10;
        badge.textContent = `${offset >= 0 ? "+" : ""}${offset}m`;
      } else {
        badge.textContent = `${val}`;
      }
    });

    range.addEventListener("change", (e) => {
      saveSetting(item.key, Number(e.target.value));
    });

    ctrlWrapper.appendChild(range);
    ctrlWrapper.appendChild(badge);
  }

  row.appendChild(ctrlWrapper);
  return row;
}

function renderAllSettingPanels() {
  Object.keys(SETTINGS_CATEGORIES).forEach((cat) => {
    const container = document.getElementById(`settings-list-${cat}`);
    if (!container) return;
    container.innerHTML = "";
    SETTINGS_CATEGORIES[cat].forEach((item) => {
      container.appendChild(createSettingRow(item));
    });
  });
}

// Raw `settings.txt` Inspector & Exporter
const rawSettingsPreview = document.getElementById("raw-settings-preview");
const btnCopySettingsTxt = document.getElementById("btn-copy-settings-txt");
const btnDownloadSettingsTxt = document.getElementById("btn-download-settings-txt");
const copySettingsFeedback = document.getElementById("copy-settings-feedback");

function generateSettingsTxt() {
  const keys = Object.keys(DEFAULT_SETTINGS);
  return keys.map((k) => `${k}=${currentSettings[k] ?? DEFAULT_SETTINGS[k]}`).join("\n");
}

function updateRawSettingsPreview() {
  if (rawSettingsPreview) {
    rawSettingsPreview.textContent = generateSettingsTxt();
  }
}

btnCopySettingsTxt?.addEventListener("click", () => {
  const txt = generateSettingsTxt();
  void navigator.clipboard.writeText(txt).then(() => {
    if (copySettingsFeedback) {
      copySettingsFeedback.textContent = "Isi berkas settings.txt berhasil disalin ke papan klip.";
      setTimeout(() => {
        copySettingsFeedback.textContent = "";
      }, 3000);
    }
  });
});

btnDownloadSettingsTxt?.addEventListener("click", () => {
  const txt = generateSettingsTxt();
  const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "settings.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

document.getElementById("btn-reset-all")?.addEventListener("click", () => {
  if (window.confirm("Apakah Anda yakin ingin mengatur ulang semua 50 pengaturan ke nilai default pabrik?")) {
    resetAllSettings();
    showHudToast("Semua pengaturan dikembalikan ke default pabrik");
  }
});

// Keyboard Navigation
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (isNotchExpanded) {
      setNotchExpanded(false);
    }
    if (hudToast && !hudToast.hidden) {
      hudToast.hidden = true;
    }
  }
});

// Initialization
function initApp() {
  initTheme();
  loadStoredSettings();
  populatePrayerCityDropdown();
  renderAllSettingPanels();
  renderTodoList();
  renderShelfList();
  renderClipList();
  updateWaterUI();
  loadTrack(0);
  setPomoMode("focus");
  applySettingsToUI();
  updateClock();

  setInterval(updateClock, 1000);
  setInterval(tickPlayer, 1000);
  setInterval(tickPomodoro, 1000);
}

document.addEventListener("DOMContentLoaded", initApp);

