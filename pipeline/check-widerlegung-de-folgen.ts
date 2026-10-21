/**
 * Zusicherung (20.10.2026): Eine Widerlegung löst den geteilten Crunchyroll-Weg nicht, wenn der Katalog
 * deutsche Folgen ab dem Tag der Widerlegung führt (Reincarnated Aristocrat S3: Folge 1 deutsch ab 18.10.).
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-widerlegung-de-folgen.ts`
 */
import type { Release, Title } from '../shared/types.ts'
import type { CrDubData } from './lib/crunchyroll-dub.ts'
import { deutscheBereicheSeit, loeseGeteilteWegeVonWiderlegten } from './bau/widerlegung-woche.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const URL_A = 'https://www.crunchyroll.com/de/series/GTESTA/a'
const URL_B = 'https://www.crunchyroll.com/de/series/GTESTB/b'
const URL_C = 'https://www.crunchyroll.com/de/series/GTESTC/c'
const URL_D = 'https://www.crunchyroll.com/series/GTESTD/d'
const URL_E = 'https://www.crunchyroll.com/de/series/GTESTE/e'
const URL_F = 'https://www.crunchyroll.com/de/series/GTESTF/f'
const URL_G = 'https://www.crunchyroll.com/de/series/GTESTG/g'
const URL_H = 'https://www.crunchyroll.com/de/series/GTESTH/h'
const URL_I = 'https://www.crunchyroll.com/de/series/GTESTI/i'
const folge = (nummer: number, verfuegbarAb?: string) => ({ nummer, guid: `G${nummer}`, verfuegbarAb })
const staffel = (name: string, deutscheFolgen: ReturnType<typeof folge>[]) => ({ name, folgen: 12, kacheln: 12, deutsch: 1, fremd: 0, deutscheFolgen })
const serie = (url: string, deutscheFolgen: ReturnType<typeof folge>[]) => ({
  url,
  katalog: 'de',
  geprueftAm: '2026-10-19',
  staffeln: [staffel('Staffel 3', deutscheFolgen)],
})
const crDub = {
  scrapedAt: '',
  serien: [
    serie(URL_A, [folge(5, '2026-10-01T15:00:00Z'), folge(1, '2026-10-18T15:00:00Z'), folge(2, '2026-10-25T15:00:00Z'), folge(3, '2026-10-26T15:00:00Z'), folge(9, undefined)]),
    serie(URL_B, [folge(4, '2026-10-17T23:00:00Z')]),
    serie(URL_C, []),
    /* G: Folgen 1 bis 5 deutsch nach der Widerlegung; H: nur Folge 4; I: nur Folge 1. */
    serie(URL_G, [1, 2, 3, 4, 5].map((n) => folge(n, '2026-10-20T15:00:00Z'))),
    serie(URL_H, [folge(4, '2026-10-20T15:00:00Z')]),
    serie(URL_I, [folge(1, '2026-10-20T15:00:00Z')]),
    { ...serie(URL_D, [folge(1, '2026-10-20T15:00:00Z')]), katalog: 'ja' },
    /* E: Staffel 3 ohne deutsche Folge, die Schwesterstaffeln 2 und 4 mit Folge 1 deutsch nach der Widerlegung. */
    { ...serie(URL_E, []), staffeln: [staffel('Staffel 2', [folge(1, '2026-10-19T15:00:00Z')]), staffel('Staffel 3', []), staffel('Staffel 4', [folge(1, '2026-10-25T15:00:00Z')])] },
    /* F: Staffel 3 mit Folge 0 (Special) und doppelt geführter Folge 1; Staffel 4 mit eigener Folge 2. */
    { ...serie(URL_F, []), staffeln: [staffel('Staffel 3', [folge(0, '2026-10-18T15:00:00Z'), folge(1, '2026-10-18T15:00:00Z'), folge(1, '2026-10-18T16:00:00Z')]), staffel('Staffel 4', [folge(2, '2026-10-26T15:00:00Z')])] },
  ],
} as unknown as CrDubData

/** Die Reihe: Staffel 1 bis 3 mit eigener Nummer im Namen; der Titel mit der Kennung 900001 ist Staffel 3 (Folgenzahl 12; `0` lässt sie offen, wie im Bestand am 20.10.2026). */
function reihe(id: number, url: string, folgen: number | null = 12): Map<number, Title> {
  const stream = { platform: 'crunchyroll', url, dub: true, sharedWith: 3 }
  const teil = (tid: number, name: string, jpYear: number, episodes?: number | null) =>
    ({ id: tid, franchiseId: 900099, format: 'TV', titleDe: name, jpYear, episodes: episodes ?? undefined, streams: tid === id ? [stream] : [] }) as unknown as Title
  return new Map(
    [teil(900099, 'Reihe', 2023, 12), teil(900098, 'Reihe: Staffel 2', 2024, 12), teil(id, 'Reihe: Staffel 3', 2026, folgen)].map((t) => [t.id, t]),
  )
}
const release = (titleId: number, am: string): Release =>
  ({ slug: `r${titleId}-${am}`, titleId, platform: 'crunchyroll', widerlegt: { am, grund: 'x', gemeldet: true } }) as unknown as Release
