/**
 * **Kino und Stream eines Films gehören in einen Kasten** (Daniel, 17.09.2026:
 * „Meistens kommt Kinofilm wochen vor online streaming, manchmal zeitgleich,
 * manchmal streaming zuerst"). Vorher stand über einem Kinostart „Erste Folge
 * erscheint … Wöchentlich · 0 von 1 Folgen".
 *
 * Liegt in einer eigenen Datei, weil `berechneAntwort` die Längengrenze reißt.
 */
import { anbieterName, type Release, type Title } from '@shared/types.ts'
import { addDays } from '@shared/time.ts'
import type { Antwort } from './antwort-typ.ts'

export function filmTermine(
  releases: Release[],
  title: Title,
  today: string,
): Extract<Antwort, { art: 'filmDe' }> | null {
  const start = (r: Release) => r.schedule?.firstEpisodeDate
  /*
    **Was im Banner steht, steht nicht noch einmal im Kasten** (17.09.2026). „Ab
    29.09.2026 im Kino" stand nach dem Einbau zweimal untereinander.
  */
  const imBanner = (r: Release) => (r.cinemaUntil ? r.cinemaUntil >= today : (start(r) ?? '') >= addDays(today, -60))
  const reihe = (a: Release, b: Release) => (start(a) ?? '').localeCompare(start(b) ?? '')
  const kinoRel = releases.filter((r) => r.platform === 'kino' && start(r) && !imBanner(r)).sort(reihe)[0]
  const streamRel = releases
    .filter((r) => r.platform !== 'kino' && r.releaseType !== 'disc' && start(r))
    .sort(reihe)[0]
  if (!kinoRel && !streamRel) return null
  /* Ein Kinostart, der länger als 60 Tage zurückliegt, ist keine Auskunft mehr. */
  if (!streamRel && (start(kinoRel!) ?? '') < addDays(today, -60)) return null
  return {
    art: 'filmDe',
    kino: kinoRel ? { datum: start(kinoRel)!, raus: start(kinoRel)! <= today } : undefined,
    stream: streamRel
      ? { datum: start(streamRel)!, raus: start(streamRel)! <= today, anbieter: anbieterName(streamRel.platform, streamRel.sender) }
      : undefined,
    streamWege: Boolean(
      (title.streams ?? []).length || (title.watchLinks ?? []).some((w) => w.kind === 'stream'),
    ),
    verleih: kinoRel?.publisher ?? title.kino?.verleih,
    fassung: title.kino?.fassung,
  }
}
