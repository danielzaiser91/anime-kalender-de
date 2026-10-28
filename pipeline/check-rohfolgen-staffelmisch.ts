/**
 * Riegel gegen vermischte Alt-Zeilen (28.10.2026): Prime-Rohfolgen mit Staffelangabe, gemeldet vor dem Staffelwechsel-Fix
 * (15.09.2026) und ohne Seitenkennung, werden nicht zugeordnet, sondern abgehakt. Die Fälle stammen wörtlich aus der
 * Meldungskopie vom 24.10.2026 (Bungo Stray Dogs 10.09., Okko-Film 13.09., Higurashi Kai 30.08.).
 */
import { bereinigeAltbestand, istStaffelmischVerdacht, ohneStaffelmischung, STAFFELWECHSEL_BEHOBEN } from './lib/rohfolgen-staffelmisch.ts'

let fehler = 0
const pruefe = (name: string, ok: boolean, gefunden?: unknown) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler++
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}

const zeile = (id: number, url: string, titel: string, rest: Record<string, unknown> = {}) => ({
  id,
  url,
  nummer: id,
  titel,
  erschienen: null as string | null,
  sprachen: '["Deutsch"]',
  gemeldet_am: '2026-09-10T06:49:16Z',
  plattform: 'primevideo' as string | null,
  staffel_nr: 5 as number | null,
  seiten_kennung: null as string | null,
  ...rest,
})

const bungo = zeile(18012, 'https://www.amazon.de/dp/B0BZGQZCFT', 'Die Zukunft ist unvorhersehbar und änderbar')
const okko = zeile(19531, 'https://www.amazon.de/dp/amzn1.dv.gti.3cb88c42-8aba-78c5-3026-ee065e93', 'Okko und ihre Geisterfreunde - Der Film', {
  staffel_nr: null,
  gemeldet_am: '2026-09-13T18:16:52Z',
})
const higurashi = zeile(1, 'https://www.amazon.de/dp/B09KX2VLPR', 'Wiedervereinigung', { staffel_nr: 1, gemeldet_am: '2026-08-30T10:01:24Z' })

console.log('Staffelwechsel-Riegel der Rohfolgen\n')
pruefe('Bungo vor dem Fix, ohne Seitenkennung: Verdacht', istStaffelmischVerdacht(bungo))
pruefe('Higurashi Kai (Staffeltext und Nummer gleich, trotzdem vermischt): Verdacht', istStaffelmischVerdacht(higurashi))
pruefe('Okko-Film ohne Staffelangabe: kein Verdacht', !istStaffelmischVerdacht(okko))
pruefe('mit Seitenkennung: kein Verdacht', !istStaffelmischVerdacht({ ...bungo, seiten_kennung: 'B0BZGQZCFT' }))
pruefe('nach dem Fix gemeldet: kein Verdacht', !istStaffelmischVerdacht({ ...bungo, gemeldet_am: '2026-09-17T00:00:00Z' }))
pruefe('Grenze: genau STAFFELWECHSEL_BEHOBEN gilt schon als behoben', !istStaffelmischVerdacht({ ...bungo, gemeldet_am: STAFFELWECHSEL_BEHOBEN }))
pruefe('Grenze: eine Sekunde davor ist Verdacht', istStaffelmischVerdacht({ ...bungo, gemeldet_am: '2026-09-15T23:59:59Z' }))
pruefe('Netflix mit Staffelangabe: kein Verdacht', !istStaffelmischVerdacht({ ...bungo, plattform: 'netflix' }))
pruefe('Disney+ mit Staffelangabe: kein Verdacht', !istStaffelmischVerdacht({ ...bungo, plattform: 'disneyplus' }))
pruefe('ohne Plattformangabe gilt als Prime (Altzeilen)', istStaffelmischVerdacht({ ...bungo, plattform: null }))
pruefe('Staffelnummer 0 ist eine Angabe, kein Fehlen', istStaffelmischVerdacht({ ...bungo, staffel_nr: 0 }))

const gemischt = ohneStaffelmischung([bungo, okko, higurashi])
pruefe('ohneStaffelmischung behält nur den Film', gemischt.folgen.length === 1 && gemischt.folgen[0]!.id === 19531, gemischt.folgen.map((f) => f.id))
pruefe('ohneStaffelmischung meldet die verworfenen Kennungen', JSON.stringify(gemischt.verworfen) === '[18012,1]', gemischt.verworfen)
const eingabe = [okko]
pruefe('nichts zu verwerfen: dieselbe Liste zurück', ohneStaffelmischung(eingabe).folgen === eingabe && ohneStaffelmischung(eingabe).verworfen.length === 0)

/* Die Verdrahtung: Doppelte und Verdacht zusammen, beide landen in `veraltet`. */
const doppelt = { ...okko, id: 19000, gemeldet_am: '2026-09-12T00:00:00Z' }
const alles = bereinigeAltbestand([bungo, doppelt, okko])
pruefe('bereinigeAltbestand: Doppelte und Verdacht zusammen abgehakt', JSON.stringify([...alles.veraltet].sort()) === JSON.stringify([18012, 19000].sort()), alles.veraltet)
pruefe('bereinigeAltbestand: die jüngste Okko-Zeile bleibt', alles.folgen.length === 1 && alles.folgen[0]!.id === 19531, alles.folgen.map((f) => f.id))

if (fehler) {
  console.error(`FEHL check-rohfolgen-staffelmisch: ${fehler} Zusicherung(en) rot`)
  process.exit(1)
}
console.log('OK check-rohfolgen-staffelmisch: 16 Zusicherungen')
