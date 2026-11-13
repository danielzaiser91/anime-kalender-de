/**
 * Prime-Meldungen, deren gemeldete `seite` von der Ablage-Adresse abweicht und die im Datensatz keinen Weg bekommen haben (13.11.2026).
 * „Keinen Weg“ heißt: der Titel (in `titles.json`) hat keinen Prime-Weg, dessen Adresse (`url`, `seite`) dieselbe Kennung trägt wie die
 * gemeldete Seite. Meldungen zu Titeln außerhalb von `titles.json` (Katalog) zählen nicht mit. Die Zahl dient als Ratsche (darf nur sinken).
 */
import { asinsAus, type BesitzTitel } from './handbeleg-notizseite.ts'

export interface ZugeordneteMeldung {
  titleId: number
  plattform: string
  seite?: string | null
}

/** Schlüssel der Meldungen (Ablage-Adresse), deren Seite abweicht und deren Titel diese Seite nicht als Prime-Weg führt. */
export function meldungenSeiteOhneWeg(zugeordnet: Record<string, ZugeordneteMeldung>, titel: BesitzTitel[]): string[] {
  const nachId = new Map(titel.map((t) => [t.id, t]))
  const treffer: string[] = []
  for (const [schluessel, m] of Object.entries(zugeordnet)) {
    if (m.plattform !== 'primevideo' || !m.seite) continue
    const seite = asinsAus(m.seite)[0]
    if (!seite || seite === asinsAus(schluessel.split('#')[0])[0]) continue
    const t = nachId.get(m.titleId)
    if (!t) continue
    const hatWeg = (t.streams ?? []).some((s) => s.platform === 'primevideo' && [...asinsAus(s.url), ...asinsAus(s.seite)].includes(seite))
    if (!hatWeg) treffer.push(schluessel)
  }
  return treffer
}

/** Meldung bei Überschreitung, sonst nichts. */
export function seiteOhneWegMangel(anzahl: number, hoechstens: number): string | undefined {
  if (anzahl <= hoechstens) return undefined
  return `${anzahl} Prime-Meldungen mit abweichender Seite ohne Weg im Datensatz, erlaubt höchstens ${hoechstens}`
}
