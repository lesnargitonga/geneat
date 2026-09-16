import { chromium } from 'playwright';
/* What each interaction model costs the reader who is only reading. */
const br = await chromium.launch();
for (const [tag, vp] of [['desktop 1440x900',{width:1440,height:900}], ['phone 390x844',{width:390,height:844}]]) {
  for (const [model, file] of [['A discrete','index.html'], ['B scroll','model-b.html']]) {
    const ctx = await br.newContext({ viewport: vp });
    const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:8781/' + file, { waitUntil:'networkidle' });
    const m = await p.evaluate(() => {
      const beats = [...document.querySelectorAll('section')];
      const reg = beats.find(s => /register/i.test(s.textContent));
      return { doc: document.documentElement.scrollHeight,
               sec: (document.querySelector('.track') || document.querySelector('.op')).getBoundingClientRect().height,
               next: Math.round(reg.getBoundingClientRect().top + window.scrollY) };
    });
    console.log(`${tag.padEnd(16)} ${model.padEnd(11)} page ${String(Math.round(m.doc)).padStart(6)}px  ·  sequence ${String(Math.round(m.sec)).padStart(5)}px (${(m.sec/vp.height).toFixed(1)} screens)  ·  next beat at y=${m.next}`);
    await ctx.close();
  }
}
/* how many ownership changes a reader is shown who never asked to step */
{
  const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8781/model-b.html', { waitUntil:'networkidle' });
  const track = await p.locator('.track').boundingBox();
  const seen = await p.evaluate(async (a) => {
    const [top, vh] = a; const out = [];
    for (let s = 0; s <= vh * 7; s += vh / 6) {
      window.scrollTo(0, top + s);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      out.push([...document.querySelectorAll('.step[data-own="held"] b')].map(b => b.textContent).join('+') || '—');
    }
    return out;
  }, [track.y, 900]);
  console.log('B · ownership changes forced on a reader scrolling past once:',
    seen.filter((v,i)=>i && v!==seen[i-1]).length);
  console.log('B · holder seen per 1/6 screen of scroll:', seen.join(' | '));
  await ctx.close();
}
await br.close();
