/**
 * Test für `tools/amazon-tdz-pruefen.cjs`: Fälle, in denen früh angemeldeter Code eine nach dem
 * Warte-`await` deklarierte Bindung berührt (Fundstelle) bzw. nicht (kein Fund).
 * Aufruf: node tools/amazon-tdz-pruefen.test.mjs
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

const { befunde } = createRequire(import.meta.url)('./amazon-tdz-pruefen.cjs')

/** Rumpf zwischen Kopf und `await`: der Wächter sucht die async-IIFE und ihr erstes await. */
const skript = (vorher, nachher) => `;(async () => {\n${vorher}\n  const id = await new Promise((f) => setInterval(() => f(1), 1))\n${nachher}\n})()\n`

let fehler = 0
const pruefe = (name, ok) => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}`)
  if (!ok) fehler++
}
const zahl = (quelle) => befunde(quelle).length

pruefe('Hörer liest const nach dem await: Fund', zahl(skript('  function hoerer() { return spaet }\n  window.addEventListener("m", hoerer)', '  const spaet = 1')) === 1)
pruefe('Hörer als Pfeil im Aufruf: Fund', zahl(skript('  window.addEventListener("m", () => spaet)', '  const spaet = 1')) === 1)
pruefe('Schreibzugriff auf let nach dem await: Fund', zahl(skript('  window.addEventListener("m", () => { spaet = 2 })', '  let spaet = 1')) === 1)
pruefe('class nach dem await: Fund', zahl(skript('  setTimeout(() => new Spaet())', '  class Spaet {}')) === 1)
pruefe('im try/catch verschluckt zählt trotzdem', zahl(skript('  window.addEventListener("m", () => { try { return spaet } catch { return 0 } })', '  const spaet = 1')) === 1)
pruefe('über Funktionsdeklaration nach dem await (hochgezogen): Fund', zahl(skript('  setTimeout(() => innen())', '  const spaet = 1\n  function innen() { return spaet }')) === 1)
pruefe('zwei Schritte über Aufrufkette: Fund', zahl(skript('  setTimeout(() => a())', '  const spaet = 1\n  function a() { return b() }\n  function b() { return spaet }')) === 1)
pruefe('Deklaration VOR dem await: kein Fund', zahl(skript('  const frueh = 1\n  setTimeout(() => frueh)', '')) === 0)
pruefe('let vorab deklariert, nach dem await nur zugewiesen: kein Fund', zahl(skript('  let x\n  setTimeout(() => x)', '  x = 1')) === 0)
pruefe('späte Bindung nur in spät angemeldetem Code: kein Fund', zahl(skript('', '  const spaet = 1\n  setTimeout(() => spaet)')) === 0)
pruefe('späte Funktion nie früh erreicht: kein Fund', zahl(skript('  setTimeout(() => 1)', '  const spaet = 1\n  function spaeter() { return spaet }\n  spaeter()')) === 0)
pruefe('lokale Variable gleichen Namens verdeckt: kein Fund', zahl(skript('  setTimeout(() => { const spaet = 3; return spaet })', '  const spaet = 1')) === 0)
pruefe('Initialisierung der späten Bindung selbst zählt nicht', zahl(skript('', '  const spaet = 1')) === 0)
pruefe('Zeile und Weg stehen im Befund', /spaet \(Zeile 4\) benutzt in Zeile 5 \[früh angemeldet > innen\]/.test(befunde(skript('  setTimeout(() => innen())', '  const spaet = 1\n  function innen() { return spaet }'))[0] ?? ''))
pruefe('früh erreichte späte Funktion meldet Rückruf mit später Bindung an: Fund', zahl(skript('  setTimeout(() => reg())', '  const spaet = 1\n  function reg() { window.addEventListener("m", () => spaet) }')) === 1)
pruefe('früh erreichte späte Funktion, Rückruf ohne späte Bindung: kein Fund', zahl(skript('  setTimeout(() => reg())', '  const spaet = 1\n  function reg() { window.addEventListener("m", () => 1) }\n  function spaeter() { return spaet }\n  spaeter()')) === 0)

/* Kein await im Skript: der Wächter wirft, statt still grün zu melden. */
let geworfen = false
try {
  befunde(';(async () => {\n  const a = 1\n})()\n')
} catch {
  geworfen = true
}
pruefe('Skript ohne await: Wurf statt grün', geworfen)

/* Der echte Quelltext ist sauber (die Kette fährt den Wächter selbst; hier die Verdrahtung auf die echte Datei). */
const echt = readFileSync('extension/amazon.js', 'utf8')
pruefe('extension/amazon.js: keine Fundstelle', zahl(echt) === 0)

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt` : `\n✔ amazon-tdz-pruefen.test: alle Zusicherungen erfüllt`)
process.exit(fehler ? 1 : 0)
