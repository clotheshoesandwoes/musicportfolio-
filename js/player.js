/* =========================================================
   PLAYER.JS — Audio engine, controls, Web Audio API
   ========================================================= */

const playerAudio = new Audio();
playerAudio.preload = 'none';
playerAudio.volume = 0.8;
// b011 — required for createMediaElementSource() to work with R2 audio.
// Without this, the AudioContext analyser silently outputs zeros (because
// the cross-origin source is opaque), which means total silence reaches
// the audio destination since the analyser is wired into the audio path.
// Must be set BEFORE any src is assigned.
playerAudio.crossOrigin = 'anonymous';

let audioContext = null;
let analyser = null;
let sourceNode = null;
let frequencyData = null;

/* =========================================================
   DOM REFS
   ========================================================= */
const playerTitle = document.getElementById('playerTitle');
const playerArt = document.getElementById('playerArt');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const seekTrack = document.getElementById('seekTrack');
const seekFill = document.getElementById('seekFill');
const timeCurrent = document.getElementById('timeCurrent');
const timeTotal = document.getElementById('timeTotal');
const shuffleBtn = document.getElementById('shuffleBtn');
const repeatBtn = document.getElementById('repeatBtn');
const volumeBtn = document.getElementById('volumeBtn');
const volumeSlider = document.getElementById('volumeSlider');
const mobileProgress = document.getElementById('mobileProgress');

/* =========================================================
   CORE FUNCTIONS
   ========================================================= */
function loadTrack(index) {
  state.currentTrack = index;
  const track = tracks[index];
  // b011 — audio served from Cloudflare R2 (config.audioBase). Falls back
  // to local audio-mp3/ folder if config.json hasn't loaded yet.
  const base = (typeof siteConfig !== 'undefined' && siteConfig && siteConfig.audioBase)
    ? siteConfig.audioBase
    : 'audio-mp3/';
  playerAudio.src = base + encodeURIComponent(track.file);
  playerTitle.textContent = track.title;
  playerArt.style.background = getGradient(index);
  document.title = track.title + ' | Kani';

  // Notify active view
  if (views[activeView] && views[activeView].onTrackChange) {
    views[activeView].onTrackChange(index);
  }
}

function play() {
  playerAudio.play().then(() => {
    state.isPlaying = true;
    updatePlayButton();
    initAudioContext();
  }).catch(() => {});
}

function pause() {
  playerAudio.pause();
  state.isPlaying = false;
  updatePlayButton();
}

function togglePlay() {
  if (!playerAudio.src || state.currentTrack === -1) {
    loadTrack(0);
    play();
    return;
  }
  state.isPlaying ? pause() : play();
}

function playNext() {
  if (tracks.length === 0) return;
  let next;
  if (state.shuffleMode) {
    next = Math.floor(Math.random() * tracks.length);
  } else {
    next = (state.currentTrack + 1) % tracks.length;
  }
  loadTrack(next);
  play();
}

function playPrev() {
  if (tracks.length === 0) return;
  if (playerAudio.currentTime > 3) {
    playerAudio.currentTime = 0;
    return;
  }
  let prev;
  if (state.shuffleMode) {
    prev = Math.floor(Math.random() * tracks.length);
  } else {
    prev = (state.currentTrack - 1 + tracks.length) % tracks.length;
  }
  loadTrack(prev);
  play();
}

function playTrack(index) {
  loadTrack(index);
  play();
}

/* =========================================================
   QUEUE — b056. Click-to-queue from views.
   - playOrQueue(i): if nothing's playing OR nothing's ever
     been loaded, play immediately. Otherwise push to the
     queue and let the 'ended' handler drain it.
   - queueTrack(i): just push to queue (no immediate play).
   - The 'ended' event drains playQueue.shift() before
     falling through to the existing repeat/next logic.
   ========================================================= */
const playQueue = [];

function queueTrack(index) {
  playQueue.push(index);
}

function playOrQueue(index) {
  // Nothing playing right now → start it immediately.
  if (state.currentTrack === -1 || !state.isPlaying) {
    loadTrack(index);
    play();
    return 'playing';
  }
  // Otherwise queue it for after the current track ends.
  playQueue.push(index);
  return 'queued';
}

function getQueueLength() { return playQueue.length; }

/* =========================================================
   UI UPDATES
   ========================================================= */
function updatePlayButton() {
  const iconPlay = playPauseBtn.querySelector('.icon-play');
  const iconPause = playPauseBtn.querySelector('.icon-pause');
  iconPlay.style.display = state.isPlaying ? 'none' : 'block';
  iconPause.style.display = state.isPlaying ? 'block' : 'none';
}

