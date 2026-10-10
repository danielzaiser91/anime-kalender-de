/**
 * Zusicherung: Ein aniSearch-Titel, dessen Namensvorspann eine vorhandene Reihe nennt, steht nicht allein (Daniel, 10.10.2026: „Demon Slayer – Asakusa Arc“ und Geschwister
 * erschienen in der Datenbank trotz „gebündelt“ als Einzelkarten). Regel: `anisearchNamensKanten` in `bau/anisearch-titel.ts`.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-reihen-namen.ts`
 */
import { readFileSync } from 'node:fs'
import { todayIso } from '../shared/time.ts'
import type { Title } from '../shared/types.ts'
import { ANISEARCH_ID_BASIS, anisearchNamensKanten } from './bau/anisearch-titel.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/** Bis dahin darf der ausgelieferte Datensatz noch den Stand vor dem Fix tragen (der nächste Bestandsbau baut ihn neu); danach wird die Prüfung rot. */
const UEBERGANG_BIS = '2026-10-16'

const B = ANISEARCH_ID_BASIS
const titel = (id: number, titleEn: string, franchiseId = id) => ({ id, titleEn, franchiseId }) as unknown as Title
const wurzelVon = (m: Map<number, Title>) => (id: number) => m.get(id)!.franchiseId ?? id

console.log('\nReihenzuordnung aniSearch-Titel nach Namensvorspann:')
{
  const m = new Map<number, Title>([
    [1, titel(1, 'Demon Slayer: Kimetsu no Yaiba')],
    [2, titel(2, 'Demon Slayer: Kimetsu no Yaiba - Hashira Training Arc', 1)],
    [B + 5, titel(B + 5, 'Demon Slayer: Kimetsu no Yaiba - Asakusa Arc')],
    [B + 6, titel(B + 6, 'Demon Slayer: Kimetsu no Yaiba')], // gleicher voller Name: kein Vorspann, keine Kante
    [10, titel(10, 'Sword Art Online')],
    [11, titel(11, 'Sword Art Online', 99)],
    [B + 7, titel(B + 7, 'Sword Art Online: Alicization')], // zwei Reihen heißen gleich: mehrdeutig, keine Kante
    [12, titel(12, 'Kuma')],
    [B + 8, titel(B + 8, 'Kuma: Der Film')], // zu kurzer Vorspann zählt nicht (unter fünf Zeichen)
  ])
  const k = anisearchNamensKanten(m, wurzelVon(m))
  pruefe('Asakusa Arc kommt zur Reihe Demon Slayer', k.some((e) => e.ids[0] === 1 && e.ids[1] === B + 5))
  pruefe('Ein Titel mit dem vollen Namen der Reihe bekommt keine Kante auf sich selbst', !k.some((e) => e.ids[1] === B + 6))
  pruefe('Heißen zwei Reihen gleich, wird keine geraten', !k.some((e) => e.ids[1] === B + 7))
  pruefe('Ein Vorspann unter fünf Zeichen zählt nicht', !k.some((e) => e.ids[1] === B + 8))
}

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
  process.exit(1)
}
