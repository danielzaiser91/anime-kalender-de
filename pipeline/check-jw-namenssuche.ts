/**
 * Zuordnung von JustWatch-Treffern über Namen, Jahr und Art (`lib/jw-namenssuche.ts`) für Titel ohne TMDB-Kennung.
 * Anlass: „Miraculous World: New York, United Heroez“ (10017058) — die Treffer unten stammen wörtlich aus der JustWatch-Antwort vom 06.11.2026.
 * Gegenproben: gleicher Name anderes Werk (Jahr), Film gegen Serie, Teilname, Ziffer, zwei Treffer, Kennung eines anderen Titels.
 * Erwartete Werte stehen fest im Test, nicht aus dem Modul. Läuft in `check:logic`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Title } from '../shared/types.ts'
import { bekannteTmdbKennungen, namenProLauf, namensLage, namensSchlange, namensSchluessel, passtZumTitel, suchNamen, waehleKnoten, type NamensKnoten } from './lib/jw-namenssuche.ts'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${JSON.stringify(info)}`)
}

const knoten = (id: string, objectType: string, title: string, originalReleaseYear: number | null, tmdbId: string | null = null): NamensKnoten => ({
  id,
  objectType,
  content: { title, originalReleaseYear, externalIds: tmdbId ? { tmdbId } : null },
})

/** Unser Titel 10017058 wie in `public/data/titles.json` (06.11.2026). */
const miraculous = {
  titleRomaji: 'Miraculous World: New York, Hana Doen Yeongungdeul',
  titleEn: 'Miraculous World: New York, United Heroez',
  titleDe: 'Miraculous World: New York, United Heroez',
  titleNative: '미라큘러스 월드 : 뉴욕, 하나 된 영웅들',
  format: 'SPECIAL',
  episodes: 1,
  jpYear: 2021,
  deErstausgabe: { von: '2020-11-07', synchro: true },
} as Title

/** Die Trefferliste der Suche nach dem Titel (gekürzt auf die ersten vier). */
const ANTWORT = [
  knoten('tm1', 'MOVIE', 'Miraculous World: New York, United Heroez', 2020, '755812'),
  knoten('tm2', 'SHOW', 'Miraculous - Le storie di Ladybug e Chat Noir', 2015, '65334'),
  knoten('tm3', 'MOVIE', 'New York – Die Welt vor deinen Füssen', 2018, '502138'),
  knoten('tm4', 'SHOW', 'The Real World', 1992, '5022'),
]
const keine = new Set<number>()

const u1 = waehleKnoten(miraculous, ANTWORT, keine)
pruefe('Anlassfall: genau der Film mit Name, Jahr 2020 (deutsche Erstausgabe) und Art', u1.art === 'treffer' && u1.knoten.id === 'tm1', u1)
pruefe('Anlassfall: auch ohne deutsche Erstausgabe reicht jpYear 2021 (±1)', waehleKnoten({ ...miraculous, deErstausgabe: undefined }, ANTWORT, keine).art === 'treffer')
pruefe('Anlassfall: der Treffer in der Mitte der Liste wird gefunden', waehleKnoten(miraculous, [ANTWORT[1], ANTWORT[0], ANTWORT[2]], keine).art === 'treffer')

