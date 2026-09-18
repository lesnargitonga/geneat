/* LESNAR AI site — runtime gate. Every route, in a real browser.
     node tools/gate.mjs                    chromium, all routes
     ENGINE=firefox|webkit node tools/gate.mjs
     ROUTES=/,/work/ node tools/gate.mjs    limit the sweep
   Serve first: python3 -m http.server 8911 --bind 127.0.0.1  (from this dir)
   Exits non-zero on any failure. */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import crypto from 'node:crypto'; import { URL as NodeURL } from 'node:url';
import * as pw from '/home/lesnar/Documents/ai model/experience-lab/study-b-webgl/node_modules/playwright/index.mjs';

const ROOT=path.resolve(import.meta.dirname,'..');
const BASE='http://127.0.0.1:8911';
const ENGINE=process.env.ENGINE||'chromium';
if(!pw[ENGINE]){ console.error(`unknown engine "${ENGINE}"`); process.exit(2); }

const AXE=(()=>{ for(const p of [path.join(ROOT,'node_modules/axe-core/axe.min.js')])
  if(fs.existsSync(p)) return fs.readFileSync(p,'utf8'); return null; })();

const allRoutes=(()=>{ const out=[];
  (function walk(d){ for(const e of fs.readdirSync(d,{withFileTypes:true})){
    if(e.name==='node_modules'||e.name.startsWith('.')||e.name==='tools') continue;
    const f=path.join(d,e.name);
    if(e.isDirectory()) walk(f);
    else if(e.name.endsWith('.html')&&e.name!=='home-candidate.html'){
      const r='/'+path.relative(ROOT,f).replace(/\\/g,'/');
      out.push(r.replace(/\/index\.html$/,'/').replace(/^\/index\.html$/,'/')); } } })(ROOT);
  return [...new Set(out)].sort(); })();
const ROUTES=process.env.ROUTES?process.env.ROUTES.split(','):allRoutes;

/* WebKit's network process cannot reach loopback in this sandbox although it
   renders correctly, so disk mode serves the tree through the route layer and
   fulfils webfonts from a node-populated cache. Fallback font metrics would
   make the overflow gate meaningless. */
const DISK=process.env.SERVE==='disk'||ENGINE==='webkit';
const FONTDIR=path.join(os.tmpdir(),'lesnar-fontcache-site');
const MIME={'.html':'text/html','.json':'application/json','.css':'text/css','.js':'text/javascript',
  '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.avif':'image/avif',
  '.svg':'image/svg+xml','.woff2':'font/woff2','.xml':'application/xml','.txt':'text/plain'};
async function cacheFonts(){
  fs.mkdirSync(FONTDIR,{recursive:true});
  const idx=path.join(FONTDIR,'index.json');
  if(fs.existsSync(idx)) return JSON.parse(fs.readFileSync(idx,'utf8'));
  const UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
  const href=fs.readFileSync(path.join(ROOT,'index.html'),'utf8')
    .match(/href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/)?.[1];
  if(!href) return null;
  const map={}, css=await (await fetch(href.replace(/&amp;/g,'&'),{headers:{'User-Agent':UA}})).text();
  map[href.replace(/&amp;/g,'&')]={file:'sheet.css',type:'text/css'};
  fs.writeFileSync(path.join(FONTDIR,'sheet.css'),css);
  for(const u of [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map(m=>m[1]))]){
    const name=crypto.createHash('sha1').update(u).digest('hex').slice(0,16)+path.extname(new NodeURL(u).pathname);
    fs.writeFileSync(path.join(FONTDIR,name),Buffer.from(await (await fetch(u,{headers:{'User-Agent':UA}})).arrayBuffer()));
    map[u]={file:name,type:MIME[path.extname(name)]||'font/woff2'};
  }
  fs.writeFileSync(idx,JSON.stringify(map)); return map;
}
const FONTS=DISK?await cacheFonts().catch(e=>{console.error('font cache failed:',e.message);return null}):null;

/* contrast: parses rgb(), rgba() and color(srgb r g b / a), composites every
   translucent ancestor, walks ancestor opacity, and samples EVERY element that
   carries its own text rather than an allowlist of tags. */
const CONTRAST=()=>{
  const bad=[];
  const parse=c=>{ if(!c) return null;
    const s=c.match(/color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?/i);
    if(s) return {r:+s[1]*255,g:+s[2]*255,b:+s[3]*255,a:s[4]===undefined?1:+s[4]};
    const m=c.match(/rgba?\(([^)]+)\)/i); if(!m) return null;
    const v=m[1].split(/[,\s\/]+/).filter(Boolean).map(Number);
    if(v.length<3||v.some(isNaN)) return null;
    return {r:v[0],g:v[1],b:v[2],a:v[3]===undefined?1:v[3]}; };
  const over=(f,k)=>({r:f.r*f.a+k.r*(1-f.a),g:f.g*f.a+k.g*(1-f.a),b:f.b*f.a+k.b*(1-f.a),a:1});
  const lum=o=>{const[r,g,bl]=[o.r,o.g,o.b].map(v=>{v=Math.min(255,Math.max(0,v))/255;
    return v<=.03928?v/12.92:((v+.055)/1.055)**2.4}); return .2126*r+.7152*g+.0722*bl};
  const ground=el=>{ const stack=[]; let n=el;
    while(n){ const c=parse(getComputedStyle(n).backgroundColor);
      if(c&&c.a>0){ stack.push(c); if(c.a>=1) break; } n=n.parentElement; }
    let base={r:255,g:255,b:255,a:1};
    for(let i=stack.length-1;i>=0;i--) base=over(stack[i],base);
    return base; };
  document.querySelectorAll('body *').forEach(el=>{
    const own=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
    if(!own||el.offsetParent===null) return;
    let vis=true,a=el;
    while(a&&a!==document.body){ if(+getComputedStyle(a).opacity<.2){vis=false;break} a=a.parentElement; }
    if(!vis) return;
    const cs=getComputedStyle(el), fg=parse(cs.color); if(!fg) return;
    const bgc=ground(el);
    const f=lum(fg.a<1?over(fg,bgc):fg), k=lum(bgc);
    const r=(Math.max(f,k)+.05)/(Math.min(f,k)+.05);
    const size=parseFloat(cs.fontSize), bold=+cs.fontWeight>=600;
    const need=(size>=24||(size>=18.66&&bold))?3:4.5;
    if(r<need) bad.push({t:el.textContent.trim().slice(0,30),r:+r.toFixed(2),size:Math.round(size)});
  });
  return bad.slice(0,6);
};
const OVERFLOW=()=>{ const lim=document.documentElement.clientWidth+1,bad=[];
  document.querySelectorAll('body *').forEach(el=>{ const r=el.getBoundingClientRect();
    if(r.width>0&&(r.right>lim+8||r.left<-8)) bad.push(el.tagName+'.'+String(el.className).slice(0,20)); });
  return [...new Set(bad)].slice(0,5); };

