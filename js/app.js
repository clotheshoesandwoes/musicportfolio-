/* =========================================================
   APP.JS — Shared state, track data, view router
   ========================================================= */

const tracks = [
  { title: "The Fall (Shift Perceptions)", file: "2THE FALL shift perceptions.mp3" },
  { title: "4-5 Years", file: "4 5 years.mp3" },
  { title: "Akira World - I'm Next Up", file: "Akira World Im Next Up.mp3" },
  { title: "Amy Winespliff", file: "AMY WINESPLIFF.mp3" },
  { title: "Arkham Villain", file: "arkham villain.mp3" },
  { title: "Backyardian", file: "backyardian.mp3" },
  { title: "Best Day Ever (Clarity)", file: "best day ever10 clarity.mp3" },
  { title: "Chains (Grunge)", file: "CHAINS GRUNGE.mp3" },
  { title: "Caught in Thoughts", file: "Caught in Thoughts.mp3" },
  { title: "Chicago Seven", file: "chicago seven.mp3" },
  { title: "Chilly Nites", file: "chilly nites dannz0.mp3" },
  { title: "Clarity", file: "CLARITY bloomberg 5 effects only.mp3" },
  { title: "Thymiopolous", file: "cmb thymiopolous.mp3" },
  { title: "Coffee (Back in the Day)", file: "Coffee back in the day.mp3" },
  { title: "Convinced", file: "convinced.mp3" },
  { title: "Wired", file: "dannz0 wired.mp3" },
  { title: "Davey", file: "DAVEY.mp3" },
  { title: "Down Down Down", file: "down down down.mp3" },
  { title: "Dutch", file: "dutch.mp3" },
  { title: "Fancy Nour Nour", file: "fancy nour nour.mp3" },
  { title: "Fall Away", file: "final but wip fall away.mp3" },
  { title: "First Rap in a While", file: "first rap in a while.mp3" },
  { title: "Formidable", file: "Formidable Dannz03.mp3" },
  { title: "C'est La Vie", file: "french love song cest la vie.mp3" },
  { title: "Fucking Up His Liver", file: "fucking up his liver and.mp3" },
  { title: "Greatest Consequences", file: "greatest consequences.mp3" },
  { title: "Gunning", file: "gunning.mp3" },
  { title: "Hol' Up Freestyle", file: "HOL UP FREESTYLE4.mp3" },
  { title: "Hotel California", file: "HOTEL CALIFORNIA.mp3" },
  { title: "If I Had (Universal)", file: "If i had Universal.mp3" },
  { title: "Indie Time", file: "indie time2.mp3" },
  { title: "It Doesn't Get Better", file: "IT DOESNT GET BETTER prod cmb.mp3" },
  { title: "Jolly Mood Turn Sour", file: "jolly mood turn sour prod Abstract.mp3" },
  { title: "Kani Demarco's Memoir", file: "KANI DEMARCO's MEMOIR- 2.mp3" },
  { title: "Beachouse", file: "kaniburn - beachouse (prod.dannz0) final mix.mp3" },
  { title: "Car Mixtape", file: "Kaniburn car mixtape (prod.dannz0).mp3" },
  { title: "Lame", file: "lame.mp3" },
  { title: "Lemonade", file: "LemonadeGucciKane.mp3" },
  { title: "Little Indie Valentine", file: "little indie valentine mf2.mp3" },
  { title: "Lotus (Try to Breathe)", file: "LOTUS TRY TO BREATHE2.mp3" },
  { title: "Louie 003 (Remix)", file: "LOUIE 003 KANI REMIX.mp3" },
  { title: "Mario Island Funky Beat", file: "Mario Island Funky Beat with Hum.mp3" },
  { title: "Moods", file: "MOODS ROLO.mp3" },
  { title: "Need New", file: "NEED NEW SEAN X DANNZ0.mp3" },
  { title: "Neopolitan Dreams", file: "NEOPOLITAN DREAMS2.mp3" },
  { title: "Nice Beat", file: "nice beat.mp3" },
  { title: "Nice Lil Indie Moonlight", file: "nice lil indie moonlight.mp3" },
  { title: "Nice", file: "nice.mp3" },
  { title: "Nirvana (Alt Lyrics)", file: "nirvana dannz0-differentlyrics.mp3" },
  { title: "Nirvana", file: "nirvana dannz0-original.mp3" },
  { title: "No Service", file: "NO SERVICE.mp3" },
  { title: "ODST", file: "odst.mp3" },
  { title: "On Tour Soon", file: "ON TOUR soon.mp3" },
  { title: "Passion Pit Remix", file: "passion pit remix.mp3" },
  { title: "Follow You", file: "Project 24 follow you.mp3" },
  { title: "Ohohohohoho", file: "Project_8 ohohohohoho.mp3" },
  { title: "Days Get Longer", file: "Project_9 days get longer.mp3" },
  { title: "10 Miles", file: "Project_song__Apr4_10miles.mp3" },
  { title: "May Flowers", file: "Project_song_apr12_may flowers.mp3" },
  { title: "Wait / Weight", file: "Project_song_apr14_waitweight.mp3" },
  { title: "Emo", file: "Project_song_apr16_emo.mp3" },
  { title: "Birthday Freestyle", file: "Project_song_birthdayfreestyle.mp3" },
  { title: "Bluff Caller", file: "Project_song_emo_bluff_caller.mp3" },
  { title: "Emo Rock", file: "Project_song_june14_emorock.mp3" },
  { title: "Money Ain't a Thing", file: "Project_song_june16_moneymoneyaintathing.mp3" },
  { title: "Final Chapter", file: "Project_song_june19_finalchapter3.mp3" },
  { title: "Love Easily", file: "Project_song_june27_loveeasily.mp3" },
  { title: "Emo Rock II", file: "Project_song_Mar26_emorock2.mp3" },
  { title: "Runaway", file: "Project_song_may10_RUNAWAY.mp3" },
  { title: "Peep Demo", file: "Project_song_may22_peepdemo2.mp3" },
  { title: "Shroomy", file: "Project_song_may24_shroomy2.mp3" },
  { title: "Rock (Full)", file: "Project_song_may5_rock_full.mp3" },
  { title: "Capz", file: "quickexportCapz.mp3" },
  { title: "Random Song After David's", file: "random song after davids_2.mp3" },
  { title: "Rap About Some Bullshit", file: "rap about some bullshit 3.mp3" },
  { title: "Real Love", file: "real love.mp3" },
  { title: "Cute (Rolo)", file: "Really cool idea - Cute Rolo.mp3" },
  { title: "Remember", file: "remember yogicbeats.mp3" },
  { title: "Robot Song", file: "robot song c world.mp3" },
  { title: "Rolla", file: "rolla.mp3" },
  { title: "Rusk", file: "rusk.mp3" },
  { title: "Sean USB", file: "sean usb 3.mp3" },
  { title: "Sean Vox (Yeat Beat)", file: "sean vox yeat dannz0 beat.mp3" },
  { title: "If I Had (Full v2)", file: "sean x dannz0 _if i had_ full song v2.0.mp3" },
  { title: "I Will Survive", file: "sean x dannz0 i will survive 1.mp3" },
  { title: "See Fair", file: "see fair.mp3" },
  { title: "Shoebox", file: "shoebox.mp3" },
  { title: "Sickboi", file: "sickboi2.mp3" },
  { title: "Silk Pillowcase", file: "silk pillowcase.mp3" },
  { title: "Silo Galaxy (Renewed)", file: "Silo Galaxy-renewed.mp3" },
  { title: "Silo Galaxy", file: "Silo Galaxy2.mp3" },
  { title: "Skeat x Kani", file: "skeatxkanikani.mp3" },
  { title: "Two of Us", file: "snip2Awesome Two of Us.mp3" },
  { title: "Soul", file: "soul.mp3" },
  { title: "Space Star Galactica", file: "SPACE STAR GALACTICA.mp3" },
  { title: "Spotlight", file: "SPOT LIGHT 6.mp3" },
  { title: "Stop Light", file: "STOP LIGHT.mp3" },
  { title: "Stayin' Alive", file: "stayin alive.mp3" },
  { title: "Stop But I Won't", file: "stop but i wont.mp3" },
  { title: "Streets", file: "streets.mp3" },
  { title: "Take Me Home", file: "take me home dawg.mp3" },
  { title: "Thunderbird", file: "thunderbird.mp3" },
  { title: "Times Away", file: "times away.mp3" },
  { title: "Told That Girl", file: "told that girl.mp3" },
  { title: "Turned Into Taylor Swift", file: "turned into taylor swift.mp3" },
  { title: "Uh Huh", file: "uh huh.mp3" },
  { title: "Uh, I'm Sick", file: "uh im sick.mp3" },
  { title: "Underrated", file: "UNDER RATED.mp3" },
  { title: "Wallet", file: "wallet.mp3" },
  { title: "Warzone", file: "warzone.mp3" },
  { title: "What Do U Think of Me", file: "WHAT DO U THINK OF ME.mp3" },
  { title: "What Changed With U", file: "what changed w u cworld kazoo.mp3" },
  { title: "What U Expect of Me", file: "what u expect of me - jayzlinkinpark.mp3" },
  { title: "Wind Blows", file: "WIND BLOWS_3.mp3" },
  { title: "Work Smart", file: "work smart.mp3" },
  { title: "Filip", file: "filip+gay+(1).mp3" },
  { title: "Gay K", file: "gay k.mp3" },
];