/* Gegenproben */
pruefe('Gleicher Name, anderes Werk (Jahr 1992) → keiner', waehleKnoten(miraculous, [knoten('x', 'MOVIE', 'Miraculous World: New York, United Heroez', 1992)], keine).art === 'keiner')
pruefe('Jahr genau 1 daneben passt (2022 gegen 2021)', passtZumTitel(miraculous, knoten('x', 'MOVIE', 'Miraculous World: New York, United Heroez', 2022)))
pruefe('Jahr 2 daneben passt nicht (2023 gegen 2021 und 2020)', !passtZumTitel(miraculous, knoten('x', 'MOVIE', 'Miraculous World: New York, United Heroez', 2023)))
pruefe('Jahr 2 davor passt nicht (2018)', !passtZumTitel(miraculous, knoten('x', 'MOVIE', 'Miraculous World: New York, United Heroez', 2018)))
pruefe('JustWatch ohne Jahr → keiner (zu wenig Beleg)', waehleKnoten(miraculous, [knoten('x', 'MOVIE', 'Miraculous World: New York, United Heroez', null)], keine).art === 'keiner')
pruefe('Titel ohne Jahr → keiner', waehleKnoten({ ...miraculous, jpYear: undefined, deErstausgabe: undefined }, ANTWORT, keine).art === 'keiner')
pruefe('Teilname reicht nicht („Miraculous World: New York“)', waehleKnoten(miraculous, [knoten('x', 'MOVIE', 'Miraculous World: New York', 2020)], keine).art === 'keiner')
pruefe('Längerer Name reicht nicht', waehleKnoten(miraculous, [knoten('x', 'MOVIE', 'Miraculous World: New York, United Heroez – Extended', 2020)], keine).art === 'keiner')
pruefe('Ziffer zählt: „Baki 2“ ist nicht „Baki“', waehleKnoten({ titleEn: 'Baki', format: 'TV', episodes: 26, jpYear: 2018 } as Title, [knoten('x', 'SHOW', 'Baki 2', 2018)], keine).art === 'keiner')
pruefe('Akzente und Satzzeichen sind egal', namensSchluessel('Café: „Été“ – 2!') === 'cafe ete 2')
pruefe('Zwei Treffer mit Name, Jahr und Art → mehrdeutig, nichts übernommen', waehleKnoten(miraculous, [ANTWORT[0], knoten('tm9', 'MOVIE', 'Miraculous World: New York, United Heroez', 2021)], keine).art === 'mehrdeutig')
const doppelt = waehleKnoten(miraculous, [ANTWORT[0], ANTWORT[0]], keine)
pruefe('Derselbe Knoten aus zwei Suchen ist ein Treffer, nicht zwei', doppelt.art === 'treffer', doppelt)
const fremd = waehleKnoten(miraculous, ANTWORT, new Set([755812]))
pruefe('Kennung gehört schon einem anderen unserer Titel → fremd', fremd.art === 'fremd' && fremd.tmdbId === 755812, fremd)
pruefe('Eine fremde Kennung eines anderen Werks sperrt nicht', waehleKnoten(miraculous, ANTWORT, new Set([65334])).art === 'treffer')

/* Art */
const film = { titleEn: 'Beispiel', format: 'MOVIE', episodes: 1, jpYear: 2020 } as Title
pruefe('Film gegen Serie gleichen Namens → keiner', waehleKnoten(film, [knoten('s', 'SHOW', 'Beispiel', 2020)], keine).art === 'keiner')
pruefe('Film gegen Film → Treffer', waehleKnoten(film, [knoten('f', 'MOVIE', 'Beispiel', 2020)], keine).art === 'treffer')
const serie = { titleEn: 'Beispiel', format: 'TV', episodes: 12, jpYear: 2020 } as Title
pruefe('Serie mit 12 Folgen gegen Film → keiner', waehleKnoten(serie, [knoten('f', 'MOVIE', 'Beispiel', 2020)], keine).art === 'keiner')
pruefe('Serie mit 12 Folgen gegen Serie → Treffer', waehleKnoten(serie, [knoten('s', 'SHOW', 'Beispiel', 2020)], keine).art === 'treffer')
pruefe('ONA mit 12 Folgen gegen Film → keiner', waehleKnoten({ ...serie, format: 'ONA' } as Title, [knoten('f', 'MOVIE', 'Beispiel', 2020)], keine).art === 'keiner')
pruefe('TV_SHORT mit 12 Folgen gegen Film → keiner', waehleKnoten({ ...serie, format: 'TV_SHORT' } as Title, [knoten('f', 'MOVIE', 'Beispiel', 2020)], keine).art === 'keiner')
pruefe('Serie mit 2 Folgen gegen Film → keiner', waehleKnoten({ ...serie, episodes: 2 } as Title, [knoten('f', 'MOVIE', 'Beispiel', 2020)], keine).art === 'keiner')
pruefe('Jahr: es genügt eines von mehreren (jpYear 2023, deutsche Erstausgabe 2020)', waehleKnoten({ ...serie, jpYear: 2023, deErstausgabe: { von: '2020-01-01', synchro: true } } as Title, [knoten('s', 'SHOW', 'Beispiel', 2020)], keine).art === 'treffer')
pruefe('Serie mit 1 Folge lässt beides zu (Film oder Serie)', waehleKnoten({ ...serie, episodes: 1 } as Title, [knoten('f', 'MOVIE', 'Beispiel', 2020)], keine).art === 'treffer')
pruefe('OVA lässt beides zu', waehleKnoten({ ...serie, format: 'OVA', episodes: 3 } as Title, [knoten('f', 'MOVIE', 'Beispiel', 2020)], keine).art === 'treffer')
pruefe('Name aus Romaji genügt', waehleKnoten({ titleRomaji: 'Beispiel', format: 'TV', episodes: 12, jpYear: 2020 } as Title, [knoten('s', 'SHOW', 'beispiel', 2020)], keine).art === 'treffer')
pruefe('Name aus dem Originaltitel genügt', waehleKnoten({ titleNative: '例', titleEn: 'Other', format: 'TV', episodes: 12, jpYear: 2020 } as Title, [knoten('s', 'SHOW', '例', 2020)], keine).art === 'treffer')

