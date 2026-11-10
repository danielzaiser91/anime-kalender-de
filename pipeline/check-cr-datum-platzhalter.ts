/**
 * Crunchyrolls Tages-Platzhalter (23:59 Pacific) ersetzt keinen zuvor gelesenen Termin (Wochenlauf 10.11.2026, PR 3372).
 * Die Folgen von „The Maid I Hired Recently Is Mysterious“ stehen wörtlich so in `data/crunchyroll-dub.json` auf main (Stand 12.10.2026)
 * und im Fund des Wochenlaufs (PR 3372, Kopf c7f8af0); „How Not to Summon a Demon Lord“ ist die Staffel mit Platzhalter bei jeder Folge.
 * Der Kreislauf läuft über `serieAblegen`, die Stelle, an der der Lauf den Bestand schreibt.
 * Aufruf: npx tsx pipeline/check-cr-datum-platzhalter.ts
 */
import { serieAblegen } from './lib/cr-frisch.ts'
import { halteBelegteTermine, istTagesPlatzhalter } from './lib/cr-datum-platzhalter.ts'
import type { CrSerie } from './lib/crunchyroll-dub.ts'

let verletzt = 0
let gesamt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  gesamt++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const URL_MAID = 'https://crunchyroll.com/de/series/GG5H5X092'
const GUIDS = ['G2XU0WJ4J', 'GX9UQG5ZV', 'GEVUZ2XM8', 'G9DUEJNX9', 'GEVUZM0XG', 'GZ7UVKP50', 'GEVUZME7E', 'G7PU4E97J', 'GG1U294J3', 'GJWU2ZNVG', 'G50UZQMK9']
const MAID_12_10 = ['2022-08-13T21:30:00Z', '2022-08-20T21:30:00Z', '2022-08-27T21:30:00Z', '2022-09-03T21:30:00Z', '2022-09-10T21:30:00Z', '2022-09-17T21:30:00Z', '2022-10-01T21:30:00Z', '2022-10-01T21:30:00Z', '2022-10-08T21:30:00Z', '2022-10-15T21:30:00Z', '2022-10-22T21:30:00Z']
const MAID_10_11 = ['2022-08-14T03:00:00Z', '2022-08-21T03:00:00Z', '2022-08-28T03:00:00Z', '2022-09-04T03:00:00Z', '2022-09-11T03:00:00Z', '2022-09-04T06:59:00Z', '2022-09-11T06:59:00Z', '2022-09-18T06:59:00Z', '2022-09-25T06:59:00Z', '2022-10-02T06:59:00Z', '2022-10-09T06:59:00Z']

const serie = (url: string, termine: (string | undefined)[], guids = GUIDS): CrSerie => ({
  url,
  seriesId: url.split('/').pop(),
  katalog: 'de',
  geprueftAm: '2026-11-10',
  staffeln: [{ name: 'S1', folgen: termine.length, kacheln: termine.length, deutsch: termine.length, fremd: 0, deutscheFolgen: termine.map((verfuegbarAb, i) => ({ nummer: i + 1, guid: guids[i]!, verfuegbarAb })) }],
})
const termineVon = (s: CrSerie | undefined): (string | undefined)[] => (s?.staffeln?.[0]?.deutscheFolgen ?? []).map((f) => f.verfuegbarAb)
const ablegen = (bestand: Map<string, CrSerie>, s: CrSerie): void => void serieAblegen(bestand, s.url, s, s.seriesId!, new Map())

console.log('\nTages-Platzhalter erkennen (23:59 Pacific)')
pruefe('Sommer: 06:59Z ist 23:59 PDT', istTagesPlatzhalter('2022-09-04T06:59:00Z'))
pruefe('Winter: 07:59Z ist 23:59 PST', istTagesPlatzhalter('2018-01-12T07:59:00Z'))
pruefe('Winter 06:59Z (22:59 PST) ist keiner', !istTagesPlatzhalter('2018-01-12T06:59:00Z'))
pruefe('Sommer 07:59Z (00:59 PDT) ist keiner', !istTagesPlatzhalter('2022-09-04T07:59:00Z'))
pruefe('eine Minute daneben ist keiner', !istTagesPlatzhalter('2022-09-04T06:58:00Z') && !istTagesPlatzhalter('2022-09-04T07:00:00Z'))
pruefe('echte Uhrzeit, fehlender und kaputter Wert sind keine', !istTagesPlatzhalter('2022-08-13T21:30:00Z') && !istTagesPlatzhalter(undefined) && !istTagesPlatzhalter('kein Datum'))

