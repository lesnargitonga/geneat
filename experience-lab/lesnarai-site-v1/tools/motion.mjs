/* HUMAN MOTION GATE ──────────────────────────────────────────────────────────
   Correctness only. This file proves that the narrative scenes are driven by
   scroll position and are therefore reversible. It cannot prove that any of it
   looks good - that is what watching a recording is for, and no assertion in
   here should ever be quoted as evidence that a scene reads well.

   What it checks, at every viewport:

     1  every narrative scene publishes a numeric progress value
     2  progress rises monotonically while scrolling down
     3  progress falls monotonically while scrolling up
     4  returning to a scroll position returns the same progress (determinism)
     5  no scene is left completed after scrolling back above it
     6  reduced motion resolves every scene statically, with no scroll response
     7  the flagship scenes are progress-driven on a phone, not switched off

   Usage
     node tools/motion.mjs
     node tools/motion.mjs --viewports 390x844
     node tools/motion.mjs --url http://127.0.0.1:4211/
     node tools/motion.mjs --verbose

   Exits non-zero on any failure. */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(HERE, "..");

const PW_CANDIDATES = [
  process.env.PLAYWRIGHT_PATH,
  join(ROOT, "node_modules/playwright/index.mjs"),
  join(ROOT, "../study-a-dom-svg/node_modules/playwright/index.mjs")
].filter(Boolean);

let chromium = null;
for (const p of PW_CANDIDATES) {
  try { ({ chromium } = await import(p)); break; } catch { /* next */ }
}
if (!chromium) {
  console.error("playwright not found; set PLAYWRIGHT_PATH");
  process.exit(2);
}

const argv = process.argv.slice(2);
const opt = (name, d) => {
  const i = argv.indexOf("--" + name);
  return i === -1 ? d : argv[i + 1];
};
const VERBOSE = argv.includes("--verbose");
const TARGET = opt("url", "http://127.0.0.1:4211/");
const VIEWPORTS = opt("viewports", "1440x900,390x844,360x800")
  .split(",").map(v => { const [w, h] = v.split("x").map(Number); return { width: w, height: h }; });

/* A phone scene is a flagship one - the audit found the BizMtaani scene did
   not run at all below 821px, which is the specific regression this guards. */
const FLAGSHIP = ["pr-biz", "pr-care", "pr-jam"];

const EPS = 0.0025;     /* tolerance for float progress comparison */
const STEP = 90;        /* px per sample - roughly one human scroll notch */

const fails = [];
const notes = [];
function check(ok, label, detail) {
  if (ok) { if (VERBOSE) console.log("  ok    " + label); return; }
  fails.push(label + (detail ? " — " + detail : ""));
  console.log("  FAIL  " + label + (detail ? "\n          " + detail : ""));
}

const readScenes = () => [...document.querySelectorAll("[data-scene]")].map(e => ({
  id: e.getAttribute("aria-labelledby") || e.className.trim().split(/\s+/)[0],
  mode: e.dataset.scene,
  rest: e.dataset.rest === undefined ? 1 : parseFloat(e.dataset.rest),
  p: parseFloat(getComputedStyle(e).getPropertyValue(e.dataset.var || "--p"))
}));

