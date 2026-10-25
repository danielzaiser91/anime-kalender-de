/**
 * `const u = new URL('../data/x.json', import.meta.url)` und danach `readFileSync(u)`: der Pfadwert wandert über eine Variable
 * zum Verbraucher. Hier stehen die Verwendungen der Variablen und das Gesamturteil über sie.
 */
import ts from 'typescript'

type Urteil = 'lesen' | 'nein' | '?'

/** Ist `knoten` der Initialisierer einer einfachen Variablen, kommt ihr Bezeichner zurück. */
export function gebundenerName(knoten: ts.Node): ts.Identifier | undefined {
  const p = knoten.parent
  return p && ts.isVariableDeclaration(p) && p.initializer === knoten && ts.isIdentifier(p.name) ? p.name : undefined
}

/** Alle Verwendungen des Namens in der Datei (ohne die Deklaration selbst und ohne Verwendungen in ihrem eigenen Initialisierer). */
function verwendungen(name: ts.Identifier): ts.Identifier[] {
  const deklaration = name.parent
  const treffer: ts.Identifier[] = []
  const besuche = (n: ts.Node): void => {
    if (n === deklaration) return
    if (ts.isIdentifier(n) && n.text === name.text && n !== name) treffer.push(n)
    ts.forEachChild(n, besuche)
  }
  besuche(name.getSourceFile())
  return treffer
}

/** Ein Lesen irgendwo zählt; sonst „nein“ nur, wenn jede Verwendung es ist (und es eine gibt); alles andere bleibt „?“. */
export function urteilUeberVariable(name: ts.Identifier, urteil: (verwendung: ts.Node) => Urteil): Urteil {
  const alle = verwendungen(name).map(urteil)
  if (alle.includes('lesen')) return 'lesen'
  return alle.length > 0 && alle.every((u) => u === 'nein') ? 'nein' : '?'
}
