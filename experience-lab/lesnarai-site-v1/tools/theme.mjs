/* THEME COHERENCE GATE ───────────────────────────────────────────────────────
   Written after shipping a build in which four of the homepage's seven
   sections were dark WHILE THE READER HAD CHOSEN LIGHT. Every other gate was
   green: contrast passed, because light-on-dark is perfectly legible; CLS,
   collision, motion and focal have nothing to say about it. The defect was
   only visible to a person who switched the theme, and I had reviewed one.

   A golden-image baseline would catch it, but on a site being actively
   redesigned it would need re-blessing daily and would decay into noise. The
   fault has a sharper signature than "some pixels changed":

     1 · in the light theme no section may sit on a dark ground, and in the
         dark theme none may sit on a light one;
     2 · a section whose background is IDENTICAL in both themes is not
         responding to the theme at all - which is precisely what a hardcoded
         --v-page override looks like from the outside.

   Rule 2 is the one that matters. A section is allowed to be deliberately
   inverted (the header is), but it must still differ between the two themes,
   and it must declare that intent with data-theme-fixed.

   Usage:  node tools/theme.mjs [--pages /,/work/]
   Exits non-zero on any incoherent section.                                  */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
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
const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : null; };

function pages() {
  const given = arg("--pages");
  if (given) return given.split(",");
  const out = [];
  (function walk(dir, url) {
    for (const e of readdirSync(dir)) {
      const f = join(dir, e);
      if (statSync(f).isDirectory()) { if (!/^(node_modules|tools|media|\.git)$/.test(e)) walk(f, url + e + "/"); }
      else if (e === "index.html") out.push(url);
    }
  })(ROOT, "/");
  return out.sort();
}

/* Perceived luminance of a computed colour, including color() syntax. */
const READ = () => {
  const lum = (c) => {
    if (!c || c === "transparent" || /rgba\(0, 0, 0, 0\)/.test(c)) return null;
    let n = (c.match(/[\d.]+/g) || []).map(Number);
    if (!n.length) return null;
    if (c.startsWith("color(")) n = n.slice(-3).map((v) => v * 255);
    else n = n.slice(0, 3);
    return (0.2126 * n[0] + 0.7152 * n[1] + 0.0722 * n[2]) / 255;
  };
  const out = [];
  const seen = new Set();
  for (const el of document.querySelectorAll("body > *, main > *, main section, main article, main header")) {
    const r = el.getBoundingClientRect();
    if (r.width < innerWidth * 0.6 || r.height < 80) continue;      /* full-width bands only */
    const key = el.tagName + "." + String(el.className || "").split(" ")[0];
    if (seen.has(key)) continue; seen.add(key);
    const L = lum(getComputedStyle(el).backgroundColor);
    if (L === null) continue;
    out.push({ key, L: +L.toFixed(3), fixed: el.hasAttribute("data-theme-fixed") });
  }
  return { sections: out, bodyBg: getComputedStyle(document.body).backgroundColor };
};

const b = await chromium.launch();
let bad = 0, checked = 0;
for (const url of pages()) {
  const read = {};
  for (const theme of ["light", "dark"]) {
    const c = await b.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: theme });
    const p = await c.newPage();
    await p.addInitScript((t) => { try { localStorage.setItem("lai-theme", t); } catch {} }, theme);
    await p.goto(BASE + url, { waitUntil: "load" });
    await p.waitForTimeout(900);
    read[theme] = await p.evaluate(READ);
    await c.close();
  }
  const L = new Map(read.light.sections.map((s) => [s.key, s]));
  for (const d of read.dark.sections) {
    const l = L.get(d.key); if (!l) continue;
    checked++;
    const problems = [];
    if (!l.fixed && l.L < 0.35) problems.push(`dark ground (${l.L}) while the reader chose LIGHT`);
    if (!d.fixed && d.L > 0.62) problems.push(`light ground (${d.L}) while the reader chose DARK`);
    if (Math.abs(l.L - d.L) < 0.02 && !l.fixed)
      problems.push(`identical in both themes (${l.L}) - not responding to the theme`);
    if (problems.length) { bad++; console.log(`  ${url}  ${d.key}\n      ${problems.join("\n      ")}`); }
  }
  /* the body must paint its own ground in both themes */
  for (const t of ["light", "dark"])
    if (/rgba\(0, 0, 0, 0\)/.test(read[t].bodyBg)) { bad++; console.log(`  ${url}  body has no ${t} background`); }
}
await b.close();
console.log(bad
  ? `\nTHEME: ${bad} incoherent section(s) across ${checked} checked`
  : `\nTHEME: ${checked} full-width sections coherent in both themes`);
process.exit(bad ? 1 : 0);
