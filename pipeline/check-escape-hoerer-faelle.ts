/** Fälle für `findeTastenHoerer` und `bewerte` (check-escape-hoerer): was als Tastenhörer gilt und was nicht. */
import { bewerte } from './check-escape-hoerer.ts'
import { findeTastenHoerer, textKonstanten } from './lib/escape-hoerer.ts'

/** Der Hook aus Leinwand.tsx vor PR 2386 (Tabelle statt `'Escape'` im Handler, kein Schutz vor einem Kino darüber). */
const LEINWAND_ALT = `function useZurueckTaste(zurueck: () => void) {
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      const aktion = tasteZuAktion({ key: e.key, altKey: e.altKey, ziel: '' })
      fuehreTasteAus(aktion, { zurueck })
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  })
}`

const schlecht: [string, string, number[]][] = [
  ['Handler inline', "document.addEventListener('keydown', (e) => e.key === 'Escape' && zu())", [1]],
  ['Handler als Name, Rumpf mit Escape', "const taste = (e: KeyboardEvent) => e.key === 'Escape' && zu()\nwindow.addEventListener('keydown', taste)", [2]],
  ['Fangphase', "document.addEventListener('keydown', esc, true)\nconst esc = (e: KeyboardEvent) => e.key === 'Escape'", [1]],
  ['keyup', "window.addEventListener('keyup', (e) => { if (e.key !== 'Escape') return; zu() })", [1]],
  ['keypress', "window.addEventListener('keypress', (e) => e.key === 'Escape' && zu())", [1]],
  ['Zugriff über Klammern', "window['addEventListener']('keydown', (e) => e.key === 'Escape' && zu())", [1]],
  ['Vorlage ohne Platzhalter', 'document.addEventListener(`keydown`, (e) => e.key === `Escape` && zu())', [1]],
  ['andere Taste, kein Escape im Handler', "window.addEventListener('keydown', (e) => e.key === 'ArrowDown' && runter())", [1]],
  ['zwei Hörer', "a.addEventListener('keydown', (e) => e.key === 'Escape')\nb.addEventListener('keydown', (e) => e.key === 'Escape')", [1, 2]],
  ['Hörer nach JSX mit Rückquote im Text (nur als TSX lesbar)', "const a = <p>a ` b</p>\nwindow.addEventListener('keydown', (e) => e.key === 'Escape' && zu())", [2]],
  ['keyCode statt key', "document.addEventListener('keydown', (e) => e.keyCode === 27 && zu())", [1]],
  ['key === Esc', "document.addEventListener('keydown', (e) => e.key === 'Esc' && zu())", [1]],
  ['Taste aus Import', "import { ESC } from './tasten'\ndocument.addEventListener('keydown', (e) => e.key === ESC && zu())", [2]],
  ['Ereignisname aus unbekannter Variable', 'document.addEventListener(EV, (e) => zu(e))', [1]],
  ['Ereignisname aus Vorlage mit Platzhalter', 'document.addEventListener(`${art}down`, (e) => zu(e))', [1]],
  ['Ereignisname aus Konstante mit Taste', "const EV = 'keydown'\ndocument.addEventListener(EV, (e) => zu(e))", [2]],
  ['document.onkeydown', 'document.onkeydown = (e) => e.key === `Escape` && zu()', [1]],
  ['window.onkeyup über Klammern', "window['onkeyup'] = (e) => zu(e)", [1]],
  ['Alias per bind', "const add = window.addEventListener.bind(window)\nadd('keydown', (e) => zu(e))", [1]],
  ['Alias per Destrukturierung', "const { addEventListener: add } = window\nadd('keydown', zu)", [1]],
  ['Alias per Destrukturierung ohne Umbenennung', "const { addEventListener } = document\naddEventListener('keydown', zu)", [1]],
  ['Zugriff über Klammern an einem Element', "el['addEventListener']('keydown', zu)", [1]],
  ['gleicher Name zweimal in einer Datei, Taste zuerst', "function a() { const EV = 'keydown'; return EV }\nfunction b() { const EV = 'click'; return EV }\ndocument.addEventListener(EV, zu)", [3]],
  ['Zugriff auf window mit berechnetem Namen', "window['add' + 'EventListener']('keydown', zu)", [1]],
  ['Zugriff auf document mit berechnetem Namen', "document[nameVon()]('keydown', zu)", [1]],
  ['Zugriff auf globalThis mit berechnetem Namen', "globalThis[nameVon()]('keydown', zu)", [1]],
  ['Zugriff auf self mit berechnetem Namen', "self[nameVon()]('keydown', zu)", [1]],
  ['window.onkeypress', 'window.onkeypress = (e) => zu(e)', [1]],
  ['Aufruf mit einem Argument', "window.addEventListener('keydown')", [1]],
  ['Tabellen-Hörer ohne Escape im Handler', "const T = { Escape: zu }\nwindow.addEventListener('keydown', (e) => T[e.key]?.())", [2]],
  ['Leinwand vor der Umstellung', LEINWAND_ALT, [7]],
]
const gut: [string, string][] = [
  ['Escape bei anderem Ereignis', "window.addEventListener('click', () => ende('Escape'))"],
  ['React-Handler am Element', "<div onKeyDown={(e) => e.key === 'Escape' && zu()} />"],
  ['der Helfer wird gerufen', "useEscape(offen, () => zu(), { ziel: 'document' })"],
  ['Vorlage ohne Platzhalter, kein Tastenname', 'window.addEventListener(`click`, zu)'],
  ['Abhängen zählt nicht', "window.removeEventListener('keydown', taste)"],
  ['Ereignisname aus Konstante ohne Taste', "const EV = 'ak-zu-heute'\nwindow.addEventListener(EV, spaeter)"],
  ['Kommentar nennt Tastenhörer', "// window.addEventListener('keydown', taste)\nwindow.addEventListener('scroll', x)"],
  ['Zeichenkette nennt addEventListener', 'const t = "addEventListener(keydown)"'],
]

