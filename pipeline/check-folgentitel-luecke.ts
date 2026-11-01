/**
 * Zusicherungen zu den Stufen gegen die Folgentitel-Lücke (Daniel, 01.11.2026, „ab 66 gibt es keine Titel mehr für Beyblade X"):
 * RTL+ (`bau/folgentitel-rtlplus.ts`), Crunchyroll-Staffeln eines geteilten Verweises (`bau/folgentitel-cr-geteilt.ts`), Handzuordnung
 * (`bau/folgentitel-hand.ts`) und ihr Zusammenspiel in `mitFremdTiteln`. Die Beyblade-Texte stehen wörtlich in `data/rtlplus-folgen.json` (Stand 01.11.2026),
 * die Aoashi-Titel in `data/crunchyroll-raw/` (Staffel 2, Folge 1 und 2).
 * Aufruf: `npm run check:logic`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Title } from '../shared/types.ts'
import { abgleich } from './bau/folgentitel-abgleich.ts'
import { crFolgentitelGeteilt } from './bau/folgentitel-cr-geteilt.ts'
import type { CrArchiv, CrSerie } from './bau/folgentitel-cr.ts'
import { ladeHandTitel } from './bau/folgentitel-hand.ts'
import { rtlplusFolgentitel } from './bau/folgentitel-rtlplus.ts'
import { mitFremdTiteln, type TitelQuellen } from './bau/folgentitel-stufen.ts'
import { pruefeLuecken as mainBestand, rtlplusFehlt } from './lib/folgentitel-luecke-bestand.ts'
import { bewerteLuecken, leereImDeutschen, summe } from './lib/folgentitel-luecke.ts'

let verletzt = 0
let faelle = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  faelle++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const karte = (...paare: [number, string][]) => new Map(paare)
const leer: TitelQuellen = { crSerien: new Map(), tmdbFolgen: {}, tmdbNamen: {}, kitsu: {}, rtlplus: {}, hand: {} }

console.log('\nAbgleich der vorhandenen Titel mit einer Quelle')
const fuenf = karte([1, 'X'], [2, 'Multi-Magischer Hinterhalt'], [3, 'Team Persona'], [4, 'Bey Sponsor'], [5, 'Zum X'])
pruefe('fünf gleiche von fünf: passt', abgleich(fuenf, karte([1, 'X'], [2, 'Multi-Magischer Hinterhalt'], [3, 'Team Persona'], [4, 'Bey Sponsor'], [5, 'Zum X'])) === 'passt')
pruefe('vier von fünf gleich (vier Fünftel): passt', abgleich(fuenf, karte([1, 'X'], [2, 'Multi-Magischer Hinterhalt'], [3, 'Team Persona'], [4, 'Bey Sponsor'], [5, 'Der Dschungel der Löwen'])) === 'passt')
pruefe('drei von fünf gleich: widerspricht', abgleich(fuenf, karte([1, 'X'], [2, 'Multi-Magischer Hinterhalt'], [3, 'Team Persona'], [4, 'Wardens Prüfung'], [5, 'Der Dschungel der Löwen'])) === 'widerspricht')
pruefe('genau drei gemeinsame Nummern, alle gleich: passt', abgleich(karte([1, 'X'], [2, 'Multi-Magischer Hinterhalt'], [3, 'Team Persona']), karte([1, 'X'], [2, 'Multi-Magischer Hinterhalt'], [3, 'Team Persona'])) === 'passt')
pruefe('nur zwei gemeinsame Nummern: offen (kein Vergleich, kein Beleg)', abgleich(karte([1, 'X'], [2, 'Multi-Magischer Hinterhalt']), karte([1, 'X'], [2, 'Multi-Magischer Hinterhalt'], [3, 'Team Persona'])) === 'offen')
pruefe('keine gemeinsame Nummer: offen', abgleich(fuenf, karte([9, 'Beycrafter'])) === 'offen')

console.log('\nRTL+: Beyblade X ab Folge 66')
const rtlBeyblade = {
  folgen: [
    { nr: 1, dt: 'X' },
    { nr: 2, dt: 'Multi-Magischer Hinterhalt' },
    { nr: 3, dt: 'Team Persona' },
    { nr: 4, dt: 'Bey Sponsor' },
    { nr: 65, dt: 'Erster Flug' },
    { nr: 66, dt: 'Etwas Fesselndes' },
    { nr: 101, dt: 'Vernichtung' },
    { nr: 103, dt: 'Bey der Zukunft' },
  ],
}
const vorhandenBeyblade = karte([1, 'X'], [2, 'Multi-Magischer Hinterhalt'], [3, 'Team Persona'], [65, 'Erster Flug'])
const ausRtl = rtlplusFolgentitel(vorhandenBeyblade, rtlBeyblade)
pruefe('die Zählung ist belegt: Folge 66 trägt „Etwas Fesselndes"', ausRtl?.get(66) === 'Etwas Fesselndes', ausRtl?.get(66))
pruefe('Folge 101 und 103 kommen mit, 102 fehlt bei RTL+ und bleibt leer', ausRtl?.get(101) === 'Vernichtung' && ausRtl.get(103) === 'Bey der Zukunft' && !ausRtl.has(102))
pruefe('unsere Titel 2 von 4 anders (Staffel 2 mit eigener Zählung ab 1): nichts', rtlplusFolgentitel(karte([1, 'Neustart'], [2, 'Anzeichen einer neuen Ära'], [3, 'Weg der Entschlossenheit'], [4, 'Bey Sponsor']), rtlBeyblade) === undefined)
pruefe('nur zwei vorhandene Titel auf RTL+-Nummern: nichts (kein Beleg)', rtlplusFolgentitel(karte([1, 'X'], [2, 'Multi-Magischer Hinterhalt']), rtlBeyblade) === undefined)
pruefe('ohne vorhandene Titel: nichts', rtlplusFolgentitel(new Map(), rtlBeyblade) === undefined)
pruefe('ohne RTL+-Eintrag: nichts', rtlplusFolgentitel(vorhandenBeyblade, undefined) === undefined)
pruefe('Platzhalter „Folge 7" bei RTL+ ist kein Titel', !rtlplusFolgentitel(vorhandenBeyblade, { folgen: [...rtlBeyblade.folgen, { nr: 7, dt: 'Folge 7' }] })?.has(7))
pruefe('leerer RTL+-Titel für Nummer 8 ist kein Titel', rtlplusFolgentitel(vorhandenBeyblade, { folgen: [...rtlBeyblade.folgen, { nr: 8, dt: '' }] })?.has(8) === false)

const beyblade = { id: 165159, streams: [], episodes: undefined } as unknown as Title
const zeilen = [1, 2, 3, 65, 66, 67].map((nr) => ({ nr, ...(vorhandenBeyblade.has(nr) ? { de: vorhandenBeyblade.get(nr) } : {}) }))
const imBau = mitFremdTiteln(beyblade, zeilen, { ...leer, rtlplus: { '165159': rtlBeyblade } })
pruefe('im Bau (mitFremdTiteln): Folge 66 gefüllt, Folge 67 ohne RTL+-Titel bleibt leer', imBau?.find((x) => x.nr === 66)?.de === 'Etwas Fesselndes' && !imBau.find((x) => x.nr === 67)?.de, imBau)
pruefe('im Bau: ein vorhandener Titel bleibt', imBau?.find((x) => x.nr === 65)?.de === 'Erster Flug')
pruefe('im Bau: ein anderer Titel bekommt die RTL+-Titel nicht', mitFremdTiteln({ ...beyblade, id: 1 } as Title, zeilen, { ...leer, rtlplus: { '165159': rtlBeyblade } })?.find((x) => x.nr === 66)?.de === undefined)

console.log('\nCrunchyroll: eine Staffel eines geteilten Verweises')
const serieMit = (staffeln: { name: string; ab: string; von: number; bis: number }[]): CrSerie => ({
  staffeln: staffeln.map((s, i) => ({
    name: s.name,
    deutscheFolgen: Array.from({ length: s.bis - s.von + 1 }, (_, k) => ({ nummer: s.von + k, guid: `G${i}-${s.von + k}`, verfuegbarAb: `${s.ab}T08:00:00Z` })),
  })),
})
const archivMit = (titel: Record<string, string>): CrArchiv => ({
  episodes: { x: { items: Object.entries(titel).map(([guid, title]) => ({ id: guid, title })) } },
})
const aoashiStaffeln = serieMit([{ name: 'Staffel 1', ab: '2026-03-04', von: 1, bis: 24 }, { name: 'Staffel 2', ab: '2026-10-25', von: 1, bis: 2 }])
const aoashiArchiv = archivMit({ 'G0-1': 'Der erste Tag', 'G0-2': 'Der zweite Tag', 'G1-1': 'Startlinie', 'G1-2': 'Denkende Schilfe' })
const aoashi = { id: 191788, titleDe: 'Aoashi Staffel 2', titleEn: 'Aoashi Season 2', format: 'TV', jpYear: 2026, episodes: 24, streams: [{ platform: 'crunchyroll', url: 'x' }] } as unknown as Title
const aoashiTitel = crFolgentitelGeteilt(aoashi, aoashiStaffeln, aoashiArchiv, new Map())
pruefe('Aoashi Staffel 2: Staffel 1 und 2 starten 2026, die Staffelzahl im Namen entscheidet', aoashiTitel?.get(1) === 'Startlinie' && aoashiTitel.get(2) === 'Denkende Schilfe' && aoashiTitel.size === 2, [...(aoashiTitel ?? [])])
pruefe('derselbe Titel ohne Staffelzahl im Namen gilt als Staffel 1', crFolgentitelGeteilt({ ...aoashi, titleDe: 'Aoashi', titleEn: 'Aoashi' } as Title, aoashiStaffeln, aoashiArchiv, new Map())?.get(1) === 'Der erste Tag')
pruefe('Beginnjahr anders: nichts', crFolgentitelGeteilt({ ...aoashi, jpYear: 2025 } as Title, aoashiStaffeln, aoashiArchiv, new Map()) === undefined)
pruefe('Special statt Serie: nichts', crFolgentitelGeteilt({ ...aoashi, format: 'SPECIAL' } as Title, aoashiStaffeln, aoashiArchiv, new Map()) === undefined)
pruefe('mehr Crunchyroll-Folgen als unsere Folgenzahl: die Staffel zählt nicht', crFolgentitelGeteilt({ ...aoashi, titleDe: 'Aoashi', titleEn: 'Aoashi', episodes: 2 } as Title, aoashiStaffeln, aoashiArchiv, new Map())?.get(1) === 'Startlinie')
pruefe('ohne Folgenzahl gilt jede Länge (laufende Staffel)', crFolgentitelGeteilt({ ...aoashi, episodes: undefined } as Title, aoashiStaffeln, aoashiArchiv, new Map())?.get(2) === 'Denkende Schilfe')
pruefe('ohne Crunchyroll-Weg: nichts', crFolgentitelGeteilt({ ...aoashi, streams: [] } as Title, aoashiStaffeln, aoashiArchiv, new Map()) === undefined)
const drei = serieMit([{ name: 'Staffel 1', ab: '2026-03-04', von: 1, bis: 24 }, { name: 'Staffel 2', ab: '2026-10-25', von: 1, bis: 3 }])
const dreiArchiv = archivMit({ 'G1-1': 'Startlinie', 'G1-2': 'Denkende Schilfe', 'G1-3': 'Die Aufnahme' })
pruefe('drei vorhandene Titel widersprechen der Staffel: nichts', crFolgentitelGeteilt(aoashi, drei, dreiArchiv, karte([1, 'Anderes eins'], [2, 'Anderes zwei'], [3, 'Anderes drei'])) === undefined)
pruefe('drei vorhandene Titel gleichen der Staffel: sie gilt', crFolgentitelGeteilt(aoashi, drei, dreiArchiv, karte([1, 'Startlinie'], [2, 'Denkende Schilfe'], [3, 'Die Aufnahme']))?.size === 3)
const fortsetzung = serieMit([{ name: 'Season 1', ab: '2023-10-29', von: 1, bis: 12 }, { name: 'Season 3', ab: '2026-07-26', von: 25, bis: 36 }])
const fortsetzungTitel = crFolgentitelGeteilt({ ...aoashi, titleDe: 'Hundert Freundinnen', titleEn: 'Girlfriends Season 3', episodes: 12 } as Title, fortsetzung, archivMit({ 'G1-25': 'Erste', 'G1-36': 'Letzte' }), new Map())
pruefe('Nummern 25…36 der Fortsetzung zählen ab 1', fortsetzungTitel?.get(1) === 'Erste' && fortsetzungTitel.get(12) === 'Letzte' && !fortsetzungTitel.has(25), [...(fortsetzungTitel ?? [])])
const luecke = serieMit([{ name: 'Staffel 2', ab: '2026-03-04', von: 1, bis: 3 }])
luecke.staffeln![0].deutscheFolgen = luecke.staffeln![0].deutscheFolgen!.filter((f) => f.nummer !== 2)
pruefe('Lücke in den Nummern: nichts', crFolgentitelGeteilt(aoashi, luecke, archivMit({ 'G0-1': 'A', 'G0-3': 'C' }), new Map()) === undefined)
const imBauCr = mitFremdTiteln(aoashi, [1, 2, 3].map((nr) => ({ nr })), { ...leer, crSerien: new Map([['x', { ...aoashiStaffeln, seriesId: undefined }]]) })
pruefe('im Bau: ohne gepacktes Archiv bleibt die Liste leer (kein Absturz)', imBauCr?.every((x) => !x.de) === true)

/* Erster Starttag der Staffel, nicht der letzte: Staffel beginnt Ende 2025 und läuft in 2026 weiter. */
const jahreswechsel = serieMit([{ name: 'Staffel 2', ab: '2025-12-28', von: 1, bis: 3 }])
jahreswechsel.staffeln![0].deutscheFolgen![2].verfuegbarAb = '2026-01-11T08:00:00Z'
const jahrArchiv = archivMit({ 'G0-1': 'Anfang', 'G0-2': 'Mitte', 'G0-3': 'Ende' })
pruefe('Staffel beginnt 2025 und endet 2026: für einen Titel von 2026 nichts', crFolgentitelGeteilt({ ...aoashi, episodes: 3 } as Title, jahreswechsel, jahrArchiv, new Map()) === undefined)
pruefe('dieselbe Staffel für einen Titel von 2025: sie gilt', crFolgentitelGeteilt({ ...aoashi, jpYear: 2025, episodes: 3 } as Title, jahreswechsel, jahrArchiv, new Map())?.size === 3)
/* Zwei Staffeln im selben Jahr mit derselben Staffelzahl im Namen: keine Wahl, nichts. */
const zweimalZwei = serieMit([{ name: 'Staffel 2', ab: '2026-03-04', von: 1, bis: 3 }, { name: 'Season 2', ab: '2026-06-04', von: 1, bis: 3 }])
pruefe('zwei Staffeln „2" im selben Jahr: nichts', crFolgentitelGeteilt({ ...aoashi, episodes: 3 } as Title, zweimalZwei, archivMit({ 'G0-1': 'A', 'G1-1': 'B' }), new Map()) === undefined)
/* Eine Folge ohne Nummer: die Staffel ist nicht lückenlos belegt. */
const ohneNummer = serieMit([{ name: 'Staffel 2', ab: '2026-03-04', von: 1, bis: 3 }])
ohneNummer.staffeln![0].deutscheFolgen![2].nummer = undefined
pruefe('eine Folge ohne Nummer: nichts', crFolgentitelGeteilt({ ...aoashi, episodes: 3 } as Title, ohneNummer, archivMit({ 'G0-1': 'A', 'G0-2': 'B', 'G0-3': 'C' }), new Map()) === undefined)
/* Crunchyroll-Staffel ohne Zahl im Namen gilt als erste (Die Tagebücher der Apothekerin). */
const ohneZahl = serieMit([{ name: 'Die Tagebücher der Apothekerin', ab: '2026-03-04', von: 1, bis: 3 }, { name: 'Staffel 2', ab: '2026-06-04', von: 1, bis: 3 }])
pruefe('Staffel ohne Zahl im Namen gilt als erste, Titel ohne Zahl nimmt sie', crFolgentitelGeteilt({ ...aoashi, titleDe: 'Die Tagebücher', titleEn: 'Diaries', episodes: 3 } as Title, ohneZahl, archivMit({ 'G0-1': 'Erste', 'G1-1': 'Zweite' }), new Map())?.get(1) === 'Erste')

