import { readJson, log, slugify } from '../lib/util.ts'
import {
  type CrunchyrollData,
  type WochenFolgeRoh,
  wocheAnhaengen,
  type CrunchyrollEntry,
  crunchyrollSeriesId,
  normalizeTitle,
} from '../lib/crunchyroll.ts'
import { type Title } from '../../shared/types.ts'
import { type KatalogEintrag } from '../lib/anilist.ts'

export function indiziereCrSendeplaetze({ titles }: {
  titles: Map<number, Title>
}) {
  const crunchyroll = readJson<CrunchyrollData>('data/crunchyroll.json', {
    scrapedAt: '',
    german: {},
    slots: [],
  })
  /*
    **Kommende Synchro-Folgen aus Crunchyrolls Wochenprogramm** (25.09.2026). Der Kalender führt
    sie nicht; `scrape-crunchyroll-woche.ts` hat nach der mit Daniel festgelegten Regel entschieden,
    welche anschließen. Sie werden nur **angehängt** — eine gemessene Folge bleibt, wie sie ist.
  */
  const woche = readJson<{ uebernommen?: WochenFolgeRoh[] }>('data/crunchyroll-woche.json', {})
  const wocheAngehaengt = wocheAnhaengen(crunchyroll.german, woche.uebernommen ?? [])
  if (wocheAngehaengt) log(`Wochenprogramm: ${wocheAngehaengt} kommende Synchro-Folgen an den Crunchyroll-Kalender gehängt`)
  const crBySeriesId = new Map<string, CrunchyrollEntry>()
  for (const entry of Object.values(crunchyroll.german)) {
    if (entry.seriesId) crBySeriesId.set(entry.seriesId, entry)
  }
  /**
   * Wie weit der Kalender inhaltlich reicht — der letzte Tag, für den er
   * überhaupt eine deutsche Folge führt.
   *
   * Nicht zu verwechseln mit `crunchyroll.window.to`: Das ist der abgesuchte
   * Zeitraum, also wie weit **wir gefragt** haben. Am 21.08.2026 ging der Abruf
   * bis zum 30.08., die letzte deutsche Kachel im gesamten Kalender stand aber
   * auf dem 19.08. — Crunchyroll kündigt Synchronfolgen praktisch nicht vor.
   * Nur gegen diese Marke gemessen sagt ein fehlender Folgetermin etwas aus.
   */
  const crKalenderBis = Object.values(crunchyroll.german)
    .flatMap((e) => e.dates ?? [])
    .sort()
    .at(-1)
  /**
   * AniList-Titel über ihre Crunchyroll-Serien-ID auffindbar machen.
   *
   * Bewusst eine Liste je Serie, kein einzelner Titel: Crunchyroll führt alle
   * Staffeln und Specials einer Reihe unter derselben Serien-ID. Wer hier nur
   * den ersten Treffer behält, ordnet jede Folge willkürlich irgendeiner
   * Staffel zu — so landete „I am a hero too" bei Staffel 6.
   */
  const titlesByCrSeries = new Map<string, Title[]>()
  for (const title of titles.values()) {
    for (const stream of title.streams) {
      const id = stream.platform === 'crunchyroll' ? crunchyrollSeriesId(stream.url) : undefined
      if (!id) continue
      const list = titlesByCrSeries.get(id)
      if (list) {
        if (!list.includes(title)) list.push(title)
      } else {
        titlesByCrSeries.set(id, [title])
      }
    }
  }

  /** AniList-Titel über ihren normalisierten Namen auffindbar machen. */
  const titleByName = new Map<string, Title>()
  for (const title of titles.values()) {
    for (const name of [title.titleRomaji, title.titleEn, title.titleNative]) {
      const key = name ? normalizeTitle(name) : ''
      if (key && !titleByName.has(key)) titleByName.set(key, title)
    }
  }

  /**
   * Einen AniList-Titel zu einem Kalendernamen finden.
   *
   * Crunchyroll setzt im Kalender gern zwei Namen hintereinander — den
   * deutschen und den englischen („Elainas Reise Wandering Witch: The Journey
   * of Elaina") oder die Serie und ihren Untertitel („Fruits Basket (2019)
   * Fruits Basket: The Final Season"). Ein Vergleich auf den ganzen String
   * findet dann nichts. Deshalb wird der Name von vorne verkürzt und der
   * längste Treffer genommen; unter zwei Wörtern wird nicht mehr gesucht,
   * sonst trifft irgendwann jedes „Season 2".
   */
  /**
   * Der Katalog als Rückfallebene — die Metadaten liegen im Haus.
   *
   * `data/cache/anilist-katalog.json` führt rund 3.000 Titel mit Namen,
   * Format, Jahr, Genres und Cover. Wer hier nicht nachsieht, fragt AniList
   * nach etwas, das er schon hat — und steht mit leeren Händen da, wenn die
   * Quelle ausfällt (23.08.2026, „Jaadugar: A Witch in Mongolia").
   *
   * Gesucht wird über **alle drei** Schreibweisen: Der Crunchyroll-Kalender
   * nennt mal den englischen, mal den Romaji-Titel.
   */
  /** Einmal gelesen, nicht je Aufruf — die Datei hat rund 3.000 Eintraege. */
  const katalogEintraege = readJson<{ eintraege?: KatalogEintrag[] }>('data/cache/anilist-katalog.json', {}).eintraege ?? []

  function titelAusKatalog(name: string): Title | undefined {
    const gesucht = normalizeTitle(name)
    if (!gesucht) return undefined
    /**
     * Der Kalendername traegt einen Zusatz, der Katalogtitel nicht.
     *
     * Crunchyroll nennt die Reihe "Jaadugar: A Witch in Mongolia Staffel 1",
     * AniList "Jaadugar: A Witch in Mongolia". Ein exakter Vergleich findet
     * deshalb nichts -- gesucht wird nach dem laengsten Katalogtitel, der
     * am Anfang des Kalendernamens steht.
     *
     * Der laengste, nicht der erste: "Dragon Ball" waere sonst ein Treffer
     * fuer "Dragon Ball Super Staffel 2".
     */
    let bester: { eintrag: KatalogEintrag; laenge: number } | undefined
    for (const e of katalogEintraege) {
      for (const schreibweise of e.t) {
        if (!schreibweise) continue
        const kandidat = normalizeTitle(schreibweise)
        if (!kandidat || kandidat.length < 4) continue
        if (gesucht !== kandidat && !gesucht.startsWith(kandidat + ' ')) continue
        if (bester && bester.laenge >= kandidat.length) continue
        bester = { eintrag: e, laenge: kandidat.length }
      }
    }
    if (bester) {
      {
        const e = bester.eintrag
        /**
         * Ein Titel aus dem Katalog ist ein vollwertiger Titel — er trägt
         * dieselben Felder, nur aus einer anderen Quelle. Er wird in den
         * Bestand aufgenommen, damit ihn auch Suche und Detail-Panel finden.
         */
        const vorhanden = titles.get(e.id)
        if (vorhanden) return vorhanden
        const anzeige = e.t[1] ?? e.latein ?? e.t[0] ?? String(e.id)
        const neu: Title = {
          id: e.id,
          slug: `${slugify(anzeige)}-${e.id}`,
          keywords: [],
          /**
           * Ein Titel aus dem Katalog belegt keine Synchro -- er belegt nur,
           * dass es den Anime gibt. `low` ist deshalb richtig: Der Termin
           * daneben stammt aus dem Crunchyroll-Kalender, die Sprachfassung
           * muss weiterhin belegt werden.
           */
          dubConfidence: 'low' as const,
          titleRomaji: e.t[0] ?? undefined,
          titleEn: e.t[1] ?? e.latein ?? undefined,
          titleNative: e.t[2] ?? undefined,
          format: e.format ?? undefined,
          jpYear: e.jahr ?? undefined,
          episodes: e.folgen ?? undefined,
          genres: e.genres?.length ? [...e.genres] : [],
          coverImage: e.cover ? `https://s4.anilist.co/file/anilistcdn/media/anime/cover/${e.cover}` : undefined,
          streams: [],
        }
        titles.set(e.id, neu)
        log(`  Titel aus dem Katalog ergänzt: ${e.id} (${e.t[0] ?? e.t[1]})`)
        return neu
      }
    }
    return undefined
  }

  function titleForCalendarName(name: string): Title | undefined {
    const words = normalizeTitle(name).split(' ').filter(Boolean)
    for (let start = 0; start <= words.length - 2; start++) {
      const hit = titleByName.get(words.slice(start).join(' '))
      if (hit) return hit
    }
    return undefined
  }

  /** Staffelnummer aus einem Namen, sofern er eine nennt. */
  function seasonNumber(name: string | undefined): number | undefined {
    const match = name ? normalizeTitle(name).match(/\bs(\d+)\b/) : null
    return match ? Number(match[1]) : undefined
  }

  /**
   * Aus allen Staffeln einer Crunchyroll-Serie die gemeinte heraussuchen.
   *
   * Der Rückfall auf die Serien-ID greift, wenn der Name nichts findet — bei
   * deutschen Kalendernamen also fast immer. Nennt der Kalender eine
   * Staffelnummer, muss der Titel sie auch tragen: „Meine Wiedergeburt als
   * Schleim … Staffel 4" hing sonst an „Slime Season 3", mitsamt deren
   * Folgenzahl, Cover und Beschreibung. Passt keine, bleibt der Titel lieber
   * leer — eine falsche Zuordnung ist schlechter als keine.
   */
  function titleFromSeries(
    seriesId: string,
    calendarName: string,
    year: number,
  ): Title | undefined {
    const candidates = titlesByCrSeries.get(seriesId) ?? []
    if (!candidates.length) return undefined
    const wanted = seasonNumber(calendarName)
    if (wanted === undefined) return candidates[0]

    const numberOf = (t: Title) => seasonNumber(t.titleEn) ?? seasonNumber(t.titleRomaji)
    const exact = candidates.find((t) => numberOf(t) === wanted)
    if (exact) return exact
    // Die erste Staffel trägt ihre Nummer meist nicht im Titel.
    if (wanted === 1) {
      const plain = candidates.find((t) => numberOf(t) === undefined)
      if (plain) return plain
    }
    // Viele Reihen nummerieren gar nicht, sondern geben jeder Staffel einen
    // eigenen Untertitel („Ascendance of a Bookworm: Adopted Daughter of an
    // Archduke"). Dann entscheidet das Ausstrahlungsjahr — und nur, wenn es
    // genau einen Kandidaten trifft. Bei zweien wäre es wieder geraten.
    const sameYear = candidates.filter((t) => t.jpYear && Math.abs(t.jpYear - year) <= 1)
    return sameYear.length === 1 ? sameYear[0] : undefined
  }

  function findCrunchyroll(entryUrl: string | undefined, name: string): CrunchyrollEntry | undefined {
    const id = crunchyrollSeriesId(entryUrl)
    return (id ? crBySeriesId.get(id) : undefined) ?? crunchyroll.german[normalizeTitle(name)]
  }
  return { findCrunchyroll, crKalenderBis, crunchyroll, titleForCalendarName, titleFromSeries, titelAusKatalog, titleByName, crBySeriesId, katalogEintraege }
}
