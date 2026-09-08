/* TEXT COLLISION GATE ────────────────────────────────────────────────────────
   Finds rendered text drawn on top of other rendered text.

   Two things this gate does that an element-level scan does not, both learned
   from missing a real defect on a deployed preview:

   1. It compares RENDERED LINE BOXES, via Range.getClientRects over text
      nodes - not elements. A paragraph containing a <b> is not a leaf, so an
      element-level scan skips it entirely. That is exactly how the hero's
      reachability label was found sitting on top of the place note only after
      it had shipped.

   2. It answers /api/status with a resolved payload. The static local server
      404s that route, so the label stays hidden and the collision cannot
      occur locally. The overlap only existed once the status came back - a
      state that, untested, only ever appeared in production.

   Usage
     node tools/collide.mjs                     all pages, mobile + desktop
     node tools/collide.mjs --pages /           narrow the sweep
     node tools/collide.mjs --viewports 390x844

   Exits non-zero if any two text lines overlap by more than THRESHOLD px. */
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(HERE, "..");
const PW = [process.env.PLAYWRIGHT_PATH,
            join(ROOT, "node_modules/playwright/index.mjs"),
            join(ROOT, "../study-a-dom-svg/node_modules/playwright/index.mjs")].filter(Boolean);

let chromium = null;
for (const p of PW) { try { ({ chromium } = await import(p)); break; } catch {} }
if (!chromium) { console.error("playwright not found"); process.exit(2); }

const BASE = process.env.CLS_BASE || "http://127.0.0.1:4210";
/* Horizontal overlap is only interesting if the lines actually share space;
   vertical overlap needs a real threshold, because adjacent blocks routinely
   share 2-3px of box between a descender and the next ascender without a
   glyph ever touching. The defect this gate was built for measured 11-12px. */
const OX_MIN = 3, OY_MIN = 6;

/* What a healthy deployment returns, so the resolved state is exercised. */
const STATUS = {
  checked: new Date().toISOString(), ttl: 60,
  note: "Reachability at the moment shown. Not an uptime record.",
  systems: [
    { id: "bizmtaani", host: "bizmtaani.com", ok: true, ms: 1852 },
    { id: "hazina", host: "hazina.lesnarai.co.ke", ok: true, ms: 420 },
    { id: "carepro", host: "carepro.co.ke", ok: true, ms: 512 },
    { id: "geneat", host: "geneat.lesnarai.co.ke", ok: true, ms: 389 },
    { id: "jamii", host: "jamii.lesnarai.co.ke", ok: true, ms: 601 }
  ]
};

function discover(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (["\.git", "node_modules", "tools", "media", "fonts"].includes(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) discover(full, out);
    else if (name.endsWith(".html"))
      out.push("/" + relative(ROOT, full).replace(/\\/g, "/").replace(/index\.html$/, ""));
  }
  return out;
}

function scan([oxMin, oyMin]) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const lines = []; let n, nodeId = 0;
  while ((n = walker.nextNode())) {
    nodeId++;
    const t = n.textContent;
    if (!/\S/.test(t)) continue;
    const pe = n.parentElement;
    if (!pe || pe.offsetParent === null) continue;
    const cs = getComputedStyle(pe);
    if (cs.visibility === "hidden" || cs.display === "none" ||
        parseFloat(cs.opacity) < 0.08) continue;
    /* Screen-reader-only text. The .vh pattern is a 1px box with
       overflow:hidden and clip:rect(0 0 0 0): the element is invisible, but
       the text inside it still reports full-size client rects, so without
       this every "(opens in a new tab)" reads as a collision. */
    let hidden = false, an = pe;
    while (an && an !== document.body) {
      const acs = getComputedStyle(an), ab = an.getBoundingClientRect();
      if ((ab.width <= 2 || ab.height <= 2) && acs.overflow === "hidden") { hidden = true; break; }
      if (acs.clip && acs.clip !== "auto" && /rect\(\s*0/.test(acs.clip)) { hidden = true; break; }
      if (acs.clipPath && acs.clipPath.indexOf("inset(50%") !== -1) { hidden = true; break; }
      an = an.parentElement;
    }
    if (hidden) continue;
    const r = document.createRange(); r.selectNodeContents(n);
    for (const q of r.getClientRects()) {
      if (q.width < 3 || q.height < 3) continue;
      lines.push({ nodeId, x: q.left, y: q.top, r: q.right, b: q.bottom, el: pe,
                   t: t.trim().slice(0, 30), tag: pe.tagName,
                   cls: (pe.className || pe.tagName).toString().slice(0, 24) });
    }
  }
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const a = lines[i], c = lines[j];
      const ox = Math.min(a.r, c.r) - Math.max(a.x, c.x);
      const oy = Math.min(a.b, c.b) - Math.max(a.y, c.y);
      if (ox <= oxMin || oy <= oyMin) continue;
      /* One text node can report several rects - a clipped run with
         text-overflow:ellipsis returns both the visible and the overflowing
         box. A node cannot collide with itself. */
      if (a.nodeId === c.nodeId) continue;
      /* Two lines of one heading or paragraph are that block's own leading,
         however tight - the site sets headlines at line-height .94 and the
         boxes legitimately overlap while the glyphs do not. Only text from
         two different flows landing on each other is a collision. */
      let anc = a.el;
      while (anc && !anc.contains(c.el)) anc = anc.parentElement;
      if (anc && /^(H[1-6]|P|LI|FIGCAPTION|BLOCKQUOTE)$/.test(anc.tagName)) continue;
      hits.push({ ox: Math.round(ox), oy: Math.round(oy),
                  a: `${a.cls}:"${a.t}"`, b: `${c.cls}:"${c.t}"` });
    }
  }
  return hits;
}

const argv = process.argv.slice(2);
const arg = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const PAGES = arg("--pages", "") ? arg("--pages", "").split(",") : discover().sort();
const VIEWS = arg("--viewports", "")
  ? arg("--viewports", "").split(",").map(v => v.split("x").map(Number))
  : [[1440, 900], [1024, 768], [768, 1024], [430, 932], [390, 844], [360, 800]];

const browser = await chromium.launch();
let total = 0, checked = 0;
for (const path of PAGES) {
  for (const [w, h] of VIEWS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.route("**/api/status*", r => r.fulfill({
      status: 200, contentType: "application/json", body: JSON.stringify(STATUS) }));
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(2200);
    const hits = await page.evaluate(scan, [OX_MIN, OY_MIN]);
    checked++;
    if (hits.length) {
      total += hits.length;
      console.log(`OVERLAP  ${path}  ${w}x${h}`);
      for (const x of hits.slice(0, 4))
        console.log(`   ${x.ox}x${x.oy}px  [${x.a}]  vs  [${x.b}]`);
    }
    await ctx.close();
  }
}
await browser.close();
console.log(`\n${checked} page/viewport combinations, ${total} text overlap(s)`);
process.exit(total ? 1 : 0);