/* Im Bau: das gepackte Archiv liegt im Arbeitsverzeichnis unter data/crunchyroll-raw/<Serienkennung>.de.json.gz. */
const werk = mkdtempSync(join(tmpdir(), 'folgentitel-cr-'))
const vorher = process.cwd()
try {
  mkdirSync(join(werk, 'data', 'crunchyroll-raw'), { recursive: true })
  writeFileSync(join(werk, 'data', 'crunchyroll-raw', 'SER1.de.json.gz'), gzipSync(JSON.stringify(aoashiArchiv)))
  process.chdir(werk)
  const imBauMitArchiv = mitFremdTiteln(aoashi, [1, 2, 3].map((nr) => ({ nr })), { ...leer, crSerien: new Map([['x', { ...aoashiStaffeln, seriesId: 'SER1' }]]) })
  pruefe('im Bau: eine Staffel aus dem gepackten Archiv füllt die Lücke (Folge 1 und 2, Folge 3 bleibt leer)', imBauMitArchiv?.[0].de === 'Startlinie' && imBauMitArchiv[1].de === 'Denkende Schilfe' && !imBauMitArchiv[2].de, imBauMitArchiv)
} finally {
  process.chdir(vorher)
  rmSync(werk, { recursive: true, force: true })
}

console.log('\nHandzuordnung')
const ordner = mkdtempSync(join(tmpdir(), 'folgentitel-hand-'))
const pfad = join(ordner, 'hand.yaml')
writeFileSync(pfad, '- {anilistId: 900001, folge: 2, titel: "Zwei", quelle: "Test"}\n- {anilistId: 900001, folge: 3, titel: "Drei", quelle: "Test"}\n- {anilistId: 900002, folge: 1, titel: "Eins", quelle: "Test"}\n')
const hand = ladeHandTitel(pfad)
rmSync(ordner, { recursive: true, force: true })
pruefe('Einträge je Titel und Folge', hand['900001']?.get(2) === 'Zwei' && hand['900001'].get(3) === 'Drei' && hand['900002']?.get(1) === 'Eins' && hand['900001'].size === 2)
pruefe('fehlende Datei: keine Einträge', Object.keys(ladeHandTitel(join(tmpdir(), 'gibt-es-nicht-folgentitel-hand.yaml'))).length === 0)
const probe = { id: 900001, streams: [], episodes: undefined } as unknown as Title
const handZeilen = [{ nr: 1, de: 'Eins aus aniSearch' }, { nr: 2 }, { nr: 3, de: 'Drei aus aniSearch' }, { nr: 4 }]
const mitHand = mitFremdTiteln(probe, handZeilen, { ...leer, hand })
pruefe('im Bau: die Hand füllt die Lücke (Folge 2)', mitHand?.find((x) => x.nr === 2)?.de === 'Zwei', mitHand)
pruefe('im Bau: ein vorhandener Titel bleibt vor der Hand (Folge 3), Folge 4 ohne Eintrag bleibt leer', mitHand?.find((x) => x.nr === 3)?.de === 'Drei aus aniSearch' && !mitHand.find((x) => x.nr === 4)?.de)
pruefe('im Bau: der Titel einer anderen Kennung bekommt die Hand nicht', mitFremdTiteln({ ...probe, id: 900009 } as Title, handZeilen, { ...leer, hand })?.find((x) => x.nr === 2)?.de === undefined)
const rtlVorHand = mitFremdTiteln(beyblade, zeilen, { ...leer, rtlplus: { '165159': rtlBeyblade }, hand: { '165159': new Map([[66, 'Von Hand']]) } })
pruefe('im Bau: RTL+ geht der Hand voran', rtlVorHand?.find((x) => x.nr === 66)?.de === 'Etwas Fesselndes')

