// Messskript aus der Analysesitzung vom 02.10.2026 (docs/wissen/sitzung-2026-10-02-analyse-und-umstellung.md). Einmalig, Pfade zum Scratchpad ggf. anpassen.
const fs=require('fs');
const D='C:/code/ai/anime-kalender-de/public/data/';
const j=f=>JSON.parse(fs.readFileSync(D+f,'utf8'));
const tit=j('titles.json'),rel=j('releases.json'),car=j('cartoons.json'),core=j('titles-core.json'),fr=j('franchises.json'),reihen=j('reihen.json');
const out=(k,v)=>console.log('\n## '+k+'\n'+(typeof v==='string'?v:JSON.stringify(v)));
const cnt=(arr,f)=>{const m={};for(const x of arr){const k=f(x);m[k]=(m[k]||0)+1}return m};
out('title keys freq',Object.entries(tit.reduce((m,t)=>{for(const k of Object.keys(t))m[k]=(m[k]||0)+1;return m},{})).sort((a,b)=>b[1]-a[1]).map(x=>x.join(':')).join(' '));
const streams=tit.flatMap(t=>t.streams.map(s=>({t,s})));
out('streams',{n:streams.length,byPlatform:cnt(streams,x=>x.s.platform),dub:cnt(streams,x=>String(x.s.dub)),zugang:cnt(streams,x=>String(x.s.zugang)),entfernt:streams.filter(x=>x.s.entferntAm).length});
out('titles by streams count',cnt(tit,t=>Math.min(t.streams.length,6)));
out('dubConfidence',cnt(tit,t=>t.dubConfidence));
out('dubConfidence x hasStream x hasRelease',cnt(tit,t=>t.dubConfidence+'|streams:'+(t.streams.length>0)+'|dubTrue:'+t.streams.some(s=>s.dub===true)));
const hosts={crunchyroll:/crunchyroll\.com/i,netflix:/netflix\.com/i,primevideo:/(primevideo|amazon\.|justwatch)/i,disneyplus:/disneyplus\.com/i,adn:/animationdigitalnetwork|adn\./i,rtlplus:/rtl\.de/i,youtube:/youtu/i,joyn:/joyn\./i,aniverse:/aniverse/i,wow:/wow/i};
const mis=streams.filter(x=>hosts[x.s.platform]&&!hosts[x.s.platform].test(x.s.url));
out('stream host != platform',mis.length+' '+JSON.stringify(mis.slice(0,20).map(x=>[x.t.id,x.s.platform,x.s.url])));
// same URL on many titles
const byUrl=new Map();for(const x of streams){(byUrl.get(x.s.url)||byUrl.set(x.s.url,[]).get(x.s.url)).push(x.t.id)}
const multi=[...byUrl].filter(([u,a])=>a.length>1);
out('same URL on >1 title',multi.length+' sample '+JSON.stringify(multi.slice(0,5)));
out('sharedWith consistency',streams.filter(x=>x.s.sharedWith&&byUrl.get(x.s.url).length!==x.s.sharedWith).length+' sharedWith mismatch; no sharedWith but multi: '+streams.filter(x=>!x.s.sharedWith&&byUrl.get(x.s.url).length>1).length);
// dub true but dubRanges all false
out('dub true with all-false ranges',streams.filter(x=>x.s.dub===true&&x.s.dubRanges&&x.s.dubRanges.length&&x.s.dubRanges.every(r=>!r.dub)).map(x=>[x.t.id,x.t.titleRomaji,x.s.platform]).slice(0,20));
out('dub false with true ranges',streams.filter(x=>x.s.dub===false&&x.s.dubRanges&&x.s.dubRanges.some(r=>r.dub)).map(x=>[x.t.id,x.t.titleRomaji,x.s.platform]).slice(0,20));
// ranges beyond episodes
const rb=[];for(const x of streams){const e=x.t.episodes;if(!e||!x.s.dubRanges)continue;for(const r of x.s.dubRanges){if(r.to>e*1.5&&r.to>e+3)rb.push([x.t.id,x.t.titleRomaji,x.s.platform,r.from+'-'+r.to,'eps '+e])}}
out('dubRanges beyond episodes',rb.length+' '+JSON.stringify(rb.slice(0,20)));
const ov=[];for(const x of streams){const rs=(x.s.dubRanges||[]).slice().sort((a,b)=>a.from-b.from);for(let i=1;i<rs.length;i++)if(rs[i].from<=rs[i-1].to&&rs[i].dub!==rs[i-1].dub)ov.push([x.t.id,x.t.titleRomaji,x.s.platform,JSON.stringify(rs)])}
out('overlapping contradictory ranges',ov.length+' '+JSON.stringify(ov.slice(0,10)));
// titles with missing basics
out('missing basics',{noTitleDe:tit.filter(t=>!t.titleDe).length,noCover:tit.filter(t=>!t.coverImage).length,noSynopsis:tit.filter(t=>!t.synopsis).length,noGenres:tit.filter(t=>!t.genres||!t.genres.length).length,noFormat:tit.filter(t=>!t.format).length,noEpisodes:tit.filter(t=>!t.episodes).length,noFsk:tit.filter(t=>t.fsk==null).length});
out('format dist',cnt(tit,t=>t.format));
out('jpYear weird',tit.filter(t=>t.jpYear&&(t.jpYear<1960||t.jpYear>2028)).map(t=>[t.id,t.titleRomaji,t.jpYear]).slice(0,20));
out('score weird',tit.filter(t=>t.score!=null&&(t.score<0||t.score>100)).length);
// cartoons
out('cartoons',{n:car.length,jpYear:cnt(car,c=>c.jpYear>2027?'>2027':c.jpYear<1990?'<1990':'ok'),noStreams:car.filter(c=>!c.streams.length).length,dubConf:cnt(car,c=>c.dubConfidence)});
out('cartoons future',car.filter(c=>c.jpYear>2027).slice(0,10).map(c=>[c.id,c.titleEn,c.jpYear,c.jpStart,c.land]));
// releases per title kinds
const relBy=cnt(rel,r=>r.titleId);
out('titles with releases',Object.keys(relBy).length);
// titles with dub true streams but also ohne?  titles with release but no stream and no dub true
const noWay=tit.filter(t=>!t.streams.some(s=>s.dub===true)&&!rel.some(r=>r.titleId===t.id));
out('titles w/o dub-true stream and w/o release (in main set)',noWay.length+' '+JSON.stringify(cnt(noWay,t=>t.dubConfidence)));
out('sample noWay',noWay.slice(0,15).map(t=>[t.id,t.titleRomaji,t.dubConfidence,t.streams.length,!!(t.deErstausgabe),!!(t.watchLinks&&t.watchLinks.length)]));
// deErstausgabe
out('deErstausgabe',{n:tit.filter(t=>t.deErstausgabe).length,synchro:tit.filter(t=>t.deErstausgabe&&t.deErstausgabe.synchro).length});
// franchises
const frIds=new Set();for(const k of Object.keys(fr))for(const m of fr[k])frIds.add(m.id);
const titIds=new Set(tit.map(t=>t.id));
out('titles missing in franchises',tit.filter(t=>!frIds.has(t.id)).length);
out('reihen map missing/incorrect',tit.filter(t=>!reihen[t.id]).length);
// core subset
const coreIds=new Set(core.map(t=>t.id));out('core not in titles',[...coreIds].filter(i=>!titIds.has(i)).length);
// release-referenced titles in core
const refd=new Set(rel.map(r=>r.titleId));out('referenced titles missing in core',[...refd].filter(i=>!coreIds.has(i)&&titIds.has(i)).length);
// duplicate titleDe / slug
const sl=cnt(tit,t=>t.slug);out('dup slugs',Object.entries(sl).filter(x=>x[1]>1));
const dn=cnt(tit.filter(t=>t.titleDe),t=>t.titleDe.toLowerCase());out('dup titleDe',Object.entries(dn).filter(x=>x[1]>1).length+' '+JSON.stringify(Object.entries(dn).filter(x=>x[1]>1).slice(0,15)));
