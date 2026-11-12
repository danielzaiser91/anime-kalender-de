/**
 * Zusicherungen: dieselbe TMDB-Kennung an Titeln verschiedener Reihen (`reihenfremdGeteilt`) und geteilte Filme (`geteilteFilmGruppen`) werden gefunden (`lib/tmdb-eindeutig.ts`).
 * Der Bestandsaufruf steht in `check-logic-bestand.ts`. Aufruf: `npm run check:logic`.
 */
import { geteilteFilmeWarnzeile, geteilteFilmGruppen, reihenfremdGeteilt, reihenfremdImBestand } from './lib/tmdb-eindeutig.ts'
import { pruefeTmdbHandBestand } from './lib/tmdb-hand-bestand.ts'

let verletzt = 0
let gesamt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  gesamt++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('\nTMDB-Kennung gehört einer Reihe')
// Kitaro-Fall (PR 2874): Original 130622 (Reihe 130622) und Shinsei-ban 10019697 (Reihe 10019697) trugen beide movie/904759.
const reihen: Record<string, number | undefined> = { '130622': 130622, '10019697': 10019697, '5': 7, '6': 7, '8': 9, '9': 9, '11': 4, '12': 5 }
const reiheVon = (id: string) => reihen[id]
const kitaro = { '130622': { tmdbId: 904759, kind: 'movie' as const }, '10019697': { tmdbId: 904759, kind: 'movie' as const } }

const fund = reihenfremdGeteilt(kitaro, reiheVon)
pruefe('Kitaro: derselbe Film in zwei Reihen wird gemeldet', fund.length === 1 && fund[0]!.schluessel === 'movie/904759', fund)
pruefe('der Fund nennt beide Titel mit Reihe', fund[0]?.titel.join() === '130622@130622,10019697@10019697', fund)

const staffeln = { '5': { tmdbId: 77, kind: 'tv' as const }, '6': { tmdbId: 77, kind: 'tv' as const } }
pruefe('zwei Staffeln derselben Reihe sind erlaubt', reihenfremdGeteilt(staffeln, reiheVon).length === 0)

const art = { '11': { tmdbId: 34065, kind: 'tv' as const }, '12': { tmdbId: 34065, kind: 'movie' as const } }
pruefe('Serie und Film mit gleicher Zahl sind verschiedene Kennungen', reihenfremdGeteilt(art, reiheVon).length === 0)

const ohneArt = { '11': { tmdbId: 5 }, '12': { tmdbId: 5, kind: 'tv' as const } }
pruefe('fehlt `kind`, gilt tv', reihenfremdGeteilt(ohneArt, reiheVon).length === 1)

const fremderEintrag = { '5': { tmdbId: 77, kind: 'tv' as const }, '999': { tmdbId: 77, kind: 'tv' as const } }
pruefe('ein Eintrag ohne Titel im Bestand zählt nicht', reihenfremdGeteilt(fremderEintrag, reiheVon).length === 0)

const ohneId = { '5': {}, '11': { tmdbId: undefined } }
pruefe('Einträge ohne Kennung zählen nicht', reihenfremdGeteilt(ohneId, reiheVon).length === 0)

const drei = { '5': { tmdbId: 77, kind: 'tv' as const }, '6': { tmdbId: 77, kind: 'tv' as const }, '11': { tmdbId: 77, kind: 'tv' as const }, '8': { tmdbId: 3, kind: 'tv' as const }, '9': { tmdbId: 3, kind: 'tv' as const } }
const fundDrei = reihenfremdGeteilt(drei, reiheVon)
pruefe('zwei Staffeln plus ein Fremder: ein Fund, die zweite Kennung bleibt sauber', fundDrei.length === 1 && fundDrei[0]!.titel.length === 3, fundDrei)

// Über den Bestand: Natsume Staffel 1 (4081) trägt keine franchiseId, Staffel 2 (5300) nennt 4081.
const bestand = new Map<number, { franchiseId?: number }>([[4081, {}], [5300, { franchiseId: 4081 }], [130622, { franchiseId: 130622 }], [10019697, { franchiseId: 10019697 }]])
const natsume = { '4081': { tmdbId: 69500, kind: 'tv' as const }, '5300': { tmdbId: 69500, kind: 'tv' as const } }
pruefe('Bestand: Staffel ohne franchiseId gilt als Reihe ihrer selbst, Staffel 2 nennt sie', reihenfremdImBestand(natsume, bestand).length === 0)
const ohneReihe = reihenfremdImBestand({ '4081': { tmdbId: 5, kind: 'tv' as const }, '130622': { tmdbId: 5, kind: 'tv' as const } }, bestand)
pruefe('Bestand: Titel ohne franchiseId und fremder Titel mit gleicher Kennung werden gemeldet', ohneReihe.length === 1 && ohneReihe[0]!.titel.join() === '4081@4081,130622@130622', ohneReihe)
const kitaroBestand = reihenfremdImBestand({ ...kitaro, '77777': { tmdbId: 904759, kind: 'movie' as const } }, bestand)
pruefe('Bestand: Kitaro wird gefunden, ein Cache-Eintrag ohne Titel im Bestand zählt nicht', kitaroBestand.length === 1 && kitaroBestand[0]!.titel.length === 2, kitaroBestand)

