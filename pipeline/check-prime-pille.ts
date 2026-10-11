/**
 * Zusicherungen zur Prime-Pille ohne Adresse (Daniel, 11.10.2026, „Reborn as a Space Mercenary":
 * „Prime Video · 1 Fg." nicht klickbar, Crunchyroll zeigte 2 Fg.). Läuft in `check:logic`.
 * Nachgestellte Artikelzeilen und erfundene Titel; kein Netz.
 */
import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import type { Release, Title } from '../shared/types.ts'
import { expandEvents, istErschienen } from '../shared/logic.ts'
import { releasesAus } from './lib/meldungen.ts'
import { kanalDesEintrags, leseSammelartikel, vorschlaegeAusSammelartikel } from './lib/sammelartikel.ts'
import { ergaenzeVerweiseVonHand } from './lib/verweise-von-hand.ts'
import { pillenZiel, primeSuchAdresse } from '../web/src/components/detail/pillen-ziel.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const artikel = { url: 'https://www.anime2you.de/news/1/crunchyroll-x/', publishedAt: '2026-10-04' }
const zeilen = (stream: string) =>
  [
    'Ab sofort verfügbar:',
    '»Testserie«',
    '»Testserie«',
    'Episoden: 1 verfügbar',
    'Sprache: Deutsch, Japanisch (UT)',
    'Simulcast: Jeden Sonntag um 16:00 Uhr',
    `Stream: ${stream}`,
  ].join('\n')

/* Kanal: Prime und Crunchyroll nebeneinander heißt Crunchyroll-Kanal; Prime allein oder mit anderem Anbieter nicht. */
pruefe('Prime + Crunchyroll: Crunchyroll-Kanal', kanalDesEintrags({ stream: ['Prime Video', 'Crunchyroll'] }) === 'Crunchyroll')
pruefe('Reihenfolge und Schreibweise egal', kanalDesEintrags({ stream: ['crunchyroll', 'PRIME VIDEO'] }) === 'Crunchyroll')
pruefe('Prime allein: kein Kanal', kanalDesEintrags({ stream: ['Prime Video'] }) === undefined)
pruefe('Prime + ADN: kein Crunchyroll-Kanal', kanalDesEintrags({ stream: ['Prime Video', 'ADN'] }) === undefined)
pruefe('Crunchyroll allein: kein Kanal', kanalDesEintrags({ stream: ['Crunchyroll'] }) === undefined)

const gelesen = leseSammelartikel(zeilen('Prime Video, Crunchyroll'), '2026-10-04')
const vorschlaege = vorschlaegeAusSammelartikel(artikel, gelesen)
pruefe('Vorschlag trägt den Kanal', vorschlaege[0]?.kanal === 'Crunchyroll', vorschlaege)
const aniverse = vorschlaegeAusSammelartikel(artikel, gelesen, 'primevideo', 'Aniverse')
pruefe('Der Kanal der Überschrift (Aniverse) geht vor', aniverse[0]?.kanal === 'Aniverse', aniverse)

/* Der Termin übernimmt Folgenzahl und Uhrzeit vom Crunchyroll-Termin, damit die Zahl der erschienenen Folgen die von Crunchyroll ist. */
const titel = [{ id: 1, titleEn: 'Testserie', titleRomaji: 'Testserie', franchiseId: 1, format: 'TV', jpYear: 2026, streams: [] }] as unknown as Title[]
const crTermin = (firstEpisodeDate: string): Release =>
  ({
    slug: 'cr-test',
    titleId: 1,
    name: 'Testserie',
    platform: 'crunchyroll',
    releaseType: 'weekly',
    schedule: { firstEpisodeDate, time: '16:00', episodeCount: 12, episodeCountAssumed: true, episodeCountSource: 'anisearch' },
    sources: [],
  }) as unknown as Release
