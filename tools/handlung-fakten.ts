/**
 * Faktensammler für eigene deutsche Handlungstexte: je Lückentitel Wikidata-Brücke (MAL P4086, aniSearch P12477) und geratene Wikipedia-Seitennamen,
 * dazu die Fakten der aniSearch-Archivseite (lokal, nie Netz). Ausgabe: je Titel eine Faktenkarte in `data/cache/handlung-fakten/karten/` (nicht getrackt).
 * Wikipedia nur per `/wiki/<Seite>?action=raw`, ein Abruf je Sekunde; Fehler bedeuten Pause, nie Abbruch. Ein zweiter Lauf holt nur Fehlendes nach (alles liegt im Cache).
 *
 *   npx tsx tools/handlung-fakten.ts --ids 195516,110265,10003453    nur diese Titel (Test)
 *   npx tsx tools/handlung-fakten.ts                                 alle Lückentitel (rund 15 bis 40 min)
 *   npx tsx tools/handlung-fakten.ts --max 20                        die ersten 20
 *
 * Endet mit Exit 0 (Messlauf) und schreibt zuletzt „ENDE 0“. Zählung titel / reihe / zu dünn in `data/cache/handlung-fakten/zusammenfassung.json`.
 * Danach: Stichpunkt-Schritt (Agent liest `<id>.quellsaetze.md`), Text-Schritt (Agent liest nur `<id>.md`), Wortnähe: `tools/handlung-naehe.ts`.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { ladeFakten } from './handlung-fakten/anisearch-karte.ts'
import { quelltexteVon, schreibeKarte } from './handlung-fakten/ablage.ts'
import { baueKarte } from './handlung-fakten/karte.ts'
import type { Karte } from './handlung-fakten/karte.ts'
import { findeLuecken } from './handlung-fakten/luecken.ts'
import { sammleWikipedia } from './handlung-fakten/seiten.ts'
import { CACHE } from './handlung-fakten/typen.ts'
import type { Luecke } from './handlung-fakten/typen.ts'
import { ladeBruecke, schluesselVon } from './handlung-fakten/wikidata.ts'
import { erstelleHoler, pruefeRobots } from './handlung-fakten/wikipedia.ts'

function argument(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function auswahl(alle: Luecke[]): Luecke[] {
  const ids = argument('--ids')?.split(',').map(Number)
  const gewaehlt = ids ? alle.filter((l) => ids.includes(l.id)) : alle
  return gewaehlt.slice(0, Number(argument('--max') ?? gewaehlt.length))
}

function zusammenfassung(karten: Karte[]): Record<string, number> {
  const zahl = (e: string) => karten.filter((k) => k.einordnung === e).length
  const nurEineQuelle = karten.filter((k) => k.einordnung === 'zu dünn' && k.zaehlung.quellen < 2 && k.zaehlung.titelSaetze + k.zaehlung.reiheSaetze >= 2).length
  return {
    titel: zahl('titel'),
    reihe: zahl('reihe'),
    'zu dünn': zahl('zu dünn'),
    'davon nur wegen einer Quelle (Sätze vorhanden)': nurEineQuelle,
    gesamt: karten.length,
    mitAbrufFehler: karten.filter((k) => k.abrufFehler.length).length,
  }
}

async function main(): Promise<void> {
  const luecken = auswahl(findeLuecken())
  console.log(`${new Date().toISOString()} ${luecken.length} Titel`)
  await pruefeRobots()
  const bruecke = await ladeBruecke(schluesselVon(luecken))
  const hole = erstelleHoler()
  const karten: Karte[] = []
  for (const [i, l] of luecken.entries()) {
    const as = l.anisearchSeite ? ladeFakten(l.anisearchSeite) : undefined
    const { funde, fehler } = await sammleWikipedia(l, bruecke, hole)
    const karte = baueKarte(l, funde, fehler, as)
    schreibeKarte(karte, quelltexteVon(l, funde, as))
    karten.push(karte)
    console.log(`${new Date().toISOString()} ${i + 1}/${luecken.length} ${l.id} ${karte.einordnung} (${karte.grund}) Seiten: ${funde.map((f) => `${f.sprache}:${f.seite}/${f.ebene}`).join(', ') || '–'}${fehler.length ? ` FEHL ${fehler.join(',')}` : ''}`)
  }
  mkdirSync(CACHE, { recursive: true })
  const z = zusammenfassung(karten)
  writeFileSync(`${CACHE}/${argument('--ids') || argument('--max') ? 'zusammenfassung-teil' : 'zusammenfassung'}.json`, JSON.stringify(z, null, 1))
  console.log(JSON.stringify(z))
}

await main()
console.log('ENDE 0')