console.log('\nLückenliste: Zahl darf nur sinken')
const datei = { f: [[1, 'Eins'], [2, ''], [3, ''], [4, ''], [5, 'Fünf']] as [number, string][], de: [[1, 3]] as [number, number][] }
pruefe('leere Folgen nur im deutschen Bereich: 2 und 3, nicht 4', leereImDeutschen(datei).join() === '2,3', leereImDeutschen(datei))
pruefe('Grenzen des Bereichs zählen mit (Folge 1 bis 3 mit Titel/ohne)', leereImDeutschen({ f: [[1, ''], [2, 'Zwei'], [3, '']], de: [[1, 3]] }).join() === '1,3')
pruefe('zwei Bereiche', leereImDeutschen({ f: [[1, ''], [2, ''], [3, ''], [4, '']], de: [[1, 1], [4, 4]] }).join() === '1,4')
const soll = { '10': { offen: 5, grund: 'a' }, '20': { offen: 3, grund: 'b' }, '30': { offen: 2, grund: 'c' } }
const gleichBewertet = bewerteLuecken({ '10': 5, '20': 3, '30': 2 }, soll)
pruefe('gleich viele Lücken: nichts zu melden', gleichBewertet.mehr.length === 0 && gleichBewertet.weniger.length === 0, gleichBewertet)
pruefe('genau eine Lücke mehr (6 statt 5): mehr', bewerteLuecken({ '10': 6, '20': 3, '30': 2 }, soll).mehr.join() === '10')
pruefe('genau eine Lücke weniger (2 statt 3): weniger', bewerteLuecken({ '10': 5, '20': 2, '30': 2 }, soll).weniger.join() === '20')
pruefe('Titel ohne Lücken, aber gelistet: weniger (Zeile streichen)', bewerteLuecken({ '10': 5, '20': 3 }, soll).weniger.join() === '30')
pruefe('Titel mit einer Lücke, nicht gelistet: mehr', bewerteLuecken({ '10': 5, '20': 3, '30': 2, '40': 1 }, soll).mehr.join() === '40')
pruefe('mehr und weniger gleichzeitig getrennt gemeldet', JSON.stringify(bewerteLuecken({ '10': 7, '20': 1, '30': 2 }, soll)) === '{"mehr":["10"],"weniger":["20"]}')
pruefe('Summe der Lücken', summe({ a: 4, b: 7 }) === 11)
const rtlRest = rtlplusFehlt({ f: [[1, 'X'], [2, 'Multi-Magischer Hinterhalt'], [3, 'Team Persona'], [4, ''], [5, '']], de: [[1, 5]] }, { folgen: [{ nr: 1, dt: 'X' }, { nr: 2, dt: 'Multi-Magischer Hinterhalt' }, { nr: 3, dt: 'Team Persona' }, { nr: 4, dt: 'Bey Sponsor' }] })
pruefe('RTL+-Titel für Folge 4 fehlt in der Datei: gemeldet, Folge 5 ohne RTL+-Titel nicht', rtlRest.join() === '4', rtlRest)
pruefe('Datei mit allen RTL+-Titeln: nichts gemeldet', rtlplusFehlt({ f: [[1, 'X'], [2, 'Multi-Magischer Hinterhalt'], [3, 'Team Persona'], [4, 'Bey Sponsor']], de: [[1, 4]] }, { folgen: [{ nr: 1, dt: 'X' }, { nr: 2, dt: 'Multi-Magischer Hinterhalt' }, { nr: 3, dt: 'Team Persona' }, { nr: 4, dt: 'Bey Sponsor' }] }).length === 0)

