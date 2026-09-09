/* RESTING TEXT CONTRAST ─────────────────────────────────────────────────────
   Every visible run of text on every page, in both themes, checked against
   the ground it is actually painted on.

   The ground is found by walking ancestors to the first non-transparent
   background, because most text on this site sits on a parent's fill rather
   than its own - the trap that produced a 1:1 "Discuss a project" button and
   four invisible CarePro check names, both of which a source grep passed.

   WCAG AA: 4.5:1 for normal text, 3:1 for large (>=24px, or >=18.66px bold). */
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

function discover(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (["\.git","node_modules","tools","media","fonts"].includes(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) discover(full, out);
    else if (name.endsWith(".html"))
      out.push("/" + relative(ROOT, full).replace(/\\/g,"/").replace(/index\.html$/,""));
  }
  return out;
}

function scan() {
  const parse = c => {
    const m = (c || "").match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const v = m[1].split(",").map(x => parseFloat(x));
    return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 };
  };
  const lin = v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
  const lum = c => 0.2126*lin(c.r) + 0.7152*lin(c.g) + 0.0722*lin(c.b);
  const ratio = (a, b) => { const [x,y] = [lum(a), lum(b)].sort((m,n)=>n-m);
                            return (x + 0.05) / (y + 0.05); };
  const over = (fg, bg) => ({ r: fg.r*fg.a + bg.r*(1-fg.a),
                              g: fg.g*fg.a + bg.g*(1-fg.a),
                              b: fg.b*fg.a + bg.b*(1-fg.a), a: 1 });

  const ground = el => {
    let n = el, acc = null;
    while (n && n !== document.documentElement.parentNode) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) { acc = acc ? over(acc, c) : c; if (acc.a >= 0.999) return acc; }
      n = n.parentElement;
    }
    return acc || { r:255, g:255, b:255, a:1 };
  };

  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const t = (n.textContent || "").trim();
    if (t.length < 2) continue;
    const el = n.parentElement;
    if (!el || el.offsetParent === null) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    /* WCAG 1.4.3 exempts inactive user-interface components, and a disabled
       control is meant to read as unavailable. Flagging it would push the
       site toward making disabled buttons look enabled. */
    if (el.closest("[disabled],[aria-disabled='true']")) continue;
    const op = parseFloat(cs.opacity);
    if (op < 0.15) continue;
    const b = el.getBoundingClientRect();
    if (b.width < 2 || b.height < 2) continue;

    const bg = ground(el);
    let fg = parse(cs.color); if (!fg) continue;
    if (op < 1) fg = { ...fg, a: fg.a * op };
    const eff = over(fg, bg);
    const r = ratio(eff, bg);
    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const need = (size >= 24 || (bold && size >= 18.66)) ? 3 : 4.5;
    if (r + 0.02 < need)
      out.push({ r: +r.toFixed(2), need, size: Math.round(size),
                 sel: el.tagName.toLowerCase() + "." + (el.className||"").toString().split(" ")[0],
                 text: t.slice(0, 28) });
  }
  return out;
}

const browser = await chromium.launch();
const pages = discover().sort();
let total = 0;
const seen = new Map();
for (const path of pages) {
  for (const theme of ["light", "dark"]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 },
                                           colorScheme: theme });
    const page = await ctx.newPage();
    await page.route("**/api/status*", r => r.fulfill({ status: 500, body: "x" }));
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    await page.evaluate(t => document.documentElement.setAttribute("data-theme", t), theme);
    await page.waitForTimeout(350);
    const hits = await page.evaluate(scan);
    for (const h of hits) {
      const key = `${theme} ${h.sel} ${h.r}:1 ${h.text}`;
      seen.set(key, (seen.get(key) || 0) + 1);
      total++;
    }
    await ctx.close();
  }
}
await browser.close();
if (!seen.size) console.log(`  clean: no resting-contrast issues in either theme, all ${pages.length} pages`);
else {
  console.log(`  ${seen.size} distinct issue(s) across ${pages.length} pages:`);
  [...seen.entries()].slice(0, 14).forEach(([k, n]) => console.log(`    ${k}  x${n}`));
}
process.exit(seen.size ? 1 : 0);
