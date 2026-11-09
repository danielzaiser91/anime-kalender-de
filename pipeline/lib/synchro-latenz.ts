/**
 * Kennzahl zur Beobachtungsliste: Tage von der Aufnahme (`seit`) bis zum ersten belegten Synchro-Tag laut `synchro-historie.json`.
 * Ein Eintrag, der die Liste verlässt, wartet in `abgeloest`, bis die Historie den Beleg-Tag kennt (der Bau läuft später als die Liste);
 * nach `WARTE_TAGE` ohne Beleg (Entnahme wegen Frist) wird er verworfen.
 */
import { diffDays } from '../../shared/time.ts'
import type { BeobachtungsEintrag } from './synchro-beobachtung.ts'

export interface Belegt {
  id: number
  titel: string
  seit: string
  beleg: string
  tage: number
}

export interface LatenzStand {
  abgeloest: BeobachtungsEintrag[]
  belegt: Belegt[]
}

const WARTE_TAGE = 45
const BELEGT_HOECHSTENS = 100

export function latenzStand(
  alt: BeobachtungsEintrag[],
  neu: BeobachtungsEintrag[],
  vorher: Partial<LatenzStand>,
  historie: Record<string, string>,
  heute: string,
): LatenzStand {
  const noch = new Set(neu.map((e) => e.id))
  const warten = [...alt, ...(vorher.abgeloest ?? [])].filter((e) => !noch.has(e.id))
  const belegt = [...(vorher.belegt ?? [])]
  const abgeloest: BeobachtungsEintrag[] = []
  for (const e of warten) {
    const beleg = historie[String(e.id)]
    if (beleg && beleg >= e.seit) {
      if (!belegt.some((b) => b.id === e.id)) belegt.push({ id: e.id, titel: e.titel, seit: e.seit, beleg, tage: diffDays(e.seit, beleg) })
    } else if (diffDays(e.seit, heute) <= WARTE_TAGE && !abgeloest.some((a) => a.id === e.id)) abgeloest.push(e)
  }
  return { abgeloest, belegt: belegt.slice(-BELEGT_HOECHSTENS) }
}
