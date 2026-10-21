/**
 * Zusicherungen zum Schreiben der Adresse im Browser (`syncSharePath`, `navigiere`, `ersetzeAdresse`) mit gefälschtem
 * Ort und Verlauf: Unter `/t/<id>/` entsteht nie wieder `t=` im Hash, und eine alte Adresse wird tatsächlich umgeschrieben.
 * Aufruf: `npm run check:logic`.
 */
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { EMPTY_FILTERS } from '../web/src/lib/filters.ts'
import { ersetzeAdresse, liesAdresse, navigiere, schreiber, syncSharePath, type AppRoute, type Umgebung } from '../web/src/lib/router.ts'
import { todayIso } from '../shared/time.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

type Aufruf = [string, ...unknown[]]
function umgebung(pathname: string, hash: string, state: unknown = null): { umg: Umgebung; aufrufe: Aufruf[] } {
  const aufrufe: Aufruf[] = []
  const verlauf = {
    state,
    replaceState: (_s: unknown, _t: string, url?: string | URL | null) => void aufrufe.push(['ersetzt', String(url)]),
    pushState: (_s: unknown, _t: string, url?: string | URL | null) => void aufrufe.push(['neu', String(url)]),
    back: () => void aufrufe.push(['zurueck']),
  }
  return { umg: { ort: { pathname, search: '', hash }, verlauf, base: '' }, aufrufe }
}
const route = (titel?: number): AppRoute => ({ view: 'woche', date: todayIso(), title: titel, filters: { ...EMPTY_FILTERS } }) as AppRoute

console.log('\nsyncSharePath schreibt die Adresse um:')
let t = umgebung('/', '#/woche?t=15957')
syncSharePath('15957', t.umg)
pruefe('Wurzel-Link mit t= → /t/15957/#/woche', t.aufrufe.length === 1 && t.aufrufe[0]![0] === 'ersetzt' && t.aufrufe[0]![1] === '/t/15957/#/woche', t.aufrufe)
t = umgebung('/t/15957/', '#/woche?t=15957')
syncSharePath('15957', t.umg)
pruefe('Seite mit dem alten Doppel (gleicher Pfad) → #/woche', t.aufrufe.length === 1 && t.aufrufe[0]![0] === 'ersetzt' && t.aufrufe[0]![1] === '/t/15957/#/woche', t.aufrufe)
t = umgebung('/t/15957/', '#/woche')
syncSharePath('15957', t.umg)
pruefe('Saubere Adresse bleibt, es wird nichts geschrieben', t.aufrufe.length === 0, t.aufrufe)
t = umgebung('/', '#/woche?t=-284833')
syncSharePath('avatar-284833', t.umg)
pruefe('Namens-Pfad (Cartoon) behält t=', t.aufrufe.length === 1 && t.aufrufe[0]![0] === 'ersetzt' && t.aufrufe[0]![1] === '/t/avatar-284833/#/woche?t=-284833', t.aufrufe)

