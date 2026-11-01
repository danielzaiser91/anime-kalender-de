import type { Title } from '../../shared/types.ts'

/**
 * Ein Name, der der **Anfang** unserer Titel ist („Miraculous“ gegen „Miraculous: Geschichten von Ladybug und
 * Cat Noir Staffel 2“ …), steht für einen Titel, wenn genau einer so beginnt, und für die Reihe, wenn alle
 * Treffer dieselbe `franchiseId` tragen (31.10.2026: Amazon-Teile 2–24 von Miraculous hießen auf ihrer Seite nur
 * „Miraculous“ und blieben ohne Kandidat). Gibt es Treffer aus mehreren Reihen, bleibt es beim Nein.
 * Geliefert wird irgendein Titel der Reihe — `namensKandidaten` nimmt daraus die ganze Reihe.
 */
export function namensAnfang(kern: string, kerne: [kern: string, id: number][], titel: Map<number, Title>): number | undefined {
  if (kern.length < 6) return undefined
  const ids = new Set(kerne.filter(([k]) => k.startsWith(kern)).map(([, id]) => id))
  if (ids.size === 1) return [...ids][0]
  const reihen = new Set([...ids].map((id) => titel.get(id)?.franchiseId ?? id))
  return ids.size && reihen.size === 1 ? Math.min(...ids) : undefined
}
