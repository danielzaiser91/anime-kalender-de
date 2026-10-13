import type { ReleaseEvent } from './types.ts'
import { istAusgeblieben } from './logic.ts'

/** Ein Eintrag der Kalenderdatei: der erste Termin, bei zusammengefassten Folgen mit der letzten Folge in `bis`. */
export interface IcsEintrag {
  ev: ReleaseEvent
  bis?: number
}

/** Was zwei Folgen gemeinsam haben müssen, um einen Eintrag zu teilen: derselbe Release, Tag, dieselbe Uhrzeit und dieselben Hinweise. */
const gruppenSchluessel = (e: ReleaseEvent): string =>
  [e.releaseSlug, e.date, e.time ?? '', e.sprache ?? '', !!e.premiere, !!e.estimated, !!e.timeEstimated].join('|')

const zusammenfassbar = (e: ReleaseEvent): boolean => e.releaseType === 'weekly' && !!e.episode && !e.sichtung && !istAusgeblieben(e)

/**
 * **Folgen desselben Tages sind ein Eintrag** (Daniel, 13.10.2026; Mushoku Tensei Staffel 3: Folge 13 und 14 am 18.10.): Wer das
 * Abo hat, sieht dieselbe Kachel wie auf der Seite. Zusammengefasst werden lückenlos aufeinanderfolgende Folgen; der Eintrag
 * behält die Kennung der ersten Folge, damit ein vorhandener Termin im fremden Kalender stehen bleibt.
 */
export function fasseFolgenZusammen(events: ReleaseEvent[]): IcsEintrag[] {
  const eintraege: IcsEintrag[] = []
  const offen = new Map<string, IcsEintrag>()
  for (const ev of [...events].sort((a, b) => (a.episode ?? 0) - (b.episode ?? 0))) {
    const schluessel = gruppenSchluessel(ev)
    const laufend = zusammenfassbar(ev) ? offen.get(schluessel) : undefined
    if (laufend && ev.episode === (laufend.bis ?? laufend.ev.episode!) + 1) {
      laufend.bis = ev.episode
      continue
    }
    const neu: IcsEintrag = { ev }
    eintraege.push(neu)
    if (zusammenfassbar(ev)) offen.set(schluessel, neu)
  }
  /* Die Reihenfolge der Eingabe bleibt: ein Eintrag steht dort, wo sein erster Termin stand. */
  const position = new Map(events.map((e, i) => [e.id, i]))
  return eintraege.sort((a, b) => position.get(a.ev.id)! - position.get(b.ev.id)!)
}
