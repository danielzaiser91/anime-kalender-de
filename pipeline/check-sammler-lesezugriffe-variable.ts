/**
 * Direkte Zusicherungen zu `pipeline/lib/sammler-lesezugriffe-variable.ts` (die Fälle über `findeLesezugriffe` stehen in
 * `check-sammler-lesezugriffe-faelle.ts`): `gebundenerName` nur für den Initialisierer einer einfachen Variablen; `urteilUeberVariable`
 * sammelt jede Verwendung außer der Deklaration und Eigenschaftsnamen (`x.u`), „lesen“ schlägt alles, „nein“ nur wenn alle nein sagen,
 * ohne Verwendung „?“. Läuft in `check:logic`.
 */
import ts from 'typescript'
import { gebundenerName, urteilUeberVariable } from './lib/sammler-lesezugriffe-variable.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

const quelle = (text: string) => ts.createSourceFile('x.ts', text, ts.ScriptTarget.Latest, true)
/** Der erste `new URL(...)`-Ausdruck im Quelltext. */
function urlAusdruck(q: ts.SourceFile): ts.Node {
  let fund: ts.Node | undefined
  const besuche = (n: ts.Node): void => {
    if (!fund && ts.isNewExpression(n)) fund = n
    ts.forEachChild(n, besuche)
  }
  besuche(q)
  return fund!
}
const URL_AUSDRUCK = "new URL('../data/x.json', import.meta.url)"

// gebundenerName
pruefe('const u = …', gebundenerName(urlAusdruck(quelle(`const u = ${URL_AUSDRUCK}`)))?.text, 'u')
pruefe('let mit Typ', gebundenerName(urlAusdruck(quelle(`let p: URL = ${URL_AUSDRUCK}`)))?.text, 'p')
pruefe('Destrukturierung: kein Name', gebundenerName(urlAusdruck(quelle(`const { href } = ${URL_AUSDRUCK}`)))?.text, undefined)
pruefe('Argument eines Aufrufs: kein Name', gebundenerName(urlAusdruck(quelle(`readFileSync(${URL_AUSDRUCK})`)))?.text, undefined)
pruefe('Zuweisung ohne Deklaration: kein Name', gebundenerName(urlAusdruck(quelle(`u = ${URL_AUSDRUCK}`)))?.text, undefined)
const typKnoten = (() => {
  const d = (quelle(`let p: URL = ${URL_AUSDRUCK}`).statements[0] as ts.VariableStatement).declarationList.declarations[0]!
  return d.type!
})()
pruefe('Typangabe der Deklaration ist kein Initialisierer', gebundenerName(typKnoten)?.text, undefined)
pruefe('in Klammern: kein Name', gebundenerName(urlAusdruck(quelle(`const u = (${URL_AUSDRUCK})`)))?.text, undefined)

// urteilUeberVariable
function urteile(text: string, urteil: (v: ts.Node) => 'lesen' | 'nein' | '?'): { urteil: string; gesehen: string[] } {
  const q = quelle(text)
  const name = gebundenerName(urlAusdruck(q))!
  const gesehen: string[] = []
  const ergebnis = urteilUeberVariable(name, (v) => {
    gesehen.push(v.parent.getText())
    return urteil(v)
  })
  return { urteil: ergebnis, gesehen }
}
const nachAufruf = (v: ts.Node) => (ts.isCallExpression(v.parent) ? (v.parent.expression.getText() === 'readFileSync' ? 'lesen' : 'nein') : '?')

pruefe('ohne Verwendung: ?', urteile(`const u = ${URL_AUSDRUCK}`, () => 'lesen'), { urteil: '?', gesehen: [] })
pruefe(
  'eine Lese-Verwendung schlägt nein und ?',
  urteile(`const u = ${URL_AUSDRUCK}\nexistsSync(u)\nreadFileSync(u)\nconsole.log([u])`, nachAufruf),
  { urteil: 'lesen', gesehen: ['existsSync(u)', 'readFileSync(u)', '[u]'] },
)
pruefe('alle nein: nein', urteile(`const u = ${URL_AUSDRUCK}\nexistsSync(u)\nstatSync(u)`, nachAufruf).urteil, 'nein')
pruefe('nein und ?: ?', urteile(`const u = ${URL_AUSDRUCK}\nexistsSync(u)\nconst k = [u]`, nachAufruf).urteil, '?')
pruefe(
  'Eigenschaftsname x.u zählt nicht, x[u] und u.href schon',
  urteile(`const u = ${URL_AUSDRUCK}\nobj.u\nobj[u]\nu.href`, () => 'nein').gesehen,
  ['obj[u]', 'u.href'],
)

if (fehler) {
  console.error(`check-sammler-lesezugriffe-variable: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-sammler-lesezugriffe-variable: alle Zusicherungen grün')
