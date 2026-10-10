/**
 * Zusicherungen zur aniSearch-Spalte (Stufe B der AniList-Ablösung, 10.10.2026): Abbildung der Felder, Urteile je Feld, Zähler der Abweichungsliste.
 * Die Liste `data/anisearch-abweichungen.json` schreibt der Bau; fehlt sie noch, entfällt der Teil „Bestand". Läuft in `check:logic`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { FELDER, aniSearchDatum, aniSearchZeitraum, anisearchSpalte, saisonJahrAnilistArt, urteil } from './bau/anisearch-spalte.ts'
import { ABWEICHUNGEN_DATEI, type Bericht, type Paar, malJeAnisearch, pruefeZaehler, vergleichePaare } from './bau/anisearch-abweichungen.ts'
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
pruefe('Spalte: Winter 1997/98 zählt wie bei AniList zum Jahr 1998, 1999/00 zu 2000', saisonJahrAnilistArt('1997/98') === 1998 && saisonJahrAnilistArt('1999/00') === 2000 && saisonJahrAnilistArt('2003') === 2003)
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
pruefe('Zähler: die Summe je Feld stimmt mit der Titelzahl überein', (() => { try { pruefeZaehler({ ...v, titel: { gesamt: 5, verglichen: 5, ohneAnisearchEintrag: 0, ohneInfo: 0, nurAnisearch: 0 } }); return true } catch { return false } })())
pruefe('Zähler: ein verlorener Titel wird bemerkt', (() => { try { pruefeZaehler({ ...v, titel: { gesamt: 6, verglichen: 6, ohneAnisearchEintrag: 0, ohneInfo: 0, nurAnisearch: 0 } }); return false } catch { return true } })())

/* Bestand: gemessen am 10.10.2026 mit 2.619 von 2.768 AniList-Titeln verglichen (94,6 %); die Grenzen lassen reichlich Spielraum und schlagen nur bei einem Bruch an. */
if (existsSync(ABWEICHUNGEN_DATEI)) {
  const b = JSON.parse(readFileSync(ABWEICHUNGEN_DATEI, 'utf8')) as Bericht
  try {
    pruefeZaehler(b)
  } catch (e) {
    pruefe('Bestand: Zähler summieren sich', false, (e as Error).message)
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