// Geteilte Filme (Ratsche): gezählt wird je Kennung, nur im Bestand, nur Filme.
const imBestand = (id: string) => id !== '999'
const filme = {
  '1': { tmdbId: 5, kind: 'movie' as const },
  '2': { tmdbId: 5, kind: 'movie' as const },
  '3': { tmdbId: 5, kind: 'movie' as const },
  '4': { tmdbId: 6, kind: 'movie' as const },
  '7': { tmdbId: 8, kind: 'movie' as const },
  '999': { tmdbId: 8, kind: 'movie' as const },
  '10': { tmdbId: 9, kind: 'tv' as const },
  '11': { tmdbId: 9, kind: 'tv' as const },
  '12': { tmdbId: 6, kind: 'tv' as const },
}
const gruppen = geteilteFilmGruppen(filme, imBestand)
pruefe('Filme: eine Gruppe mit drei Titeln, ein Einzelfilm, ein Film mit Titel außerhalb und zwei Serien zählen nicht', gruppen.length === 1 && gruppen[0]!.schluessel === 'movie/5' && gruppen[0]!.titel.join() === '1,2,3', gruppen)
const zwei = geteilteFilmGruppen({ ...filme, '13': { tmdbId: 20, kind: 'movie' as const }, '14': { tmdbId: 20, kind: 'movie' as const } }, imBestand)
pruefe('Filme: ein zweiter Fall mit genau zwei Titeln zählt als zweite Gruppe', zwei.length === 2, zwei)

console.log('\nNeue geteilte Filme warnen, bekannte nicht')
const bekannt = ['movie/5']
const keine = geteilteFilmeWarnzeile(gruppen, bekannt)
pruefe('bekannte Gruppe: keine Zeile', keine === undefined, keine)
const eine = geteilteFilmeWarnzeile(zwei, bekannt)
pruefe('neue Gruppe (movie/20, Titel 13 und 14): eine Warnzeile mit Kennung und Titeln', eine?.startsWith('⚠ WARNUNG [vorher rot] ') === true && eine.includes('movie/20') && !eine.includes('movie/5,') && eine.endsWith(': 13, 14'), eine)
pruefe('Warnzeile zählt 2 Titel', eine?.includes(': 2 neue Kennung') === true, eine)
pruefe('ohne Gruppen: keine Zeile', geteilteFilmeWarnzeile([], bekannt) === undefined)
const beide = geteilteFilmeWarnzeile(zwei, [])
pruefe('beide neu: beide Kennungen in einer Zeile', beide?.includes('movie/5, movie/20') === true && beide.endsWith(': 1, 2, 3, 13, 14'), beide)
const fuenf = ['movie/20455', 'movie/212161', 'movie/510242', 'movie/618851', 'movie/843267']
pruefe('Standardliste: die fünf Bestandskennungen warnen nicht', geteilteFilmeWarnzeile(fuenf.map((schluessel) => ({ schluessel, titel: ['1', '2'] }))) === undefined)
pruefe('Standardliste: ein sechster Film warnt', geteilteFilmeWarnzeile([{ schluessel: 'movie/904759', titel: ['1', '2'] }])?.includes('movie/904759') === true)

console.log('\nBestandsblock mit Fixture-Dateien (Verdrahtung)')
// Schlüssel = Dateiname; Titel 1 und 2 stehen in einer Reihe (franchiseId 1), 3 in einer anderen.
function lauf(dateien: Record<string, unknown>) {
  const zeilen: string[] = []
  const rot: string[] = []
  const n = pruefeTmdbHandBestand(
    (d) => JSON.stringify(dateien[d.split('/').pop()!]),
    (name, ok) => void (ok || rot.push(name)),
    (z) => zeilen.push(z),
  )
  return { n, zeilen, rot }
}
const titel = [{ id: 1, franchiseId: 1 }, { id: 2, franchiseId: 1 }, { id: 3, franchiseId: 3 }]
const basis = { 'tmdb-von-hand.yaml': [], 'titles.json': titel, 'ohne-synchro.json': [] }
const neuerFilm = lauf({ ...basis, 'tmdb-titles.json': { '1': { tmdbId: 777, kind: 'movie' }, '2': { tmdbId: 777, kind: 'movie' } } })
pruefe('Lauf: neuer geteilter Film in einer Reihe: genau eine Warnzeile, keine rote Zusicherung', neuerFilm.zeilen.length === 1 && neuerFilm.zeilen[0]!.includes('movie/777') && neuerFilm.zeilen[0]!.includes('[vorher rot]') && neuerFilm.rot.length === 0, neuerFilm)
pruefe('Lauf: drei Zusicherungen gefahren', neuerFilm.n === 3, neuerFilm.n)
const bekannterFilm = lauf({ ...basis, 'tmdb-titles.json': { '1': { tmdbId: 20455, kind: 'movie' }, '2': { tmdbId: 20455, kind: 'movie' } } })
pruefe('Lauf: bekannter Film (movie/20455): keine Zeile', bekannterFilm.zeilen.length === 0, bekannterFilm)
const fremderFilm = lauf({ ...basis, 'tmdb-titles.json': { '1': { tmdbId: 778, kind: 'movie' }, '3': { tmdbId: 778, kind: 'movie' } } })
pruefe('Lauf: Film an zwei Reihen bleibt hart rot (Reihenregel), nicht nur Warnung', fremderFilm.rot.join() === 'keine TMDB-Kennung hängt an Titeln verschiedener Reihen', fremderFilm)
const ausserhalb = lauf({ ...basis, 'tmdb-titles.json': { '1': { tmdbId: 779, kind: 'movie' }, '9': { tmdbId: 779, kind: 'movie' } } })
pruefe('Lauf: zweiter Titel außerhalb des Bestands bildet keine Gruppe', ausserhalb.zeilen.length === 0, ausserhalb)

console.log(`TMDB-Kennung je Reihe: ${verletzt === 0 ? `alle ${gesamt} Fälle grün` : `${verletzt} von ${gesamt} Fällen rot`}`)
if (verletzt) process.exit(1)
