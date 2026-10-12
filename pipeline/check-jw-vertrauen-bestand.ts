/**
 * Bestandsteil von `check-jw-vertrauen.ts`: JustWatch-Kennzeichnung der Prime-Wege in `titles.json` (nur Prime, nur offene Urteile, nur Adressen mit gti).
 * Liest `public/data` und gehört deshalb in `check:bestand`, nicht in `check:logic` (der Bestand liegt hinter neueren Rohdaten zurück;
 * PR-Ketten wurden daran rot, 12.10.2026). Die Einheitenprüfungen ohne Dateizugriff stehen in `check-jw-vertrauen.ts`.
 */

import { existsSync } from 'node:fs'
import { readJson } from './lib/util.ts'
import type { Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

// Echter Bestand (nach einem Bau): nur Prime, nur offene Urteile, nur Adressen mit gti, nur der Hauptbestand.
const OUT = 'public/data/titles.json'
if (existsSync(OUT)) {
  const gekennzeichnet = readJson<Title[]>(OUT, []).flatMap((t) => (t.streams ?? []).filter((s) => s.dubQuelle).map((s) => ({ t, s })))
  pruefe('Bestand: nur Prime-Wege tragen die Kennzeichnung', gekennzeichnet.every(({ s }) => s.platform === 'primevideo'))
  pruefe('Bestand: kein Weg trägt Kennzeichnung und Urteil zugleich', gekennzeichnet.every(({ s }) => s.dub === undefined))
  pruefe('Bestand: Kennzeichnung nur auf JustWatch-Adressen mit Datum', gekennzeichnet.every(({ s }) => /[?&]gti=/.test(s.url) && /^\d{4}-\d\d-\d\d$/.test(s.dubStand ?? '')))
  pruefe('Bestand: nur Titel der Anime-Liste, nie Cartoons', gekennzeichnet.every(({ t }) => t.id > 0))
}

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('check-jw-vertrauen-bestand: ok')
