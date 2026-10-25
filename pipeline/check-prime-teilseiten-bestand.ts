/**
 * Bestandsteil von `check-prime-teilseiten.ts`: Bereiche geteilter Prime-Wege in `titles.json` und die Prüfliste.
 * Liest `public/data` und gehört deshalb in `check:bestand`, nicht in `check:logic` (der Bestand liegt hinter neueren Rohdaten zurück;
 * PR-Ketten wurden daran rot, 12.10.2026). Die Einheitenprüfungen ohne Dateizugriff stehen in `check-prime-teilseiten.ts`.
 */
import { existsSync } from 'node:fs'
import { readJson } from './lib/util.ts'
import { PRIME_PRUEFLISTE } from './bau/09-7-prime-teilseiten.ts'
import type { TeilseitenPruefung } from './lib/teilseiten.ts'
import type { Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${typeof info === 'string' ? info : JSON.stringify(info)}`)
}

// Echter Bestand (nach einem Bau): Bereiche geteilter Prime-Wege liegen in unserer Zählung, die Prüfliste ist stimmig.
const OUT = 'public/data/titles.json'
if (existsSync(OUT)) {
  const titel = new Map(readJson<Title[]>(OUT, []).map((t) => [t.id, t]))
  const geteilt = [...titel.values()].flatMap((t) => t.streams.filter((s) => s.platform === 'primevideo' && s.sharedWith && s.dubRanges?.length).map((s) => ({ t, s })))
  const ueber = geteilt.filter(({ t, s }) => !t.episodes || s.dubRanges!.filter((r) => r.dub).some((r) => r.from < 1 || r.to < r.from || r.to > t.episodes!))
  pruefe('Bestand: Bereiche geteilter Prime-Wege liegen in 1 bis Folgenzahl', ueber.length === 0, ueber.map((x) => x.t.id).slice(0, 10).join())
  const liste = readJson<TeilseitenPruefung[]>(PRIME_PRUEFLISTE, [])
  // Auch Katalog-Titel ohne Weg stehen auf einer Prüfliste; sie liegen in franchises.json, nicht in titles.json.
  const katalog = new Set(Object.values(readJson<Record<string, { id: number }[]>>('public/data/franchises.json', {})).flatMap((r) => r.map((g) => g.id)))
  pruefe('Bestand: die Prüfliste nennt nur vorhandene Titel mit Grund', liste.every((p) => (titel.has(p.titleId) || katalog.has(p.titleId)) && p.grund.length > 0))
  pruefe('Bestand: kein Titel steht mit Bereich und auf der Prüfliste', liste.every((p) => !geteilt.some(({ t, s }) => t.id === p.titleId && s.url === p.url)))
}

if (fehler) {
  console.error(`${fehler} Zusicherung(en) zu den geteilten Prime-Seiten am Bestand verletzt`)
  console.log(`VERSTÖSSE: ${fehler}`)
  process.exit(1)
}
console.log('Geteilte Prime-Seiten (Bestand): Zusicherungen erfüllt')
console.log('VERSTÖSSE: 0')
