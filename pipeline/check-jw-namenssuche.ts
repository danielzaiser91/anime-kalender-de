/**
 * Zuordnung von JustWatch-Treffern über Namen, Jahr und Art (`lib/jw-namenssuche.ts`) für Titel ohne TMDB-Kennung.
 * Anlass: „Miraculous World: New York, United Heroez“ (10017058) — die Treffer unten stammen wörtlich aus der JustWatch-Antwort vom 06.11.2026.
 * Gegenproben: gleicher Name anderes Werk (Jahr), Film gegen Serie, Teilname, Ziffer, zwei Treffer, Kennung eines anderen Titels.
 * Erwartete Werte stehen fest im Test, nicht aus dem Modul. Läuft in `check:logic`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Title } from '../shared/types.ts'
import { bekannteTmdbKennungen, geschwisterKennungen, namenProLauf, namensLage, namensSchlange, namensSchluessel, ohneStaffelzusatz, passtZumTitel, suchNamen, waehleKnoten, type NamensKnoten } from './lib/jw-namenssuche.ts'

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
pruefe('Serie ohne Folgenzahl lässt beides zu (nichts behaupten, was nicht belegt ist)', waehleKnoten({ ...serie, episodes: undefined } as Title, [knoten('f', 'MOVIE', 'Beispiel', 2020)], keine).art === 'treffer')
pruefe('Serie mit 1 Folge lässt beides zu (Film oder Serie)', waehleKnoten({ ...serie, episodes: 1 } as Title, [knoten('f', 'MOVIE', 'Beispiel', 2020)], keine).art === 'treffer')
pruefe('OVA lässt beides zu', waehleKnoten({ ...serie, format: 'OVA', episodes: 3 } as Title, [knoten('f', 'MOVIE', 'Beispiel', 2020)], keine).art === 'treffer')
pruefe('Name aus Romaji genügt', waehleKnoten({ titleRomaji: 'Beispiel', format: 'TV', episodes: 12, jpYear: 2020 } as Title, [knoten('s', 'SHOW', 'beispiel', 2020)], keine).art === 'treffer')
pruefe('Name aus dem Originaltitel genügt', waehleKnoten({ titleNative: '例', titleEn: 'Other', format: 'TV', episodes: 12, jpYear: 2020 } as Title, [knoten('s', 'SHOW', '例', 2020)], keine).art === 'treffer')

/* Staffelname gegen Franchise-Eintrag (19.11.2026): JustWatch DE führt nur das Franchise. Erwartungen fest, Treffer nach der Messung des Analysten (ts-Kennungen). */
const staffelTitel = (extra: Partial<Title>) => ({ format: 'TV', episodes: 12, ...extra }) as Title
const ramparts = staffelTitel({ titleDe: 'The Ramparts of Ice: Staffel 2', titleEn: 'The Ramparts of Ice Season 2', titleRomaji: 'Koori no Jouheki 2nd Season', jpYear: 2026 })
pruefe('Staffel: Ramparts of Ice Staffel 2 → Franchise ts469083', waehleKnoten(ramparts, [knoten('ts469083', 'SHOW', 'The Ramparts of Ice', 2026)], keine).art === 'treffer')
const superWings = staffelTitel({ titleDe: 'Super Wings (Staffel 2)', titleRomaji: 'Chuldong! Super Wings 2', episodes: 52, jpYear: 2017, deErstausgabe: { von: '2019-04-29', synchro: true } } as Partial<Title>)
const swKnoten = [knoten('ts56266', 'SHOW', 'Super Wings', 2014, '71026'), knoten('ts1', 'SHOW', 'Super Wings: Super Pets', 2021)]
pruefe('Staffel: Super Wings (Staffel 2) → ts56266, Franchise-Start 2014 vor unserem Jahr', waehleKnoten(superWings, swKnoten, keine).art === 'treffer')
pruefe('Staffel: Staffel 4 und 6 mit denselben Namensmustern', ['Super Wings (Staffel 4)', 'Super Wings: Staffel 6'].every((n) => waehleKnoten(staffelTitel({ ...superWings, titleDe: n }), swKnoten, keine).art === 'treffer'))
pruefe('Staffel: T・P Bon: Staffel 2 → ts406797', waehleKnoten(staffelTitel({ titleDe: 'T・P Bon: Staffel 2', titleEn: 'T・P Bon: Season 2', format: 'ONA', jpYear: 2024 }), [knoten('ts406797', 'SHOW', 'T・P Bon', 2024)], keine).art === 'treffer')
pruefe('Staffel: Teil 2 über den englischen Namen (Part 2) → ts328671', waehleKnoten(staffelTitel({ titleDe: 'Bastard!! Der Gott der Zerstörung: Teil 2', titleEn: 'Bastard!! Heavy Metal, Dark Fantasy: Part 2', jpYear: 2022 }), [knoten('ts328671', 'SHOW', 'Bastard!! Heavy Metal, Dark Fantasy', 2022)], keine).art === 'treffer')
pruefe('Staffel: Devil May Cry: Staffel 2 → ts449348', waehleKnoten(staffelTitel({ titleDe: 'Devil May Cry: Staffel 2', titleEn: 'Devil May Cry: Season 2', jpYear: 2026 }), [knoten('ts449348', 'SHOW', 'Devil May Cry', 2025)], keine).art === 'treffer')
const mondMeile = staffelTitel({ titleRomaji: 'MOONLIGHT MILE 1st Season -Lift off-', jpYear: 2007 })
pruefe('Staffel-Gegenfall: Moonlight Mile 1st Season — JustWatch hat nur den Spielfilm 2002 → keiner', waehleKnoten(mondMeile, [knoten('tm1', 'MOVIE', 'Moonlight Mile', 2002)], keine).art === 'keiner')
const goldenKamuy = staffelTitel({ titleDe: 'Golden Kamuy 2', titleEn: 'Golden Kamuy Season 2', titleRomaji: 'Golden Kamuy 2nd Season', jpYear: 2018 })
const gk = waehleKnoten(goldenKamuy, [knoten('ts78390', 'SHOW', 'Golden Kamuy', 2018), knoten('tm1208214', 'MOVIE', 'Golden Kamuy', 2024)], keine)
pruefe('Staffel: gleichnamiger MOVIE daneben stört nicht, der Treffer ist die Serie', gk.art === 'treffer' && gk.knoten.id === 'ts78390', gk)
pruefe('Staffel: nur der MOVIE desselben Namens → keiner (Serie Pflicht)', waehleKnoten(goldenKamuy, [knoten('tm1208214', 'MOVIE', 'Golden Kamuy', 2018)], keine).art === 'keiner')
pruefe('Staffel: Franchise-Start 2 Jahre nach unserem Jahr → keiner', waehleKnoten(goldenKamuy, [knoten('x', 'SHOW', 'Golden Kamuy', 2020)], keine).art === 'keiner')
pruefe('Staffel: Franchise-Start genau ein Jahr nach unserem Jahr → Treffer (Grenze)', waehleKnoten(goldenKamuy, [knoten('x', 'SHOW', 'Golden Kamuy', 2019)], keine).art === 'treffer')
pruefe('Staffel: Franchise ohne Jahr → keiner', waehleKnoten(goldenKamuy, [knoten('x', 'SHOW', 'Golden Kamuy', null)], keine).art === 'keiner')
pruefe('Staffel: Titel ohne Jahr → keiner', waehleKnoten({ ...goldenKamuy, jpYear: undefined } as Title, [knoten('x', 'SHOW', 'Golden Kamuy', 2018)], keine).art === 'keiner')
pruefe('Staffel: Titel selbst ein Film → keiner', waehleKnoten({ ...goldenKamuy, format: 'MOVIE' } as Title, [knoten('x', 'SHOW', 'Golden Kamuy', 2018)], keine).art === 'keiner')
pruefe('Staffel: zwei Serien gleichen Franchise-Namens → mehrdeutig', waehleKnoten(goldenKamuy, [knoten('a', 'SHOW', 'Golden Kamuy', 2018), knoten('b', 'SHOW', 'Golden Kamuy', 2017)], keine).art === 'mehrdeutig')
pruefe('Staffel: derselbe Knoten aus zwei Suchen ist ein Treffer', waehleKnoten(goldenKamuy, [knoten('a', 'SHOW', 'Golden Kamuy', 2018), knoten('a', 'SHOW', 'Golden Kamuy', 2018)], keine).art === 'treffer')
pruefe('Staffel: ein Teilname des Franchise reicht nicht', waehleKnoten(goldenKamuy, [knoten('x', 'SHOW', 'Golden', 2018)], keine).art === 'keiner')
pruefe('Staffel: Titel ohne Staffelzusatz nimmt den Franchise-Weg nicht (Baki ≠ Baki 2 bleibt streng)', waehleKnoten({ titleEn: 'Baki 2', format: 'TV', episodes: 26, jpYear: 2018 } as Title, [knoten('x', 'SHOW', 'Baki', 2018)], keine).art === 'keiner')
pruefe('Staffel: strenger Treffer geht vor (JustWatch führt die Staffel unter ihrem Namen)', (() => { const u = waehleKnoten(goldenKamuy, [knoten('s', 'SHOW', 'Golden Kamuy Season 2', 2018), knoten('f', 'SHOW', 'Golden Kamuy', 2018)], keine); return u.art === 'treffer' && u.knoten.id === 's' })())
const tvT = (x: Title) => (x as Title & { tmdbId?: number }).tmdbId
const swHalter = new Set([71026])
const fremdFr = waehleKnoten(superWings, swKnoten, swHalter)
pruefe('Staffel: Kennung hält ein Titel einer anderen Reihe → fremd', fremdFr.art === 'fremd' && fremdFr.tmdbId === 71026, fremdFr)
pruefe('Staffel: Kennung hält nur eine Staffel derselben Reihe (Geschwister) → Treffer', waehleKnoten(superWings, swKnoten, swHalter, swHalter).art === 'treffer')
pruefe('Staffel: Geschwister-Ausnahme gilt nur für die Kennung der Geschwister', waehleKnoten(superWings, swKnoten, swHalter, new Set([999])).art === 'fremd')
pruefe('Staffel: strenger Treffer bleibt fremd, auch wenn Geschwister die Kennung führen', waehleKnoten(miraculous, ANTWORT, new Set([755812]), new Set([755812])).art === 'fremd')
const sw1 = { id: 10012621, titleDe: 'Super Wings', jpYear: 2014, tmdbId: 71026 } as Title & { tmdbId: number }
const swMax = { id: 10019348, titleDe: 'Super Wings: Maximum Speed', tmdbId: 1148189 } as Title & { tmdbId: number }
const swS2 = { ...superWings, id: 10014353 } as Title
const sk = geschwisterKennungen(swS2, [sw1, swMax, swS2], tvT)
pruefe('Geschwister: Staffel 1 derselben Reihe ja, Maximum Speed (anderer Name) nein, der Titel selbst nicht', sk.size === 1 && sk.has(71026), [...sk])
pruefe('Geschwister: auch eine andere Staffel mit Zusatz zählt', geschwisterKennungen(swS2, [{ id: 3, titleDe: 'Super Wings (Staffel 4)', tmdbId: 71026 } as Title & { tmdbId: number }], tvT).has(71026))
const swS2mit = { ...swS2, tmdbId: 5 } as Title & { tmdbId: number }
pruefe('Geschwister: der Titel selbst zählt nicht, auch mit Kennung', geschwisterKennungen(swS2mit, [swS2mit], tvT).size === 0)
pruefe('Geschwister: Originaltitel der Geschwister zählt', geschwisterKennungen({ titleNative: 'ウィング Season 2' } as Title, [{ id: 1, titleNative: 'ウィング', tmdbId: 8 } as Title & { tmdbId: number }], tvT).has(8))
pruefe('Franchise: Name aus dem Originaltitel genügt', waehleKnoten(staffelTitel({ titleNative: 'ウィング Season 2', jpYear: 2020 }), [knoten('n', 'SHOW', 'ウィング', 2020)], keine).art === 'treffer')
pruefe('Franchise: das früheste Jahr zählt, nicht das späteste (Franchise 2019 gegen jpYear 2017 / DE 2019)', waehleKnoten(superWings, [knoten('x', 'SHOW', 'Super Wings', 2019)], keine).art === 'keiner')
pruefe('Geschwister: Titel ohne Staffelzusatz hat keine', geschwisterKennungen(sw1, [{ ...sw1, id: 5 } as Title], tvT).size === 0)
pruefe('Geschwister: Titel ohne Kennung zählt nicht', geschwisterKennungen(swS2, [{ id: 7, titleDe: 'Super Wings' } as Title], tvT).size === 0)

