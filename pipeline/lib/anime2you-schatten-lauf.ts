/**
 * Der Schattenschritt im Claude-Lauf: liest `auswahl.json`, `artikel/<id>.txt` und `ergebnis/<id>.json` des Arbeitsordners, vergleicht die Regel
 * mit Claudes Rohantwort und hängt eine Zeile an die Schattendatei. Er wirft nie: jeder Fehler wird gezählt (`schattenFehler`) und gemeldet,
 * damit der Lauf nicht seinetwegen rot wird (`pipeline/anime2you-schatten.ts` beendet den Prozess in jedem Fall mit Exit 0).
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ergaenzeSchatten, schattenLauf, type ArtikelEingabe, type Lauf, type SchattenBestand } from './anime2you-schatten.ts'

/** Relativ zur Wurzel (`AK_ROOT`); `data/proposals` geht mit dem Pull Request des Laufs mit (`tools/quellen-liste.sh`). */
export const SCHATTEN_DATEI = 'data/proposals/anime2you-schatten.json'

export interface Ablage {
  lies: () => SchattenBestand
  schreibe: (b: SchattenBestand) => void
}

/** Claudes Rohvorschläge einer Antwortdatei; `undefined`, wenn sie fehlt, kaputt ist oder der Artikel nicht als gelesen gemeldet wurde (wie `leseAntwort` in `anime2you-extraktion.ts`). */
export function leseRohAntwort(pfad: string): unknown[] | undefined {
  if (!existsSync(pfad)) return undefined
  try {
    const a = JSON.parse(readFileSync(pfad, 'utf8')) as { gelesen?: unknown; vorschlaege?: unknown }
    return a.gelesen === true && Array.isArray(a.vorschlaege) ? a.vorschlaege : undefined
  } catch {
    return undefined
  }
}

function eingaben(ordner: string): ArtikelEingabe[] {
  const plan = JSON.parse(readFileSync(resolve(ordner, 'auswahl.json'), 'utf8')) as { kandidaten: { id: string }[] }
  return plan.kandidaten.map((k) => ({
    id: k.id,
    text: readFileSync(resolve(ordner, 'artikel', `${k.id}.txt`), 'utf8'),
    claude: leseRohAntwort(resolve(ordner, 'ergebnis', `${k.id}.json`)),
  }))
}

/** Gibt die geschriebene Zeile zurück; bei einem Ausfall eine Zeile mit `schattenFehler: 1`, falls sich die Ablage noch beschreiben lässt. */
export function schattenSchritt(ordner: string, ablage: Ablage, am: string, jetzt: () => number, melde: (text: string) => void): Lauf | undefined {
  let lauf: Lauf
  try {
    lauf = schattenLauf(am, eingaben(ordner), jetzt)
  } catch (err) {
    melde(`Schatten: Ausfall beim Lesen – ${(err as Error).message}`)
    lauf = { am, artikel: 0, ohneAntwort: 0, schattenFehler: 1, gleich: 0, nurRegel: 0, nurClaude: 0, ms: 0, faelle: [] }
  }
  try {
    ablage.schreibe(ergaenzeSchatten(ablage.lies(), lauf))
  } catch (err) {
    melde(`Schatten: Ausfall beim Speichern – ${(err as Error).message}`)
    return undefined
  }
  melde(`Schatten: ${lauf.artikel} Artikel, gleich ${lauf.gleich}, nur Regel ${lauf.nurRegel}, nur Claude ${lauf.nurClaude}, ohne Antwort ${lauf.ohneAntwort}, Schattenfehler ${lauf.schattenFehler}, ${lauf.ms} ms`)
  return lauf
}
