/**
 * Zusicherung (PR 2947, Lehre 2690): Der Besuchertext eines Termins steht in `Release.hinweis`, die interne Pflegenotiz `note`
 * erscheint nie. Gerendert werden beide Leser: `KinoBanner` und `AntwortBereich` (Notiz-Zeile des Kastens).
 * Aufruf: `npm run check:logic`.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Release, Title } from '../shared/types.ts'
import { AntwortBereich } from '../web/src/components/detail/antwort-bereich.tsx'
import { KinoBanner } from '../web/src/components/detail/kino.tsx'
import { sortiereNachZugang } from '../web/src/components/detail/wege-sortieren.ts'
import { berechneAntwort } from '../web/src/components/detail/antwort-berechnen.ts'
import { translate } from '../web/src/lib/i18n.tsx'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const HEUTE = '2026-10-21'
const JETZT = new Date('2026-10-21T12:00:00Z')
const text = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
const HINWEIS = 'Besuchertext Quelle Hinweis'
const NOTIZ = 'Pflegenotiz Intern Notiz'

const titel = { id: 900101, slug: 'x', format: 'MOVIE', jpYear: 2025, hasVoices: true, streams: [], watchLinks: [], titleDe: 'Probe' } as unknown as Title
const release = (extra: object): Release =>
  ({
    slug: 'probe-kino',
    titleId: 900101,
    name: 'Probe',
    platform: 'kino',
    releaseType: 'single',
    schedule: { firstEpisodeDate: '2026-11-05' },
    year: 2026,
    sources: ['https://example.org/a'],
    ...extra,
  }) as unknown as Release

console.log('\nKinoBanner liest hinweis, nicht note:')
const banner = (r: Release): string => text(renderToStaticMarkup(createElement(KinoBanner, { release: r, title: titel, today: HEUTE, t: translate as never })))
const kino = banner(release({ hinweis: HINWEIS, note: NOTIZ }))
pruefe('hinweis steht im Banner', kino.includes(HINWEIS), kino)
pruefe('note steht nicht im Banner', !kino.includes(NOTIZ), kino)
pruefe('Gegenfall nur note: kein Text im Banner', !banner(release({ note: NOTIZ })).includes(NOTIZ))
pruefe('nur hinweis (ohne note): steht im Banner', banner(release({ hinweis: HINWEIS })).includes(HINWEIS))

console.log('\nAntwortBereich liest hinweis, nicht note:')
const leer = { verbindung: { verbunden: false }, favorites: new Set(), folgenAngabeFuer: () => '', dubZeilen: () => [], releaseJePlattform: new Map() }
function bereich(notizRelease: Release | undefined): string {
  const t = { ...titel, format: 'TV', episodes: 12 } as unknown as Title
  const antwort = berechneAntwort({ title: t, releases: [], today: HEUTE, jetzt: JETZT })
  const eingabe = {
    ...leer,
    antwort,
    sortiertNachZugang: sortiereNachZugang({ title: t }),
    streamReleases: [],
    terminReleases: [],
    title: t,
    t: translate,
    today: HEUTE,
    wegeHinweis: undefined,
    tvVorbei: [],
    kastenNotiz: notizRelease,
    folgenLuecke: null,
    releases: [],
    discAusgaben: [],
    discReleases: [],
  }
  return text(renderToStaticMarkup(createElement(AntwortBereich, eingabe as never)))
}
const kasten = bereich(release({ hinweis: HINWEIS, note: NOTIZ }))
pruefe('hinweis steht im Kasten', kasten.includes(HINWEIS), kasten)
pruefe('note steht nicht im Kasten', !kasten.includes(NOTIZ), kasten)
pruefe('Gegenfall nur note: kein Text im Kasten', !bereich(release({ note: NOTIZ })).includes(NOTIZ))
pruefe('nur hinweis (ohne note): steht im Kasten', bereich(release({ hinweis: HINWEIS })).includes(HINWEIS))

if (verletzt) {
  console.error(`\n${verletzt} Prüfung(en) verletzt`)
  process.exit(1)
}
console.log('\nhinweis-anzeige: 8 von 8 Prüfungen grün')
