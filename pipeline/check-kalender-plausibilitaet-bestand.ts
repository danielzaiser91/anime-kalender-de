/**
 * Bestandsteil der Kalender-Plausibilität (`lib/kalender-plausibilitaet.ts`): Die Treffer je Regel dürfen nur sinken
 * (Vorbild `tools/design-klassen.mjs`). Liest `public/data` und gehört deshalb in `check:bestand` (Bestandsbau, `tools/commit-data.sh`),
 * nicht in `check:logic`; die Regeln an Beispielen prüft `check-kalender-plausibilitaet.ts`.
 *
 * Aufruf:
 *   npm run check:kalender-plausibilitaet                    prüfen (Exit 1, wenn eine Regel mehr Treffer hat als erlaubt)
 *   npm run check:kalender-plausibilitaet -- --liste         alle Treffer mit Panel-Link
 *   npm run check:kalender-plausibilitaet -- --festschreiben gesunkene Zahlen übernehmen (erhöht nie); nur der Bestandsbau
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { todayIso } from '../shared/time.ts'
import { gesenkt, zuViel } from '../tools/design-klassen.mjs'
import { loadDubChecks } from './lib/dub-confirmed.ts'
import { kanalAdressenOhneBeleg } from './lib/kanal-titel.ts'
import { panelLink, plausibilitaet, REGELN, type Regel, type Treffer } from './lib/kalender-plausibilitaet.ts'
import { ROOT } from './lib/util.ts'

const GRENZEN = resolve(ROOT, 'tools/kalender-plausibilitaet-grenzen.json')
const HINWEIS = 'Wird nur vom Bestandsbau gesenkt (tools/commit-data.sh, --festschreiben), nie von Hand erhöht. Ausgangswerte 16.10.2026.'

interface Grenzen {
  _hinweis: string
  vorkommen: Partial<Record<Regel, number>>
  /** Die Schlüssel der erlaubten Treffer: Was hier fehlt, nennt die Ausgabe als neu. */
  bekannt: Partial<Record<Regel, string[]>>
}

function laden(): Record<Regel, Treffer[]> {
  const json = (p: string) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'))
  return plausibilitaet({
    titles: json('public/data/titles.json'),
    releases: json('public/data/releases.json'),
    events: json('public/data/events.json'),
    news: json('public/data/news.json'),
    urteile: json('data/urteile.json'),
    kanal: kanalAdressenOhneBeleg(loadDubChecks()),
    heute: todayIso(),
  })
}

const zeile = (t: Treffer) => `    ${t.text} — ${panelLink(t.titleId)}`

function festschreiben(treffer: Record<Regel, Treffer[]>, alt: Grenzen): number {
  const zahlen = Object.fromEntries(REGELN.map((r) => [r, treffer[r].length]))
  const zuhoch = zuViel(zahlen, alt.vorkommen)
  if (zuhoch.length) {
    console.error('Festschreiben erhöht nie:\n  ' + zuhoch.join('\n  '))
    return 1
  }
  const vorkommen = gesenkt(zahlen, alt.vorkommen)
  const bekannt = Object.fromEntries(REGELN.map((r) => [r, treffer[r].map((t) => t.schluessel)]))
  writeFileSync(GRENZEN, JSON.stringify({ _hinweis: HINWEIS, vorkommen, bekannt }, null, 2) + '\n')
  console.log('Gesunkene Werte übernommen.')
  return 0
}

function pruefen(treffer: Record<Regel, Treffer[]>, grenzen: Grenzen): number {
  let rot = 0
  for (const r of REGELN) {
    const erlaubt = grenzen.vorkommen[r] ?? 0
    console.log(`  ${treffer[r].length > erlaubt ? '✖' : '✓'} ${r}: ${treffer[r].length} Treffer (erlaubt ${erlaubt})`)
    if (treffer[r].length <= erlaubt) continue
    rot++
    const bekannt = new Set(grenzen.bekannt[r] ?? [])
    const neu = treffer[r].filter((t) => !bekannt.has(t.schluessel))
    console.error(`  FEHLER: ${r} hat ${treffer[r].length - erlaubt} Treffer mehr. Neu:\n${(neu.length ? neu : treffer[r]).map(zeile).join('\n')}`)
  }
  if (rot) console.error('\nDie Grenzen werden nicht angehoben: Daten oder Bau korrigieren. Alle Treffer: npm run check:kalender-plausibilitaet -- --liste')
  return rot ? 1 : 0
}

function main(): number {
  const treffer = laden()
  if (process.argv.includes('--liste')) {
    for (const r of REGELN) console.log(`${r}: ${treffer[r].length}\n${treffer[r].map(zeile).join('\n')}`)
    return 0
  }
  const grenzen = JSON.parse(readFileSync(GRENZEN, 'utf8')) as Grenzen
  console.log('\nKalender-Plausibilität: Treffer je Regel dürfen nur sinken')
  return process.argv.includes('--festschreiben') ? festschreiben(treffer, grenzen) : pruefen(treffer, grenzen)
}

process.exit(main())
