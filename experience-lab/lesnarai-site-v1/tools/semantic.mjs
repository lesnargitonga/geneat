/* SEMANTIC + INTERACTION GATES ───────────────────────────────────────────────
   Three things a screenshot cannot check: that the register never calls a
   timeout an answer, that the CarePro pages describe a published process
   rather than claiming they watched one pass, and that every route into the
   operated flow leaves it in one agreeing state.                            */
import { chromium } from "../../study-a-dom-svg/node_modules/playwright/index.mjs";
const HOST = process.env.SEM_HOST || "http://127.0.0.1:4211";
const b = await chromium.launch();
const fail = [], note = m => console.log("  " + m);
const bad  = m => { fail.push(m); console.log("  FAIL " + m); };

/* ── 1 · the register never claims a failure answered ───────────────────── */
{
  const c = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });
  const p = await c.newPage();
  await p.goto(HOST + "/work/", { waitUntil: "load" });
  await p.waitForTimeout(1200);
  console.log("\n════ WORK TRUTH-COPY ════");
  const combos = [[0,0],[1,0],[0,1],[2,1],[3,2],[4,1],[5,0],[0,5],[2,3]];
  for (const [ok, no] of combos) {
    const r = await p.evaluate(([ok, no]) => {
      const rows = [...document.querySelectorAll(".live-list [data-probe]")];
      rows.forEach((x, i) => {
        x.removeAttribute("data-state");
        if (i < ok) x.setAttribute("data-state", "ok");
        else if (i < ok + no) x.setAttribute("data-state", "fail");
      });
      return new Promise(res => setTimeout(() => {
        const bx = document.querySelector("[data-regscan]");
        res({ count: bx.querySelector(".regscan__c").textContent.replace(/\s+/g, " ").trim(),
              text:  bx.querySelector(".regscan__t > span").textContent.trim(),
              fillW: bx.style.getPropertyValue("--done"),
              all:   bx.getAttribute("data-all") });
      }, 60));
    }, [ok, no]);
    const done = ok + no, total = 5;
    let why = null;
    /* the claim "N answered" must never exceed the number that answered */
    const m = r.text.match(/(\d+)\s+answered/);
    if (m && +m[1] !== ok) why = `says "${m[1]} answered" but ${ok} answered`;
    if (/all answered/i.test(r.text) && ok !== total) why = `says "all answered" with ${no} failure(s)`;
    if (no > 0 && !/no answer/.test(r.text)) why = `${no} failure(s) but no "no answer" in the copy`;
    if (!r.count.startsWith(String(done))) why = `count says "${r.count}" for ${done} completed checks`;
    if (Math.abs(+r.fillW - done / total) > 0.002) why = `fill ${r.fillW} != checks ${done}/${total}`;
    if (done === total && r.all !== (no ? "mixed" : "ok")) why = `aggregate flag "${r.all}" wrong`;
    if (why) bad(`${ok} ok + ${no} fail → ${why}   [${r.count} | ${r.text}]`);
    else note(`${ok} ok + ${no} fail  →  "${r.count}"  "${r.text}"`);
  }
  /* the row wordings, read from a fresh load - the combos above force
     data-state without touching .pv, which is a fixture, not a page state */
  await p.goto(HOST + "/work/", { waitUntil: "load" });
  await p.waitForTimeout(2600);
  const rowCopy = await p.evaluate(() =>
    [...document.querySelectorAll(".live-list [data-probe]")].map(r =>
      (r.getAttribute("data-state") || "-") + "=" + r.querySelector(".pv").textContent.trim()));
  const allowed = /^(-=not yet checked|-=checking….*|ok=answered in \d+ ms|fail=no answer)$/;
  rowCopy.forEach(x => { if (!allowed.test(x)) bad(`row copy not in the permitted set: "${x}"`); });
  note(`row wordings: ${[...new Set(rowCopy.map(x => x.split("=")[1].replace(/\d+/g, "N")))].join(" | ")}`);
  await c.close();
}

