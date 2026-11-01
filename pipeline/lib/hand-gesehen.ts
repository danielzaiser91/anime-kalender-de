import { adressKern } from './dub-confirmed.ts'

/**
 * Adresskern → jüngster Handbeleg (`checkedAt` der Belege mit Urteil ≠ „weg“, `belegtAm` der von Hand
 * bestätigten Wege). Gleiche Ausnahme wie `handSticht` im Bau (22.09.2026, Fairy Tail bei Prime).
 */
export function handGesehenAm(
  belege: { url?: string; available?: boolean; checkedAt?: string }[],
  verweise: { url?: string; belegtAm?: string }[],
): Map<string, string> {
  const gesehen = new Map<string, string>()
  for (const b of belege) {
    if (!b.url || b.available === false) continue
    const k = adressKern(b.url)
    if (String(b.checkedAt ?? '') > (gesehen.get(k) ?? '')) gesehen.set(k, String(b.checkedAt ?? ''))
  }
  for (const v of verweise) {
    if (!v?.url || !v.belegtAm) continue
    const k = adressKern(v.url)
    if (String(v.belegtAm) > (gesehen.get(k) ?? '')) gesehen.set(k, String(v.belegtAm))
  }
  return gesehen
}