/* Staffelzusatz */
const kurz = (n: string) => ohneStaffelzusatz(n)
pruefe('Zusatz: „: Staffel 2“, „(Staffel 2)“, „Season 2“, „2nd Season“, „(Teil 3)“, „Part 2“', [kurz('A: Staffel 2'), kurz('A (Staffel 2)'), kurz('A Season 2'), kurz('A 2nd Season'), kurz('A (Teil 3)'), kurz('A: Part 2'), kurz('A 3rd Season'), kurz('A 11th Season'), kurz('A 1st Season'), kurz('A - Teil 2'), kurz('A – Season 3')].every((x) => x === 'A'))
pruefe('Zusatz: ohne Ziffer („Final Season“, „Staffel“) und mittendrin kein Zusatz', kurz('A Final Season') === undefined && kurz('A Staffel') === undefined && kurz('Season 2 of A') === undefined && kurz('Baki 2') === undefined)
pruefe('Zusatz: nur der Zusatz → kein Name übrig', kurz('Staffel 2') === undefined && kurz('') === undefined)
pruefe('Zusatz: Klein-/Großschreibung egal, Name behält seine Schreibweise', kurz('Super Wings: STAFFEL 6') === 'Super Wings')
pruefe('Suchbegriffe: Staffelname fragt auch das Franchise (zuletzt), ohne Doppelte', suchNamen(superWings).join('|') === 'Super Wings (Staffel 2)|Chuldong! Super Wings 2|Super Wings', suchNamen(superWings))
pruefe('Suchbegriffe: Name ohne Zusatz bleibt wie vorher', suchNamen({ titleDe: 'A', titleRomaji: 'B', titleEn: 'C' } as Title).join() === 'A,B,C')

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

