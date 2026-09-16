import { chromium } from 'playwright';
/* READ-ONLY capture of public operating surfaces. Nothing is submitted. */
const br=await chromium.launch();
const T=[
 ['biz-venue','https://bizmtaani.com/venues/villager'],
 ['biz-venues','https://bizmtaani.com/venues'],
 ['jamii-projects','https://jamii.lesnarai.co.ke/community-projects'],
 ['jamii-gov','https://jamii.lesnarai.co.ke/governance'],
 ['geneat-cafe','https://geneat.lesnarai.co.ke/cafes/lily-pond-cafe'],
 ['geneat-map','https://geneat.lesnarai.co.ke/map'],
 ['hazina-edit','https://hazina.lesnarai.co.ke/collections/kenya-edit'],
 ['hazina-cols','https://hazina.lesnarai.co.ke/collections'],
 ['carepro-home','https://carepro.co.ke/'],
];
for (const [id,url] of T){
  const ctx=await br.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:2});
  const p=await ctx.newPage();
  try{ await p.goto(url,{waitUntil:'networkidle',timeout:45000}); }catch(e){ console.log(id.padEnd(16),'FAILED'); await ctx.close(); continue; }
  await p.waitForTimeout(2200);
  await p.screenshot({path:`material/${id}.png`});
  const t=await p.evaluate(()=>({title:document.title,
    h1:(document.querySelector('h1')||{}).textContent||'',
    txt:document.body.innerText.replace(/\s+/g,' ').slice(0,110)}));
  console.log(`${id.padEnd(16)} "${t.h1.trim().slice(0,38)}" · ${t.txt.slice(0,66)}`);
  await ctx.close();
}
await br.close();
