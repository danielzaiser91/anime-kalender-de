import { expandEvents } from '../../shared/logic.ts'
import { type Release, type Title } from '../../shared/types.ts'

/*
  **Ein Joyn-Termin mit belegtem Abruffenster ist kein geschätzter** (Yaiba, 10.11.2026: „wieso steht da immer noch ~“).

  Ein Wochenplan mit Sendetagen und ohne `observed` belegt nur den Start (`terminGeschaetzt`, shared/logic.ts); alles danach
  trägt „~“. Das Fenster eines Joyn-Wegs entsteht aber aus den belegten Sendetagen (`setzeJoynFenster`). Fällt sein Beginn
  (Tag und Uhrzeit) mit dem Plan zusammen, steht der Tag für diese Folge fest und wird als Beobachtung übernommen. Weicht er
  ab oder fehlt das Fenster, bleibt der Termin geschätzt; Vorhandenes wird nie überschrieben.
*/
export function belegeJoynTermineAusFenstern(allTitles: Title[], releases: Release[]): number {
  const titelNachId = new Map(allTitles.map((t) => [t.id, t]))
  let belegt = 0
  for (const r of releases) {
    if (r.platform !== 'joyn' || !r.schedule.wochentage?.length) continue
    const fenster = (titelNachId.get(r.titleId)?.streams ?? []).find((s) => s.platform === 'joyn')?.fenster ?? []
    if (!fenster.length) continue
    const plan = new Map(expandEvents(r).map((e) => [e.episode, e]))
    for (const f of fenster) {
      const geplant = plan.get(f.nr)
      if (!geplant || r.schedule.observed?.[f.nr]) continue
      if (`${geplant.date}T${geplant.time}` !== f.ab) continue
      r.schedule.observed ??= {}
      r.schedule.observed[f.nr] = geplant.date
      belegt++
    }
  }
  return belegt
}
