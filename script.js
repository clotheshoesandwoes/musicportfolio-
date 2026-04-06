/* =========================================================
   TRACK LIST
   =========================================================
   Each track has a display title and filename.
   To REMOVE a track: delete its { title, file } line.
   To ADD a track: add a new { title: "Name", file: "filename.wav" } entry.
   ========================================================= */
const tracks = [
    { title: "The Fall (Shift Perceptions)", file: "2THE FALL shift perceptions.wav" },
    { title: "4-5 Years", file: "4 5 years.wav" },
    { title: "Akira World - I'm Next Up", file: "Akira World Im Next Up.mp3" },
    { title: "Amy Winespliff", file: "AMY WINESPLIFF.wav" },
    { title: "Arkham Villain", file: "arkham villain.wav" },
    { title: "Backyardian", file: "backyardian.wav" },
    { title: "Best Day Ever (Clarity)", file: "best day ever10 clarity.wav" },
    { title: "Chains (Grunge)", file: "CHAINS GRUNGE.wav" },
    { title: "Caught in Thoughts", file: "Caught in Thoughts.wav" },
    { title: "Chicago Seven", file: "chicago seven.wav" },
    { title: "Chilly Nites", file: "chilly nites dannz0.wav" },
    { title: "Clarity", file: "CLARITY bloomberg 5 effects only.wav" },
    { title: "Thymiopolous", file: "cmb thymiopolous.wav" },
    { title: "Coffee (Back in the Day)", file: "Coffee back in the day.wav" },
    { title: "Convinced", file: "convinced.wav" },
    { title: "Wired", file: "dannz0 wired.wav" },
    { title: "Davey", file: "DAVEY.wav" },
    { title: "Down Down Down", file: "down down down.wav" },
    { title: "Dutch", file: "dutch.wav" },
    { title: "Fancy Nour Nour", file: "fancy nour nour.wav" },
    { title: "Fall Away", file: "final but wip fall away.mp3" },
    { title: "First Rap in a While", file: "first rap in a while.wav" },
    { title: "Formidable", file: "Formidable Dannz03.wav" },
    { title: "C'est La Vie", file: "french love song cest la vie.mp3" },
    { title: "Fucking Up His Liver", file: "fucking up his liver and.wav" },
    { title: "Greatest Consequences", file: "greatest consequences.wav" },
    { title: "Gunning", file: "gunning.wav" },
    { title: "Hol' Up Freestyle", file: "HOL UP FREESTYLE4.wav" },
    { title: "Hotel California", file: "HOTEL CALIFORNIA.wav" },
    { title: "If I Had (Universal)", file: "If i had Universal.wav" },
    { title: "Indie Time", file: "indie time2.wav" },
    { title: "It Doesn't Get Better", file: "IT DOESNT GET BETTER prod cmb.wav" },
    { title: "Jolly Mood Turn Sour", file: "jolly mood turn sour prod Abstract.wav" },
    { title: "Kani Demarco's Memoir", file: "KANI DEMARCO's MEMOIR- 2.wav" },
    { title: "Beachouse", file: "kaniburn - beachouse (prod.dannz0) final mix.wav" },
    { title: "Car Mixtape", file: "Kaniburn car mixtape (prod.dannz0).wav" },
    { title: "Lame", file: "lame.wav" },
    { title: "Lemonade", file: "LemonadeGucciKane.wav" },
    { title: "Little Indie Valentine", file: "little indie valentine mf2.wav" },
    { title: "Lotus (Try to Breathe)", file: "LOTUS TRY TO BREATHE2.wav" },
    { title: "Louie 003 (Remix)", file: "LOUIE 003 KANI REMIX.wav" },
    { title: "Mario Island Funky Beat", file: "Mario Island Funky Beat with Hum.wav" },
    { title: "Moods", file: "MOODS ROLO.mp3" },
    { title: "Need New", file: "NEED NEW SEAN X DANNZ0.wav" },
    { title: "Neopolitan Dreams", file: "NEOPOLITAN DREAMS2.wav" },
    { title: "Nice Beat", file: "nice beat.mp3" },
    { title: "Nice Lil Indie Moonlight", file: "nice lil indie moonlight.wav" },
    { title: "Nice", file: "nice.wav" },
    { title: "Nirvana (Alt Lyrics)", file: "nirvana dannz0-differentlyrics.mp3" },
    { title: "Nirvana", file: "nirvana dannz0-original.mp3" },
    { title: "No Service", file: "NO SERVICE.wav" },
    { title: "ODST", file: "odst.wav" },
    { title: "On Tour Soon", file: "ON TOUR soon.mp3" },
    { title: "Passion Pit Remix", file: "passion pit remix.wav" },
    { title: "Follow You", file: "Project 24 follow you.wav" },
    { title: "Ohohohohoho", file: "Project_8 ohohohohoho.wav" },
    { title: "Days Get Longer", file: "Project_9 days get longer.wav" },
    { title: "10 Miles", file: "Project_song__Apr4_10miles.wav" },
    { title: "May Flowers", file: "Project_song_apr12_may flowers.wav" },
    { title: "Wait / Weight", file: "Project_song_apr14_waitweight.wav" },
    { title: "Emo", file: "Project_song_apr16_emo.wav" },
    { title: "Birthday Freestyle", file: "Project_song_birthdayfreestyle.wav" },
    { title: "Bluff Caller", file: "Project_song_emo_bluff_caller.wav" },
    { title: "Emo Rock", file: "Project_song_june14_emorock.wav" },
    { title: "Money Ain't a Thing", file: "Project_song_june16_moneymoneyaintathing.wav" },
    { title: "Final Chapter", file: "Project_song_june19_finalchapter3.wav" },
    { title: "Love Easily", file: "Project_song_june27_loveeasily.wav" },
    { title: "Emo Rock II", file: "Project_song_Mar26_emorock2.wav" },
    { title: "Runaway", file: "Project_song_may10_RUNAWAY.wav" },
    { title: "Peep Demo", file: "Project_song_may22_peepdemo2.wav" },
    { title: "Shroomy", file: "Project_song_may24_shroomy2.wav" },
    { title: "Rock (Full)", file: "Project_song_may5_rock_full.wav" },
    { title: "Capz", file: "quickexportCapz.mp3" },
    { title: "Random Song After David's", file: "random song after davids_2.wav" },
    { title: "Rap About Some Bullshit", file: "rap about some bullshit 3.mp3" },
    { title: "Real Love", file: "real love.wav" },
    { title: "Cute (Rolo)", file: "Really cool idea - Cute Rolo.wav" },
    { title: "Remember", file: "remember yogicbeats.mp3" },
    { title: "Robot Song", file: "robot song c world.wav" },
    { title: "Rolla", file: "rolla.wav" },
    { title: "Rusk", file: "rusk.wav" },
    { title: "Sean USB", file: "sean usb 3.wav" },
    { title: "Sean Vox (Yeat Beat)", file: "sean vox yeat dannz0 beat.wav" },
    { title: "If I Had (Full v2)", file: "sean x dannz0 _if i had_ full song v2.0.wav" },
    { title: "I Will Survive", file: "sean x dannz0 i will survive 1.wav" },
    { title: "See Fair", file: "see fair.wav" },
    { title: "Shoebox", file: "shoebox.wav" },
    { title: "Sickboi", file: "sickboi2.wav" },
    { title: "Silk Pillowcase", file: "silk pillowcase.wav" },
    { title: "Silo Galaxy (Renewed)", file: "Silo Galaxy-renewed.wav" },
    { title: "Silo Galaxy", file: "Silo Galaxy2.wav" },
    { title: "Skeat x Kani", file: "skeatxkanikani.wav" },
    { title: "Two of Us", file: "snip2Awesome Two of Us.wav" },
    { title: "Soul", file: "soul.mp3" },
    { title: "Space Star Galactica", file: "SPACE STAR GALACTICA.wav" },
    { title: "Spotlight", file: "SPOT LIGHT 6.wav" },
    { title: "Stop Light", file: "STOP LIGHT.wav" },
    { title: "Stayin' Alive", file: "stayin alive.wav" },
    { title: "Stop But I Won't", file: "stop but i wont.wav" },
    { title: "Streets", file: "streets.mp3" },
    { title: "Take Me Home", file: "take me home dawg.wav" },
    { title: "Thunderbird", file: "thunderbird.wav" },
    { title: "Times Away", file: "times away.wav" },
    { title: "Told That Girl", file: "told that girl.wav" },
    { title: "Turned Into Taylor Swift", file: "turned into taylor swift.wav" },
    { title: "Uh Huh", file: "uh huh.wav" },
    { title: "Uh, I'm Sick", file: "uh im sick.wav" },
    { title: "Underrated", file: "UNDER RATED.mp3" },
    { title: "Wallet", file: "wallet.wav" },
    { title: "Warzone", file: "warzone.mp3" },
    { title: "What Do U Think of Me", file: "WHAT DO U THINK OF ME.wav" },
    { title: "What Changed With U", file: "what changed w u cworld kazoo.mp3" },
    { title: "What U Expect of Me", file: "what u expect of me - jayzlinkinpark.wav" },
    { title: "Wind Blows", file: "WIND BLOWS_3.wav" },
    { title: "Work Smart", file: "work smart.wav" },
    { title: "Filip", file: "filip+gay+(1).mp3" },
    { title: "Gay K", file: "gay k.mp3" },
];