const primeTermin = (vorhanden: Release[]) => releasesAus(vorschlaege, titel, vorhanden, '2026-10-11').find((r) => r.platform === 'primevideo')
const prime = primeTermin([crTermin('2026-10-04')])
pruefe('Prime-Termin ist Crunchyroll-Kanal, wöchentlich', prime?.kanal === 'Crunchyroll' && prime.releaseType === 'weekly', prime)
pruefe('Folgenzahl, Herkunft der Zahl und Uhrzeit von Crunchyroll', prime?.schedule.episodeCount === 12 && prime.schedule.episodeCountAssumed === true && prime.schedule.episodeCountSource === 'anisearch' && prime.schedule.time === '16:00', prime?.schedule)
pruefe('Starttag bleibt der der Meldung, geschätzt', prime?.schedule.firstEpisodeDate === '2026-10-04' && prime.schedule.estimated === true, prime?.schedule)
if (prime) {
  /* Berlin 11.10.2026: 15:59 Uhr (13:59 UTC) → 1 Folge, 16:00 Uhr (14:00 UTC) → 2 Folgen. */
  const erschienen = (jetztUtc: string) => expandEvents(prime).filter((e) => istErschienen(e, new Date(jetztUtc))).length
  pruefe('Sonntag 15:59: 1 Folge', erschienen('2026-10-11T13:59:00Z') === 1)
  pruefe('Sonntag 16:00: 2 Folgen wie bei Crunchyroll', erschienen('2026-10-11T14:00:00Z') === 2)
}
const ohneCr = primeTermin([])
pruefe('Ohne Crunchyroll-Termin bleibt es bei der Meldung (eine Folge, keine Uhrzeit)', Boolean(ohneCr) && ohneCr?.schedule.episodeCount === undefined && ohneCr?.schedule.time === undefined, ohneCr?.schedule)
const anderesCour = primeTermin([crTermin('2026-07-05')])
pruefe('Anderer Starttag bei Crunchyroll: nichts übernommen', anderesCour?.schedule.episodeCount === undefined, anderesCour?.schedule)

/* Ohne Adresse führt die Prime-Pille zur Suche, andere Anbieter bleiben ohne Ziel. */
const uebersetze = ((k: string) => k) as never
const pille = (platform: string, extra: Partial<Release> = {}): Release =>
  ({ slug: 's', titleId: 1, name: 'Testserie', platform, releaseType: 'weekly', schedule: { firstEpisodeDate: '2026-10-04' }, ...extra }) as unknown as Release
const suche = pillenZiel(pille('primevideo'), 'Reborn: Test!', uebersetze)
pruefe('Prime ohne Adresse: Suche mit Titel', suche.ziel === primeSuchAdresse('Reborn: Test!') && suche.ziel.includes('Reborn%3A%20Test!') && suche.ziel.endsWith('&i=instant-video'), suche)
pruefe('Die Suche sagt es im Hinweis', suche.hinweis === 'detail.primeSuchen', suche)
pruefe('Ohne Titelzeile zählt der Name des Termins', pillenZiel(pille('primevideo'), undefined, uebersetze).ziel === primeSuchAdresse('Testserie'))
const direkt = pillenZiel(pille('primevideo', { platformUrl: 'https://www.amazon.de/gp/video/detail/B0TEST' }), 'X', uebersetze)
pruefe('Mit Adresse bleibt sie, ohne Hinweis', direkt.ziel === 'https://www.amazon.de/gp/video/detail/B0TEST' && direkt.hinweis === undefined, direkt)
pruefe('Kaufadresse geht vor', pillenZiel(pille('primevideo', { buyUrl: 'https://shop/x' }), 'X', uebersetze).ziel === 'https://shop/x')
pruefe('ADN ohne Adresse: kein Ziel', pillenZiel(pille('adn'), 'X', uebersetze).ziel === undefined)

/* Der Handverweis: Reborn as a Space Mercenary (186541) hat seine Prime-Seite samt Kanal. */
const handIds = (yaml.load(readFileSync('data/verweise-von-hand.yaml', 'utf8')) as { anilistId: number }[]).map((e) => e.anilistId)
const wege = new Map<number, Title>(handIds.map((id) => [id, { id, streams: [] } as unknown as Title]))
ergaenzeVerweiseVonHand(wege)
const weg = wege.get(186541)!.streams[0]
pruefe(
  'Reborn as a Space Mercenary: Prime-Seite B0HKFFGQ7F als Crunchyroll-Kanal',
  weg?.platform === 'primevideo' && weg.url === 'https://www.amazon.de/gp/video/detail/B0HKFFGQ7F' && weg.kanal === 'Crunchyroll',
  weg,
)

if (fehler) {
  console.error(`${fehler} Prüfung(en) fehlgeschlagen`)
  process.exit(1)
}
console.log('check-prime-pille: ok')
