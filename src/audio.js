/*
 * audio.js - Real-time procedural ambient Lo-Fi audio engine for Kala.
 * Generates warm, relaxing Rhodes-style electric piano chords and vinyl warmth
 * using the Web Audio API, so audio playback is genuinely audible and responsive.
 */

export class KalaAudioEngine {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.timer = null;
    this.masterGain = null;
    this.filter = null;
    this.chordStep = 0;
    this.tempo = 64;

    // Soothing Lo-Fi chord progressions
    this.progressions = [
      // Sore di Taman Kota: Fmaj7 -> Em7 -> Dm7 -> Cmaj7
      [
        [174.61, 220.00, 261.63, 329.63],
        [164.81, 196.00, 246.94, 293.66],
        [146.83, 174.61, 220.00, 261.63],
        [130.81, 164.81, 196.00, 246.94],
      ],
      // Evaluasi: Am9 -> Fmaj7 -> Cmaj7 -> G6
      [
        [220.00, 261.63, 329.63, 392.00, 493.88],
        [174.61, 220.00, 261.63, 329.63],
        [130.81, 164.81, 196.00, 246.94],
        [196.00, 246.94, 293.66, 329.63],
      ],
      // Monokrom: Bbmaj7 -> Am7 -> Gm7 -> Fmaj7
      [
        [233.08, 293.66, 349.23, 440.00],
        [220.00, 261.63, 329.63, 392.00],
        [196.00, 233.08, 293.66, 349.23],
        [174.61, 220.00, 261.63, 329.63],
      ],
    ];
    this.progressionIdx = 0;
  }

  ensureContext() {
    if (typeof window === 'undefined') return false;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.24, this.ctx.currentTime);

      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.setValueAtTime(920, this.ctx.currentTime);

      this.filter.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return true;
  }

  playChord(freqs, duration) {
    if (!this.ctx || !this.filter) return;
    const now = this.ctx.currentTime;

    freqs.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      const detune = (Math.random() - 0.5) * 5;
      osc.detune.setValueAtTime(detune, now);

      const peak = 0.15 / (i + 1);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(peak * 0.45, now + 0.55);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(this.filter);

      osc.start(now);
      osc.stop(now + duration + 0.1);
    });
  }

  start(trackIdx = 0) {
    if (this.isPlaying) return;
    if (!this.ensureContext()) return;
    this.isPlaying = true;
    this.progressionIdx = trackIdx % this.progressions.length;
    this.chordStep = 0;

    const barDuration = (60 / this.tempo) * 2;
    const scheduleNext = () => {
      if (!this.isPlaying) return;
      const chords = this.progressions[this.progressionIdx];
      const chord = chords[this.chordStep % chords.length];
      this.playChord(chord, barDuration * 0.95);
      this.chordStep++;

      this.timer = setTimeout(scheduleNext, barDuration * 1000);
    };

    scheduleNext();
  }

  stop() {
    this.isPlaying = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  setTrack(trackIdx) {
    this.progressionIdx = trackIdx % this.progressions.length;
    this.chordStep = 0;
  }
}

export const kalaAudio = new KalaAudioEngine();