/* =========================================================
   GRADIENT PALETTE for track thumbnails
   ========================================================= */
const gradients = [
    ["#8b5cf6", "#6d28d9"],
    ["#ec4899", "#be185d"],
    ["#3b82f6", "#1d4ed8"],
    ["#f97316", "#c2410c"],
    ["#10b981", "#047857"],
    ["#06b6d4", "#0e7490"],
    ["#f43f5e", "#9f1239"],
    ["#a855f7", "#7e22ce"],
    ["#eab308", "#a16207"],
    ["#14b8a6", "#0f766e"],
    ["#6366f1", "#4338ca"],
    ["#e879f9", "#a21caf"],
];

function getGradient(index) {
    const g = gradients[index % gradients.length];
    return `linear-gradient(135deg, ${g[0]}, ${g[1]})`;
}

/* =========================================================
   DOM REFERENCES
   ========================================================= */
const $ = (sel) => document.querySelector(sel);
const trackGrid = $("#trackGrid");
const searchInput = $("#searchInput");
const noResults = $("#noResults");
const playerBar = $("#playerBar");
const playerTitle = $("#playerTitle");
const playerThumb = $("#playerThumb");
const playPauseBtn = $("#playPauseBtn");
const prevBtn = $("#prevBtn");
const nextBtn = $("#nextBtn");
const progressBar = $("#progressBar");
const progressFilled = $("#progressFilled");
const timeCurrent = $("#timeCurrent");
const timeTotal = $("#timeTotal");
const shuffleBtn = $("#shuffleBtn");
const repeatBtn = $("#repeatBtn");
const volumeBtn = $("#volumeBtn");
const volumeSlider = $("#volumeSlider");
const shuffleAllBtn = $("#shuffleAllBtn");
const visualizerCanvas = $("#visualizer");
const trackCountEl = $("#trackCount");

