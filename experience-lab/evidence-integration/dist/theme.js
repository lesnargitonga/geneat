/* Theme control. Three states, nothing more: SYSTEM, LIGHT, DARK.
   The choice persists locally and survives navigation and reload.
   Created by script, because without script it could not function. */
(function () {
  "use strict";
  var KEY = "lesnarai-theme";
  var root = document.documentElement;

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function apply(v) {
    if (v === "light" || v === "dark") { root.setAttribute("data-theme", v); }
    else { root.removeAttribute("data-theme"); }
  }
  function save(v) {
    try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch (e) {}
  }

  function build(host) {
    var label = document.createElement("span");
    label.className = "theme__l";
    label.textContent = "Theme";
    var grp = document.createElement("div");
    grp.className = "theme";
    grp.setAttribute("role", "group");
    grp.setAttribute("aria-label", "Colour theme");

    var current = stored();
    [["system", "System", "Follow the device setting"],
     ["light", "Light", "Always use the light theme"],
     ["dark", "Dark", "Always use the dark theme"]].forEach(function (o) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = o[1];
      b.setAttribute("aria-label", o[2]);
      b.setAttribute("aria-pressed", String((current || "system") === o[0]));
      b.addEventListener("click", function () {
        var v = o[0] === "system" ? null : o[0];
        apply(v); save(v);
        [].forEach.call(document.querySelectorAll(".theme button"), function (x) {
          x.setAttribute("aria-pressed", String(x.textContent === o[1]));
        });
      });
      grp.appendChild(b);
    });
    host.appendChild(label);
    host.appendChild(grp);
  }

  apply(stored());
  var head = document.querySelector(".site-nav");
  var panel = document.querySelector("#menu-panel .w");
  if (head) build(head);
  if (panel) build(panel);
}());