function formatTime(sec) {
  if (isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

/* =========================================================
   AUDIO EVENTS
   ========================================================= */
playerAudio.addEventListener('timeupdate', () => {
  if (!playerAudio.duration) return;
  const pct = (playerAudio.currentTime / playerAudio.duration) * 100;
  seekFill.style.width = pct + '%';
  timeCurrent.textContent = formatTime(playerAudio.currentTime);
  mobileProgress.style.width = pct + '%';
});

playerAudio.addEventListener('loadedmetadata', () => {
  timeTotal.textContent = formatTime(playerAudio.duration);
});

playerAudio.addEventListener('ended', () => {
  if (state.repeatMode === 'one') {
    playerAudio.currentTime = 0;
    play();
    return;
  }
  // b056 — drain the queue first if anything's been queued from the wall.
  if (playQueue.length > 0) {
    const next = playQueue.shift();
    loadTrack(next);
    play();
    return;
  }
  if (state.repeatMode === 'all' || state.currentTrack < tracks.length - 1 || state.shuffleMode) {
    playNext();
  } else {
    state.isPlaying = false;
    updatePlayButton();
  }
});

/* =========================================================
   SEEK
   ========================================================= */
let isSeeking = false;

seekTrack.addEventListener('click', (e) => {
  if (!playerAudio.duration) return;
  const rect = seekTrack.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  playerAudio.currentTime = pct * playerAudio.duration;
});

seekTrack.addEventListener('mousedown', () => { isSeeking = true; });
document.addEventListener('mousemove', (e) => {
  if (!isSeeking || !playerAudio.duration) return;
  const rect = seekTrack.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  playerAudio.currentTime = pct * playerAudio.duration;
});
document.addEventListener('mouseup', () => { isSeeking = false; });

/* =========================================================
   CONTROLS
   ========================================================= */
playPauseBtn.addEventListener('click', togglePlay);
nextBtn.addEventListener('click', playNext);
prevBtn.addEventListener('click', playPrev);

// Click player track info to open detail panel
const playerTrackInfo = document.getElementById('playerTrackInfo');
if (playerTrackInfo) {
  playerTrackInfo.addEventListener('dblclick', () => {
    if (state.currentTrack >= 0 && typeof showTrackDetail === 'function') {
      showTrackDetail(state.currentTrack);
    }
  });
}

shuffleBtn.addEventListener('click', () => {
  state.shuffleMode = !state.shuffleMode;
  shuffleBtn.classList.toggle('active', state.shuffleMode);
});

repeatBtn.addEventListener('click', () => {
  const modes = ['none', 'all', 'one'];
  const idx = (modes.indexOf(state.repeatMode) + 1) % 3;
  state.repeatMode = modes[idx];
  repeatBtn.classList.toggle('active', state.repeatMode !== 'none');
  repeatBtn.title = { none: 'Repeat Off', all: 'Repeat All', one: 'Repeat One' }[state.repeatMode];
});

// Volume
volumeSlider.addEventListener('input', (e) => {
  playerAudio.volume = parseFloat(e.target.value);
  state.volume = playerAudio.volume;
  updateVolumeIcon();
});

volumeBtn.addEventListener('click', () => {
  if (playerAudio.volume > 0) {
    volumeBtn.dataset.prevVol = playerAudio.volume;
    playerAudio.volume = 0;
    volumeSlider.value = 0;
  } else {
    playerAudio.volume = parseFloat(volumeBtn.dataset.prevVol || 0.8);
    volumeSlider.value = playerAudio.volume;
  }
  state.volume = playerAudio.volume;
  updateVolumeIcon();
});

function updateVolumeIcon() {
  const volIcon = volumeBtn.querySelector('.icon-vol');
  const muteIcon = volumeBtn.querySelector('.icon-mute');
  volIcon.style.display = playerAudio.volume > 0 ? 'block' : 'none';
  muteIcon.style.display = playerAudio.volume > 0 ? 'none' : 'block';
}

/* =========================================================
   WEB AUDIO API — for visualizer data
   ========================================================= */
function initAudioContext() {
  if (audioContext) return;
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    sourceNode = audioContext.createMediaElementSource(playerAudio);
    sourceNode.connect(analyser);
    analyser.connect(audioContext.destination);
    frequencyData = new Uint8Array(analyser.frequencyBinCount);
  } catch (e) {
    // Web Audio not supported
  }
}

function getFrequencyData() {
  if (analyser && frequencyData) {
    analyser.getByteFrequencyData(frequencyData);
    return frequencyData;
  }
  return null;
}
