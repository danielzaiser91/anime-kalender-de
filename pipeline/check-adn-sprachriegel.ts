/**
 * Zusicherungen für den Sprachriegel des ADN-Sammlers (Anlass: Lauf vom 28.10.2026, 14:01 UTC).
 *
 * Der Ausschnitt `pipeline/fixtures/adn-sprachriegel-ausschnitt.json` stammt wörtlich aus dem
 * Archiv (Serie 1375 „Dorohedoro“ und 1433 „Suikoden“): `vorher` = Commit 4b8f4c268~1, `nachher` =
 * 4b8f4c268 (französische Kürzel), nur die Felder id, shortNumber, languages.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import {
  franzoesischeArchive,
  istFranzoesischeSicht,
  MAX_VERWORFEN,
  katalogBilanzZeile,
  mitUngepruftenAlten,
  riegelBilanz,
  schreibeArchiv,
  verworfen,
} from './lib/adn-sprachriegel.ts'

type Video = { id: number; shortNumber: string; languages: string[] }
const ausschnitt = JSON.parse(readFileSync(new URL('./fixtures/adn-sprachriegel-ausschnitt.json', import.meta.url), 'utf8')) as Record<
  string,
  { vorher: Video[]; nachher: Video[] }
>

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown) {
  if (bedingung) {
    console.log(`  ✓ ${name}`)
    return
  }
  fehler++
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const v = (...languages: string[]) => [{ languages }]
const legeAb = (dir: string, id: number, videos: Video[]) =>
  writeFileSync(join(dir, `${id}.json.gz`), gzipSync(JSON.stringify({ showId: id, videos }), { level: 9 }))
const lies = (dir: string, id: number) => readFileSync(join(dir, `${id}.json.gz`))

console.log('ADN-Sprachriegel: die französische Sicht überschreibt kein deutsches Archiv\n')

pruefe('echter Ausschnitt vorher (Dorohedoro, vostde+vde) ist deutsch', !istFranzoesischeSicht(ausschnitt['1375'].vorher))
pruefe('echter Ausschnitt nachher (Dorohedoro, vostf+vf) ist französisch', istFranzoesischeSicht(ausschnitt['1375'].nachher))
pruefe('Suikoden vorher (nur vostde) ist deutsch', !istFranzoesischeSicht(ausschnitt['1433'].vorher))
pruefe('Suikoden nachher (nur vostf) ist französisch', istFranzoesischeSicht(ausschnitt['1433'].nachher))
pruefe('nur vf ist französisch', istFranzoesischeSicht(v('vf')))
pruefe('gemischt vostf + vde ist keine reine französische Sicht', !istFranzoesischeSicht(v('vostf', 'vde')))
pruefe('gemischt vf + vostde ist keine reine französische Sicht', !istFranzoesischeSicht(v('vf', 'vostde')))
pruefe('leere Antwort ist keine französische Sicht', !istFranzoesischeSicht([]))
pruefe('Folgen ganz ohne Sprachangabe sind keine französische Sicht', !istFranzoesischeSicht([{}]))

const dir = mkdtempSync(join(tmpdir(), 'adn-riegel-'))
try {
  pruefe('Zähler startet leer', verworfen.length === 0, verworfen)
  const neuerOrdner = join(dir, 'unterordner')
  schreibeArchiv(neuerOrdner, 1375, ausschnitt['1375'].vorher)
  pruefe('fehlender Archivordner wird angelegt', lies(neuerOrdner, 1375).length > 0)
  legeAb(dir, 1375, ausschnitt['1375'].vorher)
  const alt = lies(dir, 1375)
  const ok = schreibeArchiv(dir, 1375, ausschnitt['1375'].nachher as Video[])
  pruefe('französische Antwort wird nicht geschrieben', ok === false && alt.equals(lies(dir, 1375)))
  pruefe('verworfene Serie wird gezählt', verworfen.length === 1 && verworfen[0] === 1375, verworfen)

  const gut = ausschnitt['1375'].vorher.map((x) => ({ ...x, shortNumber: x.shortNumber }))
  gut.pop()
  const ok2 = schreibeArchiv(dir, 1375, gut)
  const neu = JSON.parse(gunzipSync(lies(dir, 1375)).toString()) as { videos: Video[] }
  pruefe('deutsche Antwort wird geschrieben', ok2 === true && neu.videos.length === gut.length, neu.videos.length)
  pruefe('deutsche Antwort wird nicht gezählt', verworfen.length === 1, verworfen)

  verworfen.length = 0
  const ok3 = schreibeArchiv(dir, 1433, ausschnitt['1433'].nachher as Video[])
  let angelegt = true
  try {
    lies(dir, 1433)
  } catch {
    angelegt = false
  }
  pruefe('französische Antwort ohne altes Archiv legt keines an', ok3 === false && !angelegt && verworfen.length === 1)

  legeAb(dir, 1433, ausschnitt['1433'].nachher)
  legeAb(dir, 1375, ausschnitt['1375'].vorher)
  writeFileSync(join(dir, 'notiz.txt'), 'kein Archiv')
  pruefe('Bestandsscan findet genau das französische Archiv', franzoesischeArchive(dir).join() === '1433', franzoesischeArchive(dir))
  pruefe('Bestandsscan eines fehlenden Ordners ist leer', franzoesischeArchive(join(dir, 'gibtsnicht')).length === 0)
} finally {
  rmSync(dir, { recursive: true, force: true })
}

const eintrag = (showId: number, titel: string) => ({ showId, titel })
const katalogAlt = [eintrag(1, 'alt eins'), eintrag(2, 'alt zwei'), eintrag(3, 'alt drei'), eintrag(5, 'alt fünf'), eintrag(6, 'alt sechs')]
const katalogNeu = [eintrag(2, 'neu zwei'), eintrag(4, 'neu vier')]
// 1 abgebrochen, 2/3/4 vollständig beantwortet (3 ohne Deutsch), 5/6 nicht gefragt.
const auskunft = { gefragt: new Set([1, 2, 3, 4]), entschieden: new Set([2, 3, 4]) }
const ergebnis = mitUngepruftenAlten(katalogAlt, katalogNeu, auskunft)
const zusammen = ergebnis.shows.map((e) => e.titel)
pruefe('abgebrochene Serie ohne neuen Eintrag behält den alten', zusammen.includes('alt eins'), zusammen)
pruefe('nicht gefragte Serien behalten den alten Eintrag', zusammen.includes('alt fünf') && zusammen.includes('alt sechs'), zusammen)
pruefe('Serie mit neuem Eintrag nimmt den neuen, nicht den alten', zusammen.includes('neu zwei') && !zusammen.includes('alt zwei'), zusammen)
pruefe('frisch und vollständig ohne Deutsch beantwortet fällt weg', !zusammen.includes('alt drei'), zusammen)
pruefe('Reihenfolge: neue vor behaltenen alten', zusammen.join() === 'neu zwei,neu vier,alt eins,alt fünf,alt sechs', zusammen)
pruefe('Zähler je Weg: 2 nicht gefragt, 1 Abbruch, 1 entfernt', ergebnis.nichtGefragt === 2 && ergebnis.abbruch === 1 && ergebnis.entfernt === 1, ergebnis)
pruefe('Logzeile nennt alle drei Zähler', katalogBilanzZeile(ergebnis) === 'ADN-Katalog behalten: 2 nicht gefragt, 1 Abbruch, 1 entfernt', katalogBilanzZeile(ergebnis))
const alleBeantwortet = mitUngepruftenAlten(katalogAlt, katalogNeu, { gefragt: new Set([1, 2, 3, 5, 6]), entschieden: new Set([1, 2, 3, 5, 6]) })
pruefe('wenn alle vollständig antworteten, ist das Ergebnis der neue Katalog', alleBeantwortet.shows.length === 2 && alleBeantwortet.entfernt === 4, alleBeantwortet)

pruefe(`genau ${MAX_VERWORFEN} verworfene Serien sind noch nicht rot`, !riegelBilanz(MAX_VERWORFEN).rot)
pruefe(`${MAX_VERWORFEN + 1} verworfene Serien sind rot`, riegelBilanz(MAX_VERWORFEN + 1).rot)
pruefe('24 verworfene Serien (28.10.2026) sind rot', riegelBilanz(24).rot)
pruefe('Bilanzzeile nennt die Zahl', riegelBilanz(7).zeile.includes(' 7 Serien'), riegelBilanz(7).zeile)
pruefe('Obergrenze ist eine Handvoll (5)', MAX_VERWORFEN === 5, MAX_VERWORFEN)

console.log()
if (fehler) {
  console.error(`${fehler} Zusicherung(en) verletzt.`)
  console.log(`VERSTÖSSE: ${fehler}`)
  process.exit(1)
}
console.log('Alle Zusicherungen halten.')
console.log('VERSTÖSSE: 0')
