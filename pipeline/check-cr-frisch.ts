/**
 * Test von `lib/cr-frisch.ts`: wann die gelesene Seite einer Crunchyroll-Serie noch gilt und wann sie neu drankommt.
 * Erwartete Werte stehen fest im Test. Die Fälle des Umbaus (Stand vor dem Herauslösen aus `scrape-crunchyroll-dub.ts`) und die der
 * Folgenkennung (zwei Folgen am selben Tag) stehen getrennt.
 */
import { readFileSync } from 'node:fs'
import type { CrSerie } from './lib/crunchyroll-dub.ts'
import { crFrisch, merkeNeuFolgen, neuFolgenJeSerie, type FrischKontext } from './lib/cr-frisch.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

const kontext = (k: Partial<FrischKontext> = {}): FrischKontext => ({
  katalogJetzt: 'de',
  neuSeit: new Map(),
  neuFolgen: new Map(),
  nurNeu: false,
  nurFehler: false,
  befundGrenze: '2026-10-01',
  fehlerGrenze: '2026-10-21',
  ...k,
})
const serie = (s: Partial<CrSerie> = {}): CrSerie => ({ url: 'https://www.crunchyroll.com/de/series/GT00371866/x', seriesId: 'GT00371866', katalog: 'de', geprueftAm: '2026-10-27', ...s })

/* Umbau: dieselben Antworten wie die Schließung vorher. */
pruefe('Befund innerhalb seiner Frist: frisch', crFrisch(serie({ geprueftAm: '2026-10-05' }), kontext()))
pruefe('Befund genau an der Fristgrenze: frisch', crFrisch(serie({ geprueftAm: '2026-10-01' }), kontext()))
pruefe('Befund einen Tag vor der Fristgrenze: neu', !crFrisch(serie({ geprueftAm: '2026-09-30' }), kontext()))
pruefe('Nichtauskunft innerhalb der kurzen Frist: frisch', crFrisch(serie({ fehler: 'x', geprueftAm: '2026-10-21' }), kontext()))
pruefe('Nichtauskunft einen Tag davor: neu', !crFrisch(serie({ fehler: 'x', geprueftAm: '2026-10-20' }), kontext()))
pruefe('„nicht verfügbar“ zählt als Befund (lange Frist)', crFrisch(serie({ fehler: 'x', nichtVerfuegbar: true, geprueftAm: '2026-10-05' }), kontext()))
pruefe('anderer Katalog: neu, egal wie jung', !crFrisch(serie({ katalog: 'us' }), kontext()))
pruefe('Katalog nicht belegt: entscheidet nicht, die Frist gilt (wie vor dem Umbau)', crFrisch(serie({ katalog: undefined }), kontext()))
pruefe('ohne Zugang (kein Katalog gefragt): der Katalog entscheidet nicht', crFrisch(serie({ katalog: 'us' }), kontext({ katalogJetzt: undefined })))
pruefe('neue Folge nach dem letzten Blick: neu', !crFrisch(serie(), kontext({ neuSeit: new Map([['GT00371866', '2026-10-28']]) })))
pruefe('neue Folge am Tag des letzten Blicks: frisch (nur Datum)', crFrisch(serie(), kontext({ neuSeit: new Map([['GT00371866', '2026-10-27']]) })))
pruefe('neue Folge einer anderen Serie: ohne Wirkung', crFrisch(serie(), kontext({ neuSeit: new Map([['G4PH0WX5J', '2026-10-28']]) })))
pruefe('--nur-neu: abgelaufene Frist gilt als frisch', crFrisch(serie({ geprueftAm: '2026-08-01' }), kontext({ nurNeu: true })))
pruefe('--nur-neu: neue Folge nach dem Blick bleibt neu', !crFrisch(serie({ geprueftAm: '2026-08-01' }), kontext({ nurNeu: true, neuSeit: new Map([['GT00371866', '2026-10-28']]) })))
pruefe('--nur-fehler: ohne Fehler frisch, mit Fehler neu', crFrisch(serie({ geprueftAm: '2026-08-01' }), kontext({ nurFehler: true })) && !crFrisch(serie({ fehler: 'x' }), kontext({ nurFehler: true })))

/*
 * Folgenkennung statt Datum (Doppelstart): „A Wild Last Boss Appeared!“, Folgen 1 und 2 stehen am 25.10.2026 beide in
 * `data/crunchyroll-neu.json` mit gesehenAm 2026-10-25 — Kennungen wörtlich von dort. Das Datum allein sah die zweite nie als neu.
 */
const LB = 'GT00361955'
const F1 = 'GE00384097DEDE'
const F2 = 'GE00384098DEDE'
const TAG = '2026-10-25'
const funde = (...guids: string[]) => guids.map((guid) => ({ serieId: LB, guid, gesehenAm: TAG }))
const stundenKontext = (guids: string[]) => kontext({ nurNeu: true, neuSeit: new Map([[LB, TAG]]), neuFolgen: neuFolgenJeSerie(funde(...guids)) })
const lastBoss = (s: Partial<CrSerie> = {}): CrSerie => serie({ url: 'https://www.crunchyroll.com/de/series/GT00361955/x', seriesId: LB, geprueftAm: TAG, ...s })