/* =========================================================
   SHARED STATE
   ========================================================= */
const state = {
  currentTrack: -1,
  isPlaying: false,
  shuffleMode: false,
  repeatMode: 'none', // 'none' | 'all' | 'one'
  currentView: 'terrain',
  searchQuery: '',
  volume: 0.8,
};

/* =========================================================
   GRADIENT PALETTE — for track art thumbnails
   ========================================================= */
const gradients = [
  ['#8b5cf6','#6d28d9'], ['#ec4899','#be185d'], ['#3b82f6','#1d4ed8'],
  ['#f97316','#c2410c'], ['#10b981','#047857'], ['#06b6d4','#0e7490'],
  ['#f43f5e','#9f1239'], ['#a855f7','#7e22ce'], ['#eab308','#a16207'],
  ['#14b8a6','#0f766e'], ['#6366f1','#4338ca'], ['#e879f9','#a21caf'],
];

function getGradient(i) {
  const g = gradients[i % gradients.length];
  return `linear-gradient(135deg, ${g[0]}, ${g[1]})`;
}

function getGradientColors(i) {
  return gradients[i % gradients.length];
}

/* =========================================================
   VIEW ROUTER
   ========================================================= */
const views = {};
let activeView = null;

function registerView(name, viewObj) {
  views[name] = viewObj;
}