console.log('\nBestandswache als Ganzes (Wegwerf-Wurzel)')
const rtlVier = { folgen: [{ nr: 1, dt: 'X' }, { nr: 2, dt: 'Multi-Magischer Hinterhalt' }, { nr: 3, dt: 'Team Persona' }, { nr: 4, dt: 'Bey Sponsor' }] }
function wurzelMit(opts: { liste?: unknown; dateien: number; luecke?: number; rtl?: Record<string, unknown> }): string {
  const w = mkdtempSync(join(tmpdir(), 'folgentitel-bestand-'))
  mkdirSync(join(w, 'data'), { recursive: true })
  mkdirSync(join(w, 'public', 'data', 'folgen'), { recursive: true })
  if (opts.liste !== undefined) writeFileSync(join(w, 'data', 'folgentitel-offen.json'), JSON.stringify(opts.liste))
  writeFileSync(join(w, 'data', 'rtlplus-folgen.json'), JSON.stringify({ titel: opts.rtl ?? {} }))
  for (let i = 1; i <= opts.dateien; i++) {
    const leerNr = i === 1 ? (opts.luecke ?? 0) : 0
    const f = [[1, 'Eins'], ...Array.from({ length: leerNr }, (_, k) => [k + 2, ''])]
    const rtlDatei = i === 1 && opts.rtl ? { f: [[1, 'X'], [2, 'Multi-Magischer Hinterhalt'], [3, 'Team Persona'], [4, '']], de: [[1, 4]] } : undefined
    writeFileSync(join(w, 'public', 'data', 'folgen', `${i}.json`), JSON.stringify(rtlDatei ?? { f, de: [[1, 1 + leerNr]] }))
  }
  return w
}
function lauf(w: string): { code: number; zeilen: string[] } {
  const zeilen: string[] = []
  const log = console.log
  const err = console.error
  console.log = (...a: unknown[]) => void zeilen.push(a.join(' '))
  console.error = (...a: unknown[]) => void zeilen.push(a.join(' '))
  try {
    return { code: mainBestand(w), zeilen }
  } finally {
    console.log = log
    console.error = err
    rmSync(w, { recursive: true, force: true })
  }
}
const gleich = lauf(wurzelMit({ liste: { '1': { offen: 2, grund: 'Test' } }, dateien: 1000, luecke: 2 }))
pruefe('so viele Lücken wie gelistet: Exit 0 und ✓-Zeile', gleich.code === 0 && gleich.zeilen.some((z) => z.includes('✓ Folgentitel: 2 Folgen ohne deutschen Titel in 1 Titeln')), gleich.zeilen)
const mehr = lauf(wurzelMit({ liste: { '1': { offen: 1, grund: 'Test' } }, dateien: 1000, luecke: 2 }))
pruefe('mehr Lücken als gelistet: Exit 0, aber eine Warnzeile mit der Kennung', mehr.code === 0 && mehr.zeilen.some((z) => z.includes('⚠ WARNUNG Folgentitel: 1 Titel mit mehr Lücken') && z.includes(': 1')), mehr.zeilen)
const weniger = lauf(wurzelMit({ liste: { '1': { offen: 3, grund: 'Test' } }, dateien: 1000, luecke: 2 }))
pruefe('weniger Lücken als gelistet: Exit 0 und Warnzeile „kürzen"', weniger.code === 0 && weniger.zeilen.some((z) => z.includes('weniger Lücken als gelistet')), weniger.zeilen)
const rtlFehlt = lauf(wurzelMit({ liste: { '1': { offen: 1, grund: 'Test' } }, dateien: 1000, rtl: { '1': rtlVier } }))
pruefe('RTL+-Titel fehlt in der Datei: Exit 0 und Warnzeile mit der Kennung 1', rtlFehlt.code === 0 && rtlFehlt.zeilen.some((z) => z.includes('⚠ WARNUNG Folgentitel: 1 Titel mit RTL+-Titeln') && z.endsWith(': 1')), rtlFehlt.zeilen)
const rtlAnderer = lauf(wurzelMit({ liste: { '1': { offen: 1, grund: 'Test' } }, dateien: 1000, rtl: { '2': rtlVier } }))
pruefe('RTL+-Eintrag eines anderen Titels: keine RTL+-Warnung für Titel 1', rtlAnderer.code === 0 && !rtlAnderer.zeilen.some((z) => z.includes('RTL+-Titeln')), rtlAnderer.zeilen)
const ohneListe = lauf(wurzelMit({ dateien: 1000 }))
pruefe('Liste fehlt: Exit 1 und „fehlt"', ohneListe.code === 1 && ohneListe.zeilen.some((z) => z.includes('fehlt')), ohneListe.zeilen)
const wenige = lauf(wurzelMit({ liste: {}, dateien: 5 }))
pruefe('fast nichts gelesen: Exit 1 und „misst nichts"', wenige.code === 1 && wenige.zeilen.some((z) => z.includes('misst nichts')), wenige.zeilen)

console.log(`\ncheck-folgentitel-luecke: ${verletzt ? `${verletzt} Fehler` : 'ok'} (${faelle} Fälle)`)
process.exit(verletzt ? 1 : 0)
