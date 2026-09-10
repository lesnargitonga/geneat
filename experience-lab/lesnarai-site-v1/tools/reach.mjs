/* END REACHABILITY ───────────────────────────────────────────────────────────
   At scrollY === maxScroll, every scroll-driven reveal the reader has passed
   must be in its intended terminal state. A scene sitting at --p 0.72 because
   the document physically ran out of scroll is a state the reader can never
   see, and it is a blocker rather than a tuning issue.

   The terminal state is not assumed. Each scene's --p is forced to 1 inline
   after the measurement, the subjects are read again, and the two readings
   are compared - so this reports what the reader is actually denied, not what
   a progress variable claims.                                              */
import { chromium } from "../../study-a-dom-svg/node_modules/playwright/index.mjs";

const HOST = process.env.REACH_HOST || "http://127.0.0.1:4211";
const PAGES = ["/", "/work/", "/work/carepro/"];
const VIEWPORTS = [[1440, 900], [390, 844], [360, 800], [430, 932]];

function READ(sels) {
  return sels.map(s => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    const v = [];
    const m = cs.transform;
    if (m && m !== "none") {
      const q = (m.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);
      if (m.startsWith("matrix3d")) v.push(q[0], q[5], q[12], q[13]);
      else v.push(q[0], q[3], q[4], q[5]);
    } else v.push(1, 1, 0, 0);
    v.push(+cs.opacity * 100);
    const cp = cs.clipPath;
    if (cp && cp.indexOf("inset") === 0) {
      const q = (cp.match(/-?[\d.]+(?=%)/g) || []).map(Number);
      v.push(q[0] || 0, q[1] || 0, q[2] || 0, q[3] || 0);
    } else v.push(0, 0, 0, 0);
    return { v, top: r.top, bottom: r.bottom };
  });
}

const b = await chromium.launch();
const fails = [];

for (const [W, H] of VIEWPORTS) {
  const touch = W < 700;
  const c = await b.newContext({ viewport: { width: W, height: H }, colorScheme: "light",
                                 hasTouch: touch, isMobile: touch });
  const p = await c.newPage();
  await p.addInitScript(() => { try { localStorage.setItem("lai-theme", "light"); } catch (e) {} });

  for (const path of PAGES) {
    await p.goto(HOST + path, { waitUntil: "load" });
    await p.waitForTimeout(2400);
    const maxScroll = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    await p.evaluate(v => scrollTo(0, v), maxScroll);
    await p.evaluate(() => new Promise(r => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(r)), 120)));

    /* every scene's progress at the very bottom of the document */
    const scenes = await p.evaluate(() => [...document.querySelectorAll("[data-scene]")].map(s => {
      const r = s.getBoundingClientRect();
      return { name: (s.className.split(" ").filter(x => x && !x.startsWith("m-"))[1]
                     || s.className.split(" ")[0] || "scene"),
               p: parseFloat(getComputedStyle(s).getPropertyValue("--p")),
               passed: r.top < innerHeight };
    }));

    /* every element that derives a band from --p, read now and again with
       every scene forced to its end */
    const sels = await p.evaluate(() =>
      [...document.querySelectorAll("[data-scene] .st, [data-scene] .ost, [data-scene] li, [data-scene] figure")]
        .slice(0, 260)
        .map((el, i) => { el.setAttribute("data-reach", String(i)); return `[data-reach="${i}"]`; }));
    const now = await p.evaluate(READ, sels);
    await p.evaluate(() => {
      document.querySelectorAll("[data-scene]").forEach(s => s.style.setProperty("--p", "1"));
    });
    await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const end = await p.evaluate(READ, sels);

    let stuck = 0, worst = 0, worstSel = "";
    for (let i = 0; i < now.length; i++) {
      if (!now[i] || !end[i]) continue;
      if (now[i].bottom < 0) continue;                    /* scrolled past the top edge */
      let d = 0; for (let k = 0; k < now[i].v.length; k++) d += Math.abs(now[i].v[k] - end[i].v[k]);
      if (d > 2) { stuck++; if (d > worst) { worst = d; worstSel = sels[i]; } }
    }

    const unfinished = scenes.filter(s => s.passed && !isNaN(s.p) && s.p < 0.999);
    const ok = unfinished.length === 0 && stuck === 0;
    console.log(`  ${path.padEnd(17)} ${String(W).padStart(4)}x${H}  maxScroll ${String(maxScroll).padStart(5)}px  ` +
      `scenes unfinished: ${unfinished.length}${unfinished.length ? " (" + unfinished.map(u => `${u.name} --p=${u.p.toFixed(3)}`).join(", ") + ")" : ""}  ` +
      `elements short of their end state: ${stuck}${stuck ? ` (worst ${worstSel})` : ""}  ${ok ? "REACHABLE" : "UNREACHABLE"}`);
    if (!ok) fails.push(`${path} ${W}x${H}: ${unfinished.map(u => u.name + " --p=" + u.p.toFixed(3)).join(", ")}${stuck ? ` +${stuck} element(s)` : ""}`);
  }
  await c.close();
}
await b.close();
console.log(fails.length ? `\nREACH: ${fails.length} failure(s)\n  ` + fails.join("\n  ")
                         : "\nREACH: every passed scene reaches its terminal state at maxScroll");
