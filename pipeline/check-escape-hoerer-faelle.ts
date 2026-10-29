/** Fälle für `findeRoheEscapeHoerer` und `bewerte` (check-escape-hoerer): was als roher Escape-Hörer gilt und was nicht. */
import { bewerte } from './check-escape-hoerer.ts'
import { findeRoheEscapeHoerer } from './lib/escape-hoerer.ts'

const schlecht: [string, string, number[]][] = [
  ['Handler inline', "document.addEventListener('keydown', (e) => e.key === 'Escape' && zu())", [1]],
  ['Handler als Name, Rumpf mit Escape', "const taste = (e: KeyboardEvent) => e.key === 'Escape' && zu()\nwindow.addEventListener('keydown', taste)", [2]],
  ['Handler als function-Name', "function taste(e: KeyboardEvent) { if (e.key === 'Escape') zu() }\nwindow.addEventListener('keydown', taste)", [2]],
  ['Fangphase', "document.addEventListener('keydown', esc, true)\nconst esc = (e: KeyboardEvent) => e.key === 'Escape'", [1]],
  ['keyup', "window.addEventListener('keyup', (e) => { if (e.key !== 'Escape') return; zu() })", [1]],
  ['keypress', "window.addEventListener('keypress', (e) => e.key === 'Escape' && zu())", [1]],
  ['Zugriff über Klammern', "window['addEventListener']('keydown', (e) => e.key === 'Escape' && zu())", [1]],
  ['Vorlage ohne Platzhalter', 'document.addEventListener(`keydown`, (e) => e.key === `Escape` && zu())', [1]],
  ['Escape nur in der umgebenden Funktion', "function f() {\n  const w = (e: KeyboardEvent) => ende(e)\n  const k = 'Escape'\n  window.addEventListener('keydown', w)\n}", [4]],
  ['zwei Hörer', "a.addEventListener('keydown', (e) => e.key === 'Escape')\nb.addEventListener('keydown', (e) => e.key === 'Escape')", [1, 2]],
]
const gut: [string, string][] = [
  ['andere Taste', "window.addEventListener('keydown', (e) => e.key === 'ArrowDown' && runter())"],
  ['Escape bei anderem Ereignis', "window.addEventListener('click', () => ende('Escape'))"],
  ['React-Handler am Element', "<div onKeyDown={(e) => e.key === 'Escape' && zu()} />"],
  ['der Helfer wird gerufen', "useEscape(offen, () => zu(), { ziel: 'document' })"],
  ['Name ohne Escape', "const taste = (e: KeyboardEvent) => e.key === 'a' && x()\nwindow.addEventListener('keydown', taste)"],
  ['Kommentar nennt Escape', "// Escape schließt\nwindow.addEventListener('keydown', (e) => e.key === 'a' && x())"],
]

let fehler = 0
for (const [name, text, soll] of schlecht) {
  const ist = findeRoheEscapeHoerer(text, 'x.tsx')
  if (ist.join() !== soll.join()) { fehler++; console.error(`FEHLER: ${name}: Zeilen ${ist.join() || '-'} statt ${soll.join()}`) }
}
for (const [name, text] of gut) {
  const ist = findeRoheEscapeHoerer(text, 'x.tsx')
  if (ist.length) { fehler++; console.error(`FEHLER: ${name}: fälschlich gemeldet (Zeile ${ist.join()})`) }
}

const HELFER = 'web/src/lib/escape.ts'
const ROH = "document.addEventListener('keydown', (e) => e.key === 'Escape' && zu())"
const fall = (dateien: Record<string, string>) => bewerte(Object.keys(dateien), (d) => dateien[d])
const gesamt: [string, Record<string, string>, number][] = [
  ['sauberer Bestand', { [HELFER]: ROH, 'web/src/a.tsx': 'useEscape(true, zu)' }, 0],
  ['roher Hörer in einer Komponente', { [HELFER]: ROH, 'web/src/a.tsx': ROH }, 1],
  ['Helfer fehlt', { 'web/src/a.tsx': 'useEscape(true, zu)' }, 1],
  ['Helfer ohne Hörer (blind)', { [HELFER]: 'export const x = 1', 'web/src/a.tsx': 'useEscape(true, zu)' }, 1],
  ['Helfer mit zwei Hörern', { [HELFER]: `${ROH}\n${ROH}` }, 1],
  ['ein roher Hörer je Datei, drei Dateien', { [HELFER]: ROH, 'web/src/a.tsx': ROH, 'web/src/b.tsx': ROH, 'web/src/c.tsx': ROH }, 3],
]
for (const [name, dateien, soll] of gesamt) {
  const ist = fall(dateien).length
  if (ist !== soll) { fehler++; console.error(`FEHLER: ${name}: ${ist} Meldungen statt ${soll}`) }
}

console.log(`check-escape-hoerer-faelle: ${fehler ? 'FEHLER' : 'ok'} (${schlecht.length} Hörer-Formen, ${gut.length} Gegenfälle, ${gesamt.length} Bestandsfälle)`)
process.exit(fehler ? 1 : 0)
