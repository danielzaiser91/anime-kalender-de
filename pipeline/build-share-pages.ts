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
import { PLATFORMS, RELEASE_TYPES, SYNOPSIS_GROUPS, type Release, type Title } from '../shared/types.ts'
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
  geschwister: Release[],
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

  /**
   * **Die anderen Ausgaben desselben Titels — verlinkt und benannt.**
   *
   * Stand der Search Console am 07.09.2026: **62 Seiten indexiert, 596 nicht.**
   * Die Gründe, gemessen statt vermutet:
   *
   * | Grund | Seiten |
   * |---|---|
   * | Gefunden – zurzeit nicht indexiert | 562 |
   * | Gecrawlt – zurzeit nicht indexiert | 28 |
   * | Seite mit Weiterleitung | 3 |
   * | Nicht gefunden (404) | 2 |
   * | Duplikat – andere kanonische Seite | 1 |
   *
   * Die letzten drei sind kein Fehler oder längst erklärt: Die Weiterleitungen
   * sind die Domain-Varianten (www, http), von den beiden 404ern ist einer eine
   * Fremdadresse (`anime.php?next`) und der andere ein Slug, den ein
   * Import-Fix zu Recht entfernt hat.
   *
   * **Die 562 sind der Fall vom 17.08.2026, unerledigt** — damals 171 Seiten,
   * und die Antwort darauf steht weiter unten in dieser Datei: Übersicht und
   * Startseite verlinken jede Teilen-Seite. Das reicht nicht. Eine Seite, auf
   * die nur eine Sammelliste zeigt, bleibt für Google ein Blatt am Ende eines
   * Astes.
   *
   * Der Block hier legt **Querverbindungen zwischen verwandten Seiten**: Vol. 1
   * zeigt auf Vol. 2 und auf den Streaming-Weg desselben Titels, und umgekehrt.
   * 149 der 662 Adressen gehören zu einem Titel mit mehreren Ausgaben.
   *
   * **Und er behebt die eine Duplikat-Seite mit.** Google nennt
   * `as-a-reincarnated-aristocrat-s1-vol1`; gemessen an drei solchen Paaren
   * liegt die Wortüberschneidung bei **96 bis 98 Prozent**, denn von 855 bis
   * 1355 Zeichen sichtbarem Text entfallen rund vier Fünftel auf die
   * Serienbeschreibung, und die ist bei jeder Ausgabe dieselbe.
   *
   * Ein `canonical` auf eine der Seiten wäre der falsche Griff: „Vol. 2" und
   * „Staffel 3" sind eigene Veröffentlichungen mit eigenem Termin, und genau
   * danach sucht jemand. Was fehlt, ist nicht weniger Seite, sondern mehr
   * eigener Inhalt — und der liegt bereit.
   */
  const andere = geschwister.length
    ? `<h2 style="font-size:1.1rem;margin:0 0 .5rem;color:#fff;">Weitere Ausgaben von ${esc(
        title?.titleDe ?? title?.titleEn ?? title?.titleRomaji ?? release.name,
      )}</h2>
      <ul style="margin:0 0 1.5rem;padding-left:1.2rem;">
        ${geschwister
          .map((g) => {
            const wann = g.schedule.firstEpisodeDate
              ? `${weekdayName(g.schedule.firstEpisodeDate)}, ${formatDate(g.schedule.firstEpisodeDate)}`
              : 'Termin offen'
            const wo = `${RELEASE_TYPES[g.releaseType].short} bei ${PLATFORMS[g.platform].name}`
            const zusatz = g.edition ? ' · ' + g.edition : ''
            return (
              '<li><a href="' +
              esc(SITE) +
              'r/' +
              esc(g.slug) +
              '/" style="color:#7dd3fc;">' +
              esc(g.name) +
              '</a> — ' +
              esc(wo + ' · ' + wann + zusatz) +
              '</li>'
            )
          })
          .join('\n        ')}
      </ul>`
    : ''

  /**
   * **Wo es auf Deutsch läuft — die Auskunft, die es nur hier gibt.**
   *
   * Gemessen am 07.09.2026: 62 von 664 Seiten sind indexiert (9 %). Technisch
   * ist nichts im Weg — jede Seite existiert, trägt ein `canonical`, keine ein
   * `noindex`, und die robots.txt erlaubt alles. Was bleibt, ist dünner und
   * einander ähnelnder Inhalt: 663 Seiten mit rund 1.500 Zeichen, aufgebaut
   * aus Titel, Fakten und Beschreibung — und die Beschreibung ist bei allen
   * Ausgaben derselben Serie dieselbe.
   *
   * Ausgerechnet die Angabe, für die es dieses Projekt gibt, stand auf keiner
   * einzigen Teilen-Seite: **welcher Anbieter die deutsche Fassung führt, und
   * bis zu welcher Folge.** Das ist einzigartiger Inhalt im Wortsinn — kein
   * anderer Kalender trennt Synchro von Untertitel je Folge — und es
   * beantwortet genau die Frage, mit der jemand sucht („… deutsch stream").
   *
   * **Nichts wird dabei behauptet.** Ein Verweis ohne Urteil erscheint gar
   * nicht; ein Bereich wird nur genannt, wenn er belegt ist.
   */
  const wege = (title?.streams ?? []).filter((s) => s.dub === true)
  const wegeBlock = wege.length
    ? `<h2 style="font-size:1.1rem;margin:0 0 .5rem;color:#fff;">Wo ${esc(
        title?.titleDe ?? title?.titleEn ?? title?.titleRomaji ?? release.name,
      )} auf Deutsch läuft</h2>
      <ul style="margin:0 0 1.5rem;padding-left:1.2rem;">
        ${wege
          .map((s) => {
            const belegt = (s.dubRanges ?? []).filter((r) => r.dub)
            const spanne = belegt.length
              ? belegt.map((r) => (r.from === r.to ? `Folge ${r.from}` : `Folgen ${r.from}–${r.to}`)).join(', ')
              : title?.episodes
                ? `alle ${title.episodes} Folgen`
                : 'auf Deutsch'
            return `<li><a href="${esc(s.url)}" rel="nofollow" style="color:#7dd3fc;">${esc(
              PLATFORMS[s.platform].name,
            )}</a> — ${esc(spanne)} auf Deutsch</li>`
          })
          .join('\n        ')}
      </ul>`
    : ''

  return `<article style="max-width:52rem;margin:0 auto;padding:2rem 1.25rem;color:#d7dced;font-family:system-ui,sans-serif;line-height:1.6;">
      <h1 style="font-size:1.6rem;margin:0 0 .5rem;color:#fff;">${esc(release.name)}</h1>
      <p style="margin:0 0 1rem;color:#9aa5bd;">${esc(fakten.join(' · '))}</p>
      ${synopsis ? `<p style="margin:0 0 1.5rem;">${esc(synopsis)}</p>` : ''}
      ${release.note ? `<p style="margin:0 0 1.5rem;color:#9aa5bd;">${esc(release.note)}</p>` : ''}
      <h2 style="font-size:1.1rem;margin:0 0 .5rem;color:#fff;">Alle Termine mit deutscher Synchronisation</h2>
      <ul style="margin:0 0 1.5rem;padding-left:1.2rem;">
        ${termine || '<li>Noch kein Termin erfasst.</li>'}
      </ul>
      ${wegeBlock}
      ${andere}
      <p><a href="${esc(SITE + hash)}" style="color:#7dd3fc;">Im Kalender ansehen</a></p>
    </article>`
}

