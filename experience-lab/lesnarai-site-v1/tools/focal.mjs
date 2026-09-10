/* FOCAL COMPLETION ───────────────────────────────────────────────────────────
   "Where was the subject when the important reveal finished?"

   Progress is not read from a custom property here. It is DERIVED FROM WHAT
   THE SUBJECT ACTUALLY RENDERS: the transform, opacity and mask are sampled
   across the whole page, the settled state is taken from the end of the
   trajectory, and progress at any scroll position is how far the subject has
   travelled from its furthest-from-settled state toward that settled state.
   That works identically on pages where --n is a registered number and pages
   where it is an unresolved clamp() token, and it cannot be fooled by a
   progress variable that reaches 1 while nothing has visibly moved.

   For every subject it reports the viewport Y of the subject's centre at the
   moment its reveal reaches 25 / 50 / 75 / 90 / 100%, as a percentage of the
   viewport height. The rule being tested:

     the reveal must be DONE by the time the subject reaches ~25-30vh

   A reveal that completes at 12vh finished after the subject had climbed out
   of the focal zone, which is the thing a reader experiences as "I kept
   scrolling while it slowly finished above me".                             */
import { chromium } from "../../study-a-dom-svg/node_modules/playwright/index.mjs";

const HOST = process.env.FOCAL_HOST || "http://127.0.0.1:4211";
const STEP = 25;

/* the subjects that carry an important state, per page */
const SUBJECTS = {
  "/": [
    ["hero panel",        ".ch1__proof", "release"],
    ["hero headline",     ".ch1 h1"],
    ["map core",          ".map__core"],
    ["map branch 1",      ".map__br:nth-of-type(1) .map__n li:last-child"],
    ["map last system",   ".map__br:last-of-type .map__n li:last-child"],
    ["map way out",       ".map__all"],
    ["biz discovery",     ".bframe--a"],
    ["biz merchant",      ".bframe--b"],
    ["carepro gate 04",   ".gates__l li:last-child"],
    ["carepro evidence",  ".care__ev"],
    ["jamii stage 4",     ".jrec__s:last-child"],
    ["jamii evidence",    ".jam__ev"]
  ],
  "/work/": [
    ["register headline", ".route-work h1"],
    ["flagship row 03",   ".reg-band:nth-of-type(1) .live-list li:last-child"],
    ["also-live row 05",  ".reg-band:nth-of-type(2) .live-list li:last-child"],
    ["held row 11",       ".held-list li:last-child"]
  ],
  "/work/carepro/": [
    ["record headline",   ".sys-hero h1"],
    ["verification panel",".sys-hero .sig"],
    ["surface capture",   ".surface"],
    ["observation 3",     ".obs li:last-child"],
    ["flow step 04",      ".flow__step:last-child"]
  ]
};

const VIEWPORTS = [[1440, 900, 30], [390, 844, 30]];   /* w, h, done-by vh% */

/* A real function, not a string: Playwright evaluates a string as an
   expression and never hands it the argument, which is why the first run of
   this gate came back with nothing to measure. */
/* The number regex here used to be /-?[\d.e+]+/g, which has no '-' inside
   the class: a settled transform of matrix(1,0,0,1,0,-2.88658e-15) - what a
   calc() that should be zero actually produces - split into "-2.88658e" and
   "-15", so the settled value parsed as NaN and every comparison against it
   was NaN. The gate then reported that the map's systems never finished
   arriving, when they finish exactly on time. */
function READ(sels) {
  return sels.map(s => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const v = [];
    const m = cs.transform;
    if (m && m !== "none") {
      const q = (m.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);
      if (m.startsWith("matrix3d")) v.push(q[0], q[5], q[12], q[13], q[14] || 0);
      else v.push(q[0], q[3], q[4], q[5], 0);
    } else v.push(1, 1, 0, 0, 0);
    v.push(+cs.opacity * 100);
    const cp = cs.clipPath;
    if (cp && cp.indexOf("inset") === 0) {
      const q = (cp.match(/-?[\d.]+(?=%)/g) || []).map(Number);
      v.push(q[0] || 0, q[1] || 0, q[2] || 0, q[3] || 0);
    } else v.push(0, 0, 0, 0);
    const f = cs.filter;
    v.push(f && f !== "none" ? (parseFloat((f.match(/[\d.]+/) || [1])[0]) * 40) : 40);
    return { v, cy: r.top + r.height / 2, h: r.height };
  });
}

const dist = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s; };

const b = await chromium.launch();
const fails = [], notes = [];

