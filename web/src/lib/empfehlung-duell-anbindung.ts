import type { Antwort, Sitzung } from '@shared/empfehlung-kern.ts'
import type { Kontext } from '@shared/empfehlung-vektor.ts'
import { geheZurueck } from './empfehlung-bedienung.ts'
import { ladeUndDekodiere, paarNachAntwort, type KartenQuelle, type Lader } from './empfehlung-duell-bilder.ts'
import { baueDuellSteuerung, type DuellSchritt } from './empfehlung-duell-steuerung.ts'

/** Was die Anbindung bei jedem Aufruf frisch braucht (die Komponente liefert den aktuellen Stand). */
export interface Stand {
  kontext: Kontext
  sitzung: Sitzung
  ziel: number
  /** Bildquelle der Karte zu einer Titelkennung. */
  quelle: (id: number) => KartenQuelle
  antworte: (a: Antwort) => void
  zurueck: () => void
}

export interface AnbindungOptionen {
  plane: (f: () => void, ms: number) => number
  loesche: (h: number) => void
  meldeSchritt: (s: DuellSchritt) => void
  setzeGewaehlt: (a: Antwort | undefined) => void
  aktuell: () => Stand
  lader: () => Lader
  reduziert: () => boolean
}

/** Alles, was ein Klick im Duell auslöst, ohne React: Sperre, Vorladen des nächsten Paars, Wechsel erst danach, Zurück. */
export function baueDuellAnbindung(o: AnbindungOptionen) {
  const steuerung = baueDuellSteuerung({
    plane: o.plane,
    loesche: o.loesche,
    meldeSchritt: o.meldeSchritt,
    wechsle: (antwort) => {
      o.setzeGewaehlt(undefined)
      o.aktuell().antworte(antwort)
    },
    reduziert: o.reduziert,
  })
  const ladeNaechste = (antwort: Antwort): Promise<void> => {
    const { kontext, sitzung, ziel, quelle } = o.aktuell()
    const paar = paarNachAntwort(kontext, sitzung, antwort, ziel)
    if (!paar) return Promise.resolve()
    return ladeUndDekodiere(paar.map((i) => quelle(kontext.datei.einstiege[i].id)), o.lader)
  }
  return {
    /** Gibt zurück, ob die Wahl angenommen wurde; während eines Duells nicht. */
    waehle: (antwort: Antwort): boolean => {
      if (!steuerung.waehle(antwort, () => ladeNaechste(antwort))) return false
      o.setzeGewaehlt(antwort)
      return true
    },
    zurueckGehen: (): void => geheZurueck({ stopp: steuerung.abbrechen }, () => o.setzeGewaehlt(undefined), o.aktuell().zurueck),
    abbrechen: steuerung.abbrechen,
  }
}