console.log('\nnavigiere und ersetzeAdresse schreiben unter /t/<id>/ kein t=:')
t = umgebung('/t/15957/', '#/woche')
let gesetzt = 0
navigiere(route(15957), { view: 'datenbank' }, { ...route(15957), view: 'datenbank' }, t.umg, () => void gesetzt++)
pruefe('Ansicht wechseln: Hash ohne t=', t.umg.ort.hash === '#/datenbank', t.umg.ort.hash)
t = umgebung('/', '#/woche')
navigiere(route(), { title: 15957 }, route(15957), t.umg, () => void gesetzt++)
pruefe('Panel öffnen von der Wurzel: neuer Eintrag mit t= (der Pfad kommt danach per syncSharePath)', t.aufrufe[0]?.[0] === 'neu' && t.aufrufe[0][1] === '/#/woche?t=15957', t.aufrufe)
t = umgebung('/t/15957/', '#/woche', { panel: true, tief: true })
navigiere(route(15957), { title: undefined }, route(), t.umg, () => void gesetzt++)
pruefe('Panel schließen (geteilter Link): Adresse wird ersetzt, ohne Titel', t.aufrufe.length === 1 && t.aufrufe[0]![0] === 'ersetzt' && t.aufrufe[0]![1] === '/#/woche', t.aufrufe)
t = umgebung('/t/15957/', '#/woche')
navigiere(route(15957), { title: undefined }, route(), t.umg, () => void gesetzt++)
pruefe('Panel schließen ohne Verlaufseintrag: der Pfad wird auf / zurückgesetzt', t.aufrufe.length === 1 && t.aufrufe[0]![0] === 'ersetzt' && t.aufrufe[0]![1] === '/#/woche', t.aufrufe)
t = umgebung('/t/15957/', '#/woche', { panel: true })
navigiere(route(15957), { title: undefined }, route(), t.umg, () => void gesetzt++)
pruefe('Panel schließen mit eigenem Verlaufseintrag: ein Schritt zurück', t.aufrufe.length === 1 && t.aufrufe[0]![0] === 'zurueck', t.aufrufe)
gesetzt = 0
t = umgebung('/', '#/woche')
navigiere(route(), {}, route(), t.umg, () => void gesetzt++)
pruefe('Gleicher Hash: die Route wird gesetzt, der Hash nicht angefasst', gesetzt === 1 && t.umg.ort.hash === '#/woche', gesetzt)
t = umgebung('/t/15957/', '#/datenbank')
const sortiert = { ...route(15957), view: 'datenbank', sort: 'titel' } as AppRoute
ersetzeAdresse(sortiert, t.umg, () => void gesetzt++)
pruefe('Schalter umlegen: ersetzt die Adresse ohne t=', t.aufrufe.length === 1 && t.aufrufe[0]![0] === 'ersetzt' && t.aufrufe[0]![1] === '/t/15957/#/datenbank?sort=titel', t.aufrufe)
t = umgebung('/', '#/datenbank')
ersetzeAdresse(sortiert, t.umg, () => void gesetzt++)
pruefe('… an der Wurzel (Titel nicht im Pfad) bleibt t=', t.aufrufe[0]![0] === 'ersetzt' && t.aufrufe[0]![1] === '/#/datenbank?t=15957&sort=titel', t.aufrufe)

console.log('\nuseRoute verdrahtet die Schreibwege (schreiber):')
const neueRoute: AppRoute[] = []
t = umgebung('/t/15957/', '#/datenbank')
schreiber(route(15957), (r) => void neueRoute.push(r), () => t.umg).ersetze({ view: 'datenbank', sort: 'titel' })
pruefe('ersetze legt die Adresse um und setzt die Route', t.aufrufe.length === 1 && t.aufrufe[0]![0] === 'ersetzt' && t.aufrufe[0]![1] === '/t/15957/#/datenbank?sort=titel' && neueRoute.length === 1, [t.aufrufe, neueRoute.length])
pruefe('ersetze behält den offenen Titel (Schalter schließen das Panel nicht)', neueRoute[0]?.title === 15957, neueRoute[0]?.title)
t = umgebung('/', '#/datenbank?t=15957')
schreiber(route(15957), (r) => void neueRoute.push(r), () => t.umg).ersetze({ view: 'datenbank', sort: 'titel' })
pruefe('… an der Wurzel steht der Titel weiter im Hash', t.aufrufe[0]![1] === '/#/datenbank?t=15957&sort=titel', t.aufrufe)
t = umgebung('/t/15957/', '#/woche')
schreiber(route(15957), (r) => void neueRoute.push(r), () => t.umg).navigate({ view: 'datenbank' })
pruefe('navigate setzt den Hash ohne t=', t.umg.ort.hash === '#/datenbank', t.umg.ort.hash)
neueRoute.length = 0
t = umgebung('/', '#/woche?t=15957')
schreiber(route(15957), (r) => void neueRoute.push(r), () => t.umg).navigate({})
pruefe('navigate behält den offenen Titel', neueRoute.length === 1 && neueRoute[0]!.title === 15957, neueRoute.map((r) => r.title))
t = umgebung('/t/15957/', '#/woche', { panel: true })
schreiber(route(15957), (r) => void neueRoute.push(r), () => t.umg).navigate({ title: undefined })
pruefe('navigate kennt das offene Panel: Schließen geht einen Schritt zurück', t.aufrufe.length === 1 && t.aufrufe[0]![0] === 'zurueck', t.aufrufe)

