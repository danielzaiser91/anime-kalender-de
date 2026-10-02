// Messskript aus der Analysesitzung vom 02.10.2026 (docs/wissen/sitzung-2026-10-02-analyse-und-umstellung.md). Einmalig, Pfade zum Scratchpad ggf. anpassen.
const fs=require('fs');
const D='C:/code/ai/anime-kalender-de/public/data/';
const j=f=>JSON.parse(fs.readFileSync(D+f,'utf8'));
const rel=j('releases.json'),ev=j('events.json');
const out=(k,v)=>console.log('\n## '+k+'\n'+(typeof v==='string'?v:JSON.stringify(v)));
const evBy=new Map();for(const e of ev){(evBy.get(e.releaseSlug)||evBy.set(e.releaseSlug,[]).get(e.releaseSlug)).push(e)}
// monotonicity
const nm=[];
for(const [slug,es] of evBy){
  const r=rel.find(x=>x.slug===slug); if(!r||r.platform==='disc')continue;
  const s=es.filter(e=>e.episode!=null).sort((a,b)=>a.episode-b.episode||a.date.localeCompare(b.date));
  for(let i=1;i<s.length;i++){ if(s[i].episode!==s[i-1].episode && s[i].date<s[i-1].date){nm.push([slug,'ep'+s[i-1].episode+'@'+s[i-1].date,'ep'+s[i].episode+'@'+s[i].date]);break}}
}
out('non-monotonic date vs episode',nm.length+' '+JSON.stringify(nm.slice(0,40)));
// dup episode numbers within release
const dup=[];for(const [slug,es] of evBy){const m={};for(const e of es){if(e.episode==null)continue;m[e.episode]=(m[e.episode]||0)+1}const d=Object.entries(m).filter(x=>x[1]>1);if(d.length)dup.push([slug,d.map(x=>x.join('x')).join(',')])}
out('dup episode numbers in release',dup.length+' '+JSON.stringify(dup));
// gaps in episode numbering for weekly
const gaps=[];for(const [slug,es] of evBy){const r=rel.find(x=>x.slug===slug);if(!r||r.releaseType!=='weekly')continue;const n=[...new Set(es.map(e=>e.episode).filter(x=>x!=null))].sort((a,b)=>a-b);if(!n.length)continue;const miss=[];for(let i=n[0];i<n[n.length-1];i++)if(!n.includes(i))miss.push(i);if(miss.length)gaps.push([slug,miss.join(','),r.platform])}
out('gaps in weekly numbering',gaps.length+' '+JSON.stringify(gaps.slice(0,30)));
// weekly spacing anomalies: gap between consecutive episodes not multiple of 7 for crunchyroll >10 days
const sp=[];for(const [slug,es] of evBy){const r=rel.find(x=>x.slug===slug);if(!r||r.releaseType!=='weekly'||r.platform==='tv')continue;const s=es.filter(e=>e.episode!=null).sort((a,b)=>a.episode-b.episode);for(let i=1;i<s.length;i++){const d=(Date.parse(s[i].date)-Date.parse(s[i-1].date))/864e5;if(d>35){sp.push([slug,s[i-1].episode,s[i-1].date,s[i].episode,s[i].date,d]);break}}}
out('weekly with gap >35d between consecutive episodes',sp.length+' '+JSON.stringify(sp.slice(0,30)));
// platformUrl hygiene
const urlBad=rel.filter(r=>r.platformUrl&&!/^https?:\/\//.test(r.platformUrl));out('platformUrl not http',urlBad.length);
const genericUrl=rel.filter(r=>r.platformUrl&&/^https?:\/\/[^/]+\/?$/.test(r.platformUrl));out('platformUrl = bare homepage',genericUrl.length+' '+JSON.stringify(genericUrl.map(r=>[r.slug,r.platformUrl]).slice(0,10)));
const hostMis=[];const hosts={crunchyroll:/crunchyroll\.com/i,netflix:/netflix\.com/i,primevideo:/(primevideo|amazon)\./i,disneyplus:/disneyplus\.com/i,adn:/animationdigitalnetwork/i,rtlplus:/rtl\.de/i};
for(const r of rel){if(r.platformUrl&&hosts[r.platform]&&!hosts[r.platform].test(r.platformUrl))hostMis.push([r.slug,r.platform,r.platformUrl])}
out('platformUrl host != platform',hostMis.length+' '+JSON.stringify(hostMis.slice(0,10)));
// releases w/o platformUrl by platform
out('no platformUrl',rel.filter(r=>!r.platformUrl&&r.platform!=='disc'&&r.platform!=='kino'&&r.platform!=='tv').map(r=>r.platform+':'+r.slug).slice(0,20));
// source URLs: http not https, duplicates, non-urls
let bad=0,http=0;const hostsC={};for(const r of rel)for(const s of r.sources){if(!/^https?:\/\//.test(s))bad++;if(/^http:/.test(s))http++;try{const h=new URL(s).hostname.replace(/^www\./,'');hostsC[h]=(hostsC[h]||0)+1}catch{bad++}}
out('sources',{bad,http,hosts:Object.entries(hostsC).sort((a,b)=>b[1]-a[1]).slice(0,25)});
// releases only sourced by only 1 non-primary source e.g. only anilist
const weak=rel.filter(r=>r.sources.every(s=>/anilist\.co|themoviedb/.test(s)));out('releases sourced only by anilist/tmdb',weak.length+' '+JSON.stringify(weak.slice(0,10).map(r=>r.slug)));
// 'automatisch' releases
const auto=rel.filter(r=>r.automatisch);out('automatisch by platform/type',auto.map(r=>r.platform+'/'+r.releaseType).reduce((m,k)=>(m[k]=(m[k]||0)+1,m),{}));
// quellen stand
const st={};for(const r of rel)for(const q of (r.quellen||[]))st[q.stand||'none']=(st[q.stand||'none']||0)+1;out('quellen stand',st);
// quellen sagt vs firstEpisodeDate: all sources say another date?
const disag=[];for(const r of rel){const act=(r.quellen||[]).filter(q=>q.stand!=='ueberholt'&&q.stand!=='vermutlich-ueberholt'&&q.sagt&&/^\d{4}-\d\d-\d\d$/.test(q.sagt));if(act.length&&!act.some(q=>q.sagt===r.schedule.firstEpisodeDate)&&r.platform!=='disc')disag.push([r.slug,r.schedule.firstEpisodeDate,act.map(q=>q.sagt).join('/')])}
out('no active source agrees with firstEpisodeDate',disag.length+' '+JSON.stringify(disag.slice(0,30)));
// dub confidence-type scans for past weekly releases w/o lastEpisodeDate still airing
const today='2026-10-02';
const stale=[];for(const r of rel){if(r.releaseType!=='weekly'||r.platform==='tv')continue;const es=evBy.get(r.slug)||[];if(!es.length)continue;const last=es.map(e=>e.date).sort().pop();if(last<today&&!r.schedule.lastEpisodeDate){}
 if(last<today)stale.push(r.slug)}
out('weekly releases whose last event is past',stale.length);
