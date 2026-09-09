/* HUMAN USABILITY GATE ───────────────────────────────────────────────────────
   The engineering gates all passed while the site had no navigation past the
   first screen. They measure the page; they do not use it. This one asks the
   questions a person asks.

     A  header reachability      is the header still there further down?
     B  action reachability      from the middle of the page, is there a way on?
     C  visible completion       does a scene finish while you can still see it?
     D  landscape clipping       does pinned content fit the space it is pinned in?
     E  touch targets            are the primary controls comfortable to hit?
     F  invisible real content   is meaningful text sitting at near-zero opacity?
     G  reverse scroll           down 0->1, up 1->0, same position same state

   It does not replace looking at the thing. It exists so that an obvious
   usability regression cannot pass silently again.

   Usage
     node tools/usability.mjs
     node tools/usability.mjs --pages /,/work/
     node tools/usability.mjs --url http://127.0.0.1:4211 --verbose */
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(HERE, "..");
const PW = [process.env.PLAYWRIGHT_PATH,
            join(ROOT, "node_modules/playwright/index.mjs"),
            join(ROOT, "../study-a-dom-svg/node_modules/playwright/index.mjs")].filter(Boolean);
let chromium = null;
for (const c of PW) { try { ({ chromium } = await import(c)); break; } catch { /* next */ } }
if (!chromium) { console.error("playwright not found; set PLAYWRIGHT_PATH"); process.exit(2); }

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf("--" + n); return i === -1 ? d : argv[i + 1]; };
const VERBOSE = argv.includes("--verbose");
const BASE = opt("url", "http://127.0.0.1:4211");

function discover() {
  const out = [];
  (function walk(dir) {
    for (const e of readdirSync(dir)) {
      if (["node_modules", ".git", ".vercel", "tools", "media", "fonts", "review", "api"].includes(e)) continue;
      const f = join(dir, e);
      if (statSync(f).isDirectory()) walk(f);
      else if (e === "index.html") {
        const r = relative(ROOT, f).replace(/index\.html$/, "");
        out.push("/" + (r === "" ? "" : r));
      }
    }
  })(ROOT);
  return out.sort();
}
const PAGES = (opt("pages", "") ? opt("pages", "").split(",") : discover());

/* the thresholds, in one place */
const TAP = 44;            /* px, the comfortable floor for a primary control */
const GHOST = 0.25;        /* opacity below which text reads as absent, not dim */
const SEE = 0.25;          /* a scene must still show this much of itself when it completes */
const EPS = 0.0025;

const fails = [];
const notes = [];
function check(ok, label, detail) {
  if (ok) { if (VERBOSE) console.log("    ok    " + label); return true; }
  fails.push(label + (detail ? " — " + detail : ""));
  console.log("    FAIL  " + label + (detail ? "\n            " + detail : ""));
  return false;
}
function note(t) { notes.push(t); console.log("    note  " + t); }

const browser = await chromium.launch();

/* ── A + B · can you still get anywhere from down here? ─────────────────── */
console.log("\n══ A/B · NAVIGATION AND ACTION REACHABILITY ══════════════════");
for (const path of PAGES) {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(1600);
    const docH = await page.evaluate(() => document.documentElement.scrollHeight);
    const bad = [];
    for (const frac of [0, 0.25, 0.5, 0.75, 0.95]) {
      await page.evaluate(v => scrollTo(0, v), Math.round((docH - h) * frac));
      await page.waitForTimeout(160);
      const r = await page.evaluate(() => {
        const on = e => { const b = e.getBoundingClientRect();
          return b.bottom > 0 && b.top < innerHeight && b.width > 0 && b.height > 0; };
        const head = document.querySelector(".site-head");
        const navOpener = document.querySelector(".nav-t");
        const navLinks = [...document.querySelectorAll(".site-nav a")].filter(on).length;
        const go = [...document.querySelectorAll('a[href$="book/"], a[href$="contact/"], a.nav-q--go')].filter(on).length;
        return { header: !!head && on(head),
                 nav: navLinks > 0 || (!!navOpener && on(navOpener)),
                 action: go > 0 };
      });
      if (!r.header || !r.nav) bad.push(`${Math.round(frac * 100)}%${!r.header ? " no header" : ""}${!r.nav ? " no nav" : ""}`);
      if (!r.action && frac > 0 && frac < 0.9) bad.push(`${Math.round(frac * 100)}% no way to act`);
    }
    check(bad.length === 0, `${path} @${w}x${h}: header, navigation and an action are always reachable`, bad.join("; "));
    await ctx.close();
  }
}