console.log('\nMaid I Hired Recently: Stand 12.10. gegen Fund 10.11. (Folge 6 bis 11 sind Platzhalter)')
{
  const r = halteBelegteTermine(serie(URL_MAID, MAID_12_10), serie(URL_MAID, MAID_10_11))
  const t = termineVon(r.serie)
  pruefe('Folge 6 bis 11 behalten den Stand vom 12.10., 6 gehalten', r.gehalten === 6 && JSON.stringify(t.slice(5)) === JSON.stringify(MAID_12_10.slice(5)), r.gehalten)
  pruefe('Folge 1 bis 5 (03:00Z, keine Platzhalter) übernehmen den neuen Stand', JSON.stringify(t.slice(0, 5)) === JSON.stringify(MAID_10_11.slice(0, 5)), t.slice(0, 5))
  pruefe('die Termine steigen mit der Folgennummer (Folge 6 nicht vor Folge 5)', t.every((x, i) => i === 0 || x! >= t[i - 1]!), t)
}

console.log('\nKreislauf über serieAblegen: erster Lauf, Fund mit Platzhaltern, Lauf mit echter Änderung')
{
  const bestand = new Map<string, CrSerie>()
  ablegen(bestand, serie(URL_MAID, MAID_12_10))
  ablegen(bestand, serie(URL_MAID, MAID_10_11))
  pruefe('zweiter Lauf: Platzhalter ersetzen nichts', JSON.stringify(termineVon(bestand.get(URL_MAID)).slice(5)) === JSON.stringify(MAID_12_10.slice(5)))
  const echt = MAID_10_11.map((x, i) => (i === 5 ? '2022-09-17T21:00:00Z' : x))
  ablegen(bestand, serie(URL_MAID, echt))
  pruefe('dritter Lauf: ein echter neuer Termin (Folge 6, 21:00Z) wird übernommen', termineVon(bestand.get(URL_MAID))[5] === '2022-09-17T21:00:00Z', termineVon(bestand.get(URL_MAID))[5])
  pruefe('dritter Lauf: Folge 7 bis 11 bleiben auf dem belegten Stand', JSON.stringify(termineVon(bestand.get(URL_MAID)).slice(6)) === JSON.stringify(MAID_12_10.slice(6)))
}

console.log('\nGrenzen')
{
  const url = 'https://crunchyroll.com/de/series/GYZJXWWGR'
  const g = ['A', 'B', 'C']
  const alt = serie(url, ['2021-10-21T16:00:00Z', '2021-10-21T16:00:00Z', '2021-10-21T16:00:00Z'], g)
  const neu = serie(url, ['2018-07-06T06:59:00Z', '2018-07-13T06:59:00Z', '2018-07-20T06:59:00Z'], g)
  pruefe('Demon Lord: Platzhalter bei jeder Folge, der deutsche Termin von 2021 bleibt', JSON.stringify(termineVon(halteBelegteTermine(alt, neu).serie)) === JSON.stringify(termineVon(alt)))
  pruefe('ohne früheren Stand bleibt der neue Wert (nichts zu halten)', halteBelegteTermine(undefined, neu).gehalten === 0 && termineVon(halteBelegteTermine(undefined, neu).serie)[0] === '2018-07-06T06:59:00Z')
  const altPlatzhalter = serie(url, ['2023-04-28T06:59:00Z', '2023-04-28T06:59:00Z', undefined], g)
  const neuEcht = serie(url, ['2023-04-27T15:00:00Z', '2023-04-27T15:00:00Z', '2023-04-27T15:00:00Z'], g)
  pruefe('früher Platzhalter, jetzt echte Uhrzeit: der neue Wert gilt', halteBelegteTermine(altPlatzhalter, neuEcht).gehalten === 0)
  pruefe('früher Platzhalter, jetzt anderer Platzhalter: der neue Wert gilt (nichts Belegtes zu halten)', halteBelegteTermine(altPlatzhalter, serie(url, ['2023-04-29T06:59:00Z', '2023-04-29T06:59:00Z', '2023-04-29T06:59:00Z'], g)).gehalten === 0)
  pruefe('anderer Termin ohne Platzhalter wird nie gehalten', halteBelegteTermine(alt, serie(url, ['2021-10-22T16:00:00Z', '2021-10-22T16:00:00Z', '2021-10-22T16:00:00Z'], g)).gehalten === 0)
  pruefe('gleiche Folge, anderer Block mit anderer Kennung: nichts wird gehalten', halteBelegteTermine(alt, serie(url, ['2018-07-06T06:59:00Z', '2018-07-13T06:59:00Z', '2018-07-20T06:59:00Z'], ['X', 'Y', 'Z'])).gehalten === 0)
  const fremd = serie('https://crunchyroll.com/de/series/GFREMD', ['2022-01-01T10:00:00Z'], ['F'])
  const bestand = new Map<string, CrSerie>([[fremd.url, fremd]])
  ablegen(bestand, alt)
  ablegen(bestand, neu)
  pruefe('eine fremde Serie im Bestand bleibt byte-gleich', JSON.stringify(bestand.get(fremd.url)) === JSON.stringify(fremd))
}

if (verletzt) {
  console.error(`\n${verletzt} Verstöße`)
  process.exit(1)
}
console.log(`\ncheck-cr-datum-platzhalter: ${gesamt} Zusicherungen erfüllt`)