for (const [W, H, DONE_BY] of VIEWPORTS) {
  const touch = W < 700;
  const c = await b.newContext({ viewport: { width: W, height: H }, colorScheme: "light",
                                 hasTouch: touch, isMobile: touch });
  const p = await c.newPage();
  await p.addInitScript(() => { try { localStorage.setItem("lai-theme", "light"); } catch (e) {} });

  for (const [path, list] of Object.entries(SUBJECTS)) {
    await p.goto(HOST + path, { waitUntil: "load" });
    await p.waitForTimeout(2600);
    const sels = list.map(x => x[1]);
    const maxScroll = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);

    const track = list.map(() => []);
    for (let y = 0; y <= maxScroll; y += STEP) {
      await p.evaluate(v => scrollTo(0, v), y);
      await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const rows = await p.evaluate(READ, sels);
      rows.forEach((r, k) => { if (r) track[k].push({ y, ...r }); });
    }

    console.log(`\n### ${path}  ${W}x${H}   maxScroll ${maxScroll}px   reveal must be done by ${DONE_BY}vh`);
    console.log(`  ${"subject".padEnd(20)} ${"25%".padStart(6)} ${"50%".padStart(6)} ${"75%".padStart(6)} ${"90%".padStart(6)} ${"100%".padStart(7)}   verdict`);

    list.forEach(([name, , kind], k) => {
      const t = track[k];
      if (t.length < 4) { console.log(`  ${name.padEnd(20)} not measurable`); return; }
      /* settled state = what it renders once it is past the focal zone */
      const settled = t[t.length - 1].v;
      const d = t.map(s => dist(s.v, settled));
      const dmax = Math.max(...d);
      if (dmax < 6) { console.log(`  ${name.padEnd(20)} ${"static (no measurable reveal)".padStart(40)}`); return; }
      const prog = d.map(x => 1 - x / dmax);
      /* first scroll position at which progress reaches each mark */
      const at = m => { for (let i = 0; i < prog.length; i++) if (prog[i] >= m) return t[i]; return null; };
      const marks = [.25, .5, .75, .9, .999].map(at);
      const pct = s => s ? `${Math.round(s.cy / H * 100)}vh` : "—";
      const done = marks[3];
      const doneAt = done ? Math.round(done.cy / H * 100) : null;
      let verdict = "ok";
      /* A RELEASE is not a reveal. The hero's withdraw is meant to complete as
         the hero leaves the screen, so "must be finished by 30vh" is the wrong
         question to ask of it - the reveal rule governs things arriving, and
         everything above END is release by definition. It is still reported,
         so a release that finished before it started leaving is visible. */
      /* A PINNED subject does not travel through the focal zone: it performs
         at a fixed station while its stage is held. Asking whether it
         "finished before 30vh" is the same category error the arrival gate
         made about a kicker that lives at 10vh. Its station is a composition
         question, reported as one, and counted apart from late reveals. */
      const ys = marks.filter(Boolean).map(m => m.cy / H * 100);
      const pinned = ys.length > 3 && Math.max(...ys) - Math.min(...ys) < 3;
      if (pinned) {
        const st = Math.round(ys[0]);
        verdict = st < DONE_BY || st > 78
          ? `pinned at ${st}vh - outside the focal band` : `pinned at ${st}vh`;
        if (verdict.includes("outside")) notes.push(`${path} ${W}x${H} ${name}: ${verdict}`);
      }
      else if (kind === "release") verdict = doneAt === null ? "release (never completes)" : `release, completes at ${doneAt}vh`;
      else if (doneAt === null) verdict = "NEVER REACHES 90%";
      else if (doneAt < DONE_BY) verdict = `LATE - finished at ${doneAt}vh, above the focal zone`;
      else if (doneAt > 92) verdict = "before it entered";
      if (verdict.startsWith("LATE") || verdict.startsWith("NEVER"))
        fails.push(`${path} ${W}x${H} ${name}: ${verdict}`);
      console.log(`  ${name.padEnd(20)} ${pct(marks[0]).padStart(6)} ${pct(marks[1]).padStart(6)} ${pct(marks[2]).padStart(6)} ${pct(marks[3]).padStart(6)} ${pct(marks[4]).padStart(7)}   ${verdict}`);
    });
  }
  await c.close();
}
await b.close();
if (notes.length) console.log(`\nFOCAL composition notes (pinned stations, not late reveals):\n  ` + notes.join("\n  "));
console.log(fails.length ? `\nFOCAL: ${fails.length} late reveal(s)\n  ` + fails.join("\n  ")
                         : "\nFOCAL: 0 late reveals - every travelling reveal completes inside its focal zone");
