import fs from 'node:fs'
const motn = JSON.parse(fs.readFileSync('data/motn.json', 'utf8'))
const titles = JSON.parse(fs.readFileSync('public/data/titles.json', 'utf8'))
const liste = Array.isArray(titles) ? titles : titles.titles || Object.values(titles)
const vergeblich = new Set(Object.keys(motn.gesucht ?? {}).map(Number))

const zeilen = []
for (const t of liste) {
  const nf = (t.streams ?? []).find((s) => /netflix\.com/.test(s.url ?? '') && s.dub === undefined)
  if (!nf || !vergeblich.has(t.id)) continue
  zeilen.push({
    name: t.titleDe || t.titleEn || t.titleRomaji || String(t.id),
    folgen: t.episodes ?? 0,
    jahr: t.jpYear ?? 0,
    url: nf.url,
    // Aus /title/<nummer> wird /watch/<nummer>: Netflix startet damit die erste
    // Folge, und nur im laufenden Player stehen die Tonspuren.
    spielen: (nf.url ?? '').replace('/title/', '/watch/'),
  })
}
// Nach Nutzen: viele Folgen zuerst — der Aufwand je Zeile ist gleich, der Ertrag nicht.
zeilen.sort((a, b) => b.folgen - a.folgen)

const md = [
  '# Netflix: was kein Automat beantworten kann',
  '',
  `Stand ${new Date().toISOString().slice(0, 10)} · **${zeilen.length} Titel**.`,
  '',
  'Diese Titel kennt die Streaming Availability API nicht — ein zweiter Abruf bringt nichts.',
  'Netflix selbst darf nicht abgerufen werden (`robots.txt`). Bleibt der Blick von Hand.',
  '',
  '**Ablauf mit der Erweiterung aus `extension/`:** Auf **Abspielen** klicken — Netflix startet',
  'damit die erste Folge —, dann den Knopf unten rechts drücken und zurück. Er sagt schon vorher,',
  'was er melden würde: grün heißt deutsche Tonspur gefunden, gelb heißt keine.',
  '',
  '**Warum abspielen sein muss:** Auf der Titelseite liefert Netflix keine Sprachangabe — geprüft',
  'am 22.08.2026 im Seitenzustand und im Netzwerkverkehr. Sie entstehen erst mit dem Player.',
  'Landet **Abspielen** auf der Titelseite statt im Player, gibt es dort keine Folge; dann meldet',
  'derselbe Knopf „nicht abrufbar".',
  '',
  'Erzeugt von `npm run data:netflix-rest`, nicht von Hand pflegen.',
  '',
  '| # | Titel | Folgen | Jahr | Verweis |',
  '|---|---|---:|---:|---|',
]
zeilen.forEach((z, i) => {
  md.push(`| ${i + 1} | ${z.name.replace(/\|/g, '\|')} | ${z.folgen || '—'} | ${z.jahr || '—'} | [Abspielen](${z.spielen}) · [Titelseite](${z.url}) |`)
})
md.push('')
fs.writeFileSync('data/netflix-von-hand.md', md.join('\n'))
console.log(`data/netflix-von-hand.md geschrieben: ${zeilen.length} Titel`)
console.log('Die ersten fünf:')
zeilen.slice(0, 5).forEach((z, i) => console.log(` ${i + 1}. ${z.name} (${z.folgen} Folgen, ${z.jahr})`))
