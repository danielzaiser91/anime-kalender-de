/**
 * Die höchste Folge, die der Datensatz je Kennung belegt — für den Vergleich der Erweiterung mit der
 * Plattform (4.24.21, 10.10.2026: Das Band der Unterwelt, Datensatz bis Folge 11, Disney+ und Netflix
 * zeigen 15).
 *
 * Gezählt wird die obere Grenze der `dubRanges`. Sie fehlt, wo der Vergleich lügen würde:
 * - **Mehrere Einträge an einer Adresse:** die Nummern sind nicht vergleichbar.
 * - **Eine Spanne ohne deutschen Ton (`dub: false`):** die Synchro ist dort bewusst kürzer als das Angebot
 *   (Bleach: Thousand-Year Blood War – The Calamity, Disney+: Folgen 1–6 deutsch, 7–8 ohne, 10 im Angebot).
 *   Neue Folgen hinter einer solchen Lücke sind keine Lücke im Datensatz.
 */
export function bekannteFolgen(titel, plattform, kennung) {
  const jeKennung = new Map()
  for (const t of titel) {
    for (const s of t.streams ?? []) {
      const k = s.platform === plattform ? kennung(s.seite ?? s.url ?? '') : null
      if (!k) continue
      const spannen = s.dubRanges ?? []
      const bis = spannen.some((r) => r.dub === false) ? 0 : Math.max(0, ...spannen.map((r) => Number(r.to) || 0))
      jeKennung.set(k, jeKennung.has(k) ? 0 : bis)
    }
  }
  return Object.fromEntries([...jeKennung].filter(([, bis]) => bis > 0))
}
