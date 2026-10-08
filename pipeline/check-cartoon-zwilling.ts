/**
 * Zusicherung: Ein Werk, das auch als Anime geführt wird (AniList, aniSearch, MAL), steht nicht zusätzlich als Cartoon in `cartoons.json`
 * (Regel: `lib/cartoon-zwilling.ts`). Dazu der Umzug: gemerkte Cartoons und Adressen ziehen auf den Anime-Titel.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-cartoon-zwilling.ts`
 */
import { readFileSync } from 'node:fs'
import type { Title } from '../shared/types.ts'
import { findeZwillinge, folgenPassen, tmdbJeAnimeAus, ZWILLING_AUSNAHMEN } from './lib/cartoon-zwilling.ts'
import { cartoonUmzug, ladeAkVon } from './lib/ausgabe-kennung.ts'
import { umleiteKarte, umleiteListe } from '../web/src/lib/ak-umleiten.ts'
import { loadDubChecks } from './lib/dub-confirmed.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const lies = <T>(pfad: string): T => JSON.parse(readFileSync(pfad, 'utf8')) as T
const t = (o: Partial<Title> & { id: number }): Title => ({ streams: [], ...o }) as unknown as Title

console.log('\nCartoon oder Anime (Werkvergleich):')
{
  const cartoon = (o: Partial<Title> & { id: number }) => t({ titleEn: 'Rooster Fighter', jpYear: 2026, episodes: 12, tmdbId: 5, ...o })
  const anime = [t({ id: 179813, titleRomaji: 'Niwatori Fighter', titleEn: 'Rooster Fighter', jpYear: 2026, episodes: 12, malId: 59393 })]
  const ohneKennung = findeZwillinge([cartoon({ id: -5 })], anime, new Map())
  pruefe('Name, Jahr und Folgenzahl gleich: Zwilling, MAL des Anime wird mitgeführt', ohneKennung.zwillinge[0]?.zwilling === 179813 && ohneKennung.zwillinge[0]?.mal === 59393, ohneKennung)
  pruefe('TMDB-Kennung geht dem Namen vor (anderer Name, gleiches Jahr und gleiche Folgenzahl)', findeZwillinge([cartoon({ id: -5, titleEn: 'Anders' })], anime, new Map([[5, [179813]]])).zwillinge[0]?.beleg === 'tmdb-kennung')
  pruefe('Name allein genügt nicht: anderes Jahr', findeZwillinge([cartoon({ id: -5, jpYear: 2015 })], anime, new Map()).zwillinge.length === 0)
  pruefe('Name allein genügt nicht: Folgenzahl kein Vielfaches (steht dann unter unsicher)', (() => { const r = findeZwillinge([cartoon({ id: -5, episodes: 13 })], anime, new Map()); return r.zwillinge.length === 0 && r.unsicher.length === 1 })())
  pruefe('Staffeln: 16 Folgen gegen 8 passen, 7 gegen 8 und 12 gegen 5 nicht', folgenPassen(16, 8) && !folgenPassen(7, 8) && !folgenPassen(12, 5) && folgenPassen(undefined, 8))
  const doppelt = [...anime, t({ id: 10_000_000 + 7, titleEn: 'Rooster Fighter', jpYear: 2026, episodes: 12 })]
  pruefe('AniList-Titel schlägt den aniSearch-Zwilling desselben Werks', findeZwillinge([cartoon({ id: -5 })], doppelt, new Map()).zwillinge[0]?.zwilling === 179813)
  pruefe('Nur ein aniSearch-Titel: auch der ist ein Zwilling', findeZwillinge([cartoon({ id: -5 })], [doppelt[1]!], new Map()).zwillinge[0]?.zwilling === 10_000_007)
  pruefe('Kein Name, keine Kennung: kein Zwilling', findeZwillinge([cartoon({ id: -5, titleEn: 'Etwas Anderes', tmdbId: 9 })], anime, new Map()).zwillinge.length === 0)
}

console.log('\nCartoon oder Anime (ausgelieferter Datensatz):')
{
  const cartoons = lies<Title[]>('public/data/cartoons.json')
  const anime = [...lies<Title[]>('public/data/titles.json'), ...lies<Title[]>('public/data/ohne-synchro.json')]
  const { zwillinge, unsicher } = findeZwillinge(cartoons, anime, tmdbJeAnimeAus(lies('data/tmdb-titles.json')))
  pruefe('Kein ausgelieferter Cartoon hat einen Anime-Zwilling (AniList, aniSearch, MAL); gefunden = Cartoon- und Anime-Kennung', zwillinge.length === 0, zwillinge.map((z) => [z.cartoonId, z.zwilling]))
  const offen = unsicher.filter((u) => !(u.cartoonId in ZWILLING_AUSNAHMEN))
  pruefe('Jeder Cartoon mit gleichnamigem, aber unpassendem Anime-Eintrag steht begründet in ZWILLING_AUSNAHMEN', offen.length === 0, offen)
  pruefe('Jede Ausnahme nennt ihren Grund', Object.values(ZWILLING_AUSNAHMEN).every((g) => g.length > 20))
  const ids = new Set(cartoons.map((c) => c.id))
  pruefe('Jede Ausnahme gehört zu einem noch ausgelieferten Cartoon (sonst streichen)', Object.keys(ZWILLING_AUSNAHMEN).every((id) => ids.has(Number(id))), Object.keys(ZWILLING_AUSNAHMEN).filter((id) => !ids.has(Number(id))))

  const umzug = lies<[number, number][]>('data/cartoon-umzug.json')
  const anIds = new Set(anime.map((a) => a.id))
  pruefe('Umzug: jeder umgezogene Cartoon ist weg, sein Anime-Titel wird ausgeliefert', umzug.every(([c, a]) => c < 0 && !ids.has(c) && anIds.has(a)), umzug.filter(([c, a]) => ids.has(c) || !anIds.has(a)))
  pruefe('Umzug: eine Cartoon-Kennung steht nur einmal im Umzug', new Set(umzug.map(([c]) => c)).size === umzug.length)
  const { akVon } = ladeAkVon('data/kennungen.json')
  const paare = cartoonUmzug('data/kennungen.json', akVon)
  pruefe('Umzug: ak-umleitung.json führt jede alte Cartoon-Kennung auf die ak des Anime-Titels', paare.length === umzug.length && paare.every(([c, ak], i) => c === umzug[i]![0] && ak === akVon(umzug[i]![1]) && ak > 0), paare)
  const belege = new Set(loadDubChecks().map((b) => b.anilistId))
  pruefe('Umzug: kein Handbeleg hängt noch an einem umgezogenen Cartoon (sonst auf den Anime-Titel umhängen)', umzug.every(([c]) => !belege.has(c)), umzug.filter(([c]) => belege.has(c)))
  const abbild = new Map(paare)
  const [alt, neu] = paare[0] ?? [-1, 1]
  pruefe('Umzug (Browser): Favoriten und Karten mit der Cartoon-Kennung ziehen auf den Anime, ohne Doppel', umleiteListe([alt, neu, 3], abbild).join() === `${neu},3` && umleiteKarte({ [alt]: '2026-10-01' }, abbild)[neu] === '2026-10-01')
}
console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
