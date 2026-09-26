import { clearDir, writeText, slugify, log } from '../lib/util.ts'
import { OUT } from './grundlagen.ts'
import { newsRss } from '../lib/news-rss.ts'
import { addDays, todayIso } from '../../shared/time.ts'
import { buildIcs } from '../../shared/ics.ts'
import { type ReleaseEvent, type PlatformId, type Title, type DataMeta } from '../../shared/types.ts'
import type { NewsEintrag } from '../../shared/types.ts'

export function schreibeAboFeeds({ newsFuerRss, events, platforms, allTitles, genres, meta, keywords }: {
  newsFuerRss: NewsEintrag[] | undefined
  events: ReleaseEvent[]
  platforms: PlatformId[]
  allTitles: Title[]
  genres: string[]
  meta: DataMeta
  keywords: string[]
}) {
  // Erst leeren: Genres kommen und gehen, sonst blieben alte Feeds als Leichen
  // im Repository liegen und würden weiter ausgeliefert.
  clearDir(`${OUT}/feeds`)
  /*
    Der News-Feed entsteht erst nach dem Leeren des Ordners. Am 18.09.2026 stand er
    davor — der erste Bau schrieb ihn und löschte ihn zwölf Zeilen später wieder.
  */
  if (newsFuerRss) writeText(`${OUT}/feeds/news.xml`, newsRss(newsFuerRss, process.env.SITE_URL ?? 'https://anime-kalender.de/'))
  /**
   * Wie viel Vergangenheit ein Abo mitbringt.
   *
   * Gemessen am 20.08.2026: `all.ics` führte 742 Termine, davon **641 in der
   * Vergangenheit**, zurück bis zum 12.01.2015. Wer das Abo einträgt, bekam
   * zehn Jahre alte Einträge in seinen Kalender.
   *
   * Eine Woche, nicht ein Jahr — Daniel am 21.08.2026: „wenn jemand heute ein
   * abo abschließt ist er nur an zukünftigen interessiert, also max 1 woche
   * zurück". Die Woche fängt den einen Fall ab, für den Vergangenes im Abo
   * zählt: eine Folge, die man vor ein paar Tagen verpasst hat.
   *
   * Die Seite selbst ist davon **nicht** betroffen — `events.json` bleibt
   * vollständig, die Vergangenheit ist dort weiter durchblätterbar. Es geht
   * allein um das, was in fremde Kalender wandert.
   */
  const ABO_RUECKBLICK_TAGE = 7
  const aboGrenze = addDays(todayIso(), -ABO_RUECKBLICK_TAGE)
  const aboEvents = events.filter((e) => e.date >= aboGrenze)

  const siteUrl = process.env.SITE_URL ?? 'https://anime-kalender.de/'
  writeText(`${OUT}/feeds/all.ics`, buildIcs(aboEvents, { siteUrl, calendarName: 'Anime-Kalender DE' }))

  for (const platform of platforms) {
    const subset = aboEvents.filter((e) => e.platform === platform)
    if (!subset.length) continue
    writeText(
      `${OUT}/feeds/platform-${platform}.ics`,
      buildIcs(subset, { siteUrl, calendarName: `Anime-Kalender DE – ${platform}` }),
    )
  }

  const titleById = new Map(allTitles.map((t) => [t.id, t]))
  for (const genre of genres) {
    const subset = aboEvents.filter((e) => titleById.get(e.titleId)?.genres.includes(genre))
    if (subset.length < 3) continue
    writeText(
      `${OUT}/feeds/genre-${slugify(genre)}.ics`,
      buildIcs(subset, { siteUrl, calendarName: `Anime-Kalender DE – ${genre}` }),
    )
  }

  log(`Titel: ${meta.titleCount}`)
  log(`Releases: ${meta.releaseCount}`)
  log(`Termine: ${meta.eventCount}`)
  log(`Abo-Feeds: ${aboEvents.length} Termine (Rückblick ${ABO_RUECKBLICK_TAGE} Tage, ab ${aboGrenze})`)
  log(`Genres: ${genres.length}, Keywords: ${keywords.length}`)
}
