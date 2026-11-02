/* The flight film on the Sentinel case page.
   Without this file the native <video controls> is the whole player: the poster
   overlay and the designed play button are hidden by CSS until the theme
   bootstrap marks the document as scripted. Nothing loads until asked for. */
(function () {
  "use strict";
  var wrap = document.getElementById("sentinel-film");
  if (!wrap) return;
  var video = document.getElementById("sentinel-film-v");
  var play = wrap.querySelector(".play");
  if (!video || !play) return;
  var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");

  play.addEventListener("click", function () {
    wrap.classList.add("playing");
    video.preload = "auto";
    video.focus();
    // Reduced motion: load it and hand over the controls, but do not start it moving.
    if (calm && calm.matches) { video.load(); return; }
    var started = video.play();
    if (started && started.catch) started.catch(function () { /* controls remain */ });
  });
})();
