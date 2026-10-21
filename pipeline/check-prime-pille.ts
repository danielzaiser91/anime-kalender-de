/**
 * Zusicherungen zur Prime-Pille ohne Adresse (Daniel, 11.10.2026, „Reborn as a Space Mercenary":
 * „Prime Video · 1 Fg." nicht klickbar, Crunchyroll zeigte 2 Fg.). Läuft in `check:logic`.
 * Nachgestellte Artikelzeilen und erfundene Titel; kein Netz.
 */
import type { Release, Title } from '../shared/types.ts'
import { expandEvents, istErschienen } from '../shared/logic.ts'
import { amazonAdresseRichten } from './lib/amazon-adresse.ts'
import { adresseDesWegs, richteTerminAdressen } from './bau/13-1-termin-adressen.ts'
import { releasesAus } from './lib/meldungen.ts'
import { kanalDesEintrags, leseSammelartikel, vorschlaegeAusSammelartikel } from './lib/sammelartikel.ts'
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
/* Reborn (186541): Der Titel hat 13 Folgen, `releasesAus` setzt sie als Schätzung ein — die Zahl von Crunchyroll geht trotzdem vor. */
const mitFolgenzahl = [{ ...titel[0]!, episodes: 13 }] as unknown as Title[]
const primeMit13 = (vorhanden: Release[]) => releasesAus(vorschlaege, mitFolgenzahl, vorhanden, '2026-10-11').find((r) => r.platform === 'primevideo')
const reborn = primeMit13([crTermin('2026-10-04')])
pruefe('AniList-Schätzung (13) weicht der Zahl von Crunchyroll (12), samt Herkunft und Uhrzeit', reborn?.schedule.episodeCount === 12 && reborn.schedule.episodeCountSource === 'anisearch' && reborn.schedule.time === '16:00', reborn?.schedule)
const crBelegt = { ...crTermin('2026-10-04'), schedule: { firstEpisodeDate: '2026-10-04', time: '16:00', episodeCount: 24 } } as unknown as Release
const rebornBelegt = primeMit13([crBelegt])
pruefe('Belegte Zahl von Crunchyroll: Prime führt sie ohne „geschätzt“-Marke', rebornBelegt?.schedule.episodeCount === 24 && !rebornBelegt.schedule.episodeCountAssumed, rebornBelegt?.schedule)
const rebornOhneCr = primeMit13([])
pruefe('Ohne Crunchyroll-Termin bleibt die AniList-Schätzung (13)', rebornOhneCr?.schedule.episodeCount === 13 && rebornOhneCr.schedule.episodeCountAssumed === true, rebornOhneCr?.schedule)

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

/* Prime-Adressen: Abfrage und ref fallen weg, die Kennung im Pfad bleibt (Daniel, 11.10.2026). */
const asin = 'https://www.amazon.de/gp/video/detail/B0HKFFGQ7F'
const gti = 'https://www.amazon.de/gp/video/detail/amzn1.dv.gti.22ada97d-e844-4078-854b-7509744a5c1f'
pruefe('ASIN mit ?ref_ verliert die Abfrage', amazonAdresseRichten(`${asin}?ref_=atv_dp`) === asin)
pruefe('ASIN mit /ref= verliert den Pfadanhang', amazonAdresseRichten(`${asin}/ref=atv_dp_x?foo=1`) === asin)
pruefe('GTI mit linkId und language verliert die Abfrage, der Pfad bleibt', amazonAdresseRichten(`${gti}?linkId=db86&language=de_DE`) === gti)
pruefe('Fragment fällt weg', amazonAdresseRichten(`${asin}#x`) === asin)
pruefe('/dp/ASIN?ref geht auf die Video-Adresse ohne Abfrage', amazonAdresseRichten('https://www.amazon.de/dp/B0HKFFGQ7F?ref_=x') === asin)
pruefe('Schon sauber bleibt unverändert', amazonAdresseRichten(asin) === asin && amazonAdresseRichten(gti) === gti)
const watch = 'https://watch.amazon.de/detail?gti=amzn1.dv.gti.a3fa85b3-9fd1-4c50-89ce-13e8d5953f92'
pruefe('watch.amazon.de: die Abfrage ist die Kennung und bleibt', amazonAdresseRichten(watch) === watch)

