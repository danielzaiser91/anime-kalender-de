import { anzeigeName } from '../../shared/titles.ts'
import type { DubCheck } from './dub-confirmed.ts'

export type JaBeleg = Pick<DubCheck, 'anilistId' | 'platform' | 'url' | 'dub' | 'available' | 'checkedAt'>

export type WegTitel = { id: number; titleDe?: string; titleEn?: string; titleRomaji?: string; streams?: unknown[]; watchLinks?: unknown[] }

const schluessel = (b: JaBeleg): string => `${b.anilistId}|${b.platform}|${b.url ?? ''}`
const istNein = (b: JaBeleg): boolean => b.dub === false || b.available === false

/**
 * Ein gemessenes Ja, das keine Zeile derselben Ausgabe (Titel, Anbieter, Adresse) mit gleichem oder jüngerem Datum verneint.
 * Das Urteil über andere Ausgaben desselben Anbieters zählt nicht: Hazbin Hotel hatte zwei Ja und ein Nein zu einer dritten Prime-Seite.
 */
function bestehendeJa(belege: JaBeleg[]): JaBeleg[] {
  const neinStand = new Map<string, string>()
  for (const b of belege) {
    if (!istNein(b)) continue
    const k = schluessel(b)
    if ((neinStand.get(k) ?? '') < b.checkedAt) neinStand.set(k, b.checkedAt)
  }
  return belege.filter((b) => b.dub === true && b.available !== false && (neinStand.get(schluessel(b)) ?? '') < b.checkedAt)
}

/**
 * **Gemessenes Ja ⇒ mindestens ein Weg.** Ein Titel im Datensatz, für den ein Handbeleg „deutsch“ steht, muss dem Besucher einen Anbieter
 * nennen (`streams` oder `watchLinks`); sonst ist „Deutsch“ belegt, aber nirgends steht, wo man es sieht (18.10.2026: Hazbin Hotel und
 * fünf weitere Cartoons). Gibt je Verstoß eine Zeile zurück; `ausnahmen` (Titelkennung → Grund) nimmt nur belegt unvermeidbare Fälle aus.
 */
export function jaOhneWeg(titel: WegTitel[], belege: JaBeleg[], ausnahmen: ReadonlyMap<number, string> = new Map()): string[] {
  const mitJa = new Set(bestehendeJa(belege).map((b) => b.anilistId))
  const zeilen: string[] = []
  for (const t of titel) {
    if (!mitJa.has(t.id) || (t.streams?.length ?? 0) + (t.watchLinks?.length ?? 0) > 0) continue
    if (ausnahmen.has(t.id)) continue
    zeilen.push(`${t.id} ${anzeigeName(t)}`)
  }
  return zeilen
}

/** Ausnahmen, die zu keinem Verstoß mehr gehören: sie stünden sonst als stille Freifahrt in der Liste. */
export function ueberholteAusnahmen(titel: WegTitel[], belege: JaBeleg[], ausnahmen: ReadonlyMap<number, string>): number[] {
  const offen = new Set(jaOhneWeg(titel, belege).map((z) => Number(z.split(' ')[0])))
  return [...ausnahmen.keys()].filter((id) => !offen.has(id))
}

/** Alle Meldungen des Bestandslaufs: Titel mit Ja ohne Weg und überholte Ausnahmen. Leer heißt grün. */
export function bestandsFehler(titel: WegTitel[], belege: JaBeleg[], ausnahmen: ReadonlyMap<number, string>): string[] {
  const offen = jaOhneWeg(titel, belege, ausnahmen)
  const alt = ueberholteAusnahmen(titel, belege, ausnahmen)
  return [
    ...(offen.length ? [`✖ ${offen.length} Titel mit gemessenem Ja ohne jeden Weg:`, ...offen.map((z) => `    ${z}`)] : []),
    ...(alt.length ? [`✖ Ausnahmen ohne Verstoß (streichen): ${alt.join(', ')}`] : []),
  ]
}
