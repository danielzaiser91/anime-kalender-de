/**
 * Gründe je Titel ohne Streaming-Weg messen (19.11.2026): ruft `baueOhneWeg()` auf `public/data` + `data/` mit dem heutigen Tag auf, wie `13-13-ohne-weg.ts`.
 *
 *   npx tsx tools/ohne-weg-gruende.ts                   Zahl je Grund, Summe, „offen“ nach Ursache
 *   npx tsx tools/ohne-weg-gruende.ts --json            dasselbe als JSON
 *   npx tsx tools/ohne-weg-gruende.ts --grund nur-disc  Titel (Kennung, Name) eines Grundes; auch `offen/jw-fremd` für eine Ursache
 *   npx tsx tools/ohne-weg-gruende.ts --heute 2026-11-19  Stichtag festlegen
 *
 * Liest nur, schreibt nichts, endet mit Exit 0 (Messlauf). Bedeutung der Gründe: docs/wissen/datensatz.md, Abschnitt „Gründe ohne Weg messen“.
 */
import { ladeOhneWegEingabe } from '../pipeline/bau/13-13-ohne-weg.ts'
import { zaehleGruende } from '../pipeline/bau/13-13-ohne-weg.ts'
import { baueOhneWeg, type OhneWegEingabe } from '../pipeline/lib/ohne-weg.ts'
import { offenUrsachen, OFFEN_URSACHEN } from '../pipeline/lib/ohne-weg-offen.ts'
import { OHNE_WEG_GRUENDE } from '../shared/ohne-weg.ts'
import type { Title } from '../shared/types.ts'

function argument(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

export function messe(eingabe: OhneWegEingabe = ladeOhneWegEingabe(), heute?: string) {
  if (heute) eingabe.heute = heute
  const eintraege = baueOhneWeg(eingabe)
  const ursachen = offenUrsachen(eingabe, eintraege)
  const je = (liste: readonly string[], von: (id: number) => string) =>
    Object.fromEntries(liste.map((g) => [g, Object.keys(eintraege).map(Number).filter((id) => von(id) === g).length]))
  return {
    heute: eingabe.heute,
    gesamt: Object.keys(eintraege).length,
    gruende: je(OHNE_WEG_GRUENDE, (id) => eintraege[id].reason),
    offen: Object.fromEntries(OFFEN_URSACHEN.map((u) => [u, [...ursachen.values()].filter((x) => x === u).length])),
    logzeile: zaehleGruende(eintraege),
    eingabe,
    eintraege,
    ursachen,
  }
}

function listeVon(m: ReturnType<typeof messe>, wahl: string): string[] {
  const [grund, ursache] = wahl.split('/')
  const namen = new Map(m.eingabe.titel.map((t) => [t.id, (t as Partial<Title>).titleDe ?? (t as Partial<Title>).titleRomaji ?? (t as Partial<Title>).titleEn ?? '']))
  return Object.keys(m.eintraege)
    .map(Number)
    .filter((id) => m.eintraege[id].reason === grund && (!ursache || m.ursachen.get(id) === ursache))
    .sort((a, b) => a - b)
    .map((id) => `${id}\t${namen.get(id) ?? ''}`)
}

function main(): void {
  const m = messe(undefined, argument('--heute'))
  const wahl = argument('--grund')
  if (wahl) return void console.log(listeVon(m, wahl).join('\n'))
  if (process.argv.includes('--json')) {
    return void console.log(JSON.stringify({ heute: m.heute, gesamt: m.gesamt, gruende: m.gruende, offen: m.offen, logzeile: m.logzeile }, null, 2))
  }
  console.log(`Titel ohne Streaming-Weg am ${m.heute}: ${m.gesamt}`)
  for (const [g, z] of Object.entries(m.gruende)) console.log(`  ${g.padEnd(14)} ${z}`)
  console.log('„offen“ nach Ursache:')
  for (const [u, z] of Object.entries(m.offen)) console.log(`  ${u.padEnd(26)} ${z}`)
  console.log(`Bau-Logzeile: ohne-weg.json: ${m.gesamt} Titel ohne Streaming-Weg (${m.logzeile})`)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
