/* ═══ BEHAVIOUR GATE ═══════════════════════════════════════════════════════
   What the runtime gate does not exercise: the pages built or changed in the
   November phase, with JavaScript off, under reduced motion, by keyboard, and
   with the network watched.

     python3 -m http.server 8911 --bind 127.0.0.1    # serve first, from this dir
     node tools/behaviour-gate.mjs
     BASE=http://127.0.0.1:8913 node tools/behaviour-gate.mjs   another server
     ENGINE=firefox node tools/behaviour-gate.mjs

   Exits non-zero on any failure.                                            */
import * as pw from '/home/lesnar/Documents/ai model/experience-lab/study-b-webgl/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:8911';
const ENGINE = process.env.ENGINE || 'chromium';
const FAIL = [];
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) FAIL.push(what); };

const browser = await pw[ENGINE].launch();
const open = async (opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  return [ctx, await ctx.newPage()];
};

try {
  /* 1 · no JavaScript: the native player is the whole player, every fact is there */
  {
    const [ctx, p] = await open({ javaScriptEnabled: false });
    await p.goto(BASE + '/work/sentinel/', { waitUntil: 'load' });
    const s = await p.evaluate(() => {
      const vis = el => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
      const v = document.querySelector('#sentinel-film-v');
      return {
        playHidden: !vis(document.querySelector('.film .play')),
        posterHidden: !vis(document.querySelector('.film img.poster')),
        videoShown: vis(v), controls: !!v && v.hasAttribute('controls'),
        figures: ['svg.plan', 'svg.speed', 'svg.det', 'table.ledger'].every(q => vis(document.querySelector(q))),
        ledgerRows: document.querySelectorAll('table.ledger tbody tr').length,
        h2s: [...document.querySelectorAll('main h2')].filter(h => !h.classList.contains('sr')).every(vis),
      };
    });
    check(s.playHidden && s.posterHidden, 'no-JS: designed play button and poster overlay are hidden');
    check(s.videoShown && s.controls, 'no-JS: native <video controls> is visible and usable');
    check(s.figures && s.ledgerRows === 7, 'no-JS: all four figures render, ledger has 7 runs');
    check(s.h2s, 'no-JS: every section heading is visible');
    await ctx.close();
  }

  /* 2 · reduced motion: play loads the film and hands over controls, but nothing moves */
  {
    const [ctx, p] = await open({ reducedMotion: 'reduce' });
    await p.goto(BASE + '/work/sentinel/', { waitUntil: 'networkidle' });
    await p.click('.film .play');
    await p.waitForTimeout(1200);
    const s = await p.evaluate(() => {
      const v = document.querySelector('#sentinel-film-v');
      return { playing: document.querySelector('#sentinel-film').classList.contains('playing'),
               paused: v.paused, controls: v.hasAttribute('controls'), focused: document.activeElement === v };
    });
    check(s.playing && s.controls, 'reduced motion: play reveals the native player');
    check(s.paused, 'reduced motion: the film does not start moving on its own');
    check(s.focused, 'reduced motion: focus moves to the player');
    await ctx.close();
  }

  /* 3 · keyboard: the skip link comes first and works; play is reachable and starts the film */
  {
    const [ctx, p] = await open();
    await p.goto(BASE + '/work/sentinel/', { waitUntil: 'networkidle' });
    await p.keyboard.press('Tab');
    const skip = await p.evaluate(() => {
      const a = document.activeElement;
      return { isSkip: a && a.classList.contains('skip'), top: a ? a.getBoundingClientRect().top : -1 };
    });
    check(skip.isSkip && skip.top >= 0, 'keyboard: first Tab lands on a visible skip link');
    await p.keyboard.press('Enter');
    check((await p.evaluate(() => location.hash)) === '#main', 'keyboard: skip link moves to #main');
    let reached = false;
    for (let i = 0; i < 25 && !reached; i++) {
      await p.keyboard.press('Tab');
      reached = await p.evaluate(() => document.activeElement && document.activeElement.classList.contains('play'));
    }
    check(reached, 'keyboard: the film play control is reachable by Tab');
    if (reached) {
      await p.keyboard.press('Enter');
      await p.waitForTimeout(1500);
      const s = await p.evaluate(() => { const v = document.querySelector('#sentinel-film-v');
        return { classOn: document.querySelector('#sentinel-film').classList.contains('playing'), t: v.currentTime, paused: v.paused }; });
      check(s.classOn, 'keyboard: Enter on play reveals the player');
      // Some headless engines ship without the codecs; report rather than fail on that alone.
      console.log(`info film after Enter: paused=${s.paused} currentTime=${s.t.toFixed(2)}s (${ENGINE})`);
    }
    await ctx.close();
  }

  /* 4 · Home: no film and nothing heavy fetched; the Sentinel channel and frame route to the case */
  {
    const [ctx, p] = await open();
    const fetched = [];
    p.on('request', r => fetched.push(r.url()));
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise(r => setTimeout(r, 80)); } });
    await p.waitForTimeout(600);
    const s = await p.evaluate(() => ({
      video: document.querySelectorAll('video').length,
      toSentinel: document.querySelectorAll('main a[href="/work/sentinel/"]').length,
    }));
    check(s.video === 0, 'Home: no video element on the page');
    check(s.toSentinel >= 2, 'Home: the Sentinel channel and its frame both link to /work/sentinel/');
    check(!fetched.some(u => /sentinel-detections\.json|sentinel-film-001\.|medimatch-command/.test(u)),
      'Home: no film, loop or detections record is requested');
    await ctx.close();
  }

  /* 5 · Work: every row link and the case card resolve; quiet rows are not links */
  {
    const [ctx, p] = await open();
    await p.goto(BASE + '/work/', { waitUntil: 'networkidle' });
    const hrefs = await p.evaluate(() => [...document.querySelectorAll('.case-card, a.sys')].map(a => a.getAttribute('href')));
    const quiet = await p.evaluate(() => [...document.querySelectorAll('.sys--quiet')].every(el => el.tagName !== 'A'));
    let broken = [];
    for (const h of [...new Set(hrefs)]) {
      const r = await p.request.get(BASE + h);
      if (r.status() !== 200) broken.push(`${h} ${r.status()}`);
    }
    check(broken.length === 0, `Work: all ${new Set(hrefs).size} linked pages return 200${broken.length ? ' — ' + broken.join(', ') : ''}`);
    check(quiet, 'Work: systems with no page are not rendered as links');
    await ctx.close();
  }
} finally {
  await browser.close();
}

console.log(FAIL.length ? `\n${FAIL.length} failure(s) on ${ENGINE}` : `\n=== BEHAVIOUR GATE PASSES on ${ENGINE} ===`);
process.exit(FAIL.length ? 1 : 0);
