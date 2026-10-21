import { anzeigeName } from '../../shared/titles.ts'
import { adressKern, type DubCheck } from './dub-confirmed.ts'

export type JaBeleg = Pick<DubCheck, 'anilistId' | 'platform' | 'url' | 'dub' | 'available' | 'checkedAt'>

export type WegEintrag = { platform?: string; url?: string; dub?: boolean; dubRanges?: { dub?: boolean }[] }

export type WegTitel = { id: number; titleDe?: string; titleEn?: string; titleRomaji?: string; streams?: WegEintrag[]; watchLinks?: unknown[] }

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

const hatDeutsch = (w: WegEintrag): boolean => w.dub === true || Boolean(w.dubRanges?.some((r) => r.dub))

/** Titelkennung → Anbieter → Adresskerne der Ja-Zeilen (`''` = Ja für den ganzen Anbieter). */
function jaAdressen(belege: JaBeleg[]): Map<number, Map<string, Set<string>>> {
  const nachTitel = new Map<number, Map<string, Set<string>>>()
  for (const b of bestehendeJa(belege)) {
    const anbieter = nachTitel.get(b.anilistId) ?? new Map<string, Set<string>>()
    anbieter.set(b.platform, (anbieter.get(b.platform) ?? new Set<string>()).add(adressKern(b.url)))
    nachTitel.set(b.anilistId, anbieter)
  }
  return nachTitel
}

/**
 * **Cartoons: gemessenes Ja ⇒ ein Weg dieses Anbieters mit Deutsch.** Je (Titel, Anbieter) mit Ja muss ein Weg stehen, der deutsch führt
 * (`dub` oder deutscher Bereich) und dessen Adresse zu einer Ja-Zeile gehört; trägt kein Ja eine Adresse, genügt jeder Weg des Anbieters.
 * Die Titel-Regel (`jaOhneWeg`) sah LEGO Friends und Blaze nicht: ein Weg bei einem anderen Anbieter genügte ihr (19.10.2026).
 */
export function jaOhneAnbieterWeg(titel: WegTitel[], belege: JaBeleg[], ausnahmen: ReadonlyMap<number, string> = new Map()): string[] {
  const ja = jaAdressen(belege)
  const zeilen: string[] = []
  for (const t of titel) {
    if (ausnahmen.has(t.id)) continue
    for (const [anbieter, kerne] of ja.get(t.id) ?? []) {
      const traegt = (t.streams ?? []).some((w) => w.platform === anbieter && hatDeutsch(w) && (kerne.has('') || kerne.has(adressKern(w.url))))
      if (!traegt) zeilen.push(`${t.id} ${anzeigeName(t)} (${anbieter})`)
    }
  }
  return zeilen
}

/** Ausnahmen, die zu keinem Verstoß mehr gehören: sie stünden sonst als stille Freifahrt in der Liste. */
export function ueberholteAusnahmen(titel: WegTitel[], cartoons: WegTitel[], belege: JaBeleg[], ausnahmen: ReadonlyMap<number, string>): number[] {
  const offen = new Set([...jaOhneWeg(titel, belege), ...jaOhneAnbieterWeg(cartoons, belege)].map((z) => Number(z.split(' ')[0])))
  return [...ausnahmen.keys()].filter((id) => !offen.has(id))
}

/** Alle Meldungen des Bestandslaufs: Titel mit Ja ohne Weg, Cartoons mit Ja ohne Weg des Anbieters und überholte Ausnahmen. Leer heißt grün. */
export function bestandsFehler(titel: WegTitel[], cartoons: WegTitel[], belege: JaBeleg[], ausnahmen: ReadonlyMap<number, string>): string[] {
  const offen = [...jaOhneWeg(titel, belege, ausnahmen), ...jaOhneAnbieterWeg(cartoons, belege, ausnahmen)]
  const alt = ueberholteAusnahmen(titel, cartoons, belege, ausnahmen)
  return [
    ...(offen.length ? [`✖ ${offen.length} Fälle: gemessenes Ja ohne Weg (Cartoons: ohne deutschen Weg des Anbieters):`, ...offen.map((z) => `    ${z}`)] : []),
    ...(alt.length ? [`✖ Ausnahmen ohne Verstoß (streichen): ${alt.join(', ')}`] : []),
  ]
}
