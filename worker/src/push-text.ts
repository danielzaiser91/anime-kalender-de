/**
 * Text der Web-Push-Nachricht (18.09.2026). Eigene Datei ohne Worker-Typen, damit
 * `pipeline/check-logic.ts` ihn prüfen kann — das Haupt-tsconfig kennt `D1Database` nicht.
 */
export interface PushEreignis {
  titleId: number
  name: string
  date: string
  time?: string
  episode?: number
  verpasst?: { erschienenAm?: string }
}

export interface WeitererAnbieter {
  id: number
  name: string
  anbieter: string
}

/** Text einer gebündelten Push-Nachricht; `null`, wenn es nichts zu melden gibt. */
export function pushText(folgen: PushEreignis[], auchBei: WeitererAnbieter[]): string | null {
  const zeile = (e: PushEreignis) => (e.episode ? `${e.name} – Folge ${e.episode}` : e.name)
  const teile = [
    ...folgen.map((e) => ({ kurz: zeile(e), lang: `Jetzt auf Deutsch: ${zeile(e)}` })),
    ...auchBei.map((w) => ({ kurz: `${w.name} (${w.anbieter})`, lang: `${w.name} jetzt auch bei ${w.anbieter}` })),
  ]
  if (!teile.length) return null
  if (teile.length === 1) return teile[0]!.lang
  const kopf = auchBei.length ? `${teile.length} Neuigkeiten` : `${teile.length} neue Folgen`
  return `${kopf}: ${teile.slice(0, 3).map((t) => t.kurz).join(' · ')}`
}

