/**
 * Findet Lesezugriffe einer Prüfung auf Sammler-Dateien unter `data/` (nicht `data/curated`, nicht `public/data`).
 * Eine Prüfung, die dort einen festen Schlüssel verlangt, wird rot, sobald Fortschreiben oder Neusammeln ihn entfernt
 * (check-woche-beleg, 20.10.2026). Der Scanner liest den Syntaxbaum; was er nicht einordnen kann, meldet er als „?“ und zählt es als Lesen.
 * Erkannte Pfadformen: ein Literal `data/x.json`, `join/resolve(Wurzel, 'data', 'x.json')` und `` `${Wurzel}/data/x.json` ``.
 * Eine Wurzel gilt als Kulisse nur, wenn ihre Deklaration in derselben Datei einen Temp-Ordner anlegt (mkdtemp, tmpdir, Kulisse);
 * als echt, wenn sie auf `import.meta`, `process.cwd()`, `ROOT` oder `WURZEL` zurückgeht; alles andere (Parameter, Import) ist „?“.
 */
import ts from 'typescript'
import { findeHelferZugriffe } from './sammler-lesezugriffe-helfer.ts'
import { gebundenerName, urteilUeberVariable } from './sammler-lesezugriffe-variable.ts'

export interface Lesefund {
  ziel: string
  art: 'lesen' | '?'
}

type Urteil = 'lesen' | 'nein' | '?'
type WurzelArt = 'echt' | 'kulisse' | '?'

const ENDUNG = '(?:json|jsonl|yaml|yml|md|txt)'
const PFAD_ZIEL = new RegExp(`^(?:(?:\\.\\./)+|\\./)?data/([A-Za-z0-9_.-]+\\.${ENDUNG})$`)
const DATEI_NAME = new RegExp(`^[A-Za-z0-9_.-]+\\.${ENDUNG}$`)
const VORLAGE_ENDE = new RegExp(`^/data/([A-Za-z0-9_.-]+\\.${ENDUNG})$`)
const LESEN = new Set(['readFileSync', 'readFile', 'readJson', 'ladeAkVon', 'existsSync'])
const SCHREIBEN = new Set(['writeFileSync', 'writeFile', 'writeJson', 'appendFileSync', 'rmSync', 'unlinkSync', 'mkdirSync', 'copyFileSync', 'schreibe'])
/** Zeichenketten-Vergleich gegen Quelltext, kein Lesen der Datei. */
const TEXTVERGLEICH = new Set(['includes', 'indexOf', 'startsWith', 'endsWith'])
const URL_EIGENSCHAFTEN = new Set(['pathname', 'href'])
const PFAD_BAUER =new Set(['join', 'resolve'])
const ECHTE_WURZELN = new Set(['ROOT', 'WURZEL'])
const ECHTER_URSPRUNG = /import\.meta\.(?:dirname|url)|process\.cwd\(\)|\bROOT\b|\bWURZEL\b/
const KULISSEN_URSPRUNG = /mkdtemp|tmpdir|[Kk]ulisse/

function aufrufName(ausdruck: ts.Expression): string | undefined {
  if (ts.isIdentifier(ausdruck)) return ausdruck.text
  if (ts.isPropertyAccessExpression(ausdruck)) return ausdruck.name.text
  return undefined
}

/** Namen der Variablen einer Datei mit dem Quelltext ihrer Initialisierungen (Mehrfachdeklaration: alle). */
function deklarationen(quelle: ts.SourceFile): Map<string, string[]> {
  const karte = new Map<string, string[]>()
  const besuche = (n: ts.Node): void => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) karte.set(n.name.text, [...(karte.get(n.name.text) ?? []), n.initializer?.getText(quelle) ?? ''])
    ts.forEachChild(n, besuche)
  }
  besuche(quelle)
  return karte
}

/** Zeigt der Ausdruck auf den echten Repo-Ordner, auf eine Kulisse im Temp-Ordner oder auf nichts Bestimmbares? */
function wurzelArt(a: ts.Expression, decl: Map<string, string[]>): WurzelArt {
  if (ts.isStringLiteral(a)) return 'echt'
  if (ts.isPropertyAccessExpression(a)) return a.getText() === 'import.meta.dirname' ? 'echt' : '?'
  if (ts.isCallExpression(a)) return a.getText() === 'process.cwd()' ? 'echt' : '?'
  if (!ts.isIdentifier(a)) return '?'
  if (ECHTE_WURZELN.has(a.text)) return 'echt'
  const quellen = decl.get(a.text) ?? []
  if (quellen.length && quellen.every((q) => KULISSEN_URSPRUNG.test(q))) return 'kulisse'
  if (quellen.length && quellen.every((q) => ECHTER_URSPRUNG.test(q))) return 'echt'
  return '?'
}

