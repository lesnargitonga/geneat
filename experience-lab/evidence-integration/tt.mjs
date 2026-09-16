import { chromium } from 'playwright';
const br=await chromium.launch();
const ctx=await br.newContext({viewport:{width:1440,height:900}});
const p=await ctx.newPage();
await p.goto('http://127.0.0.1:8783/index.html',{waitUntil:'networkidle'});
const btns=await p.locator('.site-nav .theme button').allTextContents();
console.log('control present:', btns.join(' / '));
for (const want of ['Dark','Light','System']){
  await p.locator('.site-nav .theme button',{hasText:new RegExp('^'+want+'$')}).click();
  await p.waitForTimeout(250);
  const r=await p.evaluate(()=>({attr:document.documentElement.getAttribute('data-theme'),
    page:getComputedStyle(document.documentElement).getPropertyValue('--page').trim(),
    cs:getComputedStyle(document.documentElement).colorScheme,
    stored:localStorage.getItem('lesnarai-theme')}));
  console.log(`  ${want.padEnd(7)} → data-theme=${String(r.attr).padEnd(6)} --page ${r.page} color-scheme:${r.cs.padEnd(11)} stored=${r.stored}`);
}
// persistence across navigation
await p.locator('.site-nav .theme button',{hasText:/^Dark$/}).click(); await p.waitForTimeout(200);
await p.goto('http://127.0.0.1:8783/work.html',{waitUntil:'networkidle'});
const after=await p.evaluate(()=>({attr:document.documentElement.getAttribute('data-theme'),
  pressed:[...document.querySelectorAll('.site-nav .theme button')].find(b=>b.getAttribute('aria-pressed')==='true')?.textContent}));
console.log('after navigating to /work:', JSON.stringify(after));
await br.close();
