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
const SITE = (process.env.SITE_URL ?? 'https://anime-kalender.de/').replace(
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

/**
 * Der sichtbare Inhalt der Teilen-Seite, als fertiges HTML im `#root`.
 *
 * Bis zum 10.08.2026 stand hier nichts: Die Seite bestand aus Meta-Angaben und
 * einem Skript, das den Hash setzt. Für die Link-Vorschau reichte das, und
 * indexiert wurden die Seiten auch — aber eine Seite ohne Text rankt für
 * nichts. Wer „Steel Ball Run deutsche Synchro" sucht, soll hier landen, und
 * dafür müssen die Wörter auf der Seite stehen.
 *
 * React räumt `#root` beim ersten Rendern leer. Das ist gewollt: Bis das
 * Bündel geladen ist, sieht der Besucher statt einer weißen Fläche schon den
 * Titel und die Termine.
 */
function body(
  release: Release,
  title: Title | undefined,
  synopsis: string | undefined,
  today: string,
): string {
  const events = expandEvents(release)
  const next = events.find((e) => e.date >= today) ?? events[0]
  const hash = `#/woche?${next ? `d=${next.date}&` : ''}r=${release.slug}`
  const art = RELEASE_TYPES[release.releaseType].short
  const platform = PLATFORMS[release.platform].name

  const fakten = [
    `${art} bei ${platform}`,
    release.fsk !== undefined ? `FSK ${release.fsk}` : null,
    title?.genres.length
      ? title.genres.slice(0, 3).map((g) => GENRE_DE[g] ?? g).join(', ')
      : null,
    release.publisher ? `Vertrieb: ${release.publisher}` : null,
    release.edition ?? null,
  ].filter(Boolean) as string[]

  const termine = events
    .map((e) => {
      const wann = `${weekdayName(e.date)}, ${formatDate(e.date)}`
      const zeit = e.time ? ` um ${e.time} Uhr` : ''
      const folge = e.episode ? `Folge ${e.episode}${e.episodeCount ? ` von ${e.episodeCount}` : ''}: ` : ''
      const abgeleitet = e.estimated ? ' (Termin abgeleitet)' : ''
      return `<li>${esc(`${folge}${wann}${zeit}${abgeleitet}`)}</li>`
    })
    .join('\n        ')

  return `<article style="max-width:52rem;margin:0 auto;padding:2rem 1.25rem;color:#d7dced;font-family:system-ui,sans-serif;line-height:1.6;">
      <h1 style="font-size:1.6rem;margin:0 0 .5rem;color:#fff;">${esc(release.name)}</h1>
      <p style="margin:0 0 1rem;color:#9aa5bd;">${esc(fakten.join(' · '))}</p>
      ${synopsis ? `<p style="margin:0 0 1.5rem;">${esc(synopsis)}</p>` : ''}
      ${release.note ? `<p style="margin:0 0 1.5rem;color:#9aa5bd;">${esc(release.note)}</p>` : ''}
      <h2 style="font-size:1.1rem;margin:0 0 .5rem;color:#fff;">Alle Termine mit deutscher Synchronisation</h2>
      <ul style="margin:0 0 1.5rem;padding-left:1.2rem;">
        ${termine || '<li>Noch kein Termin erfasst.</li>'}
      </ul>
      <p><a href="${esc(SITE + hash)}" style="color:#7dd3fc;">Im Kalender ansehen</a></p>
    </article>`
}

function head(release: Release, title: Title | undefined, today: string): string {
  const events = expandEvents(release)
  const next = events.find((e) => e.date >= today) ?? events[0]
  const url = `${SITE}r/${release.slug}/`
  const image = `${SITE}og/${release.slug}.jpg`
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
    <meta property="og:image:type" content="image/jpeg" />
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
  const synopses = readJson<Record<string, { de?: string; en?: string }>>(
    'public/data/synopses.json',
    {},
  )
  const today = todayIso()

  // Nur der deutsche Text kommt auf die Seite. Ein englischer Absatz auf einer
  // durchweg deutschen Seite hilft weder dem Leser noch der Suche.
  const ROOT_TAG = '<div id="root"></div>'
  if (!before.includes(ROOT_TAG) && !after.includes(ROOT_TAG)) {
    console.error('build-share-pages: <div id="root"></div> nicht gefunden — Vorlage geändert?')
    process.exit(1)
  }

  for (const release of releases) {
    const dir = resolve(DIST, 'r', release.slug)
    mkdirSync(dir, { recursive: true })
    const title = titleById.get(release.titleId)
    const inhalt = body(release, title, synopses[String(release.titleId)]?.de, today)
    const seite = (before + head(release, title, today) + after).replace(
      ROOT_TAG,
      `<div id="root">${inhalt}</div>`,
    )
    writeFileSync(resolve(dir, 'index.html'), seite, 'utf8')
  }

  log(`${releases.length} Teilen-Seiten unter dist/r/ geschrieben`)
  writeSitemap(releases)
}

/**
 * Schreibt `sitemap.xml` und `robots.txt`.
 *
 * Warum das hier steht und nicht als statische Datei im Repo: Eine Sitemap darf
 * nur Adressen enthalten, die es wirklich gibt. Die Teilen-Seiten entstehen
 * genau eine Zeile weiter oben aus dem Datenbestand — was dort nicht gebaut
 * wurde, gehört auch nicht in die Sitemap.
 *
 * Aufgenommen werden ausschließlich die vorgerenderten Seiten. Die Ansichten
 * der App (`#/woche`, `#/datenbank` …) fehlen bewusst: Alles hinter dem `#`
 * bekommt eine Suchmaschine nie zu sehen, sie würde für jede dieser Adressen
 * dieselbe Startseite indexieren.
 */
function writeSitemap(releases: Release[]): void {
  const today = todayIso()
  const urls = [
    { loc: SITE, priority: '1.0', changefreq: 'daily' },
    ...releases.map((r) => ({
      loc: `${SITE}r/${r.slug}/`,
      priority: '0.7',
      // Ein laufender Simuldub ändert sich wöchentlich, ein Disc-Termin steht.
      changefreq: r.releaseType === 'weekly' ? 'weekly' : 'monthly',
    })),
  ]

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url>\n    <loc>${esc(u.loc)}</loc>\n    <lastmod>${today}</lastmod>\n` +
          `    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
      )
      .join('\n') +
    `\n</urlset>\n`

  writeFileSync(resolve(DIST, 'sitemap.xml'), xml, 'utf8')

  // Kein `Disallow` — die Seite soll gefunden werden. Der Sitemap-Verweis ist
  // der eigentliche Zweck dieser Datei: Ohne ihn muss jede Suchmaschine die
  // Adresse raten oder auf das Einreichen in der Search Console warten.
  writeFileSync(
    resolve(DIST, 'robots.txt'),
    ['User-agent: *', 'Allow: /', '', `Sitemap: ${SITE}sitemap.xml`, ''].join('\n'),
    'utf8',
  )

  log(`sitemap.xml mit ${urls.length} Adressen und robots.txt geschrieben`)
}

main()
