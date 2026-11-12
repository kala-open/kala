/*
 * mascot.js - Kala living notch companion component.
 *
 * Renders an expressive, fuzzy soot sprite mascot inside an SVG element.
 * Supports dynamic moods (idle, peek, sleep, happy, focus) and natural
 * micro-interactions: breathing, expressive eye glances (kiri, kanan, atas, bawah),
 * cursor tracking, and blinks.
 */

export class KalaMascot {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.options = Object.assign({
      size: 42,
      mood: 'idle',
      interactive: true,
      onMoodChange: null,
    }, options);

    this.id = Math.random().toString(36).substring(2, 8);
    this.mood = this.options.mood;
    this.blinkTimer = null;
    this.saccadeTimer = null;
    this.idleSleepTimer = null;
    this.lastInteraction = 0;
    this.lastMouseMove = 0;
    this.mouseMoveHandler = (e) => this.onMouseMove(e);

    this.init();
  }

  init() {
    if (!this.container) return;
    this.container.innerHTML = this.template();
    this.svg = this.container.querySelector('.kala-mascot-svg');
    this.bodyEl = this.container.querySelector('.kala-body-group');
    this.leftPupil = this.container.querySelector('.kala-pupil-left');
    this.rightPupil = this.container.querySelector('.kala-pupil-right');
    this.eyesNormal = this.container.querySelector('.kala-eyes-normal');
    this.eyesHappy = this.container.querySelector('.kala-eyes-happy');
    this.eyesSleep = this.container.querySelector('.kala-eyes-sleep');
    this.paws = this.container.querySelector('.kala-paws');

    if (this.options.interactive) {
      this.bindEvents();
    }

    this.setMood(this.mood);
    this.startBlinking();
    this.startSaccades();
  }

  template() {
    const s = this.options.size;
    const clipL = `kala-clip-l-${this.id}`;
    const clipR = `kala-clip-r-${this.id}`;
    return `
<svg class="kala-mascot-svg" viewBox="0 0 100 80" width="${s}" height="${s * 0.8}" aria-hidden="true" style="overflow: visible; cursor: pointer;">
  <defs>
    <!-- Soft purple-indigo ambient aura -->
    <radialGradient id="kala-glow-aura-${this.id}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#2D5BFF" stop-opacity="0.45"/>
      <stop offset="60%" stop-color="#7B4BFF" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#2D5BFF" stop-opacity="0"/>
    </radialGradient>

    <!-- Dark obsidian fur gradient -->
    <radialGradient id="kala-body-dark-${this.id}" cx="42%" cy="36%" r="58%">
      <stop offset="0%" stop-color="#242B3A"/>
      <stop offset="65%" stop-color="#10141E"/>
      <stop offset="100%" stop-color="#07090E"/>
    </radialGradient>

    <!-- Fuzzy fur edge displacement filter -->
    <filter id="kala-fuzzy-${this.id}" x="-30%" y="-30%" width="160%" height="160%">
      <feTurbulence type="fractalNoise" baseFrequency="0.22" numOctaves="3" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.2" xChannelSelector="R" yChannelSelector="G"/>
    </filter>

    <!-- Pupil containment clipping paths -->
    <clipPath id="${clipL}">
      <circle cx="40.5" cy="40" r="9.2"/>
    </clipPath>
    <clipPath id="${clipR}">
      <circle cx="59.5" cy="40" r="9.2"/>
    </clipPath>

    <!-- Sparkle star symbol -->
    <g id="kala-sparkle-star-${this.id}">
      <path d="M 0,-4 Q 0,0 4,0 Q 0,0 0,4 Q 0,0 -4,0 Q 0,0 0,-4 Z"/>
    </g>
  </defs>

  <g class="kala-root-group">
    <!-- Ambient glowing aura -->
    <ellipse class="kala-aura" cx="50" cy="42" rx="38" ry="32" fill="url(#kala-glow-aura-${this.id})"/>

    <!-- Sparkles -->
    <g class="kala-sparkles" opacity="0.85">
      <use href="#kala-sparkle-star-${this.id}" x="14" y="22" fill="#F4CAA8" transform="scale(0.85)" transform-origin="14 22">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="2.8s" repeatCount="indefinite"/>
      </use>
      <use href="#kala-sparkle-star-${this.id}" x="84" y="28" fill="#78BEFF" transform="scale(0.7)" transform-origin="84 28">
        <animate attributeName="opacity" values="0.8;0.2;0.8" dur="3.4s" repeatCount="indefinite"/>
      </use>
      <use href="#kala-sparkle-star-${this.id}" x="78" y="56" fill="#F4CAA8" transform="scale(0.55)" transform-origin="78 56">
        <animate attributeName="opacity" values="0.2;0.9;0.2" dur="2.1s" repeatCount="indefinite"/>
      </use>
    </g>

    <!-- Fuzzy body -->
    <g class="kala-body-group">
      <ellipse class="kala-body-ellipse" cx="50" cy="42" rx="27" ry="23"
        fill="url(#kala-body-dark-${this.id})" filter="url(#kala-fuzzy-${this.id})"/>
    </g>

    <!-- Big cute expressive eyes with wide pupil motion (kanan, kiri, atas, bawah) -->
    <g class="kala-eyes-normal" style="transform-origin: 50px 40px; transition: transform 120ms ease;">
      <!-- Left eye -->
      <g class="kala-eye-left">
        <circle cx="40.5" cy="40" r="9.2" fill="#FFFFFF"/>
        <g clip-path="url(#${clipL})">
          <g class="kala-pupil-left" style="transform-origin: 40.5px 40px; transition: transform 240ms cubic-bezier(0.2, 0.9, 0.3, 1);">
            <circle cx="40.5" cy="40" r="5.6" fill="#07090E"/>
            <!-- Primary catchlight (sparkle) -->
            <circle cx="38.7" cy="38.2" r="2.0" fill="#FFFFFF"/>
            <!-- Secondary catchlight -->
            <circle cx="42.5" cy="41.8" r="1.0" fill="#FFFFFF"/>
          </g>
        </g>
      </g>

      <!-- Right eye -->
      <g class="kala-eye-right">
        <circle cx="59.5" cy="40" r="9.2" fill="#FFFFFF"/>
        <g clip-path="url(#${clipR})">
          <g class="kala-pupil-right" style="transform-origin: 59.5px 40px; transition: transform 240ms cubic-bezier(0.2, 0.9, 0.3, 1);">
            <circle cx="59.5" cy="40" r="5.6" fill="#07090E"/>
            <!-- Primary catchlight (sparkle) -->
            <circle cx="57.7" cy="38.2" r="2.0" fill="#FFFFFF"/>
            <!-- Secondary catchlight -->
            <circle cx="61.5" cy="41.8" r="1.0" fill="#FFFFFF"/>
          </g>
        </g>
      </g>
    </g>

    <!-- Happy joyful curved eyes (^ ^) -->
    <g class="kala-eyes-happy" style="display: none;">
      <path d="M 34 42 Q 41.5 33 49 42" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M 51 42 Q 58.5 33 66 42" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" fill="none"/>
    </g>

    <!-- Sleeping closed eyes (⌒ ⌒) -->
    <g class="kala-eyes-sleep" style="display: none;">
      <path d="M 34 40 Q 41.5 46 49 40" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" fill="none"/>
      <path d="M 51 40 Q 58.5 46 66 40" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" fill="none"/>
      <text x="68" y="24" fill="#8C94A8" font-size="9" font-family="sans-serif" font-weight="700" opacity="0.7">z</text>
      <text x="74" y="16" fill="#8C94A8" font-size="11" font-family="sans-serif" font-weight="700" opacity="0.9">z</text>
    </g>

    <!-- Cute little peeking paws -->
    <g class="kala-paws" style="display: none;">
      <ellipse cx="37" cy="63" rx="5" ry="3.2" fill="#141824"/>
      <ellipse cx="63" cy="63" rx="5" ry="3.2" fill="#141824"/>
    </g>
  </g>
</svg>
    `;
  }

  bindEvents() {
    this.container.addEventListener('click', () => {
      this.lastInteraction = Date.now();
      this.reactClick();
    });

    this.container.addEventListener('mouseenter', () => {
      this.lastInteraction = Date.now();
      if (this.mood === 'sleep') {
        this.setMood('idle');
      } else if (this.mood === 'idle' || this.mood === 'pet') {
        this.lookAt(0, -0.6);
      }
    });

    this.container.addEventListener('mouseleave', () => {
      if (this.mood === 'idle' || this.mood === 'pet') {
        this.lookAt(0, 0);
      }
    });

    window.addEventListener('mousemove', this.mouseMoveHandler);
  }

  onMouseMove(e) {
    if (this.mood !== 'idle' && this.mood !== 'pet') return;
    this.lastMouseMove = Date.now();

    const rect = this.svg?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const diffX = e.clientX - centerX;
    const diffY = e.clientY - centerY;

    const normX = Math.max(-1, Math.min(1, diffX / 150));
    const normY = Math.max(-1, Math.min(1, diffY / 90));

    this.lookAt(normX, normY);
  }

  setMood(mood) {
    this.mood = mood;
    if (!this.eyesNormal || !this.eyesHappy || !this.eyesSleep) return;

    this.eyesNormal.style.display = 'none';
    this.eyesHappy.style.display = 'none';
    this.eyesSleep.style.display = 'none';
    if (this.paws) this.paws.style.display = 'none';

    switch (mood) {
      case 'happy':
        this.eyesHappy.style.display = '';
        this.animateBounce();
        break;
      case 'sleep':
        this.eyesSleep.style.display = '';
        this.lookAt(0, 0);
        break;
      case 'peek':
        this.eyesNormal.style.display = '';
        if (this.paws) this.paws.style.display = '';
        this.lookAt(0, -0.9);
        break;
      case 'focus':
        this.eyesNormal.style.display = '';
        this.lookAt(0, 0.4);
        break;
      case 'idle':
      default:
        this.eyesNormal.style.display = '';
        this.lookAt(0, 0);
        break;
    }

    if (typeof this.options.onMoodChange === 'function') {
      this.options.onMoodChange(mood);
    }
  }

  lookAt(dx, dy) {
    if (!this.leftPupil || !this.rightPupil) return;
    const maxShiftX = 4.8;
    const maxShiftY = 4.0;
    const tx = Math.max(-maxShiftX, Math.min(maxShiftX, dx * maxShiftX));
    const ty = Math.max(-maxShiftY, Math.min(maxShiftY, dy * maxShiftY));
    const transformStr = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px)`;
    const svgAttr = `translate(${tx.toFixed(2)}, ${ty.toFixed(2)})`;

    this.leftPupil.style.transform = transformStr;
    this.rightPupil.style.transform = transformStr;
    this.leftPupil.setAttribute('transform', svgAttr);
    this.rightPupil.setAttribute('transform', svgAttr);
  }

  lookDirection(direction) {
    switch (direction) {
      case 'left':
        this.lookAt(-1.0, 0.0);
        break;
      case 'right':
        this.lookAt(1.0, 0.0);
        break;
      case 'up':
        this.lookAt(0.0, -1.0);
        break;
      case 'down':
        this.lookAt(0.0, 1.0);
        break;
      case 'up-left':
        this.lookAt(-0.8, -0.7);
        break;
      case 'up-right':
        this.lookAt(0.8, -0.7);
        break;
      case 'down-left':
        this.lookAt(-0.7, 0.7);
        break;
      case 'down-right':
        this.lookAt(0.7, 0.7);
        break;
      case 'center':
      default:
        this.lookAt(0.0, 0.0);
        break;
    }
  }

  blink() {
    if (this.mood === 'sleep' || this.mood === 'happy') return;
    if (!this.eyesNormal) return;

    this.eyesNormal.style.transform = 'scaleY(0.06)';
    setTimeout(() => {
      this.eyesNormal.style.transform = 'scaleY(1)';

      // Occasional playful double-blink (35% probability)
      if (Math.random() < 0.35) {
        setTimeout(() => {
          this.eyesNormal.style.transform = 'scaleY(0.06)';
          setTimeout(() => {
            this.eyesNormal.style.transform = 'scaleY(1)';
          }, 85);
        }, 130);
      }
    }, 110);
  }

  startBlinking() {
    const scheduleNext = () => {
      const delay = 2000 + Math.random() * 3200;
      this.blinkTimer = setTimeout(() => {
        this.blink();
        scheduleNext();
      }, delay);
    };
    scheduleNext();
  }

  startSaccades() {
    if (this.saccadeTimer) clearTimeout(this.saccadeTimer);

    // Active, expressive gaze sequences: kanan, kiri, atas, bawah, memutar & melirik
    const sequences = [
      // 0. Showcase: Kiri -> Kanan -> Atas -> Bawah -> Tengah (kedip)
      [
        { dir: [-1.0, 0.0], hold: 1400 }, // Kiri penuh
        { dir: [1.0, 0.0],  hold: 1400 }, // Kanan penuh
        { dir: [0.0, -1.0], hold: 1400 }, // Atas penuh
        { dir: [0.0, 1.0],  hold: 1400 }, // Bawah penuh
        { dir: [0.0, 0.0],  hold: 1000, blink: true }, // Tengah
      ],
      // 1. Lirik Kiri lalu Kanan lalu Tengah
      [
        { dir: [-1.0, 0.0], hold: 1200 },
        { dir: [1.0, 0.0],  hold: 1200 },
        { dir: [0.0, 0.0],  hold: 900, blink: true },
      ],
      // 2. Pandang Atas (penasaran) lalu Bawah lalu Tengah
      [
        { dir: [0.0, -1.0], hold: 1300 },
        { dir: [0.0, 1.0],  hold: 1100 },
        { dir: [0.0, 0.0],  hold: 800, blink: true },
      ],
      // 3. Lirik Kanan lalu Atas-Kanan lalu Lurus
      [
        { dir: [1.0, 0.0],  hold: 1100 },
        { dir: [0.75, -0.8],hold: 1000 },
        { dir: [0.0, 0.0],  hold: 900, blink: true },
      ],
      // 4. Lirik Kiri lalu Bawah-Kiri lalu Tengah
      [
        { dir: [-1.0, 0.0], hold: 1100 },
        { dir: [-0.7, 0.7], hold: 1000 },
        { dir: [0.0, 0.0],  hold: 900, blink: true },
      ],
      // 5. Putar tatapan (Kiri -> Atas -> Kanan -> Bawah -> Tengah)
      [
        { dir: [-0.9, 0.0], hold: 700 },
        { dir: [0.0, -1.0], hold: 700 },
        { dir: [0.9, 0.0],  hold: 700 },
        { dir: [0.0, 0.9],  hold: 700 },
        { dir: [0.0, 0.0],  hold: 1000, blink: true },
      ],
      // 6. Tatap Bawah (melihat desktop/aktivitas) lalu Tengah
      [
        { dir: [0.0, 1.0],  hold: 1400 },
        { dir: [0.0, 0.0],  hold: 1000, blink: true },
      ],
      // 7. Tatap Atas (melihat ke langit/bezel) lalu Tengah
      [
        { dir: [0.0, -1.0], hold: 1400 },
        { dir: [0.0, 0.0],  hold: 1000, blink: true },
      ],
    ];

    let currentSeq = sequences[0];
    let seqIndex = 0;

    const runNext = () => {
      const now = Date.now();
      const isRecentlyInteracting = (now - this.lastMouseMove < 2000) || (now - this.lastInteraction < 2200);

      if ((this.mood === 'idle' || this.mood === 'pet') && !isRecentlyInteracting) {
        if (!currentSeq || seqIndex >= currentSeq.length) {
          const r = Math.floor(Math.random() * sequences.length);
          currentSeq = sequences[r];
          seqIndex = 0;
        }

        const step = currentSeq[seqIndex];
        if (step) {
          this.lookAt(step.dir[0], step.dir[1]);
          if (step.blink) {
            setTimeout(() => this.blink(), 120);
          }
          seqIndex++;
          this.saccadeTimer = setTimeout(runNext, step.hold || 1100);
          return;
        }
      }

      this.saccadeTimer = setTimeout(runNext, 1200);
    };

    runNext();
  }

  animateBounce() {
    if (!this.bodyEl) return;
    this.bodyEl.animate([
      { transform: 'translateY(0px)' },
      { transform: 'translateY(-3.5px) scaleY(1.06)' },
      { transform: 'translateY(1px) scaleY(0.96)' },
      { transform: 'translateY(0px)' },
    ], {
      duration: 380,
      easing: 'cubic-bezier(0.34, 1.32, 0.5, 1)',
    });
  }

  reactClick() {
    this.setMood('happy');
    this.animateBounce();
    setTimeout(() => {
      if (this.mood === 'happy') {
        this.setMood('idle');
      }
    }, 1600);
  }

  destroy() {
    if (this.blinkTimer) clearTimeout(this.blinkTimer);
    if (this.saccadeTimer) clearTimeout(this.saccadeTimer);
    if (this.idleSleepTimer) clearTimeout(this.idleSleepTimer);
    window.removeEventListener('mousemove', this.mouseMoveHandler);
  }
}

export function mountMascot(container, options) {
  return new KalaMascot(container, options);
}

