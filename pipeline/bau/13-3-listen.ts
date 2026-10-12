import { readJson, log, writeJson } from '../lib/util.ts'
import { type MotnDaten, LEER as MOTN_LEER } from '../lib/motn.ts'
import { ergaenzeWegeAusTmdbUndMotn } from './13-3-1-tmdb-wege.ts'
import { type PlatformId, type Release, type Title } from '../../shared/types.ts'
import { todayIso } from '../../shared/time.ts'
import { OUT, mitAnkuendigung } from './grundlagen.ts'
import { fanservicesperre, mitSperre } from './sperre.ts'
import { type TmdbTitelEintrag } from './01-quellen.ts'
import { type SlimTitel } from './13-2-auslieferung.ts'

export function schreibeListen({ slim, tmdbTitles, releases, titles }: {
  slim: SlimTitel[]
  tmdbTitles: Record<string, TmdbTitelEintrag>
  releases: Release[]
  titles: Map<number, Title>
}) {
  /**
   * **Jetzt** die Such-Verweise ersetzen — auf dem, was gleich geschrieben wird.
   *
   * Prime-Video-Verweise stammen aus dem aniSearch-Bestand, und dort steht
   * meist eine **Suche** statt einer Titelseite. Wer darauf klickt, muss den
   * richtigen Treffer selbst heraussuchen. Selbst nachsehen können wir nicht:
   * `amazon.de/robots.txt` sperrt ClaudeBot namentlich mit `Disallow: /`.
   *
   * Die Adressen liegen im MOTN-Archiv — `pipeline/motn-links.ts` zieht sie
   * ohne einen einzigen neuen Abruf heraus. Genau dafür archiviert dieses
   * Projekt Rohantworten.
   *
   * Ersetzt wird ausschließlich eine Suchadresse: Ein Verweis, der schon auf
   * einen Titel zeigt, ist von Hand geprüft oder stammt aus einer Quelle, die
   * ihn genauer kennt.
   */
  const motnLinks = readJson<{ links: Record<string, Record<string, string>> }>(
    'data/motn-links.json',
    { links: {} },
  ).links
  const motnTmdb = readJson<MotnDaten>('data/motn.json', MOTN_LEER).tmdb ?? {}
  const tmdbZuTitel = readJson<Record<string, { tmdbId?: number; kind?: string }>>(
    'data/tmdb-titles.json',
    {},
  )
  /**
   * Netflix: `/browse?jbv=<id>` ist ein Overlay, keine Seite.
   *
   * Die Adressform öffnet die Browse-Ansicht und legt eine Karte darüber. Wer
   * sie teilt oder ohne Anmeldung aufruft, landet auf einer Startseite mit
   * einem Fenster, das sich nicht immer aufbaut — Daniel am 24.08.2026 zu
   * „AnoHana": „der titel lässt sich nicht abspielen, kein melden möglich von
   * der overview".
   *
   * `/title/<id>` ist dieselbe Kennung auf der eigentlichen Titelseite.
   * Betroffen sind zwei Verweise; die Normalisierung steht hier trotzdem,
   * damit auch der dritte gar nicht erst durchkommt.
   */
  let netflixBerichtigt = 0
  for (const eintrag of slim) {
    for (const s of eintrag.streams ?? []) {
      if (s.platform !== 'netflix') continue
      const id = /\/browse\?jbv=(\d+)/.exec(s.url)?.[1]
      if (!id) continue
      s.url = `https://www.netflix.com/title/${id}`
      netflixBerichtigt++
    }
  }
  if (netflixBerichtigt) {
    log(`${netflixBerichtigt} Netflix-Overlay-Adressen auf die Titelseite umgeschrieben`)
  }

  let tiefeErsetzt = 0
  for (const eintrag of slim) {
    const suchen = (eintrag.streams ?? []).filter((s) => /\/s\?/.test(s.url))
    if (!suchen.length) continue
    const zu = tmdbZuTitel[String(eintrag.id)]
    if (!zu?.tmdbId || !zu.kind) continue
    const imdb = motnTmdb[`${zu.kind}/${zu.tmdbId}`]?.imdbId
    if (!imdb) continue
    for (const s of suchen) {
      const adresse = motnLinks[imdb]?.[s.platform]
      if (!adresse) continue
      s.url = adresse
      tiefeErsetzt++
    }
  }
  if (tiefeErsetzt) {
    log(`${tiefeErsetzt} Such-Verweise durch die echte Titelseite ersetzt (MOTN-Archiv)`)
  }

  ergaenzeWegeAusTmdbUndMotn({ slim, tmdbTitles, tmdbZuTitel, motnTmdb, motnLinks })




  /**
   * „Im Angebot seit" — für Titel, die sonst gar kein Datum hätten.
   *
   * 1.089 Titel mit belegter deutscher Synchro haben keinen einzigen Termin.
   * Sie sind nicht falsch, nur alt: erschienen, bevor der Kalender sie kannte.
   * Im Detail-Panel steht dann nichts, wo eine Zeitangabe hingehört.
   *
   * MOTN führt für 340 davon ein `availableSince` — die Angabe des Anbieters,
   * seit wann er den Titel listet. **Das ist nicht das Erscheinungsdatum der
   * deutschen Fassung**, und deshalb trägt der Eintrag `dateMeaning:
   * 'available-from'`; die Oberfläche schreibt „Im Angebot seit".
   *
   * **Nur was 2026 dazukam, wird ein Kalendereintrag.** Daniels Entscheidung am
   * 27.08.2026: 201 Einträge aus diesem Jahr sind noch von Interesse, die 139
   * aus 2024 und 2025 würden die Vergangenheitsansicht fluten, ohne jemandem zu
   * helfen. Ihr Datum steht trotzdem am Titel und damit im Panel.
   */
  {
    const GRENZE = '2026-01-01'
    const motnDaten = readJson<MotnDaten>('data/motn.json', MOTN_LEER)
    const tmdbFuerTermine = readJson<Record<string, { tmdbId?: string; kind?: string }>>(
      'data/tmdb-titles.json',
      {},
    )
    const nachImdb = new Map(
      Object.entries(motnDaten.shows ?? {}).map(([k, v]) => [v.imdbId ?? k, v]),
    )
    const hatTermin = new Set(releases.map((r) => r.titleId))
    let alsTermin = 0
    let nurAmTitel = 0

    for (const title of titles.values()) {
      if (hatTermin.has(title.id)) continue
      if (!title.streams?.some((x) => x.dub === true)) continue
      const t = tmdbFuerTermine[title.id]
      if (!t?.tmdbId) continue
      const imdb = motnDaten.tmdb?.[`${t.kind === 'movie' ? 'movie' : 'tv'}/${t.tmdbId}`]?.imdbId
      const show = imdb ? nachImdb.get(imdb) : undefined
      if (!show) continue

      /*
        Der früheste Anbieter gewinnt — er hat den Titel zuerst gehabt. Gezählt
        wird nur, wo wir auch einen Verweis führen: Ein Datum zu einem Anbieter,
        auf den wir gar nicht verlinken, hilft niemandem weiter.
      */
      const unsere = new Set(title.streams.map((x) => x.platform))
      const kandidaten = Object.entries(show.dienste ?? {})
        .filter(([anbieter, d]) => d.seit && unsere.has(anbieter as PlatformId))
        .sort((a, b) => (a[1].seit ?? '').localeCompare(b[1].seit ?? ''))
      const bester = kandidaten[0]
      if (!bester) continue
      const [anbieter, dienst] = bester
      const seit = dienst.seit!

      /*
        Am Titel steht es immer — das Panel zeigt es auch ohne Kalendereintrag.

        **Und zwar an beiden Fassungen.** `slim` entsteht weiter oben aus
        Kopien; wer nur `titles` beschreibt, sieht sein Feld im ausgelieferten
        Datensatz nie wieder. Der erste Lauf schrieb 329-mal ein Feld, das
        nirgends ankam (27.08.2026).
      */
      const angebot = { platform: anbieter as PlatformId, date: seit }
      title.angebotSeit = angebot
      const ausgeliefert = slim.find((x) => x.id === title.id)
      if (ausgeliefert) ausgeliefert.angebotSeit = angebot
      nurAmTitel++

      if (seit < GRENZE) continue
      const verweis = title.streams.find((x) => x.platform === anbieter)
      releases.push({
        slug: `motn-${title.id}-${anbieter}`,
        titleId: title.id,
        name: title.titleDe ?? title.titleEn ?? title.titleRomaji ?? String(title.id),
        platform: anbieter as PlatformId,
        platformUrl: verweis?.url,
        releaseType: title.format === 'MOVIE' ? 'movie' : 'batch',
        dateMeaning: 'available-from',
        schedule: {
          firstEpisodeDate: seit,
          episodeCount: title.episodes ?? 1,
          lastEpisodeDate: seit,
        },
        year: Number(seit.slice(0, 4)),
        sources: ['https://www.movieofthenight.com/about/api'],
        quellen: [
          {
            url: 'https://www.movieofthenight.com/about/api',
            name: 'movieofthenight.com',
            gesehenAm: todayIso(),
            sagt: seit,
            stand: 'aktuell',
          },
        ],
      } as Release)
      alsTermin++
    }
    if (nurAmTitel) {
      log(
        `${nurAmTitel} Titel ohne Termin tragen jetzt ein „Im Angebot seit" ` +
          `(${alsTermin} davon aus ${GRENZE.slice(0, 4)} auch als Kalendereintrag)`,
      )
    }
  }

  writeJson(`${OUT}/titles.json`, slim.map((t) => mitSperre(mitAnkuendigung(t), fanservicesperre())))
}
