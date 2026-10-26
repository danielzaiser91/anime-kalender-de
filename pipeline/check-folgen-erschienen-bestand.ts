/**
 * Bestand zu `check-folgen-erschienen-je-weg.ts` (26.10.2026, Beyblade X „128 von 128“ bei belegten 122): Führt jeder Weg
 * ohne Bereiche eines Titels einen nummerierten Wochenplan, steht in `folgen/<id>.json` keine deutsche Folge über dem
 * Stand dieser Pläne und dem Ende der belegten Bereiche der übrigen Wege. Titel mit Wikipedia-Folgenliste (Vorrang, andere Quelle) bleiben aus.
 * Liest den gebauten Bestand, deshalb `check:bestand`.
 */
import { existsSync, readFileSync } from 'node:fs'
import type { Release, Title } from '../shared/types.ts'
import { todayIso } from '../shared/time.ts'
import { hoechsteFolgeJeAnbieter } from './bau/folgen-erschienen-je-weg.ts'
import { melde } from './lib/quarantaene.ts'

const DATEN = new URL('../public/data/', import.meta.url)
const lies = (pfad: URL) => JSON.parse(readFileSync(pfad, 'utf8'))
const titel = lies(new URL('titles.json', DATEN)) as Title[]
const roh = lies(new URL('releases.json', DATEN))
const releases: Release[] = roh.releases ?? roh
const wiki = lies(new URL('../data/wikipedia-folgen.json', import.meta.url)).titel ?? {}
const heute = todayIso()
const jeTitel = new Map<number, Release[]>()
for (const r of releases) jeTitel.set(r.titleId, [...(jeTitel.get(r.titleId) ?? []), r])

let fehler = 0
let geprueft = 0
for (const t of titel) {
  const datei = new URL(`folgen/${t.id}.json`, DATEN)
  if (!existsSync(datei) || wiki[String(t.id)]?.folgen?.length) continue
  const dubWege = (t.streams ?? []).filter((s) => s.dub === true)
  const ohneBereiche = dubWege.filter((s) => !s.dubRanges?.length)
  const plan = hoechsteFolgeJeAnbieter(jeTitel.get(t.id) ?? [], heute)
  if (!ohneBereiche.length || ohneBereiche.some((s) => !plan.has(s.platform))) continue
  /* Obergrenze: Ende der belegten Bereiche der anderen Wege, Stand der Wochenpläne bei den Wegen ohne Bereiche. */
  const grenze = Math.max(...dubWege.map((s) => (s.dubRanges?.length ? Math.max(...s.dubRanges.map((r) => r.to)) : plan.get(s.platform)!)))
  const de = (lies(datei).de ?? []) as [number, number][]
  geprueft++
  const hoechste = Math.max(0, ...de.map(([, bis]) => bis))
  if (hoechste <= grenze) continue
  fehler++
  melde(t.id, 'folgen-erschienen-bestand', 'Deutsche Folgen über dem Stand des Wochenplans')
  console.error(`FEHLER: ${t.id} deutsch bis Folge ${hoechste}, die Wochenpläne haben aber nur bis Folge ${grenze} ausgespielt`)
}

/* Untergrenze, sonst ist ein Wächter ohne Fälle grün (Beyblade X und Netflix-Wochenstarts: >= 20 am 26.10.2026). */
if (geprueft < 10) {
  fehler++
  console.error(`FEHLER: nur ${geprueft} Titel mit Plan-Wegen geprüft — der Wächter misst nichts`)
}

console.log(`check-folgen-erschienen-bestand: ${fehler ? `${fehler} Fehler` : 'ok'} (${geprueft} Titel mit Wochenplan als einzigem Weg)`)
console.log(`VERSTÖSSE: ${fehler}`)
process.exit(fehler ? 1 : 0)
