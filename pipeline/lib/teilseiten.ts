import type { PlatformId, StreamLink, Title } from '../../shared/types.ts'

/** Ein Titel, dessen Weg auf einer geteilten Seite steht, aber keinen belegten Folgenbereich bekam. */
export interface TeilseitenPruefung {
  titleId: number
  titel: string
  url: string
  grund: string
}

export function jahrRang(t: Title): number {
  return (t.jpYear ?? 0) * 100 + ({ WINTER: 1, SPRING: 2, SUMMER: 3, FALL: 4 }[t.jpSeason ?? ''] ?? 0)
}

/** Alle Titel je Adresse eines Anbieters, die sie mit mindestens einem anderen teilen, in der Reihenfolge der Ausstrahlung. */
export function geteilteAdressen(
  titles: Map<number, Title>,
  plattform: PlatformId,
): Map<string, { title: Title; stream: StreamLink }[]> {
  const je = new Map<string, { title: Title; stream: StreamLink }[]>()
  for (const title of titles.values()) {
    for (const stream of title.streams) {
      if (stream.platform !== plattform || !stream.sharedWith) continue
      je.set(stream.url, [...(je.get(stream.url) ?? []), { title, stream }])
    }
  }
  for (const liste of je.values()) liste.sort((a, b) => jahrRang(a.title) - jahrRang(b.title) || a.title.id - b.title.id)
  return je
}
