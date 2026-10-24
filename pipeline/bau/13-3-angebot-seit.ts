import { readJson, log } from '../lib/util.ts'
import { type MotnDaten, LEER as MOTN_LEER } from '../lib/motn.ts'
import { type PlatformId, type Release, type Title } from '../../shared/types.ts'
import { todayIso } from '../../shared/time.ts'
import { type SlimTitel } from './13-2-auslieferung.ts'
import { erfassungsStichtage, stichtagSchluessel } from './angebot-stichtag.ts'
import { titelMitTermin } from './titel-mit-termin.ts'
import { mitFeedSeit, type MotnChanges } from './angebot-feed.ts'

type TmdbKennung = { tmdbId?: string; kind?: string }
type MotnShow = MotnDaten['shows'][string]

const MOTN_API = 'https://www.movieofthenight.com/about/api'

/**
 * Der früheste Anbieter gewinnt — er hat den Titel zuerst gehabt. Gezählt
 * wird nur, wo wir auch einen Verweis führen: Ein Datum zu einem Anbieter,
 * auf den wir gar nicht verlinken, hilft niemandem weiter.
 */
function fruehesterAnbieter(show: MotnShow, title: Title, stichtage: Set<string>): { anbieter: PlatformId; seit: string } | undefined {
  const unsere = new Set((title.streams ?? []).map((x) => x.platform))
  const kandidaten = Object.entries(show.dienste ?? {})
    .filter(([anbieter, d]) => d.seit && unsere.has(anbieter as PlatformId) && !stichtage.has(stichtagSchluessel(anbieter, d.seit)))
    .sort((a, b) => (a[1].seit ?? '').localeCompare(b[1].seit ?? ''))
  const bester = kandidaten[0]
  return bester ? { anbieter: bester[0] as PlatformId, seit: bester[1].seit! } : undefined
}

function angebotRelease(title: Title, anbieter: PlatformId, seit: string): Release {
  const verweis = title.streams?.find((x) => x.platform === anbieter)
  return {
    slug: `motn-${title.id}-${anbieter}`,
    titleId: title.id,
    name: title.titleDe ?? title.titleEn ?? title.titleRomaji ?? String(title.id),
    platform: anbieter,
    platformUrl: verweis?.url,
    releaseType: title.format === 'MOVIE' ? 'movie' : 'batch',
    dateMeaning: 'available-from',
    schedule: {
      firstEpisodeDate: seit,
      episodeCount: title.episodes ?? 1,
      lastEpisodeDate: seit,
    },
    year: Number(seit.slice(0, 4)),
    sources: [MOTN_API],
    quellen: [
      {
        url: MOTN_API,
        name: 'movieofthenight.com',
        gesehenAm: todayIso(),
        sagt: seit,
        stand: 'aktuell',
      },
    ],
  } as Release
}

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
export function ergaenzeAngebotSeit({ slim, releases, titles, quellen }: { slim: SlimTitel[]; releases: Release[]; titles: Map<number, Title>; quellen?: { motn: MotnDaten; tmdb: Record<string, TmdbKennung>; changes?: MotnChanges } }): void {
  const GRENZE = '2026-01-01'
  const changes = quellen?.changes ?? readJson<MotnChanges>('data/motn-changes.json', {})
  const monatsstand = quellen?.motn ?? readJson<MotnDaten>('data/motn.json', MOTN_LEER)
  const motnDaten = mitFeedSeit(monatsstand, changes)
  const tmdbFuerTermine = quellen?.tmdb ?? readJson<Record<string, TmdbKennung>>('data/tmdb-titles.json', {})
  const nachImdb = new Map(
    Object.entries(motnDaten.shows ?? {}).map(([k, v]) => [v.imdbId ?? k, v]),
  )
  const hatTermin = titelMitTermin(releases)
  const stichtage = erfassungsStichtage(Object.values(monatsstand.shows ?? {}))
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

    const bester = fruehesterAnbieter(show, title, stichtage)
    if (!bester) continue
    const { anbieter, seit } = bester

    /*
      Am Titel steht es immer — das Panel zeigt es auch ohne Kalendereintrag.

      **Und zwar an beiden Fassungen.** `slim` entsteht weiter oben aus
      Kopien; wer nur `titles` beschreibt, sieht sein Feld im ausgelieferten
      Datensatz nie wieder. Der erste Lauf schrieb 329-mal ein Feld, das
      nirgends ankam (27.08.2026).
    */
    const angebot = { platform: anbieter, date: seit }
    title.angebotSeit = angebot
    const ausgeliefert = slim.find((x) => x.id === title.id)
    if (ausgeliefert) ausgeliefert.angebotSeit = angebot
    nurAmTitel++

    if (seit < GRENZE) continue
    releases.push(angebotRelease(title, anbieter, seit))
    alsTermin++
  }
  if (nurAmTitel) {
    log(
      `${nurAmTitel} Titel ohne Termin tragen jetzt ein „Im Angebot seit" ` +
        `(${alsTermin} davon aus ${GRENZE.slice(0, 4)} auch als Kalendereintrag)`,
    )
  }
}