/*
  Der Hook selbst läuft nicht ohne React und Vite; seine Zeilen reichen nur durch. Geprüft wird der Syntaxbaum von `useRoute`
  (kein Regex): `schreiber(route, setRoute, browser)` bekommt die Route unverändert, `onChange` ruft `liesAdresse` unmittelbar.
*/
function aufrufeIn(funktion: string, name: string): ts.CallExpression[] {
  const quelle = ts.createSourceFile('router.ts', readFileSync('web/src/lib/router.ts', 'utf8'), ts.ScriptTarget.Latest, true)
  const treffer: ts.CallExpression[] = []
  const suche = (n: ts.Node, innen: boolean): void => {
    const jetzt = innen || (ts.isFunctionDeclaration(n) && n.name?.text === funktion)
    if (jetzt && ts.isCallExpression(n) && n.expression.getText() === name) treffer.push(n)
    n.forEachChild((k) => suche(k, jetzt))
  }
  suche(quelle, false)
  return treffer
}
const schreiberAufrufe = aufrufeIn('useRoute', 'schreiber')
pruefe('useRoute reicht die Route unverändert an schreiber', schreiberAufrufe.length === 1 && schreiberAufrufe[0]!.arguments.map((a) => a.getText()).join('|') === 'route|setRoute|browser', schreiberAufrufe.map((a) => a.getText()))
function bezeichnerIn(funktion: string, name: string): ts.Identifier[] {
  const quelle = ts.createSourceFile('router.ts', readFileSync('web/src/lib/router.ts', 'utf8'), ts.ScriptTarget.Latest, true)
  const treffer: ts.Identifier[] = []
  const suche = (n: ts.Node, innen: boolean): void => {
    const jetzt = innen || (ts.isFunctionDeclaration(n) && n.name?.text === funktion)
    if (jetzt && ts.isIdentifier(n) && n.text === name) treffer.push(n)
    n.forEachChild((k) => suche(k, jetzt))
  }
  suche(quelle, false)
  return treffer
}
function rueckgabenIn(funktion: string): string[] {
  const quelle = ts.createSourceFile('router.ts', readFileSync('web/src/lib/router.ts', 'utf8'), ts.ScriptTarget.Latest, true)
  const treffer: string[] = []
  const suche = (n: ts.Node): void => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === funktion) {
      const sammle = (k: ts.Node): void => {
        if (ts.isReturnStatement(k) && k.expression) treffer.push(k.expression.getText())
        if (!ts.isFunctionLike(k) || k === n) k.forEachChild(sammle)
      }
      sammle(n)
    }
    n.forEachChild(suche)
  }
  suche(quelle)
  return treffer
}
/* Das Ergebnis jenes einen Aufrufs ist der Initialisierer von `{ navigate, ersetze }` (ohne Umbenennung), und `useRoute` gibt sie in dieser Reihenfolge zurück. */
const deklaration = schreiberAufrufe[0]?.parent
const bindung = deklaration && ts.isVariableDeclaration(deklaration) && deklaration.initializer === schreiberAufrufe[0] ? deklaration.name : undefined
const namen = bindung && ts.isObjectBindingPattern(bindung) ? bindung.elements.map((e) => (e.propertyName ? '!' : '') + e.name.getText()).join('|') : undefined
pruefe('schreiber-Ergebnis wird als { navigate, ersetze } gebunden', namen === 'navigate|ersetze', namen)
pruefe('schreiber kommt in useRoute nur einmal vor', bezeichnerIn('useRoute', 'schreiber').length === 1)
const rueckgaben = rueckgabenIn('useRoute')
pruefe('useRoute gibt [route, navigate, ersetze] zurück', rueckgaben.length === 1 && rueckgaben[0] === '[route, navigate, ersetze]', rueckgaben)
/* Bindung (dieselbe Deklaration wie oben, Vergleich über die Stelle) und Rückgabe sind die letzten beiden direkten Anweisungen,
   die Bindung `const`: dazwischen kann nichts vertauschen oder verdecken. */