const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  const tag = `${vp.width}x${vp.height}`;
  console.log(`\n── ${tag} ─────────────────────────────────────────────`);

  /* ── motion on ────────────────────────────────────────────────────── */
  const ctx = await browser.newContext({ viewport: vp, colorScheme: "light" });
  const page = await ctx.newPage();
  await page.goto(TARGET, { waitUntil: "networkidle" });
  await page.waitForTimeout(2300);          /* let the hero finish establishing */

  const docH = await page.evaluate(() => document.documentElement.scrollHeight);
  const names = (await page.evaluate(readScenes)).map(s => s.id);
  check(names.length > 0, "scenes are declared", `found ${names.length}`);

  /* 1 · every scene publishes a number */
  const first = await page.evaluate(readScenes);
  check(first.every(s => Number.isFinite(s.p)),
        "every scene publishes a numeric progress",
        first.filter(s => !Number.isFinite(s.p)).map(s => s.id).join(", "));

  /* walk down, then back up, recording every scene at every position */
  const down = [], up = [];
  for (let y = 0; y <= docH - vp.height; y += STEP) {
    await page.evaluate(v => scrollTo(0, v), y);
    await page.waitForTimeout(26);
    down.push({ y, s: await page.evaluate(readScenes) });
  }
  for (let y = docH - vp.height; y >= 0; y -= STEP) {
    await page.evaluate(v => scrollTo(0, v), y);
    await page.waitForTimeout(26);
    up.push({ y, s: await page.evaluate(readScenes) });
  }

  /* 2 · monotone down, 3 · monotone up */
  names.forEach((name, i) => {
    let bad = null;
    for (let k = 1; k < down.length; k++) {
      if (down[k].s[i].p < down[k - 1].s[i].p - EPS) {
        bad = `y=${down[k].y}: ${down[k - 1].s[i].p} → ${down[k].s[i].p}`; break;
      }
    }
    check(!bad, `${name}: progress never falls while scrolling down`, bad);

    bad = null;
    for (let k = 1; k < up.length; k++) {
      if (up[k].s[i].p > up[k - 1].s[i].p + EPS) {
        bad = `y=${up[k].y}: ${up[k - 1].s[i].p} → ${up[k].s[i].p}`; break;
      }
    }
    check(!bad, `${name}: progress never rises while scrolling up`, bad);

    /* the scene has to actually move, or there is nothing to reverse */
    const span = Math.max(...down.map(d => d.s[i].p)) - Math.min(...down.map(d => d.s[i].p));
    check(span > 0.9, `${name}: sweeps a full 0 → 1`, `span ${span.toFixed(3)}`);
  });

  /* 4 · determinism — the same y gives the same picture on the way back */
  const upAt = new Map(up.map(u => [u.y, u.s]));
  let drift = 0, driftAt = "";
  for (const d of down) {
    const u = upAt.get(d.y);
    if (!u) continue;
    d.s.forEach((s, i) => {
      const gap = Math.abs(s.p - u[i].p);
      if (gap > drift) { drift = gap; driftAt = `${names[i]} @ y=${d.y}: ${s.p} vs ${u[i].p}`; }
    });
  }
  check(drift <= EPS, "the same scroll position returns the same progress",
        drift > EPS ? `worst drift ${drift.toFixed(4)} — ${driftAt}` : "");

  /* 5 · nothing is left completed once you are back above it */
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(120);
  const home = await page.evaluate(readScenes);
  home.forEach(s => {
    /* the hero rests at 0 by design; every narrative scene must be back to 0 */
    const want = s.mode === "lead" ? 0 : 0;
    check(Math.abs(s.p - want) <= EPS,
          `${s.id}: not left completed after returning to the top`, `p=${s.p}`);
  });

  /* 7 · the flagship scenes are alive on a phone */
  if (vp.width <= 480) {
    FLAGSHIP.forEach(id => {
      const i = names.indexOf(id);
      if (i === -1) { notes.push(`${tag}: ${id} not present`); return; }
      const span = Math.max(...down.map(d => d.s[i].p)) - Math.min(...down.map(d => d.s[i].p));
      check(span > 0.9, `${id}: progress-driven at ${tag}, not switched off`,
            `span ${span.toFixed(3)}`);
    });
  }
  await ctx.close();

  /* ── 6 · reduced motion ───────────────────────────────────────────── */
  const rctx = await browser.newContext({ viewport: vp, colorScheme: "light",
                                          reducedMotion: "reduce" });
  const rpage = await rctx.newPage();
  await rpage.goto(TARGET, { waitUntil: "networkidle" });
  await rpage.waitForTimeout(600);
  const rTop = await rpage.evaluate(readScenes);
  check(rTop.every(s => Math.abs(s.p - s.rest) <= EPS),
        "reduced motion: every scene resolves statically",
        rTop.filter(s => Math.abs(s.p - s.rest) > EPS)
            .map(s => `${s.id} p=${s.p} want=${s.rest}`).join(", "));

  const rDocH = await rpage.evaluate(() => document.documentElement.scrollHeight);
  await rpage.evaluate(v => scrollTo(0, v), Math.round(rDocH / 2));
  await rpage.waitForTimeout(200);
  const rMid = await rpage.evaluate(readScenes);
  check(rMid.every((s, i) => Math.abs(s.p - rTop[i].p) <= EPS),
        "reduced motion: scrolling changes nothing",
        rMid.filter((s, i) => Math.abs(s.p - rTop[i].p) > EPS).map(s => s.id).join(", "));
  await rctx.close();
}

await browser.close();
notes.forEach(n => console.log("note: " + n));
console.log(fails.length ? `\n${fails.length} FAILED` : "\nall motion checks passed");
process.exit(fails.length ? 1 : 0);
