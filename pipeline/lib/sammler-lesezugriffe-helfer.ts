/**
 * Mittelbare Lesezugriffe (20.10.2026): Helfer aus `anisearch-marke.ts` laden die Sammlerdateien erst beim ersten Aufruf.
 * Eine Prüfung, die `deutschMarke(204011)` ruft, hängt so an `data/anisearch-dubs.json`, ohne ein `readFileSync` zu tragen.
 * Gefunden werden Aufrufe über Import (auch mit Alias und Namensraum); Name als Wert, Klammerzugriff auf den Namensraum, Re-Export,
 * dynamischer Import und ein nicht festes Argument sind „?“. Wirkt nur über die Importzeile, nicht über andere Module, die selbst Helfer rufen.
 */
import ts from 'typescript'
import type { Lesefund } from './sammler-lesezugriffe.ts'

/** Helfer → gelesene Datei; `einzeln`: liefert die ganze Karte, der feste Schlüssel steht erst im Zugriff darauf. */
const HELFER = {
  deutschMarke: { ziel: 'data/anisearch-dubs.json', einzeln: false },
  dubsNachTitel: { ziel: 'data/anisearch-dubs.json', einzeln: true },
  dubIdsNachAnisearch: { ziel: 'data/anisearch-dub-ids.json', einzeln: true },
} as const
type HelferName = keyof typeof HELFER
const MODUL = /(?:^|\/)anisearch-marke(?:\.[mc]?[jt]s)?$/
const FALLBACK_ZIEL = 'data/anisearch-dubs.json'

const istHelfer = (n: string): n is HelferName => Object.hasOwn(HELFER, n)
const istFest = (a: ts.Node | undefined): boolean => !!a && (ts.isNumericLiteral(a) || ts.isStringLiteralLike(a))

interface Bindungen {
  einzeln: Map<string, HelferName>
  namensraeume: Set<string>
}

/** Namen, unter denen die Helfer in dieser Datei stehen; ein Re-Export des Moduls wird sofort als „?“ gemeldet. */
function bindungen(quelle: ts.SourceFile, melde: (z: string) => void): Bindungen {
  const b: Bindungen = { einzeln: new Map(), namensraeume: new Set() }
  for (const s of quelle.statements) {
    if (ts.isExportDeclaration(s) && s.moduleSpecifier && ts.isStringLiteral(s.moduleSpecifier) && MODUL.test(s.moduleSpecifier.text)) melde(FALLBACK_ZIEL)
    if (!ts.isImportDeclaration(s) || !ts.isStringLiteral(s.moduleSpecifier) || !MODUL.test(s.moduleSpecifier.text)) continue
    const k = s.importClause
    if (k?.name) melde(FALLBACK_ZIEL)
    const nb = k?.namedBindings
    if (nb && ts.isNamespaceImport(nb)) b.namensraeume.add(nb.name.text)
    if (nb && ts.isNamedImports(nb)) {
      for (const e of nb.elements) {
        const orig = (e.propertyName ?? e.name).text
        if (istHelfer(orig)) b.einzeln.set(e.name.text, orig)
      }
    }
  }
  return b
}

/** Urteil über einen Aufruf: der Schlüssel muss fest im Quelltext stehen, sonst „?“ (auch die ganze Karte: das Lesen der ganzen Datei gehört begründet). */
function urteilAufruf(name: HelferName, aufruf: ts.CallExpression): Lesefund['art'] {
  if (!HELFER[name].einzeln) return istFest(aufruf.arguments[0]) ? 'lesen' : '?'
  const p = aufruf.parent
  if (ts.isElementAccessExpression(p) && p.expression === aufruf) return istFest(p.argumentExpression) ? 'lesen' : '?'
  return '?'
}

/** Aufruf eines erkannten Helfers: `knoten` ist der Name (oder `ns.name`), `n.parent` der Aufruf. */
function pruefeStelle(name: HelferName, knoten: ts.Node, melde: (z: string, a: Lesefund['art']) => void): void {
  const p = knoten.parent
  if (ts.isCallExpression(p) && p.expression === knoten) {
    melde(HELFER[name].ziel, urteilAufruf(name, p))
    return
  }
  if (ts.isImportSpecifier(p) || ts.isExportSpecifier(p)) return
  melde(HELFER[name].ziel, '?')
}

export function findeHelferZugriffe(quelle: ts.SourceFile): Lesefund[] {
  const funde: Lesefund[] = []
  const melde = (ziel: string, art: Lesefund['art'] = '?'): void => void funde.push({ ziel, art })
  const b = bindungen(quelle, melde)
  const besuche = (n: ts.Node): void => {
    if (ts.isIdentifier(n) && b.einzeln.has(n.text) && !ts.isImportSpecifier(n.parent)) {
      if (!(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n)) pruefeStelle(b.einzeln.get(n.text)!, n, melde)
    }
    if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && b.namensraeume.has(n.expression.text) && istHelfer(n.name.text)) pruefeStelle(n.name.text, n, melde)
    if (ts.isElementAccessExpression(n) && ts.isIdentifier(n.expression) && b.namensraeume.has(n.expression.text)) melde(FALLBACK_ZIEL)
    if (ts.isIdentifier(n) && b.namensraeume.has(n.text) && !namensraumErlaubt(n)) melde(FALLBACK_ZIEL)
    if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteralLike(n.arguments[0]!) && MODUL.test(n.arguments[0].text)) melde(FALLBACK_ZIEL)
    ts.forEachChild(n, besuche)
  }
  besuche(quelle)
  return funde
}

/** Der Namensraum darf nur vor einem Punkt-Zugriff oder in der Importzeile stehen; alles andere reicht ihn weiter. */
function namensraumErlaubt(n: ts.Identifier): boolean {
  const p = n.parent
  if (ts.isNamespaceImport(p)) return true
  if (ts.isPropertyAccessExpression(p)) return p.expression === n
  return ts.isElementAccessExpression(p) && p.expression === n
}
