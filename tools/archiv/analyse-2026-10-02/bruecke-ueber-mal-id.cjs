// Messskript aus der Analysesitzung vom 02.10.2026 (docs/wissen/sitzung-2026-10-02-analyse-und-umstellung.md). Einmalig, Pfade zum Scratchpad ggf. anpassen.
const fs = require('fs');
const R = 'C:/code/ai/anime-kalender-de/';
(async () => {
  const j = await (await fetch('https://github.com/manami-project/anime-offline-database/releases/latest/download/anime-offline-database-minified.json', { redirect: 'follow' })).json();
  const byMal = new Map();
  for (const e of j.data) {
    const ani = e.sources.find(s => /anisearch\.com\/anime\/\d+$/.test(s));
    const mal = e.sources.find(s => /myanimelist\.net\/anime\/\d+$/.test(s));
    if (ani && mal) byMal.set(+mal.split('/').pop(), { ani: +ani.split('/').pop(), eps: e.episodes, title: e.title, year: e.animeSeason && e.animeSeason.year });
  }
  const tit = require(R + 'public/data/titles.json');
  const ids = JSON.parse(fs.readFileSync(R + 'data/anime-ids.json', 'utf8')).anisearch;
  const fehlt = tit.filter(t => !ids[t.id] && !t.anisearchId);
  const fix = [], rest = [];
  for (const t of fehlt) {
    const m = t.malId && byMal.get(t.malId);
    if (m) fix.push([t.id, t.titleDe || t.titleRomaji, t.format, t.jpYear, t.episodes, '->', m.ani, m.eps + ' Ep.']);
    else rest.push(t);
  }
  console.log('Hauptbestand ohne Bruecke:', fehlt.length, '| ueber MAL-ID gefunden:', fix.length, '| weiter offen:', rest.length);
  console.log(fix.slice(0, 14).map(x => x.join(' | ')).join('\n'));
  console.log('--- offen, Beispiele');
  console.log(rest.slice(0, 12).map(t => [t.id, t.titleDe || t.titleRomaji, t.format, t.jpYear, 'mal=' + t.malId].join(' | ')).join('\n'));
  const ohne = rest.filter(t => !t.malId).length; console.log('davon ohne MAL-ID:', ohne);
  const reg = tit.filter(t => t.dubConfidence).length; void reg;
  // Mehr-AniList-pro-aniSearch: wie viele aniSearch-Eintraege decken mehrere unserer Titel?
  fs.writeFileSync('C:/Users/ih/AppData/Local/Temp/claude/C--code-ai-anime-kalender-de/31b34792-e831-48d4-bf92-d684014bdb3a/scratchpad/mal-fix.json', JSON.stringify({ fix, rest: rest.map(t => [t.id, t.titleRomaji, t.malId]) }));
})();