function switchView(name) {
  if (activeView && views[activeView] && views[activeView].destroy) {
    views[activeView].destroy();
  }
  const container = document.getElementById('viewContainer');
  container.innerHTML = '';
  state.currentView = name;
  activeView = name;

  if (views[name] && views[name].init) {
    views[name].init(container);
  }

  // Update subtitle
  const subs = {
    terrain: `Sound terrain / ${tracks.length} tracks`,
    deepsea: `Deep dive / ${tracks.length} tracks`,
    neural: `Neural map / ${tracks.length} tracks`,
  };
  document.getElementById('brandSub').textContent = subs[name] || '';

  // Update tab active states
  document.querySelectorAll('.view-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === name);
  });
}

/* =========================================================
   SEARCH
   ========================================================= */
function getFilteredTracks() {
  const q = state.searchQuery.toLowerCase().trim();
  if (!q) return tracks.map((t, i) => ({ ...t, originalIndex: i }));
  return tracks
    .map((t, i) => ({ ...t, originalIndex: i }))
    .filter(t => t.title.toLowerCase().includes(q));
}

/* =========================================================
   INIT
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  // Track count
  document.getElementById('trackCount').textContent = tracks.length;

  // View tab clicks (both desktop and mobile)
  document.querySelectorAll('.view-tab').forEach(tab => {
    tab.addEventListener('click', () => switchView(tab.dataset.view));
  });

  // Search
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      // Notify active view of search change
      if (views[activeView] && views[activeView].onSearch) {
        views[activeView].onSearch(state.searchQuery);
      }
    });
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        if (typeof togglePlay === 'function') togglePlay();
        break;
      case 'ArrowRight':
        if (typeof playerAudio !== 'undefined' && playerAudio.duration)
          playerAudio.currentTime = Math.min(playerAudio.duration, playerAudio.currentTime + 5);
        break;
      case 'ArrowLeft':
        if (typeof playerAudio !== 'undefined')
          playerAudio.currentTime = Math.max(0, playerAudio.currentTime - 5);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (typeof playerAudio !== 'undefined') {
          playerAudio.volume = Math.min(1, playerAudio.volume + 0.1);
          document.getElementById('volumeSlider').value = playerAudio.volume;
          state.volume = playerAudio.volume;
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (typeof playerAudio !== 'undefined') {
          playerAudio.volume = Math.max(0, playerAudio.volume - 0.1);
          document.getElementById('volumeSlider').value = playerAudio.volume;
          state.volume = playerAudio.volume;
        }
        break;
      case 'KeyN':
        if (typeof playNext === 'function') playNext();
        break;
      case 'KeyP':
        if (typeof playPrev === 'function') playPrev();
        break;
      case 'Digit1': switchView('terrain'); break;
      case 'Digit2': switchView('deepsea'); break;
      case 'Digit3': switchView('neural'); break;
    }
  });
});

// Boot default view after all scripts load
window.addEventListener('load', () => {
  switchView('terrain');
});