/* ── 2 · CarePro describes a published process, not an observed pass ────── */
{
  const c = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });
  const p = await c.newPage();
  console.log("\n════ CAREPRO PUBLISHED-PROCESS ════");
  for (const [url, label, sel] of [[HOST + "/work/carepro/", "record hero", ".sys-hero .sig"],
                                   [HOST + "/", "homepage scene", ".pr--care"]]) {
    await p.goto(url, { waitUntil: "load" });
    await p.waitForTimeout(2600);
    if (label === "homepage scene")
      await p.evaluate(() => { const e = document.querySelector(".pr--care");
        scrollTo(0, e.getBoundingClientRect().top + scrollY - innerHeight * 0.2); });
    await p.waitForTimeout(900);
    const r = await p.evaluate(s => {
      const root = document.querySelector(s);
      const txt = root.innerText.replace(/\s+/g, " ");
      /* Chrome reports these as color(srgb 0.06 0.08 0.07 / 0.05) as often as
         rgb(16, 22, 19). Scraping \d+ out of the float form yields 627451 for
         the green channel and calls ink green, which is how this gate first
         failed three things that were already correct. */
      const rgb = v => {
        if (!v || v === "transparent" || v === "none") return null;
        const n = (v.match(/-?[\d.]+(?:e-?\d+)?/g) || []).map(Number);
        if (n.length < 3) return null;
        const f = v.trim().startsWith("color(");
        const a = n.length > 3 ? n[3] : 1;
        return { r: f ? n[0]*255 : n[0], g: f ? n[1]*255 : n[1], b: f ? n[2]*255 : n[2], a };
      };
      const greens = [];
      for (const el of root.querySelectorAll("*")) {
        const cs = getComputedStyle(el);
        if (+cs.opacity === 0) continue;
        for (const [k, v] of [["bg", cs.backgroundColor], ["bd", cs.borderColor], ["fg", cs.color]]) {
          const c = rgb(v); if (!c || c.a < 0.12) continue;
          if (c.g > c.r + 24 && c.g > c.b + 14 && (c.r + c.g + c.b) > 60)
            greens.push(`${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]} ${k}=${v}`);
        }
      }
      const st = root.querySelector(".gates__st, .sig__agg");
      return { txt, status: st ? st.innerText.replace(/\s+/g," ").trim() : "",
               greens: [...new Set(greens)] };
    }, sel);
    /* Scoped to the line WE write about the sequence. The section also quotes
       CarePro's own wording - "Licence verified against the Nursing Council" -
       which is the product describing its own step and must stay verbatim. */
    const claims = /\bverified\b|\bpassed\b|\bqualified\b|four of four|\blocked\b/i;
    const m = r.status.match(claims);
    if (m) bad(`${label}: our status line claims "${m[0]}" — reads as an observed pass`);
    else note(`${label}: status line makes no verified/passed/qualified claim — "${r.status}"`);
    if (!/described by the product, not measured by us/i.test(r.txt))
      bad(`${label}: attribution missing`);
    else note(`${label}: attribution present`);
    if (r.greens.length) bad(`${label}: green inside the sequence — ${r.greens.slice(0,3).join("; ")}`);
    else note(`${label}: no green anywhere in the sequence`);
  }
  await c.close();
}

