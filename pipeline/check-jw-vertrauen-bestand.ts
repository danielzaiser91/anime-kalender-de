/**
 * Bestandsteil von `check-jw-seite.ts`: JustWatch-Kennzeichnung der Wege in `titles.json` und `cartoons.json` (nur offene Urteile, Flagge nur an Seiten mit Kennung).
 * Liest `public/data` und gehört deshalb in `check:bestand`, nicht in `check:logic` (der Bestand liegt hinter neueren Rohdaten zurück;
 * PR-Ketten wurden daran rot, 12.10.2026). Die Einheitenprüfungen ohne Dateizugriff stehen in `check-jw-seite.ts`.
 */
import { existsSync } from 'node:fs'
import { readJson } from './lib/util.ts'
import { seitenSchluessel } from './lib/jw-seite.ts'
import { melde } from './lib/quarantaene.ts'
import type { Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

type Weg = NonNullable<Title['streams']>[number]

/** Eine Bedingung je gekennzeichnetem Weg; jeder Titel mit verletztem Weg steht im Fehler und wird gemeldet (Quarantäne). */
function jeWeg(name: string, wege: { t: Title; s: Weg }[], ok: (s: Weg) => boolean): void {
  const ids = [...new Set(wege.filter((w) => !ok(w.s)).map((w) => w.t.id))]
  pruefe(name, !ids.length, ids.join(', '))
  for (const id of ids) melde(id, 'jw-vertrauen', name)
}

// Echter Bestand (nach einem Bau): nur offene Urteile, Kennzeichnung nur an Adressen mit Seitenkennung, immer mit Datum.
for (const OUT of ['public/data/titles.json', 'public/data/cartoons.json']) {
  if (!existsSync(OUT)) continue
  const gekennzeichnet = readJson<Title[]>(OUT, []).flatMap((t) => (t.streams ?? []).filter((s) => s.dubQuelle).map((s) => ({ t, s })))
  jeWeg(`${OUT}: kein Weg trägt Kennzeichnung und Urteil zugleich`, gekennzeichnet, (s) => s.dub === undefined)
  jeWeg(`${OUT}: Kennzeichnung mit Datum`, gekennzeichnet, (s) => /^\d{4}-\d\d-\d\d$/.test(s.dubStand ?? ''))
  jeWeg(`${OUT}: Flagge nur an Adressen mit Seitenkennung`, gekennzeichnet, (s) => s.dubHintOnly || seitenSchluessel(s.url) !== undefined)
}

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('check-jw-vertrauen-bestand: ok')
