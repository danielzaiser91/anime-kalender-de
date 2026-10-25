/**
 * Bestandsteil der Kalender-Plausibilität (`lib/kalender-plausibilitaet.ts`): Die Treffer je Regel dürfen nur sinken
 * (Vorbild `tools/design-klassen.mjs`). Liest `public/data` und gehört deshalb in `check:bestand` (Bestandsbau, `tools/commit-data.sh`),
 * nicht in `check:logic`; die Regeln und die Grenzlogik (`lib/kalender-plausibilitaet-grenzen.ts`) prüft `check-kalender-plausibilitaet.ts` an Beispielen.
 *
 * Aufruf:
 *   npm run check:kalender-plausibilitaet                    prüfen (Exit 1, wenn eine Regel mehr Treffer hat als erlaubt)
 *   npm run check:kalender-plausibilitaet -- --liste         alle Treffer mit Panel-Link
 *   npm run check:kalender-plausibilitaet -- --festschreiben gesunkene Zahlen übernehmen (erhöht nie); nur der Bestandsbau
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { todayIso } from '../shared/time.ts'
import { ladeKanalWissen } from './lib/kanal-wissen.ts'
import { kanalAdressenOhneBeleg } from './lib/kanal-titel.ts'
import { plausibilitaet, REGELN } from './lib/kalender-plausibilitaet.ts'
import { festschreiben, meldeNeueTreffer, ueberschreitungen, zeile, type Grenzen, type TrefferJeRegel } from './lib/kalender-plausibilitaet-grenzen.ts'
import { ROOT } from './lib/util.ts'

const GRENZEN = resolve(ROOT, 'tools/kalender-plausibilitaet-grenzen.json')

function laden(): TrefferJeRegel {
  const json = (p: string) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'))
  return plausibilitaet({
    titles: json('public/data/titles.json'),
    releases: json('public/data/releases.json'),
    events: json('public/data/events.json'),
    news: json('public/data/news.json'),
    urteile: json('data/urteile.json'),
    kanal: kanalAdressenOhneBeleg(ladeKanalWissen()),
    heute: todayIso(),
  })
}

function festschreibenMelden(treffer: TrefferJeRegel, alt: Grenzen): number {
  const zuhoch = festschreiben(treffer, alt, GRENZEN)
  if (zuhoch.length) {
    console.error('Festschreiben erhöht nie:\n  ' + zuhoch.join('\n  '))
    console.log(`VERSTÖSSE: ${zuhoch.length}`)
    return 1
  }
  console.log('Gesunkene Werte übernommen.')
  console.log('VERSTÖSSE: 0')
  return 0
}

function pruefen(treffer: TrefferJeRegel, grenzen: Grenzen): number {
  for (const r of REGELN) {
    const erlaubt = grenzen.vorkommen[r] ?? 0
    console.log(`  ${treffer[r].length > erlaubt ? '✖' : '✓'} ${r}: ${treffer[r].length} Treffer (erlaubt ${erlaubt})`)
  }
  const fehler = ueberschreitungen(treffer, grenzen)
  for (const f of fehler) console.error(`  FEHLER: ${f}`)
  meldeNeueTreffer(treffer, grenzen)
  if (fehler.length) console.error('\nDie Grenzen werden nicht angehoben: Daten oder Bau korrigieren. Alle Treffer: npm run check:kalender-plausibilitaet -- --liste')
  console.log(`VERSTÖSSE: ${fehler.length}`)
  return fehler.length ? 1 : 0
}

function main(): number {
  const treffer = laden()
  if (process.argv.includes('--liste')) {
    for (const r of REGELN) console.log(`${r}: ${treffer[r].length}\n${treffer[r].map(zeile).join('\n')}`)
    return 0
  }
  const grenzen = JSON.parse(readFileSync(GRENZEN, 'utf8')) as Grenzen
  console.log('\nKalender-Plausibilität: Treffer je Regel dürfen nur sinken')
  return process.argv.includes('--festschreiben') ? festschreibenMelden(treffer, grenzen) : pruefen(treffer, grenzen)
}

process.exit(main())
