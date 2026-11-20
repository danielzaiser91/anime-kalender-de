/**
 * **Gemeinsame Fälle für „der Push folgt dem Kalender-Filter“** (20.11.2026): dieselben Termine und dieselben Filter laufen
 * in `pipeline/check-push-filter.ts` durch den Kalender (`eventsFuerAnsichtGen`) und in `tools/worker-push-filter.test.ts` durch
 * den Versand (`pushVersand`). Das Soll steht hier von Hand, nicht aus einer der beiden Regeln gerechnet.
 *
 * Titel 1: TV-Wiederholung (Folge 3, laut Folgenliste 2020 erstmals deutsch) — der Anlass, My Hero Academia auf ProSieben MAXX
 * am 20.11.2026, Folge 3, `tvPremiere: false`. Titel 2: TV-Premiere (Handbeleg). Titel 3: TV-Sichtung ohne Folge.
 * Titel 4: Netflix. Titel 5: Disc. Titel 6: Netflix-Termin, den ein früherer Anbieter schon hatte (Zweitanbieter).
 */
import type { Release, ReleaseEvent, Title } from '../shared/types.ts'
import type { TerminFilter } from '../shared/push-filter.ts'

export const TAG = '2026-10-23'

const release = (slug: string, titleId: number, platform: string, releaseType: string, mehr: Partial<Release> = {}): Release =>
  ({ slug, titleId, platform, releaseType, year: 2026, name: slug, schedule: { firstEpisodeDate: TAG, time: '09:00', estimated: false }, ...mehr }) as unknown as Release

export const RELEASES: Release[] = [
  release('tv-wdh', 1, 'tv', 'weekly', { ersteDeutsch: { 3: '2020-01-01' } }),
  release('tv-premiere', 2, 'tv', 'weekly', { premiere: { weg: 'tv' } as Release['premiere'] }),
  release('tv-sichtung', 3, 'tv', 'weekly'),
  release('stream', 4, 'netflix', 'weekly'),
  release('disc', 5, 'amazon', 'disc'),
  release('zweit', 6, 'netflix', 'weekly'),
]

export const TITEL: Title[] = [1, 2, 3, 4, 5, 6].map(
  (id) => ({ id, titleDe: `T${id}`, genres: [], keywords: [], streams: [], dubConfidence: 'high' }) as unknown as Title,
)

const termin = (n: number, r: Release, mehr: Partial<ReleaseEvent> = {}): ReleaseEvent =>
  ({ id: `e${n}`, releaseSlug: r.slug, titleId: n, date: TAG, time: '09:00', platform: r.platform, releaseType: r.releaseType, name: `T${n}`, ...mehr }) as ReleaseEvent

/** Ohne `tvPremiere`: das setzt der Bau (`schreibeTvAuskunft`), der Test ruft ihn auf. */
export const EREIGNISSE: ReleaseEvent[] = [
  termin(1, RELEASES[0]!, { episode: 3 }),
  termin(2, RELEASES[1]!, { episode: 1 }),
  termin(3, RELEASES[2]!, { sichtung: true }),
  termin(4, RELEASES[3]!, { episode: 1 }),
  termin(5, RELEASES[4]!),
  termin(6, RELEASES[5]!, { episode: 1, zweitanbieter: { erster: 'primevideo', seit: '2026-10-01' } }),
]

export const ohne = (): TerminFilter => ({ platforms: [], releaseTypes: [], excluded: { platforms: [], releaseTypes: [] }, zweitanbieterExcluded: false })

export interface Fall {
  name: string
  filter: TerminFilter | null
  /** Titel-Nummern, deren Termin sichtbar bleibt. */
  sichtbar: number[]
}

export const FAELLE: Fall[] = [
  { name: 'kein Filter: alles', filter: null, sichtbar: [1, 2, 3, 4, 5, 6] },
  { name: 'TV aus: nur die Premiere bleibt vom Fernsehen (Anlass)', filter: { ...ohne(), tvAus: true }, sichtbar: [2, 4, 5, 6] },
  { name: 'Netflix ausgeschlossen', filter: { ...ohne(), excluded: { platforms: ['netflix'], releaseTypes: [] } }, sichtbar: [1, 2, 3, 5] },
  { name: 'nur Netflix', filter: { ...ohne(), platforms: ['netflix'] }, sichtbar: [4, 6] },
  { name: 'Disc ausgeschlossen', filter: { ...ohne(), excluded: { platforms: [], releaseTypes: ['disc'] } }, sichtbar: [1, 2, 3, 4, 6] },
  { name: 'nur Disc', filter: { ...ohne(), releaseTypes: ['disc'] }, sichtbar: [5] },
  { name: 'Zweitanbieter ausgeblendet', filter: { ...ohne(), zweitanbieterExcluded: true }, sichtbar: [1, 2, 3, 4, 5] },
  {
    name: 'TV aus, Disc aus und Netflix nur',
    filter: { ...ohne(), tvAus: true, platforms: ['netflix'], excluded: { platforms: [], releaseTypes: ['disc'] } },
    sichtbar: [4, 6],
  },
  { name: 'TV aus, Disc aus', filter: { ...ohne(), tvAus: true, excluded: { platforms: [], releaseTypes: ['disc'] } }, sichtbar: [2, 4, 6] },
]
