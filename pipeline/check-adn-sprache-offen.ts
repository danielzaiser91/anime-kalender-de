/**
 * Zusicherungen zu `bau/adn-sprache-offen.ts` (14.10.2026): Ein kuratierter ADN-Neuzugang („Im Angebot seit“) ohne Sprachzusage trägt `sprache: 'offen'`,
 * damit die Kachel selbst „Synchro offen“ sagt. Mit Sprachzusage (ADNs Kalender als Quelle, ADN-Weg mit `dub: true`, Handbeleg) bleibt er unberührt.
 */
import { kennzeichneAdnNeuzugaengeOhneSprache } from './bau/adn-sprache-offen.ts'
import { ADN_CALENDAR_URL, adnKatalogUrl } from './bau/grundlagen.ts'
import type { DubCheck } from './lib/dub-confirmed.ts'
import type { Release, Title } from '../shared/types.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const titel = (id: number, streams: Title['streams'] = []): Title => ({ id, streams }) as unknown as Title
const termin = (extra: Partial<Release> = {}): Release =>
  ({ slug: 'k', titleId: 1, platform: 'adn', dateMeaning: 'available-from', schedule: { firstEpisodeDate: '2026-10-12' }, sources: ['https://a/'], ...extra }) as unknown as Release
const keinBeleg = () => undefined
const lauf = (release: Release, titles: Title[] = [titel(1)], belegFuer: (id: number) => DubCheck | undefined = keinBeleg) =>
  kennzeichneAdnNeuzugaengeOhneSprache([release], new Map(titles.map((t) => [t.id, t])), belegFuer)

console.log('\nOhne Sprachzusage:')
{
  const r = termin()
  pruefe('Kuratierter ADN-Neuzugang wird „offen“', lauf(r).length === 1 && r.sprache === 'offen', r.sprache)
  const ohneTitel = termin({ titleId: -1 })
  pruefe('Auch ohne Titel in den Daten', lauf(ohneTitel, []).length === 1 && ohneTitel.sprache === 'offen')
  const nurUntertitel = termin()
  lauf(nurUntertitel, [titel(1, [{ platform: 'adn', url: 'https://x/', dub: false }])])
  pruefe('Ein ADN-Weg ohne Synchro ändert nichts', nurUntertitel.sprache === 'offen')
}

console.log('\nMit Sprachzusage:')
{
  const kalender = termin({ sources: ['https://a/', ADN_CALENDAR_URL] })
  pruefe('Termin aus ADNs Kalender (nur vde) bleibt', lauf(kalender).length === 0 && kalender.sprache === undefined)
  const katalog = termin({ sources: ['https://a/', adnKatalogUrl(1318)] })
  pruefe('Termin aus ADNs Katalog-Folgenliste (nur vde) bleibt', lauf(katalog).length === 0 && katalog.sprache === undefined)
  const fremdeApi = termin({ sources: ['https://gw.api.animationdigitalnetwork.com/video/show/1318/extra'] })
  pruefe('eine andere ADN-API-Adresse ist keine Sprachzusage', lauf(fremdeApi).length === 1 && fremdeApi.sprache === 'offen')
  const weg = termin()
  lauf(weg, [titel(1, [{ platform: 'adn', url: 'https://x/', dub: true }])])
  pruefe('ADN-Weg mit dub: true bleibt', weg.sprache === undefined)
  const hand = termin()
  lauf(hand, [titel(1)], () => ({ dub: true }) as DubCheck)
  pruefe('Handbeleg „deutsch“ bleibt', hand.sprache === undefined)
  const handNein = termin()
  lauf(handNein, [titel(1)], () => ({ dub: false }) as DubCheck)
  pruefe('Handbeleg „ohne deutschen Ton“ wird „offen“', handNein.sprache === 'offen')
}

console.log('\nNicht betroffen:')
{
  const omu = termin({ sprache: 'omu' })
  lauf(omu)
  pruefe('Eigene Angabe (omu) bleibt', omu.sprache === 'omu')
  pruefe('Anderer Anbieter', lauf(termin({ platform: 'netflix' as never })).length === 0)
  pruefe('Echter Starttermin (premiere)', lauf(termin({ dateMeaning: undefined })).length === 0)
  pruefe('Automatischer Termin (prüft auto-release-pruefung)', lauf(termin({ automatisch: true })).length === 0)
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
