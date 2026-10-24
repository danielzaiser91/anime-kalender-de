import { addDays, diffDays } from '../../shared/time.ts'
import { PLATZHALTER } from '../bau/folgentitel-tmdb.ts'

/** Abruf-Alter in Tagen, ab dem eine erschienene Folge ohne echten Titel den Eintrag fällig macht (statt der 30 Tage der Grundfrist). */
export const FRISCH_TAGE = 7

/** Nur Folgen der letzten Wochen zählen: fehlt ein Titel länger, ist er bei TMDB dauerhaft englisch oder leer, und ein Wochenabruf brächte nichts (Messung 24.10.2026: sonst 368 von 817 Titeln jede Woche). */
export const FENSTER_TAGE = 21

export interface FolgeKurz {
  s: number
  e: number
  titel: string | null
  en?: string | null
  datum: string | null
}
export interface BestandKurz {
  geholtAm: string
  folgen: FolgeKurz[]
}

/** Ein Titel ist echt, wenn er nicht leer, kein Platzhalter („Folge 2") und nicht der englische Rückfall ist. */
function hatEchtenTitel(f: FolgeKurz): boolean {
  const t = f.titel?.trim()
  if (!t || PLATZHALTER.test(t)) return false
  return !(f.en && t.toLowerCase() === f.en.trim().toLowerCase())
}

/** Laufende Serie, deren Abruf Folgen ohne Titel kennt, die schon erschienen sind — TMDB trägt Titel oft erst Tage nach der Ausstrahlung nach. */
export function frischFaellig(alt: BestandKurz, heute: string): boolean {
  if (diffDays(alt.geholtAm, heute) < FRISCH_TAGE) return false
  return alt.folgen.some((f) => f.s >= 1 && !!f.datum && f.datum <= heute && f.datum >= addDays(heute, -FENSTER_TAGE) && !hatEchtenTitel(f))
}

export function grundFaellig(alt: BestandKurz | undefined, heute: string, alterTage: number): boolean {
  if (!alt) return true
  if (diffDays(alt.geholtAm, heute) >= alterTage) return true
  return alt.folgen.some((f) => f.s >= 1 && f.en === undefined)
}

/** Fällige Schlüssel; laufende Serien mit fehlenden Titeln vor den Übrigen, damit sie nicht hinter dem Limit verhungern. */
export function waehleFaellige<T extends { id: string }>(
  kandidaten: T[], bestand: Record<string, BestandKurz>, heute: string, alterTage: number, limit: number,
): T[] {
  const frisch: T[] = []
  const rest: T[] = []
  for (const k of kandidaten) {
    const alt = bestand[k.id]
    if (alt && frischFaellig(alt, heute)) frisch.push(k)
    else if (grundFaellig(alt, heute, alterTage)) rest.push(k)
  }
  return [...frisch, ...rest].slice(0, limit)
}
