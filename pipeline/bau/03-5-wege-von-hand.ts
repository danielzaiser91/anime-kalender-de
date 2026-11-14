import { loadWatchLinks } from '../lib/curated.ts'
import { warn } from '../lib/util.ts'
import { type PlatformId, type Title } from '../../shared/types.ts'

export function ergaenzeWegeVonHand({ titles }: {
  titles: Map<number, Title>
}) {
  for (const entry of loadWatchLinks()) {
    const title = titles.get(entry.anilistId)
    if (!title) {
      warn(`watch-links.yaml: AniList-ID ${entry.anilistId} (${entry.title ?? '?'}) ist unbekannt`)
      continue
    }
    const existing = (title.watchLinks ?? []).filter((e) => !(entry.links ?? []).some((l) => l.ersetzt && l.name === e.name)) // `ersetzt: true`: die Handadresse ersetzt den gleichnamigen Weg
    const curated = (entry.links ?? []).filter((l) => !existing.some((e) => e.url === l.url))
    /**
     * Eine von Hand herausgesuchte Produktseite ersetzt die Suche.
     *
     * AniList liefert fuer die meisten Titel keinen Deeplink, deshalb steht dort
     * ein Suchlink — am 20.08.2026 bei **225 von 226** Prime-Verweisen. Wer die
     * echte Adresse eintraegt, hat nachgesehen; das schlaegt die Suche.
     */
    for (const s of entry.streams ?? []) {
      const vorhanden = title.streams.find((x) => x.platform === s.platform)
      if (vorhanden) vorhanden.url = s.url
      else title.streams.push({ platform: s.platform as PlatformId, url: s.url })
    }
    title.watchLinks = [...curated, ...existing].sort((a, b) =>
      a.kind === b.kind ? 0 : a.kind === 'stream' ? -1 : 1,
    )
  }
}
