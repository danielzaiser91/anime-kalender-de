/**
 * Bestand zu `check-folgenflaggen.ts` (Tempal, 18.10.2026): Jede Folge einer Folgenliste, die ein Weg der Pille als
 * deutsch führt (belegt oder vom Wochenplan getragen), trägt eine Flagge. Liest den gebauten Bestand, deshalb
 * `check:bestand` (läuft im Bestandsbau), nicht `check:logic`.
 */
import { existsSync, readFileSync } from 'node:fs'
import type { Release, Title } from '../shared/types.ts'
import { deutscheBereicheDerWege, folgeIstDeutsch, titelMitTerminBereichen } from '../web/src/components/detail/stream-bereiche.ts'

const DATEN = new URL('../public/data/', import.meta.url)
let fehler = 0
let listen = 0
let folgen = 0

const titel = JSON.parse(readFileSync(new URL('titles.json', DATEN), 'utf8')) as Title[]
const roh = JSON.parse(readFileSync(new URL('releases.json', DATEN), 'utf8'))
const releases: Release[] = roh.releases ?? roh
const jeTitel = new Map<number, Release[]>()
for (const r of releases) jeTitel.set(r.titleId, [...(jeTitel.get(r.titleId) ?? []), r])

for (const t of titel) {
  const datei = new URL(`folgen/${t.id}.json`, DATEN)
  if (!existsSync(datei)) continue
  listen++
  const liste = JSON.parse(readFileSync(datei, 'utf8')) as { f: [number, string][]; de: [number, number][] }
  const wege = deutscheBereicheDerWege(titelMitTerminBereichen(t, jeTitel.get(t.id) ?? []))
  for (const [nr] of liste.f) {
    if (!wege.some((w) => nr >= w.from && nr <= w.to)) continue
    folgen++
    if (folgeIstDeutsch(nr, liste.de, wege)) continue
    fehler++
    console.error(`FEHLER: ${t.id} Folge ${nr} steht in der Pille, trägt aber keine Flagge`)
  }
}

/* Untergrenze, sonst ist ein Wächter ohne Wege grün: 10.556 am 18.10.2026. */
if (folgen < 1000) {
  fehler++
  console.error(`FEHLER: nur ${folgen} Folgen aus den Bereichen der Wege geprüft — der Wächter misst nichts`)
}

console.log(`check-folgenflaggen-bestand: ${fehler ? `${fehler} Fehler` : 'ok'} (${listen} Folgenlisten, ${folgen} Folgen aus den Bereichen der Wege)`)
console.log(`VERSTÖSSE: ${fehler}`)
process.exit(fehler ? 1 : 0)