const b=await pw[ENGINE].launch();
async function serveFromDisk(p){ await p.route('**/*', route=>{
  const url=route.request().url(), u=new NodeURL(url);
  if(FONTS&&FONTS[url]) return route.fulfill({status:200,body:fs.readFileSync(path.join(FONTDIR,FONTS[url].file)),
    headers:{'content-type':FONTS[url].type,'access-control-allow-origin':'*'}});
  if(u.hostname!=='127.0.0.1'&&u.hostname!=='localhost') return route.abort();
  let fp=path.join(ROOT,decodeURIComponent(u.pathname).replace(/^\/+/,''));
  try{ if(fs.statSync(fp).isDirectory()) fp=path.join(fp,'index.html'); }catch{}
  try{ return route.fulfill({status:200,body:fs.readFileSync(fp),
    headers:{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}}); }
  catch{ return route.fulfill({status:404,body:''}); } }); }

let FAIL=0;
async function check(route,w,h,theme){
  const p=await b.newPage({viewport:{width:w,height:h}});
  const errs=[];
  const artifact=t=>DISK&&/Failed to preconnect to https:\/\/fonts\.(googleapis|gstatic)\.com/.test(t);
  p.on('console',m=>{ if(m.type()==='error'&&!artifact(m.text())) errs.push(m.text()); });
  p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
  if(DISK) await serveFromDisk(p);
  if(theme) await p.addInitScript(t=>{try{localStorage.setItem('lesnarai-theme',t)}catch(e){}},theme);
  await p.goto(BASE+route,{waitUntil:DISK?'domcontentloaded':'networkidle'});
  await p.evaluate(()=>document.fonts.ready).catch(()=>{});
  await p.waitForTimeout(700);
  await p.evaluate(async()=>{ const H=document.body.scrollHeight;
    for(let y=0;y<H;y+=420){scrollTo(0,y);await new Promise(r=>setTimeout(r,25));} scrollTo(0,0); });
  await p.waitForTimeout(400);
  const overflow=await p.evaluate(OVERFLOW);
  const contrast=await p.evaluate(CONTRAST);
  const media=await p.evaluate(()=>({
    broken:[...document.images].filter(i=>!i.complete||i.naturalWidth===0).length,
    noalt:[...document.images].filter(i=>!i.hasAttribute('alt')).length,
    emptyLinks:[...document.querySelectorAll('a')].filter(a=>!a.textContent.trim()&&!a.getAttribute('aria-label')).length }));
  let axeN=0, axeIds='';
  if(AXE){ await p.addScriptTag({content:AXE});
    const r=await p.evaluate(async()=>await axe.run(document,{runOnly:{type:'tag',
      values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}}));
    axeN=r.violations.length; axeIds=r.violations.map(v=>`${v.id}(${v.nodes.length})`).join(' '); }
  const bad=errs.length||overflow.length||contrast.length||media.broken||media.noalt||media.emptyLinks||axeN;
  if(bad) FAIL++;
  const tag=`${route} ${w}x${h} ${theme||'system'}`;
  console.log(`${bad?'FAIL':'ok  '} ${tag.padEnd(44)} err:${errs.length} ovf:${overflow.length} con:${contrast.length} img:${media.broken}/${media.noalt} axe:${axeN}`);
  if(errs.length)     console.log('       errors:  '+JSON.stringify(errs.slice(0,2)));
  if(overflow.length) console.log('       overflow:'+JSON.stringify(overflow));
  if(contrast.length) console.log('       contrast:'+JSON.stringify(contrast));
  if(media.emptyLinks)console.log('       links with no accessible name: '+media.emptyLinks);
  if(axeN)            console.log('       axe:     '+axeIds);
  await p.close();
}

console.log(`runtime gate · ${ENGINE}${DISK?' (disk)':''} · ${ROUTES.length} route(s)${AXE?' · axe':' · axe UNAVAILABLE'}\n`);
for(const r of ROUTES){ await check(r,1440,900,null); await check(r,390,844,'light'); }
await b.close();
console.log(FAIL?`\n=== ${FAIL} CHECK(S) FAILED on ${ENGINE} ===`:`\n=== RUNTIME GATE PASSES on ${ENGINE} ===`);
process.exit(FAIL?1:0);
