/**
 * Welche JustWatch-Befunde der Abruf vor der 28-Tage-Frist wieder holt (Wiedervorlage), zusätzlich zu `alterNachholen`
 * in `fetch-justwatch-audio.ts`.
 */
import type { Title } from '../../shared/types.ts'
import { BEFUND_MAX_TAGE } from './jw-vertrauen.ts'

/** Wie viele Tage vor seinem Ablauf (`BEFUND_MAX_TAGE`) ein Befund erneuert wird (ein Wochenlauf Vorlauf). */
export const ERNEUERN_VORLAUF_TAGE = 7

interface BefundKurz {
  geprueftAm: string
  jwId?: string
  jwPfad?: string
  ohneTreffer?: boolean
  staffeln?: unknown[]
  altersangabe?: string | null
}

/** Eine Serie, zu der noch keine Staffelangaben gesammelt sind (Befunde aus der Zeit vor dem 11.10.2026). */
export function staffelnFehlen(e: BefundKurz | undefined): boolean {
  return Boolean(e?.jwId && !e.ohneTreffer && e.jwPfad?.startsWith('/de/Serie') && e.staffeln === undefined)
}

/**
 * Altersangabe nachholen (08.10.2026): Treffer aus der Zeit vor dem Feld haben keine `altersangabe`;
 * für Titel ohne FSK werden sie vorgezogen — dieselbe Abfrage, nur früher als die 28-Tage-Frist.
 */
function alterNachholen(t: Title, bestand: Record<string, BefundKurz>): boolean {
  const e = bestand[String(t.id)]
  return t.fsk === undefined && Boolean(e?.jwId && !e.ohneTreffer && e.altersangabe === undefined)
}

/** Was vor der 28-Tage-Frist wieder an die Reihe kommt: Altersangabe, Staffelangaben, Befunde hinter „Deutsch laut JustWatch". */
export function vorgezogen(t: Title, bestand: Record<string, BefundKurz>, heute: string): boolean {
  const e = bestand[String(t.id)]
  return alterNachholen(t, bestand) || staffelnFehlen(e) || vertrauensBefundAlt(t, e, heute)
}

/**
 * Ein Weg mit „Deutsch laut JustWatch" (jeder Anbieter, `jw-seite.ts`) gilt nur bei einem Befund unter 28 Tagen. Der Abruf holt Befunde ab dem
 * 28. Tag — dazwischen wäre die Kennzeichnung tagelang weg. Deshalb wird dieser Befund einen Wochenlauf früher erneuert.
 */
export function vertrauensBefundAlt(t: Title, e: BefundKurz | undefined, heute: string): boolean {
  if (!e || !(t.streams ?? []).some((s) => s.dubQuelle === 'justwatch')) return false
  const alterTage = (Date.parse(heute) - Date.parse(e.geprueftAm)) / 86_400_000
  return alterTage >= BEFUND_MAX_TAGE - ERNEUERN_VORLAUF_TAGE
}