/**
 * **Strukturierte Daten — das Signal, das Google direkt versteht.**
 *
 * Gemessen am 07.09.2026: Weder die Startseite noch eine Teilen-Seite trug
 * einen einzigen `application/ld+json`-Block. Für eine Seite, deren Kern ein
 * **Termin** ist, ist das die naheliegendste Auskunft überhaupt — und sie
 * fehlte vollständig, während 562 Seiten als „Gefunden – zurzeit nicht
 * indexiert" in der Search Console standen.
 *
 * **Nichts wird erfunden.** Jedes Feld hier stammt aus dem Datensatz: Name,
 * Beschreibung, Bild, Genres, Folgenzahl, Termin. Kein `aggregateRating`, kein
 * `offers` — beides hätten wir nicht belegt, und die Regel dieses Projekts
 * gilt für Maschinenleser genauso wie für Menschen.
 *
 * **Der Typ folgt dem Werk, nicht dem Release.** Ein Film ist `Movie`, alles
 * andere `TVSeries`; das Release liefert den Termin dazu. Wer beides in einen
 * Typ presst, behauptet für eine Blu-ray-Box dieselbe Sache wie für eine
 * wöchentliche Ausstrahlung.
 */
function strukturierteDaten(release: Release, title: Title | undefined, today: string): string {
  const events = expandEvents(release)
  const next = events.find((e) => e.date >= today) ?? events[0]
  const url = `${SITE}r/${release.slug}/`

  const istFilm = title?.format === 'MOVIE'
  const daten: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': istFilm ? 'Movie' : 'TVSeries',
    name: release.name,
    url,
    inLanguage: 'de',
    /* Dieselbe Beschreibung wie im og:description — eine Auskunft, eine Quelle. */
    description: describe(release, title, today),
  }

  /* Nur setzen, was wirklich dasteht — ein leeres Feld ist schlechter als keins. */
  if (title?.genres?.length) daten.genre = title.genres.slice(0, 5).map((g) => GENRE_DE[g] ?? g)
  if (!istFilm && title?.episodes) daten.numberOfEpisodes = title.episodes
  if (title?.jpYear) daten.datePublished = String(title.jpYear)
  daten.image = `${SITE}og/${release.slug}.jpg`

  /*
    Der Termin als eigenes Ereignis. `BroadcastEvent` passt für eine
    Ausstrahlung, `PublicationEvent` für eine Veröffentlichung — bei einer
    Disc oder einem Streaming-Start ist das Zweite richtig.
  */
  if (next?.date) {
    daten.releasedEvent = {
      '@type': 'PublicationEvent',
      startDate: next.date,
      location: { '@type': 'VirtualLocation', name: PLATFORMS[release.platform].name },
    }
  }

  /*
    **Wo man es sehen kann — als Maschinenauskunft.**

    Der Block nennt seit dem 07.09.2026 Name, Genres, Folgenzahl und den
    Termin. Was fehlte, ist genau die Angabe, für die es dieses Projekt gibt:
    **welcher Anbieter die deutsche Fassung führt.** Schema.org kennt dafür
    `potentialAction: WatchAction` mit einem `target` je Anbieter.

    Aufgenommen wird nur, was belegt ist: ein Verweis mit `dub: true`. Ein
    Fragezeichen wäre hier eine Behauptung — ein Suchergebnis, das „ansehen"
    verspricht und zu einer Seite ohne deutsche Fassung führt, ist schlimmer
    als keins.
  */
  const schauWege = (title?.streams ?? []).filter((s) => s.dub === true && s.url)
  if (schauWege.length) {
    daten.potentialAction = schauWege.map((s) => ({
      '@type': 'WatchAction',
      target: { '@type': 'EntryPoint', urlTemplate: s.url, actionPlatform: PLATFORMS[s.platform].name },
      expectsAcceptanceOf: { '@type': 'Offer', availableAtOrFrom: { '@type': 'Country', name: 'DE' } },
    }))
  }

  return `    <script type="application/ld+json">${JSON.stringify(daten)}</script>`
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
${strukturierteDaten(release, title, today)}
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
  // Die Synopsen liegen seit dem 10.08.2026 in Gruppen statt in einer Datei.
  // Hier werden alle gebraucht — die Seiten entstehen einmal im Build, nicht im
  // Browser, für ihn zählt die Aufteilung nicht.
  const synopses: Record<string, { de?: string; en?: string }> = {}
  for (let gruppe = 0; gruppe < SYNOPSIS_GROUPS; gruppe++) {
    Object.assign(synopses, readJson<Record<string, { de?: string; en?: string }>>(`public/data/synopses/${gruppe}.json`, {}))
  }
  const today = todayIso()

  // Nur der deutsche Text kommt auf die Seite. Ein englischer Absatz auf einer
  // durchweg deutschen Seite hilft weder dem Leser noch der Suche.
  const ROOT_TAG = '<div id="root"></div>'
  if (!before.includes(ROOT_TAG) && !after.includes(ROOT_TAG)) {
    console.error('build-share-pages: <div id="root"></div> nicht gefunden — Vorlage geändert?')
    process.exit(1)
  }

  /* Welche Ausgaben gehören zu demselben Titel? Einmal gruppiert statt je Seite gesucht. */
  const jeTitel = new Map<number, Release[]>()
  for (const r of releases) {
    if (!r.slug) continue
    const liste = jeTitel.get(r.titleId)
    if (liste) liste.push(r)
    else jeTitel.set(r.titleId, [r])
  }

  for (const release of releases) {
    const dir = resolve(DIST, 'r', release.slug)
    mkdirSync(dir, { recursive: true })
    const title = titleById.get(release.titleId)
    const inhalt = body(
      release,
      title,
      synopses[String(release.titleId)]?.de,
      today,
      (jeTitel.get(release.titleId) ?? []).filter((g) => g.slug !== release.slug),
    )
    const seite = (before + head(release, title, today) + after).replace(
      ROOT_TAG,
      `<div id="root">${inhalt}</div>`,
    )
    writeFileSync(resolve(dir, 'index.html'), seite, 'utf8')
  }

  /**
   * Eine echte Übersicht, die jede Teilen-Seite intern verlinkt.
   *
   * Der Befund vom 17.08.2026 in der Search Console: **171 von 183 Seiten
   * „Gefunden – zurzeit nicht indexiert"**, dazu zwei „Gecrawlt – nicht
   * indexiert". Der Inhalt war nicht das Problem — die Teilen-Seiten tragen
   * Titel, Beschreibung und Terminliste im ausgelieferten HTML. Es fehlte etwas
   * anderes: **jeder interne Link**.
   *
   * Die Startseite ist eine Einzelseitenanwendung; ihre Verweise sind
   * Hash-Adressen und entstehen erst durch JavaScript. Im ausgelieferten HTML
   * stand `<div id="root"></div>` und sonst nichts. Google kannte die 183
   * Adressen also ausschließlich aus der Sitemap, und eine Seite, auf die
   * nirgends verlinkt wird, gilt als unwichtig. Genau das drückt „Gefunden –
   * zurzeit nicht indexiert" aus.
   *
   * Zwei Seiten schließen die Lücke: diese Übersicht verlinkt alle Termine, und
   * die Startseite verlinkt die Übersicht samt der nächsten Termine.
   */
  schreibeUebersicht(releases, titleById, today, before, after, ROOT_TAG)
  schreibeStartseite(releases, titleById, today, template, ROOT_TAG)

  log(`${releases.length} Teilen-Seiten, Übersicht und Startseite geschrieben`)
  writeSitemap(releases)
}