function schlussVon(funktion: string): ts.Statement[] {
  const quelle = ts.createSourceFile('router.ts', readFileSync('web/src/lib/router.ts', 'utf8'), ts.ScriptTarget.Latest, true)
  const rumpf = quelle.statements.find((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === funktion)?.body
  return rumpf ? rumpf.statements.slice(-2) : []
}
const [vorletzte, letzte] = schlussVon('useRoute')
const liste = vorletzte && ts.isVariableStatement(vorletzte) ? vorletzte.declarationList : undefined
pruefe('die Bindung ist const und die vorletzte Anweisung von useRoute', liste !== undefined && (liste.flags & ts.NodeFlags.Const) !== 0 && liste.declarations.length === 1 && liste.declarations[0]!.pos === deklaration?.pos, vorletzte?.getText())
pruefe('die Rückgabe ist die letzte Anweisung von useRoute', letzte !== undefined && ts.isReturnStatement(letzte) && letzte.expression?.getText() === '[route, navigate, ersetze]', letzte?.getText())
const liesAufrufe = aufrufeIn('useRoute', 'liesAdresse')
pruefe('onChange ruft liesAdresse als ganzen Rumpf auf', liesAufrufe.length === 1 && ts.isArrowFunction(liesAufrufe[0]!.parent) && liesAufrufe[0]!.arguments.map((a) => a.getText()).join('|') === 'browser()|setRoute', liesAufrufe.map((a) => a.parent.getText()))
/* Verdecken: jede Deklaration gleichen Namens in useRoute (auch im useEffect-Rumpf) erhöht die Zählung und macht sie rot. */
const browserZahl = bezeichnerIn('useRoute', 'browser').length
const liesZahl = bezeichnerIn('useRoute', 'liesAdresse').length
pruefe('browser kommt in useRoute genau zweimal vor (Argument, onChange), nie deklariert', browserZahl === 2, browserZahl)
pruefe('liesAdresse kommt in useRoute genau einmal vor (Aufruf), nie deklariert', liesZahl === 1, liesZahl)

console.log('\nvorliebenNachfuehren (über navigate):')
const speicher = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: (k: string) => speicher.get(k) ?? null, setItem: (k: string, v: string) => void speicher.set(k, v) },
})
t = umgebung('/', '#/woche')
schreiber(route(), () => undefined, () => t.umg).navigate({ filters: { ...EMPTY_FILTERS, favoritesOnly: true } })
pruefe('ein umgelegter Schnellfilter wird zur Vorliebe', [...speicher.values()].some((v) => v.includes('"favoritesOnly":true')), [...speicher.values()])

const mitSuche = { ...route(), view: 'datenbank', filters: { ...EMPTY_FILTERS, search: 'naruto' } } as AppRoute
t = umgebung('/', '#/woche')
const gesetzteRoute: AppRoute[] = []
schreiber(mitSuche, (r) => void gesetzteRoute.push(r), () => t.umg).navigate({ view: 'woche' })
pruefe('navigate in den Kalender lässt die Datenbank-Suche zurück', gesetzteRoute.length === 1 && gesetzteRoute[0]!.filters.search === '', gesetzteRoute.map((r) => r.filters.search))

console.log('\nhashAufraeumen schreibt unter /t/<id>/ kein t= zurück:')
const gelesen: AppRoute[] = []
const aufraeumen = (pathname: string, hash: string) => {
  const u = umgebung(pathname, hash)
  liesAdresse(u.umg, (r) => void gelesen.push(r))
  return u.aufrufe
}
pruefe('alte Ansicht #/agenda?t=15957 unter /t/15957/ → #/woche', JSON.stringify(aufraeumen('/t/15957/', '#/agenda?t=15957')) === '[["ersetzt","/t/15957/#/woche"]]', aufraeumen('/t/15957/', '#/agenda?t=15957'))
pruefe('veraltetes r= → ohne t=', JSON.stringify(aufraeumen('/t/15957/', '#/woche?r=abc&t=15957')) === '[["ersetzt","/t/15957/#/woche"]]', aufraeumen('/t/15957/', '#/woche?r=abc&t=15957'))
pruefe('Kalenderfilter in der Woche fällt weg, t= bleibt weg', JSON.stringify(aufraeumen('/t/15957/', '#/woche?q=x&t=15957')) === '[["ersetzt","/t/15957/#/woche"]]', aufraeumen('/t/15957/', '#/woche?q=x&t=15957'))
pruefe('an der Wurzel bleibt t= (der Pfad trägt den Titel nicht)', JSON.stringify(aufraeumen('/', '#/agenda?t=15957')) === '[["ersetzt","/#/woche?t=15957"]]', aufraeumen('/', '#/agenda?t=15957'))
pruefe('Datenbank-Filter in der Datenbank bleiben stehen', aufraeumen('/t/15957/', '#/datenbank?q=x&t=15957').length === 0)
pruefe('saubere Adresse: nichts wird geschrieben', aufraeumen('/t/15957/', '#/woche').length === 0)
gelesen.length = 0
liesAdresse(umgebung('/t/15957/', '#/woche').umg, (r) => void gelesen.push(r))
pruefe('liesAdresse setzt die Route mit dem Titel aus dem Pfad', gelesen.length === 1 && gelesen[0]!.title === 15957, gelesen.map((r) => r.title))

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAdresse schreiben: alle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
