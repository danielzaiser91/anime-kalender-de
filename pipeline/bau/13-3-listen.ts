import { readJson, log, writeJson } from '../lib/util.ts'
import { type MotnDaten, LEER as MOTN_LEER } from '../lib/motn.ts'
import { berichtigeNetflixOverlay } from './13-3-0-netflix-overlay.ts'
import { ergaenzeWegeAusTmdbUndMotn } from './13-3-1-tmdb-wege.ts'
import { ergaenzeAngebotSeit } from './13-3-angebot-seit.ts'
import { type Release, type Title } from '../../shared/types.ts'
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
  const netflixBerichtigt = berichtigeNetflixOverlay(slim)
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
  ergaenzeAngebotSeit({ slim, releases, titles })

  writeJson(`${OUT}/titles.json`, slim.map((t) => mitSperre(mitAnkuendigung(t), fanservicesperre())))
}
