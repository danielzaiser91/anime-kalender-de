import { staffelBeschriftungen } from '../../shared/titles.ts'

export type Reiheneintrag = { id: number; name: string; format?: string; beiwerk?: boolean; jpYear?: number; jpStart?: string }

/** Staffelnummer je Hauptstaffel einer Reihe — nur wenn die Reihe mehr als eine hat. */
export function staffelNummern(reihe: Reiheneintrag[]): Map<number, number> {
  const haupt = reihe
    .filter((m) => (m.format === 'TV' || m.format === 'ONA') && !m.beiwerk)
    .sort((a, b) => (a.jpStart ?? String(a.jpYear ?? 9999)).localeCompare(b.jpStart ?? String(b.jpYear ?? 9999)) || a.id - b.id)
  const aus = new Map<number, number>()
  if (haupt.length < 2) return aus
  const kopf = haupt[0]!.name
  const beschriftung = staffelBeschriftungen(haupt, kopf)
  haupt.forEach((m, i) => {
    const b = /^Staffel (\d+)/.exec(beschriftung.get(m.id) ?? '')
    if (b) return void aus.set(m.id, Number(b[1]))
    const rest = m.name.startsWith(kopf) ? m.name.slice(kopf.length).trim() : ''
    if (/^\d+$/.test(rest)) return void aus.set(m.id, Number(rest))
    /* Römisch wie „Mob Psycho 100 II" / „III" (18.09.2026: Daniels Meldungen blieben sonst liegen). */
    const roemisch: Record<string, number> = { II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 }
    if (roemisch[rest.toUpperCase()]) return void aus.set(m.id, roemisch[rest.toUpperCase()]!)
    if (i === 0) aus.set(m.id, 1)
  })
  /* „Final Season" ohne Nummer ist die Staffel nach der letzten bekannten (Golden Kamuy, 17.09.2026). */
  const finale = haupt.filter((m) => !aus.has(m.id) && /final season|finale staffel/i.test(m.name))
  if (finale.length === 1) aus.set(finale[0]!.id, Math.max(0, ...aus.values()) + 1)
  return aus
}
