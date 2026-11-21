/**
 * **Der Messer: ist die fällige deutsche Folge schon da?** Reine Rechnung (ohne Netz, ohne Uhr, ohne Node/DOM) für den Worker-Takt
 * `worker/src/ausbleiben-messer.ts`. Regeln aus dem Probelauf 2c (18.11.2026):
 *
 * - Gelesen wird nur die Folgenliste der Staffel (`cms/seasons/<Staffel>/episodes`), nie die Browse-Liste.
 * - Monoton: Wer die deutsche Fassung einmal gesehen hat, bei dem bleibt es so; eine spätere ältere Lesung (Zwischenspeicher
 *   bis 22 min alt) holt nichts zurück und überschreibt die erste Sichtung nie.
 * - „Ausgeblieben“ nur, wenn eine erfolgreiche Lesung ab Termin + 26 min die Folge ohne `de-DE` zeigt. Nichtauskunft
 *   (Fehler, leere Liste, Folge nicht in der Liste, Staffel unklar) ist nie Ausbleiben.
 */
import { MESSER_AUSBLEIBEN_FRUEHESTENS_MS, pruefungFaellig } from './ausbleiben-plan.ts'
import { FAELLIG_HOECHSTENS_MS } from './termin-zustand.ts'

/** Was von einer Lesung bleibt: `deutsch` = `de-DE` in `versions` der Folge, `vorhanden` = die Folge steht überhaupt in der Liste. */
export type Lesung = { art: 'auskunft'; deutsch: boolean; vorhanden: boolean } | { art: 'keine' }

/** Gedächtnis je Termin; alle Zeiten in ms seit Epoche. */
export interface ZielStand {
  slotMs: number
  /** Zuletzt gewählte deutsche Staffel (`GS…DEDE`), spart den Abruf der Staffelliste. */
  staffel?: string
  /** Erste Sichtung; wird nie überschrieben. */
  gesehenAm?: number
  /** Zeit des letzten Versuchs, gleich ob er etwas ergab (der Takt zählt davon). */
  letzteLesung?: number
  /** Zeit der letzten erfolgreichen Lesung, die die Folge ohne `de-DE` zeigte. */
  ohneDeutschAm?: number
}

export type Urteil = 'erschienen' | 'ausgeblieben' | 'offen' | 'unbekannt'

/** Die Serienkennung (`GT…`) aus dem Release-Schlüssel eines Wochenplans (`cr-GT00384015`); sonst `null` (ältere Schlüssel tragen keine). */
export function serieAusSlug(slug: string): string | null {
  const m = /^cr-(G[A-Z0-9]+)$/.exec(slug)
  return m ? m[1] : null
}

const istObjekt = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null
const versionen = (x: unknown): Record<string, unknown>[] => (istObjekt(x) && Array.isArray(x.versions) ? x.versions.filter(istObjekt) : [])
const hatDeDE = (x: unknown): boolean => versionen(x).some((v) => v.audio_locale === 'de-DE')

/** Die Folgenliste der Staffel als Lesung. Fehlt `data` oder ist sie leer, ist das keine Auskunft. */
export function lesungAusFolgenliste(antwort: unknown, folge: number): Lesung {
  if (!istObjekt(antwort) || !Array.isArray(antwort.data) || antwort.data.length === 0) return { art: 'keine' }
  const eintraege = antwort.data.filter((e) => istObjekt(e) && e.episode_number === folge)
  return { art: 'auskunft', vorhanden: eintraege.length > 0, deutsch: eintraege.some(hatDeDE) }
}

/**
 * Die deutsche Staffel einer Serie: die jüngste (höchste `season_sequence_number`) mit `de-DE` in `versions`.
 * Eine neu anlaufende Folge einer laufenden Serie liegt in der jüngsten Staffel; ohne deutsche Staffel `null`.
 */
export function deutscheStaffel(antwort: unknown): string | null {
  if (!istObjekt(antwort) || !Array.isArray(antwort.data)) return null
  let beste: { nr: number; id: string } | null = null
  for (const s of antwort.data) {
    const de = versionen(s).find((v) => v.audio_locale === 'de-DE')
    const nr = istObjekt(s) && typeof s.season_sequence_number === 'number' ? s.season_sequence_number : 0
    if (de && typeof de.guid === 'string' && (!beste || nr > beste.nr)) beste = { nr, id: de.guid }
  }
  return beste ? beste.id : null
}

/** Der neue Stand nach einer Lesung zur Zeit `jetztMs`; ändert den alten nie. */
export function nachLesung(alt: ZielStand, lesung: Lesung, jetztMs: number): ZielStand {
  const stand: ZielStand = { ...alt, letzteLesung: jetztMs }
  if (stand.gesehenAm !== undefined || lesung.art === 'keine') return stand
  if (lesung.deutsch) return { ...stand, gesehenAm: jetztMs }
  return lesung.vorhanden ? { ...stand, ohneDeutschAm: jetztMs } : stand
}

/** Was der Stand zum Termin sagt. */
export function urteil(stand: ZielStand): Urteil {
  if (stand.gesehenAm !== undefined) return 'erschienen'
  if (stand.ohneDeutschAm === undefined) return 'unbekannt'
  return stand.ohneDeutschAm - stand.slotMs >= MESSER_AUSBLEIBEN_FRUEHESTENS_MS ? 'ausgeblieben' : 'offen'
}

/**
 * Ist jetzt eine Lesung dran? Nicht, wenn die Folge schon gesehen wurde; nur ab dem Termin und höchstens 24 h danach
 * (`FAELLIG_HOECHSTENS_MS`, danach gilt der Termin ohnehin wieder als erschienen); sonst nach dem Takt der Stufentabelle.
 */
export function lesungFaellig(stand: ZielStand, jetztMs: number): boolean {
  if (stand.gesehenAm !== undefined) return false
  const abstand = jetztMs - stand.slotMs
  if (abstand < 0 || abstand > FAELLIG_HOECHSTENS_MS) return false
  return pruefungFaellig('sichtung', stand.slotMs, stand.letzteLesung, jetztMs)
}
