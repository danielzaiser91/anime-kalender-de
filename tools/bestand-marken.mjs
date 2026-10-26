/**
 * Ratsche für die Sperrbreite des Bestandsbaus (26.10.2026): Ein roter Wächter in `tools/check-bestand-liste.txt` hielt bisher den ganzen
 * Datensatz zurück (84 rote Bestandsbauten in 7 Tagen, einer 5 Stunden), außer er nannte die betroffenen Titel (`melde`, Quarantäne,
 * `tools/quarantaene.mjs`). Jeder Wächter mit einem möglichen Fehlerausgang muss deshalb Titel melden — oder steht mit Grund in
 * `tools/bestand-ohne-marke.json`. Die Liste darf nur sinken; ein neuer Wächter ohne Marke und ohne Eintrag macht den Test rot.
 * Der Wächter selbst wird als Syntaxbaum gelesen (kein Regex): Aufruf von `melde` oder `meldeVerletzte` irgendwo in der Datei.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { zaehleFehlerAusgaenge } from './bestand-verstoss-zeile.mjs'

const MARKEN_AUFRUFE = new Set(['melde', 'meldeVerletzte'])

/** Ruft die Datei `melde` oder `meldeVerletzte` auf? Namensräume und Aliase zählen nicht (dann steht der Wächter in der Liste und fällt auf). */
export function hatMarke(quelltext, dateiname = 'x.ts') {
  const quelle = ts.createSourceFile(dateiname, quelltext, ts.ScriptTarget.Latest, true)
  let gefunden = false
  const besuche = (k) => {
    if (ts.isCallExpression(k) && ts.isIdentifier(k.expression) && MARKEN_AUFRUFE.has(k.expression.text)) gefunden = true
    ts.forEachChild(k, besuche)
  }
  besuche(quelle)
  return gefunden
}

/** Die Wächter der Liste (Zeilen ohne `#`), die rot enden können und keine Marke melden. */
export function ohneMarke(wurzel) {
  const liste = readFileSync(join(wurzel, 'tools/check-bestand-liste.txt'), 'utf8')
    .split('\n')
    .map((z) => z.trim())
    .filter((z) => z && !z.startsWith('#'))
  return liste.filter((datei) => {
    const text = readFileSync(join(wurzel, datei), 'utf8')
    return zaehleFehlerAusgaenge(text, datei) > 0 && !hatMarke(text, datei)
  })
}
