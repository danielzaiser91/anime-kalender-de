const fs = require('fs')
const { execSync } = require('child_process')
const S = 'C:/Users/ih/AppData/Local/Temp/claude/C--code-ai-anime-kalender-de/31b34792-e831-48d4-bf92-d684014bdb3a/scratchpad/'
const assoc = JSON.parse(fs.readFileSync(S + 'api-associated.json', 'utf8'))
const titles = JSON.parse(fs.readFileSync(S + 'api-titles.json', 'utf8'))
const tit = JSON.parse(execSync('"C:/Program Files/git/cmd/git.exe" show origin/main:public/data/titles.json', { maxBuffer: 1e9, cwd: 'C:/code/ai/anime-kalender-de' }).toString())
const nachMal = new Map(Object.entries(assoc).map(([m,a])=>[+m,a.map(Number)]))
console.log('aniSearch-IDs in associated', Object.keys(assoc).length, 'MAL-IDs', nachMal.size, '| Titel in /titles', Object.keys(titles).length)
let mitMal = 0, gleich = 0, anders = 0, neu = 0, ohneMal = 0, mehrdeutig = 0, ohneBeides = 0
const anders_l = [], neu_l = []
for (const t of tit) {
  if (!t.malId) { ohneMal++; if (!t.anisearchId) ohneBeides++; continue }
  mitMal++
  const a = nachMal.get(t.malId)
  if (a && a.length > 1) mehrdeutig++
  if (t.anisearchId && a) { if (a.includes(t.anisearchId)) gleich++; else { anders++; anders_l.push(`${t.slug} manami ${t.anisearchId} vs API ${a} (${titles[a[0]]?.main})`) } }
  else if (!t.anisearchId && a) { neu++; neu_l.push(`${t.slug} -> ${a} (${titles[a[0]]?.main}, ${titles[a[0]]?.year})`) }
}
console.log({ gesamt: tit.length, mitMal, ohneMal, ohneBeides, gleich, anders, neu, mehrdeutig, ohneAniSearchNachher: tit.filter((t) => !t.anisearchId && !(t.malId && nachMal.get(t.malId))).length, ohneAniSearchVorher: tit.filter((t) => !t.anisearchId).length })
console.log('Abweichungen (Stichprobe):\n' + anders_l.slice(0, 25).join('\n'))
console.log('Neu über API (Stichprobe):\n' + neu_l.slice(0, 15).join('\n'))