/* Der Kreislauf: Fund → Lesen → nächste Stunde → zweiter Fund am selben Tag → Lesen → nächste Stunde. */
let eintrag: CrSerie = merkeNeuFolgen(lastBoss(), [F1])
pruefe('Stunde 2 ohne neue Folge: frisch, kein zweiter Abruf', crFrisch(eintrag, stundenKontext([F1])))
pruefe('Stunde 3, zweite Folge desselben Tages: kommt dran (das Datum allein sagte „frisch“)', !crFrisch(eintrag, stundenKontext([F1, F2])))
eintrag = merkeNeuFolgen(lastBoss(), [F1, F2])
pruefe('nach dem Lesen: beide Kennungen gemerkt, wieder frisch', crFrisch(eintrag, stundenKontext([F1, F2])))
pruefe('Reihenfolge der Kennungen ist gleichgültig', crFrisch(eintrag, stundenKontext([F2, F1])))
pruefe('eine Folge fällt aus dem Fund (Haltbarkeit): bleibt frisch', crFrisch(eintrag, stundenKontext([F2])))
pruefe('Kontrolle: das Datum allein hielt die zweite Folge für erledigt', crFrisch(lastBoss(), kontext({ nurNeu: true, neuSeit: new Map([[LB, TAG]]) })))
pruefe('ohne --nur-neu kommt sie ebenso dran', !crFrisch(merkeNeuFolgen(lastBoss(), [F1]), kontext({ neuSeit: new Map([[LB, TAG]]), neuFolgen: neuFolgenJeSerie(funde(F1, F2)) })))
pruefe('Eintrag aus der Zeit vor der Regel (ohne gemerkte Kennungen): nur das Datum, frisch', crFrisch(lastBoss(), stundenKontext([F1, F2])))
pruefe('Kennung einer anderen Serie: ohne Wirkung', crFrisch(eintrag, kontext({ nurNeu: true, neuFolgen: new Map([['GRGG9798R', ['GE00345570DEDE']]]) })))
pruefe('anderer Katalog schlägt die Kennungen: neu', !crFrisch(merkeNeuFolgen(lastBoss({ katalog: 'us' }), [F1, F2]), stundenKontext([F1, F2])))

/* Merken nur bei echter Antwort. */
pruefe('Nichtauskunft merkt keine Kennungen', merkeNeuFolgen(lastBoss({ fehler: 'keine Audio-Zeile gefunden' }), [F1]).neuFolgen === undefined)
pruefe('ohne Kennungen im Fund bleibt der Eintrag, wie er ist', merkeNeuFolgen(lastBoss(), undefined).neuFolgen === undefined && merkeNeuFolgen(lastBoss(), []).neuFolgen === undefined)
pruefe('echte Antwort merkt die Kennungen', JSON.stringify(merkeNeuFolgen(lastBoss(), [F1, F2]).neuFolgen) === `["${F1}","${F2}"]`)
pruefe('Nichtauskunft bleibt beim Datum (Fehler heute, Fund heute: frisch wie bisher)', crFrisch(merkeNeuFolgen(lastBoss({ fehler: 'x' }), [F1]), stundenKontext([F1, F2])))

const gruppiert = neuFolgenJeSerie([{ serieId: LB, guid: F1 }, { serieId: LB, guid: F2 }, { serieId: 'G4PH0WX5J', guid: 'GE00384109DEDE' }, { serieId: LB }, { guid: 'x' }])
pruefe('Gruppierung: je Serie ihre Kennungen, Zeilen ohne Serie oder Kennung entfallen', JSON.stringify([...gruppiert]) === `[["${LB}",["${F1}","${F2}"]],["G4PH0WX5J",["GE00384109DEDE"]]]`, [...gruppiert])

/* Verdrahtung: `main()` des Dub-Laufs braucht einen Browser, also ein Quelltext-Befund (Notlösung): Kennungen merken und an `crFrisch` geben. */
const lauf = readFileSync(new URL('./scrape-crunchyroll-dub.ts', import.meta.url), 'utf8')
pruefe('Dub-Lauf merkt die Folgenkennungen beim Speichern der Serie', lauf.includes('bestand.set(url, merkeNeuFolgen(serie, neuFolgen.get(seriesId)))'))
pruefe('Dub-Lauf gibt die Kennungen des Katalogfunds an crFrisch', /crFrisch\(s, \{[^}]*\bneuFolgen,[^}]*\}\)/.test(lauf))
pruefe('Dub-Lauf liest die Kennungen aus dem Katalogfund', lauf.includes('neuFolgenJeSerie(neuFunde)') && lauf.includes('guid?: string'))

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