/* ── C · does a scene finish while you can still see it? ────────────────── */
console.log("\n══ C · VISIBLE COMPLETION ════════════════════════════════════");
for (const [w, h] of [[1440, 900], [430, 932], [390, 844], [360, 800]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2300);
  const rows = await page.evaluate(vh => {
    const out = [];
    for (const sc of document.querySelectorAll("[data-scene]")) {
      if (sc.dataset.scene === "lead") continue;
      const id = sc.getAttribute("aria-labelledby") || sc.className.trim().split(/\s+/)[0];
      const mode = sc.dataset.scene;
      const top = sc.getBoundingClientRect().top + scrollY, H = sc.offsetHeight;
      const band = (sc.dataset.band || "0,1").split(",").map(Number);
      const stick = sc.querySelector("[data-stick]");
      const stickH = stick ? stick.offsetHeight : vh;
      const pinned = stick && getComputedStyle(stick).position === "sticky" && H - stickH > 1;
      const yFor = pp => { const raw = band[0] + pp * (band[1] - band[0]);
        if (pinned) return top + raw * (H - stickH);
        return top - vh + raw * (vh + H); };
      const y = yFor(1);
      /* a pinned stage is on screen for its whole span by construction */
      const shown = pinned ? 1 : Math.max(0, Math.min(top + H, y + vh) - Math.max(top, y)) / Math.min(H, vh);
      out.push({ id, mode, pinned: !!pinned, shown: +shown.toFixed(2) });
    }
    return out;
  }, h);
  for (const r of rows)
    check(r.shown >= SEE, `${w}x${h} ${r.id}: still visible when it completes`,
          `only ${Math.round(r.shown * 100)}% of the scene on screen at p=1`);
  await ctx.close();
}

/* ── D · pinned content must fit the space it is pinned in ──────────────── */
console.log("\n══ D · SHORT AND LANDSCAPE VIEWPORTS ═════════════════════════");
for (const [w, h] of [[844, 390], [740, 360], [667, 375], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    const out = [];
    for (const st of document.querySelectorAll("[data-stick]")) {
      const cs = getComputedStyle(st);
      if (cs.position !== "sticky") continue;
      const inner = st.firstElementChild || st;
      out.push({ name: st.className.trim().split(/\s+/)[0],
                 box: Math.round(st.offsetHeight),
                 needs: Math.round(inner.scrollHeight),
                 clipped: cs.overflow !== "visible" && inner.scrollHeight > st.offsetHeight + 2 });
    }
    return { out, over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
             docH: document.documentElement.scrollHeight };
  });
  for (const s of r.out)
    check(!s.clipped, `${w}x${h} .${s.name}: pinned content fits its stage`,
          `stage ${s.box}px, content ${s.needs}px — ${s.needs - s.box}px clipped`);
  check(r.over === 0, `${w}x${h}: no horizontal overflow`, r.over + "px");
  if (r.out.length === 0) note(`${w}x${h}: nothing is pinned here (page is ${r.docH}px)`);
  await ctx.close();
}

/* ── E · touch targets on the controls that matter ──────────────────────── */
console.log("\n══ E · TOUCH TARGETS (primary controls) ══════════════════════");
for (const path of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  const docH = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < docH; y += 600) { await page.evaluate(v => scrollTo(0, v), y); await page.waitForTimeout(50); }
  const small = await page.evaluate(min => {
    const SEL = ".site-head a, .site-head button, .nav-t, .nav-q, .site-nav a, " +
                "a.btn, .nd, .fcard a, .cap__c a, main a.cta, .theme-t";
    const out = [];
    for (const el of document.querySelectorAll(SEL)) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.height >= min && r.width >= min) continue;
      out.push({ sel: (el.className || el.tagName).toString().split(" ")[0],
                 t: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 24),
                 w: Math.round(r.width), h: Math.round(r.height) });
    }
    const seen = new Set();
    return out.filter(o => { const k = o.sel + o.t; if (seen.has(k)) return false; seen.add(k); return true; });
  }, TAP);
  check(small.length === 0, `${path} @390: primary controls are at least ${TAP}px`,
        small.map(o => `${o.sel}"${o.t}" ${o.w}x${o.h}`).join(", "));
  await ctx.close();
}

