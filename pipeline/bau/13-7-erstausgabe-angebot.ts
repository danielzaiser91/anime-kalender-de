import { log } from '../lib/util.ts'
import { type PlatformId, type Release, type Title } from '../../shared/types.ts'
import { todayIso } from '../../shared/time.ts'

/** Nur diese Verlagsnamen aus aniSearch sind eindeutig ein Streaming-Anbieter; „Crunchyroll", „KSM Anime" & Co. sind Disc-Verlage oder mehrdeutig. */
const ANBIETER_VON_VERLAG: Record<string, PlatformId> = {
  'Amazon.com, Inc.': 'primevideo',
  'Netflix, Inc.': 'netflix',
  'The Walt Disney Company': 'disneyplus',
}
const GRENZE = '2026-01-01'

/**
 * **„Im Angebot seit" aus aniSearchs Erstausgabe — für die Staffel, die der Plattformkatalog nicht kennt** (Magilumière Staffel 2, Daniel 05.10.2026).
 *
 * Der Weg über Movie of the Night (\`13-3-listen.ts\`) führt je **Serie** ein Datum: die zweite Staffel erbt das der ersten (2024) und fällt unter die Grenze, also
 * bekam sie nie einen Eintrag, obwohl ihre eigene Erstausgabe bei Prime Video am 04.07.2026 lag. Die aniSearch-Erstausgabe (\`deErstausgabe\`) gilt je Titel.
 *
 * Es entsteht nur, wo (1) der Titel noch **keinen** Termin hat, (2) die Erstausgabe ab 2026 liegt, (3) der Verlag ein Streaming-Anbieter ist, (4) wir auf diesen
 * Anbieter mit belegter Synchro verlinken. Ehrlich bleibt es durch \`dateMeaning: 'available-from'\` („Im Angebot seit") — kein Erscheinungstag je Folge.
 */
export function ergaenzeErstausgabeAngebot({ titles, releases }: { titles: Iterable<Title>; releases: Release[] }): number {
  const hatTermin = new Set(releases.map((r) => r.titleId))
  let neu = 0
  for (const t of titles) {
    const e = t.deErstausgabe
    const plattform = e?.publisher ? ANBIETER_VON_VERLAG[e.publisher] : undefined
    if (hatTermin.has(t.id) || !e?.von || e.von < GRENZE || !plattform) continue
    const verweis = t.streams.find((s) => s.platform === plattform && s.dub === true)
    if (!verweis) continue
    const quelle = t.anisearchId ? `https://www.anisearch.de/anime/${t.anisearchId}` : undefined
    releases.push({
      slug: `anisearch-${t.id}-${plattform}`,
      titleId: t.id,
      name: t.titleDe ?? t.titleEn ?? t.titleRomaji ?? String(t.id),
      platform: plattform,
      platformUrl: verweis.url,
      releaseType: t.format === 'MOVIE' ? 'movie' : 'batch',
      dateMeaning: 'available-from',
      schedule: { firstEpisodeDate: e.von, episodeCount: t.episodes ?? 1, lastEpisodeDate: e.von },
      year: Number(e.von.slice(0, 4)),
      sources: quelle ? [quelle] : [],
      ...(quelle ? { quellen: [{ url: quelle, name: 'anisearch.de', gesehenAm: todayIso(), sagt: e.von, stand: 'aktuell' as const }] } : {}),
    } as Release)
    neu++
  }
  if (neu) log(`${neu} Titel ohne Termin bekommen „Im Angebot seit" aus der aniSearch-Erstausgabe`)
  return neu
}
