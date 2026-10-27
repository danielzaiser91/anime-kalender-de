import {
  antworteSitzung, DUELLE_MAX, DUELLE_START, istFertig, neueSitzung, neuerZustand, zurueck, type Antwort, type Sitzung, type Zustand,
} from '@shared/empfehlung-kern.ts'
import type { Kandidat } from '@shared/empfehlung-pool.ts'
import type { Kontext } from '@shared/empfehlung-vektor.ts'
import { ersetzeVorschlag, ersteVorschlaege, naechstesZiel } from './empfehlung-reise.ts'

/** Ablauf der Reise als reine Zustandsübergänge (ohne React): die Hooks der Ansicht rufen nur diese Funktionen. */

export type Phase = 'start' | 'duell' | 'ergebnis' | 'leinwand'

export interface Ablauf {
  phase: Phase
  sitzung?: Sitzung
  /** Gewertete Duelle bis zu den Vorschlägen (6, nach „genauer“ 10). */
  ziel: number
  /** Kennungen der Galerie. */
  gezeigt: number[]
  /** Titel auf der Leinwand. */
  aktuell?: number
}

export const ANFANG: Ablauf = { phase: 'start', ziel: DUELLE_START, gezeigt: [] }

/** „Los geht’s“ und „Von vorn“: neue Sitzung mit den Abzügen; Ziel zurück auf 6, die Galerie bleibt bis zum nächsten Ergebnis. */
export function neueReise(k: Kontext, a: Ablauf, startwert: number, ausgeschlossen: number[]): Ablauf {
  return { ...a, phase: 'duell', sitzung: neueSitzung(neuerZustand(k, startwert, ausgeschlossen)), ziel: DUELLE_START, aktuell: undefined }
}

/** Antwort auf das Paar; ist das Ziel erreicht (oder kein Paar mehr), zeigt die Galerie die ersten Plätze der Rangliste. */
export function antworten(k: Kontext, a: Ablauf, antwort: Antwort, rang: (z: Zustand) => Kandidat[]): Ablauf {
  if (!a.sitzung) return a
  const s = antworteSitzung(k, a.sitzung, antwort)
  if (istFertig(k, s.zustand, a.ziel)) return { ...a, sitzung: s, phase: 'ergebnis', gezeigt: ersteVorschlaege(rang(s.zustand)) }
  return { ...a, sitzung: s }
}

/** Ein Duell zurück; am Anfang bleibt alles. */
export function duellZurueck(a: Ablauf): Ablauf {
  return a.sitzung ? { ...a, sitzung: zurueck(a.sitzung) } : a
}

/** „Noch vier Duelle – genauer“: Ziel hoch (höchstens 10), zurück ins Duell. */
export function genauerMachen(a: Ablauf): Ablauf {
  return a.sitzung ? { ...a, ziel: naechstesZiel(a.ziel, DUELLE_MAX), phase: 'duell' } : a
}

/** Ob „genauer“ noch etwas bringt: noch nicht 10 gewertete Duelle und noch ein Paar da. */
export const kannGenauer = (k: Kontext, a: Ablauf): boolean => !!a.sitzung && !istFertig(k, a.sitzung.zustand, DUELLE_MAX)

/** ✕ oder ✓ auf der Galerie oder der Leinwand: der Titel geht, der nächste der Rangliste rückt an seine Stelle, zurück zur Galerie. */
export function entfernen(a: Ablauf, id: number, rang: Kandidat[]): Ablauf {
  return { ...a, phase: 'ergebnis', gezeigt: ersetzeVorschlag(a.gezeigt, id, rang) }
}

export const oeffnen = (a: Ablauf, id: number): Ablauf => ({ ...a, phase: 'leinwand', aktuell: id })

/** „Von vorn“: zurück zum Startbildschirm, ohne Sitzung und ohne Galerie. */
export const zuStart = (): Ablauf => ANFANG

export const zuPhase =(a: Ablauf, phase: Phase): Ablauf => ({ ...a, phase })