/* =========================================================
   STATE
   ========================================================= */
let currentIndex = -1;
let isPlaying = false;
let isShuffle = false;
let repeatMode = 0; // 0=off, 1=all, 2=one
let audio = new Audio();
audio.preload = "none";
audio.volume = 0.8;

let audioContext = null;
let analyser = null;
let sourceNode = null;
let animFrameId = null;

/* =========================================================
   RENDER TRACK GRID
   ========================================================= */
function renderTracks(filter = "") {
    trackGrid.innerHTML = "";
    const q = filter.toLowerCase().trim();
    let visibleCount = 0;

    tracks.forEach((track, i) => {
        if (q && !track.title.toLowerCase().includes(q)) return;
        visibleCount++;

        const card = document.createElement("div");
        card.className = "track-card" + (i === currentIndex ? " active" : "");
        card.dataset.index = i;
        card.style.animationDelay = `${Math.min(visibleCount * 0.02, 0.3)}s`;

        card.innerHTML = `
            <div class="track-card-art" style="background:${getGradient(i)}">
                <div class="track-play-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                        <path d="${i === currentIndex && isPlaying ? 'M6 4h4v16H6zM14 4h4v16h-4z' : 'M8 5v14l11-7z'}"/>
                    </svg>
                </div>
            </div>
            <div class="track-card-info">
                <div class="track-card-title">
                    ${i === currentIndex && isPlaying ? '<span class="eq-bars"><span></span><span></span><span></span><span></span></span>' : ''}
                    ${escapeHtml(track.title)}
                </div>
            </div>
        `;

        card.addEventListener("click", () => {
            if (currentIndex === i && isPlaying) {
                pause();
            } else if (currentIndex === i) {
                play();
            } else {
                loadTrack(i);
                play();
            }
        });

        trackGrid.appendChild(card);
    });

    noResults.classList.toggle("visible", visibleCount === 0);
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

/* =========================================================
   AUDIO CONTROLS
   ========================================================= */
function loadTrack(index) {
    currentIndex = index;
    const track = tracks[index];
    audio.src = "audio/" + encodeURIComponent(track.file);
    playerTitle.textContent = track.title;
    playerThumb.style.background = getGradient(index);
    playerBar.classList.add("visible");
    document.title = track.title + " | B4TTL";
    updateActiveCard();
}

function play() {
    audio.play().then(() => {
        isPlaying = true;
        updatePlayButton();
        updateActiveCard();
        initVisualizer();
    }).catch(() => {});
}

function pause() {
    audio.pause();
    isPlaying = false;
    updatePlayButton();
    updateActiveCard();
}

function togglePlay() {
    if (!audio.src || currentIndex === -1) {
        loadTrack(0);
        play();
        return;
    }
    isPlaying ? pause() : play();
}

function playNext() {
    if (tracks.length === 0) return;
    let next;
    if (isShuffle) {
        next = Math.floor(Math.random() * tracks.length);
    } else {
        next = (currentIndex + 1) % tracks.length;
    }
    loadTrack(next);
    play();
}

function playPrev() {
    if (tracks.length === 0) return;
    if (audio.currentTime > 3) {
        audio.currentTime = 0;
        return;
    }
    let prev;
    if (isShuffle) {
        prev = Math.floor(Math.random() * tracks.length);
    } else {
        prev = (currentIndex - 1 + tracks.length) % tracks.length;
    }
    loadTrack(prev);
    play();
}

function updatePlayButton() {
    const iconPlay = playPauseBtn.querySelector(".icon-play");
    const iconPause = playPauseBtn.querySelector(".icon-pause");
    iconPlay.style.display = isPlaying ? "none" : "block";
    iconPause.style.display = isPlaying ? "block" : "none";
}

function updateActiveCard() {
    document.querySelectorAll(".track-card").forEach((card) => {
        const idx = parseInt(card.dataset.index);
        card.classList.toggle("active", idx === currentIndex);

        const titleEl = card.querySelector(".track-card-title");
        const svgPath = card.querySelector(".track-play-icon svg path");

        // Update play/pause icon on card
        if (idx === currentIndex && isPlaying) {
            svgPath.setAttribute("d", "M6 4h4v16H6zM14 4h4v16h-4z");
            if (!titleEl.querySelector(".eq-bars")) {
                titleEl.innerHTML = '<span class="eq-bars"><span></span><span></span><span></span><span></span></span>' + escapeHtml(tracks[idx].title);
            }
        } else {
            svgPath.setAttribute("d", "M8 5v14l11-7z");
            if (titleEl.querySelector(".eq-bars")) {
                titleEl.innerHTML = escapeHtml(tracks[idx].title);
            }
        }
    });
}

/* =========================================================
   PROGRESS & TIME
   ========================================================= */
function formatTime(sec) {
    if (isNaN(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
}

audio.addEventListener("timeupdate", () => {
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    progressFilled.style.width = pct + "%";
    timeCurrent.textContent = formatTime(audio.currentTime);
    // Mobile progress bar
    playerBar.style.setProperty("--mobile-progress", pct + "%");
});

audio.addEventListener("loadedmetadata", () => {
    timeTotal.textContent = formatTime(audio.duration);
});

audio.addEventListener("ended", () => {
    if (repeatMode === 2) {
        audio.currentTime = 0;
        play();
    } else if (repeatMode === 1 || currentIndex < tracks.length - 1 || isShuffle) {
        playNext();
    } else {
        isPlaying = false;
        updatePlayButton();
        updateActiveCard();
    }
});

// Seek
progressBar.addEventListener("click", (e) => {
    if (!audio.duration) return;
    const rect = progressBar.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * audio.duration;
});

// Drag seek
let isSeeking = false;
progressBar.addEventListener("mousedown", () => { isSeeking = true; });
document.addEventListener("mousemove", (e) => {
    if (!isSeeking || !audio.duration) return;
    const rect = progressBar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * audio.duration;
});
document.addEventListener("mouseup", () => { isSeeking = false; });

/* =========================================================
   CONTROLS
   ========================================================= */
playPauseBtn.addEventListener("click", togglePlay);
nextBtn.addEventListener("click", playNext);
prevBtn.addEventListener("click", playPrev);

shuffleBtn.addEventListener("click", () => {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle("active", isShuffle);
});

repeatBtn.addEventListener("click", () => {
    repeatMode = (repeatMode + 1) % 3;
    repeatBtn.classList.toggle("active", repeatMode > 0);
    repeatBtn.title = ["Repeat Off", "Repeat All", "Repeat One"][repeatMode];
});

// Volume
volumeSlider.addEventListener("input", (e) => {
    audio.volume = parseFloat(e.target.value);
    updateVolumeIcon();
});

volumeBtn.addEventListener("click", () => {
    if (audio.volume > 0) {
        volumeBtn.dataset.prevVol = audio.volume;
        audio.volume = 0;
        volumeSlider.value = 0;
    } else {
        audio.volume = parseFloat(volumeBtn.dataset.prevVol || 0.8);
        volumeSlider.value = audio.volume;
    }
    updateVolumeIcon();
});

function updateVolumeIcon() {
    const volIcon = volumeBtn.querySelector(".icon-vol");
    const muteIcon = volumeBtn.querySelector(".icon-mute");
    volIcon.style.display = audio.volume > 0 ? "block" : "none";
    muteIcon.style.display = audio.volume > 0 ? "none" : "block";
}

// Shuffle all button
shuffleAllBtn.addEventListener("click", () => {
    isShuffle = true;
    shuffleBtn.classList.add("active");
    const randomIdx = Math.floor(Math.random() * tracks.length);
    loadTrack(randomIdx);
    play();
});

/* =========================================================
   KEYBOARD SHORTCUTS
   ========================================================= */
document.addEventListener("keydown", (e) => {
    // Don't capture when typing in search
    if (e.target === searchInput) return;

    switch (e.code) {
        case "Space":
            e.preventDefault();
            togglePlay();
            break;
        case "ArrowRight":
            if (audio.duration) audio.currentTime = Math.min(audio.duration, audio.currentTime + 10);
            break;
        case "ArrowLeft":
            audio.currentTime = Math.max(0, audio.currentTime - 10);
            break;
        case "ArrowUp":
            e.preventDefault();
            audio.volume = Math.min(1, audio.volume + 0.1);
            volumeSlider.value = audio.volume;
            updateVolumeIcon();
            break;
        case "ArrowDown":
            e.preventDefault();
            audio.volume = Math.max(0, audio.volume - 0.1);
            volumeSlider.value = audio.volume;
            updateVolumeIcon();
            break;
        case "KeyN":
            playNext();
            break;
        case "KeyP":
            playPrev();
            break;
    }
});

/* =========================================================
   SEARCH
   ========================================================= */
searchInput.addEventListener("input", (e) => {
    renderTracks(e.target.value);
});

/* =========================================================
   AUDIO VISUALIZER
   ========================================================= */
function initVisualizer() {
    if (audioContext) return;
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        sourceNode = audioContext.createMediaElementSource(audio);
        sourceNode.connect(analyser);
        analyser.connect(audioContext.destination);
        drawVisualizer();
    } catch (e) {
        // Visualizer not supported — no-op
    }
}

function drawVisualizer() {
    if (!analyser) return;
    const ctx = visualizerCanvas.getContext("2d");
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
        animFrameId = requestAnimationFrame(draw);

        const w = visualizerCanvas.width = visualizerCanvas.offsetWidth;
        const h = visualizerCanvas.height = visualizerCanvas.offsetHeight;
        ctx.clearRect(0, 0, w, h);

        if (!isPlaying) return;

        analyser.getByteFrequencyData(dataArray);

        const barCount = 64;
        const barWidth = w / barCount;
        const step = Math.floor(bufferLength / barCount);

        for (let i = 0; i < barCount; i++) {
            const val = dataArray[i * step] / 255;
            const barHeight = val * h;
            const x = i * barWidth;

            const gradient = ctx.createLinearGradient(0, h, 0, h - barHeight);
            gradient.addColorStop(0, "#8b5cf6");
            gradient.addColorStop(1, "#ec4899");
            ctx.fillStyle = gradient;
            ctx.fillRect(x, h - barHeight, barWidth - 1, barHeight);
        }
    }

    draw();
}

/* =========================================================
   SMOOTH SCROLL for CTA
   ========================================================= */
document.querySelector(".hero-cta").addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("tracks").scrollIntoView({ behavior: "smooth" });
});

/* =========================================================
   INIT
   ========================================================= */
trackCountEl.textContent = tracks.length + " tracks";
renderTracks();
