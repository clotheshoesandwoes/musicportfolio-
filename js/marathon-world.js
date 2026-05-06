/* =========================================================
   MARATHON-WORLD — b104  (filename kept for minimal churn;
   concept fully replaced — this is no longer "Marathon-style.")
   "TEXT GALAXY" — kinetic glitch-typography world.
   Track titles float as massive 3D type. Custom glitch shader
   per title (block displacement, RGB split, scanlines, dropouts).
   Bass amplifies global glitch. Post stack on top.
   Mounted at / (the home route).
   ========================================================= */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const POST_VERTEX = `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;

const POST_FRAGMENT = `
  uniform sampler2D tDiffuse;
  uniform sampler2D uLensDirt;
  uniform float uTime;
  uniform vec2  uResolution;
  uniform float uBass;
  // Toggle uniforms (1.0 on / 0.0 off)
  uniform float uFlaresOn;
  uniform float uDirtOn;
  uniform float uGodraysOn;
  // Multi-state cycle uniforms (0 = off, 1..N = preset index)
  uniform float uHaloStyle;     // halation: 0 off, 1 Vision3, 2 Portra, 3 CineStill, 4 Eterna
  uniform float uGradeStyle;    // color grade: 0 off, 1 bleach, 2 teal-orange, 3 cyber, 4 cold, 5 warm
  uniform float uDofOn;         // soft DoF: 0/1
  // God-ray light source (NDC)
  uniform vec2  uGodRaySource;
  // DoF focus target (UV space, 0..1) and falloff radius
  uniform vec2  uFocusUv;
  uniform float uFocusRadius;
  varying vec2 vUv;

  float rand(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  // Brightness threshold extract — return only the highlight component.
  vec3 extractHighlight(vec3 c, float thresh){
    float l = max(max(c.r, c.g), c.b);
    float k = max(0.0, l - thresh);
    return c * (k / max(l, 0.001));
  }

  void main(){
    vec2 uv = vUv;
    vec2 dir = uv - 0.5;
    float ca = 0.0018 + uBass * 0.0070;
    float r = texture2D(tDiffuse, uv - dir * ca).r;
    float g = texture2D(tDiffuse, uv).g;
    float b = texture2D(tDiffuse, uv + dir * ca).b;
    vec3 col = vec3(r, g, b);

    // ---- ANAMORPHIC LENS FLARES ----
    // Subtle cyan-shifted horizontal streak from genuine highlights only.
    // Threshold raised + tint flattened + strength halved vs b136.
    if (uFlaresOn > 0.5) {
      vec3 streak = vec3(0.0);
      float total = 0.0;
      float baseStep = 9.0 / uResolution.x;
      for (int i = -6; i <= 6; i++) {
        if (i == 0) continue;
        float fi = float(i);
        float w = exp(-fi * fi * 0.09);
        vec3 s = texture2D(tDiffuse, uv + vec2(fi * baseStep, 0.0)).rgb;
        streak += extractHighlight(s, 0.82) * w;
        total += w;
      }
      streak /= max(total, 0.001);
      streak *= vec3(0.75, 0.95, 1.10);
      col += streak * (0.28 + uBass * 0.18);
    }

    // ---- GOD RAYS (radial blur from a bright source point) ----
    if (uGodraysOn > 0.5) {
      vec2 srcUv = uGodRaySource * 0.5 + 0.5;     // NDC → UV
      vec2 toSrc = srcUv - uv;
      vec3 rays = vec3(0.0);
      float decay = 0.94;
      float strength = 0.18;
      float w = 1.0;
      const int RAY_TAPS = 14;
      for (int j = 0; j < RAY_TAPS; j++) {
        float fj = float(j);
        vec2 sUv = uv + toSrc * (fj / float(RAY_TAPS)) * 0.55;
        vec3 s = texture2D(tDiffuse, sUv).rgb;
        rays += extractHighlight(s, 0.55) * w;
        w *= decay;
      }
      rays /= float(RAY_TAPS);
      // Warm tint on rays
      rays *= vec3(1.10, 0.95, 0.78);
      col += rays * strength;
    }

    // ---- LENS DIRT (multiplied onto current frame's bright areas) ----
    if (uDirtOn > 0.5) {
      vec3 dirt = texture2D(uLensDirt, uv).rgb;
      // Dirt only modulates highlights — extract & boost.
      vec3 high = extractHighlight(col, 0.50);
      col += high * dirt * 0.55;
    }

    // ---- HALATION (film-stock red-orange bleed around bright highlights) ----
    // 12-tap, 3-ring radial sample of the highlight component, tinted per
    // stock. Bigger radius + lower threshold + higher strength than b171 so
    // the bleed actually reads against the bloom underneath.
    if (uHaloStyle > 0.5) {
      vec3 halo = vec3(0.0);
      float baseR = 28.0 / uResolution.x;
      float total = 0.0;
      for (int i = 0; i < 12; i++) {
        float ang = float(i) * 0.5235988;  // 12 directions, 30° each
        vec2 dir = vec2(cos(ang), sin(ang)) * baseR;
        vec3 s1 = texture2D(tDiffuse, uv + dir * 1.0).rgb;
        vec3 s2 = texture2D(tDiffuse, uv + dir * 2.2).rgb;
        vec3 s3 = texture2D(tDiffuse, uv + dir * 3.6).rgb;
        halo += extractHighlight(s1, 0.45) * 0.60;
        halo += extractHighlight(s2, 0.50) * 0.30;
        halo += extractHighlight(s3, 0.55) * 0.18;
        total += 1.08;
      }
      halo /= total;
      vec3 tint = vec3(1.0);
      float strength = 0.60;
      if (uHaloStyle < 1.5) {
        // Vision3 250D — warm orange, soft
        tint = vec3(1.40, 0.60, 0.22); strength = 0.70;
      } else if (uHaloStyle < 2.5) {
        // Portra 400 — pinker, finer
        tint = vec3(1.30, 0.60, 0.85); strength = 0.62;
      } else if (uHaloStyle < 3.5) {
        // CineStill 800T — aggressive red bleed (the iconic look)
        tint = vec3(1.80, 0.32, 0.22); strength = 1.10;
      } else {
        // Fuji Eterna — green-shifted vintage
        tint = vec3(0.55, 1.20, 0.68); strength = 0.62;
      }
      col += halo * tint * strength;
    }

    // ---- DEPTH OF FIELD (soft) ----
    // 9-tap radial blur weighted by distance from focus UV. Cheap fake-DoF —
    // good enough for "the focused title sharpens, the rest soften."
    if (uDofOn > 0.5) {
      float distFromFocus = length((uv - uFocusUv) * vec2(uResolution.x / uResolution.y, 1.0));
      float blurAmt = smoothstep(uFocusRadius, uFocusRadius + 0.22, distFromFocus);
      if (blurAmt > 0.01) {
        vec3 blurred = vec3(0.0);
        float total = 0.0;
        float radius = blurAmt * 7.0 / uResolution.x;
        for (int i = 0; i < 9; i++) {
          float ang = float(i) * 0.6981317 + uTime * 0.1;
          float jitter = 0.55 + 0.45 * fract(sin(float(i) * 12.9898) * 43758.5453);
          vec2 off = vec2(cos(ang), sin(ang)) * radius * jitter;
          blurred += texture2D(tDiffuse, uv + off).rgb;
          total += 1.0;
        }
        blurred /= total;
        col = mix(col, blurred, blurAmt);
      }
    }

    // ---- COLOR GRADE (lift / gamma / gain per preset) ----
    if (uGradeStyle > 0.5) {
      vec3 lift, gamma, gain;
      if (uGradeStyle < 1.5) {
        // Bleach bypass — desaturate, crush blacks, lift mids
        lift = vec3(-0.04, -0.02, 0.00);
        gamma = vec3(0.92, 0.94, 0.92);
        gain = vec3(1.06, 1.02, 0.94);
        float lum = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(lum), col, 0.55);
      } else if (uGradeStyle < 2.5) {
        // Teal & orange — shadows blue-cyan, highlights warm
        lift = vec3(-0.02, 0.01, 0.05);
        gamma = vec3(1.04, 1.00, 0.96);
        gain = vec3(1.10, 1.00, 0.90);
      } else if (uGradeStyle < 3.5) {
        // Cyberpunk neon — magenta shadows, cyan highlights
        lift = vec3(0.04, 0.00, 0.05);
        gamma = vec3(0.96, 0.97, 0.94);
        gain = vec3(1.08, 0.95, 1.10);
      } else if (uGradeStyle < 4.5) {
        // Cold film — blue shadows, soft green mids
        lift = vec3(-0.03, 0.00, 0.04);
        gamma = vec3(0.96, 1.02, 0.97);
        gain = vec3(0.94, 1.02, 1.10);
      } else {
        // Warm halation — orange highlights, magenta shadows
        lift = vec3(0.04, 0.00, 0.02);
        gamma = vec3(1.00, 0.96, 0.92);
        gain = vec3(1.12, 1.00, 0.94);
      }
      col = pow(max(col + lift, vec3(0.001)), 1.0 / gamma) * gain;
    }

    // Scanline + grain + vignette (pre-existing)
    col *= 0.94 + 0.06 * sin(uv.y * uResolution.y * 1.4);
    col += (rand(uv + fract(uTime * 0.7)) - 0.5) * 0.045;
    float vig = smoothstep(1.20, 0.45, length(dir) * 1.40);
    col *= vig;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const TITLE_VERTEX = `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Per-title glitch shader: block displacement, RGB split, scanlines, dropouts.
// Color flow: base RGB tint is hue-shifted per-frame by uHueShift (global tick
// driven by the animate loop) so each title's color drifts smoothly through
// the spectrum while preserving its relative hue identity.
const TITLE_FRAGMENT = `
  uniform sampler2D uTex;
  uniform float uTime;
  uniform float uHover;
  uniform float uFocus;
  uniform float uBass;
  uniform float uOpacity;
  uniform vec3  uTint;
  uniform float uHueShift;
  varying vec2 vUv;
  float rand(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  // Rodrigues hue rotation around the (1,1,1) luminance axis.
  vec3 hueShift(vec3 c, float h){
    vec3 k = vec3(0.57735);
    float ang = h * 6.28318530718;
    float ca = cos(ang);
    return c * ca + cross(k, c) * sin(ang) + k * dot(k, c) * (1.0 - ca);
  }
  void main(){
    vec2 uv = vUv;
    float gAmt = 0.30 + uHover * 1.10 + uBass * 0.55 + uFocus * 0.35;
    float strips = 28.0;
    float blockY = floor(uv.y * strips) / strips;
    float blockSeed = rand(vec2(blockY * 7.31, floor(uTime * 14.0)));
    float dispActive = step(1.0 - 0.18 * gAmt, blockSeed);
    float disp = (rand(vec2(blockY, floor(uTime * 12.0))) - 0.5) * 0.06 * gAmt;
    uv.x += disp * dispActive;
    float ca = 0.0018 + 0.012 * gAmt;
    float r = texture2D(uTex, uv + vec2(ca, 0.0)).r;
    float gC = texture2D(uTex, uv).g;
    float b = texture2D(uTex, uv - vec2(ca, 0.0)).b;
    float a = texture2D(uTex, uv).a;
    vec3 col = vec3(r, gC, b);
    float sl = 0.94 + 0.06 * sin(uv.y * 380.0);
    col *= sl;
    float dropY = floor(uv.y * 110.0) / 110.0;
    float dropoutSeed = rand(vec2(dropY * 13.0, floor(uTime * 24.0)));
    if (dropoutSeed > 1.0 - 0.05 * gAmt) a *= 0.0;
    vec3 tint = clamp(hueShift(uTint, uHueShift), 0.0, 1.5);
    col *= tint;
    a *= uOpacity;
    gl_FragColor = vec4(col, a);
  }
`;

// HSL→RGB for vivid per-track hues
function hslToRgb(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

// Tag → HSL family. Genre-coded color identity.
const TAG_HUE = {
  hard:       [0.00, 0.80, 0.66],   // red-orange
  aggressive: [0.02, 0.85, 0.62],
  rap:        [0.05, 0.88, 0.64],
  trap:       [0.06, 0.85, 0.62],
  drill:      [0.97, 0.78, 0.60],
  rage:       [0.99, 0.85, 0.60],
  grunge:     [0.10, 0.65, 0.62],   // amber
  alt:        [0.11, 0.62, 0.66],
  rock:       [0.08, 0.70, 0.60],
  emo:        [0.92, 0.65, 0.66],   // dusky pink
  sad:        [0.62, 0.45, 0.66],   // muted blue
  chill:      [0.55, 0.72, 0.68],   // cyan
  vibe:       [0.83, 0.68, 0.70],   // magenta
  pop:        [0.88, 0.78, 0.72],
  dance:      [0.78, 0.75, 0.68],
  electronic: [0.50, 0.70, 0.65],
  ambient:    [0.45, 0.50, 0.66],
  funk:       [0.13, 0.75, 0.66],
  soul:       [0.07, 0.55, 0.65],
  groove:     [0.15, 0.65, 0.66],
  hyperpop:   [0.85, 0.85, 0.72],
};

function colorForTrack(track, idx){
  if (track && Array.isArray(track.tags)) {
    for (const raw of track.tags) {
      const k = String(raw).toLowerCase();
      const h = TAG_HUE[k];
      if (h) return hslToRgb(h[0], h[1], h[2]);
    }
  }
  // Hash fallback by index → vivid hue
  const hash = ((idx * 9301 + 49297) % 233280) / 233280;
  return hslToRgb(hash, 0.72, 0.68);
}

const MarathonWorld = {
  ctx: null, container: null,
  scene: null, camera: null, renderer: null, composer: null, postPass: null, bloom: null,
  clock: null, raf: 0,
  titles: [],
  haze: null,
  hovered: null, focused: null,
  audioCtx: null, analyser: null, freqArr: null,
  ray: null, mouse: null, cam: null,
  hudEl: null, destroyed: false,
  cameraT: 0,
  // navigation state — camera locked at origin, drag-look only
  gaze: null, drag: null,

  init(container, ctx){
    if (this.renderer) return;
    this.ctx = ctx;
    this.container = container;
    this.destroyed = false;
    this.titles = [];
    this.hovered = null;
    this.focused = null;
    this.cameraT = 0;
    this.mouse = { x: 0.5, y: 0.5, ndc: new THREE.Vector2(0, 0) };
    // Camera locked at origin. Only orientation changes (drag-look).
    this.cam = {
      pos: new THREE.Vector3(0, 0, 0),
      lookAt: new THREE.Vector3(0, 0, -40),
    };
    this.gaze = { yaw: 0, pitch: 0 };
    this.drag = { active: false, x0: 0, y0: 0, lx: 0, ly: 0, totalPx: 0 };
    // b171 — drag-look inertia. Velocity (rad/s) accumulates while dragging
    // and decays after release. Toggled via admin "drag inertia".
    this._inertiaOn = true;
    this._dragVel = { yaw: 0, pitch: 0 };
    // b172 — auto-cycle timers for halation + color grade. When the
    // corresponding flag is on, the animate loop advances the uniform once
    // per N seconds.
    this._autoHalo = false;
    this._autoGrade = false;
    this._autoHaloT = 0;
    this._autoGradeT = 0;

    const canvas = document.createElement('canvas');
    canvas.className = 'mw-canvas';
    container.appendChild(canvas);

    this.hudEl = this._buildHud();
    container.appendChild(this.hudEl);

    this.adminEl = this._buildAdminPanel();
    container.appendChild(this.adminEl);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.setClearColor(0x040406, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    // Mild fog to give depth without obscuring far titles
    this.scene.fog = new THREE.FogExp2(0x040406, 0.0035);

    this.camera = new THREE.PerspectiveCamera(80, 1, 0.1, 800);
    this.camera.position.copy(this.cam.pos);

    this._buildNebula();
    this._buildCore();
    this._buildHaze();
    this._buildFogPatches();
    this._buildTitles();
    this._buildFragments();
    this._buildStreaks();
    this._buildSatellites();
    this._buildShards();
    this._buildFlyby();
    this._buildBolts();
    this._buildMarathonShip();
    this._buildNavBuoys();

    this.clock = new THREE.Clock();
    this.ray = new THREE.Raycaster();

    this._onResize = this._onResize.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onKey = this._onKey.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    window.addEventListener('resize', this._onResize);
    canvas.addEventListener('pointermove', this._onMove);
    canvas.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointerup', this._onPointerUp);
    // Block iOS pull-to-refresh / scroll behind the canvas (no zoom — camera is locked)
    canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });
    window.addEventListener('keydown', this._onKey);

    this._setupComposer();
    this._onResize();
    this._hookAudio();

    this.animate = this.animate.bind(this);
    this.animate();
  },

  /* --------- HUD (deliberately stripped — no Marathon ripoff) ---------- */
  _buildHud(){
    const root = document.createElement('div');
    root.className = 'mw-hud';
    const buildN = this.ctx.buildNumber || '';
    const trackN = this.ctx.tracks ? this.ctx.tracks.length : 0;
    const socials = this.ctx.socials || {};
    const socialLinks = [];
    if (socials.soundcloud && !/YOUR_SOUNDCLOUD/i.test(socials.soundcloud)) {
      socialLinks.push(`<a href="${socials.soundcloud}" target="_blank" rel="noopener">soundcloud</a>`);
    }
    if (socials.instagram && !/YOUR_INSTAGRAM/i.test(socials.instagram)) {
      socialLinks.push(`<a href="${socials.instagram}" target="_blank" rel="noopener">instagram</a>`);
    }
    if (socials.youtube)  socialLinks.push(`<a href="${socials.youtube}"  target="_blank" rel="noopener">youtube</a>`);
    if (socials.spotify)  socialLinks.push(`<a href="${socials.spotify}"  target="_blank" rel="noopener">spotify</a>`);
    if (socials.email)    socialLinks.push(`<a href="mailto:${socials.email}">email</a>`);
    const socialsHtml = socialLinks.length
      ? `<div class="tg-socials">${socialLinks.join('')}</div>`
      : '';
    root.innerHTML = `
      <div class="tg-tl">
        <div class="tg-brand">kani</div>
        <div class="tg-meta"><span id="tg-tc">00:00</span> · ${trackN} tracks · ${buildN}</div>
        <div class="tg-player" id="tg-player">
          <div class="tg-player-controls">
            <button class="tg-pp-btn" data-act="prev" aria-label="Previous">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 20L9 12l10-8v16z"/><path d="M5 4v16"/></svg>
            </button>
            <button class="tg-pp-btn tg-pp-main" id="tg-pp" data-act="playpause" aria-label="Play/Pause">
              <svg id="tg-pp-play" width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>
              <svg id="tg-pp-pause" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="display:none"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>
            </button>
            <button class="tg-pp-btn" data-act="next" aria-label="Next">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 4l10 8-10 8V4z"/><path d="M19 4v16"/></svg>
            </button>
          </div>
          <div class="tg-player-row">
            <div class="tg-player-title" id="tg-player-title">— select a title —</div>
            <div class="tg-player-time" id="tg-player-time">0:00 / 0:00</div>
          </div>
          <div class="tg-player-progress" id="tg-player-progress"><div class="tg-player-fill" id="tg-player-fill"></div></div>
        </div>
        <div class="tg-nav">
          <a href="/tracks">catalog</a>
          <a href="/scenes">scenes</a>
          <button type="button" class="tg-admin-link" data-act="admin">[ admin ]</button>
        </div>
      </div>
      <div class="tg-tr">
        <div class="tg-mark">cantmute.me</div>
        ${socialsHtml}
      </div>
      <div class="tg-bl">
        <div class="tg-hint" id="tg-hint">drag to look around &nbsp;·&nbsp; click a title</div>
      </div>
      <div class="tg-br">
        <div class="tg-hover" id="tg-hover"></div>
      </div>
      <div class="tg-focus" id="tg-focus" style="display:none">
        <div class="tg-focus-inner">
          <div class="tg-focus-kicker" id="tg-focus-kicker">— now playing —</div>
          <h1 class="tg-focus-title" id="tg-focus-title"></h1>
          <div class="tg-focus-meta" id="tg-focus-meta"></div>
          <div class="tg-focus-actions">
            <button class="tg-act" data-act="play">play</button>
            <button class="tg-act tg-act-dim" data-act="release">close</button>
          </div>
        </div>
      </div>`;
    root.querySelectorAll('.tg-act').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        const act = b.dataset.act;
        if (act === 'play' && this.focused) this.ctx.onPlay?.(this.focused.index);
        else if (act === 'release') this._release();
      });
    });
    // Player controls — wired to the global audio via ctx callbacks. Prev/next
    // also update the visual focus to match the new current track so the flying
    // title in front of the camera follows the audio.
    root.querySelectorAll('.tg-pp-btn').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        const act = b.dataset.act;
        if (act === 'prev') {
          this.ctx.onPrev?.();
          this._syncFocusToCurrent();
        } else if (act === 'next') {
          this.ctx.onNext?.();
          this._syncFocusToCurrent();
        } else if (act === 'playpause') {
          this.ctx.onTogglePlay?.();
        }
      });
    });
    const prog = root.querySelector('#tg-player-progress');
    if (prog) {
      prog.addEventListener('click', e => {
        e.stopPropagation();
        const r = prog.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        this.ctx.onSeek?.(pct);
      });
    }
    const adminLink = root.querySelector('.tg-admin-link');
    if (adminLink) {
      adminLink.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[admin] toggle click', { adminEl: !!this.adminEl });
        this._toggleAdmin();
      });
    }
    return root;
  },

  _updatePlayer(){
    const a = this.ctx.audio;
    if (!a) return;
    const titleEl = document.getElementById('tg-player-title');
    const timeEl  = document.getElementById('tg-player-time');
    const fillEl  = document.getElementById('tg-player-fill');
    const playIc  = document.getElementById('tg-pp-play');
    const pauseIc = document.getElementById('tg-pp-pause');
    const cur = this.ctx.getCurrent ? this.ctx.getCurrent() : -1;
    const tracks = this.ctx.tracks || [];
    if (titleEl) {
      titleEl.textContent = (cur >= 0 && tracks[cur]) ? tracks[cur].title.toLowerCase() : '— select a title —';
    }
    const dur = a.duration || 0;
    const ct  = a.currentTime || 0;
    if (timeEl) {
      const fmt = (s) => {
        if (!isFinite(s)) return '0:00';
        const m = Math.floor(s / 60), ss = Math.floor(s % 60);
        return `${m}:${ss < 10 ? '0' : ''}${ss}`;
      };
      timeEl.textContent = `${fmt(ct)} / ${fmt(dur)}`;
    }
    if (fillEl) fillEl.style.width = (dur > 0 ? (ct / dur) * 100 : 0) + '%';
    if (playIc && pauseIc) {
      const playing = !a.paused && cur >= 0;
      playIc.style.display  = playing ? 'none'  : '';
      pauseIc.style.display = playing ? '' : 'none';
    }
  },

  /* ---------- Drifting fog patches (atmospheric volume) ---------- */
  _buildFogPatches(){
    // 18 large soft sprites at varying depths — gives the void a sense of
    // moving air without going full smoke-effect.
    const N = 18;
    const tex = this._makeFogPatchTexture();
    this.fogPatches = [];
    for (let i = 0; i < N; i++) {
      const seed = i;
      const r = 70 + Math.random() * 240;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI * 0.6;
      const tints = [
        new THREE.Color(0x1a2030),   // cool blue
        new THREE.Color(0x2a1525),   // grimy magenta
        new THREE.Color(0x251a14),   // rust amber
        new THREE.Color(0x141a18),   // green-gray
      ];
      const tint = tints[i % tints.length];
      const mat = new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.18 + Math.random() * 0.12,
        color: tint,
      });
      const sp = new THREE.Sprite(mat);
      const scale = 60 + Math.random() * 80;
      sp.scale.set(scale, scale * 0.6, 1);
      sp.position.set(
        r * Math.cos(phi) * Math.cos(theta),
        r * Math.sin(phi) * 0.4,
        r * Math.cos(phi) * Math.sin(theta)
      );
      sp.userData = { seed, baseY: sp.position.y };
      this.scene.add(sp);
      this.fogPatches.push(sp);
    }
  },

  _makeFogPatchTexture(){
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    // Soft radial cloud
    const grd = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0.0, 'rgba(255,255,255,0.85)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.30)');
    grd.addColorStop(1.0, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 256, 256);
    // Add some noise texture into the cloud
    const data = ctx.getImageData(0, 0, 256, 256);
    for (let i = 0; i < data.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 60;
      data.data[i+3] = Math.max(0, Math.min(255, data.data[i+3] + n));
    }
    ctx.putImageData(data, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  },

  /* ---------- Floating broken-text fragments (ambient backdrop) ---------- */
  _buildFragments(){
    // Random short character slices floating at distance — never raycast,
    // always lower opacity than real titles. Gives the void a "shedding text"
    // texture beat that's on-brand with the Text Galaxy concept.
    const all = this.ctx.tracks || [];
    if (!all.length) return;
    const charset = '0123456789!@#$%/:_-=*?<>[]{}|';
    const N = 70;
    this.fragments = [];
    for (let i = 0; i < N; i++) {
      const r = 200 + Math.random() * 280;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI * 0.65;
      // Pick a tiny scrap: 2-6 chars, mix track-title fragment + symbols
      const t = all[Math.floor(Math.random() * all.length)];
      const src = (t?.title || 'kani') + charset;
      const len = 2 + Math.floor(Math.random() * 4);
      const start = Math.floor(Math.random() * Math.max(1, src.length - len));
      const text = src.substring(start, start + len).toUpperCase();
      const tex = this._makeTitleTexture(text, 96);
      const aspect = tex.image.width / tex.image.height;
      const w = 4 + Math.random() * 6;
      const h = w / aspect;
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTex:     { value: tex },
          uTime:    { value: Math.random() * 100 },
          uHover:   { value: 0 },
          uFocus:   { value: 0 },
          uBass:    { value: 0 },
          uOpacity: { value: 0.18 + Math.random() * 0.18 },
          uTint:    { value: new THREE.Vector3(0.55, 0.62, 0.72) },
        },
        vertexShader: TITLE_VERTEX,
        fragmentShader: TITLE_FRAGMENT,
        transparent: true,
        depthWrite: false,
      });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      plane.position.set(
        r * Math.cos(phi) * Math.cos(theta),
        r * Math.sin(phi) * 0.5,
        r * Math.cos(phi) * Math.sin(theta)
      );
      plane.onBeforeRender = (renderer, scene, camera) => {
        plane.quaternion.copy(camera.quaternion);
      };
      this.scene.add(plane);
      this.fragments.push({
        mesh: plane,
        mat,
        baseOp: 0.18 + Math.random() * 0.18,
        // State machine — staggered initial state so they don't all blink in sync
        phase: Math.random() < 0.5 ? 'on' : 'off',
        nextChange: Math.random() * 8,
      });
    }
  },

  // Cryptic content pool for fragment text swaps.
  _genFragmentText(){
    const all = this.ctx.tracks || [];
    const charset = '0123456789!@#$%/:_-=*?<>[]{}|';
    const codes = [
      'ERR_404','SIGNAL LOST','ACK','STDOUT','NULL','EOF','RESET',
      'UPLINK','SYNC','OPEN','LOCK','ECHO','STREAM','ZONE','LISTEN',
      '// ack','>> rx','[ROUTE]','/dev/null','/sys','/proc','/run',
      '0xDEAD','0xBEEF','0xCAFE','0xFEED','0xC0DE','0xFACE','0x7FFF',
      'T+0042','T-0009','CHN_03','CHN_07','CH7','CH3','BAUD_960',
      '|||','///','-->','<--',':::','◊','×','※','⌐','↗','⟶','⟵',
      'NO CARRIER','RING','BUSY','DIAL','HOLD','RX','TX','LO','HI',
      'kani.exe','rolla.bin','seg_07','frame.04','/9000','/4096',
    ];
    const r = Math.random();
    if (r < 0.32) {
      return codes[Math.floor(Math.random() * codes.length)];
    } else if (r < 0.55) {
      const hex = '0123456789ABCDEF';
      let h = '0x';
      const len = 4 + Math.floor(Math.random() * 3);
      for (let k = 0; k < len; k++) h += hex[Math.floor(Math.random() * 16)];
      return h;
    } else if (r < 0.75) {
      return String(Math.floor(Math.random() * 9999)).padStart(4, '0');
    } else {
      const t = all[Math.floor(Math.random() * all.length)];
      const src = ((t && t.title) || 'kani') + charset;
      const len = 2 + Math.floor(Math.random() * 4);
      const start = Math.floor(Math.random() * Math.max(1, src.length - len));
      return src.substring(start, start + len).toUpperCase();
    }
  },

  _swapFragmentText(f){
    const newText = this._genFragmentText();
    const newTex = this._makeTitleTexture(newText, 96);
    const oldTex = f.mat.uniforms.uTex.value;
    f.mat.uniforms.uTex.value = newTex;
    if (oldTex) {
      try { oldTex.dispose(); } catch (e) {}
    }
  },

  // Per-fragment lifecycle. Phases:
  //   'on'         — steady glow at baseOp, low glitch
  //   'glitch_out' — chaotic stutter, max glitch, brief
  //   'off'        — invisible, waiting to re-emerge with new text
  _tickFragment(f, t, dt){
    if (t >= f.nextChange) {
      if (f.phase === 'on') {
        f.phase = 'glitch_out';
        f.nextChange = t + 0.18 + Math.random() * 0.25;
      } else if (f.phase === 'glitch_out') {
        f.phase = 'off';
        f.nextChange = t + 0.6 + Math.random() * 4.0;
      } else {
        // off → on : swap text on re-emergence (budgeted)
        if (this._fragSwapBudget > 0) {
          this._swapFragmentText(f);
          this._fragSwapBudget--;
        }
        f.phase = 'on';
        f.nextChange = t + 4 + Math.random() * 10;
      }
    }
    const u = f.mat.uniforms;
    let targetOp;
    if (f.phase === 'off') {
      targetOp = 0;
      u.uHover.value += (0 - u.uHover.value) * Math.min(1, dt * 6);
    } else if (f.phase === 'on') {
      targetOp = f.baseOp;
      u.uHover.value += (0 - u.uHover.value) * Math.min(1, dt * 6);
    } else { // glitch_out
      targetOp = (Math.random() < 0.45) ? f.baseOp * 1.4 : 0.04;
      u.uHover.value = 1.0;
    }
    const lerpRate = (f.phase === 'glitch_out') ? 30 : 4;
    u.uOpacity.value += (targetOp - u.uOpacity.value) * Math.min(1, dt * lerpRate);
  },

  /* ---------- Nebula skybox (slow-drifting fbm cloud field, visible 360°) ---------- */
  _buildNebula(){
    const geo = new THREE.SphereGeometry(600, 64, 32);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uBass: { value: 0 } },
      vertexShader: `
        varying vec3 vDir;
        void main(){
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uBass;
        varying vec3 vDir;

        vec3 hash3(vec3 p){
          p = vec3(dot(p, vec3(127.1, 311.7,  74.7)),
                   dot(p, vec3(269.5, 183.3, 246.1)),
                   dot(p, vec3(113.5, 271.9, 124.6)));
          return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
        }
        float noise(vec3 p){
          vec3 i = floor(p);
          vec3 f = fract(p);
          vec3 u = f*f*(3.0-2.0*f);
          return mix(mix(mix(dot(hash3(i+vec3(0,0,0)), f-vec3(0,0,0)),
                             dot(hash3(i+vec3(1,0,0)), f-vec3(1,0,0)), u.x),
                         mix(dot(hash3(i+vec3(0,1,0)), f-vec3(0,1,0)),
                             dot(hash3(i+vec3(1,1,0)), f-vec3(1,1,0)), u.x), u.y),
                     mix(mix(dot(hash3(i+vec3(0,0,1)), f-vec3(0,0,1)),
                             dot(hash3(i+vec3(1,0,1)), f-vec3(1,0,1)), u.x),
                         mix(dot(hash3(i+vec3(0,1,1)), f-vec3(0,1,1)),
                             dot(hash3(i+vec3(1,1,1)), f-vec3(1,1,1)), u.x), u.y), u.z);
        }
        float fbm(vec3 p){
          float v = 0.0; float a = 0.5;
          for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
          return v;
        }

        // HSL → RGB (h in [0,1])
        vec3 hsl2rgb(float h, float s, float l){
          vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
        }

        void main(){
          vec3 d = vDir;
          float t = uTime * 0.022;

          // Three fbm fields drifting in different directions
          float n1 = fbm(d * 1.6 + vec3(t,         t * 0.7,  0.0));
          float n2 = fbm(d * 3.4 + vec3(0.0,      -t * 0.8,  t * 0.55));
          float n3 = fbm(d * 6.0 + vec3(t * 0.3,   0.0,     -t * 0.4));

          float cloud = smoothstep(-0.10, 0.55, n1 * 0.75 + n2 * 0.40);
          float wisps = smoothstep(0.40, 0.90, n2 + n3 * 0.5);

          // Slow-orbiting hue axis — direction in space whose alignment with
          // the view direction biases hue. Combined with a global hue rotation,
          // this gives a full rainbow gradient that flows across the sphere.
          vec3 hueAxis = normalize(vec3(
            sin(uTime * 0.025),
            0.30 * sin(uTime * 0.011),
            cos(uTime * 0.025)
          ));
          float axisAlign = dot(d, hueAxis) * 0.5 + 0.5;       // 0..1 across sphere
          float baseHue   = uTime * 0.011;                      // full cycle ~9.5 min
          // Hue varies only ~20% across the sphere (was 55%) so the whole sky
          // reads as a cohesive 1–2 color family at any moment, not a full rainbow.
          // Time still rotates through every hue slowly.
          float hue = fract(baseHue + axisAlign * 0.18 + n1 * 0.06);

          // Cloud / wisp / rim hue offsets stay close so the sphere reads
          // unified at any given second.
          vec3 cloudCol = hsl2rgb(hue,                    0.55, 0.26);
          vec3 wispCol  = hsl2rgb(fract(hue + 0.06),      0.72, 0.42);
          vec3 rimCol   = hsl2rgb(fract(hue + 0.50),      0.45, 0.32);   // complementary accent

          vec3 colVoid = vec3(0.018, 0.012, 0.030);

          vec3 col = mix(colVoid, cloudCol, cloud);
          col = mix(col, wispCol, wisps * 0.55);
          col = mix(col, rimCol, smoothstep(0.72, 1.00, n2) * 0.30);

          // Mild vertical falloff
          col *= 0.55 + 0.50 * (1.0 - abs(d.y));

          // Bass-react brightness
          col *= 1.0 + uBass * 0.25;

          // Overall trim
          col *= 0.85;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    });
    this.nebula = new THREE.Mesh(geo, mat);
    this.nebula.renderOrder = -10;
    this.scene.add(this.nebula);
  },

  /* ---------- Ambient streak meteors (bright, visible eye-catchers) ---------- */
  _buildStreaks(){
    const N = 12;
    this.streaks = [];
    const tex = this._makeStreakTexture();
    for (let i = 0; i < N; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0,
      });
      // Large + thick enough to actually read across a 1080p viewport at distance.
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(48, 4.5), mat);
      plane.visible = false;
      this.scene.add(plane);
      this.streaks.push({ mesh: plane, mat, active: false, vel: new THREE.Vector3(), life: 0, maxLife: 0 });
    }
    this._nextStreakAt = 0;
  },

  _makeStreakTexture(){
    const c = document.createElement('canvas');
    c.width = 512; c.height = 64;
    const ctx = c.getContext('2d');
    // Horizontal: bright head with extended trail. Brighter overall than b113.
    const g = ctx.createLinearGradient(0, 0, 512, 0);
    g.addColorStop(0.00, 'rgba(255,255,255,0.00)');
    g.addColorStop(0.40, 'rgba(180,210,255,0.30)');
    g.addColorStop(0.75, 'rgba(220,235,255,0.85)');
    g.addColorStop(0.92, 'rgba(255,250,255,1.00)');
    g.addColorStop(0.98, 'rgba(255,255,255,1.00)');
    g.addColorStop(1.00, 'rgba(255,255,255,0.00)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 64);
    // Punch a vertical alpha falloff so the plane reads as a thin streak
    const v = ctx.createLinearGradient(0, 0, 0, 64);
    v.addColorStop(0.00, 'rgba(0,0,0,1)');
    v.addColorStop(0.42, 'rgba(0,0,0,0)');
    v.addColorStop(0.58, 'rgba(0,0,0,0)');
    v.addColorStop(1.00, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = v; ctx.fillRect(0, 0, 512, 64);
    ctx.globalCompositeOperation = 'source-over';
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  },

  _tickStreaks(t, dt){
    if (!this.streaks) return;
    if (t > this._nextStreakAt) {
      const free = this.streaks.find(s => !s.active);
      if (free) {
        // Spawn closer to camera for visibility (was 200-320)
        const u  = Math.random() * 2 - 1;
        const th = Math.random() * Math.PI * 2;
        const rr = Math.sqrt(1 - u * u);
        const radial = new THREE.Vector3(Math.cos(th) * rr, u, Math.sin(th) * rr);
        const dist = 130 + Math.random() * 90;
        free.mesh.position.copy(radial).multiplyScalar(dist);
        // Tangent direction for motion
        const helper = Math.abs(radial.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        const tangent = new THREE.Vector3().crossVectors(radial, helper).normalize();
        const spin = Math.random() * Math.PI * 2;
        tangent.applyAxisAngle(radial, spin);
        free.vel.copy(tangent).multiplyScalar(55 + Math.random() * 45);
        // Orient plane long-axis along motion direction, facing the camera (origin)
        const lookTarget = free.mesh.position.clone().add(tangent);
        free.mesh.lookAt(lookTarget);
        free.mesh.rotateZ(Math.PI / 2);
        free.life = 0;
        free.maxLife = 1.8 + Math.random() * 1.2;
        free.active = true;
        free.mesh.visible = true;
        free.mat.opacity = 0;
      }
      // More frequent than b113 (was 0.9–3.1s gap). 0.5–1.8s now.
      this._nextStreakAt = t + 0.5 + Math.random() * 1.3;
    }
    this.streaks.forEach(s => {
      if (!s.active) return;
      s.life += dt;
      const lf = s.life / s.maxLife;
      if (lf >= 1) {
        s.active = false;
        s.mesh.visible = false;
        s.mat.opacity = 0;
        return;
      }
      s.mesh.position.addScaledVector(s.vel, dt);
      const a = lf < 0.15 ? lf / 0.15 : (1 - (lf - 0.15) / 0.85);
      s.mat.opacity = Math.max(0, a) * 1.0;
    });
  },

  /* ---------- Plasma / tracer bolt pool (used by scripted ship combat) ---------- */
  _buildBolts(){
    const N = 24;
    this.bolts = [];
    const tex = this._makeSatLightTexture();
    for (let i = 0; i < N; i++) {
      const mat = new THREE.SpriteMaterial({
        map: tex, color: 0xff40ff,
        transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, opacity: 0,
      });
      const sp = new THREE.Sprite(mat);
      sp.scale.set(0.7, 0.7, 1);
      sp.visible = false;
      this.scene.add(sp);
      this.bolts.push({
        mesh: sp, mat, active: false,
        vel: new THREE.Vector3(),
        life: 0, maxLife: 0, maxOpacity: 1,
      });
    }
  },

  // Fire a bolt from origin in the direction of target with optional spread.
  // color: hex int. spread: lateral randomization in radians-equivalent.
  _fireBolt(originPos, targetPos, color, opts){
    if (!this.bolts) return;
    const free = this.bolts.find(b => !b.active);
    if (!free) return;
    opts = opts || {};
    const speed  = opts.speed  || 90;
    const spread = opts.spread || 0.10;
    const life   = opts.life   || 1.1;
    const scale  = opts.scale  || 0.7;
    const dir = new THREE.Vector3().subVectors(targetPos, originPos).normalize();
    dir.x += (Math.random() - 0.5) * spread;
    dir.y += (Math.random() - 0.5) * spread;
    dir.z += (Math.random() - 0.5) * spread;
    dir.normalize();
    free.mesh.position.copy(originPos);
    free.vel.copy(dir).multiplyScalar(speed);
    free.life = 0;
    free.maxLife = life;
    free.active = true;
    free.mesh.visible = true;
    free.mesh.scale.set(scale, scale, 1);
    free.mat.color.set(color || 0xff40ff);
    free.maxOpacity = (opts.opacity != null) ? opts.opacity : 1.0;
    free.mat.opacity = 0;
  },

  _tickBolts(t, dt){
    if (!this.bolts) return;
    this.bolts.forEach(b => {
      if (!b.active) return;
      b.life += dt;
      const lf = b.life / b.maxLife;
      if (lf >= 1) {
        b.active = false;
        b.mesh.visible = false;
        b.mat.opacity = 0;
        return;
      }
      b.mesh.position.addScaledVector(b.vel, dt);
      // Fade-in fast, fade-out slow
      const a = lf < 0.10 ? lf / 0.10 : (1 - (lf - 0.10) / 0.90);
      b.mat.opacity = Math.max(0, a) * b.maxOpacity;
    });
  },

  /* ---------- Flyby ships — Halo / Marathon / Destiny variants with motion ---------- */
  // Pool with mixed types. Each type has its own silhouette + flight signature:
  //   • longsword  — Halo-style dart, twin cyan flames, banking roll
  //   • banshee    — Covenant fighter, magenta plasma, continuous barrel roll
  //   • pelican    — UNSC dropship, twin top engines, slow lumbering wobble
  //   • forerunner — geometric ringed sphere, silent drift, internal ring spin
  // Three.js Object3D.lookAt aligns local +Z toward target for non-camera
  // objects, so each model's inner group has rotation.y = π so the visual
  // nose (built at local -Z) ends up pointing along velocity.
  _buildFlyby(){
    this.flybyShips = [];
    // 2 longswords (so they can patrol in formation), 1 each of the others
    this.flybyShips.push(this._makeLongsword());
    this.flybyShips.push(this._makeLongsword());
    this.flybyShips.push(this._makeBanshee());
    this.flybyShips.push(this._makePelican());
    this.flybyShips.push(this._makeForerunner());
    this._nextFlybyAt = 2 + Math.random() * 2;          // b189: first flyby in 2–4s (was 3–7s)
    this._nextScenarioAt = 8 + Math.random() * 6;       // b189: first scripted scenario at 8–14s
  },

  _makeFlameTexture(opts){
    opts = opts || {};
    const stops = opts.stops || [
      [0.00, 'rgba(255,255,255,1.00)'],
      [0.10, 'rgba(200,235,255,0.95)'],
      [0.35, 'rgba(90,180,255,0.55)'],
      [0.70, 'rgba(40,90,210,0.18)'],
      [1.00, 'rgba(20,40,120,0.00)'],
    ];
    const c = document.createElement('canvas');
    c.width = 64; c.height = 256;
    const ctx = c.getContext('2d');
    // Bright end at canvas bottom → maps to cone base (engine end) per ConeGeometry V mapping
    const g = ctx.createLinearGradient(0, 256, 0, 0);
    stops.forEach(([off, col]) => g.addColorStop(off, col));
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 256);
    // Soften horizontal edges
    const h = ctx.createLinearGradient(0, 0, 64, 0);
    h.addColorStop(0.00, 'rgba(0,0,0,0.55)');
    h.addColorStop(0.50, 'rgba(0,0,0,0.00)');
    h.addColorStop(1.00, 'rgba(0,0,0,0.55)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = h; ctx.fillRect(0, 0, 64, 256);
    ctx.globalCompositeOperation = 'source-over';
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  },

  /* — Longsword (Halo) — angular dart, twin engines, cyan plasma — */
  _makeLongsword(){
    const outer = new THREE.Group();
    const inner = new THREE.Group();
    inner.rotation.y = Math.PI;
    outer.add(inner);

    const hull = new THREE.Mesh(
      new THREE.OctahedronGeometry(1, 0),
      new THREE.MeshBasicMaterial({ color: 0x9aa3ad })
    );
    hull.scale.set(1.0, 0.55, 4.0);
    inner.add(hull);

    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.7, 1.6),
      new THREE.MeshBasicMaterial({ color: 0x5a626c })
    );
    fin.position.set(0, -0.5, 1.0);
    inner.add(fin);

    const wingMat = new THREE.MeshBasicMaterial({ color: 0x6a737d });
    const wingGeo = new THREE.BoxGeometry(2.6, 0.16, 1.2);
    const wingL = new THREE.Mesh(wingGeo, wingMat);
    wingL.position.set(-1.7, -0.05, 0.8); wingL.rotation.y = 0.18;
    inner.add(wingL);
    const wingR = wingL.clone();
    wingR.position.x = 1.7; wingR.rotation.y = -0.18;
    inner.add(wingR);

    inner.add(new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.18, 1.4),
      new THREE.MeshBasicMaterial({ color: 0x101824 })
    )).position.set(0, 0.40, -0.6);

    const podMat = new THREE.MeshBasicMaterial({ color: 0x4a525c });
    const podGeo = new THREE.CylinderGeometry(0.40, 0.40, 1.4, 12);
    const podL = new THREE.Mesh(podGeo, podMat);
    podL.rotation.x = Math.PI / 2; podL.position.set(-0.7, -0.2, 2.6);
    inner.add(podL);
    const podR = podL.clone(); podR.position.x = 0.7; inner.add(podR);

    const glowTex = this._makeSatLightTexture();
    const makeGlow = (x) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: 0x60d8ff,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      sp.scale.set(1.8, 1.8, 1); sp.position.set(x, -0.20, 3.40);
      return sp;
    };
    const glowL = makeGlow(-0.7), glowR = makeGlow(0.7);
    inner.add(glowL); inner.add(glowR);

    const flameTex = this._makeFlameTexture();
    const flames = [];
    [-0.7, 0.7].forEach(x => {
      const flameMat = new THREE.MeshBasicMaterial({
        map: flameTex, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.55, 14, 12, 1, true), flameMat);
      fl.rotation.x = Math.PI / 2; fl.position.set(x, -0.20, 3.40 + 7);
      inner.add(fl);
      flames.push({ mesh: fl, mat: flameMat });
    });

    outer.visible = false;
    this.scene.add(outer);
    return {
      type: 'longsword',
      outer, inner, flames, glowL, glowR,
      active: false, velocity: new THREE.Vector3(),
      rollPhase: 0, life: 0, maxLife: 0,
    };
  },

  /* — Banshee (Covenant) — bat-wing fighter, magenta plasma, BARREL ROLLS — */
  _makeBanshee(){
    const outer = new THREE.Group();
    const inner = new THREE.Group();
    inner.rotation.y = Math.PI;
    outer.add(inner);

    // Central pod — squashed icosahedron in deep purple
    const pod = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.95, 1),
      new THREE.MeshBasicMaterial({ color: 0x4a2868 })
    );
    pod.scale.set(1.0, 0.65, 1.6);
    inner.add(pod);

    // Bat-wing canopies — angled flat triangles flanking the pod
    const wingMat = new THREE.MeshBasicMaterial({ color: 0x6a3a8a, side: THREE.DoubleSide });
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(2.6, -0.4);
    wingShape.lineTo(2.2, -1.6);
    wingShape.lineTo(0.4, -0.6);
    wingShape.lineTo(0, 0);
    const wingGeo = new THREE.ShapeGeometry(wingShape);
    const wingR = new THREE.Mesh(wingGeo, wingMat);
    wingR.position.set(0.4, 0.0, -0.2);
    wingR.rotation.x = -0.55;
    wingR.rotation.y = -0.15;
    inner.add(wingR);
    const wingL = new THREE.Mesh(wingGeo, wingMat);
    wingL.position.set(-0.4, 0.0, -0.2);
    wingL.rotation.x = -0.55;
    wingL.rotation.y = Math.PI + 0.15;  // mirror via Y rotation
    inner.add(wingL);

    // Cockpit eye — a single bright magenta pinpoint
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff5080 });
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), eyeMat);
    eye.position.set(0, 0.30, -0.95);
    inner.add(eye);

    // Plasma exhaust — magenta cone
    const plasmaTex = this._makeFlameTexture({
      stops: [
        [0.00, 'rgba(255,200,255,1.00)'],
        [0.10, 'rgba(255,90,255,0.95)'],
        [0.35, 'rgba(220,40,200,0.55)'],
        [0.70, 'rgba(120,30,160,0.18)'],
        [1.00, 'rgba(60,15,90,0.00)'],
      ],
    });
    const plasmaMat = new THREE.MeshBasicMaterial({
      map: plasmaTex, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const plasma = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 12, 12, 1, true),
      plasmaMat
    );
    plasma.rotation.x = Math.PI / 2;
    plasma.position.set(0, 0, 1.4 + 6);
    inner.add(plasma);

    // Plasma engine glow
    const glowTex = this._makeSatLightTexture();
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xff40dd,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.set(2.4, 2.4, 1);
    glow.position.set(0, 0, 1.6);
    inner.add(glow);

    outer.visible = false;
    this.scene.add(outer);
    return {
      type: 'banshee',
      outer, inner,
      flames: [{ mesh: plasma, mat: plasmaMat }],
      glowL: glow, glowR: glow,
      active: false, velocity: new THREE.Vector3(),
      rollPhase: 0, life: 0, maxLife: 0,
    };
  },

  /* — Pelican (UNSC dropship) — proper silhouette + animated rear hatch + cargo bay — */
  _makePelican(){
    const outer = new THREE.Group();
    const inner = new THREE.Group();
    inner.rotation.y = Math.PI;
    outer.add(inner);

    const hullMat = new THREE.MeshBasicMaterial({ color: 0x424a36 });   // UNSC olive
    const dkMat   = new THREE.MeshBasicMaterial({ color: 0x2a3022 });   // shadow trim
    const ltMat   = new THREE.MeshBasicMaterial({ color: 0x5a6248 });   // highlight panels

    // Wide flat fuselage (wider than tall)
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.6, 6.0), hullMat);
    inner.add(body);

    // Belly plate (slightly darker, slightly recessed)
    const belly = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.20, 5.6), dkMat);
    belly.position.set(0, -0.85, 0);
    inner.add(belly);

    // Stepped cockpit module — sits on top of front fuselage
    const cockpitBody = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 2.2), ltMat);
    cockpitBody.position.set(0, 1.05, -1.7);
    inner.add(cockpitBody);

    // Slanted forward nose-cap (Pelican's iconic angled snout)
    const nose = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 1.5), hullMat);
    nose.position.set(0, 0.30, -3.2);
    inner.add(nose);

    // Forward windshield strip — cyan emissive, angled
    const win = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.55, 0.06),
      new THREE.MeshBasicMaterial({ color: 0x80e0ff })
    );
    win.position.set(0, 1.10, -2.78);
    win.rotation.x = -0.40;
    inner.add(win);

    // Stub wings (side-mounted, sweep-back) carrying engines on outer ends
    const wingL = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.32, 1.8), dkMat);
    wingL.position.set(-2.5, -0.05, 0.6);
    inner.add(wingL);
    const wingR = wingL.clone();
    wingR.position.x = 2.5;
    inner.add(wingR);

    // Twin underwing engine pods — Pelican signature: hung BENEATH the wings
    const podMat = new THREE.MeshBasicMaterial({ color: 0x282e22 });
    const podGeo = new THREE.CylinderGeometry(0.55, 0.55, 2.8, 14);
    const podL = new THREE.Mesh(podGeo, podMat);
    podL.rotation.x = Math.PI / 2;
    podL.position.set(-3.05, -0.45, 0.5);
    inner.add(podL);
    const podR = podL.clone();
    podR.position.x = 3.05;
    inner.add(podR);

    // Engine intake rings (lighter trim at front of pods)
    const intakeGeo = new THREE.TorusGeometry(0.55, 0.08, 8, 20);
    const intakeL = new THREE.Mesh(intakeGeo,
      new THREE.MeshBasicMaterial({ color: 0x6a7458 }));
    intakeL.position.set(-3.05, -0.45, -0.85);
    intakeL.rotation.y = Math.PI / 2;
    inner.add(intakeL);
    const intakeR = intakeL.clone();
    intakeR.position.x = 3.05;
    inner.add(intakeR);

    // Tail vertical fin
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.6, 1.2), dkMat);
    tail.position.set(0, 1.45, 2.2);
    inner.add(tail);

    // Tail running lights (red port, green starboard)
    const lightTex = this._makeSatLightTexture();
    const tailRed = new THREE.Sprite(new THREE.SpriteMaterial({
      map: lightTex, color: 0xff3030, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85,
    }));
    tailRed.scale.set(0.5, 0.5, 1);
    tailRed.position.set(-3.05, -0.30, -0.95);
    inner.add(tailRed);
    const tailGrn = tailRed.clone();
    tailGrn.material = tailRed.material.clone();
    tailGrn.material.color.set(0x30ff60);
    tailGrn.position.x = 3.05;
    inner.add(tailGrn);

    // === Rear hatch — pivots at TOP edge so it swings DOWN when opening ===
    const hatchPivot = new THREE.Group();
    hatchPivot.position.set(0, 0.78, 3.0);   // hinge at top-rear of fuselage
    const hatchPanel = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 1.55, 0.10),
      hullMat
    );
    hatchPanel.position.set(0, -0.78, 0);    // offset so hinge is at top of panel
    hatchPivot.add(hatchPanel);
    // Inner hatch trim (visible when open)
    const hatchTrim = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.10, 0.04),
      new THREE.MeshBasicMaterial({ color: 0xc0a040 })
    );
    hatchTrim.position.set(0, -1.50, 0.06);
    hatchPivot.add(hatchTrim);
    inner.add(hatchPivot);

    // === Cargo bay interior — Spartans + muzzle flashes ===
    // Group sits inside the body. Hidden until hatch begins opening.
    const cargo = new THREE.Group();
    cargo.position.set(0, -0.05, 1.6);

    // Cargo floor (visible only when hatch is open)
    const floor = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.05, 2.4), dkMat);
    floor.position.y = -0.55;
    cargo.add(floor);

    const spartans = [];
    const muzzleFlashes = [];
    const spartanColors = [0x3a5840, 0x402030, 0x203840];  // green / red / blue
    [-0.7, 0, 0.7].forEach((x, i) => {
      const fig = new THREE.Group();
      fig.position.set(x, -0.20, 0.30 - i * 0.20); // staggered toward hatch
      // Body
      const torso = new THREE.Mesh(
        new THREE.BoxGeometry(0.40, 0.65, 0.32),
        new THREE.MeshBasicMaterial({ color: spartanColors[i] })
      );
      fig.add(torso);
      // Helmet
      const helm = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.28, 0.32),
        new THREE.MeshBasicMaterial({ color: 0x1a2024 })
      );
      helm.position.y = 0.46;
      fig.add(helm);
      // Visor (cyan strip)
      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.30, 0.06, 0.02),
        new THREE.MeshBasicMaterial({ color: 0x60ffd0 })
      );
      visor.position.set(0, 0.46, 0.17);
      fig.add(visor);
      // Rifle (small box pointing forward)
      const rifle = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.10, 0.50),
        new THREE.MeshBasicMaterial({ color: 0x101010 })
      );
      rifle.position.set(0.18, 0.05, 0.32);
      fig.add(rifle);

      // Muzzle flash sprite at the end of the rifle
      const mf = new THREE.Sprite(new THREE.SpriteMaterial({
        map: lightTex, color: 0xffe080,
        transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, opacity: 0,
      }));
      mf.scale.set(0.5, 0.5, 1);
      mf.position.set(0.18, 0.05, 0.62);
      fig.add(mf);

      cargo.add(fig);
      spartans.push(fig);
      muzzleFlashes.push(mf);
    });

    cargo.visible = false;
    inner.add(cargo);

    // === Engine glow + flames at the back of each underwing pod ===
    const glowTex = this._makeSatLightTexture();
    const flameTex = this._makeFlameTexture({
      stops: [
        [0.00, 'rgba(255,255,255,1.00)'],
        [0.10, 'rgba(180,210,255,0.95)'],
        [0.35, 'rgba(80,140,220,0.55)'],
        [0.70, 'rgba(30,60,140,0.18)'],
        [1.00, 'rgba(10,20,60,0.00)'],
      ],
    });
    const flames = [];
    let glowL, glowR;
    [-3.05, 3.05].forEach((x, i) => {
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: 0x80c8ff,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      glow.scale.set(1.7, 1.7, 1);
      glow.position.set(x, -0.45, 1.95);
      inner.add(glow);
      if (i === 0) glowL = glow; else glowR = glow;

      const flameMat = new THREE.MeshBasicMaterial({
        map: flameTex, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
      const fl = new THREE.Mesh(
        new THREE.ConeGeometry(0.55, 10, 10, 1, true),
        flameMat
      );
      fl.rotation.x = Math.PI / 2;
      fl.position.set(x, -0.45, 1.95 + 5);
      inner.add(fl);
      flames.push({ mesh: fl, mat: flameMat });
    });

    outer.visible = false;
    this.scene.add(outer);
    return {
      type: 'pelican',
      outer, inner, flames, glowL, glowR,
      // Combat-scenario hooks
      hatchPivot, cargo, spartans, muzzleFlashes,
      hatchAngle: 0, hatchTarget: 0,
      // Scripted scenario state
      scenario: null,
      scenarioPhase: 0,
      scenarioTime: 0,
      active: false, velocity: new THREE.Vector3(),
      rollPhase: 0, life: 0, maxLife: 0,
    };
  },

  /* — Forerunner sphere — geometric ringed orb, silent drift, internal spin — */
  _makeForerunner(){
    const outer = new THREE.Group();
    const inner = new THREE.Group();
    inner.rotation.y = Math.PI;
    outer.add(inner);

    const fresnelVS = `
      varying vec3 vNormal; varying vec3 vView;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView   = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `;
    const fresnelFS = `
      uniform float uTime; uniform float uHueOffset; uniform float uPower;
      varying vec3 vNormal; varying vec3 vView;
      vec3 hsl2rgb(float h, float s, float l){
        vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
      }
      void main(){
        float fres = 1.0 - abs(dot(vNormal, vView));
        fres = pow(fres, uPower);
        float hue = fract(uTime * 0.05 + uHueOffset);
        vec3 col = hsl2rgb(hue, 0.65, 0.62);
        float a = 0.20 + fres * 0.85;
        gl_FragColor = vec4(col, a);
      }
    `;

    // Inner orb
    const orbMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uHueOffset: { value: 0 }, uPower: { value: 1.4 } },
      vertexShader: fresnelVS, fragmentShader: fresnelFS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 2), orbMat);
    inner.add(orb);

    // Concentric rings — each rotates independently in tick
    const rings = [];
    [
      { r: 1.7, t: 0.06, hue: 0.10 },
      { r: 2.1, t: 0.08, hue: 0.30 },
      { r: 2.6, t: 0.06, hue: 0.55 },
    ].forEach(c => {
      const rmat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uHueOffset: { value: c.hue }, uPower: { value: 1.5 } },
        vertexShader: fresnelVS, fragmentShader: fresnelFS,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(c.r, c.t, 10, 56), rmat);
      ring.rotation.x = Math.random() * Math.PI;
      ring.rotation.y = Math.random() * Math.PI;
      inner.add(ring);
      rings.push({ mesh: ring, mat: rmat });
    });

    outer.visible = false;
    this.scene.add(outer);
    return {
      type: 'forerunner',
      outer, inner, orb, orbMat, rings,
      flames: [], glowL: null, glowR: null,
      active: false, velocity: new THREE.Vector3(),
      rollPhase: 0, life: 0, maxLife: 0,
    };
  },

  // === Scripted scenario: Pelican w/ Spartans firing, Banshee chaser ===
  // Phases (over scenarioTime):
  //   0.0–1.5s : approach (closed hatch, normal cruise)
  //   1.5–9.0s : combat — hatch open, Spartans fire, Banshee chases + plasma bolts
  //   9.0+    : hatch closes, ships continue out
  _spawnPelicanCombat(pelican, banshee, forcedPattern){
    // Pick spawn geometry. If a title is focused, anchor the dogfight around
    // it with a randomized pattern (or a forced one from admin). Otherwise
    // fall back to a wide sphere pass.
    let dir, perp1, perp2, baseStart;
    let pattern = 'default';

    if (this.focused) {
      const T = this.focused.mesh.position.clone();
      const tDist = Math.max(20, T.length());
      const fwdToTitle = T.clone().normalize();
      const worldUp = new THREE.Vector3(0, 1, 0);
      // If the title is straight up/down (rare), swap helper to avoid a degenerate cross.
      const helper = Math.abs(fwdToTitle.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : worldUp;
      const right  = new THREE.Vector3().crossVectors(fwdToTitle, helper).normalize();
      const upPerp = new THREE.Vector3().crossVectors(right, fwdToTitle).normalize();

      const sideSign = Math.random() < 0.5 ? 1 : -1;
      const patterns = ['across_behind', 'fly_toward', 'fly_over', 'cross_in_front', 'weave_near'];
      pattern = patterns.includes(forcedPattern)
        ? forcedPattern
        : patterns[(Math.random() * patterns.length) | 0];

      // Scale spawn geometry to title's actual distance — focused titles sit
      // at showcaseDist (~14–22u from camera), so generic 200u offsets put
      // ships way outside the FOV cone. Bound the scale so unfocused calls
      // (rare) still get a useful corridor.
      const scale = Math.max(1.0, Math.min(2.4, tDist / 18));

      // perp1 = chase plane lateral, perp2 = chase plane vertical (used by S-curve math)
      if (pattern === 'across_behind') {
        // Horizontal sweep, ~12u behind the title plane.
        dir   = right.clone().multiplyScalar(sideSign);
        perp1 = upPerp.clone();
        perp2 = fwdToTitle.clone();
        const closest = T.clone().addScaledVector(fwdToTitle, 12);
        baseStart = closest.clone().addScaledVector(dir, -90 * scale);
      } else if (pattern === 'fly_toward') {
        // Start far behind title, dive toward camera, veer off-side at last sec.
        dir = fwdToTitle.clone().multiplyScalar(-1)
              .addScaledVector(right, sideSign * 0.18)
              .normalize();
        perp1 = right.clone();
        perp2 = upPerp.clone();
        const off = right.clone().multiplyScalar(sideSign * 14)
              .add(upPerp.clone().multiplyScalar((Math.random() - 0.5) * 10));
        baseStart = T.clone().addScaledVector(fwdToTitle, 100 * scale).add(off);
      } else if (pattern === 'fly_over') {
        // True fly-over: emerge from BEHIND-and-ABOVE the title, descend
        // diagonally over its top, exit past camera on the opposite side.
        // Diagonal dir + non-zero z component is what makes it actually
        // arc over, instead of skimming sideways above the text.
        const startBehind = 70 * scale;
        const startUp     = 9;
        const startSide   = 12 * sideSign;
        baseStart = T.clone()
          .addScaledVector(fwdToTitle,  startBehind)
          .addScaledVector(upPerp,      startUp)
          .addScaledVector(right,       startSide);
        dir = fwdToTitle.clone().multiplyScalar(-1)         // toward camera
          .addScaledVector(right,  -sideSign * 0.32)        // veer to opposite side
          .addScaledVector(upPerp, -0.20)                   // descend slightly
          .normalize();
        // Use camera-aligned axes for S-curve perturbations so wobble stays readable
        perp1 = right.clone();
        perp2 = upPerp.clone();
      } else if (pattern === 'cross_in_front') {
        // Pass BETWEEN camera and title at ~60% of the title's depth, with
        // tiny vertical drift so it doesn't skim a single horizontal line.
        dir   = right.clone().multiplyScalar(sideSign);
        perp1 = upPerp.clone();
        perp2 = fwdToTitle.clone();
        const closest = T.clone().multiplyScalar(0.60)
          .addScaledVector(upPerp, (Math.random() - 0.5) * 4);
        // 70u sweep — short enough that the eclipse moment dominates.
        baseStart = closest.clone().addScaledVector(dir, -70 * scale);
      } else { // weave_near
        // Slow tight pass at the title's depth — the pelican's S-curve +
        // RCS thrusters become the visual story. Closest-approach pre-offset
        // by -side so the ship genuinely closes on the title from the side.
        dir   = right.clone().multiplyScalar(sideSign);
        perp1 = upPerp.clone();
        perp2 = fwdToTitle.clone();
        const closest = T.clone()
          .addScaledVector(upPerp, (Math.random() - 0.5) * 5)
          .addScaledVector(right,  -sideSign * 3);
        baseStart = closest.clone().addScaledVector(dir, -75 * scale);
      }
    } else {
      // No focus — original wide sphere pass
      const u  = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(1 - u * u);
      dir = new THREE.Vector3(Math.cos(th) * rr, u, Math.sin(th) * rr);
      const helper = Math.abs(dir.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      perp1 = new THREE.Vector3().crossVectors(dir, helper).normalize();
      perp1.applyAxisAngle(dir, Math.random() * Math.PI * 2);
      perp2 = new THREE.Vector3().crossVectors(dir, perp1).normalize();
      const spawnRadius = 240 + Math.random() * 60;
      const offset      = 70 + Math.random() * 60;
      baseStart = new THREE.Vector3()
        .copy(dir).multiplyScalar(-spawnRadius)
        .add(perp1.clone().multiplyScalar(offset));
    }

    const pelicanSpeed = 38 + Math.random() * 12;
    const banSpeed     = pelicanSpeed * 1.15;

    // Lifetime: cover the corridor distance plus a buffer. Use the actual
    // baseStart distance from origin so focus-aware spawns still scale right.
    const corridor = 2 * Math.max(180, baseStart.length() + 40);
    const pelicanMaxLife = corridor / pelicanSpeed + 1.0;

    // Pelican at lead (the one being chased)
    pelican.outer.position.copy(baseStart);
    pelican.outer.lookAt(baseStart.clone().add(dir));
    pelican.inner.rotation.set(0, Math.PI, 0);
    pelican.velocity.copy(dir).multiplyScalar(pelicanSpeed);
    pelican.life = 0;
    pelican.maxLife = pelicanMaxLife;
    pelican.active = true;
    pelican.outer.visible = true;
    pelican.scenario = 'combat_target';
    pelican.scenarioTime = 0;
    pelican.scenarioPhase = 0;
    pelican.hatchAngle = 0;
    pelican.hatchTarget = 0;
    pelican.cargo.visible = false;
    pelican.muzzleFlashes.forEach(mf => mf.material.opacity = 0);
    // Per-pattern wobble — close passes (cross_in_front, weave_near) need
    // small amps or the ±46u vertical wobble swings the pelican out of
    // frame. Other patterns keep the original 46/18/32 behavior.
    const amps = pattern === 'cross_in_front'
      ? { lateral: 5,  vertical: 3, rcs: 4  }
      : pattern === 'weave_near'
      ? { lateral: 10, vertical: 5, rcs: 8  }
      : { lateral: 46, vertical: 18, rcs: 32 };
    pelican.scenarioBase = {
      dir: dir.clone(), perp1: perp1.clone(), perp2: perp2.clone(),
      speed: pelicanSpeed,
      pattern,
      seedA: Math.random() * Math.PI * 2,
      seedB: Math.random() * Math.PI * 2,
      lateralAmp: amps.lateral,
      verticalAmp: amps.vertical,
      rcsAmp: amps.rcs,
    };

    // Banshee chaser — starts behind & off-axis
    const banStart = baseStart.clone()
      .add(dir.clone().multiplyScalar(-18))
      .add(perp1.clone().multiplyScalar(2.5))
      .add(perp2.clone().multiplyScalar(1.5));
    banshee.outer.position.copy(banStart);
    banshee.outer.lookAt(banStart.clone().add(dir));
    banshee.inner.rotation.set(0, Math.PI, 0);
    banshee.velocity.copy(dir).multiplyScalar(banSpeed);
    banshee.life = 0;
    banshee.maxLife = pelican.maxLife;
    banshee.active = true;
    banshee.outer.visible = true;
    banshee.scenario = 'combat_chaser';
    banshee.scenarioTime = 0;
    banshee.scenarioTargetRef = pelican;
    banshee.fireCooldown = 1.5;
    // Pick weapon per pass for variety: blue rapid laser burst OR slower
    // green plasma ball. Same scenario, different threat character.
    banshee.weaponMode = Math.random() < 0.5 ? 'laser' : 'missile';
    banshee.scenarioBase = {
      dir: dir.clone(), perp1: perp1.clone(), perp2: perp2.clone(),
      speed: banSpeed,
      pattern,
      seedA: Math.random() * Math.PI * 2,
      seedB: Math.random() * Math.PI * 2,
    };

    // Camera follow: only when no title is focused AND user hasn't disabled
    // it via the admin panel. Released when scenario clears.
    if (!this.focused && !this._followDisabled) {
      this._scenarioFollow = { ships: [pelican, banshee] };
    } else {
      this._scenarioFollow = null;
    }

    // Surface which pattern fired so the user can verify in the admin panel.
    if (this._flashHint) {
      const label = pattern.replace(/_/g, ' ');
      const ctx = this.focused ? `· target: ${this.focused.track.title.toLowerCase()}` : '';
      this._flashHint(`spawned: ${label} ${ctx}`.trim(), 'info');
    }
  },

  // ============================================================
  // Additional scenarios — strafing run, orbit, plasma storm
  // ============================================================

  _spawnLongswordStrafe(){
    if (!this.flybyShips) return;
    let ships = this.flybyShips.filter(s => s.type === 'longsword' && !s.active);
    if (ships.length < 3) {
      // force-clear all longswords
      this.flybyShips.filter(s => s.type === 'longsword').forEach(s => {
        s.active = false; s.outer.visible = false; s.scenario = null;
      });
      ships = this.flybyShips.filter(s => s.type === 'longsword');
    }
    if (ships.length < 3) return;

    // Target: focused title or distant point ahead.
    const target = this.focused
      ? this.focused.mesh.position.clone()
      : this._forwardVec().multiplyScalar(40);
    const tDist = Math.max(20, target.length());
    const fwdToTarget = target.clone().normalize();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const helper = Math.abs(fwdToTarget.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : worldUp;
    const right  = new THREE.Vector3().crossVectors(fwdToTarget, helper).normalize();
    const upPerp = new THREE.Vector3().crossVectors(right, fwdToTarget).normalize();

    const sideSign = Math.random() < 0.5 ? 1 : -1;
    const dir   = right.clone().multiplyScalar(sideSign);
    const speed = 95 + Math.random() * 25;
    const scale = Math.max(1.0, Math.min(2.4, tDist / 18));
    const closest = target.clone()
      .addScaledVector(upPerp, (Math.random() - 0.5) * 6)
      .addScaledVector(fwdToTarget, 8);
    const baseStart = closest.clone().addScaledVector(dir, -100 * scale);

    // V-formation slots for 3 longswords (lateral, back, vert)
    const slots = [
      { p:  0,    s:  0,   t:  0   },
      { p:  4.0,  s: -2.5, t:  0.6 },
      { p: -4.0,  s: -2.5, t:  0.6 },
    ];

    const corridor = 2 * Math.max(180, baseStart.length() + 40);
    const maxLife  = corridor / speed + 1.0;

    for (let i = 0; i < 3; i++) {
      const ls   = ships[i];
      const slot = slots[i];
      const start = baseStart.clone()
        .addScaledVector(dir, slot.s)
        .addScaledVector(upPerp, slot.t)
        .addScaledVector(right, slot.p);
      ls.outer.position.copy(start);
      ls.outer.lookAt(start.clone().add(dir));
      ls.inner.rotation.set(0, Math.PI, 0);
      ls.velocity.copy(dir).multiplyScalar(speed);
      ls.life = 0;
      ls.maxLife = maxLife;
      ls.active = true;
      ls.outer.visible = true;
      ls.scenario = 'strafe_run';
      ls.scenarioTime = 0;
      ls.scenarioBase = {
        dir: dir.clone(), perp1: upPerp.clone(), perp2: fwdToTarget.clone(),
        speed,
        target: target.clone(),
        fireCooldown: 0.4 + i * 0.15,    // staggered fire start
        leadIndex: i,
      };
    }

    if (!this.focused && !this._followDisabled) {
      this._scenarioFollow = { ships: ships.slice(0, 3) };
    } else {
      this._scenarioFollow = null;
    }
    if (this._flashHint) this._flashHint('spawned: longsword strafing run', 'info');
  },

  _spawnForerunnerOrbit(){
    if (!this.flybyShips) return;
    let f = this.flybyShips.find(s => s.type === 'forerunner' && !s.active);
    if (!f) {
      const cand = this.flybyShips.find(s => s.type === 'forerunner');
      if (!cand) return;
      cand.active = false; cand.outer.visible = false; cand.scenario = null;
      f = cand;
    }
    // b183: unfocused orbit pushed back — 40 → 70 forward distance, and
    // orbit radius 18 → 28 so the forerunner doesn't loom over the camera.
    // Focused orbit (around a title) stays tight.
    const center = this.focused ? this.focused.mesh.position.clone() : this._forwardVec().multiplyScalar(70);
    const radius = this.focused ? 8 + Math.random() * 4 : 28 + Math.random() * 6;
    const orbitAxis = new THREE.Vector3(
      (Math.random() - 0.5) * 0.4,
      0.85,
      (Math.random() - 0.5) * 0.4,
    ).normalize();

    f.outer.position.copy(center);
    f.outer.position.x += radius;
    f.inner.rotation.set(0, Math.PI, 0);
    f.velocity.set(0, 0, 0);
    f.life = 0;
    f.maxLife = 16.0;   // long-form scenario
    f.active = true;
    f.outer.visible = true;
    f.scenario = 'forerunner_orbit';
    f.scenarioTime = 0;
    f.scenarioBase = {
      center,
      radius,
      axis: orbitAxis,
      speed: 0.55 + Math.random() * 0.25,   // angular speed (rad/s)
      phase: Math.random() * Math.PI * 2,
    };

    if (!this.focused && !this._followDisabled) {
      this._scenarioFollow = { ships: [f] };
    } else {
      this._scenarioFollow = null;
    }
    if (this._flashHint) this._flashHint('spawned: forerunner orbit', 'info');
  },

  _spawnPlasmaStorm(){
    // Stateless burst — fires 24 plasma bolts over 2.0s converging on focused
    // title (or default forward point). No ship state involved.
    const center = this.focused ? this.focused.mesh.position.clone() : this._forwardVec().multiplyScalar(30);
    const colors = [0xff3ad8, 0xffe060, 0x66ddff];
    const total = 24;
    const elapsedBase = (this.clock ? this.clock.elapsedTime : 0);
    for (let i = 0; i < total; i++) {
      const delay = (i / total) * 1.8 + Math.random() * 0.05;
      setTimeout(() => {
        if (this.destroyed) return;
        const u  = Math.random() * 2 - 1;
        const th = Math.random() * Math.PI * 2;
        const rr = Math.sqrt(1 - u * u);
        const dir = new THREE.Vector3(Math.cos(th) * rr, u, Math.sin(th) * rr);
        const dist = 50 + Math.random() * 20;
        const origin = center.clone().addScaledVector(dir, dist);
        const impact = center.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 4,
        ));
        const c = colors[i % colors.length];
        this._fireBolt(origin, impact, c, {
          speed: 110 + Math.random() * 40,
          spread: 0.04, life: 1.0,
          scale: 0.85 + Math.random() * 0.4,
          opacity: 1.0,
        });
      }, delay * 1000);
    }
    if (this._flashHint) this._flashHint('spawned: plasma storm', 'info');
  },

  // ============================================================
  // b177 — extra scripted scenarios
  // Helpers + 15 _spawn* methods. Tick branches live in _tickScenario.
  // Ephemeral ships (minted on-demand for batched scenarios) carry
  // s._ephemeral = true and get torn down via _disposeEphemeralShip on
  // lifetime end / clear-flybys.
  // ============================================================

  _acquireShip(type, opts){
    opts = opts || {};
    if (!opts.forceMint) {
      const free = this.flybyShips.find(s => s.type === type && !s.active);
      if (free) return free;
      const reuse = this.flybyShips.find(s => s.type === type);
      if (reuse) { this._resetShip(reuse); return reuse; }
    }
    const factory = ({
      longsword: this._makeLongsword,
      banshee:   this._makeBanshee,
      pelican:   this._makePelican,
      forerunner:this._makeForerunner,
    })[type];
    if (!factory) return null;
    const s = factory.call(this);
    s._ephemeral = true;
    this.flybyShips.push(s);
    return s;
  },

  _resetShip(s){
    s.active = false;
    s.outer.visible = false;
    s.outer.scale.setScalar(1);
    s.outer.rotation.set(0, 0, 0);
    if (s.scenarioCleanup) { try { s.scenarioCleanup(); } catch (_) {} s.scenarioCleanup = null; }
    s.scenario = null;
    s.scenarioTime = 0;
    s.scenarioBase = null;
    s.scenarioTargetRef = null;
    if (s.type === 'pelican') {
      if (s.cargo) s.cargo.visible = false;
      s.hatchAngle = 0;
      s.hatchTarget = 0;
      if (s.hatchPivot) s.hatchPivot.rotation.x = 0;
      if (s.muzzleFlashes) s.muzzleFlashes.forEach(mf => mf.material.opacity = 0);
    }
  },

  _disposeEphemeralShip(s){
    if (!s || !s._ephemeral) return;
    if (s.outer && s.outer.parent) s.outer.parent.remove(s.outer);
    if (s.outer && s.outer.traverse) {
      s.outer.traverse(obj => {
        if (obj.geometry && obj.geometry.dispose) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach(m => { if (m && m.dispose) m.dispose(); });
        }
      });
    }
    const idx = this.flybyShips.indexOf(s);
    if (idx >= 0) this.flybyShips.splice(idx, 1);
  },

  _scenarioAnchor(){
    return this.focused
      ? this.focused.mesh.position.clone()
      : this._forwardVec().multiplyScalar(40);
  },

  _basisFromDir(dir){
    const helper = Math.abs(dir.y) > 0.95 ? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,1,0);
    const right = new THREE.Vector3().crossVectors(dir, helper).normalize();
    const up    = new THREE.Vector3().crossVectors(right, dir).normalize();
    return { right, up };
  },

  // ----- 1. SLIPSPACE JUMP — single ship streaks out, blue tear -----
  _spawnSlipspaceJump(){
    const ls = this._acquireShip('longsword');
    if (!ls) return;
    const fwd = this._forwardVec();
    const { right, up } = this._basisFromDir(fwd);
    const sideSign = Math.random() < 0.5 ? 1 : -1;
    const start = fwd.clone().multiplyScalar(45)
      .addScaledVector(right, sideSign * 14)
      .addScaledVector(up, 4);
    const heading = fwd.clone().addScaledVector(right, sideSign * 0.10).normalize();
    ls.outer.position.copy(start);
    ls.outer.lookAt(start.clone().add(heading));
    ls.inner.rotation.set(0, Math.PI, 0);
    ls.velocity.copy(heading).multiplyScalar(60);
    ls.life = 0; ls.maxLife = 1.8; ls.active = true; ls.outer.visible = true;
    ls.scenario = 'slipspace_jump'; ls.scenarioTime = 0;
    const tex = this._makeSatLightTexture();
    const tear = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, color: 0x66a8ff, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
    }));
    tear.scale.set(0.1, 0.1, 1);
    this.scene.add(tear);
    ls.scenarioBase = { dir: heading.clone(), tear };
    ls.scenarioCleanup = () => {
      if (tear.parent) tear.parent.remove(tear);
      if (tear.material.map) tear.material.map.dispose();
      tear.material.dispose();
    };
    if (!this._followDisabled && !this.focused) this._scenarioFollow = { ships: [ls] };
    if (this._flashHint) this._flashHint('spawned: slipspace jump', 'info');
  },

  // ----- 2. MOTHERSHIP REVEAL — huge purple/blue cruiser drifts past -----
  _spawnMothershipReveal(){
    const grp = new THREE.Group();
    const hullMat = new THREE.MeshBasicMaterial({ color: 0x1a1438, transparent: true, opacity: 0 });
    const accentMat = new THREE.MeshBasicMaterial({ color: 0x4a3aa8, transparent: true, opacity: 0 });
    const lightMat = new THREE.MeshBasicMaterial({
      color: 0x6c98ff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const spine = new THREE.Mesh(new THREE.BoxGeometry(70, 6, 12), hullMat); grp.add(spine);
    for (let i = 0; i < 4; i++) {
      const pod = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 10), hullMat);
      pod.position.set(-25 + i * 16, -5, 0);
      grp.add(pod);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(10, 8, 8), accentMat);
    bridge.position.set(20, 7, 0); grp.add(bridge);
    for (let i = 0; i < 12; i++) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 0.2), lightMat);
      strip.position.set(-30 + i * 5.4, 1.5, 6.05); grp.add(strip);
      const strip2 = strip.clone(); strip2.position.z = -6.05; grp.add(strip2);
    }
    const glowTex = this._makeSatLightTexture();
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0x88a0ff, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
    }));
    glow.scale.set(14, 14, 1); glow.position.set(-38, 0, 0); grp.add(glow);

    const fwd = this._forwardVec();
    const { right, up } = this._basisFromDir(fwd);

    // Marathon ship is a permanent landmark at (-340, 36, -120). Pick the
    // spawn side that's furthest from it so the two cruisers never overlap
    // regardless of where the camera's pointed.
    const marathonPos = this.marathonShip
      ? this.marathonShip.grp.position
      : new THREE.Vector3(-340, 36, -120);
    const sideSign = marathonPos.clone().normalize().dot(right) > 0 ? -1 : 1;

    grp.position.copy(fwd.clone().multiplyScalar(180))
      .addScaledVector(right, sideSign * 220)
      .addScaledVector(up, 30);
    grp.rotation.y = Math.PI * 0.10 * -sideSign;
    this.scene.add(grp);

    const fake = {
      type: 'mothership',
      outer: grp, inner: grp,
      active: true, _ephemeral: true,
      velocity: right.clone().multiplyScalar(sideSign * -20),
      rollPhase: 0, life: 0, maxLife: 24,
      scenario: 'mothership_reveal', scenarioTime: 0,
      scenarioBase: { hullMats: [hullMat, accentMat], lightMat, glow },
      scenarioCleanup: null,
    };
    this.flybyShips.push(fake);
    if (!this._followDisabled) this._scenarioFollow = { ships: [fake] };
    if (this._flashHint) this._flashHint('spawned: mothership reveal', 'info');
  },

  // ----- 3. CONVOY — 3 pelicans in echelon, cargo deployed -----
  _spawnConvoy(){
    const fwd = this._forwardVec();
    const { right, up } = this._basisFromDir(fwd);
    const side = Math.random() < 0.5 ? -1 : 1;
    const dir = right.clone().multiplyScalar(side).normalize();
    // True lateral perp (perp to both travel-dir AND up) — without this the
    // "lateral" offset would collapse onto the travel axis and stack ships.
    const perp = new THREE.Vector3().crossVectors(dir, up).normalize();
    const speed = 28;
    const startBase = fwd.clone().multiplyScalar(35).addScaledVector(dir, -110);
    // Echelon-right stagger: each pelican sits behind + lateral + above the
    // previous one so all three are visible distinct silhouettes.
    const slots = [
      { behind:   0, side:  0, vert: 0 },
      { behind: -22, side:  9, vert: 2 },
      { behind: -44, side: 18, vert: 4 },
    ];
    const ships = [];
    for (let i = 0; i < 3; i++) {
      const p = this._acquireShip('pelican', { forceMint: i > 0 });
      if (!p) continue;
      const slot = slots[i];
      const start = startBase.clone()
        .addScaledVector(dir,  slot.behind)
        .addScaledVector(perp, slot.side)
        .addScaledVector(up,   slot.vert);
      p.outer.position.copy(start);
      p.outer.lookAt(start.clone().add(dir));
      p.inner.rotation.set(0, Math.PI, 0);
      p.velocity.copy(dir).multiplyScalar(speed);
      p.life = 0; p.maxLife = (220 / speed) + 1.5;
      p.active = true; p.outer.visible = true;
      p.scenario = 'convoy'; p.scenarioTime = 0;
      p.scenarioBase = { dir: dir.clone(), perp1: up.clone(), speed, idx: i };
      p.hatchAngle = 0.55; p.hatchTarget = 0.55;
      if (p.hatchPivot) p.hatchPivot.rotation.x = 0.55;
      if (p.cargo) p.cargo.visible = true;
      ships.push(p);
    }
    if (!this._followDisabled && !this.focused) this._scenarioFollow = { ships };
    if (this._flashHint) this._flashHint('spawned: convoy', 'info');
  },

  // ----- 4. CRASH DIVE — longsword spirals down with smoke trail -----
  _spawnCrashDive(){
    const ls = this._acquireShip('longsword');
    if (!ls) return;
    const fwd = this._forwardVec();
    const { right, up } = this._basisFromDir(fwd);
    const sideSign = Math.random() < 0.5 ? 1 : -1;
    const start = fwd.clone().multiplyScalar(40)
      .addScaledVector(right, sideSign * 25)
      .addScaledVector(up, 18);
    const fall = new THREE.Vector3(sideSign * -0.4, -1, -0.3).normalize();
    ls.outer.position.copy(start);
    ls.outer.lookAt(start.clone().add(fall));
    ls.inner.rotation.set(0, Math.PI, 0);
    ls.velocity.copy(fall).multiplyScalar(45);
    ls.life = 0; ls.maxLife = 5.5; ls.active = true; ls.outer.visible = true;
    ls.scenario = 'crash_dive'; ls.scenarioTime = 0;
    ls.scenarioBase = { smokeT: 0 };
    if (!this._followDisabled && !this.focused) this._scenarioFollow = { ships: [ls] };
    if (this._flashHint) this._flashHint('spawned: crash dive', 'info');
  },

  // ----- 5. FLEET JUMP-IN — 6 ships warp in with blue flashes -----
  _spawnFleetJumpIn(){
    const fwd = this._forwardVec();
    const { right, up } = this._basisFromDir(fwd);
    const dir = fwd.clone().multiplyScalar(-1).addScaledVector(right, 0.20).normalize();
    const formCenter = fwd.clone().multiplyScalar(70).addScaledVector(up, 5);
    // Covenant fleet incursion — all banshees so the alien-fleet read is consistent.
    const types = ['banshee', 'banshee', 'banshee', 'banshee', 'banshee', 'banshee'];
    const ships = [];
    types.forEach((type, i) => {
      const s = this._acquireShip(type, { forceMint: i > 0 });
      if (!s) return;
      const ring = i === 0 ? 0 : 1;
      const ang = (i / types.length) * Math.PI * 2;
      const slot = formCenter.clone()
        .addScaledVector(right, Math.cos(ang) * 8 * ring)
        .addScaledVector(up,    Math.sin(ang) * 5 * ring);
      s.outer.position.copy(slot);
      s.outer.lookAt(slot.clone().add(dir));
      s.inner.rotation.set(0, Math.PI, 0);
      s.velocity.set(0, 0, 0);
      s.life = 0; s.maxLife = 14; s.active = true; s.outer.visible = false;
      s.scenario = 'fleet_jumpin'; s.scenarioTime = 0;
      const tex = this._makeSatLightTexture();
      const flash = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, color: 0x66c0ff, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
      }));
      flash.scale.set(0.5, 0.5, 1);
      flash.position.copy(slot);
      this.scene.add(flash);
      s.scenarioBase = { dir: dir.clone(), speed: 55, jumpAt: i * 0.35, jumped: false, flash };
      s.scenarioCleanup = () => {
        if (flash.parent) flash.parent.remove(flash);
        if (flash.material.map) flash.material.map.dispose();
        flash.material.dispose();
      };
      ships.push(s);
    });
    if (!this._followDisabled && !this.focused) this._scenarioFollow = { ships };
    if (this._flashHint) this._flashHint('spawned: fleet jump-in', 'info');
  },

  // ----- 6. DERELICT DRIFT — dead pelican tumbling, sparks -----
  _spawnDerelictDrift(){
    const p = this._acquireShip('pelican');
    if (!p) return;
    const fwd = this._forwardVec();
    const { right, up } = this._basisFromDir(fwd);
    const sideSign = Math.random() < 0.5 ? 1 : -1;
    const dir = right.clone().multiplyScalar(sideSign).addScaledVector(up, -0.05).normalize();
    const start = fwd.clone().multiplyScalar(40).addScaledVector(dir, -90).addScaledVector(up, 3);
    p.outer.position.copy(start);
    p.outer.lookAt(start.clone().add(dir));
    p.inner.rotation.set(0, Math.PI, 0);
    p.velocity.copy(dir).multiplyScalar(8);
    p.life = 0; p.maxLife = (180 / 8) + 1.5;
    p.active = true; p.outer.visible = true;
    p.scenario = 'derelict_drift'; p.scenarioTime = 0;
    p.scenarioBase = {
      tumble: new THREE.Vector3(Math.random()*2-1, Math.random()*2-1, Math.random()*2-1).normalize().multiplyScalar(0.4),
      sparkAt: 0,
    };
    if (!this._followDisabled && !this.focused) this._scenarioFollow = { ships: [p] };
    if (this._flashHint) this._flashHint('spawned: derelict drift', 'info');
  },

  // ----- 7. INTERCEPTION — Covenant pursuit: 1 lead banshee + 2 chasers -----
  _spawnInterception(){
    const lead    = this._acquireShip('banshee');
    const chase1  = this._acquireShip('banshee', { forceMint: true });
    const chase2  = this._acquireShip('banshee', { forceMint: true });
    if (!lead || !chase1 || !chase2) return;
    const fwd = this._forwardVec();
    const { right, up } = this._basisFromDir(fwd);
    const sideSign = Math.random() < 0.5 ? 1 : -1;
    const dir = right.clone().multiplyScalar(sideSign).normalize();
    // True perpendicular for lateral spread (perp to both travel-dir and up).
    const perp = new THREE.Vector3().crossVectors(dir, up).normalize();
    const start = fwd.clone().multiplyScalar(35).addScaledVector(dir, -75).addScaledVector(up, 2);
    lead.outer.position.copy(start);
    lead.outer.lookAt(start.clone().add(dir));
    lead.inner.rotation.set(0, Math.PI, 0);
    lead.velocity.copy(dir).multiplyScalar(48);
    lead.life = 0; lead.maxLife = 14; lead.active = true; lead.outer.visible = true;
    lead.scenario = 'interception_target'; lead.scenarioTime = 0;
    lead.scenarioBase = { dir: dir.clone(), perp1: up.clone(), perp2: perp.clone(), speed: 48, seedA: Math.random()*6.28, seedB: Math.random()*6.28 };
    // Chasers: properly spread BEHIND + LATERAL + VERTICAL so they read as 3
    // distinct ships, not a single blob.
    [chase1, chase2].forEach((c, i) => {
      const slot = start.clone()
        .addScaledVector(dir,  -32 - i * 8)        // 32u + 40u behind
        .addScaledVector(perp, (i ? -10 : 10))     // ±10u lateral
        .addScaledVector(up,   (i ? -4 : 4));      // ±4u vertical
      c.outer.position.copy(slot);
      c.outer.lookAt(slot.clone().add(dir));
      c.inner.rotation.set(0, Math.PI, 0);
      c.velocity.copy(dir).multiplyScalar(60);
      c.life = 0; c.maxLife = 14; c.active = true; c.outer.visible = true;
      c.scenario = 'interception_chaser'; c.scenarioTime = 0;
      c.scenarioTargetRef = lead;
      c.scenarioBase = { perp1: up.clone(), perp2: perp.clone(), speed: 60, fireCooldown: 1.0 + i * 0.4, seedA: Math.random()*6.28 };
    });
    if (!this._followDisabled && !this.focused) this._scenarioFollow = { ships: [lead, chase1, chase2] };
    if (this._flashHint) this._flashHint('spawned: interception', 'info');
  },

  // ----- 8. DISTRESS BEACON — pelican parked, blinking SOS -----
  _spawnDistressBeacon(){
    const p = this._acquireShip('pelican');
    if (!p) return;
    const center = this._scenarioAnchor();
    const fwd = this._forwardVec();
    const { right, up } = this._basisFromDir(fwd);
    const pos = center.clone()
      .addScaledVector(right, (Math.random() < 0.5 ? -1 : 1) * 8)
      .addScaledVector(up, -1);
    p.outer.position.copy(pos);
    p.outer.lookAt(pos.clone().add(fwd));
    p.inner.rotation.set(0, Math.PI, 0);
    p.velocity.set(0, 0, 0);
    p.life = 0; p.maxLife = 14; p.active = true; p.outer.visible = true;
    p.scenario = 'distress_beacon'; p.scenarioTime = 0;
    const tex = this._makeSatLightTexture();
    const beacon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, color: 0xff3a48, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
    }));
    beacon.scale.set(2.4, 2.4, 1);
    beacon.position.set(0, 1.4, 0);
    p.outer.add(beacon);
    p.scenarioBase = { beacon, drift: pos.clone() };
    p.scenarioCleanup = () => {
      if (beacon.parent) beacon.parent.remove(beacon);
      if (beacon.material.map) beacon.material.map.dispose();
      beacon.material.dispose();
    };
    if (!this._followDisabled && !this.focused) this._scenarioFollow = { ships: [p] };
    if (this._flashHint) this._flashHint('spawned: distress beacon', 'info');
  },

  // ----- 9. DEBRIS FIELD CROSS — ship weaves through 30 shards -----
  _spawnDebrisCross(){
    const ls = this._acquireShip('longsword');
    if (!ls) return;
    const fwd = this._forwardVec();
    const { right, up } = this._basisFromDir(fwd);
    const sideSign = Math.random() < 0.5 ? 1 : -1;
    const dir = right.clone().multiplyScalar(sideSign).normalize();
    const center = fwd.clone().multiplyScalar(45);
    const start = center.clone().addScaledVector(dir, -90);
    ls.outer.position.copy(start);
    ls.outer.lookAt(start.clone().add(dir));
    ls.inner.rotation.set(0, Math.PI, 0);
    ls.velocity.copy(dir).multiplyScalar(48);
    ls.life = 0; ls.maxLife = 8.0; ls.active = true; ls.outer.visible = true;
    ls.scenario = 'debris_cross'; ls.scenarioTime = 0;

    const shardGroup = new THREE.Group();
    this.scene.add(shardGroup);
    const shardMat = new THREE.MeshBasicMaterial({ color: 0x556068 });
    const geos = [
      new THREE.IcosahedronGeometry(0.4, 0),
      new THREE.OctahedronGeometry(0.5, 0),
      new THREE.TetrahedronGeometry(0.45, 0),
    ];
    const shards = [];
    for (let i = 0; i < 30; i++) {
      const m = new THREE.Mesh(geos[i % geos.length], shardMat);
      m.position.copy(center).add(new THREE.Vector3(
        (Math.random()-0.5) * 80,
        (Math.random()-0.5) * 28,
        (Math.random()-0.5) * 80,
      ));
      m.userData.spin = new THREE.Vector3(Math.random()*2-1, Math.random()*2-1, Math.random()*2-1).normalize().multiplyScalar(0.6);
      m.userData.drift = new THREE.Vector3((Math.random()-0.5)*1.5, (Math.random()-0.5)*0.8, (Math.random()-0.5)*1.5);
      shardGroup.add(m);
      shards.push(m);
    }
    ls.scenarioBase = { dir: dir.clone(), perp1: up.clone(), seedA: Math.random()*6.28, shardGroup, shards };
    ls.scenarioCleanup = () => {
      geos.forEach(g => g.dispose());
      shardMat.dispose();
      if (shardGroup.parent) shardGroup.parent.remove(shardGroup);
    };
    if (!this._followDisabled && !this.focused) this._scenarioFollow = { ships: [ls] };
    if (this._flashHint) this._flashHint('spawned: debris field cross', 'info');
  },

  // ----- 10. SCANNER SWEEP — forerunner orbits target with green raycone -----
  _spawnScannerSweep(){
    const f = this._acquireShip('forerunner');
    if (!f) return;
    const center = this._scenarioAnchor();
    const radius = this.focused ? 9 : 18;
    f.outer.position.copy(center).add(new THREE.Vector3(radius, 1, 0));
    f.inner.rotation.set(0, Math.PI, 0);
    f.velocity.set(0, 0, 0);
    f.life = 0; f.maxLife = 16; f.active = true; f.outer.visible = true;
    f.scenario = 'scanner_sweep'; f.scenarioTime = 0;
    const coneGeo = new THREE.ConeGeometry(2.2, radius, 16, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0x55ff90, transparent: true, opacity: 0.18,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.rotation.x = -Math.PI / 2;
    cone.position.z = -radius / 2;
    f.outer.add(cone);
    f.scenarioBase = { center, radius, axis: new THREE.Vector3(0.1, 0.95, 0.1).normalize(), speed: 0.45, phase: Math.random()*6.28, cone, coneMat, coneGeo };
    f.scenarioCleanup = () => {
      if (cone.parent) cone.parent.remove(cone);
      coneGeo.dispose(); coneMat.dispose();
    };
    if (!this._followDisabled && !this.focused) this._scenarioFollow = { ships: [f] };
    if (this._flashHint) this._flashHint('spawned: scanner sweep', 'info');
  },

  // ----- 11. EMERGENCY LANDING — pelican wobbles + decelerates -----
  _spawnEmergencyLanding(){
    const p = this._acquireShip('pelican');
    if (!p) return;
    const target = this._scenarioAnchor();
    const fwd = this._forwardVec();
    const { right, up } = this._basisFromDir(fwd);
    const sideSign = Math.random() < 0.5 ? 1 : -1;
    const dir = right.clone().multiplyScalar(sideSign).addScaledVector(up, -0.06).normalize();
    const start = target.clone().addScaledVector(dir, -55).addScaledVector(up, 8);
    const restPos = target.clone().addScaledVector(right, sideSign * 6).addScaledVector(up, -1);
    p.outer.position.copy(start);
    p.outer.lookAt(start.clone().add(dir));
    p.inner.rotation.set(0, Math.PI, 0);
    p.velocity.copy(dir).multiplyScalar(28);
    p.life = 0; p.maxLife = 12; p.active = true; p.outer.visible = true;
    p.scenario = 'emergency_landing'; p.scenarioTime = 0;
    p.scenarioBase = { dir: dir.clone(), startPos: start.clone(), restPos, perp1: up.clone() };
    if (!this._followDisabled && !this.focused) this._scenarioFollow = { ships: [p] };
    if (this._flashHint) this._flashHint('spawned: emergency landing', 'info');
  },

  // ----- 12. GHOST CONTACT — ephemeral cruiser phases in/out at distance -----
  _spawnGhostContact(){
    const grp = new THREE.Group();
    const hullMat = new THREE.MeshBasicMaterial({
      color: 0x3a2860, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const accentMat = new THREE.MeshBasicMaterial({
      color: 0x6244aa, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    grp.add(new THREE.Mesh(new THREE.BoxGeometry(40, 4, 8), hullMat));
    for (let i = 0; i < 3; i++) {
      const pod = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 6), hullMat);
      pod.position.set(-12 + i * 12, -3, 0);
      grp.add(pod);
    }
    const tower = new THREE.Mesh(new THREE.BoxGeometry(5, 6, 5), accentMat);
    tower.position.set(8, 5, 0);
    grp.add(tower);

    const fwd = this._forwardVec();
    const { right, up } = this._basisFromDir(fwd);
    // Avoid landing on top of the marathon ship landmark — pick the camera-
    // right side that's furthest from it.
    const marathonPos = this.marathonShip
      ? this.marathonShip.grp.position
      : new THREE.Vector3(-340, 36, -120);
    const side = marathonPos.clone().normalize().dot(right) > 0 ? -1 : 1;
    grp.position.copy(fwd.clone().multiplyScalar(280))
      .addScaledVector(right, side * 80)
      .addScaledVector(up, 35);
    grp.rotation.y = Math.PI * 0.18 * -side;
    this.scene.add(grp);

    const fake = {
      type: 'ghost_ship',
      outer: grp, inner: grp,
      active: true, _ephemeral: true,
      velocity: new THREE.Vector3(),
      rollPhase: 0, life: 0, maxLife: 18,
      scenario: 'ghost_contact', scenarioTime: 0,
      scenarioBase: { mats: [hullMat, accentMat] },
      scenarioCleanup: null,
    };
    this.flybyShips.push(fake);
    if (this._flashHint) this._flashHint('spawned: ghost contact', 'info');
  },

  // ----- 13. CARRIER LAUNCH — 3 longswords ripple-launch, tight V -----
  _spawnCarrierLaunch(){
    const fwd = this._forwardVec();
    const { right, up } = this._basisFromDir(fwd);
    const sideSign = Math.random() < 0.5 ? 1 : -1;
    const dir = fwd.clone()
      .addScaledVector(right, sideSign * 0.18)
      .addScaledVector(up, 0.10).normalize();
    const launchAnchor = fwd.clone().multiplyScalar(20)
      .addScaledVector(right, -sideSign * 35)
      .addScaledVector(up, -2);
    const speed = 90;
    const ships = [];
    for (let i = 0; i < 3; i++) {
      const ls = this._acquireShip('longsword', { forceMint: i > 0 });
      if (!ls) continue;
      ls.outer.position.copy(launchAnchor);
      ls.outer.lookAt(launchAnchor.clone().add(dir));
      ls.inner.rotation.set(0, Math.PI, 0);
      ls.velocity.set(0, 0, 0);
      ls.life = 0; ls.maxLife = 8 + i * 0.6;
      ls.active = true; ls.outer.visible = false;
      ls.scenario = 'carrier_launch'; ls.scenarioTime = 0;
      ls.scenarioBase = {
        dir: dir.clone(),
        launchAt: i * 0.55,
        slotOffset: new THREE.Vector3(
          (i === 0 ? 0 : (i === 1 ? 4 : -4)),
          0,
          (i === 0 ? 0 : -3),
        ),
        perp1: right.clone(), perp2: up.clone(),
        speed, launched: false,
      };
      ships.push(ls);
    }
    if (!this._followDisabled && !this.focused) this._scenarioFollow = { ships };
    if (this._flashHint) this._flashHint('spawned: carrier launch', 'info');
  },

  // ----- 14. ESCORT RUN — pelican + 2 longsword wingmen tight V -----
  _spawnEscortRun(){
    const p = this._acquireShip('pelican');
    const ls1 = this._acquireShip('longsword');
    const ls2 = this._acquireShip('longsword', { forceMint: true });
    if (!p || !ls1 || !ls2) return;
    const fwd = this._forwardVec();
    const { right, up } = this._basisFromDir(fwd);
    const sideSign = Math.random() < 0.5 ? 1 : -1;
    const dir = right.clone().multiplyScalar(sideSign).normalize();
    const speed = 38;
    const formCenter = fwd.clone().multiplyScalar(35).addScaledVector(dir, -90);
    const setup = (s, slot) => {
      const start = formCenter.clone().addScaledVector(right, slot.x).addScaledVector(up, slot.y);
      s.outer.position.copy(start);
      s.outer.lookAt(start.clone().add(dir));
      s.inner.rotation.set(0, Math.PI, 0);
      s.velocity.copy(dir).multiplyScalar(speed);
      s.life = 0; s.maxLife = (220 / speed) + 1.5;
      s.active = true; s.outer.visible = true;
      s.scenario = 'escort_run'; s.scenarioTime = 0;
      s.scenarioBase = { dir: dir.clone(), perp1: up.clone(), speed };
    };
    setup(p,   { x:  0, y: 0 });
    setup(ls1, { x: -8, y: 2 });
    setup(ls2, { x: -8, y: -2 });
    p.hatchAngle = 0; p.hatchTarget = 0;
    if (!this._followDisabled && !this.focused) this._scenarioFollow = { ships: [p, ls1, ls2] };
    if (this._flashHint) this._flashHint('spawned: escort run', 'info');
  },

  // ----- 15. SILENT OBSERVER — forerunner materializes near camera, holds -----
  _spawnSilentObserver(){
    const f = this._acquireShip('forerunner');
    if (!f) return;
    const fwd = this._forwardVec();
    const { right, up } = this._basisFromDir(fwd);
    // b183: pushed forward distance 28 → 65 — the forerunner orb (radius
    // 2.6u rings) was reading way too close to camera at 28u, dominating
    // the frame. 65u keeps it as a "distant observer" silhouette.
    const pos = fwd.clone().multiplyScalar(65)
      .addScaledVector(right, (Math.random() < 0.5 ? -1 : 1) * 12)
      .addScaledVector(up, 4);
    f.outer.position.copy(pos);
    f.outer.scale.setScalar(0.01);
    f.outer.lookAt(pos.clone().addScaledVector(fwd, -1));
    f.inner.rotation.set(0, Math.PI, 0);
    f.velocity.set(0, 0, 0);
    f.life = 0; f.maxLife = 10; f.active = true; f.outer.visible = true;
    f.scenario = 'silent_observer'; f.scenarioTime = 0;
    f.scenarioBase = {};
    f.scenarioCleanup = () => { f.outer.scale.setScalar(1); };
    if (!this._followDisabled) this._scenarioFollow = { ships: [f] };
    if (this._flashHint) this._flashHint('spawned: silent observer', 'info');
  },

  _tickScenario(s, t, dt){
    if (!s.scenario) return;

    // ---- LONGSWORD STRAFING RUN ----
    if (s.scenario === 'strafe_run' && s.type === 'longsword') {
      const tt   = s.scenarioTime;
      const base = s.scenarioBase;
      // Mild S-curve so the V doesn't fly perfectly straight
      const baseVel = base.dir.clone().multiplyScalar(base.speed);
      const lateral = base.perp1.clone().multiplyScalar(Math.cos(tt * 1.4 + base.leadIndex) * 8);
      s.velocity.lerp(baseVel.add(lateral), Math.min(1, dt * 2.5));
      const fwd = s.velocity.clone().normalize();
      s.outer.lookAt(s.outer.position.clone().add(fwd));
      // Banking roll proportional to lateral
      const lateralComp = s.velocity.clone().sub(base.dir.clone().multiplyScalar(base.speed)).dot(base.perp1) / base.speed;
      s.inner.rotation.x = 0;
      s.inner.rotation.y = Math.PI;
      s.inner.rotation.z = -lateralComp * 0.7 + Math.sin(s.rollPhase * 0.8) * 0.10;

      // Fire bolts toward target during the close-pass window.
      base.fireCooldown -= dt;
      if (base.fireCooldown <= 0 && tt > 0.3 && tt < 4.0) {
        const muzzle = new THREE.Vector3();
        s.outer.getWorldPosition(muzzle);
        muzzle.addScaledVector(s.velocity.clone().normalize(), 1.0);
        const aim = base.target.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 3,
        ));
        this._fireBolt(muzzle, aim, 0x66ddff, {
          speed: 130, spread: 0.04, life: 0.9, scale: 0.75, opacity: 1.0,
        });
        base.fireCooldown = 0.22 + Math.random() * 0.14;
      }
      return;
    }

    // ---- FORERUNNER ORBIT ----
    if (s.scenario === 'forerunner_orbit' && s.type === 'forerunner') {
      const base = s.scenarioBase;
      const ang  = s.scenarioTime * base.speed + base.phase;
      // Build a basis perpendicular to orbit axis
      const helper = Math.abs(base.axis.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const a = new THREE.Vector3().crossVectors(base.axis, helper).normalize();
      const b = new THREE.Vector3().crossVectors(base.axis, a).normalize();
      const prev = s.outer.position.clone();
      const next = base.center.clone()
        .addScaledVector(a, Math.cos(ang) * base.radius)
        .addScaledVector(b, Math.sin(ang) * base.radius);
      s.outer.position.copy(next);
      // Tangent velocity (for lookAt orientation + future hook ups)
      const tangent = next.clone().sub(prev);
      if (tangent.lengthSq() > 0.0001) {
        s.outer.lookAt(next.clone().add(tangent.normalize()));
        s.velocity.copy(tangent).divideScalar(Math.max(dt, 0.001));
      }
      // Self-rotation on inner rings (preserves forerunner serene tumble)
      s.inner.rotation.x = s.scenarioTime * 0.30;
      s.inner.rotation.y = Math.PI + s.scenarioTime * 0.22;
      s.inner.rotation.z = s.scenarioTime * 0.16;
      if (s.rings) {
        s.rings.forEach((r, i) => {
          r.mesh.rotation.x += dt * (0.6 + i * 0.25);
          r.mesh.rotation.y += dt * (0.4 + i * 0.18) * (i % 2 ? -1 : 1);
          r.mat.uniforms.uTime.value = t;
        });
      }
      if (s.orbMat) s.orbMat.uniforms.uTime.value = t;
      return;
    }

    if (s.scenario === 'combat_target' && s.type === 'pelican') {
      const tt   = s.scenarioTime;
      const base = s.scenarioBase;

      // ---- Hatch / Spartan firing logic (unchanged behavior) ----
      if (tt < 1.5)        s.hatchTarget = 0;
      else if (tt < 9.0) { s.hatchTarget = Math.PI * 0.55; s.cargo.visible = true; }
      else                 s.hatchTarget = 0;
      s.hatchAngle += (s.hatchTarget - s.hatchAngle) * Math.min(1, dt * 3);
      s.hatchPivot.rotation.x = s.hatchAngle;
      if (s.hatchAngle < 0.05 && s.hatchTarget < 0.05) s.cargo.visible = false;

      const open = s.hatchAngle > 0.6;
      if (open) {
        s.muzzleFlashes.forEach((mf, i) => {
          const period = 0.32 + i * 0.07;
          const phaseT = (tt + i * 0.13) % period;
          const flash  = phaseT < 0.05;
          mf.material.opacity = flash ? 1.0 : Math.max(0, mf.material.opacity - dt * 14);
          if (flash && Math.random() < 0.55) {
            const muzzleWorld = new THREE.Vector3();
            mf.getWorldPosition(muzzleWorld);
            const rear = s.velocity.clone().normalize().multiplyScalar(-1);
            const target = muzzleWorld.clone().add(rear.multiplyScalar(80));
            this._fireBolt(muzzleWorld, target, 0xffe060, {
              speed: 110, spread: 0.06, life: 0.7, scale: 0.55, opacity: 0.95,
            });
          }
        });
      } else {
        s.muzzleFlashes.forEach(mf => {
          mf.material.opacity = Math.max(0, mf.material.opacity - dt * 14);
        });
      }

      // ---- EVASIVE S-CURVE STEERING (side-thruster swerves) ----
      // Pelican has lateral RCS thrusters → punchy side jukes, not just a
      // lazy sine wave. Layer two frequencies on perp1 + a slower vert wave,
      // plus a stochastic "thrust burst" every ~0.9s that yanks the pelican
      // sideways for ~0.25s.
      const lateralAmp  = base.lateralAmp  ?? 46;
      const verticalAmp = base.verticalAmp ?? 18;
      const rcsAmp      = base.rcsAmp      ?? 32;
      const baseVel = base.dir.clone().multiplyScalar(base.speed);
      const lateral = base.perp1.clone().multiplyScalar(
        Math.cos(tt * 0.95 + base.seedA) * lateralAmp * 0.6 +
        Math.cos(tt * 1.85 + base.seedA * 1.7) * lateralAmp * 0.4
      );
      const vert = base.perp2.clone().multiplyScalar(Math.cos(tt * 0.55 + base.seedB) * verticalAmp);

      // RCS thruster bursts: at random intervals, fire a hard sideways juke.
      if (s.thrusterUntil == null || tt > s.thrusterUntil) {
        s.thrusterDir = (Math.random() < 0.5 ? 1 : -1);
        s.thrusterUntil = tt + 0.18 + Math.random() * 0.10;
        s.thrusterNext = (s.thrusterUntil || 0) + 0.50 + Math.random() * 0.55;
      } else if (tt < (s.thrusterNext || 0) && tt > s.thrusterUntil) {
        // brief lull, no thrust
      }
      const thrustOn = (tt < s.thrusterUntil) ? 1 : 0;
      const thrust = base.perp1.clone().multiplyScalar((s.thrusterDir || 1) * rcsAmp * thrustOn);

      // Panic juke window when banshee is closing the kill (8.5–10s).
      const jukeWindow = (tt > 8.5 && tt < 10.0) ? Math.sin((tt - 8.5) * 4.0) * 22 : 0;
      const juke = base.perp1.clone().multiplyScalar(jukeWindow);

      const desiredVel = baseVel.add(lateral).add(vert).add(thrust).add(juke);
      // Faster steering response — RCS thrusters react quickly even on a heavy ship.
      s.velocity.lerp(desiredVel, Math.min(1, dt * 3.2));

      // Reorient toward velocity so the airframe banks into its steering.
      const fwd = s.velocity.clone().normalize();
      s.outer.lookAt(s.outer.position.clone().add(fwd));

      // Banking proportional to lateral velocity — punchier coefficient.
      const lateralComp = s.velocity.clone().sub(baseVel).dot(base.perp1) / base.speed;
      const verticalComp = s.velocity.clone().sub(baseVel).dot(base.perp2) / base.speed;
      s.inner.rotation.x = -verticalComp * 0.45 + Math.sin(s.rollPhase * 0.4) * 0.04;
      s.inner.rotation.y = Math.PI;
      s.inner.rotation.z = -lateralComp * 0.85 + Math.sin(s.rollPhase * 0.5) * 0.03;
      return;
    }

    if (s.scenario === 'combat_chaser' && s.type === 'banshee') {
      const tt   = s.scenarioTime;
      const base = s.scenarioBase;
      const target = s.scenarioTargetRef;

      // ---- PURSUIT STEERING ----
      // Lead-pursuit: aim 0.4s ahead of where the pelican is going. Add a
      // weave perpendicular to the chase vector so the banshee snakes
      // side-to-side instead of flying a clean intercept.
      if (target && target.active) {
        const targetPos = new THREE.Vector3();
        target.outer.getWorldPosition(targetPos);
        targetPos.addScaledVector(target.velocity, 0.40);  // lead

        const banPos = s.outer.position;
        const toTarget = targetPos.clone().sub(banPos);
        const dist = toTarget.length();
        toTarget.normalize();

        // Weave: perpendicular oscillation that grows when far from target,
        // shrinks when close (so the banshee actually closes the kill).
        const closeness = Math.min(1, dist / 60);
        const weaveAmp1 = 0.45 * closeness;
        const weaveAmp2 = 0.28 * closeness;
        const weave = base.perp1.clone().multiplyScalar(Math.sin(tt * 1.6 + base.seedA) * weaveAmp1)
                .add(base.perp2.clone().multiplyScalar(Math.sin(tt * 1.1 + base.seedB) * weaveAmp2));

        const desiredDir = toTarget.add(weave).normalize();
        const desiredVel = desiredDir.multiplyScalar(base.speed);
        // Banshee is agile — fast steering response
        s.velocity.lerp(desiredVel, Math.min(1, dt * 3.0));
      }

      // Reorient toward velocity for proper bank/yaw
      const fwd = s.velocity.clone().normalize();
      s.outer.lookAt(s.outer.position.clone().add(fwd));

      // Inner: continuous barrel roll preserved (signature banshee motion).
      // Pitch wobble layered on top.
      s.inner.rotation.x = Math.sin(s.rollPhase * 0.7) * 0.20;
      s.inner.rotation.y = Math.PI;
      s.inner.rotation.z += dt * 4.0;

      // ---- Plasma fire — mode-aware (laser burst vs. plasma missile) ----
      if (target && target.active) {
        s.fireCooldown -= dt;
        if (s.fireCooldown <= 0 && tt > 1.8 && tt < 9.5) {
          const banPos = new THREE.Vector3();
          s.outer.getWorldPosition(banPos);
          const fwdN = s.velocity.clone().normalize();
          const muzzlePos = banPos.clone().add(fwdN.multiplyScalar(1.5));
          const targetPos = new THREE.Vector3();
          target.outer.getWorldPosition(targetPos);

          if (s.weaponMode === 'missile') {
            // Single green plasma ball — small, slower travel, longer life
            targetPos.x += (Math.random() - 0.5) * 4;
            targetPos.y += (Math.random() - 0.5) * 3;
            this._fireBolt(muzzlePos, targetPos, 0x55ff66, {
              speed: 65, spread: 0.03, life: 1.8, scale: 0.95, opacity: 1.0,
            });
            s.fireCooldown = 1.4 + Math.random() * 0.6;
          } else {
            // Blue laser burst — 3–4 small fast tracers, tight grouping
            targetPos.x += (Math.random() - 0.5) * 6;
            targetPos.y += (Math.random() - 0.5) * 4;
            const burstCount = 3 + Math.floor(Math.random() * 2);
            for (let k = 0; k < burstCount; k++) {
              this._fireBolt(muzzlePos, targetPos, 0x66ddff, {
                speed: 135, spread: 0.05, life: 0.7, scale: 0.45, opacity: 1.0,
              });
            }
            s.fireCooldown = 0.30 + Math.random() * 0.20;
          }
        }
      }
      return;
    }

    // ============================================================
    // b177 — extra scripted scenarios (tick branches)
    // ============================================================

    if (s.scenario === 'slipspace_jump') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      const k = Math.min(1, tt / 0.7);
      const speed = 60 + (1 - Math.cos(k * Math.PI)) * 270;
      s.velocity.copy(base.dir).multiplyScalar(speed);
      const nose = s.outer.position.clone().addScaledVector(base.dir, 6);
      base.tear.position.copy(nose);
      const tlf = Math.min(1, tt / 1.4);
      const env = (tlf < 0.5 ? tlf * 2 : (1 - (tlf - 0.5) * 2));
      const scale = env * 14;
      base.tear.scale.set(scale, Math.max(0.5, scale * 0.18), 1);
      base.tear.material.opacity = Math.max(0, env);
      return;
    }

    if (s.scenario === 'mothership_reveal') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      const fadeIn  = Math.min(1, tt / 4);
      const fadeOut = Math.min(1, Math.max(0, (s.maxLife - tt) / 4));
      const op = Math.min(fadeIn, fadeOut);
      base.hullMats.forEach(m => m.opacity = op * 0.95);
      base.lightMat.opacity = op * 0.9;
      base.glow.material.opacity = op * 0.85;
      s.outer.rotation.y += dt * 0.012;
      return;
    }

    if (s.scenario === 'convoy' && s.type === 'pelican') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      const baseVel = base.dir.clone().multiplyScalar(base.speed);
      const bob = base.perp1.clone().multiplyScalar(Math.sin(tt * 0.7 + base.idx * 1.2) * 0.6);
      s.velocity.lerp(baseVel.add(bob), Math.min(1, dt * 2));
      const fwd = s.velocity.clone().normalize();
      s.outer.lookAt(s.outer.position.clone().add(fwd));
      s.hatchAngle = 0.55; s.hatchTarget = 0.55;
      if (s.hatchPivot) s.hatchPivot.rotation.x = 0.55;
      if (s.cargo) s.cargo.visible = true;
      return;
    }

    if (s.scenario === 'crash_dive' && s.type === 'longsword') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      s.velocity.y -= dt * 12;
      s.velocity.multiplyScalar(1 + dt * 0.15);
      const fwd = s.velocity.clone().normalize();
      s.outer.lookAt(s.outer.position.clone().add(fwd));
      s.inner.rotation.z += dt * 4 + tt * 0.3;
      base.smokeT -= dt;
      if (base.smokeT <= 0) {
        const muzzle = s.outer.position.clone();
        this._fireBolt(muzzle, muzzle.clone().addScaledVector(s.velocity.clone().normalize(), -12), 0xff8a3a, {
          speed: 6, spread: 0.3, life: 1.4, scale: 1.2, opacity: 0.55,
        });
        base.smokeT = 0.06;
      }
      return;
    }

    if (s.scenario === 'fleet_jumpin') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      if (!base.jumped && tt >= base.jumpAt) {
        base.jumped = true;
        s.outer.visible = true;
        s.velocity.copy(base.dir).multiplyScalar(base.speed);
      }
      const flashLF = (tt - base.jumpAt) / 0.6;
      if (flashLF >= 0 && flashLF <= 1) {
        base.flash.position.copy(s.outer.position);
        const a = flashLF < 0.25 ? flashLF * 4 : (1 - (flashLF - 0.25) / 0.75);
        base.flash.scale.setScalar(2 + flashLF * 6);
        base.flash.material.opacity = Math.max(0, a) * 0.95;
      } else {
        base.flash.material.opacity = 0;
      }
      return;
    }

    if (s.scenario === 'derelict_drift' && s.type === 'pelican') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      s.outer.rotation.x += base.tumble.x * dt;
      s.outer.rotation.y += base.tumble.y * dt;
      s.outer.rotation.z += base.tumble.z * dt;
      base.sparkAt -= dt;
      if (base.sparkAt <= 0) {
        const wp = new THREE.Vector3(); s.outer.getWorldPosition(wp);
        wp.x += (Math.random()-0.5) * 1.5;
        wp.y += (Math.random()-0.5) * 1.5;
        wp.z += (Math.random()-0.5) * 1.5;
        for (let k = 0; k < 4; k++) {
          this._fireBolt(wp, wp.clone().add(new THREE.Vector3(
            (Math.random()-0.5)*4, (Math.random()-0.5)*4, (Math.random()-0.5)*4)),
            0xffa040, { speed: 10, spread: 0.3, life: 0.6, scale: 0.4, opacity: 0.8 });
        }
        base.sparkAt = 0.7 + Math.random() * 0.9;
      }
      return;
    }

    if (s.scenario === 'interception_target' && s.type === 'banshee') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      const baseVel = base.dir.clone().multiplyScalar(base.speed);
      const lateral = base.perp1.clone().multiplyScalar(Math.sin(tt * 1.4 + base.seedA) * 14);
      const vert = base.perp2.clone().multiplyScalar(Math.cos(tt * 1.0 + base.seedB) * 6);
      s.velocity.lerp(baseVel.add(lateral).add(vert), Math.min(1, dt * 2.5));
      const fwd = s.velocity.clone().normalize();
      s.outer.lookAt(s.outer.position.clone().add(fwd));
      s.inner.rotation.z += dt * 4;
      return;
    }

    // Chaser tick — type-agnostic so banshee chasers (b188) work alongside the
    // original longsword chasers if you ever switch back. Bolt color matches
    // the ship type: cyan UNSC laser for longsword, magenta plasma for banshee.
    if (s.scenario === 'interception_chaser') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      const target = s.scenarioTargetRef;
      if (target && target.active) {
        const tp = new THREE.Vector3(); target.outer.getWorldPosition(tp);
        tp.addScaledVector(target.velocity, 0.35);
        const toT = tp.clone().sub(s.outer.position).normalize();
        const desiredVel = toT.multiplyScalar(base.speed);
        s.velocity.lerp(desiredVel, Math.min(1, dt * 2.5));
      }
      const fwdN = s.velocity.clone().normalize();
      s.outer.lookAt(s.outer.position.clone().add(fwdN));
      // Banshees keep their signature continuous barrel roll while chasing.
      if (s.type === 'banshee') {
        s.inner.rotation.x = Math.sin(s.rollPhase * 0.7) * 0.20;
        s.inner.rotation.y = Math.PI;
        s.inner.rotation.z += dt * 4.0;
      }
      base.fireCooldown -= dt;
      if (base.fireCooldown <= 0 && tt > 1.2 && tt < 9 && target && target.active) {
        const muzzle = new THREE.Vector3(); s.outer.getWorldPosition(muzzle);
        muzzle.addScaledVector(s.velocity.clone().normalize(), 1);
        const aim = new THREE.Vector3(); target.outer.getWorldPosition(aim);
        aim.x += (Math.random()-0.5) * 4;
        aim.y += (Math.random()-0.5) * 3;
        const boltColor = (s.type === 'banshee') ? 0xff3ad8 : 0x66ddff;
        this._fireBolt(muzzle, aim, boltColor, { speed: 130, spread: 0.04, life: 0.9, scale: 0.55, opacity: 1.0 });
        base.fireCooldown = 0.32 + Math.random() * 0.18;
      }
      return;
    }

    if (s.scenario === 'distress_beacon' && s.type === 'pelican') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      // SOS-ish blink rhythm (3 short, 1 long, repeating)
      const phase = (tt * 1.4) % 2.4;
      let on = 0;
      if (phase < 0.10) on = 1;
      else if (phase >= 0.30 && phase < 0.40) on = 1;
      else if (phase >= 0.60 && phase < 0.70) on = 1;
      else if (phase >= 1.0  && phase < 1.5)  on = 1;
      base.beacon.material.opacity = on ? 1.0 : 0.05;
      s.outer.position.y = base.drift.y + Math.sin(tt * 0.8) * 0.18;
      return;
    }

    if (s.scenario === 'debris_cross' && s.type === 'longsword') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      const baseVel = base.dir.clone().multiplyScalar(48);
      const weave = base.perp1.clone().multiplyScalar(Math.sin(tt * 1.6 + base.seedA) * 6);
      s.velocity.lerp(baseVel.add(weave), Math.min(1, dt * 2.5));
      const fwd = s.velocity.clone().normalize();
      s.outer.lookAt(s.outer.position.clone().add(fwd));
      base.shards.forEach(m => {
        m.rotation.x += m.userData.spin.x * dt;
        m.rotation.y += m.userData.spin.y * dt;
        m.rotation.z += m.userData.spin.z * dt;
        m.position.addScaledVector(m.userData.drift, dt);
      });
      return;
    }

    if (s.scenario === 'scanner_sweep' && s.type === 'forerunner') {
      const base = s.scenarioBase;
      const ang = s.scenarioTime * base.speed + base.phase;
      const helper = Math.abs(base.axis.y) > 0.95 ? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,1,0);
      const a = new THREE.Vector3().crossVectors(base.axis, helper).normalize();
      const b = new THREE.Vector3().crossVectors(base.axis, a).normalize();
      const next = base.center.clone()
        .addScaledVector(a, Math.cos(ang) * base.radius)
        .addScaledVector(b, Math.sin(ang) * base.radius);
      s.outer.position.copy(next);
      const toCenter = base.center.clone().sub(next).normalize();
      s.outer.lookAt(s.outer.position.clone().add(toCenter));
      base.coneMat.opacity = 0.16 + Math.sin(s.scenarioTime * 6) * 0.12;
      s.inner.rotation.y = Math.PI + s.scenarioTime * 0.4;
      if (s.rings) s.rings.forEach((r, i) => {
        r.mesh.rotation.x += dt * 0.5;
        r.mesh.rotation.y += dt * 0.4 * (i % 2 ? -1 : 1);
        r.mat.uniforms.uTime.value = t;
      });
      if (s.orbMat) s.orbMat.uniforms.uTime.value = t;
      return;
    }

    if (s.scenario === 'emergency_landing' && s.type === 'pelican') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      const total = 11.0;
      const k = Math.min(1, tt / total);
      const eased = 1 - Math.pow(1 - k, 3);
      const pos = base.startPos.clone().lerp(base.restPos, eased);
      pos.addScaledVector(base.perp1, Math.sin(tt * 3.2) * 0.6 * (1 - eased));
      s.outer.position.copy(pos);
      s.velocity.copy(base.dir).multiplyScalar(28 * (1 - eased));
      const fwd = base.dir.clone();
      s.outer.lookAt(s.outer.position.clone().add(fwd));
      if (tt > 4 && Math.random() < 0.15) {
        const wp = new THREE.Vector3(); s.outer.getWorldPosition(wp);
        wp.y -= 1;
        this._fireBolt(wp, wp.clone().add(new THREE.Vector3(0, -3, 0)),
          0x999999, { speed: 3, spread: 0.4, life: 1.4, scale: 1.0, opacity: 0.5 });
      }
      return;
    }

    if (s.scenario === 'ghost_contact') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      const cycle = (Math.sin(tt * 1.2) * 0.5 + 0.5);
      const envelope = Math.min(1, tt / 2) * Math.min(1, (s.maxLife - tt) / 2);
      const op = cycle * envelope * 0.7;
      base.mats.forEach(m => m.opacity = op);
      s.outer.rotation.y += dt * 0.06;
      return;
    }

    if (s.scenario === 'carrier_launch' && s.type === 'longsword') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      if (!base.launched && tt >= base.launchAt) {
        base.launched = true;
        s.outer.visible = true;
        const off = base.perp1.clone().multiplyScalar(base.slotOffset.x)
          .addScaledVector(base.perp2, base.slotOffset.z);
        s.outer.position.add(off);
        s.velocity.copy(base.dir).multiplyScalar(base.speed);
      }
      if (base.launched) {
        const baseVel = base.dir.clone().multiplyScalar(base.speed);
        s.velocity.lerp(baseVel, Math.min(1, dt * 2));
        const fwd = s.velocity.clone().normalize();
        s.outer.lookAt(s.outer.position.clone().add(fwd));
      }
      return;
    }

    if (s.scenario === 'escort_run') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      const baseVel = base.dir.clone().multiplyScalar(base.speed);
      const sway = base.perp1.clone().multiplyScalar(Math.sin(tt * 0.8) * 0.4);
      s.velocity.lerp(baseVel.add(sway), Math.min(1, dt * 2));
      const fwd = s.velocity.clone().normalize();
      s.outer.lookAt(s.outer.position.clone().add(fwd));
      return;
    }

    if (s.scenario === 'silent_observer' && s.type === 'forerunner') {
      const tt = s.scenarioTime;
      let scale;
      if (tt < 1.2)      scale = tt / 1.2;
      else if (tt < 7.0) scale = 1.0;
      else               scale = Math.max(0, 1 - (tt - 7) / 3);
      s.outer.scale.setScalar(scale);
      s.inner.rotation.y = Math.PI + tt * 0.3;
      if (s.rings) s.rings.forEach((r, i) => {
        r.mesh.rotation.x += dt * 0.4;
        r.mesh.rotation.y += dt * 0.3 * (i % 2 ? -1 : 1);
        r.mat.uniforms.uTime.value = t;
      });
      if (s.orbMat) s.orbMat.uniforms.uTime.value = t;
      return;
    }
  },

  _spawnFlyby(){
    // Group free ships by type
    const free = { longsword: [], banshee: [], pelican: [], forerunner: [] };
    this.flybyShips.forEach(s => { if (!s.active) free[s.type].push(s); });

    const weights = { longsword: 0.45, banshee: 0.18, pelican: 0.20, forerunner: 0.17 };
    const available = Object.keys(weights).filter(t => free[t] && free[t].length > 0);
    if (!available.length) return;
    const totalW = available.reduce((sum, t) => sum + weights[t], 0);
    let r = Math.random() * totalW;
    let chosen = available[0];
    for (const t of available) { r -= weights[t]; if (r <= 0) { chosen = t; break; } }

    // SCRIPTED SCENARIO: when a Pelican is chosen and a Banshee is free, 70%
    // of the time we trigger the combat scenario instead of a normal flyby.
    if (chosen === 'pelican' && free.banshee.length > 0 && Math.random() < 0.70) {
      this._spawnPelicanCombat(free.pelican[0], free.banshee[0]);
      return;
    }

    // Group size — only longswords patrol in 2–3
    let groupSize = 1;
    if (chosen === 'longsword' && free.longsword.length >= 2 && Math.random() < 0.45) {
      groupSize = Math.min(free.longsword.length, 2 + Math.floor(Math.random() * 2));
    }

    // Direction + per-type speed
    const u  = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const rr = Math.sqrt(1 - u * u);
    const dir = new THREE.Vector3(Math.cos(th) * rr, u, Math.sin(th) * rr);
    const helper = Math.abs(dir.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const perp = new THREE.Vector3().crossVectors(dir, helper).normalize();
    perp.applyAxisAngle(dir, Math.random() * Math.PI * 2);
    const perp2 = new THREE.Vector3().crossVectors(dir, perp).normalize();

    const speedMap = {
      longsword:  70 + Math.random() * 35,
      banshee:    80 + Math.random() * 40,
      pelican:    42 + Math.random() * 18,
      forerunner: 28 + Math.random() * 14,
    };
    const speed       = speedMap[chosen];
    const spawnRadius = 240 + Math.random() * 80;
    const offset      = 50 + Math.random() * 90;
    const baseStart = new THREE.Vector3()
      .copy(dir).multiplyScalar(-spawnRadius)
      .add(perp.clone().multiplyScalar(offset));

    const slots = [
      { p:  0,    s:  0,   t:  0   },
      { p:  4.5,  s: -2.5, t:  0   },
      { p: -4.5,  s: -2.5, t:  0   },
      { p:  0,    s: -5.0, t:  1.4 },
    ];

    const ships = free[chosen];
    for (let i = 0; i < groupSize; i++) {
      const s = ships[i];
      const slot = slots[i] || slots[0];
      const start = baseStart.clone()
        .add(perp.clone().multiplyScalar(slot.p))
        .add(dir.clone().multiplyScalar(slot.s))
        .add(perp2.clone().multiplyScalar(slot.t));

      s.outer.position.copy(start);
      s.outer.lookAt(start.clone().add(dir));
      s.inner.rotation.set(0, Math.PI, 0);
      s.velocity.copy(dir).multiplyScalar(speed);
      s.rollPhase = Math.random() * Math.PI * 2;
      s.life = 0;
      s.maxLife = (2 * spawnRadius) / speed + 0.5;
      s.active = true;
      s.outer.visible = true;
    }
  },

  _tickFlyby(t, dt){
    if (!this.flybyShips) return;
    this.flybyShips.forEach(s => {
      if (!s.active) return;
      s.life += dt;
      if (s.life >= s.maxLife) {
        // Run scenario-specific cleanup before dropping the ship.
        if (s.scenarioCleanup) { try { s.scenarioCleanup(); } catch (_) {} s.scenarioCleanup = null; }
        s.active = false;
        s.outer.visible = false;
        if (s.scenario) {
          s.scenario = null;
          if (s.type === 'pelican') {
            if (s.cargo) s.cargo.visible = false;
            s.hatchAngle = 0;
            if (s.hatchPivot) s.hatchPivot.rotation.x = 0;
            if (s.muzzleFlashes) s.muzzleFlashes.forEach(mf => mf.material.opacity = 0);
          }
        }
        // Tear down ephemeral ships entirely (minted on-demand for batched scenarios).
        if (s._ephemeral) this._disposeEphemeralShip(s);
        return;
      }
      // Translation
      s.outer.position.addScaledVector(s.velocity, dt);
      s.rollPhase += dt;
      if (s.scenario) s.scenarioTime += dt;

      // Scripted-scenario overrides for combat
      this._tickScenario(s, t, dt);

      // Skip default rotation when a scripted scenario is driving this ship.
      if (s.scenario) {
        // Common: flame + glow pulses still apply
        if (s.flames && s.flames.length) {
          const pulse = 1.0 + Math.sin(t * 16) * 0.08 + Math.sin(t * 34) * 0.04;
          const opPulse = 0.85 + Math.sin(t * 22) * 0.10;
          s.flames.forEach(fl => {
            fl.mesh.scale.set(1, pulse, 1);
            fl.mat.opacity = opPulse;
          });
        }
        if (s.glowL && s.glowL.material) {
          const eg = 0.85 + Math.sin(t * 18) * 0.15;
          s.glowL.material.opacity = eg;
          if (s.glowR && s.glowR !== s.glowL) s.glowR.material.opacity = eg;
        }
        return;
      }

      // Type-specific rotation. inner.rotation.y is preserved at π (model flip).
      if (s.type === 'longsword') {
        s.inner.rotation.x = 0;
        s.inner.rotation.y = Math.PI;
        s.inner.rotation.z = Math.sin(s.rollPhase * 0.8) * 0.20;
      } else if (s.type === 'banshee') {
        // BARREL ROLLS — continuous spin around the longitudinal axis,
        // plus a slight pitch wave so the banshee weaves while spinning.
        s.inner.rotation.x = Math.sin(s.rollPhase * 0.6) * 0.18;
        s.inner.rotation.y = Math.PI;
        s.inner.rotation.z += dt * 4.0;  // continuous spin
      } else if (s.type === 'pelican') {
        // Lumbering wobble — slow yaw + pitch oscillation, minimal roll.
        s.inner.rotation.x = Math.sin(s.rollPhase * 0.55) * 0.08;
        s.inner.rotation.y = Math.PI + Math.sin(s.rollPhase * 0.42 + 1.0) * 0.10;
        s.inner.rotation.z = Math.sin(s.rollPhase * 0.65 + 0.5) * 0.05;
      } else if (s.type === 'forerunner') {
        // Slow self-rotation in all axes for a serene tumble
        s.inner.rotation.x = s.rollPhase * 0.30;
        s.inner.rotation.y = Math.PI + s.rollPhase * 0.22;
        s.inner.rotation.z = s.rollPhase * 0.16;
        // Each ring spins on its own axes
        if (s.rings) {
          s.rings.forEach((r, i) => {
            r.mesh.rotation.x += dt * (0.6 + i * 0.25);
            r.mesh.rotation.y += dt * (0.4 + i * 0.18) * (i % 2 ? -1 : 1);
            r.mat.uniforms.uTime.value = t;
          });
        }
        if (s.orbMat) s.orbMat.uniforms.uTime.value = t;
      }

      // Common: flame + glow pulses (skip for forerunner which has no flames)
      if (s.flames && s.flames.length) {
        const pulse = 1.0 + Math.sin(t * 16) * 0.08 + Math.sin(t * 34) * 0.04;
        const opPulse = 0.85 + Math.sin(t * 22) * 0.10;
        s.flames.forEach(fl => {
          fl.mesh.scale.set(1, pulse, 1);
          fl.mat.opacity = opPulse;
        });
      }
      if (s.glowL && s.glowL.material) {
        const eg = 0.85 + Math.sin(t * 18) * 0.15;
        s.glowL.material.opacity = eg;
        if (s.glowR && s.glowR !== s.glowL) s.glowR.material.opacity = eg;
      }
    });

    // b189: keep the void busy. Two parallel schedulers — basic flybys
    // (any ship type, frequent) + scripted scenarios (rare, varied).
    // The user wants high churn / variation in what's on screen, so the
    // gating is loosened: flybys can overlap with scenarios, and the
    // scenario picker tracks recent firings so the same one doesn't
    // repeat for 5 cycles.
    if (this._nextFlybyAt == null) this._nextFlybyAt = t + 4;
    if (t >= this._nextFlybyAt) {
      // Allow up to 2 concurrent random flybys so the sky feels alive
      const activeFlybys = this.flybyShips.filter(s => s.active && !s.scenario).length;
      if (activeFlybys < 2) {
        this._spawnFlyby();
        this._nextFlybyAt = t + 3 + Math.random() * 4;   // 3–7s gap
      } else {
        this._nextFlybyAt = t + 0.5;
      }
    }
    this._tickScenarioScheduler(t);
  },

  /* b189: scenario auto-fire — picks one of the 18 scripted scenarios
     every 22–40s, biased away from the last 5 so the user sees variety.
     Skips firing if we're already inside an active scripted scenario
     (to avoid heavy-on-heavy stacking like fleet-jump-in + convoy). */
  _tickScenarioScheduler(t){
    if (this._nextScenarioAt == null) this._nextScenarioAt = t + 10;
    if (t < this._nextScenarioAt) return;
    const sceneActive = this.flybyShips.some(s => s.active && s.scenario);
    if (sceneActive) {
      this._nextScenarioAt = t + 1.5;
      return;
    }
    this._fireRandomScenario();
    this._nextScenarioAt = t + 22 + Math.random() * 18;   // 22–40s gap
  },

  _fireRandomScenario(){
    // Always-available scenarios (no focus requirement)
    const pool = [
      ['slipspace',    () => this._spawnSlipspaceJump()],
      ['mothership',   () => this._spawnMothershipReveal()],
      ['convoy',       () => this._spawnConvoy()],
      ['crash',        () => this._spawnCrashDive()],
      ['fleet',        () => this._spawnFleetJumpIn()],
      ['derelict',     () => this._spawnDerelictDrift()],
      ['interception', () => this._spawnInterception()],
      ['distress',     () => this._spawnDistressBeacon()],
      ['debris',       () => this._spawnDebrisCross()],
      ['ghost',        () => this._spawnGhostContact()],
      ['carrier',      () => this._spawnCarrierLaunch()],
      ['escort',       () => this._spawnEscortRun()],
      ['observer',     () => this._spawnSilentObserver()],
      ['strafe',       () => this._spawnLongswordStrafe()],
    ];
    // Focus-required scenarios — only included when a title is locked
    if (this.focused) {
      pool.push(['orbit',   () => this._spawnForerunnerOrbit()]);
      pool.push(['storm',   () => this._spawnPlasmaStorm()]);
      pool.push(['scanner', () => this._spawnScannerSweep()]);
      pool.push(['landing', () => this._spawnEmergencyLanding()]);
    }
    this._recentScenarios = this._recentScenarios || [];
    const fresh = pool.filter(([name]) => !this._recentScenarios.includes(name));
    const eligible = fresh.length ? fresh : pool;
    const [name, fn] = eligible[Math.floor(Math.random() * eligible.length)];
    try { fn(); } catch (e) { console.warn('[scenario] fire failed', name, e); return; }
    this._recentScenarios.push(name);
    if (this._recentScenarios.length > 5) this._recentScenarios.shift();
  },

  /* ---------- Mech-fragment shards — drifting low-poly glass debris ---------- */
  // Active-Theory-inspired: jagged low-poly geometric shards floating through
  // space, rotating on multiple axes, dark glass body with bright fresnel edges
  // that color-cycle slowly. Adds physical depth to the void.
  _buildShards(){
    const COUNT = 32;
    this.shards = [];

    const fresnelVS = `
      varying vec3 vNormal;
      varying vec3 vView;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView   = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `;
    const fresnelFS = `
      uniform float uTime;
      uniform float uBass;
      uniform float uHueOffset;
      varying vec3 vNormal;
      varying vec3 vView;
      vec3 hsl2rgb(float h, float s, float l){
        vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
      }
      void main(){
        float fres = 1.0 - abs(dot(vNormal, vView));
        fres = pow(fres, 1.8);
        float hue = fract(uTime * 0.025 + uHueOffset);
        vec3 edge = hsl2rgb(hue, 0.70, 0.60);
        edge *= 1.0 + uBass * 0.35;
        // Dark glass body, bright iridescent edges
        vec3 body = vec3(0.04, 0.06, 0.10);
        vec3 col = mix(body, edge, fres);
        float a = 0.34 + fres * 0.75;
        gl_FragColor = vec4(col, a);
      }
    `;

    const shapes = [
      () => new THREE.IcosahedronGeometry(1.4, 0),
      () => new THREE.OctahedronGeometry(1.6, 0),
      () => new THREE.TetrahedronGeometry(1.8, 0),
      () => new THREE.ConeGeometry(0.9, 2.6, 5, 1),
      () => new THREE.DodecahedronGeometry(1.2, 0),
    ];

    for (let i = 0; i < COUNT; i++) {
      const geo = shapes[i % shapes.length]();
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime:      { value: Math.random() * 10 },
          uBass:      { value: 0 },
          uHueOffset: { value: Math.random() },
        },
        vertexShader: fresnelVS,
        fragmentShader: fresnelFS,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const m = new THREE.Mesh(geo, mat);

      // Distribute on a sphere shell at varied radii
      const u  = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(1 - u * u);
      const dist = 50 + Math.random() * 220;
      m.position.set(
        Math.cos(th) * rr * dist,
        u * dist,
        Math.sin(th) * rr * dist
      );
      const scale = 0.7 + Math.random() * 1.6;
      m.scale.setScalar(scale);
      m.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

      const drift = {
        base:      m.position.clone(),
        amp:       3 + Math.random() * 6,
        freq:      0.08 + Math.random() * 0.14,
        phase:     Math.random() * Math.PI * 2,
        spinX:     (Math.random() - 0.5) * 0.55,
        spinY:     (Math.random() - 0.5) * 0.55,
        spinZ:     (Math.random() - 0.5) * 0.55,
      };

      this.scene.add(m);
      this.shards.push({ mesh: m, mat, drift });
    }
  },

  _tickShards(t, dt, bass){
    if (!this.shards) return;
    this.shards.forEach(s => {
      const d = s.drift;
      s.mesh.rotation.x += d.spinX * dt;
      s.mesh.rotation.y += d.spinY * dt;
      s.mesh.rotation.z += d.spinZ * dt;
      s.mesh.position.x = d.base.x + Math.sin(t * d.freq + d.phase) * d.amp;
      s.mesh.position.y = d.base.y + Math.cos(t * d.freq * 0.7 + d.phase) * d.amp * 0.8;
      s.mesh.position.z = d.base.z + Math.sin(t * d.freq * 0.85 + d.phase * 1.3) * d.amp;
      s.mat.uniforms.uTime.value = t;
      s.mat.uniforms.uBass.value = bass;
    });
  },

  /* ---------- Distant core — concentric iridescent rings + glass orb ---------- */
  // Active-Theory-inspired set piece: stack of independently-rotating fresnel
  // glass rings around a central iridescent icosahedron orb. Reads as a
  // distant gravitational gyroscope / observatory anchor.
  _buildCore(){
    this.coreGroup = new THREE.Group();
    this.coreGroup.position.set(0, 0, -440);

    const fresnelVS = `
      varying vec3 vNormal;
      varying vec3 vView;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView   = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `;
    const fresnelFS = `
      uniform float uTime;
      uniform float uBass;
      uniform float uHueOffset;
      uniform float uPower;
      uniform float uBaseAlpha;
      varying vec3 vNormal;
      varying vec3 vView;
      vec3 hsl2rgb(float h, float s, float l){
        vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
      }
      void main(){
        float fres = 1.0 - abs(dot(vNormal, vView));
        fres = pow(fres, uPower);
        float hue = fract(uTime * 0.04 + uHueOffset + fres * 0.30);
        vec3 col = hsl2rgb(hue, 0.72, 0.58);
        col *= 1.0 + uBass * 0.5;
        float a = uBaseAlpha + fres * 0.85;
        gl_FragColor = vec4(col, a);
      }
    `;

    // Concentric rings at varying scales / orientations / spin rates
    const ringConfigs = [
      { r: 28, t: 0.30, segs: 96, hue: 0.05, axis: 'x', spin:  0.18 },
      { r: 38, t: 0.45, segs: 96, hue: 0.18, axis: 'y', spin: -0.14 },
      { r: 50, t: 0.55, segs: 96, hue: 0.34, axis: 'z', spin:  0.10 },
      { r: 64, t: 0.40, segs: 96, hue: 0.55, axis: 'x', spin: -0.07 },
    ];
    this.coreRings = [];
    ringConfigs.forEach((c) => {
      const geo = new THREE.TorusGeometry(c.r, c.t, 14, c.segs);
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime:      { value: 0 },
          uBass:      { value: 0 },
          uHueOffset: { value: c.hue },
          uPower:     { value: 1.5 },
          uBaseAlpha: { value: 0.18 },
        },
        vertexShader: fresnelVS,
        fragmentShader: fresnelFS,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const ring = new THREE.Mesh(geo, mat);
      // Random initial orientation so they don't all start coplanar
      ring.rotation.x = Math.random() * Math.PI;
      ring.rotation.y = Math.random() * Math.PI;
      ring.rotation.z = Math.random() * Math.PI;
      this.coreGroup.add(ring);
      this.coreRings.push({ mesh: ring, mat, axis: c.axis, spin: c.spin });
    });

    // Central iridescent orb — high-detail icosa for cleaner fresnel
    const orbGeo = new THREE.IcosahedronGeometry(16, 3);
    const orbMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:      { value: 0 },
        uBass:      { value: 0 },
        uHueOffset: { value: 0 },
        uPower:     { value: 1.2 },
        uBaseAlpha: { value: 0.30 },
      },
      vertexShader: fresnelVS,
      fragmentShader: fresnelFS,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.coreOrb = new THREE.Mesh(orbGeo, orbMat);
    this.coreGroup.add(this.coreOrb);

    this.scene.add(this.coreGroup);
  },

  _tickCore(t, bass){
    if (!this.coreGroup) return;
    const s = 1.0 + bass * 0.10;
    this.coreGroup.scale.setScalar(s);
    if (this.coreOrb) {
      this.coreOrb.material.uniforms.uTime.value = t;
      this.coreOrb.material.uniforms.uBass.value = bass;
      this.coreOrb.rotation.x = t * 0.18;
      this.coreOrb.rotation.y = t * 0.13;
    }
    this.coreRings.forEach(r => {
      r.mat.uniforms.uTime.value = t;
      r.mat.uniforms.uBass.value = bass;
      const inc = r.spin * 0.016 * 60 * (1/60);  // = r.spin * 0.016
      if      (r.axis === 'x') r.mesh.rotation.x += r.spin * 0.016;
      else if (r.axis === 'y') r.mesh.rotation.y += r.spin * 0.016;
      else                     r.mesh.rotation.z += r.spin * 0.016;
    });
  },

  /* ---------- Satellites — translucent rotating glass-ring gyros ---------- */
  // Beta-Decay-by-way-of-Active-Theory: each "satellite" is a stack of glass
  // torus rings + a small iridescent core. Rings rotate on multiple axes
  // independently so the whole object spins as it drifts. No more Roblox boxes.
  _buildSatellites(){
    // b184: count 8 → 5, was visually busy and one-or-two were always
    // too close + halo-dominated when their orbit phase brought them in
    // front of the camera.
    const COUNT = 5;
    this.satellites = [];
    const haloTex = this._makeSatLightTexture();

    const fresnelVS = `
      varying vec3 vNormal;
      varying vec3 vView;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView   = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `;
    const fresnelFS = `
      uniform float uTime;
      uniform float uBass;
      uniform float uHueOffset;
      uniform float uPower;
      varying vec3 vNormal;
      varying vec3 vView;
      vec3 hsl2rgb(float h, float s, float l){
        vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
      }
      void main(){
        float fres = 1.0 - abs(dot(vNormal, vView));
        fres = pow(fres, uPower);
        float hue = fract(uTime * 0.06 + uHueOffset + fres * 0.25);
        vec3 col = hsl2rgb(hue, 0.82, 0.66);
        col *= 1.0 + uBass * 0.4;
        float a = 0.32 + fres * 0.85;
        gl_FragColor = vec4(col, a);
      }
    `;

    for (let i = 0; i < COUNT; i++) {
      const grp = new THREE.Group();
      const baseHue = Math.random();

      // Three perpendicular glass rings — gyroscope feel.
      // b184: ring radii halved (3.0/2.4/1.8 → 1.6/1.3/1.0). Satellites are
      // scenery, not landmarks — they shouldn't compete with track titles
      // or the marathon ship for visual real estate.
      const rings = [];
      const ringConfigs = [
        { r: 1.6, t: 0.06, axis: new THREE.Vector3(1, 0, 0), spin: 0.8 + Math.random() * 0.6 },
        { r: 1.3, t: 0.055, axis: new THREE.Vector3(0, 1, 0), spin: 0.6 + Math.random() * 0.5 },
        { r: 1.0, t: 0.05, axis: new THREE.Vector3(0, 0, 1), spin: 1.0 + Math.random() * 0.7 },
      ];
      ringConfigs.forEach((c, j) => {
        const geo = new THREE.TorusGeometry(c.r, c.t, 10, 64);
        const mat = new THREE.ShaderMaterial({
          uniforms: {
            uTime:      { value: Math.random() * 10 },
            uBass:      { value: 0 },
            uHueOffset: { value: (baseHue + j * 0.07) % 1 },
            uPower:     { value: 1.6 },
          },
          vertexShader: fresnelVS,
          fragmentShader: fresnelFS,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
        });
        const m = new THREE.Mesh(geo, mat);
        // Orient each ring on a different axis
        if (j === 1) m.rotation.x = Math.PI / 2;
        if (j === 2) m.rotation.y = Math.PI / 2;
        grp.add(m);
        rings.push({ mesh: m, mat, axis: c.axis, spin: c.spin });
      });

      // Central iridescent orb (b184: 0.8 → 0.45)
      const orbGeo = new THREE.IcosahedronGeometry(0.45, 1);
      const orbMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime:      { value: Math.random() * 10 },
          uBass:      { value: 0 },
          uHueOffset: { value: baseHue },
          uPower:     { value: 1.2 },
        },
        vertexShader: fresnelVS,
        fragmentShader: fresnelFS,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const orb = new THREE.Mesh(orbGeo, orbMat);
      grp.add(orb);

      // Soft halo so the gyro reads as a glowing point even at distance
      const haloMat = new THREE.SpriteMaterial({
        map: haloTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.55,
      });
      const haloRgb = (() => {
        const h = baseHue;
        const a = 0.55 * Math.min(0.55, 1 - 0.55);
        const f = n => {
          const k = (n + h * 12) % 12;
          return 0.55 - a * Math.max(-1, Math.min(Math.min(k - 3, 9 - k), 1));
        };
        return new THREE.Color(f(0), f(8), f(4));
      })();
      haloMat.color = haloRgb;
      const halo = new THREE.Sprite(haloMat);
      halo.scale.set(7, 7, 1);  // b184: 14 → 7, the halo was reading as the satellite's body
      grp.add(halo);

      // Nav lights — red port (-x), green starboard (+x), white strobe on top.
      // Reads as an actual satellite/spacecraft at distance.
      const navLights = [];
      // b184: nav-light positions scaled down with the satellite (was 3.2/2.4)
      const navConfigs = [
        { color: 0xff2a3a, pos: [-1.7, 0, 0], blink: 0.0, period: 1.4 },  // red port
        { color: 0x2dff66, pos: [ 1.7, 0, 0], blink: 0.5, period: 1.4 },  // green starboard
        { color: 0xffffff, pos: [ 0, 1.3, 0], blink: 0.0, period: 0.55, strobe: true }, // white strobe
      ];
      navConfigs.forEach(c => {
        const mat = new THREE.SpriteMaterial({
          map: haloTex,
          color: new THREE.Color(c.color),
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          opacity: 0.0,
        });
        const sp = new THREE.Sprite(mat);
        sp.position.set(c.pos[0], c.pos[1], c.pos[2]);
        sp.scale.set(0.9, 0.9, 1);  // b184: 1.6 → 0.9 to match smaller satellite
        grp.add(sp);
        navLights.push({ sp, mat, phase: c.blink, period: c.period, strobe: !!c.strobe });
      });

      const orbit = {
        // b184: orbit radius 130-210 → 240-340. With a title shell at 130u,
        // the old satellites lived just past the titles and routinely passed
        // through the foreground — the user couldn't tell what they were.
        radius: 240 + Math.random() * 100,
        speed:  0.025 + Math.random() * 0.025,
        phase:  Math.random() * Math.PI * 2,
        tilt:   (Math.random() - 0.5) * 1.4,
        yBob:   18 + Math.random() * 16,
        // Whole-group tumble in addition to per-ring spin
        groupSpinX: (Math.random() - 0.5) * 0.30,
        groupSpinY: (Math.random() - 0.5) * 0.30,
        groupSpinZ: (Math.random() - 0.5) * 0.20,
      };

      this.scene.add(grp);
      this.satellites.push({ grp, rings, orb, orbMat, haloMat, navLights, orbit });
    }
  },

  _makeSatLightTexture(){
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0.00, 'rgba(255,255,255,1)');
    g.addColorStop(0.18, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.30)');
    g.addColorStop(1.00, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  },

  _tickSatellites(t, dt, bass){
    if (!this.satellites) return;
    this.satellites.forEach(s => {
      const o = s.orbit;
      const ang = t * o.speed + o.phase;
      const cosT = Math.cos(o.tilt), sinT = Math.sin(o.tilt);
      const px = Math.cos(ang) * o.radius;
      const pz = Math.sin(ang) * o.radius;
      const py = Math.sin(ang * 0.6 + o.phase) * o.yBob;
      const x =  px * cosT - py * sinT;
      const y =  px * sinT + py * cosT;
      s.grp.position.set(x, y, pz);
      // Whole-group tumble — gives lively rotation as it drifts
      s.grp.rotation.x += o.groupSpinX * dt;
      s.grp.rotation.y += o.groupSpinY * dt;
      s.grp.rotation.z += o.groupSpinZ * dt;
      // Each ring spins on its own axis on top of group rotation
      s.rings.forEach(r => {
        if (r.axis.x === 1)      r.mesh.rotation.x += r.spin * dt;
        else if (r.axis.y === 1) r.mesh.rotation.y += r.spin * dt;
        else                     r.mesh.rotation.z += r.spin * dt;
        r.mat.uniforms.uTime.value = t;
        r.mat.uniforms.uBass.value = bass;
      });
      // Central orb shimmers
      s.orbMat.uniforms.uTime.value = t;
      s.orbMat.uniforms.uBass.value = bass;
      s.orb.rotation.x += dt * 0.8;
      s.orb.rotation.y += dt * 0.6;
      // Nav lights — port/starboard slow blink, white strobe sharper.
      if (s.navLights) {
        s.navLights.forEach(nl => {
          const phase = (t / nl.period + nl.phase) % 1;
          let op;
          if (nl.strobe) {
            // Sharp pulse: bright for ~80ms each period
            op = phase < 0.10 ? (1.0 - phase / 0.10) : 0.05;
          } else {
            // Soft sine blink: ~50% duty
            op = 0.30 + Math.max(0, Math.sin(phase * Math.PI * 2)) * 0.85;
          }
          nl.mat.opacity = op;
        });
      }
    });
  },

  /* ---------- Marathon capital ship (b174 — permanent landmark) ----------
     A procedural take on Bungie's 2026 Marathon colony-ship silhouette:
     industrial spine + cluster modules + forward command head + rear engine
     block, with neon pinstripes and lit windows. Sits far away as a fixed
     visual anchor — sells "we're somewhere specific in a galaxy."
     Lives on this.marathonShip = { grp, lights, thrusters }.            */
  _buildMarathonShip(){
    const grp = new THREE.Group();
    // Far placement so the silhouette reads as a landmark, not a flyby.
    grp.position.set(-340, 36, -120);
    grp.rotation.y = Math.PI * 0.18;     // angled slightly toward camera
    grp.rotation.z = -0.06;
    grp.scale.set(1.0, 1.0, 1.0);

    // Material palette — industrial grey hull + neon orange + neon teal accents.
    const hullMat = new THREE.MeshBasicMaterial({ color: 0x1a1d24, fog: true });
    const hullDarkMat = new THREE.MeshBasicMaterial({ color: 0x0d0f14, fog: true });
    const accentMat = new THREE.MeshBasicMaterial({ color: 0x2a2e38, fog: true });

    // Emissive accent shader — subtle pulse on bass for the neon pinstripes
    // and lit windows. Reused across many small parts.
    const neonMat = (color, intensity = 1.0) => new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uColor: { value: new THREE.Color(color) },
        uIntensity: { value: intensity },
      },
      vertexShader: `
        void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uTime;
        uniform float uBass;
        uniform float uIntensity;
        void main(){
          float pulse = 0.85 + 0.15 * sin(uTime * 1.6) + uBass * 0.40;
          gl_FragColor = vec4(uColor * uIntensity * pulse, 1.0);
        }
      `,
      transparent: false,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });

    const orangeNeon = neonMat(0xff8030, 1.6);
    const tealNeon   = neonMat(0x55e0ff, 1.4);
    const windowGlow = neonMat(0xffce80, 1.0);

    // ---- Main spine (long horizontal hull) ----
    const spineGeo = new THREE.CylinderGeometry(7.5, 7.5, 180, 12, 1, false);
    spineGeo.rotateZ(Math.PI / 2);  // lay horizontal along X
    const spine = new THREE.Mesh(spineGeo, hullMat);
    grp.add(spine);

    // Spine hex panel ridges — slight bigger cylinder ringed around
    const ridgeGeo = new THREE.TorusGeometry(8.0, 0.6, 6, 24);
    [-60, -20, 20, 60].forEach(x => {
      const r = new THREE.Mesh(ridgeGeo, accentMat);
      r.position.x = x;
      r.rotation.y = Math.PI / 2;
      grp.add(r);
    });

    // ---- Forward command head (icosa + capsule cluster) ----
    const headGroup = new THREE.Group();
    headGroup.position.x = 105;
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(11, 1), hullMat);
    headGroup.add(head);
    // Head detail spires
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.6, 8, 6),
        accentMat
      );
      sp.position.set(8 + i * 1.5, 6 + i * 1.2, (i - 1) * 3);
      sp.rotation.z = -0.4 - i * 0.08;
      headGroup.add(sp);
      // Tiny tip light
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), orangeNeon);
      tip.position.copy(sp.position).add(new THREE.Vector3(0, 4, 0));
      headGroup.add(tip);
    }
    grp.add(headGroup);

    // ---- Mid cargo cluster (4 cylindrical modules above the spine) ----
    const cargoGroup = new THREE.Group();
    cargoGroup.position.set(20, 9, 0);
    for (let i = 0; i < 4; i++) {
      const r = 2.6 + (i % 2) * 0.5;
      const h = 14 + (i % 2) * 4;
      const mod = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, h, 10),
        hullMat
      );
      mod.position.set(-15 + i * 10, 0, (i % 2 === 0 ? 5 : -5));
      mod.rotation.x = Math.PI / 2;
      cargoGroup.add(mod);
      // End caps
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.05, r * 1.05, 0.6, 10), accentMat);
      cap.position.copy(mod.position);
      cap.position.z += (mod.position.z > 0 ? h / 2 : -h / 2);
      cap.rotation.x = Math.PI / 2;
      cargoGroup.add(cap);
    }
    grp.add(cargoGroup);

    // ---- Belly cluster (3 modules slung below the spine) ----
    const bellyGroup = new THREE.Group();
    bellyGroup.position.set(-10, -10, 0);
    for (let i = 0; i < 3; i++) {
      const mod = new THREE.Mesh(
        new THREE.BoxGeometry(20, 4, 8),
        hullDarkMat
      );
      mod.position.set(-25 + i * 22, 0, 0);
      bellyGroup.add(mod);
    }
    grp.add(bellyGroup);

    // ---- Rear engine block ----
    const engineGroup = new THREE.Group();
    engineGroup.position.x = -100;
    const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(28, 22, 22), hullMat);
    engineGroup.add(engineBlock);
    // 3 thruster cones — store mats so we can pulse them
    const thrusters = [];
    for (let i = 0; i < 3; i++) {
      const t = new THREE.Mesh(
        new THREE.ConeGeometry(3.5, 6, 14),
        orangeNeon.clone()
      );
      t.position.set(-16, -7 + i * 7, 0);
      t.rotation.z = Math.PI / 2;
      engineGroup.add(t);
      thrusters.push(t);
      // outer cone glow halo (a slightly bigger semi-transparent cone)
      const halo = new THREE.Mesh(
        new THREE.ConeGeometry(5.5, 9, 14),
        new THREE.MeshBasicMaterial({
          color: 0xff8030, transparent: true, opacity: 0.18,
          blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
        })
      );
      halo.position.copy(t.position);
      halo.position.x -= 1.5;
      halo.rotation.z = Math.PI / 2;
      engineGroup.add(halo);
    }
    grp.add(engineGroup);

    // ---- Antenna spires on top of spine ----
    for (let i = 0; i < 4; i++) {
      const ant = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.30, 14, 6),
        accentMat
      );
      ant.position.set(-50 + i * 30, 11, (i % 2 === 0 ? 2 : -2));
      grp.add(ant);
      // Top blinking light (variable phase)
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), tealNeon.clone());
      tip.position.copy(ant.position).add(new THREE.Vector3(0, 8, 0));
      tip.userData.blinkPhase = i * 0.7;
      grp.add(tip);
    }

    // ---- Window strips along the spine (lit rectangles) ----
    const windowStripGeo = new THREE.PlaneGeometry(2.4, 0.4);
    for (let x = -70; x <= 70; x += 6) {
      for (let row = 0; row < 2; row++) {
        const w = new THREE.Mesh(windowStripGeo, windowGlow);
        w.position.set(x, -2 + row * 4, 7.55);
        grp.add(w);
        // Mirror on the back face
        const w2 = new THREE.Mesh(windowStripGeo, windowGlow);
        w2.position.set(x, -2 + row * 4, -7.55);
        w2.rotation.y = Math.PI;
        grp.add(w2);
      }
    }

    // ---- Neon pinstripe accents (long thin glowing lines) ----
    const stripeGeo = new THREE.BoxGeometry(170, 0.18, 0.18);
    const stripeOrange = new THREE.Mesh(stripeGeo, orangeNeon);
    stripeOrange.position.set(0, 6.3, 7.6);
    grp.add(stripeOrange);
    const stripeOrange2 = stripeOrange.clone();
    stripeOrange2.position.set(0, 6.3, -7.6);
    grp.add(stripeOrange2);
    const stripeTeal = new THREE.Mesh(new THREE.BoxGeometry(170, 0.16, 0.16), tealNeon);
    stripeTeal.position.set(0, -6.3, 7.6);
    grp.add(stripeTeal);
    const stripeTeal2 = stripeTeal.clone();
    stripeTeal2.position.set(0, -6.3, -7.6);
    grp.add(stripeTeal2);

    // ---- Forward navigation lights (red/green port-starboard, blinking) ----
    const navRed = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), neonMat(0xff2040, 2.0));
    navRed.position.set(105, 0, -10);
    navRed.userData.blinkPhase = 0;
    grp.add(navRed);
    const navGreen = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), neonMat(0x40ff80, 2.0));
    navGreen.position.set(105, 0, 10);
    navGreen.userData.blinkPhase = Math.PI;
    grp.add(navGreen);

    // Collect all neon shader mats for per-frame uniform updates.
    const neonMats = [];
    grp.traverse(o => {
      if (o.material && o.material.uniforms && o.material.uniforms.uBass) {
        neonMats.push(o.material);
      }
    });
    // Collect blinking lights so we can pulse opacity in tick.
    const blinkers = [];
    grp.traverse(o => {
      if (o.userData && o.userData.blinkPhase != null) blinkers.push(o);
    });

    this.scene.add(grp);
    this.marathonShip = { grp, neonMats, blinkers, thrusters };
  },

  _tickMarathonShip(t, bass){
    if (!this.marathonShip || !this.marathonShip.grp.visible) return;
    const m = this.marathonShip;
    // Update neon shader uniforms
    for (let i = 0; i < m.neonMats.length; i++) {
      const u = m.neonMats[i].uniforms;
      u.uTime.value = t;
      u.uBass.value = bass;
    }
    // Blink antenna lights + nav lights
    for (let i = 0; i < m.blinkers.length; i++) {
      const b = m.blinkers[i];
      const ph = b.userData.blinkPhase;
      const blink = 0.4 + 0.6 * (Math.sin(t * 2.4 + ph) > 0.7 ? 1 : 0);
      if (b.material && b.material.uniforms && b.material.uniforms.uIntensity) {
        b.material.uniforms.uIntensity.value = 1.6 * blink;
      }
    }
    // Very slow yaw drift to feel "alive but station-keeping"
    m.grp.rotation.y = Math.PI * 0.18 + Math.sin(t * 0.04) * 0.012;
  },

  /* ---------- Nav buoys (b174) — small drifting blinking beacons ---------- */
  _buildNavBuoys(){
    const COUNT = 7;
    this.navBuoys = [];
    // Procedural sprite for the radial halo around each blinker.
    const haloTex = this._makeBuoyHaloTexture
      ? this._makeBuoyHaloTexture()
      : (() => {
          const c = document.createElement('canvas');
          c.width = c.height = 128;
          const ctx = c.getContext('2d');
          const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
          g.addColorStop(0.0, 'rgba(255,255,255,1)');
          g.addColorStop(0.3, 'rgba(255,200,120,0.6)');
          g.addColorStop(1.0, 'rgba(255,200,120,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, 128, 128);
          const tex = new THREE.CanvasTexture(c);
          tex.minFilter = THREE.LinearFilter;
          return tex;
        })();

    for (let i = 0; i < COUNT; i++) {
      const grp = new THREE.Group();

      // Tapered pylon body — small, dark, technical
      const pylon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.22, 2.4, 6),
        new THREE.MeshBasicMaterial({ color: 0x1a1d24, fog: true })
      );
      pylon.position.y = 0;
      grp.add(pylon);

      // Three thin ring details
      for (let r = 0; r < 3; r++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.20 + r * 0.02, 0.025, 4, 12),
          new THREE.MeshBasicMaterial({ color: 0x40464f, fog: true })
        );
        ring.position.y = -0.7 + r * 0.4;
        ring.rotation.x = Math.PI / 2;
        grp.add(ring);
      }

      // Top blinker — small emissive sphere
      const blinkColor = (i % 3 === 0) ? 0xff8030
                       : (i % 3 === 1) ? 0x55e0ff
                       : 0xffce80;
      const blinkerMat = new THREE.MeshBasicMaterial({ color: blinkColor, fog: false });
      const blinker = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 10, 8),
        blinkerMat
      );
      blinker.position.y = 1.55;
      grp.add(blinker);

      // Halo sprite around the blinker
      const haloMat = new THREE.SpriteMaterial({
        map: haloTex,
        color: blinkColor,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      });
      const halo = new THREE.Sprite(haloMat);
      halo.scale.set(2.6, 2.6, 1);
      halo.position.y = 1.55;
      grp.add(halo);

      // Random mid-field placement (keep clear of the title sphere at r≈130)
      const u = Math.random() * 2 - 1;
      const tt = Math.random() * Math.PI * 2;
      const r = 55 + Math.random() * 70;       // 55..125 — mid-field
      const sin = Math.sqrt(1 - u * u);
      grp.position.set(r * sin * Math.cos(tt), r * u * 0.45, r * sin * Math.sin(tt));

      // Slight random tilt — buoys look "set down" not perfectly upright
      grp.rotation.x = (Math.random() - 0.5) * 0.4;
      grp.rotation.z = (Math.random() - 0.5) * 0.4;

      this.navBuoys.push({
        grp,
        blinkerMat,
        haloMat,
        basePos: grp.position.clone(),
        driftSeed: Math.random() * Math.PI * 2,
        blinkPhase: Math.random() * Math.PI * 2,
        blinkRate: 0.7 + Math.random() * 0.8,
      });
      this.scene.add(grp);
    }
  },

  _tickNavBuoys(t, bass){
    if (!this.navBuoys) return;
    for (let i = 0; i < this.navBuoys.length; i++) {
      const b = this.navBuoys[i];
      if (!b.grp.visible) continue;
      // Slow drift around base position
      const ds = b.driftSeed;
      b.grp.position.set(
        b.basePos.x + Math.sin(t * 0.10 + ds) * 1.6,
        b.basePos.y + Math.sin(t * 0.13 + ds * 1.7) * 0.9,
        b.basePos.z + Math.cos(t * 0.09 + ds * 0.7) * 1.6
      );
      // Slow yaw rotation
      b.grp.rotation.y = ds + t * 0.18;
      // Blink — short bright flashes with ~80% off time
      const phase = (t * b.blinkRate + b.blinkPhase) % 2.4;
      const on = phase < 0.18 ? 1 : (phase < 0.32 ? (1 - (phase - 0.18) / 0.14) : 0);
      const intensity = 0.4 + on * 1.6 + bass * 0.20;
      b.blinkerMat.color.setScalar(0);  // reset
      // Mix back the original color tinted by intensity
      // (color set per-buoy at build, multiplied by intensity)
      const baseHex = b.haloMat.color.getHex();
      b.blinkerMat.color.setHex(baseHex);
      b.blinkerMat.color.multiplyScalar(intensity);
      b.haloMat.opacity = 0.10 + on * 0.55;
    }
  },

  /* ---------- Drift haze (sphere of points + curl-flow swirl) ---------- */
  _buildHaze(){
    const N = 4500;
    const positions = new Float32Array(N * 3);
    const phases    = new Float32Array(N);
    const sizes     = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      // Even sphere distribution around the camera (no longer biased forward).
      const u = Math.random() * 2 - 1;
      const tt = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(1 - u * u);
      const dist = 30 + Math.random() * 320;
      positions[i*3]   = Math.cos(tt) * rr * dist;
      positions[i*3+1] = u * dist;
      positions[i*3+2] = Math.sin(tt) * rr * dist;
      phases[i] = Math.random() * Math.PI * 2;
      sizes[i]  = 0.4 + Math.random() * 1.8;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aPhase',   new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uPxr:  { value: this.renderer.getPixelRatio() },
      },
      vertexShader: `
        attribute float aPhase;
        attribute float aSize;
        varying float vAlpha;
        uniform float uTime;
        uniform float uBass;
        uniform float uPxr;
        void main(){
          vec3 p = position;
          // Faux curl-flow: each particle orbits its base position on three
          // orthogonal sin/cos waves whose phase depends on its starting coords,
          // so neighbors swirl coherently like a flow field.
          float t = uTime * 0.13;
          p.x += sin(position.y * 0.014 + t        + aPhase)        * 4.0;
          p.y += cos(position.z * 0.018 + t * 0.8  + aPhase * 0.7)  * 3.0;
          p.z += sin(position.x * 0.012 + t * 0.6  + aPhase * 1.3)  * 4.0;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float dist = length(mv.xyz);
          float fade = smoothstep(360.0, 30.0, dist);
          vAlpha = (0.30 + uBass * 0.20) * fade;
          gl_PointSize = aSize * uPxr * (140.0 / max(dist, 1.0));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main(){
          vec2 d = gl_PointCoord - 0.5;
          float r = length(d);
          float a = smoothstep(0.5, 0.0, r);
          a = pow(a, 2.0);
          gl_FragColor = vec4(vec3(0.72, 0.78, 1.00), a * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.haze = new THREE.Points(geo, mat);
    this.scene.add(this.haze);
  },

  /* ---------- Titles ---------- */
  _buildTitles(){
    const all = this.ctx.tracks || [];
    if (!all.length) return;

    // Show every track. All on a SHARED fibonacci sphere — one shell, one
    // radius — so apparent size stays consistent across the catalog. Tier
    // controls size + opacity only, NOT distance. Each tier's tracks are
    // striped through the slot list so they're evenly distributed (you'll
    // never look at a wedge that's all-archive or all-featured).
    const featured = all.filter(t => t.isFeatured);
    const newer    = all.filter(t => !t.isFeatured && t.isNew);
    const archive  = all.filter(t => !t.isFeatured && !t.isNew);
    const total = featured.length + newer.length + archive.length;
    if (!total) return;

    const slots = new Array(total).fill(null);
    const assignTier = (tracks, tier) => {
      if (!tracks.length) return;
      const stride = total / tracks.length;
      tracks.forEach((track, i) => {
        let slot = Math.floor(i * stride);
        // Linear-probe to next empty slot if collision (only happens if
        // floor(stride*i) lands on an already-claimed slot).
        let guard = 0;
        while (slots[slot] !== null && guard < total) { slot = (slot + 1) % total; guard++; }
        slots[slot] = { track, tier };
      });
    };
    assignTier(featured, 'featured');
    assignTier(newer,    'newer');
    assignTier(archive,  'archive');

    const GOLDEN_ANGLE    = Math.PI * (3 - Math.sqrt(5));
    const VERTICAL_SQUASH = 0.78;
    const SHELL_RADIUS    = 130;

    slots.forEach((entry, slot) => {
      if (!entry) return;
      const { track, tier } = entry;
      const idx = all.indexOf(track);
      if (idx < 0) return;
      const slug = this.ctx.slugify ? this.ctx.slugify(track.title) : track.title;
      const tint = colorForTrack(track, idx);

      // Tier varies size + opacity only — distance is shared.
      let widthUnits, fontSize, baseOpacity;
      if (tier === 'featured') {
        widthUnits = 20; fontSize = 220; baseOpacity = 1.00;
      } else if (tier === 'newer') {
        widthUnits = 17; fontSize = 180; baseOpacity = 0.90;
      } else {
        widthUnits = 14; fontSize = 140; baseOpacity = 0.78;
      }

      // Per-track hash (deterministic across reloads) drives small jitters.
      const seed = Math.abs(Math.sin(idx * 12.9898 + 78.233) * 43758.5453);
      const jY = ((seed)         % 1 - 0.5) * 0.04;
      const jT = ((seed * 7.31)  % 1 - 0.5) * 0.10;
      const jR = ((seed * 3.71)  % 1 - 0.5) * 8;
      const jW = ((seed * 13.7)  % 1 - 0.5) * 2;

      // Fibonacci sphere coords on the shared shell
      const yRaw     = 1 - (slot + 0.5) / total * 2;     // -1..1 even cos(phi)
      const yClamped = Math.max(-0.95, Math.min(0.95, yRaw + jY));
      const ringR    = Math.sqrt(1 - yClamped * yClamped);
      const theta    = GOLDEN_ANGLE * slot + jT;
      const r        = SHELL_RADIUS + jR;
      const w        = widthUnits + jW;
      const pos = new THREE.Vector3(
        r * ringR * Math.cos(theta),
        r * yClamped * VERTICAL_SQUASH,
        r * ringR * Math.sin(theta)
      );

      const tex = this._makeTitleTexture(track.title, fontSize);
      const aspect = tex.image.width / tex.image.height;
      const planeH = w / aspect;
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTex:       { value: tex },
          uTime:      { value: Math.random() * 100 },
          uHover:     { value: 0 },
          uFocus:     { value: 0 },
          uBass:      { value: 0 },
          uOpacity:   { value: baseOpacity },
          uTint:      { value: new THREE.Vector3(tint[0], tint[1], tint[2]) },
          uHueShift:  { value: 0 },
        },
        vertexShader: TITLE_VERTEX,
        fragmentShader: TITLE_FRAGMENT,
        transparent: true,
        depthWrite: false,
      });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, planeH), mat);
      plane.position.copy(pos);
      plane.userData = { isTitle: true, index: idx, track, slug, tier, baseOpacity };
      plane.onBeforeRender = (renderer, scene, camera) => {
        plane.quaternion.copy(camera.quaternion);
      };
      this.scene.add(plane);
      this.titles.push({
        mesh: plane, index: idx, track, slug, tier,
        basePos: pos.clone(),
        flickerSeed: Math.random() * 100,
        baseOpacity,
      });
    });
  },

  _makeTitleTexture(title, fontSize){
    const text = title.toUpperCase();
    const padding = Math.floor(fontSize * 0.4);
    const measureCanvas = document.createElement('canvas');
    const mctx = measureCanvas.getContext('2d');
    mctx.font = `800 ${fontSize}px "Space Grotesk", Inter, system-ui, sans-serif`;
    const m = mctx.measureText(text);
    const tw = Math.ceil(m.width) + padding * 2;
    const th = Math.ceil(fontSize * 1.40) + padding;
    const w = Math.min(2048, Math.max(256, tw));
    const h = Math.min(640, Math.max(96, th));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.font = `800 ${fontSize}px "Space Grotesk", Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.97)';
    ctx.fillText(text, w / 2, h / 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  },

  /* ---------- Composer ---------- */
  _setupComposer(){
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.85, 0.55, 0.05);
    bloom.threshold = 0.05;
    bloom.strength  = 0.85;
    bloom.radius    = 0.55;
    this.bloom = bloom;
    this.composer.addPass(bloom);
    const lensDirtTex = this._makeLensDirtTexture();
    this.postPass = new ShaderPass({
      uniforms: {
        tDiffuse:    { value: null },
        uLensDirt:   { value: lensDirtTex },
        uTime:       { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uBass:       { value: 0 },
        // Toggles — all ON by default; admin can disable them.
        uFlaresOn:   { value: 1 },
        uDirtOn:     { value: 1 },
        uGodraysOn:  { value: 1 },
        uGodRaySource: { value: new THREE.Vector2(0, 0) },
        // b171 — additional FX. b172: halation + grade pick a random non-OFF
        // preset on load so each refresh feels different. DoF stays off by
        // default (it's a compositional choice, not a vibe knob).
        uHaloStyle:  { value: 1 + Math.floor(Math.random() * 4) },   // 1..4
        uGradeStyle: { value: 1 + Math.floor(Math.random() * 5) },   // 1..5
        uDofOn:      { value: 0 },
        uFocusUv:    { value: new THREE.Vector2(0.5, 0.5) },
        uFocusRadius:{ value: 0.18 },
      },
      vertexShader: POST_VERTEX,
      fragmentShader: POST_FRAGMENT,
    });
    this.composer.addPass(this.postPass);
  },

  /* ---------- Lens dirt texture (procedural greasy fingerprint mask) ---------- */
  _makeLensDirtTexture(){
    const N = 512;
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, N, N);

    // Layer 1: many small dust speckles
    for (let i = 0; i < 850; i++) {
      const x = Math.random() * N, y = Math.random() * N;
      const r = 0.5 + Math.random() * 1.8;
      ctx.fillStyle = `rgba(${180 + Math.random() * 75 | 0},${180 + Math.random() * 75 | 0},${200 + Math.random() * 55 | 0},${0.35 + Math.random() * 0.45})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }

    // Layer 2: streaky finger smudges (long soft radial gradients)
    for (let i = 0; i < 14; i++) {
      const cx = Math.random() * N, cy = Math.random() * N;
      const radius = 60 + Math.random() * 140;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, 'rgba(220,210,255,0.30)');
      grad.addColorStop(0.4, 'rgba(220,210,255,0.10)');
      grad.addColorStop(1, 'rgba(220,210,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    }

    // Layer 3: subtle cyan/magenta hue scattering (lens coating)
    for (let i = 0; i < 80; i++) {
      const x = Math.random() * N, y = Math.random() * N;
      const r = 8 + Math.random() * 40;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      const hue = Math.random() < 0.5 ? '120,200,255' : '255,140,210';
      grad.addColorStop(0, `rgba(${hue},${0.10 + Math.random() * 0.15})`);
      grad.addColorStop(1, `rgba(${hue},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  },

  /* ---------- Audio ---------- */
  _hookAudio(){
    const a = this.ctx.audio;
    if (!a) return;
    if (a.__floorAnalyser) {
      this.audioCtx = a.__floorAnalyser.ctx;
      this.analyser = a.__floorAnalyser.analyser;
      this.freqArr  = a.__floorAnalyser.freqArr;
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ac = new AC();
      const src = ac.createMediaElementSource(a);
      const an = ac.createAnalyser();
      an.fftSize = 256;
      an.smoothingTimeConstant = 0.85;
      src.connect(an);
      an.connect(ac.destination);
      this.audioCtx = ac;
      this.analyser = an;
      this.freqArr = new Uint8Array(an.frequencyBinCount);
      a.__floorAnalyser = { ctx: ac, source: src, analyser: an, freqArr: this.freqArr };
    } catch (e) { console.warn('[tg] analyser failed', e); }
  },

  _readBass(){
    if (!this.analyser) return 0;
    this.analyser.getByteFrequencyData(this.freqArr);
    let s = 0;
    for (let i = 2; i < 10; i++) s += this.freqArr[i];
    return Math.min(1, s / (8 * 255));
  },

  /* ---------- Input ---------- */
  _onResize(){
    if (!this.renderer || !this.container) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.postPass) this.postPass.uniforms.uResolution.value.set(w, h);
  },

  _onMove(e){
    const r = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = (e.clientX - r.left) / r.width;
    this.mouse.y = (e.clientY - r.top) / r.height;
    this.mouse.ndc.set(this.mouse.x * 2 - 1, -(this.mouse.y * 2 - 1));
    if (this.drag.active) {
      const dx = e.clientX - this.drag.lx;
      const dy = e.clientY - this.drag.ly;
      this.drag.lx = e.clientX;
      this.drag.ly = e.clientY;
      this.drag.totalPx += Math.abs(dx) + Math.abs(dy);
      const dyaw   = -dx * 0.0028;
      const dpitch = -dy * 0.0024;
      this.gaze.yaw   += dyaw;
      this.gaze.pitch += dpitch;
      // Track instantaneous velocity for inertia. Smoothed by mixing with the
      // previous value so a single-frame jerk doesn't fling the camera.
      if (this._inertiaOn) {
        const k = 0.45;
        this._dragVel.yaw   = this._dragVel.yaw   * (1 - k) + (dyaw   * 60) * k;
        this._dragVel.pitch = this._dragVel.pitch * (1 - k) + (dpitch * 60) * k;
      }
      const lim = 1.10;
      if (this.gaze.pitch >  lim) this.gaze.pitch =  lim;
      if (this.gaze.pitch < -lim) this.gaze.pitch = -lim;
    } else {
      this._raycast();
    }
  },

  _onPointerDown(e){
    if (e.target !== this.renderer.domElement) return;
    this.drag.active = true;
    // User taking manual control kills the scenario follow-cam.
    this._scenarioFollow = null;
    this.drag.x0 = e.clientX;
    this.drag.y0 = e.clientY;
    this.drag.lx = e.clientX;
    this.drag.ly = e.clientY;
    this.drag.totalPx = 0;
    // Grabbing the camera kills any residual inertia.
    if (this._dragVel) { this._dragVel.yaw = 0; this._dragVel.pitch = 0; }
    // Resolve hovered title under finger immediately so a no-drag tap can focus it.
    const r = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = (e.clientX - r.left) / r.width;
    this.mouse.y = (e.clientY - r.top) / r.height;
    this.mouse.ndc.set(this.mouse.x * 2 - 1, -(this.mouse.y * 2 - 1));
    if (!this.focused) this._raycast();
  },

  _onPointerUp(e){
    if (!this.drag.active) return;
    this.drag.active = false;
    if (this.drag.totalPx < 10) {
      if (this.focused) { this._release(); return; }
      if (this.hovered) this._focus(this.hovered);
    }
  },

  _onTouchMove(e){
    // Block iOS pull-to-refresh / page scroll behind the canvas. Drag-look itself
    // rides on top via pointer events.
    if (e.cancelable) e.preventDefault();
  },

  _forwardVec(){
    const cy = Math.cos(this.gaze.pitch);
    return new THREE.Vector3(
      Math.sin(this.gaze.yaw) * cy,
      Math.sin(this.gaze.pitch),
      -Math.cos(this.gaze.yaw) * cy
    );
  },

  _raycast(){
    if (this.focused) return;
    this.ray.setFromCamera(this.mouse.ndc, this.camera);
    const meshes = this.titles.map(t => t.mesh);
    const hits = this.ray.intersectObjects(meshes, false);
    const hit = hits[0]?.object?.userData;
    const hoverEl = document.getElementById('tg-hover');
    if (hit && hit.isTitle) {
      this.hovered = this.titles.find(t => t.index === hit.index);
      if (hoverEl) hoverEl.textContent = hit.track.title.toLowerCase();
      this.renderer.domElement.style.cursor = 'pointer';
    } else {
      this.hovered = null;
      if (hoverEl) hoverEl.textContent = '';
      this.renderer.domElement.style.cursor = '';
    }
  },

  _onKey(e){
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === 'Escape' && this.focused) { this._release(); return; }
    // Backtick / tilde toggles the admin panel (hidden by default).
    if (e.code === 'Backquote' || e.key === '`' || e.key === '~') {
      this._toggleAdmin();
    }
  },

  _toggleAdmin(){
    if (!this.adminEl) {
      console.warn('[admin] no panel — was init() called?');
      return;
    }
    const open = this.adminEl.classList.toggle('on');
    this.adminEl.style.display = open ? 'flex' : 'none';
    if (open && this._adminUpdateHints) this._adminUpdateHints();
    console.log('[admin] panel', open ? 'OPEN' : 'closed');
  },

  _buildAdminPanel(){
    const root = document.createElement('div');
    root.className = 'mw-admin';
    // Hidden by default. Open via the [ admin ] link in the HUD or `~`.
    root.style.display = 'none';
    root.innerHTML = `
      <div class="mw-admin-head">
        <button class="mw-admin-x" data-act="close" aria-label="Close">×</button>
      </div>
      <div class="mw-admin-section" data-cat="combat" data-key="dogfight">
        <div class="mw-admin-label">dogfight</div>
        <button data-act="combat">pelican vs banshee</button>
      </div>
      <div class="mw-admin-section" data-cat="combat" data-key="dogfight-patterns">
        <div class="mw-admin-label">dogfight pattern</div>
        <button data-act="combat-across_behind">across · behind title</button>
        <button data-act="combat-fly_toward">fly toward camera</button>
        <button data-act="combat-fly_over">fly over title</button>
        <button data-act="combat-cross_in_front">cross in front</button>
        <button data-act="combat-weave_near">weave near title</button>
        <div class="mw-admin-hint" id="mw-admin-focus-hint"></div>
      </div>
      <div class="mw-admin-section" data-cat="scripted" data-key="cinematic">
        <div class="mw-admin-label">cinematic</div>
        <button data-act="scen-observer">silent observer</button>
        <button data-act="scen-ghost">ghost contact</button>
        <button data-act="scen-orbit">forerunner orbit</button>
        <button data-act="scen-distress">distress beacon</button>
        <button data-act="scen-slipspace">slipspace jump</button>
        <button data-act="scen-mothership">mothership reveal</button>
      </div>
      <div class="mw-admin-section" data-cat="scripted" data-key="fleet">
        <div class="mw-admin-label">fleet ops</div>
        <button data-act="scen-escort">escort run · V-formation</button>
        <button data-act="scen-convoy">convoy · 3 pelicans + cargo</button>
        <button data-act="scen-carrier">carrier launch · 3 longswords</button>
        <button data-act="scen-strafe">longsword strafing run</button>
        <button data-act="scen-interception">interception · 2 vs 1</button>
        <button data-act="scen-fleet">fleet jump-in · 6 ships</button>
      </div>
      <div class="mw-admin-section" data-cat="scripted" data-key="action">
        <div class="mw-admin-label">action · debris</div>
        <button data-act="scen-scanner">scanner sweep</button>
        <button data-act="scen-landing">emergency landing</button>
        <button data-act="scen-derelict">derelict drift · sparking</button>
        <button data-act="scen-debris">debris field cross</button>
        <button data-act="scen-crash">crash dive · smoke trail</button>
        <button data-act="scen-storm">plasma storm</button>
      </div>
      <div class="mw-admin-section" data-cat="camera" data-key="camera">
        <div class="mw-admin-label">camera</div>
        <button data-act="follow-toggle" id="mw-admin-follow-btn">scenario follow-cam: <span id="mw-admin-follow-state">auto</span></button>
        <button data-act="reset-cam">reset camera</button>
      </div>
      <div class="mw-admin-section" data-cat="spawn" data-key="spawn">
        <div class="mw-admin-label">spawn ship</div>
        <button data-act="spawn-longsword">longsword (solo)</button>
        <button data-act="spawn-longsword-v">longsword (V-formation)</button>
        <button data-act="spawn-banshee">banshee</button>
        <button data-act="spawn-pelican">pelican (no combat)</button>
        <button data-act="spawn-forerunner">forerunner</button>
      </div>
      <div class="mw-admin-section" data-cat="fx" data-key="fx"><div class="mw-admin-label">post fx</div>
        <button data-act="fx-flares"   id="mw-fx-flares">anamorphic flares: <span>ON</span></button>
        <button data-act="fx-dirt"     id="mw-fx-dirt">lens dirt: <span>ON</span></button>
        <button data-act="fx-godrays"  id="mw-fx-godrays">god rays (core): <span>ON</span></button>
        <button data-act="fx-dof"      id="mw-fx-dof">soft DoF: <span>OFF</span></button>
        <button data-act="fx-halation" id="mw-fx-halation">halation: <span>OFF</span></button>
        <button data-act="fx-halo-auto" id="mw-fx-halo-auto">↻ halation auto: <span>OFF</span></button>
        <button data-act="fx-grade"    id="mw-fx-grade">color grade: <span>OFF</span></button>
        <button data-act="fx-grade-auto" id="mw-fx-grade-auto">↻ grade auto: <span>OFF</span></button>
      </div>
      <div class="mw-admin-section" data-cat="camera" data-key="feel">
        <div class="mw-admin-label">feel</div>
        <button data-act="inertia-toggle" id="mw-inertia">drag inertia: <span>ON</span></button>
      </div>
      <div class="mw-admin-section" data-cat="elements" data-key="elements">
        <div class="mw-admin-label">scene elements</div>
        <button data-act="el-nebula"    id="mw-el-nebula">nebula: <span>ON</span></button>
        <button data-act="el-haze"      id="mw-el-haze">haze: <span>ON</span></button>
        <button data-act="el-satellites" id="mw-el-satellites">satellites: <span>ON</span></button>
        <button data-act="el-shards"    id="mw-el-shards">shards: <span>ON</span></button>
        <button data-act="el-fragments" id="mw-el-fragments">text fragments: <span>ON</span></button>
        <button data-act="el-streaks"   id="mw-el-streaks">streaks: <span>ON</span></button>
        <button data-act="el-fog"       id="mw-el-fog">fog patches: <span>ON</span></button>
        <button data-act="el-core"      id="mw-el-core">distant core: <span>ON</span></button>
        <button data-act="el-marathon"  id="mw-el-marathon">marathon ship: <span>ON</span></button>
        <button data-act="el-buoys"     id="mw-el-buoys">nav buoys: <span>ON</span></button>
      </div>
      <div class="mw-admin-section" data-cat="time" data-key="time">
        <div class="mw-admin-label">time</div>
        <button data-act="time-pause" id="mw-time-pause">⏸ pause</button>
        <button data-act="time-0.25">0.25×</button>
        <button data-act="time-0.5">0.5×</button>
        <button data-act="time-1">1× (normal)</button>
        <button data-act="time-2">2×</button>
      </div>
      <div class="mw-admin-section" data-cat="capture" data-key="capture">
        <div class="mw-admin-label">capture</div>
        <button data-act="cap-png">📸 save canvas as PNG</button>
        <button data-act="cap-hud" id="mw-cap-hud">hide HUD: <span>OFF</span></button>
        <button data-act="cap-random">🎲 hop to random title</button>
        <button data-act="cap-fov-down">FOV −5° (zoom in)</button>
        <button data-act="cap-fov-up">FOV +5° (zoom out)</button>
        <button data-act="cap-fov-reset">FOV reset (80°)</button>
      </div>
      <div class="mw-admin-section" data-cat="stage" data-key="stage">
        <div class="mw-admin-label">stage</div>
        <button data-act="clear">clear all flybys</button>
        <button data-act="hue-toggle">toggle hue auto-flow</button>
        <button data-act="hue-bump">bump hue +0.1</button>
      </div>
      <div class="mw-admin-foot">~ to toggle</div>
    `;
    root.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      e.stopPropagation();
      const act = btn.dataset.act;
      try {
        if (act === 'close') this._toggleAdmin();
        else if (act === 'combat') this._adminTriggerCombat();
        else if (act && act.startsWith('combat-')) {
          const pat = act.slice('combat-'.length);
          if (!this.focused) {
            this._flashHint('focus a title first — patterns need a target', 'warn');
          }
          this._adminTriggerCombat(pat);
        }
        else if (act === 'spawn-longsword') this._adminSpawnType('longsword', { group: 1 });
        else if (act === 'spawn-longsword-v') this._adminSpawnType('longsword', { group: 3 });
        else if (act === 'spawn-banshee') this._adminSpawnType('banshee', { group: 1 });
        else if (act === 'spawn-pelican') this._adminSpawnType('pelican', { group: 1, noCombat: true });
        else if (act === 'spawn-forerunner') this._adminSpawnType('forerunner', { group: 1 });
        else if (act === 'clear') this._adminClearFlybys();
        else if (act === 'reset-cam') this._adminResetCamera();
        else if (act === 'follow-toggle') this._adminToggleFollow();
        else if (act === 'hue-toggle') this._hueAuto = (this._hueAuto === false);
        else if (act === 'hue-bump') this._hueShift = ((this._hueShift || 0) + 0.10) % 1;
        else if (act === 'scen-strafe') this._spawnLongswordStrafe();
        else if (act === 'scen-orbit')  this._spawnForerunnerOrbit();
        else if (act === 'scen-storm')  this._spawnPlasmaStorm();
        else if (act === 'scen-slipspace')    this._spawnSlipspaceJump();
        else if (act === 'scen-mothership')   this._spawnMothershipReveal();
        else if (act === 'scen-convoy')       this._spawnConvoy();
        else if (act === 'scen-crash')        this._spawnCrashDive();
        else if (act === 'scen-fleet')        this._spawnFleetJumpIn();
        else if (act === 'scen-derelict')     this._spawnDerelictDrift();
        else if (act === 'scen-interception') this._spawnInterception();
        else if (act === 'scen-distress')     this._spawnDistressBeacon();
        else if (act === 'scen-debris')       this._spawnDebrisCross();
        else if (act === 'scen-scanner')      this._spawnScannerSweep();
        else if (act === 'scen-landing')      this._spawnEmergencyLanding();
        else if (act === 'scen-ghost')        this._spawnGhostContact();
        else if (act === 'scen-carrier')      this._spawnCarrierLaunch();
        else if (act === 'scen-escort')       this._spawnEscortRun();
        else if (act === 'scen-observer')     this._spawnSilentObserver();
        else if (act === 'fx-flares')   this._adminToggleFx('uFlaresOn');
        else if (act === 'fx-dirt')     this._adminToggleFx('uDirtOn');
        else if (act === 'fx-godrays')  this._adminToggleFx('uGodraysOn');
        else if (act === 'fx-dof')      this._adminToggleFx('uDofOn');
        else if (act === 'fx-halation') this._adminCycleFx('uHaloStyle', 5);   // 0..4
        else if (act === 'fx-grade')    this._adminCycleFx('uGradeStyle', 6);  // 0..5
        else if (act === 'fx-halo-auto')  this._adminToggleAutoCycle('halo');
        else if (act === 'fx-grade-auto') this._adminToggleAutoCycle('grade');
        else if (act === 'inertia-toggle') this._adminToggleInertia();
        else if (act && act.startsWith('el-'))  this._adminToggleElement(act.slice(3));
        else if (act === 'time-pause') this._adminTogglePause();
        else if (act && act.startsWith('time-')) this._adminSetTimeScale(parseFloat(act.slice(5)));
        else if (act === 'cap-png')    this._adminSaveScreenshot();
        else if (act === 'cap-hud')    this._adminToggleHud();
        else if (act === 'cap-random') this._adminHopRandomTitle();
        else if (act === 'cap-fov-down')  this._adminBumpFov(-5);
        else if (act === 'cap-fov-up')    this._adminBumpFov(+5);
        else if (act === 'cap-fov-reset') this._adminBumpFov(0, 80);
      } catch (err) { console.warn('[admin]', act, err); }
    });
    // Update the focus-hint text when the panel opens / when focus changes.
    this._adminUpdateHints = () => {
      const hint = root.querySelector('#mw-admin-focus-hint');
      if (hint) {
        hint.textContent = this.focused
          ? `target: ${this.focused.track.title.toLowerCase()}`
          : '(no title focused → patterns will fall back to random pass)';
      }
      const fs = root.querySelector('#mw-admin-follow-state');
      if (fs) fs.textContent = this._followDisabled ? 'OFF' : 'auto';
      // FX toggles
      const flag = (id, on) => {
        const el = root.querySelector('#' + id);
        if (el) {
          const sp = el.querySelector('span');
          if (sp) sp.textContent = on ? 'ON' : 'OFF';
          el.classList.toggle('mw-fx-on', !!on);
        }
      };
      const u = this.postPass ? this.postPass.uniforms : null;
      if (u) {
        flag('mw-fx-flares',  u.uFlaresOn.value > 0.5);
        flag('mw-fx-dirt',    u.uDirtOn.value > 0.5);
        flag('mw-fx-godrays', u.uGodraysOn.value > 0.5);
        flag('mw-fx-dof',     u.uDofOn.value > 0.5);
        // Cycle labels
        const haloNames  = ['OFF', 'Vision3', 'Portra', 'CineStill', 'Eterna'];
        const gradeNames = ['OFF', 'Bleach', 'Teal-Orange', 'Cyber', 'Cold', 'Warm'];
        const haloIdx  = Math.round(u.uHaloStyle.value)  % haloNames.length;
        const gradeIdx = Math.round(u.uGradeStyle.value) % gradeNames.length;
        const haloEl  = root.querySelector('#mw-fx-halation');
        const gradeEl = root.querySelector('#mw-fx-grade');
        if (haloEl)  { haloEl.querySelector('span').textContent  = haloNames[haloIdx];  haloEl.classList.toggle('mw-fx-on',  haloIdx  > 0); }
        if (gradeEl) { gradeEl.querySelector('span').textContent = gradeNames[gradeIdx]; gradeEl.classList.toggle('mw-fx-on', gradeIdx > 0); }
        // Inertia
        const inEl = root.querySelector('#mw-inertia');
        if (inEl) {
          inEl.querySelector('span').textContent = this._inertiaOn ? 'ON' : 'OFF';
          inEl.classList.toggle('mw-fx-on', !!this._inertiaOn);
        }
        // Auto-cycle toggles
        const haEl = root.querySelector('#mw-fx-halo-auto');
        if (haEl) {
          haEl.querySelector('span').textContent = this._autoHalo ? 'ON' : 'OFF';
          haEl.classList.toggle('mw-fx-on', !!this._autoHalo);
        }
        const gaEl = root.querySelector('#mw-fx-grade-auto');
        if (gaEl) {
          gaEl.querySelector('span').textContent = this._autoGrade ? 'ON' : 'OFF';
          gaEl.classList.toggle('mw-fx-on', !!this._autoGrade);
        }
      }
      // Scene element states
      const elState = (id, visible) => {
        const el = root.querySelector('#' + id);
        if (!el) return;
        const sp = el.querySelector('span');
        if (sp) sp.textContent = visible ? 'ON' : 'OFF';
        el.classList.toggle('mw-fx-on', !!visible);
      };
      elState('mw-el-nebula',     this.nebula ? this.nebula.visible : true);
      elState('mw-el-haze',       this.haze ? this.haze.visible : true);
      elState('mw-el-satellites', this.satellites ? this.satellites.every(s => s.grp.visible) : true);
      elState('mw-el-shards',     this.shards ? this.shards.every(s => s.mesh.visible) : true);
      elState('mw-el-fragments',  this.fragments ? this.fragments.every(f => f.mesh.visible) : true);
      elState('mw-el-streaks',    this.streaks ? this.streaks.every(s => s.mesh.visible) : true);
      elState('mw-el-fog',        this.fogPatches ? this.fogPatches.every(f => f.visible) : true);
      elState('mw-el-core',       this.coreGroup ? this.coreGroup.visible : true);
      elState('mw-el-marathon',   this.marathonShip ? this.marathonShip.grp.visible : true);
      elState('mw-el-buoys',      this.navBuoys ? this.navBuoys.every(b => b.grp.visible) : true);
      // HUD hidden state
      const hudBtn = root.querySelector('#mw-cap-hud');
      if (hudBtn) {
        const hidden = this._hudHidden;
        const sp = hudBtn.querySelector('span');
        if (sp) sp.textContent = hidden ? 'ON' : 'OFF';
        hudBtn.classList.toggle('mw-fx-on', !!hidden);
      }
      // Pause state
      const pauseBtn = root.querySelector('#mw-time-pause');
      if (pauseBtn) {
        pauseBtn.textContent = this._paused ? '▶ resume' : '⏸ pause';
        pauseBtn.classList.toggle('mw-fx-on', !!this._paused);
      }
    };
    this._adminUpdateHints();
    this._initAdminCollapse(root);
    return root;
  },

  // Wraps each admin section's body in a collapsible div. Header click toggles
  // it, state persisted to localStorage so reloads keep the user's layout.
  _initAdminCollapse(root){
    const STORAGE = 'mw-admin-collapse-v1';
    let state = {};
    try { state = JSON.parse(localStorage.getItem(STORAGE) || '{}') || {}; } catch (_) { state = {}; }
    root.querySelectorAll('.mw-admin-section').forEach(sec => {
      const key = sec.dataset.key;
      if (!key) return;
      const label = sec.querySelector('.mw-admin-label');
      if (!label) return;
      const body = document.createElement('div');
      body.className = 'mw-admin-body';
      while (label.nextSibling) body.appendChild(label.nextSibling);
      sec.appendChild(body);
      label.classList.add('mw-collapsible');
      const setOpen = (open) => {
        sec.classList.toggle('mw-collapsed', !open);
        body.classList.toggle('is-hidden', !open);
      };
      setOpen(state[key] !== false);   // default = open
      label.addEventListener('click', e => {
        e.stopPropagation();
        const isOpen = !sec.classList.contains('mw-collapsed');
        setOpen(!isOpen);
        state[key] = !isOpen;
        try { localStorage.setItem(STORAGE, JSON.stringify(state)); } catch (_) {}
      });
    });
  },

  _adminToggleElement(key){
    const setVis = (target, vis) => {
      if (!target) return;
      if (Array.isArray(target)) target.forEach(t => { if (t.mesh) t.mesh.visible = vis; else if (t.grp) t.grp.visible = vis; else t.visible = vis; });
      else target.visible = vis;
    };
    const map = {
      nebula:     () => this.nebula,
      haze:       () => this.haze,
      satellites: () => this.satellites,
      shards:     () => this.shards,
      fragments:  () => this.fragments,
      streaks:    () => this.streaks,
      fog:        () => this.fogPatches,
      core:       () => this.coreGroup,
      marathon:   () => this.marathonShip ? this.marathonShip.grp : null,
      buoys:      () => this.navBuoys,
    };
    const getter = map[key];
    if (!getter) return;
    const target = getter();
    if (!target) return;
    // Determine current state
    let cur;
    if (Array.isArray(target)) cur = target.length > 0 && (target[0].mesh ? target[0].mesh.visible : (target[0].grp ? target[0].grp.visible : target[0].visible));
    else cur = target.visible;
    setVis(target, !cur);
    if (this._adminUpdateHints) this._adminUpdateHints();
  },

  _adminTogglePause(){
    this._paused = !this._paused;
    if (this._adminUpdateHints) this._adminUpdateHints();
  },

  _adminSetTimeScale(s){
    if (!isFinite(s) || s <= 0) return;
    this._timeScale = s;
    this._paused = false;
    if (this._adminUpdateHints) this._adminUpdateHints();
    if (this._flashHint) this._flashHint(`time scale: ${s}×`, 'info');
  },

  _adminSaveScreenshot(){
    if (!this.renderer) return;
    try {
      // Render once to be sure the back buffer is current.
      this.composer.render();
      const url = this.renderer.domElement.toDataURL('image/png');
      const a = document.createElement('a');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.download = `cantmute-${stamp}.png`;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (this._flashHint) this._flashHint('saved canvas as PNG', 'info');
    } catch (e) {
      console.warn('[admin] screenshot failed', e);
      if (this._flashHint) this._flashHint('screenshot failed (CORS?)', 'warn');
    }
  },

  _adminToggleHud(){
    this._hudHidden = !this._hudHidden;
    if (this.hudEl) this.hudEl.style.display = this._hudHidden ? 'none' : '';
    if (this._adminUpdateHints) this._adminUpdateHints();
  },

  _adminHopRandomTitle(){
    if (!this.titles || !this.titles.length) return;
    const pick = this.titles[(Math.random() * this.titles.length) | 0];
    if (this.focused) this._release();
    this._focus(pick, { mode: 'look' });
  },

  _adminBumpFov(delta, absolute){
    if (!this.camera) return;
    const cur = this.camera.fov;
    const next = absolute != null ? absolute : Math.max(30, Math.min(120, cur + delta));
    this.camera.fov = next;
    this.camera.updateProjectionMatrix();
    if (this._flashHint) this._flashHint(`FOV: ${next}°`, 'info');
  },

  _adminToggleFx(uniformKey){
    if (!this.postPass) return;
    const u = this.postPass.uniforms[uniformKey];
    if (!u) return;
    u.value = u.value > 0.5 ? 0 : 1;
    if (this._adminUpdateHints) this._adminUpdateHints();
  },

  // Cycle a multi-state uniform (0..modulo-1). Used for halation + color grade.
  _adminCycleFx(uniformKey, modulo){
    if (!this.postPass) return;
    const u = this.postPass.uniforms[uniformKey];
    if (!u) return;
    u.value = (Math.round(u.value) + 1) % modulo;
    if (this._adminUpdateHints) this._adminUpdateHints();
  },

  _adminToggleInertia(){
    this._inertiaOn = !this._inertiaOn;
    if (!this._inertiaOn) {
      // Snap velocities to zero so the camera doesn't drift after disable.
      this._dragVel = { yaw: 0, pitch: 0 };
    }
    if (this._adminUpdateHints) this._adminUpdateHints();
  },

  _adminToggleAutoCycle(which){
    if (which === 'halo')  { this._autoHalo  = !this._autoHalo;  this._autoHaloT  = 0; }
    if (which === 'grade') { this._autoGrade = !this._autoGrade; this._autoGradeT = 0; }
    if (this._adminUpdateHints) this._adminUpdateHints();
  },

  _flashHint(msg, level){
    if (!this.adminEl) return;
    let bar = this.adminEl.querySelector('.mw-admin-flash');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'mw-admin-flash';
      this.adminEl.appendChild(bar);
    }
    bar.textContent = msg;
    bar.dataset.level = level || 'info';
    clearTimeout(this._flashTimer);
    bar.style.opacity = '1';
    this._flashTimer = setTimeout(() => { bar.style.opacity = '0'; }, 2400);
  },

  _adminToggleFollow(){
    this._followDisabled = !this._followDisabled;
    if (this._followDisabled) this._scenarioFollow = null;
    if (this._adminUpdateHints) this._adminUpdateHints();
  },

  _adminTriggerCombat(pattern){
    if (!this.flybyShips) return;
    // Free up a pelican + banshee, then run the existing scenario.
    let pel = this.flybyShips.find(s => s.type === 'pelican' && !s.active);
    let ban = this.flybyShips.find(s => s.type === 'banshee' && !s.active);
    if (!pel) {
      const p = this.flybyShips.find(s => s.type === 'pelican');
      if (p) { p.active = false; p.outer.visible = false; pel = p; }
    }
    if (!ban) {
      const b = this.flybyShips.find(s => s.type === 'banshee');
      if (b) { b.active = false; b.outer.visible = false; ban = b; }
    }
    if (pel && ban) this._spawnPelicanCombat(pel, ban, pattern);
  },

  _adminSpawnType(type, opts){
    if (!this.flybyShips) return;
    opts = opts || {};
    // Free a ship of the requested type (force-clear if none free).
    let ships = this.flybyShips.filter(s => s.type === type && !s.active);
    if (!ships.length) {
      const candidate = this.flybyShips.find(s => s.type === type);
      if (!candidate) return;
      candidate.active = false;
      candidate.outer.visible = false;
      ships = [candidate];
    }
    const groupSize = Math.min(ships.length, Math.max(1, opts.group || 1));

    // Direction + perpendicular offsets (mirror _spawnFlyby).
    const u  = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const rr = Math.sqrt(1 - u * u);
    const dir = new THREE.Vector3(Math.cos(th) * rr, u, Math.sin(th) * rr);
    const helper = Math.abs(dir.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const perp = new THREE.Vector3().crossVectors(dir, helper).normalize();
    perp.applyAxisAngle(dir, Math.random() * Math.PI * 2);
    const perp2 = new THREE.Vector3().crossVectors(dir, perp).normalize();

    const speedMap = {
      longsword:  70 + Math.random() * 35,
      banshee:    80 + Math.random() * 40,
      pelican:    42 + Math.random() * 18,
      forerunner: 28 + Math.random() * 14,
    };
    const speed       = speedMap[type] || 60;
    const spawnRadius = 240 + Math.random() * 80;
    const offset      = 50 + Math.random() * 90;
    const baseStart = new THREE.Vector3()
      .copy(dir).multiplyScalar(-spawnRadius)
      .add(perp.clone().multiplyScalar(offset));

    const slots = [
      { p:  0,    s:  0,   t:  0   },
      { p:  4.5,  s: -2.5, t:  0   },
      { p: -4.5,  s: -2.5, t:  0   },
      { p:  0,    s: -5.0, t:  1.4 },
    ];

    for (let i = 0; i < groupSize; i++) {
      const s = ships[i];
      const slot = slots[i] || slots[0];
      const start = baseStart.clone()
        .add(perp.clone().multiplyScalar(slot.p))
        .add(dir.clone().multiplyScalar(slot.s))
        .add(perp2.clone().multiplyScalar(slot.t));
      s.outer.position.copy(start);
      s.outer.lookAt(start.clone().add(dir));
      s.inner.rotation.set(0, Math.PI, 0);
      s.velocity.copy(dir).multiplyScalar(speed);
      s.rollPhase = Math.random() * Math.PI * 2;
      s.life = 0;
      s.maxLife = (2 * spawnRadius) / speed + 0.5;
      s.active = true;
      s.outer.visible = true;
      // Cleanup any leftover scenario state on this ship.
      if (s.scenario) {
        s.scenario = null;
        if (s.type === 'pelican') {
          s.cargo.visible = false;
          s.hatchAngle = 0;
          s.hatchPivot.rotation.x = 0;
          s.muzzleFlashes && s.muzzleFlashes.forEach(mf => mf.material.opacity = 0);
        }
      }
    }
  },

  _adminClearFlybys(){
    if (!this.flybyShips) return;
    const toDispose = [];
    this.flybyShips.forEach(s => {
      if (s.scenarioCleanup) { try { s.scenarioCleanup(); } catch (_) {} s.scenarioCleanup = null; }
      s.active = false;
      s.outer.visible = false;
      if (s.scenario) {
        s.scenario = null;
        if (s.type === 'pelican') {
          if (s.cargo) s.cargo.visible = false;
          s.hatchAngle = 0;
          if (s.hatchPivot) s.hatchPivot.rotation.x = 0;
          s.muzzleFlashes && s.muzzleFlashes.forEach(mf => mf.material.opacity = 0);
        }
      }
      if (s._ephemeral) toDispose.push(s);
    });
    toDispose.forEach(s => this._disposeEphemeralShip(s));
    // Push the next auto-spawn out a bit so the stage stays clear.
    const now = (this.clock ? this.clock.elapsedTime : 0);
    this._nextFlybyAt = now + 6;
    this._nextScenarioAt = now + 14;   // b189: also delay next scripted scenario
    this._scenarioFollow = null;
  },

  _adminResetCamera(){
    this.gaze.yaw = 0;
    this.gaze.pitch = 0;
    this._targetYaw = null;
    this._targetPitch = null;
    if (this.focused) this._release();
  },

  // Switch the visual focus to whatever track is currently playing in the
  // global audio. Used by HUD prev/next buttons — playback already advanced
  // (via ctx.onPrev/onNext), and we want the camera to ROTATE to the new
  // title's constellation slot (mode 'look') instead of pulling it forward
  // (mode 'fly', used for direct title clicks).
  _syncFocusToCurrent(){
    const cur = this.ctx.getCurrent ? this.ctx.getCurrent() : -1;
    if (cur < 0) return;
    const node = this.titles.find(n => n.index === cur);
    if (!node) return;
    this._focus(node, { skipPlay: true, mode: 'look' });
  },

  _focus(node, opts){
    this.focused = node;
    if (this._adminUpdateHints) this._adminUpdateHints();
    // Two focus modes:
    //   'fly'  (default — direct title clicks) → camera stays put, title flies
    //          forward to a showcase point in front of the camera.
    //   'look' (HUD prev/next) → title stays at its constellation slot, camera
    //          rotates (yaw/pitch lerp) to face the title's basePos. So the
    //          user "looks toward" the new song instead of pulling it to them.
    this.focusMode = (opts && opts.mode) || 'fly';
    if (!opts || !opts.skipPlay) this.ctx.onPlay?.(node.index);

    if (this.focusMode === 'look') {
      // Compute target yaw/pitch from the title's world position. Animate loop
      // lerps gaze.yaw/pitch toward these each frame.
      const p = node.basePos;
      const dist = Math.max(0.001, p.length());
      this._targetYaw   = Math.atan2(p.x, -p.z);
      this._targetPitch = Math.asin(Math.max(-1, Math.min(1, p.y / dist)));
    } else {
      this._targetYaw = null;
      this._targetPitch = null;
    }

    // Camera stays locked at origin. Title flies to a showcase point in front of
    // the camera; distance derived from title width/height + FOV so it fits the
    // viewport with HUD/card headroom on portrait mobile.
    const titleW = node.mesh.geometry.parameters.width;
    const titleH = node.mesh.geometry.parameters.height;
    const fovRadV = this.camera.fov * Math.PI / 180;
    const aspect = this.camera.aspect;
    const fovRadH = 2 * Math.atan(Math.tan(fovRadV / 2) * aspect);
    const distH = (titleW / 2) / Math.tan(fovRadH / 2) / 0.70;
    const distV = (titleH / 2) / Math.tan(fovRadV / 2) / 0.55;
    node.showcaseDist = Math.max(distH, distV, 14);

    // Focus card
    const focus = document.getElementById('tg-focus');
    const t = node.track;
    document.getElementById('tg-focus-title').textContent = t.title.toLowerCase();
    const meta = [];
    if (t.date) meta.push(new Date(t.date).getFullYear());
    if (t.tags && t.tags[0]) meta.push(String(t.tags[0]).toLowerCase());
    if (t.isFeatured) meta.push('featured');
    if (t.isNew) meta.push('new');
    document.getElementById('tg-focus-meta').textContent = meta.join(' · ');
    focus.style.display = '';
    requestAnimationFrame(() => {
      focus.classList.add('on');
      // Glitch type effect on the title
      this._glitchType(document.getElementById('tg-focus-title'), t.title.toLowerCase());
    });
    const hint = document.getElementById('tg-hint');
    if (hint) hint.textContent = 'esc or click background to release';
  },

  _glitchType(el, finalText){
    const chars = '!<>-_\\/[]{}—=+*^?#________';
    let frame = 0;
    const total = 26;
    const step = () => {
      frame++;
      let out = '';
      for (let i = 0; i < finalText.length; i++) {
        const reveal = i < (frame / total) * finalText.length;
        if (reveal) out += finalText[i];
        else out += chars[Math.floor(Math.random() * chars.length)];
      }
      el.textContent = out;
      if (frame < total) requestAnimationFrame(step);
      else el.textContent = finalText;
    };
    step();
  },

  _release(){
    this.focused = null;
    this.focusMode = null;
    this._targetYaw = null;
    this._targetPitch = null;
    const focus = document.getElementById('tg-focus');
    if (focus) {
      focus.classList.remove('on');
      setTimeout(() => { if (!this.focused && focus) focus.style.display = 'none'; }, 350);
    }
    const hint = document.getElementById('tg-hint');
    if (hint) hint.innerHTML = 'drag to look around &nbsp;·&nbsp; click a title';
    if (this._adminUpdateHints) this._adminUpdateHints();
  },

  /* ---------- Loop ---------- */
  animate(){
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.animate);
    const rawDt = Math.min(0.05, this.clock.getDelta());
    // Pause: still re-render so the canvas isn't black, but do no ticks.
    if (this._paused) {
      this.composer.render();
      return;
    }
    const scale = (typeof this._timeScale === 'number') ? this._timeScale : 1;
    const dt = rawDt * scale;
    if (this._virtualT == null) this._virtualT = 0;
    this._virtualT += dt;
    const t = this._virtualT;
    const bass = this._readBass();

    // Camera locked at origin — only orientation responds to drag input.
    // If a 'look' focus is active, lerp gaze yaw/pitch toward the focused
    // title's direction. User dragging cancels the auto-lerp (manual control
    // wins over follow-cam).
    if (this._targetYaw != null) {
      if (this.drag.active) {
        this._targetYaw = null;
        this._targetPitch = null;
      } else {
        // Shortest-path yaw interpolation across the ±π wrap
        let dy = this._targetYaw - this.gaze.yaw;
        if (dy > Math.PI)  dy -= Math.PI * 2;
        if (dy < -Math.PI) dy += Math.PI * 2;
        const k = Math.min(1, dt * 3.5);
        this.gaze.yaw   += dy * k;
        this.gaze.pitch += (this._targetPitch - this.gaze.pitch) * k;
        // Snap & release once close enough — then switch to fly-mode so the
        // title pulls forward into showcase position. Camera rotates first,
        // title zooms in second.
        if (Math.abs(dy) < 0.005 && Math.abs(this._targetPitch - this.gaze.pitch) < 0.005) {
          this.gaze.yaw   = this._targetYaw;
          this.gaze.pitch = this._targetPitch;
          this._targetYaw = null;
          this._targetPitch = null;
          if (this.focusMode === 'look' && this.focused) this.focusMode = 'fly';
        }
      }
    }

    // Scenario follow-cam: when a scripted dogfight is active and the user is
    // NOT focused on a title and NOT manually dragging, gaze tracks the
    // centroid of the scenario ships so the action stays on screen.
    if (this._scenarioFollow && !this.focused && !this.drag.active && this._targetYaw == null) {
      const ships = this._scenarioFollow.ships.filter(sh => sh && sh.active && sh.scenario);
      if (ships.length === 0) {
        this._scenarioFollow = null;
      } else {
        const centroid = new THREE.Vector3();
        ships.forEach(sh => centroid.add(sh.outer.position));
        centroid.divideScalar(ships.length);
        const dist = Math.max(0.001, centroid.length());
        const targetYaw   = Math.atan2(centroid.x, -centroid.z);
        const targetPitch = Math.asin(Math.max(-1, Math.min(1, centroid.y / dist)));
        // Slower than focus-look (3.5) so the camera glides instead of snapping.
        const k = Math.min(1, dt * 1.6);
        let dy = targetYaw - this.gaze.yaw;
        if (dy > Math.PI)  dy -= Math.PI * 2;
        if (dy < -Math.PI) dy += Math.PI * 2;
        this.gaze.yaw   += dy * k;
        this.gaze.pitch += (targetPitch - this.gaze.pitch) * k;
      }
    }
    // Drop the follow handle if both ships finished (covers natural lifetime end).
    if (this._scenarioFollow) {
      const stillActive = this._scenarioFollow.ships.some(sh => sh && sh.active && sh.scenario);
      if (!stillActive) this._scenarioFollow = null;
    }

    const fwd = this._forwardVec();
    const lookDist = 80;
    const desiredLookAt = fwd.clone().multiplyScalar(lookDist);
    this.cam.lookAt.lerp(desiredLookAt, 0.30);
    this.camera.position.set(0, 0, 0);
    this.camera.lookAt(this.cam.lookAt);

    if (this.haze) {
      this.haze.material.uniforms.uTime.value = t;
      this.haze.material.uniforms.uBass.value = bass;
    }
    this._tickStreaks(t, dt);
    this._tickSatellites(t, dt, bass);
    this._tickShards(t, dt, bass);
    this._tickFlyby(t, dt);
    this._tickBolts(t, dt);
    this._tickCore(t, bass);
    this._tickMarathonShip(t, bass);
    this._tickNavBuoys(t, bass);
    this._updatePlayer();
    if (this.nebula) {
      this.nebula.material.uniforms.uTime.value = t;
      this.nebula.material.uniforms.uBass.value = bass;
      // Slow rotation so the cloud field appears to slide past the viewer
      // even when they're not actively looking around.
      this.nebula.rotation.y = t * 0.0035;
      this.nebula.rotation.x = Math.sin(t * 0.012) * 0.10;
    }

    // Fog patches drift slowly + breathe with bass
    if (this.fogPatches) {
      this.fogPatches.forEach((sp, i) => {
        const u = sp.userData;
        sp.position.y = u.baseY + Math.sin(t * 0.18 + u.seed * 1.7) * 3.0;
        const baseOp = 0.18 + (i % 3) * 0.05;
        sp.material.opacity = baseOp + bass * 0.20;
      });
    }

    // Floating text fragments — per-fragment blink state machine + periodic
    // text swap. Each scrap cycles: on (steady glow) → glitch_out (stuttering
    // flicker, max glitch) → off (gone) → on (new cryptic text reappears).
    if (this.fragments) {
      // Throttle texture rebuilds to one fragment per frame to keep GC sane.
      this._fragSwapBudget = 1;
      this.fragments.forEach((f, i) => {
        const u = f.mat.uniforms;
        u.uTime.value = t + i * 0.7;
        u.uBass.value = bass * 0.6;
        this._tickFragment(f, t, dt);
      });
    }

    // Random glitch burst — pick a fresh title every ~3s and crank its hover
    // briefly so the constellation always has a flickering survivor somewhere.
    if (this._burstNext == null) this._burstNext = t + 0.4;
    if (t >= this._burstNext && this.titles.length > 0) {
      const live = this.focused
        ? this.titles.filter(n => n.index !== this.focused.index)
        : this.titles;
      const pick = live[(Math.random() * live.length) | 0];
      if (pick) pick._burstUntil = t + 0.35 + Math.random() * 0.45;
      this._burstNext = t + 2.0 + Math.random() * 3.0;
    }

    // Color flow — global hue shift advances slowly so the entire constellation
    // breathes through the spectrum. Each title also gets a small phase offset
    // (from its flickerSeed) so neighbors don't move in perfect lockstep.
    if (this._hueAuto !== false) {
      this._hueShift = ((this._hueShift || 0) + dt * 0.045) % 1;
    }
    const hueGlobal = this._hueShift || 0;

    // Per-title glitch + hover/focus + opacity + position (fly-in/return + idle drift).
    // Focused title chases a showcase point in front of the camera; non-focused
    // titles ease back to their basePos slot, with a gentle per-title bob so the
    // sphere never reads as a frozen wall.
    const fwdNow = this._forwardVec();
    const tmpDrift = new THREE.Vector3();
    this.titles.forEach(n => {
      const u = n.mesh.material.uniforms;
      u.uTime.value = t + n.flickerSeed;
      u.uBass.value = bass;
      // Per-title phase = base hue stays put when shift=0; offset by ~10% of
      // title-seed so titles in the same tag-bin still drift apart over time.
      u.uHueShift.value = (hueGlobal + (n.flickerSeed % 1) * 0.10) % 1;
      const isHover = this.hovered && this.hovered.index === n.index;
      const isFocus = this.focused && this.focused.index === n.index;
      const isBurst = (n._burstUntil || 0) > t;
      const targetH = isHover ? 1.0 : (isBurst ? 0.55 : 0);
      u.uHover.value += (targetH - u.uHover.value) * Math.min(1, dt * (isHover ? 9 : 5));
      const targetF = isFocus ? 1 : 0;
      u.uFocus.value += (targetF - u.uFocus.value) * Math.min(1, dt * 6);
      let targetOp;
      if (this.focused) targetOp = isFocus ? 1.0 : 0.10;
      else targetOp = n.baseOpacity;
      u.uOpacity.value += (targetOp - u.uOpacity.value) * Math.min(1, dt * 5);

      let targetPos;
      if (isFocus && this.focusMode === 'fly') {
        targetPos = fwdNow.clone().multiplyScalar(n.showcaseDist || 18);
      } else {
        // Idle drift OR look-mode focus: title stays at its constellation slot
        // with gentle bobbing.
        const ph = n.flickerSeed;
        tmpDrift.set(
          Math.sin(t * 0.42 + ph)        * 1.4,
          Math.cos(t * 0.31 + ph * 1.7)  * 1.0,
          Math.sin(t * 0.27 + ph * 0.8)  * 1.2
        );
        targetPos = n.basePos.clone().add(tmpDrift);
      }
      n.mesh.position.lerp(targetPos, Math.min(1, dt * (isFocus ? 9 : 3)));
    });

    // ---- Auto-cycle halation + color grade (b172) ----
    // Advance the cycle uniform every N seconds, skipping OFF (=0) so the
    // user is always seeing a non-blank look.
    if (this.postPass) {
      const HALO_PERIOD = 6.0;
      const GRADE_PERIOD = 9.0;
      if (this._autoHalo) {
        this._autoHaloT += dt;
        if (this._autoHaloT >= HALO_PERIOD) {
          this._autoHaloT = 0;
          const u = this.postPass.uniforms.uHaloStyle;
          let v = (Math.round(u.value) + 1) % 5;
          if (v === 0) v = 1;  // skip OFF when auto-cycling
          u.value = v;
          if (this._adminUpdateHints) this._adminUpdateHints();
        }
      }
      if (this._autoGrade) {
        this._autoGradeT += dt;
        if (this._autoGradeT >= GRADE_PERIOD) {
          this._autoGradeT = 0;
          const u = this.postPass.uniforms.uGradeStyle;
          let v = (Math.round(u.value) + 1) % 6;
          if (v === 0) v = 1;
          u.value = v;
          if (this._adminUpdateHints) this._adminUpdateHints();
        }
      }
    }

    // ---- Drag inertia (b171) ----
    // Apply residual drag velocity after release, decay over ~0.6s.
    if (this._inertiaOn && !this.drag.active && this._dragVel) {
      const speed2 = this._dragVel.yaw * this._dragVel.yaw + this._dragVel.pitch * this._dragVel.pitch;
      if (speed2 > 0.000004) {
        this.gaze.yaw   += this._dragVel.yaw   * dt;
        this.gaze.pitch += this._dragVel.pitch * dt;
        // Exponential decay — half-life ~0.18s feels right
        const decay = Math.exp(-dt * 4.0);
        this._dragVel.yaw   *= decay;
        this._dragVel.pitch *= decay;
        const lim = 1.10;
        if (this.gaze.pitch >  lim) { this.gaze.pitch =  lim; this._dragVel.pitch = 0; }
        if (this.gaze.pitch < -lim) { this.gaze.pitch = -lim; this._dragVel.pitch = 0; }
      }
    }

    if (this.postPass) {
      this.postPass.uniforms.uTime.value = t;
      this.postPass.uniforms.uBass.value = bass;
      // Project the distant core's world position to NDC for god-ray source.
      if (this.coreGroup && this.postPass.uniforms.uGodraysOn.value > 0.5) {
        const v = this.coreGroup.position.clone().project(this.camera);
        this.postPass.uniforms.uGodRaySource.value.set(v.x, v.y);
      }
      // ---- Soft DoF focus point (b171) ----
      // Project the focused title's world position to UV space. When nothing
      // is focused, place focus at screen center with full sharpness radius
      // so the whole frame stays sharp.
      if (this.postPass.uniforms.uDofOn.value > 0.5) {
        if (this.focused && this.focused.mesh) {
          const v = this.focused.mesh.position.clone().project(this.camera);
          // NDC (-1..1) → UV (0..1)
          this.postPass.uniforms.uFocusUv.value.set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5);
          this.postPass.uniforms.uFocusRadius.value = 0.22;
        } else {
          this.postPass.uniforms.uFocusUv.value.set(0.5, 0.5);
          this.postPass.uniforms.uFocusRadius.value = 1.5;  // basically no blur
        }
      }
    }
    if (this.bloom) {
      this.bloom.strength = 0.80 + bass * 0.45;
    }

    const tcEl = document.getElementById('tg-tc');
    if (tcEl) {
      const total = Math.floor(t);
      const mm = String(Math.floor(total / 60)).padStart(2, '0');
      const ss = String(total % 60).padStart(2, '0');
      tcEl.textContent = `${mm}:${ss}`;
    }

    this.composer.render();
  },

  destroy(){
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('pointerup', this._onPointerUp);
    if (this.composer) {
      try { this.composer.passes.forEach(p => p.dispose?.()); } catch (e) {}
    }
    if (this.renderer) {
      try { this.renderer.dispose(); } catch (e) {}
      try { this.renderer.domElement.remove(); } catch (e) {}
    }
    if (this.scene) {
      this.scene.traverse(o => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(m => {
            if (m.uniforms?.uTex?.value) m.uniforms.uTex.value.dispose?.();
            if (m.map) m.map.dispose?.();
            m.dispose?.();
          });
        }
      });
    }
    if (this.hudEl) this.hudEl.remove();
    if (this.adminEl) this.adminEl.remove();
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.composer = null;
    this.postPass = null;
    this.bloom = null;
    this.haze = null;
    this.titles = [];
    this.hovered = null;
    this.focused = null;
    this.hudEl = null;
    this.adminEl = null;
    this.container = null;
  },
};

window.MarathonWorld = MarathonWorld;
