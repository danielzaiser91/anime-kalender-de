/**
 * Findet Lesezugriffe einer Prüfung auf Sammler-Dateien unter `data/` (nicht `data/curated`, nicht `public/data`).
 * Eine Prüfung, die dort einen festen Schlüssel verlangt, wird rot, sobald Fortschreiben oder Neusammeln ihn entfernt
 * (check-woche-beleg, 20.10.2026). Der Scanner liest den Syntaxbaum; was er nicht einordnen kann, meldet er als „?“ und zählt es als Lesen.
 */
import ts from 'typescript'

export interface Lesefund {
  ziel: string
  art: 'lesen' | '?'
}

const PFAD_ZIEL = /^(?:(?:\.\.\/)+|\.\/)?data\/([A-Za-z0-9_.-]+\.(?:json|jsonl|yaml|yml|md|txt))$/
const LESEN = new Set(['readFileSync', 'readFile', 'readJson', 'ladeAkVon', 'existsSync'])
const SCHREIBEN = new Set(['writeFileSync', 'writeFile', 'writeJson', 'appendFileSync', 'rmSync', 'unlinkSync', 'mkdirSync', 'copyFileSync', 'schreibe'])
/** Zeichenketten-Vergleich gegen Quelltext, kein Lesen der Datei. */
const TEXTVERGLEICH = new Set(['includes', 'indexOf', 'startsWith', 'endsWith'])
const PFAD_BAUER = new Set(['join', 'resolve'])
const ECHTE_WURZELN = new Set(['ROOT', 'WURZEL'])

function aufrufName(ausdruck: ts.Expression): string | undefined {
  if (ts.isIdentifier(ausdruck)) return ausdruck.text
  if (ts.isPropertyAccessExpression(ausdruck)) return ausdruck.name.text
  return undefined
}

/** Zeigt der Ausdruck auf den echten Repo-Ordner (nicht auf eine Kulisse im Temp-Ordner)? */
function istEchteWurzel(a: ts.Expression): boolean {
  if (ts.isIdentifier(a)) return ECHTE_WURZELN.has(a.text)
  if (ts.isPropertyAccessExpression(a)) return a.getText() === 'import.meta.dirname'
  if (ts.isCallExpression(a)) return a.getText() === 'process.cwd()'
  return false
}

/** Folgt dem Pfadwert nach oben (join/resolve mit echter Wurzel, new URL, fileURLToPath) bis zum Verbraucher. */
function verbraucher(knoten: ts.Node): 'lesen' | 'nein' | '?' {
  const p = knoten.parent
  if (!p) return '?'
  if (ts.isNewExpression(p) && aufrufName(p.expression) === 'URL') {
    return p.arguments?.[1]?.getText() === 'import.meta.url' ? verbraucher(p) : 'nein'
  }
  if (!ts.isCallExpression(p)) return '?'
  const name = aufrufName(p.expression)
  if (name === undefined) return '?'
  if (SCHREIBEN.has(name) || TEXTVERGLEICH.has(name)) return 'nein'
  if (LESEN.has(name)) return 'lesen'
  if (name === 'fileURLToPath') return verbraucher(p)
  if (PFAD_BAUER.has(name)) {
    const wurzel = p.arguments[0]
    return wurzel && (wurzel === knoten || istEchteWurzel(wurzel)) ? verbraucher(p) : 'nein'
  }
  /* Hilfsfunktion mit Wurzel-Parameter vor dem Pfad (Aufruf mit Wurzel-Variable als erstem Argument): eine Kulisse, solange die Wurzel nicht der Repo-Ordner ist. */
  const erstes = p.arguments[0]
  return ts.isIdentifier(erstes!) && !istEchteWurzel(erstes!) ? 'nein' : '?'
}

export function findeLesezugriffe(pfad: string, text: string): Lesefund[] {
  const art = /\.(ts|mts)$/.test(pfad) ? ts.ScriptKind.TS : ts.ScriptKind.JS
  const quelle = ts.createSourceFile(pfad, text, ts.ScriptTarget.Latest, true, art)
  const funde: Lesefund[] = []
  const besuche = (n: ts.Node): void => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      const m = PFAD_ZIEL.exec(n.text)
      const v = m ? verbraucher(n) : 'nein'
      if (m && (v === 'lesen' || v === '?')) funde.push({ ziel: `data/${m[1]}`, art: v })
    }
    ts.forEachChild(n, besuche)
  }
  besuche(quelle)
  return funde
}
