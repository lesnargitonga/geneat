import { chromium } from 'playwright';
const br = await chromium.launch();
const ctx = await br.newContext({ viewport:{width:1440,height:900} });
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:8781/index.html', { waitUntil:'networkidle' });
await p.locator('.op').scrollIntoViewIfNeeded();
await p.locator('.ctl button',{hasText: /^Next$/}).click(); await p.waitForTimeout(500);
const s = await p.evaluate(async () => {
  const step=document.querySelectorAll('.step')[0], own=step.querySelector('.own');
  const g=getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number);
  const out=[], t0=performance.now();
  [...document.querySelectorAll('.ctl button')].find(b=>/^Next$/.test(b.textContent)).click();
  while (performance.now()-t0 < 480){
    const m=getComputedStyle(step).backgroundColor.match(/[\d.]+/g).map(Number);
    const a=m.length>3?m[3]:1;
    out.push({t:Math.round(performance.now()-t0), o:+getComputedStyle(own).opacity, w:own.textContent,
              lum:Math.round([0,1,2].map(i=>a*m[i]+(1-a)*g[i]).reduce((x,y)=>x+y)/3)});
    await new Promise(r=>requestAnimationFrame(r));
  }
  return out;
});
const D=140;
console.log('NEW word visible over ink   :', s.filter(x=>x.w==='Has released'&&x.o>0.12&&x.lum<D).length, '(must be 0)');
console.log('OLD word visible over ground:', s.filter(x=>x.w==='Holds it'&&x.o>0.12&&x.lum>D).length, '(must be 0)');
console.log('word hidden            (ms) :', s.find(x=>x.o<=0.12)?.t, '→', s.filter(x=>x.o<=0.12).at(-1)?.t);
console.log('fill crosses mid-grey  (ms) :', s.find(x=>x.lum>D)?.t);
console.log('fill reaches ground    (ms) :', s.find(x=>x.lum>=175)?.t);
console.log('new word returns       (ms) :', s.find(x=>x.w==='Has released'&&x.o>0.12)?.t);
await br.close();
