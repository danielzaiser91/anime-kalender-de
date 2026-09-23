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


/**
 * **Wohin der Klick auf die Benachrichtigung führt** (Daniel, 23.09.2026: „klick drauf
 * öffnet nicht clevates detail panel in wochenansicht sondern .../#/favoriten").
 *
 * Der Service Worker öffnete bis dahin fest die Favoritenansicht. Bei einer einzelnen
 * Meldung ist das eine Station zu viel: Gemeint ist genau dieser Titel, und die Route
 * kennt ihn — `?t=<id>` öffnet sein Panel in jeder Ansicht, `?d=<datum>` stellt die Woche
 * auf den Tag der Folge.
 *
 * Bei mehreren Meldungen bleibt es bei der Favoritenansicht: Dort stehen sie alle.
 */
export function pushZiel(folgen: PushEreignis[], auchBei: WeitererAnbieter[]): string {
  if (folgen.length === 1 && !auchBei.length) {
    const e = folgen[0]!
    return `#/woche?d=${e.date}&t=${e.titleId}`
  }
  if (!folgen.length && auchBei.length === 1) return `#/woche?t=${auchBei[0]!.id}`
  return '#/favoriten'
}
