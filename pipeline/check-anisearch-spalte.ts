/**
 * Zusicherungen zur aniSearch-Spalte (Stufe B der AniList-Ablösung, 10.10.2026): Abbildung der Felder, Urteile je Feld, Zähler der Abweichungsliste.
 * Die Liste `data/anisearch-abweichungen.json` schreibt der Bau; fehlt sie noch, entfällt der Teil „Bestand". Läuft in `check:logic`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { FELDER, aniSearchDatum, aniSearchZeitraum, anisearchSpalte, winterAnilistArt, urteil } from './bau/anisearch-spalte.ts'
import { ABWEICHUNGEN_DATEI, type Bericht, type Paar, kuerzeBericht, malJeAnisearch, vergleichePaare } from './bau/anisearch-abweichungen.ts'
import type { AnisearchEintrag } from './bau/01-quellen.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

const eintrag = {
  anisearchId: 2519,
  descriptionDe: 'Text',
  streams: [],
  info: {
    languages: [
      { language: 'Japanisch', title: 'Hagane no Renkinjutsushi', titleNative: '鋼の錬金術師', status: 'Abgeschlossen', released: '04.10.2003 - 02.10.2004' },
      { language: 'Englisch', title: 'Fullmetal Alchemist' },
      { language: 'Deutsch', title: 'Fullmetal Alchemist (DE)' },
    ],
    format: 'TV-Serie', episodes: 51, season: 'Herbst 2003', studios: ['BONES Inc.'],
  },
} as unknown as AnisearchEintrag
const s = anisearchSpalte(eintrag, [121])
pruefe('Spalte: Titel aus der japanischen Zeile, Englisch aus der englischen', s.titleRomaji === 'Hagane no Renkinjutsushi' && s.titleEn === 'Fullmetal Alchemist' && s.titleNative === '鋼の錬金術師')
pruefe('Spalte: Format, Folgen, Saison, Jahr, Status, Ende, MAL abgebildet',
  s.format === 'TV' && s.episodes === 51 && s.jpSeason === 'FALL' && s.jpYear === 2003 && s.status === 'FINISHED' && s.jpEnd === '2004-10-02' && s.malId?.[0] === 121 && s.synopsis === true)
pruefe('Spalte: Winter über den Jahreswechsel nach dem Beginn — Dezember = FALL des Startjahres (Rurouni-Kenshin-Film 20.12.1997), Januar/Februar = WINTER des Startjahres, ohne Beginn das spätere Jahr',
  JSON.stringify(winterAnilistArt('1997/98', '1997-12-20')) === '{"jahr":1997,"saison":"FALL"}' && JSON.stringify(winterAnilistArt('1997/98', '1998-01-07')) === '{"jahr":1998,"saison":"WINTER"}' &&
  JSON.stringify(winterAnilistArt('1999/00', undefined)) === '{"jahr":2000,"saison":"WINTER"}' && winterAnilistArt('2003', '2003-01-05') === undefined)
pruefe('Spalte: Winter 1997/98 mit Dezember-Beginn ergibt FALL 1997', (() => {
  const w = anisearchSpalte({ streams: [], info: { languages: [{ language: 'Japanisch', title: 'X', released: '20.12.1997' }], season: 'Winter 1997/98' } } as unknown as AnisearchEintrag)
  return w.jpYear === 1997 && w.jpSeason === 'FALL'
})())
pruefe('Datum: so genau wie die Angabe, „?" bleibt leer', aniSearchDatum('04.10.2003') === '2003-10-04' && aniSearchDatum('10.2003') === '2003-10' && aniSearchDatum('2003') === '2003' && aniSearchDatum('?') === undefined)
pruefe('Zeitraum: einzelnes Datum ist nur der Beginn, offenes Ende bleibt leer', JSON.stringify(aniSearchZeitraum('04.10.2003')) === '{"von":"2003-10-04"}' && aniSearchZeitraum('04.10.2003 - ?').bis === undefined)
pruefe('Spalte: ohne Informationen entsteht nichts Geratenes', anisearchSpalte({ streams: [] } as AnisearchEintrag).titleRomaji === undefined && anisearchSpalte({ streams: [] } as AnisearchEintrag).jpYear === undefined)

pruefe('Urteil: gleich, abweichend, nur eine Seite, beide leer',
  urteil('episodes', { episodes: 12 }, { episodes: 12 }) === 'gleich' && urteil('episodes', { episodes: 12 }, { episodes: 13 }) === 'abweichend' &&
  urteil('episodes', { episodes: 12 }, {}) === 'nurAnilist' && urteil('episodes', {}, { episodes: 12 }) === 'nurAnisearch' && urteil('episodes', {}, {}) === 'beideLeer')
pruefe('Urteil: Titel ohne Beachtung von Groß- und Kleinschreibung', urteil('titleEn', { titleEn: 'Hunter x Hunter' }, { titleEn: 'hunter X hunter' }) === 'gleich')
pruefe('Urteil: Daten gelten bis zur gröberen Genauigkeit als gleich', urteil('jpEnd', { jpEnd: '2003-10' }, { jpEnd: '2003-10-04' }) === 'gleich' && urteil('jpEnd', { jpEnd: '2003-10-03' }, { jpEnd: '2003-10-04' }) === 'abweichend')
pruefe('Urteil: Studios gleich trotz Rechtsform und wenn eine Menge die andere enthält',
  urteil('studios', { studios: ['BONES', 'Sunrise'] }, { studios: ['BONES Inc.'] }) === 'gleich' && urteil('studios', { studios: ['GONZO'] }, { studios: ['Gonzo K.K.'] }) === 'gleich' &&
  urteil('studios', { studios: ['AIC'] }, { studios: ['Madhouse'] }) === 'abweichend')
pruefe('Urteil: MAL gleich, wenn aniSearchs Brücke die AniList-Kennung unter ihren nennt', urteil('malId', { malId: [5] }, { malId: [4, 5] }) === 'gleich' && urteil('malId', { malId: [5] }, { malId: [6] }) === 'abweichend')
pruefe('Urteil: Beschreibung zählt nur das Vorhandensein (Deutsch gegen Englisch)', urteil('synopsis', { synopsis: true }, { synopsis: true }) === 'gleich' && urteil('synopsis', { synopsis: true }, { synopsis: false }) === 'nurAnilist')
pruefe('MAL-Brücke wird umgekehrt: mehrere MAL-Kennungen je aniSearch-Eintrag bleiben erhalten', malJeAnisearch({ '1': 10, '2': 10, '3': 11 }).get(10)?.length === 2)

const paar = (id: number, a: object, b: object): Paar => ({ id, name: `T${id}`, anilist: a, anisearch: b })
const paare = [paar(1, { episodes: 12 }, { episodes: 12 }), paar(2, { episodes: 12 }, { episodes: 13 }), paar(3, { episodes: 12 }, {}), paar(4, {}, { episodes: 6 }), paar(5, {}, {})]
const v = vergleichePaare(paare)
const ep = v.felder.episodes
pruefe('Zähler: je ein Titel pro Urteil, Abweichung trägt beide Werte', ep.gleich === 1 && ep.abweichend === 1 && ep.nurAnilist === 1 && ep.nurAnisearch === 1 && ep.beideLeer === 1 && JSON.stringify(ep.abweichungen) === '[[2,12,13]]')
const lang = { ...v, stand: '', titel: { gesamt: 0, verglichen: 0, ohneAnisearchEintrag: 0, ohneInfo: 0, nurAnisearch: 0 } }
lang.felder.episodes.abweichungen = Array.from({ length: 30 }, (_, i) => [i, 1, 2])
lang.namen = { 1: 'a', 2: 'b' }
const kurz = kuerzeBericht(lang)
pruefe('Kürzen: Zähler bleiben, Beispiele auf 20, Namen nur noch zu den übrigen Kennungen', kurz.felder.episodes.abweichend === ep.abweichend && kurz.felder.episodes.abweichungen.length === 20 && Object.keys(kurz.namen).length === 2)

/* Bestand: gemessen am 10.10.2026 mit 2.619 von 2.768 AniList-Titeln verglichen (94,6 %); die Grenzen lassen reichlich Spielraum und schlagen nur bei einem Bruch an. */
/* Untergrenzen für `gleich` je Feld, rund 15 % unter dem Messwert vom 10.10.2026 (Romaji 1546, Englisch 1426, Nativ 903, Format 2448, Folgen 2556, Jahr 2558, Saison 2321, Ende 2354, Status 2605, Studios 2230, Beschreibung 2492, MAL 2590). */
const GLEICH_MINDESTENS = { titleRomaji: 1300, titleEn: 1200, titleNative: 750, format: 2080, episodes: 2170, jpYear: 2170, jpSeason: 1970, jpEnd: 2000, status: 2210, studios: 1890, synopsis: 2110, malId: 2200 }
if (existsSync(ABWEICHUNGEN_DATEI)) {
  const b = JSON.parse(readFileSync(ABWEICHUNGEN_DATEI, 'utf8')) as Bericht
  for (const [f, grenze] of Object.entries(GLEICH_MINDESTENS) as [(typeof FELDER)[number], number][]) {
    pruefe(`Bestand: ${f} stimmt bei mindestens ${grenze} Titeln überein`, b.felder[f].gleich >= grenze, `${b.felder[f].gleich}`)
  }
  const anilistTitel = b.titel.gesamt - b.titel.nurAnisearch
  pruefe('Bestand: mindestens 85 % der AniList-Titel haben aniSearch-Daten und sind verglichen', b.titel.verglichen >= 0.85 * anilistTitel, `${b.titel.verglichen} von ${anilistTitel}`)
  for (const f of ['titleRomaji', 'format', 'episodes', 'status', 'malId'] as const) {
    const x = b.felder[f]
    pruefe(`Bestand: ${f} fehlt bei aniSearch für höchstens 10 % der verglichenen Titel`, x.nurAnilist <= 0.1 * b.titel.verglichen, `${x.nurAnilist} von ${b.titel.verglichen}`)
  }
  pruefe('Bestand: alle Felder sind im Bericht', FELDER.every((f) => b.felder[f] !== undefined))
}

console.log(fehler ? `\naniSearch-Spalte: ${fehler} Zusicherung(en) verletzt.` : 'aniSearch-Spalte: alle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
