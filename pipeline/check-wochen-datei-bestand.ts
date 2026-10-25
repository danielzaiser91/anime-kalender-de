/**
 * Bestandsteil von `check-wochen-datei.ts`: `woche.json` steht identisch in den vollen Dateien, roh und nach der Übersetzung in eigene Kennungen.
 * Liest `public/data` und gehört deshalb in `check:bestand`, nicht in `check:logic` (der Bestand liegt hinter neueren Rohdaten zurück;
 * PR-Ketten wurden daran rot, 12.10.2026). Die Einheitenprüfungen ohne Dateizugriff stehen in `check-wochen-datei.ts`.
 */
import { existsSync, readFileSync } from 'node:fs'
import type { Release, ReleaseEvent, Title } from '../shared/types.ts'
import { pruefeWochenDatei, type WochenDatei } from '../shared/wochen-datei.ts'
import { pruefeKachelDatei } from '../shared/wochen-kacheln.ts'
import { ladeAkVon, uebersetzeDatei } from './lib/ausgabe-kennung.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

{
  /* Am echten Bestand: roh, und nach der Übersetzung in eigene Kennungen, wie sie ausgeliefert wird. */
  const lies = <T>(name: string): T => JSON.parse(readFileSync(`public/data/${name}`, 'utf8')) as T
  if (!existsSync('public/data/woche.json')) pruefe('public/data/woche.json ist da (npm run data:build)', false)
  else {
    const woche = lies<WochenDatei>('woche.json')
    const [t, r, e] = [lies<Title[]>('titles-core.json'), lies<Release[]>('releases.json'), lies<ReleaseEvent[]>('events.json')]
    const roh = pruefeWochenDatei(woche, t, r, e)
    pruefe('Bestand: Jeder Eintrag von woche.json steht identisch in den vollen Dateien', roh.length === 0, roh)
    pruefe('Bestand: die Woche hat Termine', woche.events.length > 0)
    const { akVon } = ladeAkVon('data/kennungen.json')
    const uebersetzt = (name: string, daten: unknown) => uebersetzeDatei(name, daten, akVon)
    const w2 = uebersetzt('woche.json', woche) as WochenDatei
    const nach = pruefeWochenDatei(w2, uebersetzt('titles-core.json', t) as Title[], uebersetzt('releases.json', r) as Release[], uebersetzt('events.json', e) as ReleaseEvent[])
    pruefe('Bestand: auch nach der Übersetzung in eigene Kennungen', nach.length === 0, nach)
    const kacheln = lies<WochenDatei>('woche-kacheln.json')
    pruefe('Bestand: woche-kacheln.json passt zu woche.json', pruefeKachelDatei(kacheln, woche).length === 0, pruefeKachelDatei(kacheln, woche))
    const kachelNach = pruefeKachelDatei(uebersetzt('woche-kacheln.json', kacheln) as WochenDatei, w2)
    pruefe('Bestand: auch die Kachel-Datei nach der Übersetzung in eigene Kennungen', kachelNach.length === 0, kachelNach)
  }
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) zur Wochen-Datei am Bestand verletzt.` : '\nWochen-Datei (Bestand): alle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
