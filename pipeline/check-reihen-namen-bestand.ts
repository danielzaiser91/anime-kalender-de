/**
 * Bestandsteil von `check-reihen-namen.ts`: Kein alleinstehender aniSearch-Titel nennt im Namen eine vorhandene Reihe (`titles.json`, `ohne-synchro.json`).
 * Liest `public/data` und gehört deshalb in `check:bestand`, nicht in `check:logic` (der Bestand liegt hinter neueren Rohdaten zurück;
 * PR-Ketten wurden daran rot, 12.10.2026). Die Einheitenprüfungen ohne Dateizugriff stehen in `check-reihen-namen.ts`.
 */
import { readFileSync } from 'node:fs'
import { todayIso } from '../shared/time.ts'
import type { Title } from '../shared/types.ts'
import { anisearchNamensKanten } from './bau/anisearch-titel.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const wurzelVon = (m: Map<number, Title>) => (id: number) => m.get(id)!.franchiseId ?? id

/** Bis dahin darf der ausgelieferte Datensatz noch den Stand vor dem Fix tragen (der nächste Bestandsbau baut ihn neu); danach wird die Prüfung rot. */
const UEBERGANG_BIS = '2026-10-16'

console.log('\nAusgelieferter Datensatz:')
{
  const lies = (p: string): Title[] => JSON.parse(readFileSync(p, 'utf8')) as Title[]
  const alle = new Map<number, Title>([...lies('public/data/titles.json'), ...lies('public/data/ohne-synchro.json')].map((t) => [t.id, t]))
  const offen = anisearchNamensKanten(alle, wurzelVon(alle)).map((e) => alle.get(e.ids[1]!)?.titleEn ?? e.ids[1])
  if (offen.length && todayIso() <= UEBERGANG_BIS) console.log(`  … ${offen.length} alleinstehende aniSearch-Titel nennen eine Reihe (Übergang bis ${UEBERGANG_BIS}, der nächste Bestandsbau gruppiert sie)`)
  else pruefe('Kein alleinstehender aniSearch-Titel nennt im Namen eine vorhandene Reihe', offen.length === 0, offen.slice(0, 5))
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  console.log(`VERSTÖSSE: ${verletzt}`)
  process.exit(1)
}
console.log('VERSTÖSSE: 0')