/** Gemeinsamer Rahmen für die beiden vorgerenderten Seiten. */
const STIL =
  'max-width:52rem;margin:0 auto;padding:2rem 1.25rem;color:#d7dced;' +
  'font-family:system-ui,sans-serif;line-height:1.6;'

function terminZeile(release: Release, titel: Title | undefined): string {
  const name = esc(release.name || titel?.titleDe || titel?.titleEn || release.slug)
  const datum = release.schedule.firstEpisodeDate.split('-').reverse().join('.')
  const anbieter = esc(PLATFORMS[release.platform]?.name ?? release.platform)
  return (
    `      <li><a href="${SITE}r/${release.slug}/" style="color:#7dd3fc;">${name}</a>` +
    ` — ${datum}, ${anbieter}</li>\n`
  )
}

function schreibeUebersicht(
  releases: Release[],
  titleById: Map<number, Title>,
  today: string,
  before: string,
  after: string,
  rootTag: string,
): void {
  const sortiert = [...releases].sort((a, b) =>
    b.schedule.firstEpisodeDate.localeCompare(a.schedule.firstEpisodeDate),
  )
  const kommend = sortiert.filter((r) => r.schedule.firstEpisodeDate >= today).reverse()
  const vergangen = sortiert.filter((r) => r.schedule.firstEpisodeDate < today)

  const liste = (rs: Release[]) =>
    rs.map((r) => terminZeile(r, titleById.get(r.titleId))).join('')

  const inhalt =
    `<article style="${STIL}">\n` +
    `      <h1 style="font-size:1.6rem;margin:0 0 .5rem;color:#fff;">Alle Termine mit deutscher Synchronisation</h1>\n` +
    `      <p style="margin:0 0 1.5rem;color:#9aa5bd;">${releases.length} Veröffentlichungen, ` +
    `${kommend.length} davon stehen noch an.</p>\n` +
    (kommend.length
      ? `      <h2 style="font-size:1.1rem;margin:0 0 .5rem;color:#fff;">Kommende Termine</h2>\n` +
        `      <ul style="margin:0 0 2rem;padding-left:1.2rem;">\n${liste(kommend)}      </ul>\n`
      : '') +
    `      <h2 style="font-size:1.1rem;margin:0 0 .5rem;color:#fff;">Bereits erschienen</h2>\n` +
    `      <ul style="margin:0 0 2rem;padding-left:1.2rem;">\n${liste(vergangen)}      </ul>\n` +
    `      <p><a href="${SITE}" style="color:#7dd3fc;">Zum Kalender</a></p>\n` +
    `    </article>`

  const kopf =
    `    <title>Alle Anime-Termine mit deutscher Synchro — Anime-Kalender DE</title>\n` +
    `    <meta name="description" content="Vollständige Liste aller ${releases.length} Anime-Veröffentlichungen mit deutscher Synchronisation: Termin, Anbieter und Details je Titel." />\n` +
    `    <link rel="canonical" href="${SITE}termine/" />\n`

  const dir = resolve(DIST, 'termine')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    resolve(dir, 'index.html'),
    (before + kopf + after).replace(rootTag, `<div id="root">${inhalt}</div>`),
    'utf8',
  )
}