let fehler = 0
for (const [name, text, soll] of schlecht) {
  const ist = findeTastenHoerer(text, 'x.tsx', textKonstanten(text, 'x.tsx'))
  if (ist.join() !== soll.join()) { fehler++; console.error(`FEHLER: ${name}: Zeilen ${ist.join() || '-'} statt ${soll.join()}`) }
}
for (const [name, text] of gut) {
  const ist = findeTastenHoerer(text, 'x.tsx', textKonstanten(text, 'x.tsx'))
  if (ist.length) { fehler++; console.error(`FEHLER: ${name}: fälschlich gemeldet (Zeile ${ist.join()})`) }
}
const ev = (werte: string[]) => findeTastenHoerer('document.addEventListener(EV, zu)', 'x.tsx', new Map([['EV', new Set(werte)]])).length
if (ev(['click'])) { fehler++; console.error('FEHLER: Konstante (click): fälschlich gemeldet') }
if (ev(['click', 'keyup']) !== 1) { fehler++; console.error('FEHLER: Konstante (click oder keyup): nicht gemeldet') }

const HELFER = 'web/src/lib/escape.ts'
const ROH = "document.addEventListener('keydown', (e) => e.key === 'Escape' && zu())"
const SAUBER = 'useEscape(true, zu)'
const AUSNAHMEN = { 'web/src/App.tsx': 'Pfeiltasten' }
const gesamt: [string, Record<string, string>, number, Record<string, string>?][] = [
  ['sauberer Bestand', { [HELFER]: ROH, 'web/src/a.tsx': SAUBER }, 0],
  ['roher Hörer in einer Komponente', { [HELFER]: ROH, 'web/src/a.tsx': ROH }, 1],
  ['Helfer fehlt', { 'web/src/a.tsx': SAUBER }, 1],
  ['Helfer ohne Hörer (blind)', { [HELFER]: 'export const x = 1', 'web/src/a.tsx': SAUBER }, 1],
  ['Helfer mit zwei Hörern', { [HELFER]: `${ROH}\n${ROH}` }, 1],
  ['ein roher Hörer je Datei, drei Dateien', { [HELFER]: ROH, 'web/src/a.tsx': ROH, 'web/src/b.tsx': ROH, 'web/src/c.tsx': ROH }, 3],
  ['Ausnahme mit Hörer: keine Meldung', { [HELFER]: ROH, 'web/src/App.tsx': ROH }, 0],
  ['Ausnahme entfernt: dieselbe Datei meldet', { [HELFER]: ROH, 'web/src/App.tsx': ROH }, 1, {}],
  ['Ausnahme ohne Hörer: veralteter Eintrag meldet', { [HELFER]: ROH, 'web/src/App.tsx': SAUBER }, 1],
  ['Ausnahme gilt nur für ihre Datei', { [HELFER]: ROH, 'web/src/App.tsx': ROH, 'web/src/b.tsx': ROH }, 1],
  ['Konstante aus anderer Datei, Tastenname', { [HELFER]: ROH, 'web/src/k.ts': "export const EV = 'keydown'", 'web/src/a.tsx': 'document.addEventListener(EV, zu)' }, 1],
  ['gleicher Name in zwei Dateien, Taste zuerst', { [HELFER]: ROH, 'web/src/k1.ts': "export const EV = 'keydown'", 'web/src/k2.ts': "export const EV = 'ak-klick'", 'web/src/a.tsx': 'document.addEventListener(EV, zu)' }, 1],
  ['Konstante aus anderer Datei, Klick', { [HELFER]: ROH, 'web/src/k.ts': "export const EV = 'ak-klick'", 'web/src/a.tsx': 'document.addEventListener(EV, zu)' }, 0],
]
for (const [name, dateien, soll, ausnahmen = AUSNAHMEN] of gesamt) {
  const ist = bewerte(Object.keys(dateien), (d) => dateien[d], ausnahmen).length
  if (ist !== soll) { fehler++; console.error(`FEHLER: ${name}: ${ist} Meldungen statt ${soll}`) }
}

console.log(`check-escape-hoerer-faelle: ${fehler ? 'FEHLER' : 'ok'} (${schlecht.length} Hörer-Formen, ${gut.length + 2} Gegenfälle, ${gesamt.length} Bestandsfälle)`)
process.exit(fehler ? 1 : 0)
