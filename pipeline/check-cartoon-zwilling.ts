/**
 * Zusicherung: Ein Werk, das auch als Anime geführt wird (AniList, aniSearch, MAL), steht nicht zusätzlich als Cartoon in `cartoons.json`
 * (Regel: `lib/cartoon-zwilling.ts`). Dazu der Umzug: gemerkte Cartoons und Adressen ziehen auf den Anime-Titel.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-cartoon-zwilling.ts`; der Bestandsteil steht in `check-cartoon-zwilling-bestand.ts`
 */
import type { Title } from '../shared/types.ts'
import { findeZwillinge, folgenPassen } from './lib/cartoon-zwilling.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
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
  const staffeln = [t({ id: 100, titleEn: 'Rooster Fighter', jpYear: 2026, episodes: 12 }), t({ id: 200, titleEn: 'Rooster Fighter Season 2', jpYear: 2027, episodes: 12 })]
  const zweiStaffeln = new Map([[5, [100, 200]]])
  const doppelCartoon = cartoon({ id: -5, episodes: 24 })
  const ohneUmzug = findeZwillinge([doppelCartoon], staffeln, zweiStaffeln)
  pruefe('Zwei Staffeln derselben TMDB-Serie, kein Umzug: unsicher (Kontrolle)', ohneUmzug.zwillinge.length === 0 && ohneUmzug.unsicher[0]?.kandidaten.join() === '100,200', ohneUmzug)
  const mitUmzug = findeZwillinge([doppelCartoon], staffeln, zweiStaffeln, new Map([[-5, 100]]))
  pruefe('Zwei Staffeln, Umzug auf Staffel 1 bekannt: bleibt Zwilling', mitUmzug.zwillinge.length === 1 && mitUmzug.zwillinge[0]?.zwilling === 100 && mitUmzug.unsicher.length === 0, mitUmzug)
  pruefe('Umzug auf einen Anime außerhalb der Kandidaten: gilt nicht', findeZwillinge([doppelCartoon], staffeln, zweiStaffeln, new Map([[-5, 300]])).zwillinge.length === 0)
  pruefe('Kein Name, keine Kennung: kein Zwilling', findeZwillinge([cartoon({ id: -5, titleEn: 'Etwas Anderes', tmdbId: 9 })], anime, new Map()).zwillinge.length === 0)
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
