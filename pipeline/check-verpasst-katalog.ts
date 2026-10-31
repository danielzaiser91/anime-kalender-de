/**
 * Zusicherung (26.10.2026): `katalogBeobachtungen` liefert nur deutsche Katalogfolgen der eigenen Serie und Staffel mit gültiger
 * Nummer, die bis heute (Berliner Tag) erschienen sind. Der Prozess-Fall steht in `check-termine-observed-lauf.ts`.
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-verpasst-katalog.ts`
 */
import { katalogBeobachtungen, katalogOhneTag, keinVerworfen } from './lib/verpasst-katalog.ts'
import type { NeueFolge } from './lib/cr-neu-wache.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

const folge = (serieId: string, nummer: number | undefined, verfuegbarAb: string) => ({ serieId, serie: 'S', staffel: 'Staffel 3', nummer, verfuegbarAb })
const heute = '2026-10-26'
const sieh = (folgen: NeueFolge[]) => katalogBeobachtungen(folgen, 'GA', 3, heute)

const ok = sieh([folge('GA', 2, '2026-10-25T15:00:00.000Z')])
pruefe('Folge von heute oder früher zählt', ok.length === 1 && ok[0]!.date === '2026-10-25' && ok[0]!.episode === 2, ok)
const heuteFolge = sieh([folge('GA', 3, '2026-10-26T15:00:00.000Z')])
pruefe('Folge genau am heutigen Tag zählt', heuteFolge.length === 1, heuteFolge)
const morgen = sieh([folge('GA', 2, '2026-10-27T15:00:00.000Z')])
pruefe('Folge für morgen ist angekündigt, keine Sichtung', morgen.length === 0, morgen)
const nullNr = sieh([folge('GA', 0, '2026-10-25T15:00:00.000Z')])
pruefe('Nummer 0 zählt nicht', nullNr.length === 0, nullNr)
const ohneNr = sieh([folge('GA', undefined, '2026-10-25T15:00:00.000Z')])
pruefe('ohne Nummer zählt nicht', ohneNr.length === 0, ohneNr)
const fremd = sieh([folge('GB', 2, '2026-10-25T15:00:00.000Z')])
pruefe('fremde Serie bei gleicher Staffel und Nummer zählt nicht', fremd.length === 0, fremd)
const andereStaffel = katalogBeobachtungen([folge('GA', 2, '2026-10-25T15:00:00.000Z')], 'GA', 2, heute)
pruefe('andere Staffel derselben Serie zählt nicht', andereStaffel.length === 0, andereStaffel)
const berlin = katalogBeobachtungen([folge('GA', 2, '2026-10-25T23:30:00.000Z')], 'GA', 3, '2026-10-25')
pruefe('23:30 UTC ist schon der nächste Berliner Tag, bei heute = Vortag keine Sichtung', berlin.length === 0, berlin)

/* Echte Form der fünf Fälle aus der Katalogdatei (26.10.2026): ausstrahlung, aber kein verfuegbarAb. */
const ohneAb = (gesehenAm: string, nummer = 9) => ({ serieId: 'GA', serie: 'S', staffel: 'Staffel 3', nummer, gesehenAm })
const rueckfall = sieh([ohneAb('2026-09-12')])
pruefe('ohne verfuegbarAb zählt gesehenAm als Tag', rueckfall.length === 1 && rueckfall[0]!.date === '2026-09-12' && rueckfall[0]!.episode === 9, rueckfall)
const rueckMorgen = sieh([ohneAb('2026-10-27')])
pruefe('Rückfall am morgigen Tag ist keine Sichtung', rueckMorgen.length === 0, rueckMorgen)
const beideTage = sieh([{ ...ohneAb('2026-10-26'), verfuegbarAb: '2026-10-25T15:00:00.000Z' }])
pruefe('verfuegbarAb schlägt gesehenAm', beideTage.length === 1 && beideTage[0]!.date === '2026-10-25', beideTage)
const kaputtAb = sieh([{ ...ohneAb('2026-09-12'), verfuegbarAb: 'kein Datum' }])
pruefe('unlesbares verfuegbarAb fällt auf gesehenAm zurück', kaputtAb.length === 1 && kaputtAb[0]!.date === '2026-09-12', kaputtAb)
const kaputtGesehen = sieh([ohneAb('gestern')])
pruefe('weder Tag noch Rückfall: keine Sichtung', kaputtGesehen.length === 0, kaputtGesehen)
pruefe('Rückfall-Sichtung trägt rueckfall', rueckfall[0]!.rueckfall === true, rueckfall)
pruefe('Sichtung aus verfuegbarAb trägt kein rueckfall', ok[0]!.rueckfall === undefined, ok)
const zaehl = keinVerworfen()
katalogBeobachtungen(
  [
    folge('GA', 2, '2026-10-26T15:00:00.000Z'),
    folge('GA', 3, '2026-10-27T15:00:00.000Z'),
    folge('GA', 0, '2026-10-24T15:00:00.000Z'),
    folge('GA', undefined, '2026-10-24T15:00:00.000Z'),
    { ...folge('GA', 4, '2026-10-24T15:00:00.000Z'), staffel: 'Staffel 2' },
    { serieId: 'GA', serie: 'S', staffel: 'Staffel 3', nummer: 6 },
    folge('GB', 7, '2026-10-24T15:00:00.000Z'),
  ],
  'GA',
  3,
  heute,
  zaehl,
)
pruefe('Zähler je Verwerfungspfad', zaehl.angekuendigt === 1 && zaehl.ohneNummer === 2 && zaehl.andereStaffel === 1 && zaehl.ohneTag === 1 && zaehl.ohneSerieOderStaffel === 0, zaehl)
const ohneSerie = keinVerworfen()
katalogBeobachtungen([], undefined, 3, heute, ohneSerie)
katalogBeobachtungen([], 'GA', undefined, heute, ohneSerie)
pruefe('Zähler ohne Serie oder Staffel', ohneSerie.ohneSerieOderStaffel === 2, ohneSerie)
const nurJahr = sieh([ohneAb('2026')])
pruefe('gesehenAm nur als Jahr ist kein Tag', nurJahr.length === 0, nurJahr)
const fremdOhneAb = sieh([{ ...ohneAb('2026-09-12'), serieId: 'GB' }])
pruefe('Rückfall hebt die Serien-Prüfung nicht auf', fremdOhneAb.length === 0, fremdOhneAb)
const ohneTag = katalogOhneTag([ohneAb('2026-09-12'), ohneAb('x', 3), { serieId: 'GA', nummer: 4 }, folge('GA', 5, '2026-10-25T15:00:00.000Z')])
pruefe('katalogOhneTag nennt genau die Folgen ohne jeden Tag', ohneTag.length === 2 && ohneTag[0]!.nummer === 3 && ohneTag[1]!.nummer === 4, ohneTag)
pruefe('katalogOhneTag: leere Liste', katalogOhneTag([]).length === 0, katalogOhneTag([]))

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nAlle Zusicherungen halten.')
