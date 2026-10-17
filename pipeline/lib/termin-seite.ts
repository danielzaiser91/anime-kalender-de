/**
 * Kopf und Inhalt der Terminseite eines Titels (`/t/<adresse>/` mit Termin). Eigene Datei, damit die Prüfung sie ohne den Seitenbau aufrufen kann.
 */
import { PLATFORMS, RELEASE_TYPES, anbieterName, type Release, type Title } from '../../shared/types.ts'
import { anzeigeFolge, expandEvents } from '../../shared/logic.ts'
import { formatDate, weekdayName } from '../../shared/time.ts'
import { GENRE_DE } from '../../shared/mappings.ts'
import { andereNamen } from './titel-namen.ts'
import { SITE, esc, namenZeile, seitenTitel, sprachFeld, synchroSatz, termineUeberschrift, synopsenAbsatz, type SynopsenText } from './titel-seite.ts'
import { type Umfeld } from './titel-umfeld.ts'
import { teilenPfad, titelAdresse, titelHash } from '../../shared/teilen.ts'
import { OG_FASSUNG } from './og-fassung.ts'

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
    const episode = anzeigeFolge(next) ? `Folge ${next.episode}` : null
    parts.push(
      release.releaseType === 'disc'
        ? `Erscheint am ${when} auf ${release.edition ?? 'DVD und Blu-ray'}.`
        : `${episode ? `${episode} am ` : 'Ab '}${when}${time} bei ${anbieterName(release.platform, release.sender)}.`,
    )
  }
  if (release.fsk !== undefined) parts.push(`FSK ${release.fsk}.`)
  // Genres liegen im Datensatz englisch — die Vorschau ist deutsch.
  if (title?.genres.length) {
    parts.push(title.genres.slice(0, 3).map((g) => GENRE_DE[g] ?? g).join(', ') + '.')
  }
  /* Bei Cartoons ist die deutsche Fassung nicht belegt; bei Anime nur mit Beleg „Mit deutscher Synchronisation“. */
  const synchro = synchroSatz(title)
  if (synchro) parts.push(synchro)
  return parts.join(' ')
}

/** Die anderen Ausgaben desselben Titels, verlinkt und benannt (Begründung im Kommentar darin). */
function weitereAusgaben(release: Release, title: Title | undefined, geschwister: Release[]): string {
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
  return andere
}

/** Wo ein Titel auf Deutsch läuft, mit den belegten Folgenbereichen (Begründung im Kommentar darin). */
function wegeAufDeutsch(release: Release, title: Title | undefined): string {
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
  return wegeBlock
}

/**
 * Der sichtbare Inhalt der Teilen-Seite, als fertiges HTML im `#root`.
 *
 * Meta-Angaben reichen für die Link-Vorschau, aber eine Seite ohne Text rankt
 * für nichts. Wer „Steel Ball Run deutsche Synchro" sucht, soll hier landen, und
 * dafür müssen die Wörter auf der Seite stehen.
 *
 * React räumt `#root` beim ersten Rendern leer. Das ist gewollt: Bis das
 * Bündel geladen ist, sieht der Besucher statt einer weißen Fläche schon den
 * Titel und die Termine.
 */
