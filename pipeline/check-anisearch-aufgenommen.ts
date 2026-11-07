/**
 * Zusicherung: aniSearch-Seiten, die ein AniList-Titel aufnimmt (`data/anisearch-seiten-aufgenommen.yaml`, Anlass Thus Spoke Kishibe Rohan:
 * Netflix führt eine Miniserie mit vier Folgen, wir hatten drei Titel), bekommen keine eigene Zeile und zählen als umgezogen; ihre alten Adressen leiten per `zuAk` (nach dem Bestandsbau eingetragen).
 * Läuft in `check:logic`; der Bau läuft wirklich (`baueTitel`) mit den echten Handdateien.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { baueTitel } from './bau/02-titel.ts'
import { anisearchUmgezogen, dubNurHinterToggle, ergaenzeAnisearchTitel } from './bau/anisearch-titel.ts'
import type { AniListMedia } from './lib/anilist.ts'
import { aufgenommeneSeiten, leseAufgenommeneSeiten } from './lib/anisearch-aufgenommen.ts'
import { ladeAkVon } from './lib/ausgabe-kennung.ts'
import { ROOT } from './lib/util.ts'
import type { Title } from '../shared/types.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const BASIS = 10_000_000

console.log('\nEchte Datei: Kishibe Rohan, Flavors of Youth, Baki Hanma:')
pruefe('die Handdatei nimmt 13343 und 14752 in 21778 auf', aufgenommeneSeiten[13343] === 21778 && aufgenommeneSeiten[14752] === 21778)
pruefe('die Handdatei nimmt 13418 und 13419 in 101231 auf', aufgenommeneSeiten[13418] === 101231 && aufgenommeneSeiten[13419] === 101231)
pruefe('die Handdatei nimmt 18616 in 146646 auf', aufgenommeneSeiten[18616] === 146646)
pruefe('genau diese fünf Seiten gehen auf', Object.keys(aufgenommeneSeiten).length === 5, aufgenommeneSeiten)

console.log('\nAlte Adressen leiten auf den aufnehmenden Titel (echte data/kennungen.json):')
{
  const { zeilen } = ladeAkVon(join(ROOT, 'data', 'kennungen.json'))
  /* Ausnahme seit 06.11.2026 (PR 3044): zuAk folgt, sobald ein Bestandsbau nach dem Merge auf main liegt; danach streichen. */
  const NOCH_OHNE_ZUAK = new Set([13418, 13419, 18616])
  for (const [seite, ziel] of Object.entries(aufgenommeneSeiten)) {
    if (NOCH_OHNE_ZUAK.has(Number(seite))) continue
    const zielAk = zeilen.find((z) => z[1] === ziel)?.[0]
    const alt = zeilen.find((z) => z[1] === BASIS + Number(seite) && z[2] === Number(seite))
    pruefe(`Seite ${seite}: die alte Zeile hat zuAk = ak von ${ziel}`, zielAk !== undefined && alt !== undefined && alt[3] === zielAk, { zielAk, alt })
  }
}

console.log('\nAnlegen der aniSearch-Zeilen (echte Einträge):')
{
  const zeilen = (titel: number[]) => {
    const t = new Map<number, Title>(titel.map((id) => [id, { id } as Title]))
    ergaenzeAnisearchTitel(t, new Map(), new Map())
    return t
  }
  const mit = zeilen([21778])
  pruefe('steht 21778 im Bestand, haben die beiden Seiten keine Zeile', !mit.has(BASIS + 13343) && !mit.has(BASIS + 14752))
  const ohne = zeilen([])
  pruefe('Gegenprobe: ohne 21778 stehen beide Seiten als eigene Zeile da', ohne.has(BASIS + 13343) && ohne.has(BASIS + 14752))
  pruefe('Gegenprobe: andere Seiten mit Deutsch bleiben (Death Note Relight 5194)', mit.has(BASIS + 5194))
  const flavors = zeilen([101231, 146646])
  pruefe('stehen 101231 und 146646 im Bestand, haben 13418, 13419 und 18616 keine Zeile', !flavors.has(BASIS + 13418) && !flavors.has(BASIS + 13419) && !flavors.has(BASIS + 18616))
  pruefe('Gegenprobe: nur 101231 im Bestand, bleibt 18616 eine Zeile', zeilen([101231]).has(BASIS + 18616) && !zeilen([101231]).has(BASIS + 13418))
  pruefe('Gegenprobe: nur 146646 im Bestand, bleiben 13418 und 13419 Zeilen', zeilen([146646]).has(BASIS + 13418) && zeilen([146646]).has(BASIS + 13419) && !zeilen([146646]).has(BASIS + 18616))
}

