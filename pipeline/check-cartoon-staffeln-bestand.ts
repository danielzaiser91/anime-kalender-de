/**
 * Bestandsteil von `check-cartoon-staffeln.ts`: Staffelangaben der Cartoons in `cartoons.json` sind wohlgeformt, die Summe passt zur Gesamtfolgenzahl oder der Titel steht auf der Prüfliste.
 * Liest `public/data` und gehört deshalb in `check:bestand`, nicht in `check:logic` (der Bestand liegt hinter neueren Rohdaten zurück;
 * PR-Ketten wurden daran rot, 12.10.2026). Die Einheitenprüfungen ohne Dateizugriff stehen in `check-cartoon-staffeln.ts`.
 */
import { existsSync } from 'node:fs'
import { readJson } from './lib/util.ts'
import { summe, SUMMEN_TOLERANZ } from './lib/cartoon-staffeln.ts'
import { PRUEFLISTE, type StaffelPruefung } from './bau/cartoon-staffeln.ts'
import type { Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

// Echter Bestand (nach einem Bau): jede Staffelangabe ist wohlgeformt, und was nicht zur Gesamtfolgenzahl passt, steht auf der Prüfliste.
const OUT = 'public/data/cartoons.json'
if (existsSync(OUT)) {
  const mit = readJson<Title[]>(OUT, []).filter((t) => t.staffeln)
  const liste = new Set(readJson<StaffelPruefung[]>(PRUEFLISTE, []).map((p) => p.titleId))
  const wohlgeformt = (t: Title) =>
    t.staffeln!.every((s, i, alle) => Number.isInteger(s.nr) && s.nr >= 1 && Number.isInteger(s.folgen) && s.folgen >= 1 && (i === 0 || alle[i - 1].nr < s.nr))
  pruefe('Bestand: Staffeln aufsteigend, ab Nummer 1, mit ganzzahliger Folgenzahl', mit.every(wohlgeformt))
  pruefe('Bestand: jede Staffelangabe nennt ihre Quelle', mit.every((t) => t.staffelnQuelle === 'justwatch' || t.staffelnQuelle === 'tmdb' || t.staffelnQuelle === 'handbeleg'))
  // Ein Handbeleg ist selbst die Prüfung.
  const abweichend = mit.filter((t) => t.staffelnQuelle !== 'handbeleg' && t.episodes &&Math.abs(summe(t.staffeln!) - t.episodes) > SUMMEN_TOLERANZ && !liste.has(t.id))
  pruefe('Bestand: Staffelsumme passt zur Gesamtfolgenzahl (±3) oder der Titel steht auf der Prüfliste', abweichend.length === 0, abweichend.map((t) => t.id).slice(0, 10).join())
}

if (fehler) {
  console.error(`${fehler} Zusicherung(en) zu den Cartoon-Staffeln am Bestand verletzt`)
  console.log(`VERSTÖSSE: ${fehler}`)
  process.exit(1)
}
console.log('Cartoon-Staffeln (Bestand): Zusicherungen erfüllt')
console.log('VERSTÖSSE: 0')