/* ── F · real text must not sit at near-zero opacity ────────────────────── */
console.log("\n══ F · INVISIBLE REAL CONTENT ════════════════════════════════");
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2400);
  const ghosts = await page.evaluate(cut => {
    const out = []; let skipped = 0;
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walk.nextNode())) {
      const t = (n.textContent || "").trim();
      if (t.length < 3) continue;
      const el = n.parentElement;
      if (!el || el.offsetParent === null) continue;
      /* A slot marked data-oneof holds several mutually exclusive wordings of
         one value - "0 of 4" / "1 of 4" - stacked so the wording can change
         without moving anything. Exactly one is showing by construction, so a
         zero-opacity sibling is not hidden content. */
      if (el.closest("[data-oneof]")) { skipped++; continue; }
      let o = 1, p = el;
      while (p && p !== document.body) { o *= parseFloat(getComputedStyle(p).opacity); p = p.parentElement; }
      if (o < cut) out.push({ o: +o.toFixed(3), t: t.slice(0, 34),
                              sel: (el.className || el.tagName).toString().split(" ")[0] });
    }
    const seen = new Set();
    return { rows: out.filter(x => { if (seen.has(x.t)) return false; seen.add(x.t); return true; }),
             skipped: skipped };
  }, GHOST);
  if (ghosts.skipped) note(`${ghosts.skipped} node(s) inside a [data-oneof] slot were not counted`);
  check(ghosts.rows.length === 0, `no readable text sits below ${GHOST} opacity at rest`,
        ghosts.rows.slice(0, 8).map(g => `${g.sel} @${g.o} "${g.t}"`).join("; ") +
        (ghosts.rows.length > 8 ? ` (+${ghosts.rows.length - 8} more)` : ""));
  await ctx.close();
}

/* ── G · reverse scroll ─────────────────────────────────────────────────── */
console.log("\n══ G · REVERSE SCROLL ════════════════════════════════════════");
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2300);
  const read = () => [...document.querySelectorAll("[data-scene]")].map(e =>
    +getComputedStyle(e).getPropertyValue(e.dataset.var || "--p"));
  const names = await page.evaluate(() => [...document.querySelectorAll("[data-scene]")]
    .map(e => e.getAttribute("aria-labelledby") || e.className.trim().split(/\s+/)[0]));
  const docH = await page.evaluate(() => document.documentElement.scrollHeight);
  const down = [], up = [];
  for (let y = 0; y <= docH - h; y += 120) {
    await page.evaluate(v => scrollTo(0, v), y); await page.waitForTimeout(24);
    down.push({ y, v: await page.evaluate(read) });
  }
  for (let y = docH - h; y >= 0; y -= 120) {
    await page.evaluate(v => scrollTo(0, v), y); await page.waitForTimeout(24);
    up.push({ y, v: await page.evaluate(read) });
  }
  names.forEach((n, i) => {
    const dn = down.every((d, k) => k === 0 || d.v[i] >= down[k - 1].v[i] - EPS);
    const upOk = up.every((d, k) => k === 0 || d.v[i] <= up[k - 1].v[i] + EPS);
    check(dn && upOk, `${w}x${h} ${n}: rises going down and falls coming back`, dn ? "rose while scrolling up" : "fell while scrolling down");
  });
  const upAt = new Map(up.map(u => [u.y, u.v]));
  let drift = 0;
  for (const d of down) { const u = upAt.get(d.y); if (!u) continue;
    d.v.forEach((x, i) => { drift = Math.max(drift, Math.abs(x - u[i])); }); }
  check(drift <= EPS, `${w}x${h}: the same scroll position gives the same state`, `worst drift ${drift.toFixed(4)}`);
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(160);
  const home = await page.evaluate(read);
  check(home.every((v, i) => v <= EPS), `${w}x${h}: nothing is left completed at the top`,
        home.map((v, i) => v > EPS ? `${names[i]}=${v}` : "").filter(Boolean).join(", "));
  await ctx.close();
}

await browser.close();
console.log("");
notes.forEach(n => console.log("note: " + n));
console.log(fails.length ? `\n${fails.length} USABILITY FAILURE(S)` : "\nall usability checks passed");
process.exit(fails.length ? 1 : 0);
