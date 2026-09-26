import { type PlatformId, type DataMeta, type Title, type Release, type ReleaseEvent } from '../../shared/types.ts'

export function baueMeta({ titles, releases, events, motnBelege }: {
  titles: Map<number, Title>
  releases: Release[]
  events: ReleaseEvent[]
  motnBelege: number
}) {
  const allTitles = [...titles.values()]
  const genres = [...new Set(allTitles.flatMap((t) => t.genres))].sort((a, b) => a.localeCompare(b, 'de'))
  const keywords = [...new Set(allTitles.flatMap((t) => t.keywords))].sort((a, b) => a.localeCompare(b, 'de'))
  const platforms = [...new Set(releases.map((r) => r.platform))] as PlatformId[]
  const years = [...new Set(releases.map((r) => r.year))].sort((a, b) => b - a)

  // Bezugsquellen jenseits der neun bekannten Plattformen — maxdome, Apple TV,
  // Videobuster und die Prime-Video-Kanäle. Nach Häufigkeit sortiert, nicht
  // alphabetisch: Wer nach einem Anbieter filtert, sucht zuerst die großen, und
  // eine Liste von 42 Einträgen liest niemand von A bis Z durch.
  const providerCount = new Map<string, number>()
  for (const t of allTitles) {
    for (const w of t.watchLinks ?? []) providerCount.set(w.name, (providerCount.get(w.name) ?? 0) + 1)
  }
  const providers = [...providerCount.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de'))
    .map(([name]) => name)

  const meta: DataMeta = {
    generatedAt: new Date().toISOString(),
    titleCount: allTitles.length,
    releaseCount: releases.length,
    eventCount: events.length,
    genres,
    keywords,
    platforms,
    providers,
    years,
    attribution: [
      'Dub-Daten: MyDubList (https://mydublist.com) — CC BY 4.0',
      'Metadaten: AniList (https://anilist.co)',
      'FSK & Anbieter: TMDB (https://www.themoviedb.org), Anbieterdaten von JustWatch',
      'Deutsche Inhaltsangaben & Bezugsquellen: aniSearch (https://www.anisearch.de)',
      'ID-Zuordnung: anime-offline-database (https://github.com/manami-project/anime-offline-database) — ODbL v1.0',
      'Termine: aniSearch, Anime2You — siehe Quellenangabe je Eintrag',
      /*
        Die Markenzeichen an den Anbieter-Pillen. simple-icons steht unter CC0, verlangt
        also keine Nennung — genannt wird trotzdem, weil die Zeichen fremde Marken sind
        und der Leser wissen soll, woher sie stammen und wem sie gehören.
      */
      'Markenzeichen der Anbieter: simple-icons (https://simpleicons.org) — CC0, Wikimedia Commons (https://commons.wikimedia.org) — gemeinfrei, ADN-Wortmarke aus der französischen Wikipedia, maxdome-Zeichen nach „Maxdome Logo (2021)“ von videociety GmbH (CC BY-SA 4.0, zugeschnitten); die Marken gehören ihren Inhabern',
      /**
       * Pflicht, nicht Höflichkeit — und deshalb an dieselbe Zahl gebunden.
       *
       * Die Nutzungsbedingungen der Streaming Availability API verlangen einen
       * für Nutzer sichtbaren Hinweis mit Link. Er steht hier bedingt, damit
       * beides zusammen wahr bleibt: Ohne Hinweis kommt keine Angabe dieser
       * Quelle auf die Seite, und ohne eine solche Angabe nennen wir keine
       * Quelle, die wir gar nicht benutzt haben.
       */
      ...(motnBelege
        ? [
            'Welche Folgen auf Netflix eine deutsche Tonspur haben: Streaming Availability API ' +
              '(https://www.movieofthenight.com/about/api)',
          ]
        : []),
    ],
  }
  return { allTitles, meta, platforms, genres, keywords }
}
