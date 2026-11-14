/**
 * Prime-Meldungen, deren gemeldete `seite` von der Ablage-Adresse abweicht und die im Datensatz keinen Weg bekommen haben (13.11.2026).
 * „Keinen Weg“ heißt: der Titel (in `titles.json`) hat keinen Prime-Weg, dessen Adresse (`url`, `seite`) dieselbe Kennung trägt wie die
 * gemeldete Seite, und der Weg an der Ablage-Adresse deckt die deutschen Folgen der Meldung nicht schon ab (`ablageDeckt`). Meldungen zu
 * Titeln außerhalb von `titles.json` (Katalog) zählen nicht mit. Die Zahl dient als Ratsche (darf nur sinken).
 */
import { asinsAus, type BesitzTitel, type PrimeWeg } from './handbeleg-notizseite.ts'

export interface ZugeordneteMeldung {
  titleId: number
  plattform: string
  seite?: string | null
  folgen?: { unsere: number | null; sprachen: string[] }[]
}

export interface WegMitTon extends PrimeWeg {
  dub?: boolean
  dubRanges?: { from: number; to: number; dub?: boolean }[]
}

export interface TitelMitWegen extends BesitzTitel {
  streams?: WegMitTon[]
}

const primeWegMit = (t: TitelMitWegen, asin: string): WegMitTon | undefined =>
  (t.streams ?? []).find((s) => s.platform === 'primevideo' && [...asinsAus(s.url), ...asinsAus(s.seite)].includes(asin))

/**
 * Die Meldung ist schon versorgt (Hyouka: zweite Staffelseite, gemeldet unter der ersten Adresse): Der Prime-Weg an der Ablage-Adresse
 * trägt jede deutsche Folge der Meldung in einem `dubRanges`-Bereich mit Ja, oder er ist ein Haken-Weg (`dub: true` ohne Bereiche).
 * Ohne deutsche Folge oder mit einer deutschen Folge ohne unsere Nummer ist nichts belegbar gedeckt.
 */
export function ablageDeckt(m: ZugeordneteMeldung, ablage: string | undefined, t: TitelMitWegen): boolean {
  const weg = ablage ? primeWegMit(t, ablage) : undefined
  const deutsch = (m.folgen ?? []).filter((f) => f.sprachen.includes('Deutsch'))
  if (!weg || !deutsch.length || deutsch.some((f) => f.unsere === null)) return false
  if (!weg.dubRanges) return weg.dub === true
  return deutsch.every((f) => weg.dubRanges!.some((r) => r.dub === true && f.unsere! >= r.from && f.unsere! <= r.to))
}

/** Schlüssel der Meldungen (Ablage-Adresse), deren Seite abweicht, deren Titel diese Seite nicht als Prime-Weg führt und die die Ablage nicht deckt. */
export function meldungenSeiteOhneWeg(zugeordnet: Record<string, ZugeordneteMeldung>, titel: TitelMitWegen[]): string[] {
  const nachId = new Map(titel.map((t) => [t.id, t]))
  const treffer: string[] = []
  for (const [schluessel, m] of Object.entries(zugeordnet)) {
    if (m.plattform !== 'primevideo' || !m.seite) continue
    const seite = asinsAus(m.seite)[0]
    const ablage = asinsAus(schluessel.split('#')[0])[0]
    if (!seite || seite === ablage) continue
    const t = nachId.get(m.titleId)
    if (!t || primeWegMit(t, seite) || ablageDeckt(m, ablage, t)) continue
    treffer.push(schluessel)
  }
  return treffer
}

/** Meldung bei Überschreitung, sonst nichts. */
export function seiteOhneWegMangel(anzahl: number, hoechstens: number): string | undefined {
  if (anzahl <= hoechstens) return undefined
  return `${anzahl} Prime-Meldungen mit abweichender Seite ohne Weg im Datensatz, erlaubt höchstens ${hoechstens}`
}
