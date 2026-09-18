/* LESNAR AI homepage — release gate.
   node tools/audit.mjs [screenshot-dir]        (ENGINE=webkit|firefox|chromium)
   Serve first:  python3 -m http.server 8910 --bind 127.0.0.1   (from creative-reset/)
   Exits non-zero if any gate fails. */
import * as pw from '/home/lesnar/Documents/ai model/experience-lab/study-b-webgl/node_modules/playwright/index.mjs';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import crypto from 'node:crypto';
import { URL as NodeURL } from 'node:url';  /* the page URL constant below shadows the global */

const OUT=process.argv[2]||null, URL='http://127.0.0.1:8910/final2/';
const ENGINE=process.env.ENGINE||'chromium';
if(!pw[ENGINE]) { console.error(`unknown engine "${ENGINE}" — use chromium, firefox or webkit`); process.exit(2); }
const b=await pw[ENGINE].launch();
let FAIL=0;

/* contrast: parses rgb(), rgba() and color(srgb r g b / a), and composites
   every translucent ancestor background down to an opaque colour before
   measuring. color-mix() serialises in the 0-1 srgb form; reading those as
   0-255 reports a light nav as near-black. */
const CONTRAST=()=>{
  const bad=[];
  const parse=c=>{
    if(!c) return null;
    const s=c.match(/color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?/i);
    if(s) return {r:+s[1]*255,g:+s[2]*255,b:+s[3]*255,a:s[4]===undefined?1:+s[4]};
    const m=c.match(/rgba?\(([^)]+)\)/i); if(!m) return null;
    const v=m[1].split(/[,\s\/]+/).filter(Boolean).map(Number);
    if(v.length<3||v.some(isNaN)) return null;
    return {r:v[0],g:v[1],b:v[2],a:v[3]===undefined?1:v[3]};
  };
  const over=(f,k)=>({r:f.r*f.a+k.r*(1-f.a),g:f.g*f.a+k.g*(1-f.a),b:f.b*f.a+k.b*(1-f.a),a:1});
  const lum=o=>{const[r,g,bl]=[o.r,o.g,o.b].map(v=>{v=Math.min(255,Math.max(0,v))/255;
    return v<=.03928?v/12.92:((v+.055)/1.055)**2.4}); return .2126*r+.7152*g+.0722*bl};
  const ground=el=>{
    const stack=[]; let n=el;
    while(n){const c=parse(getComputedStyle(n).backgroundColor);
      if(c&&c.a>0){stack.push(c); if(c.a>=1) break;} n=n.parentElement;}
    let base={r:255,g:255,b:255,a:1};
    for(let i=stack.length-1;i>=0;i--) base=over(stack[i],base);
    return base;
  };
  /* every element carrying its own text, not an allowlist: figcaption sat
     outside the old list and shipped a 4.49:1 caption in the light theme. */
  document.querySelectorAll('body *').forEach(el=>{
    const own=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
    if(!own||el.offsetParent===null) return;
    let vis=true,a=el;   /* an ancestor at opacity 0 hides this as surely as its own */
    while(a&&a!==document.body){ if(+getComputedStyle(a).opacity<.2){vis=false;break} a=a.parentElement; }
    if(!vis) return;
    const cs=getComputedStyle(el);
    const fg=parse(cs.color); if(!fg) return;
    const bgc=ground(el);
    const f=lum(fg.a<1?over(fg,bgc):fg), k=lum(bgc);
    const r=(Math.max(f,k)+.05)/(Math.min(f,k)+.05);
    const size=parseFloat(cs.fontSize), bold=+cs.fontWeight>=600;
    const need=(size>=24||(size>=18.66&&bold))?3:4.5;
    if(r<need) bad.push({t:el.textContent.trim().slice(0,26),r:+r.toFixed(2),size:Math.round(size)});
  });
  return bad.slice(0,8);
};

/* element bounding boxes, not scrollWidth: body{overflow-x:hidden} hides
   grid blowouts from the document-level check */
const OVERFLOW=()=>{const lim=document.documentElement.clientWidth+1,bad=[];
  document.querySelectorAll('body *').forEach(el=>{const r=el.getBoundingClientRect();
    if(r.width>0&&(r.right>lim+8||r.left<-8))bad.push(el.tagName+'.'+String(el.className).slice(0,22)+':'+Math.round(r.right));});
  return [...new Set(bad)].slice(0,8);};

