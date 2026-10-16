/**
 * Bestandsteil von `check-jw-seite.ts`: JustWatch-Kennzeichnung der Wege in `titles.json` und `cartoons.json` (nur offene Urteile, Flagge nur an Seiten mit Kennung).
 * Liest `public/data` und gehört deshalb in `check:bestand`, nicht in `check:logic` (der Bestand liegt hinter neueren Rohdaten zurück;
 * PR-Ketten wurden daran rot, 12.10.2026). Die Einheitenprüfungen ohne Dateizugriff stehen in `check-jw-seite.ts`.
 */
import { existsSync } from 'node:fs'
import { readJson } from './lib/util.ts'
import { seitenSchluessel } from './lib/jw-seite.ts'
import type { Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

// Echter Bestand (nach einem Bau): nur offene Urteile, Kennzeichnung nur an Adressen mit Seitenkennung, immer mit Datum.
for (const OUT of ['public/data/titles.json', 'public/data/cartoons.json']) {
  if (!existsSync(OUT)) continue
  const gekennzeichnet = readJson<Title[]>(OUT, []).flatMap((t) => (t.streams ?? []).filter((s) => s.dubQuelle))
  pruefe(`${OUT}: kein Weg trägt Kennzeichnung und Urteil zugleich`, gekennzeichnet.every((s) => s.dub === undefined))
  pruefe(`${OUT}: Kennzeichnung mit Datum`, gekennzeichnet.every((s) => /^\d{4}-\d\d-\d\d$/.test(s.dubStand ?? '')))
  pruefe(`${OUT}: Flagge nur an Adressen mit Seitenkennung`, gekennzeichnet.every((s) => s.dubHintOnly || seitenSchluessel(s.url) !== undefined))
}

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('check-jw-vertrauen-bestand: ok')
