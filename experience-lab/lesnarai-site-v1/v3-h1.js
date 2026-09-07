/* THE HEADLINE SETS ITSELF, WITHOUT MOVING THE PAGE ───────────────────────
   The hero headline opens from wdth 71 to 104 over 1150ms. That is the site's
   signature moment and it is worth keeping. What it also did was re-wrap the
   line: 33 units of glyph width is enough to move words between lines, so the
   line boxes jumped and Chromium scored it. Measured 0.107 CLS, essentially
   all of the page's total.

   The fix is not to freeze the axis. It is to fix WHERE THE LINES BREAK before
   the axis opens: measure the wrap at the settled width, then commit each line
   to its own block. After that the axis changes how wide each line is, never
   which words are on it, so nothing below moves. */
(function () {
  "use strict";
  var h1 = document.querySelector(".hero h1[data-set]");
  if (!h1 || h1.dataset.lines) return;

  var SETTLED = "104";

  function lines() {
    /* measure at the width the headline finishes on */
    var prev = h1.style.getPropertyValue("--wd");
    h1.style.setProperty("--wd", SETTLED);

    var walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT), out = [], node;
    var range = document.createRange(), rows = [];
    while ((node = walker.nextNode())) {
      var text = node.textContent;
      for (var i = 0; i < text.length; i++) {
        range.setStart(node, i); range.setEnd(node, i + 1);
        var r = range.getBoundingClientRect();
        if (!r.height) continue;
        var top = Math.round(r.top);
        var row = rows[rows.length - 1];
        if (!row || Math.abs(row.top - top) > 4) rows.push({ top: top, parts: [{ node: node, s: i, e: i + 1 }] });
        else {
          var last = row.parts[row.parts.length - 1];
          if (last.node === node && last.e === i) last.e = i + 1;
          else row.parts.push({ node: node, s: i, e: i + 1 });
        }
      }
    }
    if (prev) h1.style.setProperty("--wd", prev); else h1.style.removeProperty("--wd");
    return rows;
  }

  function commit() {
    var rows = lines();
    if (rows.length < 2) return;               /* single line cannot re-wrap */

    /* rebuild as one block per measured line, preserving the <em> that carries
       the emphasis in the middle of the sentence */
    var frag = document.createDocumentFragment();
    rows.forEach(function (row) {
      var span = document.createElement("span");
      span.className = "h1-line";
      row.parts.forEach(function (p) {
        var txt = p.node.textContent.slice(p.s, p.e);
        var em = p.node.parentElement && p.node.parentElement.tagName === "EM";
        if (em) { var e = document.createElement("em"); e.textContent = txt; span.appendChild(e); }
        else span.appendChild(document.createTextNode(txt));
      });
      frag.appendChild(span);
    });
    /* Emptying the element first collapsed the headline to zero height for one
       frame, which scored a shift larger than the animation it was meant to
       fix. Pin the measured height, swap in one atomic operation, release. */
    var box = Math.ceil(h1.getBoundingClientRect().height);
    h1.style.minHeight = box + "px";
    if (h1.replaceChildren) h1.replaceChildren(frag);
    else { h1.textContent = ""; h1.appendChild(frag); }
    h1.dataset.lines = rows.length;
  }

  /* fonts must be resolved first, or we would pin the fallback's wrap */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(commit);
  else commit();

  var t;
  addEventListener("resize", function () {
    clearTimeout(t);
    t = setTimeout(function () {
      /* re-wrap for the new width: restore a flat sentence, measure again */
      if (!h1.dataset.lines) return;
      var text = [].map.call(h1.childNodes, function (n) {
        return n.nodeType === 1 && n.querySelector("em") ? n.textContent : n.textContent;
      }).join(" ");
      h1.textContent = text.replace(/\s+/g, " ").trim();
      delete h1.dataset.lines;
      commit();
    }, 200);
  }, { passive: true });
})();
