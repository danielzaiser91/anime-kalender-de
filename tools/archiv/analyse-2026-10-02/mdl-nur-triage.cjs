// Messskript aus der Analysesitzung vom 02.10.2026 (docs/wissen/sitzung-2026-10-02-analyse-und-umstellung.md). Einmalig, Pfade zum Scratchpad ggf. anpassen.
const fs = require('fs');
const R = 'C:/code/ai/anime-kalender-de/';
const tit = require(R + 'public/data/titles.json'), rel = require(R + 'public/data/releases.json');
const ani = JSON.parse(fs.readFileSync(R + 'data/anisearch.json', 'utf8'));
const mt = new Set(rel.filter(r => r.platform !== 'disc').map(r => r.titleId)), dt = new Set(rel.filter(r => r.platform === 'disc').map(r => r.titleId));
const n = tit.filter(t => !t.streams.some(s => s.dub === true) && !mt.has(t.id) && !dt.has(t.id) && !t.deErstausgabe && !(t.watchLinks && t.watchLinks.length) && !t.ankuendigung);
const UA = { 'User-Agent': 'anime-kalender-de-audit/1.0 (danielzaiser91@googlemail.com)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function wp(q) {
  const s = await (await fetch('https://de.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=2&srsearch=' + encodeURIComponent(q), { headers: UA })).json();
  const hits = (s.query && s.query.search) || [];
  const out = [];
  for (const h of hits.slice(0, 1)) {
    const p = await (await fetch('https://de.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&titles=' + encodeURIComponent(h.title), { headers: UA })).json();
    const page = Object.values(p.query.pages)[0];
    const txt = page.extract || '';
    const m = [...txt.matchAll(/[^.\n]{0,120}(Synchron|deutsche[nr]? (Fassung|Sprach|Erstausstrahlung|Version)|ins Deutsche|auf Deutsch|deutschsprachig)[^.\n]{0,160}/gi)].slice(0, 3).map(x => x[0].trim());
    out.push({ seite: h.title, treffer: m });
  }
  return out;
}
(async () => {
  const rows = [];
  for (const t of n) {
    const a = ani[String(t.id)];
    const de = a && a.info && a.info.languages && a.info.languages.find(l => l.language === 'Deutsch');
    const row = { id: t.id, name: t.titleDe || t.titleRomaji, fmt: t.format, jahr: t.jpYear, conf: t.dubConfidence, aniEintrag: !!a, aniDE: de ? (de.status + ' ' + (de.released || '') + ' ' + (de.publisher || []).join('/')) : null, titleDe: !!t.titleDe };
    if (!de) {
      try { row.wiki = await wp((t.titleDe || t.titleEn || t.titleRomaji) + ' Anime'); } catch (e) { row.wiki = 'ERR ' + e.message; }
      await sleep(300);
    }
    rows.push(row);
    console.log(row.id, row.name, '| aniDE:', row.aniDE, '|', JSON.stringify(row.wiki || '').slice(0, 300));
  }
  fs.writeFileSync('C:/Users/ih/AppData/Local/Temp/claude/C--code-ai-anime-kalender-de/31b34792-e831-48d4-bf92-d684014bdb3a/scratchpad/mdl-only.json', JSON.stringify(rows, null, 1));
})();