console.log('\nBaue den Titel wirklich (baueTitel):')
{
  const medium = (episodes: number) => ({ id: 21778, idMal: 33191, episodes, title: {} }) as AniListMedia
  const titel = baueTitel({ byMal: {}, confidenceRaw: {}, byAniId: { 21778: medium(4) } }).titles
  pruefe('im Bau steht 21778 mit vier Folgen und keine der beiden Seitenzeilen', titel.get(21778)?.episodes === 4 && !titel.has(BASIS + 13343) && !titel.has(BASIS + 14752), [...titel.keys()].filter((id) => id >= BASIS && [13343, 14752].includes(id - BASIS)))
}

console.log('\nUmzug und Deutsch-Riegel (Fixture mit anderen Kennungen):')
{
  const aufgenommen = { 7: 900001 }
  const eintraege = { 7: { t: 'x', ty: 'OVA', dub: 'd' as const } }
  pruefe('Umzug: steht der Titel im Hauptbestand, ist die Seite umgezogen', anisearchUmgezogen(new Set([900001]), new Set(), {}, eintraege, aufgenommen).has(BASIS + 7))
  pruefe('Gegenprobe: fehlt der Titel, ist sie es nicht', !anisearchUmgezogen(new Set([900002]), new Set(), {}, eintraege, aufgenommen).has(BASIS + 7))
  pruefe('Riegel: Seite mit Deutsch, deren aufnehmender Titel im Hauptbestand steht, braucht keinen Grund', dubNurHinterToggle(new Set([900001]), '2999-12-31', new Set(), {}, eintraege, new Set(), aufgenommen).length === 0)
  pruefe('Gegenprobe: ohne den Titel im Hauptbestand meldet der Riegel die Seite', dubNurHinterToggle(new Set([900002]), '2999-12-31', new Set(), {}, eintraege, new Set(), aufgenommen).join() === '7')
}

console.log('\nLesen der Handdatei:')
{
  const wurzel = mkdtempSync(join(tmpdir(), 'aufgenommen-'))
  const schreibe = (text: string) => {
    mkdirSync(join(wurzel, 'data'), { recursive: true })
    writeFileSync(join(wurzel, 'data', 'anisearch-seiten-aufgenommen.yaml'), text)
  }
  try {
    pruefe('fehlende Datei (Kulisse ohne sie): keine Zuordnung', Object.keys(leseAufgenommeneSeiten(wurzel)).length === 0)
    schreibe('')
    pruefe('leere Datei: keine Zuordnung', Object.keys(leseAufgenommeneSeiten(wurzel)).length === 0)
    schreibe('# nur Kommentar\n5: 900001\n6: 900002\n')
    pruefe('zwei Zeilen ergeben zwei Zuordnungen mit verschiedenen Werten', JSON.stringify(leseAufgenommeneSeiten(wurzel)) === '{"5":900001,"6":900002}')
    schreibe('5: "abc"\n')
    pruefe('Text statt Kennung bricht ab', (() => { try { leseAufgenommeneSeiten(wurzel); return false } catch { return true } })())
    schreibe('x: 900001\n')
    pruefe('Text statt Seite bricht ab', (() => { try { leseAufgenommeneSeiten(wurzel); return false } catch { return true } })())
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nOK')
