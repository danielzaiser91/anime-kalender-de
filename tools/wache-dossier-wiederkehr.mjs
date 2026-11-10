/**
 * Ein Abschnitt des Wachen-Dossiers, der einmal abbricht („FEHLER: … nach N s abgebrochen“, GraphQL-Limit), bekommt einen zweiten Versuch.
 * Gelingt er, steht „vorübergehend (Abbruch HH:MM, wieder ok HH:MM)“ im Abschnitt statt eines Ausfalls; scheitert auch der zweite, bleibt der Befund.
 * Gedächtnis über Läufe hinweg gibt es nicht (das Dossier entsteht je Lauf im Arbeitsordner), die Wiederkehr gilt innerhalb eines Laufs.
 */
import { berlinZeit } from './wache-urteil-eintrag.mjs'

export const PAUSE_MS = Number(process.env.WACHE_WIEDERHOLUNG_PAUSE_MS ?? 20e3)

const uhrzeit = (jetzt) => berlinZeit(jetzt).slice(-5)

/** Ausfall-Text einer Quelle: Fehlertext der Werkzeug-Aufrufe (`FEHLER: …`) oder Absturz des Abschnitts. */
export const istAusfall = (inhalt) => /^FEHLER:/.test(inhalt)

/** Warten ohne Zeitgeber, synchron – das Sammeln ist synchron. */
export const warteSynchron = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

function versuch(quelle) {
  try {
    const inhalt = quelle()
    return istAusfall(inhalt) ? { fehler: inhalt } : { inhalt }
  } catch (fehler) {
    return { fehler: `FEHLER beim Sammeln: ${String(fehler.message).split('\n')[0]}` }
  }
}

/** Inhalt des Abschnitts: Erfolg, Erfolg im zweiten Versuch mit Vermerk, oder der Fehler des zweiten Versuchs. */
export function mitWiederkehr(quelle, jetzt, warte) {
  const erst = versuch(quelle)
  if (!('fehler' in erst)) return erst.inhalt
  const abbruch = uhrzeit(jetzt())
  warte(PAUSE_MS)
  const zweit = versuch(quelle)
  if ('fehler' in zweit) return `${zweit.fehler}\n(auch der zweite Versuch scheiterte, erster Abbruch ${abbruch}; erster Fehler: ${erst.fehler.split('\n')[0]})`
  return `vorübergehend (Abbruch ${abbruch}, wieder ok ${uhrzeit(jetzt())}; Fehler: ${erst.fehler.split('\n')[0]})\n\n${zweit.inhalt}`
}
