/**
 * Nachbereitung des Vite-Builds: legt je Release eine echte Seite unter
 * `dist/r/<slug>/index.html` an, damit ein geteilter Link eine eigene
 * Vorschau bekommt.
 *
 * Warum überhaupt: Diese App nutzt Hash-Routing. Alles hinter dem `#` schickt
 * ein Browser nie an den Server — WhatsApp, Discord, Telegram, Slack und die
 * Suchmaschinen sehen von `…/#/woche?r=cr-XY` also nur `…/anime-kalender-de/`
 * und ziehen für jeden Link dieselbe Vorschau. Eine eigene Vorschau je Titel
 * kann es nur geben, wenn es zu ihr einen eigenen Pfad und eine eigene Datei
 * gibt. Genau die entstehen hier.
 *
 * Die erzeugte Datei ist eine Kopie der gebauten index.html — dieselbe App,
 * dieselben Skripte. Getauscht werden nur die Angaben zwischen den
 * `social:`-Markern, und ein kurzes Skript setzt den Hash, bevor die App
 * startet. Für Besucher ist der Umweg unsichtbar.
 *
 * Läuft automatisch nach `npm run build`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PLATFORMS, RELEASE_TYPES, type Release, type Title } from '../shared/types.ts'
import { expandEvents } from '../shared/logic.ts'
import { formatDate, todayIso, weekdayName } from '../shared/time.ts'
import { GENRE_DE } from '../shared/mappings.ts'
import { ROOT, log, readJson } from './lib/util.ts'

const DIST = resolve(ROOT, 'dist')
const SITE = (process.env.SITE_URL ?? 'https://danielzaiser91.github.io/anime-kalender-de/').replace(
  /\/?$/,
  '/',
)

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Beschreibungstext der Vorschau — das, was unter der Überschrift steht. */
function describe(release: Release, title: Title | undefined, today: string): string {
  const events = expandEvents(release)
  const next = events.find((e) => e.date >= today) ?? events[0]
  const parts: string[] = []

  if (next) {
    const when = `${weekdayName(next.date)}, ${formatDate(next.date)}`
    const time = next.time
      ? ` um ${next.time} Uhr`
      : release.releaseType === 'disc'
        ? ''
        : ' (Uhrzeit noch offen)'
    const episode = next.episode ? `Folge ${next.episode}` : null
    parts.push(
      release.releaseType === 'disc'
        ? `Erscheint am ${when} auf ${release.edition ?? 'DVD und Blu-ray'}.`
        : `${episode ? `${episode} am ` : 'Ab '}${when}${time} bei ${PLATFORMS[release.platform].name}.`,
    )
  }
  if (release.fsk !== undefined) parts.push(`FSK ${release.fsk}.`)
  // Genres liegen im Datensatz englisch — die Vorschau ist deutsch.
  if (title?.genres.length) {
    parts.push(title.genres.slice(0, 3).map((g) => GENRE_DE[g] ?? g).join(', ') + '.')
  }
  parts.push('Mit deutscher Synchronisation.')
  return parts.join(' ')
}

function head(release: Release, title: Title | undefined, today: string): string {
  const events = expandEvents(release)
  const next = events.find((e) => e.date >= today) ?? events[0]
  const url = `${SITE}r/${release.slug}/`
  const image = `${SITE}og/${release.slug}.png`
  const headline = `${release.name} — ${RELEASE_TYPES[release.releaseType].short} bei ${PLATFORMS[release.platform].name}`
  const description = describe(release, title, today)
  const hash = `#/woche?${next ? `d=${next.date}&` : ''}r=${release.slug}`

  return `    <title>${esc(headline)}</title>
    <meta name="description" content="${esc(description)}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Anime-Kalender DE" />
    <meta property="og:locale" content="de_DE" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${esc(headline)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${esc(release.name)} — Termin, Plattform und FSK auf einen Blick" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(headline)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${image}" />
    <link rel="canonical" href="${url}" />
    <script>
      // Läuft vor dem Modul-Skript der App, weil klassische Inline-Skripte
      // nicht deferred sind. Nur setzen, wenn der Besucher nicht schon selbst
      // einen Hash mitgebracht hat.
      if (!location.hash) location.hash = ${JSON.stringify(hash)};
    </script>`
}

function main(): void {
  const template = readFileSync(resolve(DIST, 'index.html'), 'utf8')
  const start = template.indexOf('<!-- social:start')
  const end = template.indexOf('<!-- social:end -->')
  if (start < 0 || end < 0) {
    console.error('build-share-pages: Marker <!-- social:start/end --> fehlen in web/index.html')
    process.exit(1)
  }
  const before = template.slice(0, start)
  const after = template.slice(end + '<!-- social:end -->'.length)

  const releases = readJson<Release[]>('public/data/releases.json', [])
  const titles = readJson<Title[]>('public/data/titles-core.json', [])
  const titleById = new Map(titles.map((t) => [t.id, t]))
  const today = todayIso()

  for (const release of releases) {
    const dir = resolve(DIST, 'r', release.slug)
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      resolve(dir, 'index.html'),
      before + head(release, titleById.get(release.titleId), today) + after,
      'utf8',
    )
  }

  log(`${releases.length} Teilen-Seiten unter dist/r/ geschrieben`)
}

main()
