/**
 * Netflix' eigene Staffelaufteilung an einer Adresse (`data/anbieter-staffeln.json`), aus der Adresse einer Meldung.
 * Aus `fetch-pruefungen.ts` herausgelöst, damit der Zweig „Staffel N ist bekannt" testbar ist.
 */
import { netflixTitelAdresse } from './netflix-adresse.ts'

export type Staffelaufteilung = Record<string, unknown>

/** Die Staffeln der Netflix-Seite hinter `url` (Umleitungen aufgelöst); leer, wenn die Adresse keine Kennung trägt oder unbekannt ist. */
export function bekannteNetflixStaffeln(url: string, anbieterStruktur: Staffelaufteilung): { seq: number }[] {
  const kennung = /netflix\.com\/title\/(\d+)/.exec(netflixTitelAdresse(url))?.[1]
  return kennung ? ((anbieterStruktur[kennung] as { staffeln?: { seq: number }[] } | undefined)?.staffeln ?? []) : []
}
