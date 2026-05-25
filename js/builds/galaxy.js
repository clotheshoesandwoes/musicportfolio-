/* =========================================================
   builds/galaxy.js — galaxy scene's own build number.
   Read by index.html's bootMarathonWorld and displayed in
   the galaxy HUD as the build chip. Independent from
   builds/tracks.js and builds/scenes.js so parallel chats
   on different scenes never race over a shared file.
   Format: g### (incremented per galaxy build).
   ========================================================= */
window.BUILD_GALAXY = 'g15';
