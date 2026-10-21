import { useEffect } from 'react'
import type { Title } from '@shared/types.ts'
import { anzeigeName } from '@shared/titles.ts'
import { seitenTitel } from '@shared/seiten-titel.ts'
import { useTeilenAdresse } from './teilen-adresse.ts'
import { PANEL_KENNUNG } from './reihen-spur-regeln.ts'

/** Tab-Titel der Ansicht ohne offenes Panel; gleicht `<title>` in `web/index.html` (Test in `pipeline/check-titelwechsel.ts`). */
export const GRUNDTITEL = 'Deutscher Anime-Kalender: Anime mit deutscher Synchro'

/** Tab-Titel eines offenen Titels, im Format der Teilseite; „Termine“ nur, wo der Titel welche hat. */
export function tabTitel(title: Title, mitTermin: boolean): string {
  return seitenTitel(anzeigeName(title), title, mitTermin)
}

/**
 * **Der eine Ort für alles, was beim Titelwechsel im offenen Panel mitwechseln muss:** das Panel steht oben (der Container
 * `data-panel` scrollt, nicht die Seite; kein `scrollIntoView`, kein Gleiten — das scrollte das Panel vor, 09.10.2026) und der
 * Tab heißt wie der Titel. Panel zu: Tab zurück auf den Grundtitel. Links im Panel (Ähnliche, Reihe, `wechsleZu`) ändern nur die Adresse.
 */
export function useTitelwechsel(titleId: number, title: Title | undefined, mitTermin: boolean): void {
  useTeilenAdresse(title)
  useEffect(() => {
    const panel = document.querySelector<HTMLElement>(`[data-panel="${PANEL_KENNUNG}"]`)
    if (panel) panel.scrollTop = 0
  }, [titleId])
  const tab = title ? tabTitel(title, mitTermin) : undefined
  useEffect(() => {
    if (tab === undefined) return
    document.title = tab
    return () => {
      document.title = GRUNDTITEL
    }
  }, [tab])
}
