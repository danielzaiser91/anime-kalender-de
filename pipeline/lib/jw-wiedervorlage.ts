/**
 * Welche JustWatch-Befunde der Abruf vor der 28-Tage-Frist wieder holt (Wiedervorlage), zusätzlich zu `alterNachholen`
 * in `fetch-justwatch-audio.ts`.
 */
import type { Title } from '../../shared/types.ts'
import { BEFUND_MAX_TAGE } from './jw-vertrauen.ts'

/** Wie viele Tage vor dem Ablauf der Vertrauensregel ein Befund erneuert wird (ein Wochenlauf Vorlauf). */
export const ERNEUERN_VORLAUF_TAGE = 7

interface BefundKurz {
  geprueftAm: string
  jwId?: string
  jwPfad?: string
  ohneTreffer?: boolean
  staffeln?: unknown[]
}

/** Eine Serie, zu der noch keine Staffelangaben gesammelt sind (Befunde aus der Zeit vor dem 11.10.2026). */
export function staffelnFehlen(e: BefundKurz | undefined): boolean {
  return Boolean(e?.jwId && !e.ohneTreffer && e.jwPfad?.startsWith('/de/Serie') && e.staffeln === undefined)
}

/**
 * Ein Prime-Weg mit „Deutsch laut JustWatch" gilt nur bei einem Befund unter 28 Tagen. Der Abruf holt Befunde ab dem
 * 28. Tag — dazwischen wäre die Kennzeichnung tagelang weg. Deshalb wird dieser Befund einen Wochenlauf früher erneuert.
 */
export function vertrauensBefundAlt(t: Title, e: BefundKurz | undefined, heute: string): boolean {
  if (!e || !(t.streams ?? []).some((s) => s.dubQuelle === 'justwatch')) return false
  const alterTage = (Date.parse(heute) - Date.parse(e.geprueftAm)) / 86_400_000
  return alterTage >= BEFUND_MAX_TAGE - ERNEUERN_VORLAUF_TAGE
}
