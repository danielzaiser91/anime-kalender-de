/**
 * Bestandsteil von `check-anisearch-dubletten.ts`: Dasselbe Werk steht nicht als AniList-Katalogtitel und als aniSearch-Zeile in der Ausgabe (`titles.json`, `ohne-synchro.json`).
 * Liest `public/data` und gehört deshalb in `check:bestand`, nicht in `check:logic` (der Bestand liegt hinter neueren Rohdaten zurück;
 * PR-Ketten wurden daran rot, 12.10.2026). Die Einheitenprüfungen ohne Dateizugriff stehen in `check-anisearch-dubletten.ts`.
 */
import { readFileSync } from 'node:fs'
import { todayIso } from '../shared/time.ts'
import { anisearchZeilenDoppelt, findeAnisearchDubletten, type KatalogKandidat } from './bau/anisearch-dubletten.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const BASIS = 10_000_000

const lies = <T>(pfad: string): T => JSON.parse(readFileSync(pfad, 'utf8')) as T

/** Bis dahin darf der ausgelieferte Datensatz noch den Stand vor dem Fix tragen (der nächste Datenlauf baut ihn neu); danach wird die Prüfung rot. */
const UEBERGANG_BIS = '2026-10-16'

console.log('\nAusgelieferter Datensatz:')
{
  type Zeile = { id: number; malId?: number; format?: string; jpYear?: number; episodes?: number; ohneSynchro?: boolean; dubConfidence?: string }
  const eintraege = lies<Record<string, { mal?: number; ty: string; y?: number; f?: number; dub: string }>>('data/anisearch-eintraege.json')
  const titel = lies<Zeile[]>('public/data/titles.json')
  const ohne = lies<Zeile[]>('public/data/ohne-synchro.json')
  const katalog: KatalogKandidat[] = ohne.filter((t) => t.id < BASIS).map((t) => ({ id: t.id, mal: t.malId, format: t.format, jahr: t.jpYear, folgen: t.episodes }))
  const hinter = ohne.filter((t) => t.id >= BASIS).map((t) => t.id)
  const haupt = titel.filter((t) => t.id >= BASIS).map((t) => t.id)
  const u = findeAnisearchDubletten(hinter, haupt, katalog, eintraege)
  const doppelt = [...u.zeilenWeg, ...u.katalogWeg].map(([a, b]) => `${a} ↔ ${b}`)
  const bis = todayIso() <= UEBERGANG_BIS
  pruefe(
    `kein Werk steht als aniSearch-Zeile und als AniList-Katalogtitel zugleich (Übergang bis ${UEBERGANG_BIS}: ${doppelt.length} Paare)`,
    doppelt.length === 0 || bis,
    doppelt.slice(0, 5),
  )
  const ausgeliefert = anisearchZeilenDoppelt([...titel, ...ohne], eintraege)
  pruefe(`Ausgabe-Invariante auf dem Bestand (Übergang bis ${UEBERGANG_BIS}: ${ausgeliefert.length} Paare; der Bau selbst bricht ohne Übergang ab)`, ausgeliefert.length === 0 || bis, ausgeliefert.slice(0, 3))
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  console.log(`VERSTÖSSE: ${verletzt}`)
  process.exit(1)
}
console.log('\nOK')
console.log('VERSTÖSSE: 0')
