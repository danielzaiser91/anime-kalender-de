/**
 * **Lief nur noch früher im Fernsehen: der letzte Termin je Sender** (Daniel, 09.10.2026, Super
 * Wings: Die TV-Leiste kannte den Titel, das Panel sagte „Kein Anbieter bekannt").
 *
 * Eine TV-Pille ist ein Weg zur Folge, solange eine Sendung läuft oder kommt (`tvAngabe`). Ist
 * alles vorbei, zeigt das Panel den letzten Termin je Sender statt der Leere — als Auskunft,
 * nicht als Weg. Geliefert wird nur, wenn kein einziger TV-Termin mehr aussteht.
 */
import type { Release } from '@shared/types.ts'
import { expandEvents } from '@shared/logic.ts'
import { formatDate } from '@shared/time.ts'

export interface TvZuletzt {
  release: Release
  /** „Fg. 27 · 08.10.2026 · 11:00" */
  text: string
}

export function tvZuletzt(releases: Release[], heute: string, jetztZeit: string): TvZuletzt[] {
  const jetzt = `${heute}T${jetztZeit}`
  const mitTermin = releases
    .filter((r) => r.platform === 'tv')
    .map((release) => ({
      release,
      termine: expandEvents(release)
        .map((e) => ({ e, start: `${e.date}T${e.time ?? '00:00'}` }))
        .sort((a, b) => b.start.localeCompare(a.start)),
    }))
  const steht = mitTermin.some(
    ({ release, termine }) =>
      termine[0]?.start > jetzt || (release.sendungen ?? []).some((s) => s.start <= jetzt && jetzt < s.ende),
  )
  if (steht) return []
  return mitTermin.flatMap(({ release, termine: [letzter] }) => {
    if (!letzter) return []
    const nr = letzter.e.episode && !letzter.e.sichtung ? letzter.e.episode : release.sendungen?.find((s) => s.start === letzter.start)?.nr
    return [{ release, text: [nr ? `Fg. ${nr}` : undefined, formatDate(letzter.e.date), letzter.e.time].filter(Boolean).join(' · ') }]
  })
}