/* Abbau eines Schubs (19.11.2026): 48 nie gefragte + 93 Alt-Befunde vom 07.09. (TMDB-Kennung verloren) = 141 fällig; nie gefragte stehen vorn, die Alt-Befunde danach. */
function laeufeBisLeer(proLauf: number): number {
  const ti = Array.from({ length: 141 }, (_, i) => t(100 + i))
  const stand: Record<string, { geprueftAm: string }> = {}
  for (const x of ti.slice(48)) stand[String(x.id)] = { geprueftAm: '2026-09-07' }
  let n = 0
  for (; n < 10; n++) {
    const q = namensSchlange({ titles: ti, bestand: stand, tmdbVon, grenze: '2026-10-29' })
    if (!q.length) break
    for (const x of q.slice(0, proLauf)) stand[String(x.id)] = { geprueftAm: '2026-11-19' }
  }
  return n
}
pruefe('Rechnung (nur Mathematik, vom Konfigurationswert unabhängig): 141 fällige Titel brauchen bei 60 je Lauf 3 Läufe, bei 80 je Lauf 2', laeufeBisLeer(60) === 3 && laeufeBisLeer(80) === 2, [laeufeBisLeer(60), laeufeBisLeer(80)])

/* Lage und Verdrahtung */
pruefe('namenProLauf liest den Wert hinter --namen', namenProLauf('tsx pipeline/fetch-justwatch-audio.ts --limit 60 --namen 60') === 60)
pruefe('namenProLauf: ohne den Schalter 0', namenProLauf('tsx pipeline/fetch-justwatch-audio.ts --limit 60') === 0 && namenProLauf(undefined) === 0)
pruefe('namenProLauf: Schalter ohne Zahl 0', namenProLauf('x --namen') === 0 && namenProLauf('x --namen --limit 5') === 0)
const lage = namensLage([t(1), t(2), t(3), t(4, { tmdbId: 5 } as Partial<Title>), t(5, { titleEn: undefined })], { '2': { geprueftAm: '2026-10-01' }, '3': { geprueftAm: '2026-10-09' } }, tmdbVon, '2026-10-09', 7)
pruefe('Lage: zählt Titel ohne TMDB-Kennung und mit Namen (3), nie gefragt (1), verfallen (1: vor der Grenze, Grenztag selbst nicht), Kapazität 18 Läufe', lage.ohneTmdb === 3 && lage.nieGefragt === 1 && lage.verfallen === 1 && lage.kapazitaet === 126, lage)
const skripte = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8')).scripts as Record<string, string>
pruefe('Abbau mit dem Wert aus package.json: der Schub von 141 fälligen Titeln ist nach höchstens 2 Tageslaufen leer', laeufeBisLeer(namenProLauf(skripte['data:justwatch-frisch'])) <= 2, laeufeBisLeer(namenProLauf(skripte['data:justwatch-frisch'])))
/* 859 Titel ohne TMDB-Kennung (06.11.2026) in 18 Tagesläufen je 21 Tage → mindestens 48 je Lauf; seit 19.11.2026 80 (Reserve für Schübe, 1.440 ≥ 2 × 715). */
pruefe('Verdrahtung: der Tageslauf fragt mindestens 80 Titel ohne TMDB-Kennung über den Namen', namenProLauf(skripte['data:justwatch-frisch']) >= 80, skripte['data:justwatch-frisch'])
pruefe('Verdrahtung: der Cartoon-Lauf fragt nicht über Namen', namenProLauf(skripte['data:justwatch-cartoons']) === 0, skripte['data:justwatch-cartoons'])

if (fehler) {
  console.error(`${fehler} von ${faelle} Prüfungen fehlgeschlagen`)
  process.exit(1)
}
console.log(`check-jw-namenssuche: ok (${faelle} Prüfungen: Anlassfall 10017058, Gegenproben Jahr/Art/Teilname/Ziffer/mehrdeutig/fremd, Schlange, Lage, Verdrahtung in package.json)`)
