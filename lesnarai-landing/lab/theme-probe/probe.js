/* Theme probe readout: what the page asked for and what the browser reports.
   The auto-dark line uses Chrome's documented detector (developer.chrome.com/blog/
   auto-dark-theme): a 'canvas' background under color-scheme: light computes to
   something other than white when Chrome's Auto Dark Theme is repainting the page.
   Other browsers' forced dark modes may not show up here at all; the screenshots
   are the evidence, this readout is context for them. */
(function () {
  "use strict";
  var info = document.getElementById("probe-info");
  if (!info) { return; }

  function autoDark() {
    var d = document.createElement("div");
    d.style.cssText = "display:none;background-color:canvas;color-scheme:light";
    document.body.appendChild(d);
    var bg = getComputedStyle(d).backgroundColor;
    document.body.removeChild(d);
    return bg === "rgb(255, 255, 255)" ? "not detected" : "DETECTED (" + bg + ")";
  }
  function rows() {
    var stored = null;
    try { stored = localStorage.getItem("lesnarai-theme"); } catch (e) {}
    var meta = document.querySelector('meta[name="color-scheme"]');
    return [
      ["Theme choice", stored || "system"],
      ["data-theme", document.documentElement.getAttribute("data-theme") || "(none)"],
      ["meta color-scheme", meta ? meta.content : "(missing)"],
      ["prefers-color-scheme", matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"],
      ["Chrome auto-dark", autoDark()],
      ["Viewport", innerWidth + " x " + innerHeight + " CSS px, DPR " + devicePixelRatio],
      ["Browser", navigator.userAgent]
    ];
  }
  function render() {
    while (info.firstChild) { info.removeChild(info.firstChild); }
    rows().forEach(function (r) {
      var dt = document.createElement("dt"); dt.textContent = r[0];
      var dd = document.createElement("dd"); dd.textContent = r[1];
      info.appendChild(dt); info.appendChild(dd);
    });
  }
  render();
  /* theme.js changes data-theme on click; keep the readout in step */
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);
}());