const ranges = (von: number, bis: number) => JSON.stringify([{ from: von, to: bis, dub: true }])

function lauf(url: string, am: string): Title {
  const titles = reihe(900001, url)
  loeseGeteilteWegeVonWiderlegten([release(900001, am)], titles, crDub)
  return titles.get(900001)!
}

console.log('\nWiderlegung und deutsche Folgen danach:')
{
  const bleibt = lauf(URL_A, '2026-10-18')
  pruefe('deutsche Folge am Tag der Widerlegung: Weg bleibt mit den Folgen ab da', bleibt.streams[0].dub === true && JSON.stringify(bleibt.streams[0].dubRanges) === ranges(1, 3), bleibt.streams[0])
  const spaeter = lauf(URL_A, '2026-10-19')
  pruefe('nur spätere Folgen zählen: Bereich 2 bis 3', JSON.stringify(spaeter.streams[0].dubRanges) === ranges(2, 3), spaeter.streams[0])
  const danach = lauf(URL_A, '2026-10-27')
  pruefe('keine deutsche Folge nach der Widerlegung: Weg gelöst', danach.streams[0].dub === undefined && !danach.streams[0].dubRanges, danach.streams[0])
  const davor = lauf(URL_B, '2026-10-18')
  pruefe('deutsche Folge einen Tag vor der Widerlegung: Weg gelöst', davor.streams[0].dub === undefined, davor.streams[0])
  const leer = lauf(URL_C, '2026-10-18')
  pruefe('Serie ohne deutsche Folgen: Weg gelöst', leer.streams[0].dub === undefined, leer.streams[0])
  const ausland = lauf(URL_D, '2026-10-18')
  pruefe('Katalog nicht deutsch: Weg gelöst', ausland.streams[0].dub === undefined, ausland.streams[0])
  const fremd = lauf('https://www.crunchyroll.com/de/series/GFREMD/x', '2026-10-18')
  pruefe('Serie nicht im Katalog: Weg gelöst', fremd.streams[0].dub === undefined, fremd.streams[0])
  /* Folgenzahl unbekannt (laufende Staffel, 20.10.2026): der Bereich besteht nur aus belegten deutschen Folgen, ungekappt. */
  const ohneZahl = reihe(900009, URL_A, null)
  loeseGeteilteWegeVonWiderlegten([release(900009, '2026-10-18')], ohneZahl, crDub)
  const ohneZahlWeg = ohneZahl.get(900009)!.streams[0]
  pruefe('Folgenzahl unbekannt, Katalog 1 bis 3: Weg bleibt mit 1 bis 3', ohneZahlWeg.dub === true && JSON.stringify(ohneZahlWeg.dubRanges) === ranges(1, 3), ohneZahlWeg)
  const ohneZahlG = reihe(900013, URL_G, null)
  loeseGeteilteWegeVonWiderlegten([release(900013, '2026-10-18')], ohneZahlG, crDub)
  pruefe('Folgenzahl unbekannt, Katalog 1 bis 5: 1 bis 5', JSON.stringify(ohneZahlG.get(900013)!.streams[0].dubRanges) === ranges(1, 5), ohneZahlG.get(900013)!.streams[0])
  const ohneZahlH = reihe(900014, URL_H, null)
  loeseGeteilteWegeVonWiderlegten([release(900014, '2026-10-18')], ohneZahlH, crDub)
  pruefe('Folgenzahl unbekannt, Katalog nur Folge 4: genau 4 bis 4', JSON.stringify(ohneZahlH.get(900014)!.streams[0].dubRanges) === ranges(4, 4), ohneZahlH.get(900014)!.streams[0])
  const ohneZahlLeer = reihe(900015, URL_C, null)
  loeseGeteilteWegeVonWiderlegten([release(900015, '2026-10-18')], ohneZahlLeer, crDub)
  const leerWeg = ohneZahlLeer.get(900015)!.streams[0]
  pruefe('Folgenzahl unbekannt, Katalog ohne deutsche Folge: Weg gelöst', leerWeg.dub === undefined && !leerWeg.dubRanges, leerWeg)
  const gekappt = reihe(900010, URL_G, 2)
  loeseGeteilteWegeVonWiderlegten([release(900010, '2026-10-18')], gekappt, crDub)
  pruefe('Folgenzahl 2, Katalog 1 bis 5: Bereich genau 1 bis 2', JSON.stringify(gekappt.get(900010)!.streams[0].dubRanges) === ranges(1, 2), gekappt.get(900010)!.streams[0])
  const jenseits = reihe(900011, URL_H, 3)
  loeseGeteilteWegeVonWiderlegten([release(900011, '2026-10-18')], jenseits, crDub)
  const jenseitsWeg = jenseits.get(900011)!.streams[0]
  pruefe('Folgenzahl 3, Katalog nur Folge 4: kein Bereich, Weg gelöst', jenseitsWeg.dub === undefined && !jenseitsWeg.dubRanges, jenseitsWeg)
  const eine = reihe(900012, URL_I, 1)
  loeseGeteilteWegeVonWiderlegten([release(900012, '2026-10-18')], eine, crDub)
  pruefe('Folgenzahl 1, Katalog Folge 1: Bereich 1 bis 1', JSON.stringify(eine.get(900012)!.streams[0].dubRanges) === ranges(1, 1), eine.get(900012)!.streams[0])
  const ohneDatum = deutscheBereicheSeit(crDub, URL_A, '2026-10-01', 3)
  pruefe('Folge ohne Datum zählt nicht, Lücken trennen Bereiche', JSON.stringify(ohneDatum.map((b) => [b.from, b.to])) === JSON.stringify([[1, 3], [5, 5]]), ohneDatum)
  const zweiReihe = reihe(900002, URL_A)
  const zwei = zweiReihe.get(900002)!
  const n = loeseGeteilteWegeVonWiderlegten([release(900002, '2026-10-18'), release(900002, '2026-10-26')], zweiReihe, crDub)
  pruefe('mehrere Widerlegungen: die späteste entscheidet', n === 0 && JSON.stringify(zwei.streams[0].dubRanges) === ranges(3, 3), zwei.streams[0])
  const schwester = lauf(URL_E, '2026-10-18')
  pruefe('deutsche Folge nur in Schwesterstaffeln (2 und 4): Weg der Staffel 3 gelöst', schwester.streams[0].dub === undefined && !schwester.streams[0].dubRanges, schwester.streams[0])
  const eigene = lauf(URL_F, '2026-10-18')
  pruefe('nur Folgen der eigenen Staffel: Folge 0 zählt nicht, doppelte Folge 1 ein Bereich, Folge 2 der Staffel 4 nicht', JSON.stringify(eigene.streams[0].dubRanges) === ranges(1, 1), eigene.streams[0])
  const ohneReihe = { id: 900004, titleDe: 'Allein', streams: [{ platform: 'crunchyroll', url: URL_A, dub: true, sharedWith: 3 }] } as unknown as Title
  loeseGeteilteWegeVonWiderlegten([release(900004, '2026-10-18')], new Map([[900004, ohneReihe]]), crDub)
  pruefe('Titel ohne erkennbare Staffelnummer: Weg gelöst, nichts geraten', ohneReihe.streams[0].dub === undefined && !ohneReihe.streams[0].dubRanges, ohneReihe.streams[0])
  const eigeneBereiche = reihe(900005, URL_C)
  const eigenerWeg = eigeneBereiche.get(900005)!
  eigenerWeg.streams[0].dubRanges = [{ from: 1, to: 5, dub: true }]
  const gelost = loeseGeteilteWegeVonWiderlegten([release(900005, '2026-10-18')], eigeneBereiche, crDub)
  pruefe('Weg mit eigenen Bereichen bleibt unangetastet', gelost === 0 && eigenerWeg.streams[0].dub === true && JSON.stringify(eigenerWeg.streams[0].dubRanges) === ranges(1, 5), eigenerWeg.streams[0])
  const cour = reihe(900007, URL_F)
  const cour2 = { ...cour.get(900007)!, id: 900008, titleDe: 'Reihe: Staffel 3 Teil 2', streams: [{ platform: 'crunchyroll', url: URL_F, dub: true, sharedWith: 3 }] } as unknown as Title
  cour.set(900008, cour2)
  loeseGeteilteWegeVonWiderlegten([release(900008, '2026-10-18')], cour, crDub)
  pruefe('Titel nur Teil einer Staffel (Cour 2): Staffelnummer trägt die Folgen nicht, Weg gelöst', cour2.streams[0].dub === undefined && !cour2.streams[0].dubRanges, cour2.streams[0])
  const ungeteilt = reihe(900006, URL_C)
  ungeteilt.get(900006)!.streams[0].sharedWith = 1
  const geloest = loeseGeteilteWegeVonWiderlegten([release(900006, '2026-10-18')], ungeteilt, crDub)
  pruefe('Weg nur dieses Titels (nicht geteilt) bleibt: die Widerlegung gilt dem Termin', geloest === 0 && ungeteilt.get(900006)!.streams[0].dub === true, ungeteilt.get(900006)!.streams[0])
}

if (verletzt) {
  console.error(`\n${verletzt} Prüfung(en) verletzt`)
  process.exit(1)
}
console.log('\nWiderlegung und deutsche Folgen: alle Prüfungen bestanden')
