/**
 * Zusicherung: Kalenderdatei und Google-Link sagen „Zweitausstrahlung“ (`zweitanbieter`) und „Disc nach Streaming“
 * (`streamingVorher`, Bau in `shared/streaming-vorher.ts`); TV bleibt unverändert (15.11.2026).
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-ics-zweitanbieter.ts`
 */
import type { PlatformId, Release, ReleaseEvent } from '../shared/types.ts'
import { buildIcs, eventDescription, eventSummary, googleCalendarUrl, streamingVorherHinweis, zweitanbieterHinweis } from '../shared/ics.ts'
import { schreibeStreamingVorher } from '../shared/streaming-vorher.ts'
import { fasseFolgenZusammen } from '../shared/ics-folgen.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const ev = (platform: PlatformId, date: string, o: Partial<ReleaseEvent> = {}): ReleaseEvent =>
  ({ id: `1-${platform}-${date}`, releaseSlug: `1-${platform}`, titleId: 1, date, releaseType: 'weekly', platform, name: 'Das Band der Unterwelt', ...o }) as ReleaseEvent
const rel = (slug: string, o: Partial<Release> = {}): Release => ({ slug, ...o }) as Release
const keine = new Map<number, PlatformId>()

console.log('\nICS: Zweitanbieter (Streaming):')
{
  const e = ev('netflix', '2026-11-21', { episode: 21, episodeCount: 24, zweitanbieter: { erster: 'crunchyroll', seit: '2026-09-19' } })
  pruefe('SUMMARY: „neu bei <Anbieter>“ hinter der Folge', eventSummary(e) === 'Das Band der Unterwelt – Folge 21/24 (neu bei Netflix)', eventSummary(e))
  pruefe('die Sprachmarke steht dahinter', eventSummary({ ...e, sprache: 'omu' }) === 'Das Band der Unterwelt – Folge 21/24 (neu bei Netflix) (OmU)')
  const text = eventDescription(e)
  pruefe('DESCRIPTION: „zuerst bei … erschienen (TT.MM.JJJJ)“', text.includes('Auf Deutsch zuerst bei Crunchyroll erschienen (19.09.2026).'), text)
  const m = ev('netflix', '2026-11-21', { releaseType: 'movie', zweitanbieter: { erster: 'crunchyroll', seit: '2026-07-28', mindestens: true } })
  pruefe('mindestens: „spätestens seit“', eventDescription(m).includes('Auf Deutsch spätestens seit 28.07.2026 bei Crunchyroll.'), eventDescription(m))
  pruefe('Hinweis als Funktion exportiert', zweitanbieterHinweis({ erster: 'adn', seit: '2026-01-02' }) === 'Auf Deutsch zuerst bei ADN erschienen (02.01.2026).')
  const ics = buildIcs([e]).split('\r\n ').join('')
  pruefe('die .ics-Datei trägt Titel und Zeile', ics.includes('SUMMARY:Das Band der Unterwelt – Folge 21/24 (neu bei Netflix)') && ics.includes('zuerst bei Crunchyroll erschienen'), ics)
  pruefe('der Google-Link trägt dieselbe Zeile', decodeURIComponent(googleCalendarUrl(e).replace(/\+/g, ' ')).includes('Auf Deutsch zuerst bei Crunchyroll erschienen'))
  const ohne = ev('netflix', '2026-11-21', { episode: 21, episodeCount: 24 })
  pruefe('ohne Feld: unverändert', eventSummary(ohne) === 'Das Band der Unterwelt – Folge 21/24' && !eventDescription(ohne).includes('Auf Deutsch'))
  const katalog = ev('disneyplus', '2026-09-28', { releaseType: 'movie', imAngebot: true, zweitanbieter: { erster: 'crunchyroll', seit: '2026-07-28', mindestens: true } })
  pruefe('„Im Angebot seit“ nennt den Anbieter nur einmal', eventSummary(katalog) === 'Das Band der Unterwelt (neu bei Disney+)', eventSummary(katalog))
  const a = ev('netflix', '2026-11-21', { episode: 21, zweitanbieter: { erster: 'crunchyroll', seit: '2026-09-19' } })
  const b = ev('netflix', '2026-11-21', { episode: 22, zweitanbieter: { erster: 'crunchyroll', seit: '2026-09-26' } })
  pruefe('Folgen mit verschiedenem Erstdatum teilen keinen Eintrag', fasseFolgenZusammen([a, b]).length === 2)
}

