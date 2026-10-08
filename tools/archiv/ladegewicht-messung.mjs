// Startmessung der Live-Seite, gedrosseltes Handy (Rezept: docs/wissen/datensatz.md, 08.10.2026). Aufruf: node tools/archiv/ladegewicht-messung.mjs
import { chromium } from 'playwright';
const b=await chromium.launch(); const runs=[];
for(let i=0;i<5;i++){
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,serviceWorkers:'block'});
  const p=await ctx.newPage(); const cdp=await ctx.newCDPSession(p);
  await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1.6*1024*1024/8,uploadThroughput:750*1024/8});
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  const reqs=new Map(); let t0=null;
  cdp.on('Network.requestWillBeSent',e=>{ if(t0===null) t0=e.timestamp; });
  cdp.on('Network.responseReceived',e=>reqs.set(e.requestId,{url:e.response.url,type:e.type}));
  cdp.on('Network.loadingFinished',e=>{const r=reqs.get(e.requestId); if(r){r.bytes=e.encodedDataLength; r.t=(e.timestamp-t0)*1000}});
  await p.addInitScript(()=>{
    const m=window.__m={lcp:0,lcpEl:'',tbt:0,fcp:0,card:null,cardImg:null,cls:0};
    new PerformanceObserver(l=>{for(const e of l.getEntries()){m.lcp=e.startTime;m.lcpEl=(e.element?e.element.tagName+':'+(e.url||e.element.textContent||'').slice(-40):'')}}).observe({type:'largest-contentful-paint',buffered:true});
    new PerformanceObserver(l=>{for(const e of l.getEntries()) if(e.duration>50) m.tbt+=e.duration-50}).observe({type:'longtask',buffered:true});
    new PerformanceObserver(l=>{for(const e of l.getEntries()) if(!e.hadRecentInput) m.cls+=e.value}).observe({type:'layout-shift',buffered:true});
    new PerformanceObserver(l=>{for(const e of l.getEntries()) if(e.name==='first-contentful-paint') m.fcp=e.startTime}).observe({type:'paint',buffered:true});
    const chk=()=>{ if(!m.card){const a=[...document.querySelectorAll('article')].find(e=>{const r=e.getBoundingClientRect();return r.top<844&&r.bottom>0&&r.height>100&&/Details zu/.test(e.textContent)}); if(a) m.card=performance.now();}
      if(m.card&&!m.cardImg){const im=[...document.querySelectorAll('article img')].find(e=>{const r=e.getBoundingClientRect();return r.top<844&&r.bottom>0&&e.complete&&e.naturalWidth>0}); if(im) m.cardImg=performance.now();}
      if(!m.cardImg) requestAnimationFrame(chk)}; requestAnimationFrame(chk);
  });
  await p.goto('https://anime-kalender.de/',{waitUntil:'commit'});
  await p.waitForLoadState('networkidle',{timeout:120000}).catch(()=>{}); await p.waitForTimeout(2000);
  const m=await p.evaluate(()=>window.__m);
  const list=[...reqs.values()].filter(r=>r.bytes!=null);
  const noimg=list.filter(r=>r.type!=='Image'); const lastNo=Math.max(...noimg.map(r=>r.t));
  const imgsBefore=list.filter(r=>r.type==='Image'&&r.t<=m.cardImg);
  runs.push({m,lastNo,noimg:noimg.reduce((s,r)=>s+r.bytes,0),imgs:list.filter(r=>r.type==='Image').length,imgB:list.filter(r=>r.type==='Image').reduce((s,r)=>s+r.bytes,0),imgsBeforeB:imgsBefore.reduce((s,r)=>s+r.bytes,0),imgsBeforeN:imgsBefore.length});
  await ctx.close();
}
await b.close();
for(const r of runs) console.log(JSON.stringify({fcp:Math.round(r.m.fcp),card:Math.round(r.m.card),cardImg:Math.round(r.m.cardImg),lcp:Math.round(r.m.lcp),lcpEl:r.m.lcpEl,tbt:Math.round(r.m.tbt),cls:+r.m.cls.toFixed(3),lastNonImgDone:Math.round(r.lastNo),nonImgB:r.noimg,imgN:r.imgs,imgB:r.imgB,imgBeforeCardImg:[r.imgsBeforeN,r.imgsBeforeB]}));