/** Ein Pfad mit Wurzel: echt wie der Verbraucher, Kulisse nie, unbestimmbar nur dann nicht, wenn der Verbraucher ohnehin nicht liest. */
function mitWurzel(art: WurzelArt, knoten: ts.Node, decl: Map<string, string[]>): Urteil {
  if (art === 'kulisse') return 'nein'
  const v = verbraucher(knoten, decl)
  return art === 'echt' || v === 'nein' ? v : '?'
}

/** Folgt dem Pfadwert nach oben (join/resolve, new URL, fileURLToPath) bis zum Verbraucher. */
function verbraucher(knoten: ts.Node, decl: Map<string, string[]>): Urteil {
  const p = knoten.parent
  if (!p) return '?'
  if (ts.isNewExpression(p) && aufrufName(p.expression) === 'URL') {
    return p.arguments?.[1]?.getText() === 'import.meta.url' ? verbraucher(p, decl) : 'nein'
  }
  /* `u.pathname` / `u.href` bleiben derselbe Pfadwert. */
  if (ts.isPropertyAccessExpression(p) && URL_EIGENSCHAFTEN.has(p.name.text)) return verbraucher(p, decl)
  const gebunden = ts.isNewExpression(knoten) || ts.isCallExpression(knoten) ? gebundenerName(knoten) : undefined
  if (gebunden) return urteilUeberVariable(gebunden, (v) => verbraucher(v, decl))
  if (!ts.isCallExpression(p)) return '?'
  const name = aufrufName(p.expression)
  if (name === undefined) return '?'
  if (SCHREIBEN.has(name) || TEXTVERGLEICH.has(name)) return 'nein'
  if (LESEN.has(name)) return 'lesen'
  if (name === 'fileURLToPath') return verbraucher(p, decl)
  const erstes = p.arguments[0]!
  /* join/resolve: das Literal selbst als erstes Argument ist relativ zu cwd; sonst entscheidet die Wurzel. */
  if (PFAD_BAUER.has(name)) return mitWurzel(wurzelArt(erstes, decl), p, decl)
  /* Hilfsfunktion mit Wurzel vor dem Pfad: nur eine erkannte Wurzel entscheidet. */
  return erstes === knoten ? '?' : mitWurzel(wurzelArt(erstes, decl), p, decl)
}

/** `join(Wurzel, 'data', 'x.json')`: Dateiname direkt hinter dem Segment 'data'. */
function segmentZiel(n: ts.CallExpression): string | undefined {
  const a = n.arguments
  const i = a.findIndex((x) => ts.isStringLiteralLike(x) && x.text === 'data')
  const datei = i < 0 ? undefined : a[i + 1]
  return datei && ts.isStringLiteralLike(datei) && DATEI_NAME.test(datei.text) ? datei.text : undefined
}

/** `` `${Wurzel}/data/x.json` ``: genau ein Platzhalter vorn, der Rest ein fester Pfad. */
function vorlageZiel(n: ts.TemplateExpression): string | undefined {
  const rest = n.templateSpans.length === 1 ? VORLAGE_ENDE.exec(n.templateSpans[0]!.literal.text) : null
  return rest?.[1]
}

export function findeLesezugriffe(pfad: string, text: string): Lesefund[] {
  const art = /\.(ts|mts)$/.test(pfad) ? ts.ScriptKind.TS : ts.ScriptKind.JS
  const quelle = ts.createSourceFile(pfad, text, ts.ScriptTarget.Latest, true, art)
  const decl = deklarationen(quelle)
  const funde: Lesefund[] = []
  const melde = (datei: string | undefined, urteil: () => Urteil): void => {
    const v = datei ? urteil() : 'nein'
    if (datei && v !== 'nein') funde.push({ ziel: `data/${datei}`, art: v })
  }
  const besuche = (n: ts.Node): void => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) melde(PFAD_ZIEL.exec(n.text)?.[1], () => verbraucher(n, decl))
    if (ts.isTemplateExpression(n)) melde(vorlageZiel(n), () => mitWurzel(n.head.text === '' ? wurzelArt(n.templateSpans[0]!.expression, decl) : '?', n, decl))
    if (ts.isCallExpression(n) && PFAD_BAUER.has(aufrufName(n.expression) ?? '')) melde(segmentZiel(n), () => mitWurzel(wurzelArt(n.arguments[0]!, decl), n, decl))
    ts.forEachChild(n, besuche)
  }
  besuche(quelle)
  return [...funde, ...findeHelferZugriffe(quelle)]
}