console.log('\nICS: Disc nach Streaming:')
{
  const stream = ev('crunchyroll', '2026-04-04', { episode: 1 })
  const disc = ev('disc', '2026-12-04', { releaseType: 'disc', id: 'disc1', releaseSlug: 'disc1' })
  const n = schreibeStreamingVorher([stream, disc], [], keine)
  pruefe('Disc nach Streaming trägt „streamingVorher“', n === 1 && disc.streamingVorher?.anbieter === 'crunchyroll' && disc.streamingVorher.seit === '2026-04-04', disc.streamingVorher)
  pruefe('der Streaming-Termin selbst und `zweitanbieter` bleiben unberührt', stream.streamingVorher === undefined && disc.zweitanbieter === undefined)
  const text = eventDescription(disc)
  pruefe('DESCRIPTION: „vor der Disc bei … im Streaming (ab …)“', text.includes('Auf Deutsch vor der Disc bei Crunchyroll im Streaming (ab 04.04.2026).'), text)
  pruefe('SUMMARY der Disc bleibt', eventSummary(disc) === 'Das Band der Unterwelt (Disc)', eventSummary(disc))
  pruefe('Hinweis mit Katalogdatum: „spätestens ab“', streamingVorherHinweis({ anbieter: 'adn', seit: '2026-01-02', mindestens: true }) === 'Auf Deutsch vor der Disc bei ADN im Streaming (spätestens ab 02.01.2026).')

  const zukunft = ev('crunchyroll', '2099-01-01', { episode: 1 })
  const disc6 = ev('disc', '2099-06-01', { releaseType: 'disc', id: 'd6', releaseSlug: 'd6' })
  schreibeStreamingVorher([zukunft, disc6], [], keine)
  const z = eventDescription(disc6)
  pruefe('Streaming noch in der Zukunft: Satz stimmt unabhängig vom Bautag', z.includes('vor der Disc bei Crunchyroll im Streaming (ab 01.01.2099)') && !/schon|seit/.test(z), z)

  const kat = ev('adn', '2026-03-31', { releaseType: 'batch', releaseSlug: 'kat' })
  const disc2 = ev('disc', '2026-12-04', { releaseType: 'disc', id: 'disc2', releaseSlug: 'disc2' })
  schreibeStreamingVorher([kat, disc2], [rel('kat', { dateMeaning: 'available-from' })], keine)
  pruefe('Katalogdatum des Streamings: mindestens', disc2.streamingVorher?.mindestens === true, disc2.streamingVorher)

  const ohneVorlauf = ev('disc', '2026-12-04', { releaseType: 'disc', id: 'd3', releaseSlug: 'd3' })
  const spaeter = ev('netflix', '2027-01-01', { episode: 1 })
  const geschaetzt = ev('netflix', '2026-01-01', { episode: 1, estimated: true })
  const omu = ev('netflix', '2026-01-02', { episode: 1, sprache: 'omu' })
  const nur = schreibeStreamingVorher([ohneVorlauf, spaeter, geschaetzt, omu], [], keine)
  pruefe('später, geschätzt oder OmU: keine Aussage', nur === 0 && ohneVorlauf.streamingVorher === undefined && !eventDescription(ohneVorlauf).includes('Auf Deutsch'))
  const fremd = ev('crunchyroll', '2026-04-04', { episode: 1, titleId: 2 })
  const disc4 = ev('disc', '2026-12-04', { releaseType: 'disc', id: 'd4', releaseSlug: 'd4' })
  pruefe('anderer Titel: keine Aussage', schreibeStreamingVorher([fremd, disc4], [], keine) === 0)
  const tv = ev('tv', '2026-01-05', { episode: 1, sender: 'RTL II' })
  const disc5 = ev('disc', '2026-12-04', { releaseType: 'disc', id: 'd5', releaseSlug: 'd5' })
  pruefe('TV ist kein Streaming: keine Aussage', schreibeStreamingVorher([tv, disc5], [], keine) === 0)
}

console.log('\nICS: TV unverändert:')
{
  const tv = ev('tv', '2026-11-21', { episode: 2, episodeCount: 12, sender: 'RTL II' })
  pruefe('TV-Termin ohne neue Zeilen', eventSummary(tv) === 'Das Band der Unterwelt – Folge 2/12' && !eventDescription(tv).includes('Auf Deutsch'))
}

if (verletzt > 0) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nAlle Zusicherungen halten.')