/* ── 3 · every route through the operated flow agrees ───────────────────── */
{
  console.log("\n════ FLOW INTERACTION ════");
  for (const [W, H] of [[1440, 900], [390, 844]]) {
    for (const reduced of [false, true]) {
      const c = await b.newContext({ viewport: { width: W, height: H }, colorScheme: "light",
                                     hasTouch: W < 700, isMobile: W < 700,
                                     reducedMotion: reduced ? "reduce" : "no-preference" });
      const p = await c.newPage();
      await p.goto(HOST + "/work/carepro/", { waitUntil: "load" });
      await p.waitForTimeout(2200);
      await p.locator("#flow").scrollIntoViewIfNeeded();
      const state = () => p.evaluate(() => {
        const tabs = [...document.querySelectorAll('#flow [role="tab"]')];
        const t = document.querySelector('#flow [role="tablist"]');
        const i = tabs.findIndex(x => x.getAttribute("aria-selected") === "true");
        return { i, sel: t.style.getPropertyValue("--sel"),
                 tabindex: tabs.map(x => x.tabIndex).join(","),
                 selected: tabs.map(x => x.getAttribute("aria-selected")).join(","),
                 panels: tabs.map(x => document.getElementById(x.getAttribute("aria-controls")).hidden).join(","),
                 metas: [0,1,2,3].map(k => document.getElementById("fm"+k).hidden).join(","),
                 bar: document.getElementById("flow-bar").style.width,
                 at: document.getElementById("flow-at").textContent,
                 prevDis: document.getElementById("flow-prev").disabled,
                 nextTxt: document.getElementById("flow-next").textContent.trim(),
                 dir: document.getElementById("flow").getAttribute("data-dir"),
                 focus: document.activeElement.id };
      });
      const check = async (route, wantI, wantDir) => {
        await p.waitForTimeout(reduced ? 60 : 420);
        const s = await state();
        const bad2 = [];
        if (s.i !== wantI) bad2.push(`selected ${s.i} want ${wantI}`);
        if (+s.sel !== wantI) bad2.push(`--sel ${s.sel}`);
        if (s.selected !== [0,1,2,3].map(k => k === wantI ? "true" : "false").join(",")) bad2.push(`aria ${s.selected}`);
        if (s.tabindex !== [0,1,2,3].map(k => k === wantI ? 0 : -1).join(",")) bad2.push(`tabindex ${s.tabindex}`);
        if (s.panels !== [0,1,2,3].map(k => k !== wantI).join(",")) bad2.push(`panels ${s.panels}`);
        if (s.metas !== [0,1,2,3].map(k => k !== wantI).join(",")) bad2.push(`metas ${s.metas}`);
        if (s.bar !== ((wantI + 1) / 4 * 100) + "%") bad2.push(`bar ${s.bar}`);
        if (s.at !== String(wantI + 1)) bad2.push(`counter ${s.at}`);
        if (s.prevDis !== (wantI === 0)) bad2.push(`prev disabled ${s.prevDis}`);
        if (s.nextTxt !== (wantI === 3 ? "Start again" : "Next stage")) bad2.push(`next "${s.nextTxt}"`);
        if (wantDir && s.dir !== wantDir) bad2.push(`dir ${s.dir} want ${wantDir}`);
        if (bad2.length) bad(`${W}x${H}${reduced ? " reduced" : ""} ${route}: ` + bad2.join(", "));
        return bad2.length === 0;
      };
      let okAll = true;
      await p.click("#fs2");                    okAll &= await check("click 3", 2, "fwd");
      await p.click("#flow-prev");              okAll &= await check("Back", 1, "back");
      await p.click("#flow-next");              okAll &= await check("Next", 2, "fwd");
      await p.locator("#fs2").focus();
      await p.keyboard.press("ArrowRight");     okAll &= await check("ArrowRight", 3, "fwd");
      await p.keyboard.press("ArrowLeft");      okAll &= await check("ArrowLeft", 2, "back");
      await p.keyboard.press("ArrowDown");      okAll &= await check("ArrowDown", 3, "fwd");
      await p.keyboard.press("ArrowUp");        okAll &= await check("ArrowUp", 2, "back");
      await p.keyboard.press("Home");           okAll &= await check("Home", 0, "back");
      await p.keyboard.press("End");            okAll &= await check("End", 3, "fwd");
      await p.click("#flow-next");              okAll &= await check("Next wraps", 0, "back");
      const f = await p.evaluate(() => document.activeElement.id);
      if (!/^fs\d$/.test(f) && f !== "flow-next") bad(`${W}x${H} focus left the component: ${f}`);
      if (okAll) note(`${W}x${H}${reduced ? " reduced motion" : ""}: all 10 routes agree on every field`);
      await c.close();
    }
  }
}
await b.close();
console.log(fail.length ? `\nSEMANTIC: ${fail.length} failure(s)` : "\nSEMANTIC: 0 truth-copy contradictions, 0 interaction disagreements");

/* EXIT CONTRACT — 0 assertions passed · 1 assertions failed · 2 setup or
   infrastructure error. This gate previously printed its failures and then
   fell off the end of the file, which exits 0: in CI it could report a
   defect and still be read as a pass. Proven by execution, not by reading. */
process.exit(fail.length ? 1 : 0);
