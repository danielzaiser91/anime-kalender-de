/**
 * **Der JustWatch-Befund je Titel** (`data/justwatch-audio.json`) und seine Frist. Die Regel „Deutsch laut JustWatch“ steht seit
 * 16.10.2026 in `jw-seite.ts` (je Seite, alle Anbieter); bis dahin galt hier eine Prime-Regel (Bericht
 * `daniel-zum-abarbeiten/berichte/justwatch-vertrauen-2026-10-11.md`: 465 von 468 richtig bei einzeln geführten Serien und Filmen,
 * Mehrteiler nur 95,5 %, weil der Ton am Serien-Angebot alle Staffeln zusammenfasst).
 */
import type { JwAngebot } from './amazon-gti.ts'
import type { Staffel } from './jw-staffeln.ts'

/** Ein Befund, der älter ist, sagt nichts mehr über heute (28 Tage, wie die Wiedervorlage des Abrufs). */
export const BEFUND_MAX_TAGE = 28

/** Ein Befund wird fällig, bevor er verfällt: ein Wochenlauf (7 Tage) plus ein Tag Luft unter `BEFUND_MAX_TAGE` (Wochenlauf `refresh-weekly.yml`). */
export const ABRUF_ALTER_TAGE = BEFUND_MAX_TAGE - 8

/** Fälligkeitsalter des Abrufs (`--alter N`), ohne Angabe `ABRUF_ALTER_TAGE`. */
export function abrufAlterTage(args: string[]): number {
  const i = args.indexOf('--alter')
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : ABRUF_ALTER_TAGE
}

export interface JwBefund {
  geprueftAm: string
  jwId?: string
  jwPfad?: string
  ohneTreffer?: boolean
  verfehltAm?: string
  /** Nur bei `ohneTreffer`: ein Namensvetter auf JustWatch, bewusst nicht zugeordnet (`lib/jw-namenstreffer.ts`). */
  namenTreffer?: { gleicherName?: boolean; jwId?: string }
  angebote: JwAngebot[]
  /** Staffeln laut JustWatch (seit 11.10.2026); fehlt bei Filmen und älteren Befunden. */
  staffeln?: Staffel[]
}

/** Wie viele Titel je JustWatch-Kennung im Abrufbestand stehen (Schlüssel: `jwId`). */
export function titelJeJustwatchKennung(bestand: Record<string, JwBefund>): Map<string, number> {
  const jeKennung = new Map<string, number>()
  for (const b of Object.values(bestand)) if (b.jwId) jeKennung.set(b.jwId, (jeKennung.get(b.jwId) ?? 0) + 1)
  return jeKennung
}