/* Suchbegriffe */
pruefe('Gleiche Namen werden nur einmal gesucht', suchNamen(miraculous).length === 2, suchNamen(miraculous))
pruefe('Ein Titel ohne Namen hat keine Suchbegriffe', suchNamen({} as Title).length === 0)
pruefe('Reihenfolge deutsch, romaji, englisch', suchNamen({ titleDe: 'A', titleRomaji: 'B', titleEn: 'C' } as Title).join() === 'A,B,C')

/* Schlange */
const t = (id: number, extra: Partial<Title> = {}) => ({ id, titleEn: `Titel ${id}`, ...extra }) as Title
const tmdbVon = (x: Title) => (x as Title & { tmdbId?: number }).tmdbId
const titel = [t(1), t(2), t(3, { tmdbId: 5 } as Partial<Title>), t(4), t(5, { titleEn: undefined }), t(6)]
const bestand = { '2': { geprueftAm: '2026-10-01' }, '4': { geprueftAm: '2026-10-20' }, '6': { geprueftAm: '2026-10-10' } }
const reihe = namensSchlange({ titles: titel, bestand, tmdbVon, grenze: '2026-10-15' }).map((x) => x.id)
pruefe('Schlange: nie gefragt zuerst, dann ältester; TMDB-Titel, Titel ohne Namen und frische Befunde fehlen', reihe.join() === '1,2,6', reihe)
pruefe('Schlange: bei gleichem Stand entscheidet die Kennung (kleinere zuerst)', namensSchlange({ titles: [t(9), t(8)], bestand: {}, tmdbVon, grenze: '2026-10-15' }).map((x) => x.id).join() === '8,9')
pruefe('Schlange: Befund genau an der Grenze ist noch frisch', namensSchlange({ titles: [t(7)], bestand: { '7': { geprueftAm: '2026-10-15' } }, tmdbVon, grenze: '2026-10-15' }).length === 0)
pruefe('Schlange: ein Tag vor der Grenze ist fällig', namensSchlange({ titles: [t(7)], bestand: { '7': { geprueftAm: '2026-10-14' } }, tmdbVon, grenze: '2026-10-15' }).length === 1)
pruefe('Bekannte Kennungen: nur positive, doppelte einmal', [...bekannteTmdbKennungen([t(1, { tmdbId: 5 } as Partial<Title>), t(2, { tmdbId: 5 } as Partial<Title>), t(3, { tmdbId: -3 } as Partial<Title>), t(4)], tmdbVon)].join() === '5')

/* Lage und Verdrahtung */
pruefe('namenProLauf liest den Wert hinter --namen', namenProLauf('tsx pipeline/fetch-justwatch-audio.ts --limit 60 --namen 60') === 60)
pruefe('namenProLauf: ohne den Schalter 0', namenProLauf('tsx pipeline/fetch-justwatch-audio.ts --limit 60') === 0 && namenProLauf(undefined) === 0)
pruefe('namenProLauf: Schalter ohne Zahl 0', namenProLauf('x --namen') === 0 && namenProLauf('x --namen --limit 5') === 0)
const lage = namensLage([t(1), t(2), t(3), t(4, { tmdbId: 5 } as Partial<Title>), t(5, { titleEn: undefined })], { '2': { geprueftAm: '2026-10-01' }, '3': { geprueftAm: '2026-10-09' } }, tmdbVon, '2026-10-09', 7)
pruefe('Lage: zählt Titel ohne TMDB-Kennung und mit Namen (3), nie gefragt (1), verfallen (1: vor der Grenze, Grenztag selbst nicht), Kapazität 18 Läufe', lage.ohneTmdb === 3 && lage.nieGefragt === 1 && lage.verfallen === 1 && lage.kapazitaet === 126, lage)
const skripte = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8')).scripts as Record<string, string>
/* 859 Titel ohne TMDB-Kennung (06.11.2026) in 18 Tagesläufen je 21 Tage → mindestens 48 je Lauf. */
pruefe('Verdrahtung: der Tageslauf fragt mindestens 48 Titel ohne TMDB-Kennung über den Namen', namenProLauf(skripte['data:justwatch-frisch']) >= 48, skripte['data:justwatch-frisch'])
pruefe('Verdrahtung: der Cartoon-Lauf fragt nicht über Namen', namenProLauf(skripte['data:justwatch-cartoons']) === 0, skripte['data:justwatch-cartoons'])

if (fehler) {
  console.error(`${fehler} von ${faelle} Prüfungen fehlgeschlagen`)
  process.exit(1)
}
console.log(`check-jw-namenssuche: ok (${faelle} Prüfungen: Anlassfall 10017058, Gegenproben Jahr/Art/Teilname/Ziffer/mehrdeutig/fremd, Schlange, Lage, Verdrahtung in package.json)`)