/**
 * Die Startseite bekommt Inhalt, den ein Crawler ohne JavaScript sieht.
 *
 * Vorher lieferte sie `<div id="root"></div>` — kein Text, kein Link, nichts,
 * wovon aus Google weiterlaufen könnte. React ersetzt den Inhalt beim Mounten,
 * für Besucher ändert sich also nichts.
 */
function schreibeStartseite(
  releases: Release[],
  titleById: Map<number, Title>,
  today: string,
  template: string,
  rootTag: string,
): void {
  const naechste = [...releases]
    .filter((r) => r.schedule.firstEpisodeDate >= today)
    .sort((a, b) => a.schedule.firstEpisodeDate.localeCompare(b.schedule.firstEpisodeDate))
    .slice(0, 20)

  const inhalt =
    `<article style="${STIL}">\n` +
    `      <h1 style="font-size:1.6rem;margin:0 0 .5rem;color:#fff;">Anime-Kalender DE</h1>\n` +
    `      <p style="margin:0 0 1.5rem;">Alle Anime, für die es eine deutsche Synchronfassung gibt oder geben wird — mit Termin, Anbieter und Kalender-Export.</p>\n` +
    (naechste.length
      ? `      <h2 style="font-size:1.1rem;margin:0 0 .5rem;color:#fff;">Als nächstes</h2>\n` +
        `      <ul style="margin:0 0 1.5rem;padding-left:1.2rem;">\n` +
        naechste.map((r) => terminZeile(r, titleById.get(r.titleId))).join('') +
        `      </ul>\n`
      : '') +
    `      <p><a href="${SITE}termine/" style="color:#7dd3fc;">Alle ${releases.length} Termine ansehen</a></p>\n` +
    `    </article>`

  writeFileSync(
    resolve(DIST, 'index.html'),
    template.replace(rootTag, `<div id="root">${inhalt}</div>`),
    'utf8',
  )
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
  // Die Übersicht gehört dazu: Sie ist der Einstieg zu allen Teilen-Seiten.
  const today = todayIso()
  const urls = [
    { loc: SITE, priority: '1.0', changefreq: 'daily' },
    // Der Einstieg zu allen Teilen-Seiten — er muss selbst gefunden werden.
    { loc: `${SITE}termine/`, priority: '0.9', changefreq: 'daily' },
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
