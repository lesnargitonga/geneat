/* LESNAR AI site — performance measurement.
     node tools/perf.mjs                      cold cache, no throttle
     THROTTLE=4g node tools/perf.mjs          cold cache, throttled
     ROUTES=/,/work/ node tools/perf.mjs
   Serve first: python3 -m http.server 8911 --bind 127.0.0.1 (from this dir)

   Every run uses a fresh browser context, so the cache is genuinely cold.
   LCP and FCP come from PerformanceObserver with buffered:true installed
   before navigation — reading getEntriesByType afterwards misses them, which
   is how an earlier run reported LCP as "-" and called it measured. */
import * as pw from '/home/lesnar/Documents/ai model/experience-lab/study-b-webgl/node_modules/playwright/index.mjs';

const BASE='http://127.0.0.1:8911';
const ROUTES=(process.env.ROUTES||'/,/work/,/work/carepro/,/capabilities/,/start/').split(',');
const VIEWPORTS=[[1440,900,'desktop'],[1024,900,'laptop'],[390,844,'phone']];
const PROFILES={
  none:null,
  '4g':{downloadThroughput:9*1024*1024/8, uploadThroughput:1.5*1024*1024/8, latency:60},
  '3g':{downloadThroughput:1.6*1024*1024/8, uploadThroughput:750*1024/8,     latency:150},
};
const THROTTLE=process.env.THROTTLE||'none';
if(!(THROTTLE in PROFILES)){ console.error('THROTTLE must be one of',Object.keys(PROFILES).join(', ')); process.exit(2); }

const OBSERVE=()=>{
  window.__perf={lcp:0,fcp:0,cls:0};
  try{ new PerformanceObserver(l=>{ for(const e of l.getEntries()) window.__perf.lcp=e.startTime; })
    .observe({type:'largest-contentful-paint',buffered:true}); }catch(e){}
  try{ new PerformanceObserver(l=>{ for(const e of l.getEntries())
      if(e.name==='first-contentful-paint') window.__perf.fcp=e.startTime; })
    .observe({type:'paint',buffered:true}); }catch(e){}
  try{ new PerformanceObserver(l=>{ for(const e of l.getEntries())
      if(!e.hadRecentInput) window.__perf.cls+=e.value; })
    .observe({type:'layout-shift',buffered:true}); }catch(e){}
};

const kb=n=>(n/1024).toFixed(0);
const br=await pw.chromium.launch();
const rows=[];

for(const route of ROUTES){
  for(const [w,h,label] of VIEWPORTS){
    const ctx=await br.newContext({viewport:{width:w,height:h},bypassCSP:false});
    const page=await ctx.newPage();
    if(PROFILES[THROTTLE]){
      const cdp=await ctx.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions',{offline:false,...PROFILES[THROTTLE]});
    }
    const by={image:0,stylesheet:0,script:0,font:0,document:0,other:0};
    let reqs=0, total=0;
    page.on('response',async res=>{
      reqs++;
      const t=res.request().resourceType();
      const k=(t in by)?t:'other';
      let n=0;
      try{ n=(await res.body()).length }catch{}
      by[k]+=n; total+=n;
    });
    await page.addInitScript(OBSERVE);
    await page.goto(BASE+route,{waitUntil:'load'});
    await page.evaluate(()=>document.fonts.ready).catch(()=>{});
    /* LCP is a property of the initial viewport before the reader acts.
       Scrolling first lets a later image become the largest candidate, which
       inflates it — so LCP is taken at rest, and the scroll that follows is
       only for byte accounting. */
    await page.waitForTimeout(2200);
    const lcpAtRest=await page.evaluate(()=>window.__perf.lcp);
    await page.evaluate(async()=>{ const H=document.body.scrollHeight;
      for(let y=0;y<H;y+=600){ scrollTo(0,y); await new Promise(r=>setTimeout(r,60)); } scrollTo(0,0); });
    await page.waitForTimeout(900);
    const m=await page.evaluate(()=>{
      const nav=performance.getEntriesByType('navigation')[0]||{};
      return {...window.__perf,
        ttfb: nav.responseStart||0,
        domcl: nav.domContentLoadedEventEnd||0,
        load: nav.loadEventEnd||0};
    });
    rows.push({route,label,w,...m,lcp:lcpAtRest,total,reqs,by});
    await ctx.close();
  }
}
await br.close();

const ms=v=>v?Math.round(v)+'ms':'—';
console.log(`performance · cold cache · throttle=${THROTTLE}\n`);
console.log('route                 view      TTFB     FCP     LCP     CLS    bytes   img   css    js  font  reqs');
for(const r of rows){
  console.log(
    `${r.route.padEnd(20)} ${r.label.padEnd(8)}`+
    `${ms(r.ttfb).padStart(7)}${ms(r.fcp).padStart(8)}${ms(r.lcp).padStart(8)}`+
    `${r.cls.toFixed(4).padStart(8)}`+
    `${(kb(r.total)+'k').padStart(9)}${(kb(r.by.image)+'k').padStart(6)}`+
    `${(kb(r.by.stylesheet)+'k').padStart(6)}${(kb(r.by.script)+'k').padStart(6)}`+
    `${(kb(r.by.font)+'k').padStart(6)}${String(r.reqs).padStart(6)}`);
}
const worstLcp=Math.max(...rows.map(r=>r.lcp));
const worstCls=Math.max(...rows.map(r=>r.cls));
const unmeasured=rows.filter(r=>!r.lcp).length;
console.log(`\nworst LCP ${ms(worstLcp)}  ·  worst CLS ${worstCls.toFixed(4)}`);
if(unmeasured) console.log(`WARNING: LCP not captured on ${unmeasured} run(s) — do not report those as measured`);
console.log(worstLcp&&worstLcp<2000?'LCP under 2s on every route measured':'');
