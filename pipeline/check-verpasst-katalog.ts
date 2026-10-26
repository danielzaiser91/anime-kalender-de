/**
 * Zusicherung (26.10.2026): `katalogBeobachtungen` liefert nur deutsche Katalogfolgen der eigenen Serie und Staffel mit gültiger
 * Nummer, die bis heute (Berliner Tag) erschienen sind. Der Prozess-Fall steht in `check-termine-observed-lauf.ts`.
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-verpasst-katalog.ts`
 */
import { katalogBeobachtungen } from './lib/verpasst-katalog.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

const folge = (serieId: string, nummer: number | undefined, verfuegbarAb: string) => ({ serieId, serie: 'S', staffel: 'Staffel 3', nummer, verfuegbarAb })
const heute = '2026-10-26'
const sieh = (folgen: ReturnType<typeof folge>[]) => katalogBeobachtungen(folgen, 'GA', 3, heute)

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

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nAlle Zusicherungen halten.')
