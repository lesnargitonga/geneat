/* BOOKING REQUEST ─────────────────────────────────────────────────────────
   There is no scheduling backend, so this never books anything. It validates,
   composes a structured message and hands it to the mail client - and says so
   plainly rather than showing a success state that did not happen.

   When BOOK_ENDPOINT is set it POSTs instead and reports what the server
   actually returned. Nothing else on the page changes. */
(function () {
  "use strict";
  var BOOK_ENDPOINT = "";
  var ADDRESS = "hello@lesnarai.co.ke";

  var f = document.getElementById("bkform");
  if (!f) return;
  var status = document.getElementById("b-status");
  var touched = {};

  var FIELDS = [
    ["b-name", "name", function (v) { return v.trim().length > 1; }, "Tell us who you are."],
    ["b-mail", "email", function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); },
     "We need a working address to reply to."],
    ["b-msg", "message", function (v) { return v.trim().length > 9; },
     "A sentence or two about what you are trying to build."]
  ];

  function err(id, msg) {
    var el = document.getElementById(id);
    var box = el.closest("div");
    var old = box.querySelector(".bk-err");
    if (old) old.remove();
    if (msg) {
      el.setAttribute("aria-invalid", "true");
      var p = document.createElement("p");
      p.className = "bk-hint bk-err";
      p.style.color = "var(--accent)";
      p.id = id + "-err";
      p.textContent = msg;
      box.appendChild(p);
      el.setAttribute("aria-describedby", p.id);
    } else {
      el.removeAttribute("aria-invalid");
      el.removeAttribute("aria-describedby");
    }
  }

  function validate(only) {
    var bad = null;
    FIELDS.forEach(function (F) {
      var el = document.getElementById(F[0]);
      if (only && only !== F[0]) return;
      var ok = F[2](el.value);
      if (!ok && (touched[F[0]] || !only)) { err(F[0], F[3]); if (!bad) bad = el; }
      else if (ok) err(F[0], null);
    });
    return bad;
  }

  FIELDS.forEach(function (F) {
    var el = document.getElementById(F[0]);
    el.addEventListener("blur", function () { touched[F[0]] = true; validate(F[0]); });
    el.addEventListener("input", function () { if (touched[F[0]]) validate(F[0]); });
  });

  f.addEventListener("submit", function (e) {
    e.preventDefault();
    if (document.getElementById("b-co").value) return;   /* honeypot */
    FIELDS.forEach(function (F) { touched[F[0]] = true; });
    var bad = validate();
    if (bad) {
      status.dataset.state = "err";
      status.textContent = "Three fields still need something before this can be sent.";
      bad.focus();
      return;
    }

    var topic = (f.querySelector('input[name="topic"]:checked') || {}).value || "unsure";
    var label = (f.querySelector('input[name="topic"]:checked + span') || {}).textContent || "";
    var d = {
      topic: label.trim() || topic,
      name: document.getElementById("b-name").value.trim(),
      email: document.getElementById("b-mail").value.trim(),
      org: document.getElementById("b-org").value.trim(),
      when: document.getElementById("b-when").value.trim(),
      how: document.getElementById("b-how").value,
      message: document.getElementById("b-msg").value.trim()
    };

    var body = [
      "About: " + d.topic, "",
      "Name: " + d.name,
      "Email: " + d.email,
      d.org ? "Company: " + d.org : null,
      d.when ? "Preferred time: " + d.when : null,
      "Preferred format: " + d.how, "",
      d.message
    ].filter(Boolean).join("\n");

    if (!BOOK_ENDPOINT) {
      status.dataset.state = "";
      status.textContent = "Opening your mail app with this filled in. Nothing is sent, and no time " +
        "is held, until you send it from there.";
      window.location.href = "mailto:" + ADDRESS +
        "?subject=" + encodeURIComponent("Conversation request - " + d.topic) +
        "&body=" + encodeURIComponent(body);
      return;
    }

    status.dataset.state = "";
    status.textContent = "Sending…";
    fetch(BOOK_ENDPOINT, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d)
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      status.textContent = "Request received. We will reply with a time - nothing is scheduled yet.";
      f.reset();
    }).catch(function (e) {
      status.dataset.state = "err";
      status.textContent = "That did not send (" + e.message + "). Write to " + ADDRESS + " instead.";
    });
  });
})();
