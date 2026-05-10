/* =========================================================
   builds/tracks.js — tracks scene's own build number.
   Read by index.html's bootTracksDaw and displayed in the
   DAW HUD as the build chip. Independent from
   builds/galaxy.js and builds/scenes.js so parallel chats
   on different scenes never race over a shared file.
   Format: t### (incremented per tracks build).
   ========================================================= */
window.BUILD_TRACKS = 't8';
