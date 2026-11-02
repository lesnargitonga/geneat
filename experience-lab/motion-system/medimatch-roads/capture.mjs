// Frame-exact capture of the running MediMatch app on a virtual clock.
// JS time (Date, performance, timers, rAF) runs on Playwright's clock; CSS animations
// and transitions are paused and seeked to the same virtual time every frame.
// usage: node capture.mjs <outdir> <W> <H> <fps> <seconds> [every] [actions.json]
import * as pw from '/home/lesnar/Documents/ai model/experience-lab/study-b-webgl/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const [out, W, H, FPS, SECS, EVERY='1', ACT] = process.argv.slice(2);
const fps=+FPS, frame=1000/fps, total=Math.round(+SECS*fps), every=+EVERY;
const actions = ACT ? JSON.parse(fs.readFileSync(ACT,'utf8')) : [];   // [{t:13.0, click:'selector'|[x,y], label}]
fs.mkdirSync(out,{recursive:true});
const b=await pw.chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--hide-scrollbars']});
const ctx=await b.newContext({viewport:{width:+W,height:+H},deviceScaleFactor:+(process.env.DPR||1),hasTouch:!!process.env.TOUCH,isMobile:!!process.env.TOUCH});
const p=await ctx.newPage();
let inflight=0; p.on('request',()=>inflight++); p.on('requestfinished',()=>inflight--); p.on('requestfailed',()=>inflight--);
p.on('pageerror',e=>console.log('pageerror',e.message.slice(0,200)));
const T0=new Date('2026-11-01T09:00:00+03:00').getTime();
await p.clock.install({time:T0});
await p.clock.pauseAt(T0+1000);   // time is held from here; only runFor moves it
await p.addInitScript(()=>{
  const seen=new WeakMap();
  window.__seek=(vnow)=>{ for(const a of document.getAnimations()){ let s=seen.get(a); if(s===undefined){s=vnow;seen.set(a,s);} if(a.playState!=='paused')a.pause(); a.currentTime=Math.max(0,vnow-s);} };
  window.__tap=(x,y)=>{ const d=document.createElement('div'); d.className='__tap'; d.style.cssText=`position:fixed;left:${x-22}px;top:${y-22}px;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.35);box-shadow:0 0 0 2px rgba(255,255,255,.85);z-index:2147483647;pointer-events:none;animation:__tapA .6s ease-out forwards`; document.body.appendChild(d); };
  const st=document.createElement('style'); st.textContent='@keyframes __tapA{0%{transform:scale(.6);opacity:1}70%{opacity:.9}100%{transform:scale(1.25);opacity:0}}';
  document.addEventListener('DOMContentLoaded',()=>document.head.appendChild(st));
});
const idle=async(cap=4000)=>{const t=Date.now(); while(inflight>0 && Date.now()-t<cap) await p.waitForTimeout(25);};
await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
await idle(15000); await p.waitForTimeout(400);
let vnow=0, ai=0;
for(let i=0;i<total;i++){
  const target=(i)*frame;
  while(ai<actions.length && actions[ai].t*1000<=target){
    const a=actions[ai++]; let x,y;
    if(Array.isArray(a.click)){[x,y]=a.click;} else { const bb=await p.locator(a.click).first().boundingBox(); if(!bb){console.log('missing',a.click);continue;} x=bb.x+bb.width/2; y=bb.y+bb.height/2; }
    if(a.tap!==false) await p.evaluate(([x,y])=>window.__tap(x,y),[x,y]);
    await p.mouse.click(x,y); console.log('action',a.label||a.click,'at',(target/1000).toFixed(2));
    await p.waitForTimeout(60);
  }
  const step=target-vnow;
  if(step>0){ const a=Math.min(step,25); await p.clock.runFor(a); await idle(); await p.waitForTimeout(90); await p.clock.runFor(step-a); vnow=target; await p.waitForTimeout(30); }
  await p.evaluate(v=>window.__seek(v),vnow);
  if(i%every===0) await p.screenshot({path:`${out}/f${String(i).padStart(4,'0')}.png`});
  if(i%48===0) console.log('frame',i,'/',total);
}
await b.close();
