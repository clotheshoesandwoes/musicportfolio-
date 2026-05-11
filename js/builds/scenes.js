/* =========================================================
   builds/scenes.js — scenes scene's own build number.
   Read by scenes/play.html (legacy 3D scene app) and
   available to scenes-selector.js if/when it adds a HUD
   build chip. Independent from builds/galaxy.js and
   builds/tracks.js so parallel chats on different scenes
   never race over a shared file.
   Format: s### (incremented per scenes build).
   ========================================================= */
window.BUILD_SCENES = 's15';
