/**
 * Zusicherung zu Katalog-Release und Folgenspanne (Daniel, 13.10.2026):
 *  - Mehrere Folgen am selben Tag stehen als eine Kachel mit „Folge 13–14/14“ (Mushoku Tensei Staffel 3);
 *  - ein Termin mit `katalog` (Daten: `check-katalog-release.ts`) trägt die Marke „Katalog-Release“ und „Alle 13 Folgen auf einmal“.
 * Aufruf: `npm run check:logic`.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import type { Release, ReleaseEvent } from '../shared/types.ts'
import { buendeleKacheln } from '../web/src/lib/buendel.ts'
import { ART_STIL, folgenSpanne, kartenArt, type KartenArt } from '../web/src/lib/kachel-folgen.ts'
import { istStaffelstart } from '../web/src/lib/staffelstart.ts'
import { TEXTE_KALENDER } from '../web/src/lib/i18n-kalender.ts'
import { Unterzeile } from '../web/src/components/kalender/PosterKarte.tsx'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const rel = (slug: string, o: Partial<Release> = {}): Release =>
  ({ slug, titleId: 1, name: slug, platform: 'crunchyroll', releaseType: 'weekly', schedule: { firstEpisodeDate: '2026-10-18', episodeCount: 14 }, ...o }) as unknown as Release
const ev = (slug: string, episode: number | undefined, o: Partial<ReleaseEvent> = {}): ReleaseEvent =>
  ({ id: `${slug}@${episode ?? 'alle'}`, releaseSlug: slug, titleId: 1, name: 'X', date: '2026-10-18', releaseType: 'weekly', platform: 'crunchyroll', episode, episodeCount: 14, ...o }) as unknown as ReleaseEvent
const zeile = (kachel: ReleaseEvent[], art?: KartenArt): string =>
  renderToStaticMarkup(Unterzeile({ event: kachel[0]!, buendel: kachel, art, favorite: false, hidden: false, onOpen: () => {}, saal: false } as Parameters<typeof Unterzeile>[0]))
const text = (html: string): string => html.replace(/<[^>]+>/g, '')

function folgenSpannen(): void {
  console.log('\nMehrere Folgen am selben Tag — eine Kachel, eine Angabe:')
  const data = { releaseBySlug: new Map([['m', rel('m')]]) }
  const kachel = buendeleKacheln([ev('m', 13), ev('m', 14)], (e) => istStaffelstart(e, data))
  pruefe('Folge 13 und 14 sind eine Kachel', kachel.length === 1 && kachel[0]!.length === 2, kachel)
  pruefe('Spanne 13–14', JSON.stringify(folgenSpanne(kachel[0])) === '{"von":13,"bis":14}')
  pruefe('Angabe „Folge 13–14/14“ statt „Folge 13/14 · +1 Folgen“', text(zeile(kachel[0]!)) === 'Crunchyroll · Folge 13–14/14', text(zeile(kachel[0]!)))
  pruefe('Staffelfinale-Marke an der Kachel', kartenArt(kachel[0]!, data) === 'finale', kartenArt(kachel[0]!, data))
  const drei = buendeleKacheln([ev('m', 10), ev('m', 11), ev('m', 12)], () => false)
  pruefe('drei Folgen: „Folge 10–12/14“', text(zeile(drei[0]!)) === 'Crunchyroll · Folge 10–12/14', text(zeile(drei[0]!)))
  const luecke = buendeleKacheln([ev('m', 11), ev('m', 13)], () => false)
  pruefe('Lücke (11 und 13): keine Spanne, „+1 Folgen“ bleibt', folgenSpanne(luecke[0]) === undefined && text(zeile(luecke[0]!)).includes('+1 Folgen'), text(zeile(luecke[0]!)))
  const geraten = buendeleKacheln([ev('m', 5, { episodeCountAssumed: true }), ev('m', 6, { episodeCountAssumed: true })], () => false)
  pruefe('geratene Folgenzahl bleibt „≈“', text(zeile(geraten[0]!)) === 'Crunchyroll · Folge 5–6/≈14', text(zeile(geraten[0]!)))
  const einzeln = buendeleKacheln([ev('m', 5)], () => false)
  pruefe('eine Folge: unverändert „Folge 5/14“', text(zeile(einzeln[0]!)) === 'Crunchyroll · Folge 5/14', text(zeile(einzeln[0]!)))
}

function darstellung(): void {
  console.log('\nKatalog-Release auf der Kachel:')
  const b = ev('b', undefined, { releaseType: 'batch', episodeCount: 13, katalog: 'belegt' })
  pruefe('belegt: „Alle 13 Folgen auf einmal“ statt „13 Folgen“', text(zeile([b], 'katalog')) === 'Crunchyroll · Alle 13 Folgen auf einmal', text(zeile([b], 'katalog')))
  const v = ev('b', undefined, { releaseType: 'batch', episodeCount: 13, katalog: 'abgeleitet' })
  pruefe('abgeleitet: „Vermutlich alle 13 Folgen auf einmal“ (Snowball Earth ohne Beobachtung)', text(zeile([v], 'katalogVermutlich')) === 'Crunchyroll · Vermutlich alle 13 Folgen auf einmal', text(zeile([v], 'katalogVermutlich')))
  const data = { releaseBySlug: new Map([['w', rel('w')]]) }
  pruefe('Auszeichnung Katalog schlägt Start und Finale', kartenArt([ev('w', 1, { katalog: 'belegt' }), ev('w', 14, { katalog: 'belegt' })], data) === 'katalog')
  pruefe('abgeleiteter Katalog-Release schlägt Start und Finale und bleibt abgeleitet', kartenArt([ev('w', 1, { katalog: 'abgeleitet' }), ev('w', 14, { katalog: 'abgeleitet' })], data) === 'katalogVermutlich')
  pruefe('ohne Marke: Staffelstart bleibt Staffelstart', kartenArt([ev('w', 1)], data) === 'start')
  const fehlend = Object.entries(ART_STIL).flatMap(([, s]) => [s.name, s.hinweis]).filter((k) => !(k in TEXTE_KALENDER))
  pruefe('jeder Auszeichnung fehlt kein Text (Name, Hinweis)', fehlend.length === 0, fehlend)
  pruefe('die Marke heißt „Katalog-Release“', TEXTE_KALENDER['kal.katalog'] === 'Katalog-Release')
  pruefe('die abgeleitete Marke trägt „≈“, ihr Hinweis sagt „Vermutlich“', TEXTE_KALENDER['kal.katalogVermutlich'].includes('≈') && TEXTE_KALENDER['kal.katalogVermutlichHinweis'].startsWith('Vermutlich'))
}

folgenSpannen()
darstellung()
console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