export function body(
  release: Release,
  title: Title | undefined,
  synopsis: SynopsenText | undefined,
  today: string,
  geschwister: Release[],
  ak: number,
  adresse: string,
  umfeld: Umfeld,
): string {
  const events = expandEvents(release)
  const next = events.find((e) => e.date >= today) ?? events[0]
  const adresseImKalender = titelAdresse(ak, adresse, next?.date)
  const art = RELEASE_TYPES[release.releaseType].short
  const platform = anbieterName(release.platform, release.sender)

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
      const folge = anzeigeFolge(e) ? `Folge ${e.episode}${e.episodeCount ? ` von ${e.episodeCount}` : ''}: ` : ''
      const abgeleitet = e.estimated ? ' (Termin abgeleitet)' : ''
      return `<li>${esc(`${folge}${wann}${zeit}${abgeleitet}`)}</li>`
    })
    .join('\n        ')

  const andere = weitereAusgaben(release, title, geschwister)
  const wegeBlock = wegeAufDeutsch(release, title)

  return `<article style="max-width:52rem;margin:0 auto;padding:2rem 1.25rem;color:#d7dced;font-family:system-ui,sans-serif;line-height:1.6;">
      ${umfeld.krumenHtml}
      <h1 style="font-size:1.6rem;margin:0 0 .5rem;color:#fff;">${esc(release.name)}</h1>
      <p style="margin:0 0 1rem;color:#9aa5bd;">${esc(fakten.join(' · '))}</p>${namenZeile(title, release.name)}
      ${synopsenAbsatz(synopsis)}
      ${release.note ? `<p style="margin:0 0 1.5rem;color:#9aa5bd;">${esc(release.note)}</p>` : ''}
      <h2 style="font-size:1.1rem;margin:0 0 .5rem;color:#fff;">${termineUeberschrift(title)}</h2>
      <ul style="margin:0 0 1.5rem;padding-left:1.2rem;">
        ${termine || '<li>Noch kein Termin erfasst.</li>'}
      </ul>
      ${wegeBlock}
      ${andere}
      ${umfeld.aehnlichHtml}
      <p><a href="${esc(SITE + adresseImKalender)}" style="color:#7dd3fc;">Im Kalender ansehen</a></p>
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
function strukturierteDaten(release: Release, title: Title | undefined, today: string, url: string): string {
  const events = expandEvents(release)
  const next = events.find((e) => e.date >= today) ?? events[0]

  const istFilm = title?.format === 'MOVIE'
  const daten: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': istFilm ? 'Movie' : 'TVSeries',
    name: release.name,
    url,
    ...sprachFeld(title),
    /* Dieselbe Beschreibung wie im og:description — eine Auskunft, eine Quelle. */
    description: describe(release, title, today),
  }
  const andere = andereNamen(title, release.name)
  if (andere.length) daten.alternateName = andere

  /* Nur setzen, was wirklich dasteht — ein leeres Feld ist schlechter als keins. */
  if (title?.genres?.length) daten.genre = title.genres.slice(0, 5).map((g) => GENRE_DE[g] ?? g)
  if (!istFilm && title?.episodes) daten.numberOfEpisodes = title.episodes
  if (title?.jpYear) daten.datePublished = String(title.jpYear)
  daten.image = `${SITE}og/${release.slug}.jpg?v=${OG_FASSUNG}`

  /*
    Der Termin als eigenes Ereignis. `BroadcastEvent` passt für eine
    Ausstrahlung, `PublicationEvent` für eine Veröffentlichung — bei einer
    Disc oder einem Streaming-Start ist das Zweite richtig.
  */
  if (next?.date) {
    daten.releasedEvent = {
      '@type': 'PublicationEvent',
      startDate: next.date,
      location: { '@type': 'VirtualLocation', name: anbieterName(release.platform, release.sender) },
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

export function head(release: Release, title: Title | undefined, today: string, ak: number, adresse: string, umfeld: Umfeld): string {
  const events = expandEvents(release)
  const next = events.find((e) => e.date >= today) ?? events[0]
  const url = `${SITE}${teilenPfad(adresse)}`
  const image = `${SITE}og/${release.slug}.jpg?v=${OG_FASSUNG}`
  const headline = seitenTitel(release.name, title, true)
  const description = describe(release, title, today)
  const hash = titelHash(ak, adresse, next?.date)

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
${strukturierteDaten(release, title, today, url)}
${umfeld.krumenJsonLd}
    <script>
      // Läuft vor dem Modul-Skript der App, weil klassische Inline-Skripte
      // nicht deferred sind. Nur setzen, wenn der Besucher nicht schon selbst
      // einen Hash mitgebracht hat.
      if (!location.hash) location.hash = ${JSON.stringify(hash)};
    </script>`
}