/* WebKit's network process cannot reach the loopback server in this sandbox,
   though it renders and scripts fine. Serving the site off disk through the
   route layer puts Safari inside the gate instead of leaving it a caveat.
   The webfonts are cached to tmp by node (which does have network) so WebKit
   measures real Newsreader/Inter Tight metrics -- fallback metrics would make
   the overflow gate meaningless, which is exactly the class of bug that got
   through on Firefox. */
const DISK = process.env.SERVE==='disk' || ENGINE==='webkit';
const SITE = path.resolve(import.meta.dirname,'../..');
const FONTDIR = path.join(os.tmpdir(),'lesnar-fontcache');
const MIME={'.html':'text/html','.json':'application/json','.css':'text/css',
  '.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.webp':'image/webp','.avif':'image/avif','.svg':'image/svg+xml','.woff2':'font/woff2'};

async function cacheFonts(){
  fs.mkdirSync(FONTDIR,{recursive:true});
  const idx=path.join(FONTDIR,'index.json');
  if(fs.existsSync(idx)) return JSON.parse(fs.readFileSync(idx,'utf8'));
  const UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 '+
           '(KHTML, like Gecko) Version/17.4 Safari/605.1.15';
  const href=fs.readFileSync(path.join(SITE,'final2/index.html'),'utf8')
    .match(/href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/)?.[1];
  if(!href) return null;
  const map={};
  const css=await (await fetch(href.replace(/&amp;/g,'&'),{headers:{'User-Agent':UA}})).text();
  map[href.replace(/&amp;/g,'&')]={file:'sheet.css',type:'text/css'};
  fs.writeFileSync(path.join(FONTDIR,'sheet.css'),css);
  for(const u of [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map(m=>m[1]))]){
    const name=crypto.createHash('sha1').update(u).digest('hex').slice(0,16)+path.extname(new NodeURL(u).pathname);
    fs.writeFileSync(path.join(FONTDIR,name),Buffer.from(await (await fetch(u,{headers:{'User-Agent':UA}})).arrayBuffer()));
    map[u]={file:name,type:MIME[path.extname(name)]||'font/woff2'};
  }
  fs.writeFileSync(idx,JSON.stringify(map));
  return map;
}
const FONTS = DISK ? await cacheFonts().catch(e=>{console.error('font cache failed:',e.message); return null}) : null;

async function serveFromDisk(p){
  await p.route('**/*', route=>{
    const url=route.request().url(), u=new NodeURL(url);
    if(FONTS && FONTS[url]){
      const f=FONTS[url];
      return route.fulfill({status:200,body:fs.readFileSync(path.join(FONTDIR,f.file)),
        headers:{'content-type':f.type,'access-control-allow-origin':'*'}});
    }
    if(u.hostname!=='127.0.0.1'&&u.hostname!=='localhost') return route.abort();
    let fp=path.join(SITE,decodeURIComponent(u.pathname).replace(/^\/+/,''));
    try{ if(fs.statSync(fp).isDirectory()) fp=path.join(fp,'index.html'); }catch{}
    try{ return route.fulfill({status:200,body:fs.readFileSync(fp),
      headers:{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}}); }
    catch{ return route.fulfill({status:404,body:''}); }
  });
}

async function open(opts){
  const p=await b.newPage(opts);
  if(DISK) await serveFromDisk(p);
  return p;
}

