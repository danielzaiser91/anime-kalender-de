/**
 * Bestandsteil von `check-cr-teilseiten.ts`: Bereiche geteilter Crunchyroll-Wege in `titles.json` und die Prüfliste.
 * Liest `public/data` und gehört deshalb in `check:bestand`, nicht in `check:logic` (der Bestand liegt hinter neueren Rohdaten zurück;
 * PR-Ketten wurden daran rot, 12.10.2026). Die Einheitenprüfungen ohne Dateizugriff stehen in `check-cr-teilseiten.ts`.
 */
import { existsSync } from 'node:fs'
import { readJson } from './lib/util.ts'
import { PRUEFLISTE } from './bau/09-7-cr-teilseiten.ts'
import type { TeilseitenPruefung } from './lib/teilseiten.ts'
import { bereicheBelegt, belegteFolgen } from './lib/cr-bereiche-belegt.ts'
import { staffelDesTitels } from './bau/widerlegung-staffel.ts'
import type { CrDubData } from './lib/crunchyroll-dub.ts'
import type { Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${typeof info === 'string' ? info : JSON.stringify(info)}`)
}

// Echter Bestand (nach einem Bau): Bereiche liegen in unserer Zählung, die Prüfliste nennt nur vorhandene Titel.
const OUT = 'public/data/titles.json'
if (existsSync(OUT)) {
  const titel = new Map(readJson<Title[]>(OUT, []).map((t) => [t.id, t]))
  const crGeteilt = [...titel.values()].flatMap((t) => t.streams.filter((s) => s.platform === 'crunchyroll' && s.sharedWith && s.dubRanges?.length).map((s) => ({ t, s })))
  const crDub = readJson<CrDubData>('data/crunchyroll-dub.json', { scrapedAt: '', serien: [] })
  const ueber = crGeteilt.filter(({ t, s }) => (t.episodes ? s.dubRanges!.some((r) => r.from < 1 || r.to < r.from || r.to > t.episodes!) : !bereicheBelegt(s.dubRanges!, belegteFolgen(crDub, s.url, staffelDesTitels(t, titel.values())))))
  pruefe('Bestand: Bereiche geteilter Crunchyroll-Seiten liegen in 1 bis Folgenzahl, ohne Folgenzahl nur auf belegten deutschen Folgen', ueber.length === 0, ueber.map((x) => x.t.id).slice(0, 10).join())
  const liste = readJson<TeilseitenPruefung[]>(PRUEFLISTE, [])
  // Titel, die ein späterer Bauschritt in den Katalog verschiebt (Specials, Zusammenfassungen), sind ebenfalls vorhanden.
  const katalog = new Set(readJson<Title[]>('public/data/ohne-synchro.json', []).map((t) => t.id))
  const fremd = liste.filter((p) => !(titel.has(p.titleId) || katalog.has(p.titleId)) || !p.grund.length)
  pruefe('Bestand: die Prüfliste nennt nur vorhandene Titel mit Grund', fremd.length === 0, fremd.map((p) => p.titleId).slice(0, 10).join())
  pruefe('Bestand: kein Titel steht mit Bereich und auf der Prüfliste', liste.every((p) => !crGeteilt.some(({ t, s }) => t.id === p.titleId && s.url === p.url)))
}

if (fehler) {
  console.error(`${fehler} Zusicherung(en) zu den geteilten Crunchyroll-Seiten am Bestand verletzt`)
  process.exit(1)
}
console.log('Geteilte Crunchyroll-Seiten (Bestand): Zusicherungen erfüllt')
