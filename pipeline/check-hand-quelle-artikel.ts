/**
 * Ein Artikel, aus dem ein Handtermin stammt, ist im selben Bau eingearbeitet (16.11.2026): kein automatischer Termin mehr aus seinen Zeilen,
 * ohne den nächsten Sammlerlauf abzuwarten (Boruto neben dem Handtermin Naruto Shippuden). Läuft in `check:logic`; erfundene Titel, kein Netz.
 */
import type { Release, Title } from '../shared/types.ts'
import { releasesAus, type Vorschlag } from './lib/meldungen.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const titel = (id: number, name: string): Title =>
  ({ id, franchiseId: id, jpYear: 2020, format: 'TV', titleDe: name, titleEn: name, titleRomaji: name, keywords: [], genres: [], streams: [] }) as unknown as Title
const titles = [titel(1, 'Foo'), titel(2, 'Bar')]
const vorschlag = (name: string, url: string): Vorschlag =>
  ({ articleTitle: `»${name}«`, articleUrl: url, publishedAt: '2026-11-04', category: 'streaming', platforms: ['disneyplus'], dates: [{ iso: '2026-11-04', context: 'Sammelartikel' }], dub: 'zugesagt', folgen: '12', woechentlich: false }) as unknown as Vorschlag
const hand = (quelle: string, ueber: Partial<Release> = {}): Release =>
  ({ slug: 'foo-hand', titleId: 1, platform: 'disneyplus', releaseType: 'batch', sources: [quelle], schedule: { firstEpisodeDate: '2026-11-04' }, ...ueber }) as unknown as Release
const aus = (v: Vorschlag, vorhanden: Release[], abgedeckt: Vorschlag[] = []) => releasesAus([v], titles, vorhanden, '2026-11-16', [], abgedeckt).map((r) => r.titleId)

const U = 'https://www.anime2you.de/news/1/x/'
const foo = vorschlag('Foo', U)
const abgedeckt: Vorschlag[] = []
pruefe('ohne Handtermin entsteht der automatische Termin', aus(foo, []).join() === '1')
pruefe('Handtermin für Foo aus derselben Artikeladresse: Foos Zeile entfällt, gilt als abgedeckt (nicht „nicht zugeordnet“)', aus(foo, [hand(U, { platform: 'netflix' })], abgedeckt).length === 0 && abgedeckt[0] === foo, abgedeckt.length)
pruefe('Schrägstrich am Ende zählt nicht (Hand ohne, Artikel mit — und umgekehrt)', aus(foo, [hand(U.slice(0, -1), { platform: 'netflix' })]).length === 0 && aus(vorschlag('Foo', U.slice(0, -1)), [hand(U, { platform: 'netflix' })]).length === 0)
pruefe('dieselbe Artikeladresse, anderer Titel (Bar im selben Sammelartikel): Bars Termin bleibt', aus(vorschlag('Bar', U), [hand(U, { platform: 'netflix' })]).join() === '2')
pruefe('Handtermin eines anderen Artikels ändert nichts', aus(foo, [hand('https://www.anime2you.de/news/2/y/', { platform: 'netflix' })]).join() === '1')
pruefe('ein automatischer Termin derselben Adresse zählt nicht als Hand', aus(foo, [hand(U, { automatisch: true, platform: 'netflix' })]).join() === '1')

if (fehler) {
  console.error(`check-hand-quelle-artikel: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-hand-quelle-artikel: alles grün')