async function run(w,h,tag,opts={}){
  const p=await open({viewport:{width:w,height:h},...opts});
  const errs=[];
  /* preconnect is a connection hint, not a request, so the route layer cannot
     fulfil it and WebKit logs the abort. Narrowly ignored in disk mode only --
     every other console error still fails the gate. */
  const artifact=t=>DISK&&/Failed to preconnect to https:\/\/fonts\.(googleapis|gstatic)\.com/.test(t);
  p.on('console',m=>{if(m.type()==='error'&&!artifact(m.text()))errs.push(m.text())});
  p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
  await p.goto(URL,{waitUntil:DISK?'domcontentloaded':'networkidle'});
  await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(1900);
  if(opts.light){await p.click('#tg'); await p.waitForTimeout(900);}
  await p.evaluate(async()=>{const H=document.body.scrollHeight;
    for(let y=0;y<H;y+=380){scrollTo(0,y);await new Promise(r=>setTimeout(r,40));}});
  await p.waitForTimeout(900);
  /* exercise the instrument so its live states are inside the gate. every run
     is swept, not one index: the HUD is nowrap and its width varies with the
     readout, so a single sample cannot prove it stays inside the viewport. */
  await p.evaluate(()=>{const el=document.getElementById('run-scrub');
    if(!el) return; document.querySelector('.record').scrollIntoView({block:'center'});
    el.value=35; el.dispatchEvent(new Event('input',{bubbles:true}));});
  await p.waitForTimeout(500);
  const hudSweep=await p.evaluate(async()=>{
    const hud=document.getElementById('run-hud');
    if(!hud||typeof Telemetry==='undefined'||!Telemetry.value) return null;
    const lim=document.documentElement.clientWidth; let minL=1e9,maxR=0,wide=0,at=0;
    for(let i=0;i<Telemetry.value.runs.length;i++){
      Scrub.set(i);
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const b=hud.getBoundingClientRect();
      minL=Math.min(minL,b.left); maxR=Math.max(maxR,b.right);
      if(b.width>wide){wide=b.width;at=i;}
    }
    return {minL:Math.round(minL),maxR:Math.round(maxR),lim,
            wide:Math.round(wide),at,bad:minL<-1||maxR>lim+1};
  });
  const overflow=await p.evaluate(OVERFLOW);
  const contrast=await p.evaluate(CONTRAST);
  const hudOn=await p.evaluate(()=>{const h=document.getElementById('run-hud');
    return !!h && h.classList.contains('on');});
  const broken=await p.evaluate(()=>[...document.images].filter(i=>!i.complete||i.naturalWidth===0).length);
  const noalt=await p.evaluate(()=>[...document.images].filter(i=>!i.hasAttribute('alt')).length);
  const hudBad=!!(hudSweep&&hudSweep.bad);
  const bad=errs.length||overflow.length||broken||noalt||contrast.length||hudBad;
  if(bad)FAIL++;
  console.log((bad?'FAIL ':'ok   ')+tag,'errors',errs.length,'overflow',overflow.length,
    'broken',broken,'noalt',noalt,'contrast',contrast.length,'hudActive',hudOn,
    'hudFits',hudSweep?(!hudSweep.bad):'n/a');
  if(hudBad) console.log('       HUD out of bounds: left',hudSweep.minL,'right',hudSweep.maxR,
    'limit',hudSweep.lim,'widest',hudSweep.wide+'px at run',hudSweep.at);
  if(errs.length)     console.log('       errors:',JSON.stringify(errs.slice(0,3)));
  if(overflow.length) console.log('       overflow:',JSON.stringify(overflow));
  if(contrast.length) console.log('       contrast:',JSON.stringify(contrast));
  if(OUT){const marks=await p.evaluate(()=>[...document.querySelectorAll('header,section,footer')]
      .map(s=>Math.round(s.getBoundingClientRect().top+scrollY)));
    for(let i=0;i<marks.length;i++){await p.evaluate(y=>scrollTo(0,y),marks[i]);await p.waitForTimeout(620);
      await p.screenshot({path:`${OUT}/${tag}${String(i).padStart(2,'0')}.png`});}}
  await p.close();
}
await run(1440,900,'D-dark');
await run(390,844,'M-dark');
await run(320,568,'S-dark');
await run(1440,900,'L-light',{light:true});
await run(390,844,'ML-light',{light:true});
await run(320,568,'SL-light',{light:true});

const p=await open({viewport:{width:1440,height:900},reducedMotion:'reduce'});
const rerr=[]; p.on('pageerror',e=>rerr.push(e.message));
await p.goto(URL,{waitUntil:'networkidle'}); await p.waitForTimeout(1200);
const rm=await p.evaluate(()=>({
  hidden:[...document.querySelectorAll('.rv')].filter(e=>+getComputedStyle(e).opacity<.9).length,
  scaled:[...document.querySelectorAll('.rv')].filter(e=>{const t=getComputedStyle(e).transform;return t&&t!=='none'}).length,
  raf:!!window.__rafRunning, live:window.__rafLive|0,
}));
const rmBad=rm.hidden||rm.scaled||rm.raf||rerr.length;
if(rmBad)FAIL++;
console.log((rmBad?'FAIL ':'ok   ')+'reduced-motion','hiddenAtRest',rm.hidden,'transformed',rm.scaled,
  'rafRunning',rm.raf,'rafLive',rm.live,'errors',rerr.length);
console.log('     page height',await p.evaluate(()=>document.body.scrollHeight));
await p.close(); await b.close();
console.log(FAIL?`\n=== ${FAIL} GATE(S) FAILED on ${ENGINE} ===`:`\n=== ALL GATES PASS on ${ENGINE} ===`);
process.exit(FAIL?1:0);
