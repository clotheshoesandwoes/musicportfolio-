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
  uniform float uBreath;    // b192: ±~0.05 brightness offset for slow per-title breathing
  uniform float uTwinkle;   // b192: 0..1 brief brightness flash for one-at-a-time twinkles
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
    // b192: gentle breath + rare twinkle. Breath gives every title a slow,
    // randomized brightness wobble (fights the "frozen wall" feel); twinkle
    // is a brief one-at-a-time flash from the scheduler.
    col *= (1.0 + uBreath + uTwinkle * 0.85);
    a *= uOpacity * (1.0 + uBreath * 0.6 + uTwinkle * 0.25);
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
    // g8 — global breath scalar driven by bass. Titles' basePos is multiplied
    // by (1 + _breath * coef) so the whole constellation inhales/exhales with
    // music. Smoothed via per-frame lerp to avoid sub-frame jitter.
    this._breath = 0;

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

    this.camera = new THREE.PerspectiveCamera(80, 1, 0.1, 2400);
    this.camera.position.copy(this.cam.pos);

    this._buildNebula();
    this._buildStarfield();
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
    this._buildHaloRing();
    this._buildTraveler();
    this._buildNavBuoys();
    this._buildNeuronThreads();

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
          uTex:      { value: tex },
          uTime:     { value: Math.random() * 100 },
          uHover:    { value: 0 },
          uFocus:    { value: 0 },
          uBass:     { value: 0 },
          uOpacity:  { value: 0.18 + Math.random() * 0.18 },
          uTint:     { value: new THREE.Vector3(0.55, 0.62, 0.72) },
          uHueShift: { value: 0 },
          uBreath:   { value: 0 },   // b192 (kept zero on fragments; TITLE_FRAGMENT shader expects it)
          uTwinkle:  { value: 0 },   // b192
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

  /* ---------- Starfield (b192) ---------- */
  // Far-distance twinkling point cloud BEHIND the titles. Each star carries
  // its own phase + rate so the field reads as scintillating, never in lockstep.
  // Goal: kill the "frozen wall of titles in dead space" feeling without
  // pulling the eye away from the song titles themselves.
  _buildStarfield(){
    const COUNT = 2200;
    const positions = new Float32Array(COUNT * 3);
    const phases    = new Float32Array(COUNT);
    const rates     = new Float32Array(COUNT);
    const sizes     = new Float32Array(COUNT);
    const tones     = new Float32Array(COUNT);  // 0 = cool blue-white, 1 = warm peach
    for (let i = 0; i < COUNT; i++) {
      // Uniform-on-sphere distribution
      const u  = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(1 - u * u);
      const r  = 380 + Math.random() * 70;
      positions[i*3 + 0] = Math.cos(th) * rr * r;
      positions[i*3 + 1] = u * r;
      positions[i*3 + 2] = Math.sin(th) * rr * r;
      phases[i]  = Math.random() * Math.PI * 2;
      rates[i]   = 0.4 + Math.random() * 2.1;       // Hz-ish per-star twinkle
      // Size — pareto-ish so most stars are tiny, a few are noticeably bright.
      const s = Math.random();
      sizes[i]   = (s < 0.85) ? (0.6 + s * 1.0) : (1.7 + (s - 0.85) * 6.0);
      tones[i]   = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aPhase',   new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aRate',    new THREE.BufferAttribute(rates, 1));
    geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aTone',    new THREE.BufferAttribute(tones, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPxr:  { value: this.renderer ? this.renderer.getPixelRatio() : 1 },
      },
      vertexShader: `
        attribute float aPhase;
        attribute float aRate;
        attribute float aSize;
        attribute float aTone;
        uniform float uTime;
        uniform float uPxr;
        varying float vTwinkle;
        varying float vTone;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          // Smooth oscillation 0.25..1.0 — never goes fully off, just dim/bright
          float t = 0.625 + 0.375 * sin(uTime * aRate + aPhase);
          vTwinkle = t;
          vTone    = aTone;
          // Far-distance scaling so points read at a stable angular size
          gl_PointSize = uPxr * aSize * (0.85 + t * 0.7) * (90.0 / max(-mv.z, 1.0));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying float vTwinkle;
        varying float vTone;
        void main(){
          vec2 d = gl_PointCoord - vec2(0.5);
          float r2 = dot(d, d) * 4.0;
          if (r2 > 1.0) discard;
          float a = pow(1.0 - r2, 1.5) * vTwinkle;
          // Cool blue-white ↔ warm peach mix for color variety
          vec3 cool = vec3(0.82, 0.92, 1.00);
          vec3 warm = vec3(1.00, 0.93, 0.80);
          vec3 col  = mix(cool, warm, smoothstep(0.55, 0.95, vTone));
          gl_FragColor = vec4(col, a * 0.95);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.renderOrder = -1;            // paint before titles
    this.scene.add(points);
    this.starfield = { points, mat, geo };
  },

  _tickStarfield(t){
    if (this.starfield) this.starfield.mat.uniforms.uTime.value = t;
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
    // three.js Object3D.lookAt aims the +Z axis at the target (NOT -Z — that's
    // the camera/light convention). Ship models are built with nose at local -Z,
    // so flipping inner 180° around Y puts the nose at outer's +Z and lookAt
    // aims the nose along velocity. Removing this flip makes ships fly tail-first.
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
    // three.js Object3D.lookAt aims the +Z axis at the target (NOT -Z — that's
    // the camera/light convention). Ship models are built with nose at local -Z,
    // so flipping inner 180° around Y puts the nose at outer's +Z and lookAt
    // aims the nose along velocity. Removing this flip makes ships fly tail-first.
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
    // three.js Object3D.lookAt aims the +Z axis at the target (NOT -Z — that's
    // the camera/light convention). Ship models are built with nose at local -Z,
    // so flipping inner 180° around Y puts the nose at outer's +Z and lookAt
    // aims the nose along velocity. Removing this flip makes ships fly tail-first.
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
    // three.js Object3D.lookAt aims the +Z axis at the target (NOT -Z — that's
    // the camera/light convention). Ship models are built with nose at local -Z,
    // so flipping inner 180° around Y puts the nose at outer's +Z and lookAt
    // aims the nose along velocity. Removing this flip makes ships fly tail-first.
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
    // Mothership model's bridge (front) sits at local +X, engine glow at -X
    // — non-standard for this codebase (flyby ships use -Z forward). Compute
    // the Y rotation that aligns local +X with the velocity direction, then
    // add a small cinematic yaw tilt for asymmetry. Pre-g7 was just the tilt
    // term, leaving the bridge ~165° off velocity → mothership flew engine-
    // first ("flying backward toward the exhaust flame").
    const velDir = right.clone().multiplyScalar(-sideSign);
    grp.rotation.y = Math.atan2(-velDir.z, velDir.x) + Math.PI * 0.10 * -sideSign;
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
    // b218: lead is now a pelican (UNSC dropship being intercepted by 2 banshee
    // chasers). Heavier, slower, lumbering — no barrel roll, smaller evasive
    // sway. Reads as "transport caught in the open" instead of "fighter duel".
    const lead    = this._acquireShip('pelican');
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
    lead.velocity.copy(dir).multiplyScalar(42);
    lead.life = 0; lead.maxLife = 14; lead.active = true; lead.outer.visible = true;
    lead.scenario = 'interception_target'; lead.scenarioTime = 0;
    lead.scenarioBase = { dir: dir.clone(), perp1: up.clone(), perp2: perp.clone(), speed: 42, seedA: Math.random()*6.28, seedB: Math.random()*6.28 };
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
      c.velocity.copy(dir).multiplyScalar(56);
      c.life = 0; c.maxLife = 14; c.active = true; c.outer.visible = true;
      c.scenario = 'interception_chaser'; c.scenarioTime = 0;
      c.scenarioTargetRef = lead;
      c.scenarioBase = { perp1: up.clone(), perp2: perp.clone(), speed: 56, fireCooldown: 1.0 + i * 0.4, seedA: Math.random()*6.28 };
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
    p.life = 0; p.maxLife = 18; p.active = true; p.outer.visible = true;
    p.scenario = 'distress_beacon'; p.scenarioTime = 0;

    const lightTex = this._makeSatLightTexture();
    const flameTex = this._makeFlameTexture({
      stops: [
        [0.00, 'rgba(255,250,210,1.00)'],
        [0.18, 'rgba(255,200, 80,0.95)'],
        [0.45, 'rgba(255,110, 40,0.65)'],
        [0.75, 'rgba(160, 30, 20,0.25)'],
        [1.00, 'rgba( 40,  6,  4,0.00)'],
      ],
    });

    // Three beacons blinking out of phase: red SOS strobe (top), amber rotating
    // (port wing), white emergency strobe (tail). Reads as multiple-system
    // failure rather than a single broadcaster.
    const mkBeacon = (color, scale, x, y, z) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: lightTex, color, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
      }));
      sp.scale.set(scale, scale, 1);
      sp.position.set(x, y, z);
      p.outer.add(sp);
      return sp;
    };
    const beaconRed   = mkBeacon(0xff3a48, 2.6,  0,    1.4,  0);     // top
    const beaconAmber = mkBeacon(0xffaa30, 1.6, -2.5,  0.2,  0.4);   // port wing
    const beaconWhite = mkBeacon(0xffffff, 1.8,  2.5,  0.2,  0.4);   // starboard wing strobe

    // Two persistent fires anchored to "damaged" hull spots: starboard engine
    // pod and port wing root. Each fire is a small flame quad billboarded as a
    // sprite — flickers in scale + opacity so it never sits still.
    const mkFire = (x, y, z) => {
      const mat = new THREE.SpriteMaterial({
        map: flameTex, color: 0xffffff, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9,
      });
      const sp = new THREE.Sprite(mat);
      sp.scale.set(1.4, 2.0, 1);
      sp.position.set(x, y, z);
      p.outer.add(sp);
      return sp;
    };
    const fireA = mkFire( 3.05, -0.10, 0.5);   // starboard engine
    const fireB = mkFire(-2.20,  0.40, 1.2);   // port wing root

    // Smoke trail: pool of gray puff sprites that periodically launch from
    // the damaged spots and drift backward, fading out. Stored on outer so
    // movements (and the slow listing rotation) carry them naturally — but
    // we want them to drift in WORLD space, so we use scene-space sprites
    // and update positions per-frame from anchor world positions.
    const smokeTex = this._makeFlameTexture({
      stops: [
        [0.00, 'rgba(220,220,220,0.85)'],
        [0.40, 'rgba(110,110,110,0.50)'],
        [0.80, 'rgba( 40, 40, 40,0.20)'],
        [1.00, 'rgba( 20, 20, 20,0.00)'],
      ],
    });
    const smokes = [];
    const SMOKE_POOL = 18;
    for (let i = 0; i < SMOKE_POOL; i++) {
      const mat = new THREE.SpriteMaterial({
        map: smokeTex, color: 0x999999, transparent: true,
        blending: THREE.NormalBlending, depthWrite: false, opacity: 0,
      });
      const sp = new THREE.Sprite(mat);
      sp.scale.set(0.001, 0.001, 1);
      this.scene.add(sp);
      smokes.push({ sprite: sp, mat, life: 0, maxLife: 0,
                    pos: new THREE.Vector3(), vel: new THREE.Vector3(),
                    seedSize: 1, originIdx: 0 });
    }

    // Sparks: short-lived bright flecks that pop from the damaged spots
    // every ~0.4–0.9s, falling slightly with a subtle drift.
    const sparks = [];
    const SPARK_POOL = 14;
    for (let i = 0; i < SPARK_POOL; i++) {
      const mat = new THREE.SpriteMaterial({
        map: lightTex, color: 0xffe0a0, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
      });
      const sp = new THREE.Sprite(mat);
      sp.scale.set(0.001, 0.001, 1);
      this.scene.add(sp);
      sparks.push({ sprite: sp, mat, life: 0, maxLife: 0,
                    pos: new THREE.Vector3(), vel: new THREE.Vector3() });
    }

    p.scenarioBase = {
      beaconRed, beaconAmber, beaconWhite,
      fireA, fireB,
      smokes, sparks,
      smokeNext: 0, sparkNext: 0,
      drift: pos.clone(),
      // Listing tumble — ship slowly rolls/yaws as if attitude control failed.
      listRollV: (Math.random() < 0.5 ? -1 : 1) * (0.08 + Math.random() * 0.06),
      listYawV:  (Math.random() < 0.5 ? -1 : 1) * (0.04 + Math.random() * 0.04),
      hullSeed: Math.random() * 10,
    };
    p.scenarioCleanup = () => {
      [beaconRed, beaconAmber, beaconWhite, fireA, fireB].forEach(s => {
        if (s.parent) s.parent.remove(s);
        if (s.material.map) s.material.map.dispose();
        s.material.dispose();
      });
      smokes.forEach(({ sprite, mat }) => {
        this.scene.remove(sprite);
        if (mat.map) mat.map.dispose();
        mat.dispose();
      });
      sparks.forEach(({ sprite, mat }) => {
        this.scene.remove(sprite);
        if (mat.map) mat.map.dispose();
        mat.dispose();
      });
    };
    if (!this._followDisabled && !this.focused) this._scenarioFollow = { ships: [p] };
    if (this._flashHint) this._flashHint('spawned: distress beacon', 'info');
  },

  // ----- 8b. DISTRESS BOMBING RUN — distressed pelican + enemy bomber kills it -----
  // Same parked, smoking, beaconing pelican as `_spawnDistressBeacon`, but a
  // banshee or longsword strafes in from one side, fires a bolt at the wreck,
  // and the impact triggers a flash + ring shockwave + spark burst, vaporizing
  // the pelican. The bomber peels out and exits frame.
  _spawnDistressBombing(){
    const p = this._acquireShip('pelican');
    if (!p) return;
    const bomberType = Math.random() < 0.5 ? 'banshee' : 'longsword';
    const bomber = this._acquireShip(bomberType, { forceMint: true });
    if (!bomber) { this._resetShip(p); return; }

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
    p.life = 0; p.maxLife = 9; p.active = true; p.outer.visible = true;
    p.scenario = 'distress_bombed_victim'; p.scenarioTime = 0;

    const lightTex = this._makeSatLightTexture();
    const flameTex = this._makeFlameTexture({
      stops: [
        [0.00, 'rgba(255,250,210,1.00)'],
        [0.18, 'rgba(255,200, 80,0.95)'],
        [0.45, 'rgba(255,110, 40,0.65)'],
        [0.75, 'rgba(160, 30, 20,0.25)'],
        [1.00, 'rgba( 40,  6,  4,0.00)'],
      ],
    });

    const mkBeacon = (color, scale, x, y, z) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: lightTex, color, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
      }));
      sp.scale.set(scale, scale, 1);
      sp.position.set(x, y, z);
      p.outer.add(sp);
      return sp;
    };
    const beaconRed   = mkBeacon(0xff3a48, 2.6,  0,    1.4,  0);
    const beaconAmber = mkBeacon(0xffaa30, 1.6, -2.5,  0.2,  0.4);
    const beaconWhite = mkBeacon(0xffffff, 1.8,  2.5,  0.2,  0.4);

    const mkFire = (x, y, z) => {
      const mat = new THREE.SpriteMaterial({
        map: flameTex, color: 0xffffff, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9,
      });
      const sp = new THREE.Sprite(mat);
      sp.scale.set(1.4, 2.0, 1);
      sp.position.set(x, y, z);
      p.outer.add(sp);
      return sp;
    };
    const fireA = mkFire( 3.05, -0.10, 0.5);
    const fireB = mkFire(-2.20,  0.40, 1.2);

    const smokeTex = this._makeFlameTexture({
      stops: [
        [0.00, 'rgba(220,220,220,0.85)'],
        [0.40, 'rgba(110,110,110,0.50)'],
        [0.80, 'rgba( 40, 40, 40,0.20)'],
        [1.00, 'rgba( 20, 20, 20,0.00)'],
      ],
    });
    const smokes = [];
    const SMOKE_POOL = 18;
    for (let i = 0; i < SMOKE_POOL; i++) {
      const mat = new THREE.SpriteMaterial({
        map: smokeTex, color: 0x999999, transparent: true,
        blending: THREE.NormalBlending, depthWrite: false, opacity: 0,
      });
      const sp = new THREE.Sprite(mat);
      sp.scale.set(0.001, 0.001, 1);
      this.scene.add(sp);
      smokes.push({ sprite: sp, mat, life: 0, maxLife: 0,
                    pos: new THREE.Vector3(), vel: new THREE.Vector3(),
                    seedSize: 1, originIdx: 0 });
    }

    // Bigger spark pool than `_spawnDistressBeacon` (24 vs 14) — the explosion
    // burst pumps a lot of flecks at once.
    const sparks = [];
    const SPARK_POOL = 24;
    for (let i = 0; i < SPARK_POOL; i++) {
      const mat = new THREE.SpriteMaterial({
        map: lightTex, color: 0xffe0a0, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
      });
      const sp = new THREE.Sprite(mat);
      sp.scale.set(0.001, 0.001, 1);
      this.scene.add(sp);
      sparks.push({ sprite: sp, mat, life: 0, maxLife: 0,
                    pos: new THREE.Vector3(), vel: new THREE.Vector3() });
    }

    // Big explosion flash sprite (hidden until detonation)
    const flashMat = new THREE.SpriteMaterial({
      map: lightTex, color: 0xffd07a, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
    });
    const flash = new THREE.Sprite(flashMat);
    flash.scale.set(0.001, 0.001, 1);
    this.scene.add(flash);

    // Shockwave ring — billboarded toward camera at detonation
    const ringGeo = new THREE.RingGeometry(1.0, 1.08, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffe09a, transparent: true, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    this.scene.add(ring);

    p.scenarioBase = {
      beaconRed, beaconAmber, beaconWhite,
      fireA, fireB,
      smokes, sparks,
      smokeNext: 0, sparkNext: 0,
      drift: pos.clone(),
      listRollV: (Math.random() < 0.5 ? -1 : 1) * (0.08 + Math.random() * 0.06),
      listYawV:  (Math.random() < 0.5 ? -1 : 1) * (0.04 + Math.random() * 0.04),
      hullSeed: Math.random() * 10,
      detonated: false,
      detonateK: 0,
      flash, flashMat, ring, ringGeo, ringMat,
    };
    p.scenarioCleanup = () => {
      [beaconRed, beaconAmber, beaconWhite, fireA, fireB].forEach(s => {
        if (s.parent) s.parent.remove(s);
        if (s.material.map) s.material.map.dispose();
        s.material.dispose();
      });
      smokes.forEach(({ sprite, mat }) => {
        this.scene.remove(sprite);
        if (mat.map) mat.map.dispose();
        mat.dispose();
      });
      sparks.forEach(({ sprite, mat }) => {
        this.scene.remove(sprite);
        if (mat.map) mat.map.dispose();
        mat.dispose();
      });
      this.scene.remove(flash);
      if (flashMat.map) flashMat.map.dispose();
      flashMat.dispose();
      this.scene.remove(ring);
      ringGeo.dispose();
      ringMat.dispose();
    };

    // === Bomber strafes in from a side, fires once near closest approach ===
    const sideSign = Math.random() < 0.5 ? 1 : -1;
    const dir = right.clone().multiplyScalar(sideSign).normalize();
    const bomberStart = pos.clone()
      .addScaledVector(dir, -90)
      .addScaledVector(up, 5);
    bomber.outer.position.copy(bomberStart);
    bomber.outer.lookAt(bomberStart.clone().add(dir));
    bomber.inner.rotation.set(0, Math.PI, 0);
    bomber.velocity.copy(dir).multiplyScalar(58);
    bomber.life = 0; bomber.maxLife = 8; bomber.active = true; bomber.outer.visible = true;
    bomber.scenario = 'distress_bomber'; bomber.scenarioTime = 0;
    bomber.scenarioTargetRef = p;
    bomber.scenarioBase = {
      dir: dir.clone(),
      speed: 58,
      fireAt: 1.3,           // banshee/longsword fires when it's ~~30u out
      fired: false,
      detonateAt: 99,        // overwritten when fired (based on bolt travel time)
      detonationFired: false,
    };

    if (!this._followDisabled && !this.focused) this._scenarioFollow = { ships: [p, bomber] };
    if (this._flashHint) this._flashHint('spawned: distress · bombing run', 'info');
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

  // ============================================================
  // b192 MID SCENARIOS — added on top of the 18 existing scenarios.
  // ============================================================

  // ----- PIRATE AMBUSH — 3 banshees chase 1 pelican target -----
  _spawnPirateAmbush(){
    const target = this._acquireShip('pelican');
    const c1 = this._acquireShip('banshee');
    const c2 = this._acquireShip('banshee', { forceMint: true });
    const c3 = this._acquireShip('banshee', { forceMint: true });
    if (!target || !c1 || !c2 || !c3) return;
    const fwd = this._forwardVec();
    const { right, up } = this._basisFromDir(fwd);
    const sideSign = Math.random() < 0.5 ? 1 : -1;
    const dir = right.clone().multiplyScalar(sideSign).normalize();
    const perp = new THREE.Vector3().crossVectors(dir, up).normalize();
    const start = fwd.clone().multiplyScalar(38).addScaledVector(dir, -85).addScaledVector(up, 1);

    const targetSpeed = 44;
    target.outer.position.copy(start);
    target.outer.lookAt(start.clone().add(dir));
    target.inner.rotation.set(0, Math.PI, 0);
    target.velocity.copy(dir).multiplyScalar(targetSpeed);
    target.life = 0;
    target.maxLife = 14;
    target.active = true;
    target.outer.visible = true;
    target.scenario = 'pirate_target';
    target.scenarioTime = 0;
    target.scenarioBase = { dir: dir.clone(), perp1: up.clone(), perp2: perp.clone(), speed: targetSpeed, seedA: Math.random() * 6.28 };

    const chasers = [c1, c2, c3];
    chasers.forEach((c, i) => {
      const slot = start.clone()
        .addScaledVector(dir,   -28 - i * 7)
        .addScaledVector(perp,  (i === 0 ? 0 : (i === 1 ? -9 : 9)))
        .addScaledVector(up,    (i === 0 ? -3 : (i === 1 ? 3 : -1)));
      c.outer.position.copy(slot);
      c.outer.lookAt(slot.clone().add(dir));
      c.inner.rotation.set(0, Math.PI, 0);
      c.velocity.copy(dir).multiplyScalar(56);
      c.life = 0;
      c.maxLife = 14;
      c.active = true;
      c.outer.visible = true;
      c.scenario = 'pirate_chaser';
      c.scenarioTime = 0;
      c.scenarioTargetRef = target;
      c.scenarioBase = { perp1: up.clone(), perp2: perp.clone(), speed: 56, fireCooldown: 0.8 + i * 0.35, seedA: Math.random() * 6.28 };
    });
    if (!this._followDisabled && !this.focused) this._scenarioFollow = { ships: [target, c1, c2, c3] };
    if (this._flashHint) this._flashHint('spawned: pirate ambush', 'info');
  },

  // ----- PATROL PAIR — 2 pelicans painted as emergency response, blue/red strobes -----
  _spawnPatrolPair(){
    const p1 = this._acquireShip('pelican');
    const p2 = this._acquireShip('pelican', { forceMint: true });
    if (!p1 || !p2) return;
    const fwd = this._forwardVec();
    const { right, up } = this._basisFromDir(fwd);
    const sideSign = Math.random() < 0.5 ? 1 : -1;
    const dir = right.clone().multiplyScalar(sideSign).addScaledVector(up, (Math.random() - 0.5) * 0.15).normalize();
    const speed = 30;
    const formCenter = fwd.clone().multiplyScalar(45).addScaledVector(dir, -100);

    // Strobe sprite factory
    const tex = this._makeSatLightTexture();
    const buildStrobe = (color, parent, offset) => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, color, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
      }));
      sprite.scale.set(2.4, 2.4, 1);
      sprite.position.copy(offset);
      parent.add(sprite);
      return sprite;
    };
    // Each pelican gets a red + blue strobe on its dorsal hull, offset phases
    // so the two ships strobe in alternating sync.
    const strobes = [];
    [p1, p2].forEach((p, i) => {
      const slot = formCenter.clone().addScaledVector(right, (i === 0 ? -5 : 5)).addScaledVector(up, (i === 0 ? 1 : -1));
      p.outer.position.copy(slot);
      p.outer.lookAt(slot.clone().add(dir));
      p.inner.rotation.set(0, Math.PI, 0);
      p.velocity.copy(dir).multiplyScalar(speed);
      p.life = 0;
      p.maxLife = (260 / speed) + 1.5;
      p.active = true;
      p.outer.visible = true;
      p.scenario = 'patrol_pair';
      p.scenarioTime = 0;
      const sR = buildStrobe(0xff3a48, p.outer, new THREE.Vector3(-0.7, 1.6,  0.2));
      const sB = buildStrobe(0x3a8cff, p.outer, new THREE.Vector3( 0.7, 1.6,  0.2));
      const sR2 = buildStrobe(0xff3a48, p.outer, new THREE.Vector3( 0.7, 1.6, -0.4));
      const sB2 = buildStrobe(0x3a8cff, p.outer, new THREE.Vector3(-0.7, 1.6, -0.4));
      strobes.push({ ship: p, sR, sB, sR2, sB2, phaseOffset: i * 0.5 });
      p.scenarioBase = { dir: dir.clone(), perp1: up.clone(), speed, strobes: strobes.length === 1 ? null : strobes };
      p.scenarioCleanup = () => {
        [sR, sB, sR2, sB2].forEach(sp => {
          if (sp.parent) sp.parent.remove(sp);
          sp.material.dispose();
        });
      };
    });
    if (!this._followDisabled && !this.focused) this._scenarioFollow = { ships: [p1, p2] };
    if (this._flashHint) this._flashHint('spawned: patrol pair (emergency response)', 'info');
  },

  // ----- COMET — bright nucleus + long ion-trail crossing the 360° void -----
  _spawnComet(){
    // Choose a great-circle path through the visible cone so the comet enters
    // and exits opposite sides of the camera's 360° dome.
    const fwd = this._forwardVec();
    const { right, up } = this._basisFromDir(fwd);
    // Random axis ~ tangent to camera-forward so the path crosses near the eye.
    const axis = right.clone().multiplyScalar(Math.random() < 0.5 ? 1 : -1)
      .addScaledVector(up, (Math.random() - 0.5) * 0.4)
      .normalize();
    // Side-step to randomize which great circle
    const sideAxis = new THREE.Vector3().crossVectors(axis, fwd).normalize();
    sideAxis.applyAxisAngle(axis, Math.random() * Math.PI * 2);
    const startDir = sideAxis.clone();
    const startPos = startDir.clone().multiplyScalar(220);
    const travel   = startDir.clone().negate().multiplyScalar(440); // straight across
    const speed    = 38 + Math.random() * 8;

    // Nucleus — bright sprite
    const nucleusTex = this._makeSatLightTexture();
    const nucleus = new THREE.Sprite(new THREE.SpriteMaterial({
      map: nucleusTex, color: 0xfff3e0, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
    }));
    nucleus.scale.set(8, 8, 1);
    nucleus.position.copy(startPos);
    this.scene.add(nucleus);

    // Trail — chain of fading sprites spaced behind the nucleus
    const TRAIL_N = 22;
    const trailTex = this._makeSatLightTexture();
    const trail = [];
    for (let i = 0; i < TRAIL_N; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: trailTex,
        color: i < 4 ? 0xfff3e0 : (i < 12 ? 0xb4d4ff : 0x4a6ab8),
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
      }));
      const k = i / (TRAIL_N - 1);
      sp.scale.setScalar(7 - k * 5);
      this.scene.add(sp);
      trail.push(sp);
    }
    const dirNorm = travel.clone().normalize();
    const totalDist = travel.length();
    const totalLife = totalDist / speed;
    let life = 0;

    this._addMicroFx({
      tick(_t, dt){
        life += dt;
        if (life > totalLife + 1.0) return false;
        const lf = Math.min(1, life / totalLife);
        nucleus.position.copy(startPos).addScaledVector(dirNorm, totalDist * lf);
        // Fade-in 0.0..0.08, fade-out 0.92..1.0
        const env = lf < 0.08 ? lf / 0.08 : (lf > 0.92 ? (1 - lf) / 0.08 : 1);
        nucleus.material.opacity = 1.4 * env;
        for (let i = 0; i < TRAIL_N; i++) {
          const lag = 1.4 + i * 1.6;
          const trailPos = nucleus.position.clone().addScaledVector(dirNorm, -lag);
          trail[i].position.copy(trailPos);
          const k = i / (TRAIL_N - 1);
          trail[i].material.opacity = (1.0 - k) * 0.85 * env;
        }
        return true;
      },
      cleanup: () => {
        if (nucleus.parent) nucleus.parent.remove(nucleus);
        nucleus.material.map && nucleus.material.map.dispose();
        nucleus.material.dispose();
        trail.forEach(sp => {
          if (sp.parent) sp.parent.remove(sp);
          sp.material.dispose();
        });
        trailTex.dispose();
      },
    });
    if (this._flashHint) this._flashHint('spawned: comet', 'info');
  },

  // ----- EVA TETHER — tiny figure on a slack tether to a stationary pelican -----
  _spawnEvaTether(){
    const p = this._acquireShip('pelican');
    if (!p) return;
    const center = this._scenarioAnchor();
    const fwd = this._forwardVec();
    const { right, up } = this._basisFromDir(fwd);
    const pos = center.clone()
      .addScaledVector(right, (Math.random() < 0.5 ? -1 : 1) * 6)
      .addScaledVector(up, 1);
    p.outer.position.copy(pos);
    p.outer.lookAt(pos.clone().add(fwd));
    p.inner.rotation.set(0, Math.PI, 0);
    p.velocity.set(0, 0, 0);
    p.life = 0;
    p.maxLife = 13;
    p.active = true;
    p.outer.visible = true;
    p.scenario = 'eva_tether';
    p.scenarioTime = 0;

    // Astronaut figure: small capsule + helmet sphere, attached to a Group
    // we add to the pelican.outer so it travels with the ship's frame.
    const figGroup = new THREE.Group();
    const suitMat = new THREE.MeshBasicMaterial({ color: 0xeae6dc });
    const visorMat = new THREE.MeshBasicMaterial({ color: 0x2a5fa8 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.36, 4, 8), suitMat);
    torso.rotation.z = Math.PI / 2;
    figGroup.add(torso);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.20, 12, 10), visorMat);
    helmet.position.set(0.30, 0, 0);
    figGroup.add(helmet);
    // Backpack
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.30, 0.25), new THREE.MeshBasicMaterial({ color: 0x9aa0a8 }));
    pack.position.set(-0.12, 0, 0);
    figGroup.add(pack);
    figGroup.position.set(0, -0.6, 3.0);  // hang off the back of the pelican
    p.outer.add(figGroup);

    // Tether line — single Line geometry, updated each tick.
    const lineGeo = new THREE.BufferGeometry();
    const linePts = new Float32Array(6);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePts, 3));
    const lineMat = new THREE.LineBasicMaterial({ color: 0xaab0b4, transparent: true, opacity: 0.55 });
    const line = new THREE.Line(lineGeo, lineMat);
    p.outer.add(line);

    p.scenarioBase = {
      figGroup,
      line,
      lineGeo,
      seedA: Math.random() * 6.28,
      seedB: Math.random() * 6.28,
      anchorLocal: new THREE.Vector3(0, -0.85, 2.6),  // attaches to underside of pelican
    };
    p.scenarioCleanup = () => {
      if (figGroup.parent) figGroup.parent.remove(figGroup);
      figGroup.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      if (line.parent) line.parent.remove(line);
      lineGeo.dispose();
      lineMat.dispose();
    };
    if (!this._followDisabled && !this.focused) this._scenarioFollow = { ships: [p] };
    if (this._flashHint) this._flashHint('spawned: EVA tether', 'info');
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

  // ============================================================
  // g12 CAMEOS — 12 iconic floating scenarios.
  // Each uses the fake-flyby-ship pattern (push to flybyShips with
  // _ephemeral=true) so they get follow-cam, follow lifecycle, and
  // teardown via _disposeEphemeralShip. Tick branches live in
  // _tickScenario keyed on the scenario string.
  // ============================================================

  // 1. CCS BATTLECRUISER — purple ribbed Covenant cruiser, gravity-lift glow
  _spawnCcsBattlecruiser(){
    const grp = new THREE.Group();
    const hullMat = new THREE.MeshBasicMaterial({ color: 0x2a0a48, transparent: true, opacity: 0 });
    const ribMat  = new THREE.MeshBasicMaterial({ color: 0x110422, transparent: true, opacity: 0 });
    const trimMat = new THREE.MeshBasicMaterial({
      color: 0x6a3acc, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const spine = new THREE.Mesh(new THREE.BoxGeometry(78, 10, 14), hullMat);
    grp.add(spine);
    for (let i = 0; i < 7; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(2.4, 11.6, 16.4), ribMat);
      rib.position.x = -32 + i * 10.5;
      grp.add(rib);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 9), hullMat);
    bridge.position.set(24, 7, 0); grp.add(bridge);
    const lift = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 12, 14), trimMat);
    lift.position.y = -10; grp.add(lift);
    const liftGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this._makeSatLightTexture(), color: 0xcc88ff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    liftGlow.scale.set(22, 30, 1); liftGlow.position.set(0, -22, 0); grp.add(liftGlow);
    const engGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this._makeSatLightTexture(), color: 0x9966ff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    engGlow.scale.set(16, 16, 1); engGlow.position.set(-42, 0, 0); grp.add(engGlow);

    const fwd = this._forwardVec();
    const { right, up } = this._basisFromDir(fwd);
    const sideSign = Math.random() < 0.5 ? 1 : -1;
    grp.position.copy(fwd).multiplyScalar(170)
      .addScaledVector(right, sideSign * 200)
      .addScaledVector(up, 22);
    const velDir = right.clone().multiplyScalar(-sideSign);
    grp.rotation.y = Math.atan2(-velDir.z, velDir.x);
    this.scene.add(grp);

    const fake = {
      type: 'ccs', outer: grp, inner: grp,
      active: true, _ephemeral: true,
      velocity: velDir.clone().multiplyScalar(22),
      rollPhase: 0, life: 0, maxLife: 22,
      scenario: 'ccs_battlecruiser', scenarioTime: 0,
      scenarioBase: { hullMat, ribMat, trimMat, liftGlow, engGlow },
      scenarioCleanup: null,
    };
    this.flybyShips.push(fake);
    if (!this._followDisabled) this._scenarioFollow = { ships: [fake] };
    if (this._flashHint) this._flashHint('spawned: CCS battlecruiser', 'info');
  },

  // 2. FORERUNNER KEYSHIP — descends from above, hovers, slips away
  _spawnKeyshipDescent(){
    const grp = new THREE.Group();
    const hullMat = new THREE.MeshBasicMaterial({ color: 0x8a7e5a, transparent: true, opacity: 0 });
    const accentMat = new THREE.MeshBasicMaterial({
      color: 0xd8c478, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(8, 14, 44, 12), hullMat);
    grp.add(hull);
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(17, 0.9, 8, 48), accentMat);
    ringA.rotation.x = Math.PI / 2; grp.add(ringA);
    const ringB = new THREE.Mesh(new THREE.TorusGeometry(20, 0.6, 8, 48), accentMat);
    ringB.rotation.x = Math.PI / 2; ringB.rotation.z = Math.PI / 4; grp.add(ringB);
    const pointGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this._makeSatLightTexture(), color: 0xffe69a, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    pointGlow.scale.set(10, 10, 1); pointGlow.position.y = -24; grp.add(pointGlow);

    const fwd = this._forwardVec();
    const { right, up } = this._basisFromDir(fwd);
    const sideSign = Math.random() < 0.5 ? 1 : -1;
    const finalPos = fwd.clone().multiplyScalar(140)
      .addScaledVector(right, sideSign * 35)
      .addScaledVector(up, 18);
    grp.position.copy(finalPos).addScaledVector(up, 80);
    this.scene.add(grp);

    const fake = {
      type: 'keyship', outer: grp, inner: grp,
      active: true, _ephemeral: true,
      velocity: new THREE.Vector3(0, 0, 0),
      rollPhase: 0, life: 0, maxLife: 13,
      scenario: 'keyship_descent', scenarioTime: 0,
      scenarioBase: { hullMat, accentMat, pointGlow, ringA, ringB, finalPos, upVec: up.clone() },
      scenarioCleanup: null,
    };
    this.flybyShips.push(fake);
    if (!this._followDisabled) this._scenarioFollow = { ships: [fake] };
    if (this._flashHint) this._flashHint('spawned: keyship descent', 'info');
  },

  // 3. HALO RING FRAGMENT — broken ring arc tumbling across the void
  _spawnRingFragment(){
    const grp = new THREE.Group();
    const alloyMat = new THREE.MeshBasicMaterial({ color: 0x4a4854, transparent: true, opacity: 0 });
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x6acfff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const arcOuter = new THREE.Mesh(
      new THREE.TorusGeometry(48, 4, 10, 28, Math.PI / 4),
      alloyMat,
    );
    grp.add(arcOuter);
    const arcInner = new THREE.Mesh(
      new THREE.TorusGeometry(46, 0.6, 6, 28, Math.PI / 4),
      innerMat,
    );
    grp.add(arcInner);

    const fwd = this._forwardVec();
    const { right, up } = this._basisFromDir(fwd);
    const sideSign = Math.random() < 0.5 ? 1 : -1;
    grp.position.copy(fwd).multiplyScalar(140)
      .addScaledVector(right, sideSign * 130)
      .addScaledVector(up, 8);
    grp.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    this.scene.add(grp);

    const fake = {
      type: 'ring_frag', outer: grp, inner: grp,
      active: true, _ephemeral: true,
      velocity: right.clone().multiplyScalar(-sideSign * 12).addScaledVector(up, -0.4),
      rollPhase: 0, life: 0, maxLife: 20,
      scenario: 'ring_fragment', scenarioTime: 0,
      scenarioBase: {
        alloyMat, innerMat,
        tumble: new THREE.Vector3(0.07, 0.12, 0.05),
      },
      scenarioCleanup: null,
    };
    this.flybyShips.push(fake);
    if (!this._followDisabled) this._scenarioFollow = { ships: [fake] };
    if (this._flashHint) this._flashHint('spawned: ring fragment', 'info');
  },

  // 4. MONOLITH — black 1:4:9 slab drifts past in silence
  _spawnMonolith(){
    const grp = new THREE.Group();
    // Very dark — just barely picks up against the nebula
    const slabMat = new THREE.MeshBasicMaterial({ color: 0x050510, transparent: true, opacity: 0 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(2, 8, 18), slabMat);
    grp.add(slab);
    // Cyan edge silhouette so the slab reads against the void
    const edgesMat = new THREE.LineBasicMaterial({ color: 0x2a4a68, transparent: true, opacity: 0 });
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(slab.geometry), edgesMat);
    grp.add(edges);

    const fwd = this._forwardVec();
    const { right, up } = this._basisFromDir(fwd);
    const sideSign = Math.random() < 0.5 ? 1 : -1;
    grp.position.copy(fwd).multiplyScalar(110)
      .addScaledVector(right, sideSign * 90)
      .addScaledVector(up, 4);
    grp.rotation.set(0.2, Math.random() * Math.PI * 2, 0.15);
    this.scene.add(grp);

    const fake = {
      type: 'monolith', outer: grp, inner: grp,
      active: true, _ephemeral: true,
      velocity: right.clone().multiplyScalar(-sideSign * 8),
      rollPhase: 0, life: 0, maxLife: 18,
      scenario: 'monolith', scenarioTime: 0,
      scenarioBase: { slabMat, edgesMat },
      scenarioCleanup: null,
    };
    this.flybyShips.push(fake);
    if (!this._followDisabled) this._scenarioFollow = { ships: [fake] };
    if (this._flashHint) this._flashHint('spawned: monolith', 'info');
  },

  // 5. STARGATE KAWOOSH — vertical ring forms, kawoosh splashes, collapses
  _spawnStargateKawoosh(){
    const grp = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x5a5848, transparent: true, opacity: 0 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(14, 1.0, 10, 36), ringMat);
    grp.add(ring);
    const chevMat = new THREE.MeshBasicMaterial({
      color: 0xcc6a2a, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    for (let i = 0; i < 9; i++) {
      const ang = (i / 9) * Math.PI * 2;
      const stud = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.6), chevMat);
      stud.position.set(Math.cos(ang) * 14, Math.sin(ang) * 14, 0);
      grp.add(stud);
    }
    const horizonMat = new THREE.MeshBasicMaterial({
      color: 0x4a98ff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const horizon = new THREE.Mesh(new THREE.CircleGeometry(13.5, 40), horizonMat);
    grp.add(horizon);
    const kawooshMat = new THREE.SpriteMaterial({
      map: this._makeSatLightTexture(),
      color: 0x88c8ff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const kawoosh = new THREE.Sprite(kawooshMat);
    kawoosh.scale.set(2, 2, 1); kawoosh.position.z = 1; grp.add(kawoosh);

    const fwd = this._forwardVec();
    const { right, up } = this._basisFromDir(fwd);
    grp.position.copy(fwd).multiplyScalar(80)
      .addScaledVector(right, (Math.random() - 0.5) * 30)
      .addScaledVector(up, 6);
    grp.lookAt(0, 0, 0);
    this.scene.add(grp);

    const fake = {
      type: 'stargate', outer: grp, inner: grp,
      active: true, _ephemeral: true,
      velocity: new THREE.Vector3(0, 0, 0),
      rollPhase: 0, life: 0, maxLife: 6.5,
      scenario: 'stargate_kawoosh', scenarioTime: 0,
      scenarioBase: { ringMat, chevMat, horizon, horizonMat, kawoosh, kawooshMat },
      scenarioCleanup: null,
    };
    this.flybyShips.push(fake);
    if (!this._followDisabled) this._scenarioFollow = { ships: [fake] };
    if (this._flashHint) this._flashHint('spawned: stargate kawoosh', 'info');
  },

  // 6. FROZEN CAPITAL — dark powered-down warship tumbles end-over-end
  _spawnFrozenCapital(){
    const grp = new THREE.Group();
    const hullMat = new THREE.MeshBasicMaterial({ color: 0x12131a, transparent: true, opacity: 0 });
    const accentMat = new THREE.MeshBasicMaterial({ color: 0x1c1d28, transparent: true, opacity: 0 });
    const spine = new THREE.Mesh(new THREE.BoxGeometry(74, 8, 12), hullMat); grp.add(spine);
    for (let i = 0; i < 4; i++) {
      const pod = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 11), hullMat);
      pod.position.set(-26 + i * 17, -5, 0); grp.add(pod);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(11, 7, 8), accentMat);
    bridge.position.set(20, 7, 0); grp.add(bridge);
    const wireMat = new THREE.LineBasicMaterial({ color: 0x223040, transparent: true, opacity: 0 });
    const wire = new THREE.LineSegments(new THREE.EdgesGeometry(spine.geometry), wireMat);
    grp.add(wire);

    const fwd = this._forwardVec();
    const { right, up } = this._basisFromDir(fwd);
    const sideSign = Math.random() < 0.5 ? 1 : -1;
    grp.position.copy(fwd).multiplyScalar(170)
      .addScaledVector(right, sideSign * 130)
      .addScaledVector(up, 14);
    grp.rotation.set(0.3, Math.random() * Math.PI * 2, 0.2);
    this.scene.add(grp);

    const fake = {
      type: 'frozen', outer: grp, inner: grp,
      active: true, _ephemeral: true,
      velocity: right.clone().multiplyScalar(-sideSign * 10),
      rollPhase: 0, life: 0, maxLife: 22,
      scenario: 'frozen_capital', scenarioTime: 0,
      scenarioBase: {
        hullMat, accentMat, wireMat,
        tumble: new THREE.Vector3(0.05, 0.08, 0.04),
      },
      scenarioCleanup: null,
    };
    this.flybyShips.push(fake);
    if (!this._followDisabled) this._scenarioFollow = { ships: [fake] };
    if (this._flashHint) this._flashHint('spawned: frozen capital', 'info');
  },

  // 7. LEVIATHAN — long bioluminescent creature, bass-reactive spots
  _spawnLeviathan(){
    const grp = new THREE.Group();
    const SEG = 10;
    const segs = [];
    const spots = [];
    const bodyMat = new THREE.MeshBasicMaterial({ color: 0x081428, transparent: true, opacity: 0 });
    const spotTex = this._makeSatLightTexture();
    for (let i = 0; i < SEG; i++) {
      const k = i / (SEG - 1);
      const r = 2.6 * (1 - k * 0.55);
      const sph = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), bodyMat);
      sph.position.x = -i * 3.2;
      grp.add(sph);
      segs.push({ mesh: sph, basePos: sph.position.clone(), phase: i * 0.6 });
      if (i % 2 === 1) {
        const spot = new THREE.Sprite(new THREE.SpriteMaterial({
          map: spotTex, color: 0x6aeaff, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        spot.scale.set(1.6, 1.6, 1);
        spot.position.set(sph.position.x, r * 0.9, 0);
        grp.add(spot);
        spots.push(spot);
      }
    }

    const fwd = this._forwardVec();
    const { right, up } = this._basisFromDir(fwd);
    const sideSign = Math.random() < 0.5 ? 1 : -1;
    grp.position.copy(fwd).multiplyScalar(130)
      .addScaledVector(right, sideSign * 150)
      .addScaledVector(up, 6);
    const velDir = right.clone().multiplyScalar(-sideSign);
    grp.rotation.y = Math.atan2(-velDir.z, velDir.x);
    this.scene.add(grp);

    const fake = {
      type: 'leviathan', outer: grp, inner: grp,
      active: true, _ephemeral: true,
      velocity: velDir.clone().multiplyScalar(11),
      rollPhase: 0, life: 0, maxLife: 22,
      scenario: 'leviathan', scenarioTime: 0,
      scenarioBase: { bodyMat, segs, spots },
      scenarioCleanup: null,
    };
    this.flybyShips.push(fake);
    if (!this._followDisabled) this._scenarioFollow = { ships: [fake] };
    if (this._flashHint) this._flashHint('spawned: leviathan', 'info');
  },

  // 8. GRAVITATIONAL LENSING — black core + cyan halo crosses with scale wobble
  _spawnLensingPatch(){
    const grp = new THREE.Group();
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0 });
    const core = new THREE.Mesh(new THREE.SphereGeometry(4.5, 18, 14), coreMat);
    grp.add(core);
    const haloMat = new THREE.SpriteMaterial({
      map: this._makeSatLightTexture(),
      color: 0x5298c8, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const halo = new THREE.Sprite(haloMat);
    halo.scale.set(18, 18, 1); grp.add(halo);
    const rimMat = new THREE.SpriteMaterial({
      map: this._makeSatLightTexture(),
      color: 0xaaeaff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const rim = new THREE.Sprite(rimMat);
    rim.scale.set(11, 11, 1); grp.add(rim);

    const fwd = this._forwardVec();
    const { right, up } = this._basisFromDir(fwd);
    const sideSign = Math.random() < 0.5 ? 1 : -1;
    grp.position.copy(fwd).multiplyScalar(115)
      .addScaledVector(right, sideSign * 110)
      .addScaledVector(up, (Math.random() - 0.5) * 30);
    this.scene.add(grp);

    const fake = {
      type: 'lensing', outer: grp, inner: grp,
      active: true, _ephemeral: true,
      velocity: right.clone().multiplyScalar(-sideSign * 14),
      rollPhase: 0, life: 0, maxLife: 14,
      scenario: 'lensing_patch', scenarioTime: 0,
      scenarioBase: { coreMat, haloMat, rimMat },
      scenarioCleanup: null,
    };
    this.flybyShips.push(fake);
    if (!this._followDisabled) this._scenarioFollow = { ships: [fake] };
    if (this._flashHint) this._flashHint('spawned: lensing patch', 'info');
  },

  // 9. MAC BROADSIDE — distant cruiser charges, fires thick plasma line, fades
  _spawnMacBroadside(){
    const grp = new THREE.Group();
    const hullMat = new THREE.MeshBasicMaterial({ color: 0x1a2030, transparent: true, opacity: 0 });
    const cruiser = new THREE.Mesh(new THREE.BoxGeometry(18, 4, 4), hullMat);
    grp.add(cruiser);
    const chargeMat = new THREE.SpriteMaterial({
      map: this._makeSatLightTexture(),
      color: 0xb0d8ff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const charge = new THREE.Sprite(chargeMat);
    charge.scale.set(0.5, 0.5, 1); charge.position.x = 11; grp.add(charge);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xeaf5ff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), beamMat);
    beam.position.x = 11;
    grp.add(beam);

    const fwd = this._forwardVec();
    const { right, up } = this._basisFromDir(fwd);
    const sideSign = Math.random() < 0.5 ? 1 : -1;
    grp.position.copy(fwd).multiplyScalar(220)
      .addScaledVector(right, sideSign * 80)
      .addScaledVector(up, -6);
    // Aim cruiser so beam fires across the visible space
    const aimDir = right.clone().multiplyScalar(-sideSign).addScaledVector(fwd, -0.2).normalize();
    grp.rotation.y = Math.atan2(-aimDir.z, aimDir.x);
    this.scene.add(grp);

    const fake = {
      type: 'mac', outer: grp, inner: grp,
      active: true, _ephemeral: true,
      velocity: new THREE.Vector3(0, 0, 0),
      rollPhase: 0, life: 0, maxLife: 5.5,
      scenario: 'mac_broadside', scenarioTime: 0,
      scenarioBase: { hullMat, chargeMat, charge, beam, beamMat },
      scenarioCleanup: null,
    };
    this.flybyShips.push(fake);
    if (!this._followDisabled) this._scenarioFollow = { ships: [fake] };
    if (this._flashHint) this._flashHint('spawned: MAC broadside', 'info');
  },

  // 10. CARGO SPILL — broken hulk releases tumbling crates
  _spawnCargoSpill(){
    const grp = new THREE.Group();
    const hulkMat = new THREE.MeshBasicMaterial({ color: 0x2a2228, transparent: true, opacity: 0 });
    const hulk = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 8), hulkMat); grp.add(hulk);
    const crateMat = new THREE.MeshBasicMaterial({ color: 0xa07c4a, transparent: true, opacity: 0 });
    const crates = [];
    const N = 14;
    for (let i = 0; i < N; i++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), crateMat);
      c.position.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 6);
      c.userData = {
        released: false, releaseAt: 1.0 + i * 0.32,
        tumble: new THREE.Vector3((Math.random()-0.5)*1.4, (Math.random()-0.5)*1.4, (Math.random()-0.5)*1.4),
        drift:  new THREE.Vector3((Math.random()-0.5)*8,  (Math.random()-0.5)*6,  (Math.random()-0.5)*8),
      };
      grp.add(c);
      crates.push(c);
    }

    const fwd = this._forwardVec();
    const { right, up } = this._basisFromDir(fwd);
    const sideSign = Math.random() < 0.5 ? 1 : -1;
    grp.position.copy(fwd).multiplyScalar(140)
      .addScaledVector(right, sideSign * 90)
      .addScaledVector(up, 6);
    this.scene.add(grp);

    const fake = {
      type: 'spill', outer: grp, inner: grp,
      active: true, _ephemeral: true,
      velocity: right.clone().multiplyScalar(-sideSign * 9),
      rollPhase: 0, life: 0, maxLife: 14,
      scenario: 'cargo_spill', scenarioTime: 0,
      scenarioBase: {
        hulkMat, crateMat, crates, hulk,
        hulkTumble: new THREE.Vector3(0.18, 0.22, 0.12),
      },
      scenarioCleanup: null,
    };
    this.flybyShips.push(fake);
    if (!this._followDisabled) this._scenarioFollow = { ships: [fake] };
    if (this._flashHint) this._flashHint('spawned: cargo spill', 'info');
  },

  // 11. SALVAGE TUG — small ship dragging a much bigger wreck via tethers
  _spawnSalvageTug(){
    const grp = new THREE.Group();
    const tugMat   = new THREE.MeshBasicMaterial({ color: 0x3a3a48, transparent: true, opacity: 0 });
    const wreckMat = new THREE.MeshBasicMaterial({ color: 0x1c1820, transparent: true, opacity: 0 });
    const tug = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 4), tugMat);
    tug.position.x = 22; grp.add(tug);
    const tugEng = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this._makeSatLightTexture(), color: 0x88c8ff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    tugEng.scale.set(3, 3, 1); tugEng.position.set(16, 0, 0); grp.add(tugEng);
    const wreck = new THREE.Mesh(new THREE.BoxGeometry(28, 10, 11), wreckMat);
    wreck.position.x = -12; wreck.rotation.z = 0.06; grp.add(wreck);
    const tetherMat = new THREE.LineBasicMaterial({ color: 0x6aaad8, transparent: true, opacity: 0 });
    const tetherGeoA = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(17, -1, 1), new THREE.Vector3(2, 1, 1),
    ]);
    const tetherGeoB = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(17, -1, -1), new THREE.Vector3(2, 1, -1),
    ]);
    grp.add(new THREE.Line(tetherGeoA, tetherMat));
    grp.add(new THREE.Line(tetherGeoB, tetherMat));

    const fwd = this._forwardVec();
    const { right, up } = this._basisFromDir(fwd);
    const sideSign = Math.random() < 0.5 ? 1 : -1;
    grp.position.copy(fwd).multiplyScalar(150)
      .addScaledVector(right, sideSign * 130)
      .addScaledVector(up, 8);
    const velDir = right.clone().multiplyScalar(-sideSign);
    grp.rotation.y = Math.atan2(-velDir.z, velDir.x);
    this.scene.add(grp);

    const fake = {
      type: 'tug', outer: grp, inner: grp,
      active: true, _ephemeral: true,
      velocity: velDir.clone().multiplyScalar(8),
      rollPhase: 0, life: 0, maxLife: 20,
      scenario: 'salvage_tug', scenarioTime: 0,
      scenarioBase: { tugMat, wreckMat, tetherMat, tugEng },
      scenarioCleanup: null,
    };
    this.flybyShips.push(fake);
    if (!this._followDisabled) this._scenarioFollow = { ships: [fake] };
    if (this._flashHint) this._flashHint('spawned: salvage tug', 'info');
  },

  // 12. SENTINEL SWARM SCAN — 6 drones in formation firing scanning beams
  _spawnSentinelSwarm(){
    const grp = new THREE.Group();
    const drones = [];
    const beams = [];
    const droneMat = new THREE.MeshBasicMaterial({ color: 0x6a6a78, transparent: true, opacity: 0 });
    const eyeTex = this._makeSatLightTexture();
    const beamMat = new THREE.LineBasicMaterial({ color: 0xff8a3a, transparent: true, opacity: 0 });
    const positions = [
      [-5,  1.6, 0], [0,  1.6, 0], [5,  1.6, 0],
      [-5, -1.6, 0], [0, -1.6, 0], [5, -1.6, 0],
    ];
    positions.forEach(p => {
      const d = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 0), droneMat);
      d.position.set(p[0], p[1], p[2]); grp.add(d);
      const eye = new THREE.Sprite(new THREE.SpriteMaterial({
        map: eyeTex, color: 0xff8a3a, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      eye.scale.set(1.0, 1.0, 1); eye.position.set(p[0], p[1], p[2] + 0.6); grp.add(eye);
      const bgeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(p[0], p[1], p[2]),
        new THREE.Vector3(0, 0, -22),
      ]);
      const beam = new THREE.Line(bgeo, beamMat);
      grp.add(beam);
      drones.push(d);
      beams.push({ line: beam, geo: bgeo });
    });

    const fwd = this._forwardVec();
    const { right, up } = this._basisFromDir(fwd);
    const sideSign = Math.random() < 0.5 ? 1 : -1;
    grp.position.copy(fwd).multiplyScalar(120)
      .addScaledVector(right, sideSign * 90)
      .addScaledVector(up, 12);
    const velDir = right.clone().multiplyScalar(-sideSign);
    grp.rotation.y = Math.atan2(-velDir.z, velDir.x);
    this.scene.add(grp);

    const fake = {
      type: 'sentinels', outer: grp, inner: grp,
      active: true, _ephemeral: true,
      velocity: velDir.clone().multiplyScalar(13),
      rollPhase: 0, life: 0, maxLife: 11,
      scenario: 'sentinel_swarm', scenarioTime: 0,
      scenarioBase: { droneMat, beamMat, drones, beams },
      scenarioCleanup: null,
    };
    this.flybyShips.push(fake);
    if (!this._followDisabled) this._scenarioFollow = { ships: [fake] };
    if (this._flashHint) this._flashHint('spawned: sentinel swarm', 'info');
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

    if (s.scenario === 'interception_target' && s.type === 'pelican') {
      // b218: pelican lead — heavier sway envelope (no barrel roll). Smaller
      // amps than the previous banshee version; the dropship lumbers across
      // the field while the two chasers close from behind.
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      const baseVel = base.dir.clone().multiplyScalar(base.speed);
      const lateral = base.perp1.clone().multiplyScalar(Math.sin(tt * 1.0 + base.seedA) * 8);
      const vert = base.perp2.clone().multiplyScalar(Math.cos(tt * 0.7 + base.seedB) * 3.5);
      s.velocity.lerp(baseVel.add(lateral).add(vert), Math.min(1, dt * 2.0));
      const fwd = s.velocity.clone().normalize();
      s.outer.lookAt(s.outer.position.clone().add(fwd));
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

    if ((s.scenario === 'distress_beacon' || s.scenario === 'distress_bombed_victim') && s.type === 'pelican') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;

      // b218: bombing-run variant — once `detonated` flips, switch to explosion
      // FX (flash sprite, shockwave ring, spark burst, hide ship). Beacons /
      // listing tumble / fires stop here.
      if (s.scenario === 'distress_bombed_victim' && base.detonated) {
        base.detonateK += dt;
        const k = base.detonateK;
        // Hide the hull after the first ~0.18s — vaporized.
        if (k > 0.18) s.outer.visible = false;
        // Flash: fast scale-up + fade
        const ft = Math.min(1, k / 0.85);
        base.flash.position.copy(s.outer.position);
        const fSize = 0.5 + ft * 14;
        base.flash.scale.set(fSize, fSize, 1);
        base.flashMat.opacity = (1 - ft) * 1.4;
        // Shockwave ring billboarded to camera
        base.ring.position.copy(s.outer.position);
        base.ring.lookAt(this.camera.position);
        const rSize = 0.4 + ft * 16;
        base.ring.scale.set(rSize, rSize, 1);
        base.ringMat.opacity = (1 - ft) * 0.9;
        // Pump sparks for the first 0.6s
        if (k < 0.6) {
          for (let i = 0; i < 3; i++) {
            const slot = base.sparks.find(p => p.life >= p.maxLife);
            if (!slot) break;
            slot.pos.copy(s.outer.position);
            slot.vel.set(
              (Math.random() - 0.5) * 14,
              (Math.random() - 0.4) * 9,
              (Math.random() - 0.5) * 14,
            );
            slot.life = 0;
            slot.maxLife = 0.7 + Math.random() * 0.6;
            slot.sprite.position.copy(slot.pos);
          }
        }
        // Tick existing smoke + spark sprites so they continue to evolve.
        base.smokes.forEach(slot => {
          if (slot.life >= slot.maxLife) { slot.mat.opacity = 0; return; }
          slot.life += dt;
          const k2 = slot.life / slot.maxLife;
          slot.pos.addScaledVector(slot.vel, dt);
          slot.sprite.position.copy(slot.pos);
          const sz = slot.seedSize * (0.6 + k2 * 1.6);
          slot.sprite.scale.set(sz, sz, 1);
          slot.mat.opacity = 0.55 * (1 - k2 * k2);
        });
        base.sparks.forEach(slot => {
          if (slot.life >= slot.maxLife) { slot.mat.opacity = 0; return; }
          slot.life += dt;
          const k2 = slot.life / slot.maxLife;
          slot.pos.addScaledVector(slot.vel, dt);
          slot.sprite.position.copy(slot.pos);
          const sz = 0.42 * (1 - k2 * 0.6);
          slot.sprite.scale.set(sz, sz, 1);
          slot.mat.opacity = (1 - k2) * 0.95;
        });
        return;
      }


      // ── Red SOS strobe — 3 short, 1 long, repeating ──
      const phase = (tt * 1.4) % 2.4;
      let redOn = 0;
      if (phase < 0.10) redOn = 1;
      else if (phase >= 0.30 && phase < 0.40) redOn = 1;
      else if (phase >= 0.60 && phase < 0.70) redOn = 1;
      else if (phase >= 1.0  && phase < 1.5)  redOn = 1;
      base.beaconRed.material.opacity = redOn ? 1.0 : 0.05;

      // ── Amber rotating beacon — slower, smooth sin ──
      const amberCycle = (Math.sin(tt * 2.8) + 1) * 0.5;
      base.beaconAmber.material.opacity = 0.15 + Math.pow(amberCycle, 4) * 0.85;

      // ── White emergency strobe — sharp, fast, off-phase from red ──
      const wPhase = (tt * 2.2 + 0.7) % 1.0;
      base.beaconWhite.material.opacity = wPhase < 0.06 ? 1.0 : 0.04;

      // ── Fire flicker — sub-second wobble in scale + opacity. Two fires
      //    on different seeds so they don't pulse in lockstep. ──
      const flick = (seed) => 0.65 + 0.35 * Math.sin(tt * 14 + seed) * Math.sin(tt * 7.3 + seed * 2.1);
      const fA = flick(base.hullSeed);
      const fB = flick(base.hullSeed + 3.7);
      base.fireA.material.opacity = 0.55 + 0.40 * fA;
      base.fireB.material.opacity = 0.50 + 0.40 * fB;
      base.fireA.scale.set(1.2 + fA * 0.6, 1.6 + fA * 1.0, 1);
      base.fireB.scale.set(1.0 + fB * 0.5, 1.4 + fB * 0.9, 1);

      // ── Hull power flicker — listless ship, lights stutter. Multiplied
      //    on top of running lights so the whole frame feels powerless. ──
      const hullPow = (Math.sin(tt * 9.1 + base.hullSeed) > 0.6) ? 0.18 : 1.0;
      if (s.runningLights) s.runningLights.forEach(rl => {
        rl.material.opacity = (rl.userData.baseOpacity ?? 0.7) * hullPow;
      });

      // ── Listless drift — slow tumble (roll + yaw) as if attitude
      //    control failed. Engine is dead, so velocity stays zero. ──
      s.outer.rotation.z += base.listRollV * dt;
      s.outer.rotation.y += base.listYawV  * dt;
      s.outer.position.y = base.drift.y + Math.sin(tt * 0.8) * 0.18;

      // ── Smoke trail — periodically launch a puff from a damaged spot.
      //    Gray normal-blended sprite drifts up-and-back, scales up while
      //    fading out. Pool-recycled. ──
      base.smokeNext -= dt;
      if (base.smokeNext <= 0) {
        base.smokeNext = 0.06 + Math.random() * 0.05;
        const slot = base.smokes.find(p => p.life >= p.maxLife);
        if (slot) {
          const originIdx = Math.random() < 0.5 ? 0 : 1;
          const anchor = originIdx === 0 ? base.fireA : base.fireB;
          anchor.getWorldPosition(slot.pos);
          slot.vel.set(
            (Math.random() - 0.5) * 0.6,
             0.35 + Math.random() * 0.35,
            (Math.random() - 0.5) * 0.6,
          );
          slot.life = 0;
          slot.maxLife = 1.6 + Math.random() * 0.8;
          slot.seedSize = 0.7 + Math.random() * 0.6;
          slot.originIdx = originIdx;
          slot.sprite.position.copy(slot.pos);
        }
      }
      base.smokes.forEach(slot => {
        if (slot.life >= slot.maxLife) {
          slot.mat.opacity = 0;
          return;
        }
        slot.life += dt;
        const k = slot.life / slot.maxLife;
        slot.pos.addScaledVector(slot.vel, dt);
        slot.sprite.position.copy(slot.pos);
        const sz = slot.seedSize * (0.6 + k * 1.6);
        slot.sprite.scale.set(sz, sz, 1);
        slot.mat.opacity = 0.55 * (1 - k * k);
      });

      // ── Sparks — brief flecks ejected from the same damaged spots.
      //    Fewer, brighter, shorter-lived than smoke. ──
      base.sparkNext -= dt;
      if (base.sparkNext <= 0) {
        base.sparkNext = 0.35 + Math.random() * 0.55;
        const slot = base.sparks.find(p => p.life >= p.maxLife);
        if (slot) {
          const originIdx = Math.random() < 0.5 ? 0 : 1;
          const anchor = originIdx === 0 ? base.fireA : base.fireB;
          anchor.getWorldPosition(slot.pos);
          slot.vel.set(
            (Math.random() - 0.5) * 2.4,
             0.2 - Math.random() * 1.2,        // mostly fall + a few rise
            (Math.random() - 0.5) * 2.4,
          );
          slot.life = 0;
          slot.maxLife = 0.4 + Math.random() * 0.3;
          slot.sprite.position.copy(slot.pos);
        }
      }
      base.sparks.forEach(slot => {
        if (slot.life >= slot.maxLife) {
          slot.mat.opacity = 0;
          return;
        }
        slot.life += dt;
        const k = slot.life / slot.maxLife;
        slot.pos.addScaledVector(slot.vel, dt);
        slot.sprite.position.copy(slot.pos);
        const sz = 0.30 * (1 - k * 0.7);
        slot.sprite.scale.set(sz, sz, 1);
        slot.mat.opacity = (1 - k) * 0.95;
      });

      return;
    }

    // b218: bomber straight-flies past the distressed pelican, fires once at
    // closest approach, schedules the victim's detonation based on bolt travel
    // time. Type-agnostic: works as banshee or longsword.
    if (s.scenario === 'distress_bomber') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      const baseVel = base.dir.clone().multiplyScalar(base.speed);
      s.velocity.lerp(baseVel, Math.min(1, dt * 2));
      const fwdN = s.velocity.clone().normalize();
      s.outer.lookAt(s.outer.position.clone().add(fwdN));
      // Type-specific roll
      if (s.type === 'banshee') {
        s.inner.rotation.x = Math.sin(s.rollPhase * 0.7) * 0.20;
        s.inner.rotation.y = Math.PI;
        s.inner.rotation.z += dt * 4.0;
      } else if (s.type === 'longsword') {
        s.inner.rotation.z = Math.sin(s.rollPhase * 0.5) * 0.30;
      }

      // Fire the bomb
      if (!base.fired && tt >= base.fireAt) {
        base.fired = true;
        const tgt = s.scenarioTargetRef;
        if (tgt && tgt.active) {
          const muzzle = new THREE.Vector3(); s.outer.getWorldPosition(muzzle);
          const aim    = new THREE.Vector3(); tgt.outer.getWorldPosition(aim);
          // Fat slow bolt reads as a bomb / heavy ordnance.
          const boltColor = (s.type === 'banshee') ? 0xff3ad8 : 0xffaa30;
          const boltSpeed = 95;
          this._fireBolt(muzzle, aim, boltColor, {
            speed: boltSpeed, spread: 0.0, life: 1.4, scale: 1.4, opacity: 1.0,
          });
          const dist = muzzle.distanceTo(aim);
          base.detonateAt = tt + dist / boltSpeed + 0.04;
        }
      }

      // Trigger detonation on the victim when the bolt would arrive
      if (base.fired && !base.detonationFired && tt >= base.detonateAt) {
        base.detonationFired = true;
        const tgt = s.scenarioTargetRef;
        if (tgt && tgt.active && tgt.scenarioBase) {
          tgt.scenarioBase.detonated = true;
          tgt.scenarioBase.detonateK = 0;
        }
      }
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

    // ---- b192: PIRATE AMBUSH — target weaves; chasers home + fire ----
    if (s.scenario === 'pirate_target' && s.type === 'pelican') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      const baseVel = base.dir.clone().multiplyScalar(base.speed);
      const weave = base.perp1.clone().multiplyScalar(Math.sin(tt * 1.7 + base.seedA) * 7)
        .add(base.perp2.clone().multiplyScalar(Math.cos(tt * 1.3 + base.seedA * 1.4) * 5));
      s.velocity.lerp(baseVel.add(weave), Math.min(1, dt * 2.4));
      const fwd = s.velocity.clone().normalize();
      s.outer.lookAt(s.outer.position.clone().add(fwd));
      return;
    }
    if (s.scenario === 'pirate_chaser' && s.type === 'banshee') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      const tgt = s.scenarioTargetRef;
      // Steer toward target with a slight side-bias so all 3 don't converge to a point.
      let desiredDir;
      if (tgt && tgt.active) {
        desiredDir = tgt.outer.position.clone().sub(s.outer.position).normalize();
      } else {
        desiredDir = s.velocity.clone().normalize();
      }
      const baseVel = desiredDir.multiplyScalar(base.speed);
      const wob = base.perp1.clone().multiplyScalar(Math.sin(tt * 2.2 + base.seedA) * 3);
      s.velocity.lerp(baseVel.add(wob), Math.min(1, dt * 2.0));
      const fwd = s.velocity.clone().normalize();
      s.outer.lookAt(s.outer.position.clone().add(fwd));
      // Continuous barrel roll
      s.inner.rotation.x = Math.sin(s.rollPhase * 0.7) * 0.18;
      s.inner.rotation.y = Math.PI;
      s.inner.rotation.z += dt * 4.5;

      // Fire bolts opportunistically
      base.fireCooldown -= dt;
      if (base.fireCooldown <= 0 && tgt && tgt.active) {
        base.fireCooldown = 0.55 + Math.random() * 0.5;
        if (this._fireBolt) {
          const muzzlePos = s.outer.position.clone();
          this._fireBolt(muzzlePos, tgt.outer.position, 0xff5060, { speed: 95, life: 0.9, scale: 0.6, spread: 0.08 });
        }
      }
      return;
    }

    // ---- b192: PATROL PAIR — slow forward drift + alternating red/blue strobes ----
    if (s.scenario === 'patrol_pair' && s.type === 'pelican') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      const baseVel = base.dir.clone().multiplyScalar(base.speed);
      const sway = base.perp1.clone().multiplyScalar(Math.sin(tt * 0.7) * 0.6);
      s.velocity.lerp(baseVel.add(sway), Math.min(1, dt * 1.8));
      // g6: was missing the outer.lookAt re-orient after the velocity lerp,
      // so the pelican's nose stayed locked on the spawn-time direction even
      // as its body swayed laterally — read as flying sideways. Now aligned.
      const fwd = s.velocity.clone().normalize();
      s.outer.lookAt(s.outer.position.clone().add(fwd));
      // Lumbering wobble
      s.inner.rotation.x = Math.sin(s.rollPhase * 0.5) * 0.07;
      s.inner.rotation.y = Math.PI + Math.sin(s.rollPhase * 0.4 + 1.0) * 0.10;
      s.inner.rotation.z = Math.sin(s.rollPhase * 0.6 + 0.5) * 0.04;
      // Strobe drive — square-ish pulse at ~3.2 Hz, red/blue alternate.
      // Stash the four sprites on the ship via scenarioCleanup's closure;
      // we walked the children when scenario started, but easier: re-find by traversing.
      let red = 0, blue = 0;
      if (s.outer.children) {
        // Strobes are sprites. We tagged them via material color; pulse by phase.
        const f = (phase) => {
          const sq = Math.max(0, Math.sin(t * Math.PI * 2 * 1.6 + phase));
          return Math.pow(sq, 6) * 1.0;  // sharp peaks
        };
        red  = f(0);
        blue = f(Math.PI);
        s.outer.children.forEach(c => {
          if (c.isSprite && c.material && c.material.color) {
            const r = c.material.color.r, b = c.material.color.b;
            // Identify red vs blue by which channel dominates
            if (r > b) c.material.opacity = 0.05 + red * 1.0;
            else       c.material.opacity = 0.05 + blue * 1.0;
          }
        });
      }
      return;
    }

    // ---- b192: EVA TETHER — figure drifts on slack tether, tether line follows ----
    if (s.scenario === 'eva_tether' && s.type === 'pelican') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      // Pelican holds station with tiny breathing drift
      s.velocity.set(
        Math.sin(tt * 0.4 + base.seedA) * 0.3,
        Math.cos(tt * 0.35 + base.seedB) * 0.2,
        Math.sin(tt * 0.5 + base.seedB) * 0.3
      );
      // Astronaut drift relative to pelican (in pelican-local space)
      const fig = base.figGroup;
      const reelIn = tt > 9.5;       // last ~3.5s reel back to anchor
      const targetLocal = reelIn
        ? base.anchorLocal.clone()
        : new THREE.Vector3(
            Math.sin(tt * 0.6 + base.seedA) * 1.4,
            -0.6 + Math.sin(tt * 0.45) * 0.5,
            3.0 + Math.cos(tt * 0.5 + base.seedB) * 0.8,
          );
      fig.position.lerp(targetLocal, Math.min(1, dt * (reelIn ? 1.8 : 0.9)));
      // Figure rotates lazily on its own axis
      fig.rotation.y += dt * 0.7;
      fig.rotation.x = Math.sin(tt * 0.8) * 0.25;
      // Update tether line (anchor → figure, both in pelican-local space)
      const arr = base.lineGeo.attributes.position.array;
      arr[0] = base.anchorLocal.x; arr[1] = base.anchorLocal.y; arr[2] = base.anchorLocal.z;
      arr[3] = fig.position.x;     arr[4] = fig.position.y;     arr[5] = fig.position.z;
      base.lineGeo.attributes.position.needsUpdate = true;
      return;
    }

    // ============================================================
    // g12 CAMEO TICKS — 12 iconic floating scenarios.
    // Each branch handles its own fade in/out + per-frame animation.
    // Materials are stored on scenarioBase so we can drive opacity
    // for envelope-style fades regardless of how many meshes share
    // each material in the group.
    // ============================================================

    if (s.scenario === 'ccs_battlecruiser') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      const fadeIn  = Math.min(1, tt / 4);
      const fadeOut = Math.min(1, Math.max(0, (s.maxLife - tt) / 4));
      const op = Math.min(fadeIn, fadeOut);
      base.hullMat.opacity = op * 0.95;
      base.ribMat.opacity  = op * 0.95;
      base.trimMat.opacity = op * 0.65;
      base.liftGlow.material.opacity = op * 0.70;
      base.engGlow.material.opacity  = op * 0.90;
      s.outer.rotation.y += dt * 0.008;
      return;
    }

    if (s.scenario === 'keyship_descent') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      const descT = 3, hoverT = 5, ascT = 3;
      let yK;
      if (tt < descT) yK = 1 - tt / descT;
      else if (tt < descT + hoverT) yK = 0;
      else yK = Math.min(1, (tt - descT - hoverT) / ascT);
      s.outer.position.copy(base.finalPos).addScaledVector(base.upVec, 80 * yK);
      base.ringA.rotation.z += dt * 1.4;
      base.ringB.rotation.z -= dt * 1.1;
      const fadeIn  = Math.min(1, tt / 1.0);
      const fadeOut = Math.min(1, Math.max(0, (s.maxLife - tt) / 1.0));
      const op = Math.min(fadeIn, fadeOut);
      base.hullMat.opacity = op * 0.95;
      base.accentMat.opacity = op * 0.85;
      base.pointGlow.material.opacity = op * (0.7 + Math.sin(tt * 2.4) * 0.2);
      return;
    }

    if (s.scenario === 'ring_fragment') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      s.outer.rotation.x += base.tumble.x * dt;
      s.outer.rotation.y += base.tumble.y * dt;
      s.outer.rotation.z += base.tumble.z * dt;
      const fadeIn  = Math.min(1, tt / 3);
      const fadeOut = Math.min(1, Math.max(0, (s.maxLife - tt) / 3));
      const op = Math.min(fadeIn, fadeOut);
      base.alloyMat.opacity = op * 0.92;
      base.innerMat.opacity = op * 0.80;
      return;
    }

    if (s.scenario === 'monolith') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      s.outer.rotation.y += dt * 0.05;
      s.outer.rotation.z += dt * 0.02;
      const fadeIn  = Math.min(1, tt / 4);
      const fadeOut = Math.min(1, Math.max(0, (s.maxLife - tt) / 4));
      const op = Math.min(fadeIn, fadeOut);
      base.slabMat.opacity = op * 1.0;
      base.edgesMat.opacity = op * 0.55;
      return;
    }

    if (s.scenario === 'stargate_kawoosh') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      const ringIn = Math.min(1, tt / 0.6);
      const chevK  = Math.min(1, Math.max(0, (tt - 0.4) / 0.6));
      base.ringMat.opacity = ringIn * 0.90;
      base.chevMat.opacity = chevK * 0.85;
      if (tt < 1.2) {
        const k = Math.min(1, Math.max(0, (tt - 0.6) / 0.6));
        base.kawoosh.scale.set(2 + k * 24, 2 + k * 24, 1);
        base.kawoosh.position.z = 1 + k * 14;
        base.kawooshMat.opacity = k * 1.4 * (1 - k * 0.3);
      } else {
        base.kawooshMat.opacity = Math.max(0, base.kawooshMat.opacity - dt * 4);
      }
      const hzIn  = Math.min(1, Math.max(0, (tt - 0.9) / 0.4));
      const hzOut = Math.min(1, Math.max(0, (s.maxLife - 0.5 - tt) / 1.0));
      const hzOp  = Math.min(hzIn, hzOut);
      base.horizonMat.opacity = hzOp * (0.6 + Math.sin(tt * 4) * 0.15);
      base.horizon.scale.set(
        1 + Math.sin(tt * 3) * 0.04,
        1 + Math.cos(tt * 2.6) * 0.04,
        1,
      );
      return;
    }

    if (s.scenario === 'frozen_capital') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      s.outer.rotation.x += base.tumble.x * dt;
      s.outer.rotation.y += base.tumble.y * dt;
      s.outer.rotation.z += base.tumble.z * dt;
      const fadeIn  = Math.min(1, tt / 3);
      const fadeOut = Math.min(1, Math.max(0, (s.maxLife - tt) / 3));
      const op = Math.min(fadeIn, fadeOut);
      base.hullMat.opacity = op * 0.92;
      base.accentMat.opacity = op * 0.92;
      base.wireMat.opacity = op * 0.45;
      return;
    }

    if (s.scenario === 'leviathan') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      // Body undulates — sin wave on Y across the segments
      base.segs.forEach((seg, i) => {
        const decay = 1 - i / base.segs.length;
        seg.mesh.position.y = seg.basePos.y + Math.sin(tt * 1.4 + seg.phase) * 0.6 * decay;
      });
      const fadeIn  = Math.min(1, tt / 3);
      const fadeOut = Math.min(1, Math.max(0, (s.maxLife - tt) / 3));
      const op = Math.min(fadeIn, fadeOut);
      base.bodyMat.opacity = op * 0.95;
      // Bass-reactive bioluminescent spots
      const bass = this._readBass ? this._readBass() : 0;
      const spotOp = (0.35 + bass * 0.8) * op;
      base.spots.forEach((spot, i) => {
        spot.material.opacity = spotOp * (0.7 + Math.sin(tt * 2 + i) * 0.3);
      });
      return;
    }

    if (s.scenario === 'lensing_patch') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      const fadeIn  = Math.min(1, tt / 3);
      const fadeOut = Math.min(1, Math.max(0, (s.maxLife - tt) / 3));
      const op = Math.min(fadeIn, fadeOut);
      base.coreMat.opacity = op * 0.95;
      base.haloMat.opacity = op * 0.55;
      base.rimMat.opacity  = op * 0.30;
      // Subtle scale wobble implies "warp"
      const wob = 1 + Math.sin(tt * 1.3) * 0.08;
      s.outer.scale.setScalar(wob);
      return;
    }

    if (s.scenario === 'mac_broadside') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      const fadeIn  = Math.min(1, tt / 1.5);
      const fadeOut = Math.min(1, Math.max(0, (s.maxLife - tt) / 1.5));
      const op = Math.min(fadeIn, fadeOut);
      base.hullMat.opacity = op * 0.85;
      // Charge ramp -> muzzle flash -> fade
      if (tt < 2.0) {
        const k = tt / 2.0;
        base.chargeMat.opacity = k * k * 1.3;
        base.charge.scale.setScalar(0.5 + k * 2.4);
      } else if (tt < 2.2) {
        base.chargeMat.opacity = 2.0;
        base.charge.scale.setScalar(4.0);
      } else {
        base.chargeMat.opacity = Math.max(0, base.chargeMat.opacity - dt * 3);
      }
      // Beam stretches 2.0 -> 2.5, fades to 3.5
      if (tt >= 2.0 && tt < 3.5) {
        const bk = Math.min(1, (tt - 2.0) / 0.5);
        const beamLen = bk * 240;
        base.beam.scale.set(beamLen, 1.6, 1.6);
        base.beam.position.x = 11 + beamLen / 2;
        const bFade = tt < 2.6 ? 1 : Math.max(0, (3.5 - tt) / 0.9);
        base.beamMat.opacity = bFade * 1.4;
      } else {
        base.beamMat.opacity = 0;
      }
      return;
    }

    if (s.scenario === 'cargo_spill') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      const fadeIn  = Math.min(1, tt / 2);
      const fadeOut = Math.min(1, Math.max(0, (s.maxLife - tt) / 3));
      const op = Math.min(fadeIn, fadeOut);
      base.hulkMat.opacity = op * 0.88;
      base.crateMat.opacity = op * 0.85;
      base.hulk.rotation.x += base.hulkTumble.x * dt;
      base.hulk.rotation.y += base.hulkTumble.y * dt;
      base.hulk.rotation.z += base.hulkTumble.z * dt;
      base.crates.forEach(c => {
        const ud = c.userData;
        if (!ud.released && tt >= ud.releaseAt) ud.released = true;
        if (ud.released) {
          c.position.addScaledVector(ud.drift, dt);
          c.rotation.x += ud.tumble.x * dt;
          c.rotation.y += ud.tumble.y * dt;
          c.rotation.z += ud.tumble.z * dt;
        }
      });
      return;
    }

    if (s.scenario === 'salvage_tug') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      const fadeIn  = Math.min(1, tt / 3);
      const fadeOut = Math.min(1, Math.max(0, (s.maxLife - tt) / 3));
      const op = Math.min(fadeIn, fadeOut);
      base.tugMat.opacity = op * 0.90;
      base.wreckMat.opacity = op * 0.92;
      base.tetherMat.opacity = op * 0.65;
      base.tugEng.material.opacity = op * (0.7 + Math.sin(tt * 6) * 0.18);
      s.outer.position.y += Math.sin(tt * 0.6) * 0.04;
      return;
    }

    if (s.scenario === 'sentinel_swarm') {
      const tt = s.scenarioTime;
      const base = s.scenarioBase;
      const fadeIn  = Math.min(1, tt / 1.5);
      const fadeOut = Math.min(1, Math.max(0, (s.maxLife - tt) / 1.5));
      const op = Math.min(fadeIn, fadeOut);
      base.droneMat.opacity = op * 0.90;
      base.beamMat.opacity = op * (0.45 + Math.sin(tt * 8) * 0.18);
      base.drones.forEach((d, i) => {
        d.rotation.x += dt * (1.2 + i * 0.15);
        d.rotation.y += dt * (0.9 + i * 0.10);
      });
      // Eye sprites brighten in pulses
      const eyeOp = op * (0.6 + Math.sin(tt * 9) * 0.3);
      s.outer.children.forEach(ch => {
        if (ch.isSprite) ch.material.opacity = eyeOp;
      });
      // Convergence point wobbles so the beams look "scanning"
      const cx = Math.sin(tt * 1.7) * 1.4;
      const cy = Math.cos(tt * 1.3) * 1.0;
      base.beams.forEach(b => {
        const arr = b.geo.attributes.position.array;
        arr[3] = cx; arr[4] = cy; arr[5] = -22;
        b.geo.attributes.position.needsUpdate = true;
      });
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

  /* b189 / g12: scenario auto-fire — picks one of ~30 scripted scenarios
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
      ['bombing',      () => this._spawnDistressBombing()],
      ['debris',       () => this._spawnDebrisCross()],
      ['ghost',        () => this._spawnGhostContact()],
      ['carrier',      () => this._spawnCarrierLaunch()],
      ['escort',       () => this._spawnEscortRun()],
      ['observer',     () => this._spawnSilentObserver()],
      ['strafe',       () => this._spawnLongswordStrafe()],
      // b192 additions
      ['pirate',       () => this._spawnPirateAmbush()],
      ['patrol',       () => this._spawnPatrolPair()],
      ['comet',        () => this._spawnComet()],
      ['eva',          () => this._spawnEvaTether()],
      // g12 cameos — iconic floating one-shots
      ['ccs',          () => this._spawnCcsBattlecruiser()],
      ['keyship',      () => this._spawnKeyshipDescent()],
      ['ringfrag',     () => this._spawnRingFragment()],
      ['monolith',     () => this._spawnMonolith()],
      ['stargate',     () => this._spawnStargateKawoosh()],
      ['frozen',       () => this._spawnFrozenCapital()],
      ['leviathan',    () => this._spawnLeviathan()],
      ['lensing',      () => this._spawnLensingPatch()],
      ['mac',          () => this._spawnMacBroadside()],
      ['spill',        () => this._spawnCargoSpill()],
      ['tug',          () => this._spawnSalvageTug()],
      ['sentinels',    () => this._spawnSentinelSwarm()],
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

  /* ============================================================
     b192 MICRO TIER — ambient one-shot effects firing every 5–12s.
     Goal: kill the 5–10s "nothing's happening" gaps between scripted
     scenarios. Each micro fx is cheap, short-lived, and self-cleans.
     ============================================================ */

  _tickMicroScheduler(t){
    if (this._nextMicroAt == null) this._nextMicroAt = t + 4 + Math.random() * 4;
    if (t < this._nextMicroAt) return;
    this._fireRandomMicro();
    this._nextMicroAt = t + 5 + Math.random() * 7;   // 5–12s gap
  },

  _fireRandomMicro(){
    const pool = [
      ['meteor',   () => this._spawnMeteorMicro()],
      ['pulsar',   () => this._spawnPulsarMicro()],
      ['buzz',     () => this._spawnCloseFighterMicro()],
      ['comm',     () => this._spawnCommStaticMicro()],
      ['emp',      () => this._spawnEmpFlashMicro()],
      ['drone',    () => this._spawnDroneDartMicro()],
    ];
    this._recentMicros = this._recentMicros || [];
    const fresh = pool.filter(([n]) => !this._recentMicros.includes(n));
    const eligible = fresh.length ? fresh : pool;
    const [name, fn] = eligible[Math.floor(Math.random() * eligible.length)];
    try { fn(); } catch (e) { console.warn('[micro] fire failed', name, e); return; }
    this._recentMicros.push(name);
    if (this._recentMicros.length > 3) this._recentMicros.shift();
  },

  _addMicroFx(fx){
    this.microFx = this.microFx || [];
    this.microFx.push(fx);
  },

  _tickMicroFx(t, dt){
    if (!this.microFx || !this.microFx.length) return;
    for (let i = this.microFx.length - 1; i >= 0; i--) {
      const fx = this.microFx[i];
      let alive = true;
      try { alive = fx.tick(t, dt) !== false; } catch (e) { console.warn('[micro] tick failed', e); alive = false; }
      if (!alive) {
        try { fx.cleanup && fx.cleanup(); } catch (_) {}
        this.microFx.splice(i, 1);
      }
    }
  },

  // 1. METEOR — single fat streak across one quadrant in ~1.8s.
  _spawnMeteorMicro(){
    const u  = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const rr = Math.sqrt(1 - u * u);
    const radial = new THREE.Vector3(Math.cos(th) * rr, u, Math.sin(th) * rr);
    const dist = 180 + Math.random() * 100;
    const pos = radial.clone().multiplyScalar(dist);
    const helper = Math.abs(radial.y) > 0.95 ? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,1,0);
    const tangent = new THREE.Vector3().crossVectors(radial, helper).normalize();
    tangent.applyAxisAngle(radial, Math.random() * Math.PI * 2);
    const speed = 110 + Math.random() * 50;

    const tex = (this.streaks && this.streaks[0]) ? this.streaks[0].mat.map : this._makeStreakTexture();
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
      color: new THREE.Color(0xfff0d6),
    });
    const geo = new THREE.PlaneGeometry(110, 9);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.lookAt(pos.clone().add(tangent));
    mesh.rotateZ(Math.PI / 2);
    this.scene.add(mesh);

    const vel = tangent.clone().multiplyScalar(speed);
    let life = 0;
    const maxLife = 1.8;
    this._addMicroFx({
      tick(_t, dt){
        life += dt;
        if (life >= maxLife) return false;
        mesh.position.addScaledVector(vel, dt);
        const lf = life / maxLife;
        mat.opacity = (lf < 0.18 ? lf / 0.18 : (1 - (lf - 0.18) / 0.82)) * 1.4;
        return true;
      },
      cleanup: () => {
        if (mesh.parent) mesh.parent.remove(mesh);
        geo.dispose();
        mat.dispose();
      },
    });
  },

  // 2. PULSAR — fixed-position blinker, ~12s lifespan, rhythmic 1.6 Hz.
  _spawnPulsarMicro(){
    const u  = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const rr = Math.sqrt(1 - u * u);
    const dist = 320 + Math.random() * 80;
    const pos = new THREE.Vector3(Math.cos(th) * rr, u, Math.sin(th) * rr).multiplyScalar(dist);

    const tex = this._makeSatLightTexture ? this._makeSatLightTexture() : this._makeStreakTexture();
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, color: 0x9ad8ff, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
    }));
    sprite.scale.set(11, 11, 1);
    sprite.position.copy(pos);
    this.scene.add(sprite);

    const freq = 1.4 + Math.random() * 0.5;
    const phase = Math.random() * Math.PI * 2;
    let life = 0;
    const maxLife = 11 + Math.random() * 4;
    this._addMicroFx({
      tick(t, dt){
        life += dt;
        if (life >= maxLife) return false;
        // Tight pulse: sharp peak, dim tail. Squared sine gives that vibe.
        const s = Math.sin(t * freq * Math.PI * 2 + phase);
        const beat = Math.max(0, s) * Math.max(0, s);
        // Fade in first 1.2s, fade out last 1.5s
        const env = Math.min(1, life / 1.2) * Math.min(1, (maxLife - life) / 1.5);
        sprite.material.opacity = (0.10 + beat * 0.85) * env;
        sprite.scale.setScalar(8 + beat * 6);
        return true;
      },
      cleanup: () => {
        if (sprite.parent) sprite.parent.remove(sprite);
        sprite.material.map && sprite.material.map.dispose();
        sprite.material.dispose();
      },
    });
  },

  // 3. CLOSE FIGHTER BUZZ — single banshee tearing past camera in ~2s.
  _spawnCloseFighterMicro(){
    const ship = this._acquireShip('banshee');
    if (!ship) return;
    const fwd = this._forwardVec();
    const { right, up } = this._basisFromDir(fwd);
    // Pass close to camera, off-axis so it actually crosses the visible cone.
    const sideSign = Math.random() < 0.5 ? 1 : -1;
    const dir = right.clone().multiplyScalar(sideSign).addScaledVector(fwd, 0.20).normalize();
    const sweepCenter = fwd.clone().multiplyScalar(18 + Math.random() * 10)
      .addScaledVector(up, (Math.random() - 0.5) * 4);
    const start = sweepCenter.clone().addScaledVector(dir, -90);
    ship.outer.position.copy(start);
    ship.outer.lookAt(start.clone().add(dir));
    ship.inner.rotation.set(0, Math.PI, 0);
    ship.velocity.copy(dir).multiplyScalar(170);   // way faster than the 80–120 standard banshee speed
    ship.life = 0;
    ship.maxLife = 1.6;                             // brief
    ship.active = true;
    ship.outer.visible = true;
    // No scenario flag — let _tickFlyby do its normal banshee animation (barrel rolls).
  },

  // 4. COMM STATIC — short text scrap fading in/out near a random title.
  _spawnCommStaticMicro(){
    const titles = this.titles || [];
    if (!titles.length) return;
    const anchor = titles[Math.floor(Math.random() * titles.length)];
    if (!anchor || !anchor.mesh) return;

    const SAMPLES = [
      '...CONTACT BEARING 2-7-9...',
      '...UPLINK NOMINAL...',
      '...PACKET LOSS / 0xCAFE...',
      '...SIGNAL: KANI/CH3...',
      '...IDENT: UNKNOWN...',
      '...RX BUFFER OVERRUN...',
      '...ETA TO TARGET 0:42...',
      '...HANDSHAKE FAILED...',
      '...FALLBACK ROUTE LOCKED...',
      '...NAV PING 0xDEAD...',
      '...HEADSET CHATTER//STATIC...',
    ];
    const text = SAMPLES[Math.floor(Math.random() * SAMPLES.length)];
    const tex = this._makeTitleTexture(text, 64);
    const aspect = tex.image.width / tex.image.height;
    const w = 9;
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTex:      { value: tex },
        uTime:     { value: Math.random() * 100 },
        uHover:    { value: 0.85 },
        uFocus:    { value: 0 },
        uBass:     { value: 0 },
        uOpacity:  { value: 0 },
        uTint:     { value: new THREE.Vector3(0.55, 0.95, 0.75) },
        uHueShift: { value: 0 },
        uBreath:   { value: 0 },
        uTwinkle:  { value: 0 },
      },
      vertexShader: TITLE_VERTEX,
      fragmentShader: TITLE_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, w / aspect), mat);
    // Drop it next to the title in world-space (small lateral nudge so it's not on top of it).
    const titlePos = anchor.mesh.position.clone();
    const off = new THREE.Vector3(
      (Math.random() - 0.5) * 14,
      (Math.random() - 0.5) * 6 - 3,
      (Math.random() - 0.5) * 14,
    );
    plane.position.copy(titlePos).add(off);
    plane.onBeforeRender = (renderer, scene, camera) => { plane.quaternion.copy(camera.quaternion); };
    this.scene.add(plane);

    let life = 0;
    const maxLife = 1.6;
    this._addMicroFx({
      tick(t, dt){
        life += dt;
        if (life >= maxLife) return false;
        mat.uniforms.uTime.value = t;
        const lf = life / maxLife;
        // Triangle envelope, max around 35% through life
        const env = lf < 0.35 ? lf / 0.35 : (1 - (lf - 0.35) / 0.65);
        mat.uniforms.uOpacity.value = env * 0.85;
        return true;
      },
      cleanup: () => {
        if (plane.parent) plane.parent.remove(plane);
        plane.geometry.dispose();
        if (mat.uniforms.uTex.value) mat.uniforms.uTex.value.dispose();
        mat.dispose();
      },
    });
  },

  // 5. EMP FLASH — bright spherical flash from a far point, ~0.55s.
  _spawnEmpFlashMicro(){
    const u  = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const rr = Math.sqrt(1 - u * u);
    const dist = 220 + Math.random() * 100;
    const pos = new THREE.Vector3(Math.cos(th) * rr, u, Math.sin(th) * rr).multiplyScalar(dist);

    const tex = this._makeSatLightTexture ? this._makeSatLightTexture() : this._makeStreakTexture();
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, color: 0xeaf6ff, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
    }));
    sprite.position.copy(pos);
    sprite.scale.set(2, 2, 1);
    this.scene.add(sprite);

    let life = 0;
    const maxLife = 0.55;
    this._addMicroFx({
      tick(_t, dt){
        life += dt;
        if (life >= maxLife) return false;
        const lf = life / maxLife;
        // Sharp rise, longer fall
        const env = lf < 0.12 ? Math.pow(lf / 0.12, 0.5) : Math.pow(1 - (lf - 0.12) / 0.88, 1.6);
        sprite.material.opacity = env * 1.3;
        sprite.scale.setScalar(2 + lf * 18);
        return true;
      },
      cleanup: () => {
        if (sprite.parent) sprite.parent.remove(sprite);
        sprite.material.map && sprite.material.map.dispose();
        sprite.material.dispose();
      },
    });
  },

  // 6. DRONE DART — tiny mesh flicking from one title's neighborhood to another.
  _spawnDroneDartMicro(){
    const titles = this.titles || [];
    if (titles.length < 2) return;
    const aIdx = Math.floor(Math.random() * titles.length);
    let bIdx = Math.floor(Math.random() * titles.length);
    if (bIdx === aIdx) bIdx = (bIdx + 1) % titles.length;
    const a = titles[aIdx].mesh.position.clone();
    const b = titles[bIdx].mesh.position.clone();

    const geo = new THREE.OctahedronGeometry(0.7, 0);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xc8f0ff, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const drone = new THREE.Mesh(geo, mat);
    drone.position.copy(a);
    this.scene.add(drone);

    // Trailing sprite for a tiny head-glow
    const headTex = this._makeSatLightTexture ? this._makeSatLightTexture() : null;
    let head = null;
    if (headTex) {
      head = new THREE.Sprite(new THREE.SpriteMaterial({
        map: headTex, color: 0xc8f0ff, transparent: true, opacity: 0.7,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      head.scale.set(2.4, 2.4, 1);
      drone.add(head);
    }

    let life = 0;
    const maxLife = 1.4 + Math.random() * 0.5;
    const arcOffset = new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 12);
    this._addMicroFx({
      tick(_t, dt){
        life += dt;
        if (life >= maxLife) return false;
        const lf = life / maxLife;
        // Arc: lerp(a,b) + perpendicular bump that peaks mid-flight
        const lerp = a.clone().lerp(b, lf);
        const arc  = arcOffset.clone().multiplyScalar(Math.sin(lf * Math.PI));
        drone.position.copy(lerp).add(arc);
        drone.rotation.x += dt * 4.2;
        drone.rotation.y += dt * 3.1;
        // Fade in/out edges
        const env = lf < 0.12 ? lf / 0.12 : (lf > 0.85 ? (1 - lf) / 0.15 : 1);
        mat.opacity = 0.85 * env;
        if (head) head.material.opacity = 0.65 * env;
        return true;
      },
      cleanup: () => {
        if (drone.parent) drone.parent.remove(drone);
        geo.dispose(); mat.dispose();
        if (head) {
          head.material.map && head.material.map.dispose();
          head.material.dispose();
        }
      },
    });
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
    // b239: moved BEHIND the camera spawn and far out, per user request. Sits
    // deeper in +Z than the Halo ring (which is at z=+1050) — when the user
    // turns 180° to discover the ring, the core appears as a distant Saturn-
    // observatory landmark visible through/past the ring's interior. Offset
    // to (-200, -80) so it's not dead-center behind the ring (avoids stacking
    // it on the ring's central axis). Distance from origin ≈ 1664u, well
    // within the b238 camera far plane of 1800.
    this.coreGroup.position.set(-200, -80, 1650);

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

      // b238: hidden by default — these orbiting gyros pass through every
      // viewpoint (orbit radius 240-340, but the Halo ring's interior reaches
      // out to 1700u from origin) and the user called them out as "in the way
      // of the halo ring." `el-satellites` admin toggle still re-enables them.
      grp.visible = false;
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
    // b235: was rotation.y = π × 0.18, which placed the engine block (at local
    // -X = world (-0.85, 0, +0.54) → CLOSER to camera) and head (at local +X
    // → INTO the screen). The engine block is 28×22×22 + bright thruster
    // cones, the head is just a tiny 11u icosa with spires — visually the
    // engines dominated and read as "the front," making the ship look like
    // it was flying backwards. Flipped 180° (added π) so the head is now the
    // camera-facing end and the engines trail into the screen behind it.
    // Memory: feedback_ships_face_forward.md.
    grp.rotation.y = Math.PI * 1.18;
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
    m.grp.rotation.y = Math.PI * 1.18 + Math.sin(t * 0.04) * 0.012;
  },

  /* ---------- Halo ringworld — far landmark, curving plate with inner-face terrain ---------- */
  // Big TorusGeometry placed at (-60, 5, -380) with major axis along world-X so the
  // plate arcs from the upper-left horizon up across the sky and off into the far
  // depth — the iconic Halo screenshots. Inner face renders a procedural terrain
  // shader (oceans / continents / ice caps / drifting clouds), outer face renders
  // dark Forerunner alloy with subtle plate seams + cyan power trim. Slowly spins
  // around its symmetry axis (the canonical gravity-providing rotation). Material
  // opts out of scene fog so the ring stays crisp at ~600u distance.
  _buildHaloRing(){
    const grp = new THREE.Group();
    // b240: "fucking huge" pass. User wanted the ring much bigger and at a
    // dramatic angle that shows the inside (the curving inner-face plate with
    // ocean/land/clouds, the part they loved seeing). Bumped R 680 → 900,
    // pushed center 1050 → 1300 deeper, and steepened the tilt so the off-
    // axis viewing angle moves from 41.6° (still close to face-on) to 50.5°
    // (proper Halo-Infinite-cover 3/4 view of the curving inhabited surface).
    // Camera far plane 1800 → 2400 to fit the new far edge.
    //   Position (60, 50, +1300): behind camera, slightly up-and-right.
    //   rotation.x = 0.85 (was 0.65) — more forward tilt = inner face
    //     opens toward the camera.
    //   rotation.y = 0.45 + π retained for the bearing flip (ring is at +Z).
    //   rotation.z = -0.10 retained for cinematic asymmetry.
    //   Computed axis ≈ (-0.361, -0.719, -0.594) dot camera-dir-from-ring
    //     (-0.046, -0.038, -0.999) ≈ 0.637 → acos ≈ 50.5°.
    grp.position.set(60, 50, 1300);
    grp.rotation.y = 0.45 + Math.PI;
    grp.rotation.x = 0.85;
    grp.rotation.z = -0.10;

    const RING_R = 900.0;   // b240: 680 → 900 — user: "fucking huge"; planet-class megastructure scale
    const RING_r = 48.0;    // b240: 36 → 48 — proportional thickening (r/R ratio kept) so the terrain band scales with the ring
    const RADIAL_SEGS = 22;
    const TUBULAR_SEGS = 600;

    const geo = new THREE.TorusGeometry(RING_R, RING_r, RADIAL_SEGS, TUBULAR_SEGS);

    const vert = `
      varying vec2 vUv;
      varying float vInnerFace;
      varying float vRimMix;
      void main(){
        vUv = uv;
        // Object-space tube center for this vertex (default torus has axis Z,
        // tube center for vertex at (px,py,pz) is normalize(px,py)*R, z=0).
        // R hardcoded to match RING_R above; if you bump RING_R, bump this too.
        vec2 cXY = normalize(position.xy) * 900.0;
        vec3 tubeCenter = vec3(cXY, 0.0);
        vec3 nObj = normalize(position - tubeCenter);
        vec3 radialOut = vec3(normalize(cXY), 0.0);
        // dot < 0 means vertex normal points toward the torus center axis
        // → that's the INNER (inhabited) face.
        float facing = dot(nObj, radialOut);
        vInnerFace = step(facing, 0.0);   // 1.0 if inner, 0.0 if outer
        vRimMix    = 1.0 - abs(facing);    // peaks on the side rims
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const frag = `
      precision highp float;
      uniform float uTime;
      uniform float uBass;
      varying vec2 vUv;
      varying float vInnerFace;
      varying float vRimMix;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise2(vec2 p){
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p){
        float v = 0.0; float a = 0.5;
        for (int i = 0; i < 5; i++){ v += a * noise2(p); p *= 2.07; a *= 0.5; }
        return v;
      }

      void main(){
        // g9: dark "lip" band on the silhouette rim — creates a clear edge
        // line where inner and outer faces meet. Bloom can't smear dark
        // pixels, so this band stays as a structural separator no matter
        // how aggressive halation gets. Applied to both faces below.
        // g11: reverted g10's cross-ribs — they broke the torus illusion,
        // making the ring look like a slatted tube instead of a megastructure
        // with a continuous inhabited inner surface.
        float lip = smoothstep(0.74, 0.96, vRimMix);
        float lipMul = mix(1.0, 0.18, lip);

        // ----- OUTER FACE: Forerunner alloy, slight violet bias -----
        if (vInnerFace < 0.5) {
          float seam = step(0.985, fract(vUv.x * 60.0));
          float ridge = fbm(vec2(vUv.x * 14.0, vUv.y * 3.0));
          vec3 base = vec3(0.075, 0.078, 0.135) * (0.55 + 0.45 * ridge);
          base += vec3(0.18, 0.50, 0.75) * seam * 0.10;
          base += vec3(0.14, 0.30, 0.50) * smoothstep(0.55, 0.95, vRimMix) * 0.06;
          base *= (1.0 + uBass * 0.06);
          base *= lipMul;
          gl_FragColor = vec4(base, 1.0);
          return;
        }

        // ----- INNER FACE: terrain band, kept under halation threshold -----
        float lat = (vUv.y - 0.5) * 2.0;

        float cont = fbm(vec2(vUv.x * 4.5, lat * 1.2));
        cont += 0.40 * fbm(vec2(vUv.x * 11.0 + 13.0, lat * 3.0));
        cont *= 0.71;

        float landMask = smoothstep(0.40, 0.49, cont);
        float ice = smoothstep(0.86, 0.98, abs(lat));

        vec3 oceanDeep = vec3(0.020, 0.10, 0.38);
        vec3 oceanSh   = vec3(0.09,  0.32, 0.62);
        vec3 ocean = mix(oceanDeep, oceanSh, smoothstep(0.16, 0.40, cont));

        vec3 forest = vec3(0.14, 0.42, 0.18);
        vec3 desert = vec3(0.48, 0.36, 0.16);
        vec3 land   = mix(forest, desert, smoothstep(0.55, 0.78, cont));

        vec3 surface = mix(ocean, land, landMask);
        surface = mix(surface, vec3(0.62, 0.68, 0.78), ice);

        float clouds = fbm(vec2(vUv.x * 16.0 + uTime * 0.020, lat * 4.5 + uTime * 0.006));
        clouds = smoothstep(0.62, 0.92, clouds);
        surface = mix(surface, vec3(0.55, 0.58, 0.62), clouds * 0.16);

        surface += vec3(0.04, 0.14, 0.24) * uBass * 0.10;

        surface *= lipMul;

        gl_FragColor = vec4(surface, 1.0);
      }
    `;

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
      },
      vertexShader: vert,
      fragmentShader: frag,
      transparent: false,
      depthWrite: true,
      side: THREE.DoubleSide,
      // Intentionally NOT setting `fog: true` — this is a far landmark and
      // FogExp2 at density 0.0035 would swallow it past ~400u.
    });

    const ring = new THREE.Mesh(geo, mat);
    grp.add(ring);

    this.scene.add(grp);
    this.haloRing = { grp, mesh: ring, mat };
  },

  _tickHaloRing(t, bass){
    if (!this.haloRing || !this.haloRing.grp.visible) return;
    const r = this.haloRing;
    r.mat.uniforms.uTime.value = t;
    r.mat.uniforms.uBass.value = bass;
    // b232: spin rate dropped from 0.0035 → 0.0007 rad/frame (~5×slower).
    // g3: still read "too fast" — dropped again 0.0007 → 0.00015 (another
    // ~4.7×slower). At 60fps this is one full revolution per ~12 minutes,
    // closer to the canonical "monumental gravity-providing" feel where
    // motion is barely perceptible across a normal viewing.
    r.mesh.rotation.z += 0.00015;
  },

  /* ---------- The Traveler — paneled white sphere overhead, Destiny landmark ---------- */
  // g2: fills the empty overhead bearing — Marathon is front-low-left, Halo
  // ring is behind-up-right, distant core is deep-behind-low-left, so the only
  // way users discover this one is by drag-looking up. Icosahedron at detail=4
  // so the silhouette reads as a faceted machine rather than a smooth moon;
  // shader hashes object-space normals into per-panel IDs, paints most panels
  // milk-white, sparse warm "exposed innards" panels concentrated on the
  // lower hemisphere (canon: Traveler's underside is mechanically scarred).
  // Fresnel rim + sprite halo so the sphere reads luminous against the void.
  // Material opts out of fog (far landmark, same as Halo ring).
  _buildTraveler(){
    const grp = new THREE.Group();
    // Position: high overhead, slightly forward + lateral offset so a
    // comfortable upward gaze catches it rather than requiring a dead-zenith
    // tilt. Distance from origin ≈ 807u — well inside far plane 2400.
    grp.position.set(80, 760, -260);

    const TRAV_R = 130.0;

    const geo = new THREE.IcosahedronGeometry(TRAV_R, 4);

    const vert = `
      varying vec3 vNormalObj;
      varying vec3 vNormalView;
      varying float vUpDot;
      void main(){
        vNormalObj = normalize(normal);
        vec3 nWorld = normalize(mat3(modelMatrix) * normal);
        vUpDot = nWorld.y;
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const frag = `
      precision highp float;
      uniform float uTime;
      uniform float uBass;
      varying vec3 vNormalObj;
      varying vec3 vNormalView;
      varying float vUpDot;

      float hash3(vec3 p){
        return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
      }

      void main(){
        // Quantize object-space normal so each polyhedron facet collapses
        // to one stable hash → one panel ID. Stable under the slow yaw drift.
        vec3 q = floor(vNormalObj * 10.0 + 0.5);
        float pid = hash3(q);

        // Bottom hemisphere reads warmer + dirtier (the exposed innards).
        float bottomBias = smoothstep(0.30, -0.40, vUpDot);

        vec3 white = vec3(0.92, 0.91, 0.88);
        vec3 cream = vec3(0.78, 0.74, 0.68);
        vec3 baseTone = mix(white, cream, pid * 0.45);
        baseTone *= mix(1.0, 0.78, bottomBias * 0.35);

        // Sparse warm panels — denser as we move toward the bottom pole.
        float warmThresh = mix(0.93, 0.62, bottomBias);
        float isWarm = step(warmThresh, pid);
        vec3 warmGlow = vec3(1.00, 0.62, 0.28);
        float warmPulse = 0.85 + 0.45 * sin(uTime * 0.7 + pid * 17.0) + uBass * 0.5;
        vec3 col = mix(baseTone, warmGlow * warmPulse, isWarm * 0.85);

        // Fixed top-key shading via world-Y of normal — the sphere reads
        // bright on top and shaded underneath regardless of camera angle.
        float kd = clamp(vUpDot * 0.95 + 0.20, 0.0, 1.0);
        float ambient = 0.40;
        col *= ambient + (1.0 - ambient) * (0.55 + 0.45 * kd);

        // Fresnel rim — silhouette glow that reads luminous against the void.
        float fres = pow(1.0 - abs(vNormalView.z), 2.5);
        col += vec3(0.85, 0.78, 0.62) * fres * 0.45;

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
      },
      vertexShader: vert,
      fragmentShader: frag,
      transparent: false,
      depthWrite: true,
      side: THREE.FrontSide,
    });

    const sphere = new THREE.Mesh(geo, mat);
    grp.add(sphere);

    // Outer halo sprite — soft luminous bloom so the silhouette reads even
    // when the bare polyhedral edge would otherwise blend into the starfield.
    const haloTex = this._makeSatLightTexture();
    const haloMat = new THREE.SpriteMaterial({
      map: haloTex,
      color: 0xfff2d8,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    const halo = new THREE.Sprite(haloMat);
    halo.scale.set(TRAV_R * 3.4, TRAV_R * 3.4, 1);
    grp.add(halo);

    this.scene.add(grp);
    this.traveler = { grp, mesh: sphere, mat, haloMat };
  },

  _tickTraveler(t, bass){
    if (!this.traveler || !this.traveler.grp.visible) return;
    const tr = this.traveler;
    tr.mat.uniforms.uTime.value = t;
    tr.mat.uniforms.uBass.value = bass;
    // Barely-perceptible yaw — Traveler in canon is functionally motionless,
    // so the rotation is well under the Halo ring's spin (~0.0007). 0.00018
    // rad/frame ≈ one full revolution per ~6 minutes at 60fps.
    tr.grp.rotation.y += 0.00018;
    // Gentle halo breathe with bass.
    tr.haloMat.opacity = 0.30 + bass * 0.18;
  },

  /* ---------- Neuron threads — ambient firing between title pairs ---------- */
  // Pool of N short additive line segments. Every 200–350ms a free thread
  // claims two random nearby titles as endpoints, fades over ~500ms via a
  // sin-bell envelope. Constant background firing makes the constellation
  // read as a living organism — neurons sparking between songs even when no
  // scenarios are active. Endpoints follow title drift each frame so threads
  // don't lag behind their titles.
  _buildNeuronThreads(){
    const POOL = 8;
    this.neuronGroup = new THREE.Group();
    this.neuronThreads = [];
    for (let i = 0; i < POOL; i++) {
      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array(6);  // 2 endpoints × 3 coords
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.LineBasicMaterial({
        color: 0x88c8ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      });
      const line = new THREE.Line(geo, mat);
      line.visible = false;
      this.neuronGroup.add(line);
      this.neuronThreads.push({
        line, geo, mat,
        active: false, life: 0, maxLife: 0,
        a: null, b: null,
      });
    }
    this.scene.add(this.neuronGroup);
    this._neuronNextAt = null;
  },

  _tickNeuronThreads(t, dt, bass){
    if (!this.neuronThreads || !this.neuronGroup.visible) return;
    // Tick active threads: fade via sin envelope, update endpoints to track
    // their titles' current drifted positions.
    for (let i = 0; i < this.neuronThreads.length; i++) {
      const n = this.neuronThreads[i];
      if (!n.active) continue;
      n.life += dt;
      const k = n.life / n.maxLife;
      if (k >= 1) {
        n.active = false;
        n.line.visible = false;
        n.mat.opacity = 0;
        continue;
      }
      const env = Math.sin(k * Math.PI);
      // Slight bass boost so loud passages light the brain up more.
      n.mat.opacity = env * (0.35 + bass * 0.40);
      const pos = n.geo.attributes.position.array;
      pos[0] = n.a.mesh.position.x;
      pos[1] = n.a.mesh.position.y;
      pos[2] = n.a.mesh.position.z;
      pos[3] = n.b.mesh.position.x;
      pos[4] = n.b.mesh.position.y;
      pos[5] = n.b.mesh.position.z;
      n.geo.attributes.position.needsUpdate = true;
    }
    // Scheduler — fire a new thread every 180–360ms while one's free.
    if (this._neuronNextAt == null) this._neuronNextAt = t + 0.5;
    if (t < this._neuronNextAt) return;
    const free = this.neuronThreads.find(n => !n.active);
    if (free && this.titles && this.titles.length >= 2) {
      const a = this.titles[(Math.random() * this.titles.length) | 0];
      let b = null;
      // Up to 6 attempts to find a nearby partner (≤ 95 units apart). After
      // that, accept whatever — a long thread reads as a "deep connection"
      // and is just as cool, just rarer.
      for (let attempt = 0; attempt < 6; attempt++) {
        const cand = this.titles[(Math.random() * this.titles.length) | 0];
        if (cand === a) continue;
        if (a.basePos.distanceTo(cand.basePos) <= 95) { b = cand; break; }
        if (!b) b = cand;
      }
      if (b && b !== a) {
        free.active = true;
        free.life = 0;
        free.maxLife = 0.42 + Math.random() * 0.28;
        free.a = a;
        free.b = b;
        free.line.visible = true;
        free.mat.opacity = 0;
        // Random cyan→violet hue per firing so the brain isn't monochrome.
        const hue = 0.52 + Math.random() * 0.18;   // 0.52 (cyan) → 0.70 (lavender)
        free.mat.color.setHSL(hue, 0.55 + Math.random() * 0.20, 0.72);
      }
    }
    this._neuronNextAt = t + 0.18 + Math.random() * 0.18;
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
    // Tracks hidden from the galaxy view (still playable elsewhere — they
    // just don't get a title plane on the sphere).
    const HIDDEN_TITLES = new Set([
      'filip',
      'warzone',
      '10 miles',
      'gunning',
      "uh, i'm sick",
      'bluff caller',
    ]);
    const all = (this.ctx.tracks || []).filter(t =>
      !HIDDEN_TITLES.has((t.title || '').toLowerCase().trim())
    );
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
          uBreath:    { value: 0 },   // b192
          uTwinkle:   { value: 0 },   // b192
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
    const MAX_W = 2048;
    const measureCanvas = document.createElement('canvas');
    const mctx = measureCanvas.getContext('2d');
    // Measure at requested size, then shrink fontSize if the laid-out width
    // would exceed the texture cap — otherwise long titles get clipped (the
    // canvas hard-caps at MAX_W and the text gets centered + sliced).
    let fs = fontSize;
    mctx.font = `800 ${fs}px "Space Grotesk", Inter, system-ui, sans-serif`;
    let measured = mctx.measureText(text).width;
    let padding = Math.floor(fs * 0.4);
    let tw = Math.ceil(measured) + padding * 2;
    if (tw > MAX_W) {
      const scale = MAX_W / tw;
      fs = Math.max(40, Math.floor(fs * scale));
      mctx.font = `800 ${fs}px "Space Grotesk", Inter, system-ui, sans-serif`;
      measured = mctx.measureText(text).width;
      padding = Math.floor(fs * 0.4);
      tw = Math.ceil(measured) + padding * 2;
    }
    const th = Math.ceil(fs * 1.40) + padding;
    const w = Math.min(MAX_W, Math.max(256, tw));
    const h = Math.min(640, Math.max(96, th));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.font = `800 ${fs}px "Space Grotesk", Inter, system-ui, sans-serif`;
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
    const raw = Math.min(1, s / (8 * 255));
    // g5: ~30 shader terms read this value (bloom strength, CA, title
    // glitch, halo ring inner-face, marathon neon, traveler panels, etc.)
    // and the cumulative silent→playing jump was jarring. Compressing the
    // effective swing globally tames all reactivity together — silent stays
    // at 0 (no dead-state shift), peaks land at GAIN instead of 1.0.
    // Reactivity preserved, delta is gentler.
    const GAIN = 0.45;
    return raw * GAIN;
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

      <!-- TOP: most-used utilities + camera state in one place -->
      <div class="mw-admin-section" data-cat="stage" data-key="stage">
        <div class="mw-admin-label">stage</div>
        <button data-act="clear">clear all flybys</button>
        <button data-act="cap-random">🎲 hop to random title</button>
        <button data-act="reset-cam">reset camera</button>
        <button data-act="cap-png">📸 save canvas as PNG</button>
        <button data-act="cap-hud" id="mw-cap-hud">hide HUD: <span>OFF</span></button>
        <button data-act="follow-toggle" id="mw-admin-follow-btn">follow-cam: <span id="mw-admin-follow-state">auto</span></button>
        <button data-act="inertia-toggle" id="mw-inertia">drag inertia: <span>ON</span></button>
      </div>

      <!-- TIME + FOV grouped together (both about playback-pace and view-frame) -->
      <div class="mw-admin-section" data-cat="time" data-key="time">
        <div class="mw-admin-label">time &amp; fov</div>
        <button data-act="time-pause" id="mw-time-pause">⏸ pause</button>
        <button data-act="time-0.25">0.25×</button>
        <button data-act="time-0.5">0.5×</button>
        <button data-act="time-1">1× (normal)</button>
        <button data-act="time-2">2×</button>
        <button data-act="cap-fov-down">FOV −5° (zoom in)</button>
        <button data-act="cap-fov-up">FOV +5° (zoom out)</button>
        <button data-act="cap-fov-reset">FOV reset (80°)</button>
      </div>

      <!-- WORLD: what's visible in the scene -->
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
        <button data-act="el-haloring"  id="mw-el-haloring">halo ring: <span>ON</span></button>
        <button data-act="el-traveler"  id="mw-el-traveler" data-since="g2">traveler: <span>ON</span></button>
        <button data-act="el-buoys"     id="mw-el-buoys">nav buoys: <span>ON</span></button>
        <button data-act="el-neurons"   id="mw-el-neurons" data-since="g8">neuron threads: <span>ON</span></button>
      </div>

      <!-- IMAGE: post-process pipeline + global hue -->
      <div class="mw-admin-section" data-cat="fx" data-key="fx">
        <div class="mw-admin-label">post fx</div>
        <button data-act="fx-flares"   id="mw-fx-flares">anamorphic flares: <span>ON</span></button>
        <button data-act="fx-dirt"     id="mw-fx-dirt">lens dirt: <span>ON</span></button>
        <button data-act="fx-godrays"  id="mw-fx-godrays">god rays (core): <span>ON</span></button>
        <button data-act="fx-dof"      id="mw-fx-dof">soft DoF: <span>OFF</span></button>
        <button data-act="fx-halation" id="mw-fx-halation">halation: <span>OFF</span></button>
        <button data-act="fx-halo-auto" id="mw-fx-halo-auto">↻ halation auto: <span>OFF</span></button>
        <button data-act="fx-grade"    id="mw-fx-grade">color grade: <span>OFF</span></button>
        <button data-act="fx-grade-auto" id="mw-fx-grade-auto">↻ grade auto: <span>OFF</span></button>
        <button data-act="hue-toggle">↻ hue auto-flow</button>
        <button data-act="hue-bump">bump hue +0.1</button>
      </div>

      <!-- TRIGGERS: one-off ship spawns -->
      <div class="mw-admin-section" data-cat="spawn" data-key="spawn">
        <div class="mw-admin-label">spawn ship</div>
        <button data-act="spawn-longsword">longsword (solo)</button>
        <button data-act="spawn-longsword-v">longsword (V-formation)</button>
        <button data-act="spawn-banshee">banshee</button>
        <button data-act="spawn-pelican">pelican (no combat)</button>
        <button data-act="spawn-forerunner">forerunner</button>
      </div>

      <!-- DOGFIGHT (combat focused on a title — base + 5 patterns) -->
      <div class="mw-admin-section" data-cat="combat" data-key="dogfight">
        <div class="mw-admin-label">dogfight</div>
        <button data-act="combat">pelican vs banshee</button>
        <button data-act="combat-across_behind">across · behind title</button>
        <button data-act="combat-fly_toward">fly toward camera</button>
        <button data-act="combat-fly_over">fly over title</button>
        <button data-act="combat-cross_in_front">cross in front</button>
        <button data-act="combat-weave_near">weave near title</button>
        <div class="mw-admin-hint" id="mw-admin-focus-hint"></div>
      </div>

      <!-- SCENARIOS — split by feel: ambient / combat / fleet / micro -->
      <div class="mw-admin-section" data-cat="scripted" data-key="ambient">
        <div class="mw-admin-label">ambient</div>
        <button data-act="scen-observer">silent observer</button>
        <button data-act="scen-ghost">ghost contact</button>
        <button data-act="scen-orbit">forerunner orbit</button>
        <button data-act="scen-mothership">mothership reveal</button>
        <button data-act="scen-distress">distress beacon</button>
        <button data-act="scen-eva">eva tether</button>
        <button data-act="scen-comet">comet pass</button>
        <button data-act="scen-scanner">scanner sweep</button>
        <button data-act="scen-landing">emergency landing</button>
        <button data-act="scen-derelict">derelict drift · sparking</button>
        <button data-act="scen-debris">debris field cross</button>
      </div>

      <div class="mw-admin-section" data-cat="combat" data-key="combat-scenarios">
        <div class="mw-admin-label">combat</div>
        <button data-act="scen-strafe">longsword strafing run</button>
        <button data-act="scen-interception">interception · 2 vs 1</button>
        <button data-act="scen-bombing">distress · bombing run</button>
        <button data-act="scen-storm">plasma storm</button>
        <button data-act="scen-pirate">pirate ambush</button>
        <button data-act="scen-crash">crash dive · smoke trail</button>
        <button data-act="scen-slipspace">slipspace jump</button>
      </div>

      <div class="mw-admin-section" data-cat="scripted" data-key="fleet">
        <div class="mw-admin-label">fleet</div>
        <button data-act="scen-escort">escort run · V-formation</button>
        <button data-act="scen-convoy">convoy · 3 pelicans + cargo</button>
        <button data-act="scen-carrier">carrier launch · 3 longswords</button>
        <button data-act="scen-fleet">fleet jump-in · 6 ships</button>
        <button data-act="scen-patrol">patrol pair</button>
      </div>

      <div class="mw-admin-section" data-cat="scripted" data-key="micro">
        <div class="mw-admin-label">micro</div>
        <button data-act="micro-meteor">meteor</button>
        <button data-act="micro-pulsar">pulsar</button>
        <button data-act="micro-buzz">close-fighter buzz</button>
        <button data-act="micro-comm">comm static</button>
        <button data-act="micro-emp">emp flash</button>
        <button data-act="micro-drone">drone dart</button>
      </div>

      <!-- g12 — CAMEOS — iconic floating one-shots (Halo ring / Marathon-ship energy) -->
      <div class="mw-admin-section" data-cat="scripted" data-key="cameos">
        <div class="mw-admin-label">cameos</div>
        <button data-act="cam-ccs"       data-since="g12">CCS battlecruiser pass</button>
        <button data-act="cam-keyship"   data-since="g12">forerunner keyship descent</button>
        <button data-act="cam-ringfrag"  data-since="g12">halo ring fragment</button>
        <button data-act="cam-monolith"  data-since="g12">2001 monolith</button>
        <button data-act="cam-stargate"  data-since="g12">stargate kawoosh</button>
        <button data-act="cam-frozen"    data-since="g12">frozen capital ship</button>
        <button data-act="cam-leviathan" data-since="g12">space whale · leviathan</button>
        <button data-act="cam-lensing"   data-since="g12">gravitational lensing patch</button>
        <button data-act="cam-mac"       data-since="g12">MAC round broadside</button>
        <button data-act="cam-spill"     data-since="g12">cargo container spill</button>
        <button data-act="cam-tug"       data-since="g12">salvage tug</button>
        <button data-act="cam-sentinels" data-since="g12">sentinel swarm scan</button>
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
        else if (act === 'scen-bombing')      this._spawnDistressBombing();
        else if (act === 'scen-debris')       this._spawnDebrisCross();
        else if (act === 'scen-scanner')      this._spawnScannerSweep();
        else if (act === 'scen-landing')      this._spawnEmergencyLanding();
        else if (act === 'scen-ghost')        this._spawnGhostContact();
        else if (act === 'scen-carrier')      this._spawnCarrierLaunch();
        else if (act === 'scen-escort')       this._spawnEscortRun();
        else if (act === 'scen-observer')     this._spawnSilentObserver();
        else if (act === 'scen-eva')          this._spawnEvaTether();
        else if (act === 'scen-comet')        this._spawnComet();
        else if (act === 'scen-patrol')       this._spawnPatrolPair();
        else if (act === 'scen-pirate')       this._spawnPirateAmbush();
        else if (act === 'micro-meteor')      this._spawnMeteorMicro();
        else if (act === 'micro-pulsar')      this._spawnPulsarMicro();
        else if (act === 'micro-buzz')        this._spawnCloseFighterMicro();
        else if (act === 'micro-comm')        this._spawnCommStaticMicro();
        else if (act === 'micro-emp')         this._spawnEmpFlashMicro();
        else if (act === 'micro-drone')       this._spawnDroneDartMicro();
        // g12 cameos
        else if (act === 'cam-ccs')           this._spawnCcsBattlecruiser();
        else if (act === 'cam-keyship')       this._spawnKeyshipDescent();
        else if (act === 'cam-ringfrag')      this._spawnRingFragment();
        else if (act === 'cam-monolith')      this._spawnMonolith();
        else if (act === 'cam-stargate')      this._spawnStargateKawoosh();
        else if (act === 'cam-frozen')        this._spawnFrozenCapital();
        else if (act === 'cam-leviathan')     this._spawnLeviathan();
        else if (act === 'cam-lensing')       this._spawnLensingPatch();
        else if (act === 'cam-mac')           this._spawnMacBroadside();
        else if (act === 'cam-spill')         this._spawnCargoSpill();
        else if (act === 'cam-tug')           this._spawnSalvageTug();
        else if (act === 'cam-sentinels')     this._spawnSentinelSwarm();
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
      elState('mw-el-haloring',   this.haloRing ? this.haloRing.grp.visible : true);
      elState('mw-el-traveler',   this.traveler ? this.traveler.grp.visible : true);
      elState('mw-el-buoys',      this.navBuoys ? this.navBuoys.every(b => b.grp.visible) : true);
      elState('mw-el-neurons',    this.neuronGroup ? this.neuronGroup.visible : true);
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
    this._decorateNewBadges(root);
    return root;
  },

  // Reads `data-since="g###"` on each admin button and paints a "new" pill
  // that fades the further the current build has drifted from the build that
  // introduced the button. `--new-strength` (a 0..1 CSS variable) drives both
  // opacity and glow on .mw-new. Buttons with delta ≥ NEW_FADE_BUILDS get
  // nothing — the pill is removed entirely. Section labels mirror the
  // strongest pill among their visible children so collapsed sections still
  // hint that something new is inside.
  _decorateNewBadges(root){
    const NEW_FADE_BUILDS = 5;
    const cur = parseInt(String(window.BUILD_GALAXY || 'g0').replace(/\D/g, ''), 10) || 0;
    root.querySelectorAll('button[data-since]').forEach(btn => {
      const since = parseInt(String(btn.dataset.since || '').replace(/\D/g, ''), 10) || 0;
      const delta = Math.max(0, cur - since);
      const strength = Math.max(0, 1 - delta / NEW_FADE_BUILDS);
      if (strength <= 0) return;
      const pill = document.createElement('span');
      pill.className = 'mw-new';
      pill.textContent = 'new';
      pill.style.setProperty('--new-strength', strength.toFixed(2));
      btn.appendChild(pill);
    });
    // Section-header rollup so a collapsed section still hints at fresh items.
    root.querySelectorAll('.mw-admin-section').forEach(sec => {
      let maxStrength = 0;
      sec.querySelectorAll('.mw-new').forEach(p => {
        const s = parseFloat(p.style.getPropertyValue('--new-strength')) || 0;
        if (s > maxStrength) maxStrength = s;
      });
      if (maxStrength <= 0) return;
      const label = sec.querySelector('.mw-admin-label');
      if (!label) return;
      const dot = document.createElement('span');
      dot.className = 'mw-new-dot';
      dot.style.setProperty('--new-strength', maxStrength.toFixed(2));
      label.appendChild(dot);
    });
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
      haloring:   () => this.haloRing ? this.haloRing.grp : null,
      traveler:   () => this.traveler ? this.traveler.grp : null,
      buoys:      () => this.navBuoys,
      neurons:    () => this.neuronGroup,
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
    // Snap the camera straight at the picked title's bearing instead of using
    // 'look' mode's gradual yaw/pitch lerp — for a 180° hop the lerp can take
    // >1s and any drag interrupts it, so the user pressed the button and saw
    // nothing happen. Snap + 'fly' makes the title pull forward immediately.
    const p = pick.basePos;
    const dist = Math.max(0.001, p.length());
    this.gaze.yaw   = Math.atan2(p.x, -p.z);
    this.gaze.pitch = Math.asin(Math.max(-1, Math.min(1, p.y / dist)));
    if (this._dragVel) { this._dragVel.yaw = 0; this._dragVel.pitch = 0; }
    this._focus(pick, { mode: 'fly' });
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
    this._tickHaloRing(t, bass);
    this._tickTraveler(t, bass);
    this._tickNavBuoys(t, bass);
    this._tickNeuronThreads(t, dt, bass);

    // g8 — constellation breath. Lerp _breath toward current bass with a
    // ~165ms half-life so the response is punchy but not jittery. Title
    // positions read this and multiply basePos by (1 + _breath * 0.06) →
    // peak bass ≈ 0.45 (post-gain) gives ~2.7% radial expansion across the
    // whole sphere. The galaxy literally inhales with the music.
    this._breath += (bass - this._breath) * Math.min(1, dt * 6.0);
    this._tickStarfield(t);
    this._tickMicroFx(t, dt);
    this._tickMicroScheduler(t);
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

    // b192: TWINKLE scheduler — pure brightness flash on a random title
    // every 0.8–1.5s. Distinct from the glitch burst (which boosts uHover
    // and triggers RGB-split / displacement); twinkle just brightens for
    // ~0.18–0.38s. Multiple can overlap so the field reads like distant
    // stars scintillating, not "one title is doing something."
    if (this._twinkleNext == null) this._twinkleNext = t + 0.6;
    if (t >= this._twinkleNext && this.titles.length > 0) {
      const live = this.focused
        ? this.titles.filter(n => n.index !== this.focused.index)
        : this.titles;
      const pick = live[(Math.random() * live.length) | 0];
      if (pick) pick._twinkleUntil = t + 0.18 + Math.random() * 0.20;
      this._twinkleNext = t + 0.8 + Math.random() * 0.7;
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
      // b192: per-title slow breathing (random phase via flickerSeed) +
      // eased twinkle ramp toward the scheduled flash.
      u.uBreath.value = Math.sin(t * 0.55 + n.flickerSeed * 7.31) * 0.05;
      const targetTw = ((n._twinkleUntil || 0) > t) ? 1.0 : 0.0;
      u.uTwinkle.value += (targetTw - u.uTwinkle.value) * Math.min(1, dt * (targetTw > 0 ? 16 : 6));
      let targetOp;
      if (this.focused) targetOp = isFocus ? 1.0 : 0.10;
      else targetOp = n.baseOpacity;
      u.uOpacity.value += (targetOp - u.uOpacity.value) * Math.min(1, dt * 5);

      let targetPos;
      if (isFocus && this.focusMode === 'fly') {
        targetPos = fwdNow.clone().multiplyScalar(n.showcaseDist || 18);
      } else {
        // Idle drift OR look-mode focus: title stays at its constellation slot
        // with gentle bobbing + global breath that radially expands the whole
        // sphere on bass impacts (g8).
        const ph = n.flickerSeed;
        tmpDrift.set(
          Math.sin(t * 0.42 + ph)        * 1.4,
          Math.cos(t * 0.31 + ph * 1.7)  * 1.0,
          Math.sin(t * 0.27 + ph * 0.8)  * 1.2
        );
        const breathScale = 1 + (this._breath || 0) * 0.06;
        targetPos = n.basePos.clone().multiplyScalar(breathScale).add(tmpDrift);
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
