import fs from 'node:fs'
const motn = JSON.parse(fs.readFileSync('data/motn.json', 'utf8'))
const titles = JSON.parse(fs.readFileSync('public/data/titles.json', 'utf8'))
const liste = Array.isArray(titles) ? titles : titles.titles || Object.values(titles)
const vergeblich = new Set(Object.keys(motn.gesucht ?? {}).map(Number))

const zeilen = []
for (const t of liste) {
  const nf = (t.streams ?? []).find((s) => /netflix\.com/.test(s.url ?? '') && s.dub === undefined)
  /*
    **Jeder offene Netflix-Verweis gehört auf die Liste, nicht nur die
    MOTN-vergeblichen.**

    Bis zum 29.08.2026 stand hier zusätzlich `vergeblich.has(t.id)` — die Idee
    war: „Diese Titel kennt die Streaming Availability API nicht, ein zweiter
    Abruf bringt nichts." Der Schluss ist falsch herum. Ob MOTN den Titel
    **kennt**, sagt nichts darüber, ob es eine **Tonspur** liefert; die 42
    offenen Verweise sind offen, weil keine Quelle geantwortet hat.

    Gemessen an dem Tag: 42 offene Verweise, davon **null** MOTN-vergeblich —
    die Liste war leer, während 42 Titel auf einen Blick warteten. Vorher stand
    dort ein einziger, seit dem 24.08. unverändert, weil der Lauf in keinem
    Workflow hing (am selben Tag behoben).

    Für Netflix gilt ohnehin: Tonspuren gibt es nur an einem laufenden Player,
    fünfmal gemessen und fünfmal bestätigt (CLAUDE.md). Es gibt keinen zweiten
    Abruf, der hier etwas beitragen könnte.
  */
  if (!nf) continue
  zeilen.push({
    name: t.titleDe || t.titleEn || t.titleRomaji || String(t.id),
    folgen: t.episodes ?? 0,
    jahr: t.jpYear ?? 0,
    url: nf.url,
    // Aus /title/<nummer> wird /watch/<nummer>: Netflix startet damit die erste
    // Folge, und nur im laufenden Player stehen die Tonspuren.
    spielen: (nf.url ?? '').replace('/title/', '/watch/'),
    /* Nur zur Einordnung: Hat MOTN diesen Titel vergeblich gesucht? */
    unbekannt: vergeblich.has(t.id),
  })
}
// Nach Nutzen: viele Folgen zuerst — der Aufwand je Zeile ist gleich, der Ertrag nicht.
zeilen.sort((a, b) => b.folgen - a.folgen)

const md = [
  '# Netflix: was kein Automat beantworten kann',
  '',
  `Stand ${new Date().toISOString().slice(0, 10)} · **${zeilen.length} Titel**.`,
  '',
  'Netflix gibt seine Tonspuren nur an einen laufenden Player heraus — fünfmal gemessen,',
  'fünfmal bestätigt. Es gibt keinen Abruf, der das hier abnehmen könnte.',
  'Netflix selbst darf nicht abgerufen werden (`robots.txt`). Bleibt der Blick von Hand.',
  '',
  '**Ablauf mit der Erweiterung aus `extension/`:** Titelseite öffnen, auf **Abspielen** klicken,',
  'warten bis der Player die Tonspuren geladen hat, zurück. Die Meldung geht von selbst raus —',
  'der Knopf unten rechts zeigt nur noch, was angekommen ist.',
  '',
  'Bei mehreren Staffeln lohnt es, **erste und letzte Folge** anzusehen: Weicht der Befund ab,',
  'trägt der Datensatz die Grenze ein statt eines pauschalen Ja. Netflix zählt dabei über alle',
  'Staffeln durch — bei Jujutsu Kaisen bis 59 (Daniel, 22.08.2026).',
  '',
  '**Der Umweg über die Titelseite ist nötig:** Ein Klick direkt auf die Abspieladresse leitet',
  'Netflix auf die erste **Folge** um, und deren Kennung kennt unser Datensatz nicht — neun von',
  'zwölf Meldungen aus Batch 1 waren deshalb nicht zuzuordnen (22.08.2026). Von der Titelseite',
  'aus merkt sich die Erweiterung die Reihe; ohne sie meldet der Knopf gar nicht erst.',
  '',
  'Erzeugt von `npm run data:netflix-rest`, nicht von Hand pflegen.',
  '',
  '| # | Titel | Folgen | Jahr | Verweis |',
  '|---|---|---:|---:|---|',
]
zeilen.forEach((z, i) => {
  md.push(`| ${i + 1} | ${z.name.replace(/\|/g, '\|')} | ${z.folgen || '—'} | ${z.jahr || '—'} | [öffnen](${z.url}) |`)
})
md.push('')
fs.writeFileSync('daniel-zum-abarbeiten/06-netflix-rest.md', md.join('\n'))
console.log(`daniel-zum-abarbeiten/06-netflix-rest.md geschrieben: ${zeilen.length} Titel`)
console.log('Die ersten fünf:')
zeilen.slice(0, 5).forEach((z, i) => console.log(` ${i + 1}. ${z.name} (${z.folgen} Folgen, ${z.jahr})`))
