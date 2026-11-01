/* Theme control. Three states, nothing more: SYSTEM, LIGHT, DARK.
   The choice persists locally and survives navigation and reload.
   Created by script, because without script it could not function. */
(function () {
  "use strict";
  var KEY = "lesnarai-theme";
  var root = document.documentElement;

  function stored() {
    var v = null;
    try { v = localStorage.getItem(KEY); } catch (e) {}
    return v === "light" || v === "dark" ? v : null;
  }
  /* An explicit choice is declared three ways, because browsers that darken pages
     on their own read different signals: the data-theme attribute (our CSS), the
     color-scheme meta tag ("only light" / "only dark" forbids a browser override),
     and theme-color for the browser chrome. SYSTEM restores "light dark". */
  function apply(v) {
    if (v === "light" || v === "dark") { root.setAttribute("data-theme", v); }
    else { root.removeAttribute("data-theme"); }
    var scheme = document.querySelector('meta[name="color-scheme"]');
    if (scheme) { scheme.content = v ? "only " + v : "light dark"; }
    [].forEach.call(document.querySelectorAll('meta[name="theme-color"]'), function (m) {
      var dark = v ? v === "dark" : /dark/.test(m.media);
      m.content = dark ? "#000000" : "#FFFFFF";
    });
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
