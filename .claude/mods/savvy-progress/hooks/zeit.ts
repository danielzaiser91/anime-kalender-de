// Geschätzte gegen laufende Zeit eines Subagenten: grün im Rahmen, gelb ab 90 %, rot über 100 %.
export type ZeitStatus = 'ok' | 'warn' | 'over'

// Ohne Schätzung (fehlt, 0, negativ, keine Zahl) null: die Zeile zeigt nur die laufende Zeit.
export function zeitStatus(elapsedMs: number, estimateMin: number | undefined): ZeitStatus | null {
  if (typeof estimateMin !== 'number' || !Number.isFinite(estimateMin) || estimateMin <= 0) return null
  const anteil = elapsedMs / (estimateMin * 60_000)
  return anteil > 1 ? 'over' : anteil >= 0.9 ? 'warn' : 'ok'
}

export const schaetzungText = (estimateMin: number): string => `~${Math.round(estimateMin)} min`

// SVG-Füllung (Desktop) und Themenschlüssel (Terminal) je Zustand.
export const ZEIT_SVG: Record<ZeitStatus, string> = { ok: '#5fbf8f', warn: '#e5b94a', over: '#e5534b' }
export const ZEIT_THEMA: Record<ZeitStatus, string> = { ok: 'success', warn: 'warning', over: 'error' }