/* Ein Termin ohne Adresse nimmt die des Weges desselben Titels — eindeutig, Titelseite, gleicher Kanal. */
const B0 = 'https://www.amazon.de/gp/video/detail/B0HKFFGQ7F'
const andere = 'https://www.amazon.de/gp/video/detail/B0ANDERE12'
const wegVon = (extra: Record<string, unknown> = {}) => ({ platform: 'primevideo', url: B0, ...extra })
const mitWegen = (...streams: unknown[]) => ({ id: 1, streams }) as unknown as Title
const termin = (extra: Partial<Release> = {}): Release =>
  ({ slug: 'a', titleId: 1, name: 'T', platform: 'primevideo', releaseType: 'weekly', schedule: { firstEpisodeDate: '2026-10-04' }, ...extra }) as unknown as Release
pruefe('Ein Weg: seine Adresse', adresseDesWegs(termin(), mitWegen(wegVon())) === B0)
pruefe('Zwei Wege desselben Anbieters: mehrdeutig, keine Übernahme', adresseDesWegs(termin(), mitWegen(wegVon(), wegVon({ url: andere }))) === undefined)
pruefe('Weg eines anderen Anbieters zählt nicht', adresseDesWegs(termin(), mitWegen({ platform: 'netflix', url: 'https://www.netflix.com/title/1' })) === undefined)
pruefe('Eine Suche ist keine Titelseite', adresseDesWegs(termin(), mitWegen(wegVon({ url: 'https://www.amazon.de/s?k=x&i=instant-video' }))) === undefined)
pruefe('Weg ohne Adresse zählt nicht', adresseDesWegs(termin(), mitWegen(wegVon({ url: '' }))) === undefined)
pruefe('Kanal gesetzt: nur der Weg mit gleichem Kanal', adresseDesWegs(termin({ kanal: 'Crunchyroll' }), mitWegen(wegVon({ kanal: 'crunchyroll' }))) === B0 && adresseDesWegs(termin({ kanal: 'Crunchyroll' }), mitWegen(wegVon({ kanal: 'Aniverse' }))) === undefined)
pruefe('Kanal gesetzt, zwei Wege, einer passt: der passende', adresseDesWegs(termin({ kanal: 'Crunchyroll' }), mitWegen(wegVon({ kanal: 'Aniverse', url: andere }), wegVon({ kanal: 'Crunchyroll' }))) === B0)
pruefe('Eigene Titelseite bleibt', adresseDesWegs(termin({ platformUrl: 'https://www.amazon.de/gp/video/detail/B0EIGENE123' }), mitWegen(wegVon())) === undefined)
pruefe('Eine Suchadresse am Termin gilt als fehlende Adresse: der Weg gewinnt', adresseDesWegs(termin({ platformUrl: 'https://www.amazon.de/s?k=x&i=instant-video' }), mitWegen(wegVon())) === B0)
const adnWeg = 'https://animationdigitalnetwork.com/de/video/352'
const adnSuche = 'https://animationdigitalnetwork.com/de/search?q=Bleach'
pruefe('ADN: die Suche des Kurators weicht der Serienseite', adresseDesWegs(termin({ platform: 'adn' as never, platformUrl: adnSuche }), mitWegen({ platform: 'adn', url: adnWeg })) === adnWeg)
pruefe('Suchadresse am Termin, aber kein Weg mit Titelseite: die Suche bleibt', adresseDesWegs(termin({ platformUrl: 'https://www.amazon.de/s?k=x&i=instant-video' }), mitWegen(wegVon({ url: '' }))) === undefined)
pruefe('Disc und Fernsehen übernehmen nichts', adresseDesWegs(termin({ releaseType: 'disc' }), mitWegen(wegVon())) === undefined && adresseDesWegs(termin({ platform: 'tv' as never }), mitWegen({ platform: 'tv', url: 'https://x/' })) === undefined)
pruefe('Titel unbekannt: nichts', adresseDesWegs(termin(), undefined) === undefined)
const ausgang = [termin(), termin({ slug: 'b', titleId: 2, platformUrl: 'https://www.amazon.de/dp/B0ABCDEFGH?ref_=x' })]
const gerichtet = richteTerminAdressen(ausgang, [mitWegen(wegVon())])
pruefe('Bau: Übernahme und Richten in einem Lauf', ausgang[0]!.platformUrl === B0 && ausgang[1]!.platformUrl === 'https://www.amazon.de/gp/video/detail/B0ABCDEFGH' && gerichtet === 1, { ausgang, gerichtet })

if (fehler) {
  console.error(`${fehler} Prüfung(en) fehlgeschlagen`)
  process.exit(1)
}
console.log('check-prime-pille: ok')
