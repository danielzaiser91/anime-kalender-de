import { expandEvents } from '../../shared/logic.ts'
import { type Release, type ReleaseEvent, type Title } from '../../shared/types.ts'

/*
  **Ein Joyn-Termin mit belegtem Abruffenster ist kein geschätzter** (Yaiba, 10.11.2026: „wieso steht da immer noch ~“).

  Ein Wochenplan mit Sendetagen und ohne `observed` belegt nur den Start (`terminGeschaetzt`, shared/logic.ts); alles danach
  trägt „~“. Das Fenster eines Joyn-Wegs entsteht aber aus den belegten Sendetagen (`setzeJoynFenster`, Phase 13-1). Fällt sein
  Beginn (Tag und Uhrzeit) mit dem Plan zusammen, steht der Tag für diese Folge fest und wird als Beobachtung übernommen.
  Weicht er ab oder fehlt das Fenster, bleibt der Termin geschätzt; Vorhandenes wird nie überschrieben.

  Die Ereignisse entstehen schon in Phase 10, vor den Fenstern: Für die geänderten Pläne wird deshalb nur `estimated` der
  bestehenden Ereignisse (gleiche `id`) nachgezogen, sonst bliebe `events.json` bei „~“.
*/
export function belegeJoynTermine(allTitles: Title[], releases: Release[], events: ReleaseEvent[]): number {
  const titelNachId = new Map(allTitles.map((t) => [t.id, t]))
  const ereignisNachId = new Map(events.map((e) => [e.id, e]))
  let belegt = 0
  for (const r of releases) {
    if (r.platform !== 'joyn' || !r.schedule.wochentage?.length) continue
    const fenster = (titelNachId.get(r.titleId)?.streams ?? []).find((s) => s.platform === 'joyn')?.fenster ?? []
    if (!fenster.length) continue
    const plan = new Map(expandEvents(r).map((e) => [e.episode, e]))
    const vorher = belegt
    for (const f of fenster) {
      const geplant = plan.get(f.nr)
      if (!geplant || r.schedule.observed?.[f.nr]) continue
      if (`${geplant.date}T${geplant.time}` !== f.ab) continue
      r.schedule.observed ??= {}
      r.schedule.observed[f.nr] = geplant.date
      belegt++
    }
    if (belegt === vorher) continue
    for (const neu of expandEvents(r)) {
      const alt = ereignisNachId.get(neu.id)
      if (alt && neu.estimated === undefined) delete alt.estimated
    }
  }
  return belegt
}
