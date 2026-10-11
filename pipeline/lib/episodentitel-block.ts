/**
 * **Eine Meldung gehört dorthin, wo ihre Folgentitel stehen — nicht dorthin, wo der Anbieter sie einsortiert.**
 *
 * Netflix teilt „Avatar – Der Herr der Elemente" in drei Bücher zu 20/20/21 Folgen, unser Cartoon ist eine Serie mit 61
 * (Daniel, 11.10.2026). Bei 48 von 110 Netflix-Adressen weicht die Einteilung des Anbieters von unserer ab. Der Folgentitel
 * hängt an keiner Einteilung; Spezifikation: `daniel-zum-abarbeiten/berichte/zuordnung-ueber-episodentitel.md`.
 *
 * **Entschieden wird je Block, nicht je Folge.** Meldet der Anbieter einen Block (Buch 2), so gilt die Zuordnung, wenn
 * mindestens 80 % seiner Titel in **demselben** Block unserer Liste landen; daraus folgt der Versatz (Buch 2 → 20). Ein
 * einzelner Treffer entscheidet nie allein — erst zwei Titel, die denselben Versatz nennen. Bei Gleichstand zweier Versätze,
 * zu wenigen Titeln oder zu wenig Übereinstimmung gibt es keine Zuordnung, sondern einen Grund für die Prüfliste.
 */
import { folgentitelKern, traegt } from './folgentitel-anker.ts'

/** Eine Folge, wie `data/cartoon-folgen.json` sie führt (Staffel 0 = Extras). `de` steht nur, wo es vom englischen Titel abweicht. */
export interface CartoonFolge {
  s: number
  e: number
  de?: string
  en?: string
}

/** Eine Folge unserer Liste in **unserer** Zählung ab 1 (ohne Extras). */
export interface UnsereFolge {
  nr: number
  de: string | null
  en: string | null
}

/** Unsere Liste: alle regulären Staffeln der Reihe nach, durchgezählt. */
export function unsereFolgen(folgen: CartoonFolge[]): UnsereFolge[] {
  return folgen
    .filter((f) => f.s >= 1)
    .sort((a, b) => a.s - b.s || a.e - b.e)
    .map((f, i) => ({ nr: i + 1, de: f.de ?? f.en ?? null, en: f.en ?? null }))
}

/** Wortüberlappung zweier Titel, 0..1 — gemessen am längeren. */
function ueberlappung(a: string, b: string): number {
  const woerter = (s: string) =>
    new Set(
      s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').split(/[^\p{L}\p{N}]+/u).filter(Boolean),
    )
  const wa = woerter(a)
  const wb = woerter(b)
  if (!wa.size || !wb.size) return 0
  let gleich = 0
  for (const w of wa) if (wb.has(w)) gleich++
  return gleich / Math.max(wa.size, wb.size)
}

const MIN_UEBERLAPPUNG = 0.8

function exakt(kern: string, liste: UnsereFolge[], feld: 'de' | 'en'): number[] {
  return liste.filter((f) => folgentitelKern(f[feld]) === kern).map((f) => f.nr)
}

/**
 * Die Folgen unserer Liste, die zu einem Titel passen: erst exakt auf deutsch, dann exakt auf englisch, dann Wortüberlappung
 * ≥ 0,8 mit höchstens einem Treffer. Mehrere Treffer bei exakter Gleichheit (zwei Folgen heißen gleich) bleiben erhalten.
 */
export function folgenZuTitel(titel: string | null | undefined, liste: UnsereFolge[]): number[] {
  const kern = folgentitelKern(titel)
  if (!traegt(kern)) return []
  const deutsch = exakt(kern, liste, 'de')
  if (deutsch.length) return deutsch
  const englisch = exakt(kern, liste, 'en')
  if (englisch.length) return englisch
  const nah = liste.filter(
    (f) => [f.de, f.en].some((t) => traegt(folgentitelKern(t)) && ueberlappung(titel!, t!) >= MIN_UEBERLAPPUNG),
  )
  return nah.length === 1 ? [nah[0]!.nr] : []
}

/** Eine Meldung innerhalb des Blocks, den der Anbieter nennt: `pos` ist ihre Stelle im Block (ab 1). */
export interface BlockMeldung {
  pos: number
  titel: string | null | undefined
}

export type Blockurteil =
  | {
      sicher: true
      /** Unsere Nummer = Stelle im Block + Versatz. */
      versatz: number
      /** Titel, die in den Block passen / Titel mit Aussagekraft insgesamt. */
      uebereinstimmend: number
      geprueft: number
      /** Titel mit eindeutigem Treffer an anderer Stelle — die Abweichungen, die `check:folgen` zählt. */
      abweichend: number
    }
  /** `widerspruch`: Titel liegen vor und widersprechen sich — dann ordnet auch die Zahl nichts zu; sonst fehlen nur Titel, die Zahl bleibt der Weg. */
  | { sicher: false; grund: string; widerspruch: boolean }

function nein(grund: string, widerspruch: boolean): Blockurteil {
  return { sicher: false, grund, widerspruch }
}

/** Unsere Nummern, die eine Meldung nennt, und der Versatz, den jede bedeutet. */
function versaetze(m: BlockMeldung, liste: UnsereFolge[]): number[] {
  return folgenZuTitel(m.titel, liste).map((nr) => nr - m.pos)
}

/**
 * Entscheidung je Block (Regel im Kopf der Datei). `blockFolgen` ist die Größe des Blocks beim Anbieter: Ein Versatz, bei dem
 * er über das Ende unserer Liste hinausragte (mehr als drei Folgen Spielraum für Specials), ist keiner.
 */
export function ordneBlockZu(meldungen: BlockMeldung[], liste: UnsereFolge[], blockFolgen?: number): Blockurteil {
  const mitTitel = meldungen.filter((m) => traegt(folgentitelKern(m.titel)))
  if (mitTitel.length < 2) return nein(`nur ${mitTitel.length} Folgentitel in der Meldung — ein einzelner Treffer entscheidet nicht`, false)
  const stimmen = new Map<number, number>()
  for (const m of mitTitel) {
    const v = versaetze(m, liste)
    if (v.length === 1) stimmen.set(v[0]!, (stimmen.get(v[0]!) ?? 0) + 1)
  }
  const rang = [...stimmen.entries()].sort((a, b) => b[1] - a[1])
  if (!rang.length) return nein('kein Folgentitel mit eindeutigem Treffer in unserer Liste', false)
  if (rang[1] && rang[1][1] === rang[0]![1]) return nein(`zwei Blöcke gleich stark (Versatz ${rang[0]![0]} und ${rang[1][0]})`, true)
  const versatz = rang[0]![0]
  const uebereinstimmend = mitTitel.filter((m) => versaetze(m, liste).includes(versatz)).length
  if (versatz < 0 || (blockFolgen !== undefined && versatz + blockFolgen > liste.length + 3)) {
    return nein(`Block passt mit Versatz ${versatz} nicht in unsere ${liste.length} Folgen`, true)
  }
  if (uebereinstimmend / mitTitel.length < 0.8) {
    return nein(`nur ${uebereinstimmend} von ${mitTitel.length} Titeln liegen im selben Block (Versatz ${versatz})`, true)
  }
  const abweichend = mitTitel.filter((m) => versaetze(m, liste).length === 1 && !versaetze(m, liste).includes(versatz)).length
  return { sicher: true, versatz, uebereinstimmend, geprueft: mitTitel.length, abweichend }
}
