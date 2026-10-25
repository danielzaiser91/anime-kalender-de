/**
 * Bestandsteil von `check-cartoon-zwilling.ts`: Kein ausgelieferter Cartoon hat einen Anime-Zwilling; der Umzug ist vollständig (`cartoons.json`, `titles.json`, `ohne-synchro.json`).
 * Liest `public/data` und gehört deshalb in `check:bestand`, nicht in `check:logic` (der Bestand liegt hinter neueren Rohdaten zurück;
 * PR-Ketten wurden daran rot, 12.10.2026). Die Einheitenprüfungen ohne Dateizugriff stehen in `check-cartoon-zwilling.ts`.
 */
import { readFileSync } from 'node:fs'
import type { Title } from '../shared/types.ts'
import { findeZwillinge, tmdbJeAnimeAus, ZWILLING_AUSNAHMEN } from './lib/cartoon-zwilling.ts'
import { cartoonUmzug, ladeAkVon } from './lib/ausgabe-kennung.ts'
import { umleiteKarte, umleiteListe } from '../web/src/lib/ak-umleiten.ts'
import { loadDubChecks, neinHandbelege } from './lib/dub-confirmed.ts'
import { alsTitel, type CartoonEintrag } from './lib/cartoons.ts'
import { fehlendeAnbieter } from './bau/cartoon-zu-anime.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const lies = <T>(pfad: string): T => JSON.parse(readFileSync(pfad, 'utf8')) as T

console.log('\nCartoon oder Anime (ausgelieferter Datensatz):')
{
  const cartoons = lies<Title[]>('public/data/cartoons.json')
  const anime = [...lies<Title[]>('public/data/titles.json'), ...lies<Title[]>('public/data/ohne-synchro.json')]
  const { zwillinge, unsicher } = findeZwillinge(cartoons, anime, tmdbJeAnimeAus(lies('data/tmdb-titles.json')))
  pruefe('Kein ausgelieferter Cartoon hat einen Anime-Zwilling (AniList, aniSearch, MAL); gefunden = Cartoon- und Anime-Kennung', zwillinge.length === 0, zwillinge.map((z) => [z.cartoonId, z.zwilling]))
  const mitAnimeKennung = cartoons.filter((c) => c.malId || c.anisearchId || c.id > 0)
  pruefe('Kein ausgelieferter Cartoon trägt eine AniList- (positive Kennung), MAL- oder aniSearch-Kennung (was dort als Anime geführt wird, ist kein Cartoon)', mitAnimeKennung.length === 0, mitAnimeKennung.map((c) => c.id))
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
  /* Projektziel 4: Die Anbieter des Cartoons (TMDB, Deutschland) bleiben am Zwilling erhalten, nur ohne Sprachangabe. */
  const roh = lies<Record<string, CartoonEintrag>>('data/cartoons.json')
  const nachId = new Map(anime.map((a) => [a.id, a]))
  const handNein = neinHandbelege(loadDubChecks())
  const fehlend = umzug.flatMap(([c, a]) => (roh[String(c)] && nachId.get(a) ? fehlendeAnbieter(alsTitel(roh[String(c)]!), nachId.get(a)!, handNein).map((s) => [c, a, s.platform]) : []))
  pruefe('Umzug: kein Anbieter des umgezogenen Cartoons fehlt am Anime-Titel', fehlend.length === 0, fehlend)
  const uebernommen = anime.flatMap((a) => (a.streams ?? []).filter((s) => s.herkunft === 'tmdb'))
  pruefe('Umzug: ein übernommener Anbieter trägt keine Sprachangabe und steht am Titel nicht noch einmal', uebernommen.every((s) => s.dub === undefined) && anime.every((a) => (a.streams ?? []).filter((s) => s.herkunft === 'tmdb').every((t) => (a.streams ?? []).filter((s) => s.platform === t.platform).length === 1)))
  const belege = new Set(loadDubChecks().map((b) => b.anilistId))
  pruefe('Umzug: kein Handbeleg hängt noch an einem umgezogenen Cartoon (sonst auf den Anime-Titel umhängen)', umzug.every(([c]) => !belege.has(c)), umzug.filter(([c]) => belege.has(c)))
  const abbild = new Map(paare)
  const [alt, neu] = paare[0] ?? [-1, 1]
  pruefe('Umzug (Browser): Favoriten und Karten mit der Cartoon-Kennung ziehen auf den Anime, ohne Doppel', umleiteListe([alt, neu, 3], abbild).join() === `${neu},3` && umleiteKarte({ [alt]: '2026-10-01' }, abbild)[neu] === '2026-10-01')
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
console.log(`VERSTÖSSE: ${verletzt}`)
process.exit(verletzt ? 1 : 0)
