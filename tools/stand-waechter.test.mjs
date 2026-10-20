/**
 * Test für `tools/claude-global/hooks/stand-waechter.js` und seine Verdrahtung in stand-prs.js: „## In Arbeit“ in stand.md
 * darf höchstens 20 Handzeilen außerhalb des Auto-Blocks haben, und die Kopfzeile trägt einen Stand von höchstens 24 h.
 * Feste Zeit, Wegwerf-Dateien unter os.tmpdir().
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const w = require(join(import.meta.dirname, 'claude-global', 'hooks', 'stand-waechter.js'))
const h = require(join(import.meta.dirname, 'claude-global', 'hooks', 'stand-prs.js'))

const AUF = h.AUF
const ZU = h.ZU
const STUNDE = 3600000
const JETZT = Date.parse('2026-10-20T10:00:00Z') // 12:00 Berlin (Sommerzeit, UTC+2)
const hand = (n, vorsatz = '') => Array.from({ length: n }, (_, i) => `- ${vorsatz}Hand ${i}`)
const stand = (kopf, ...zeilen) => ['# Stand', `## In Arbeit${kopf}`, ...zeilen, '', '## Als Nächstes', ...hand(40), ''].join('\n')
const FRISCH = ' (Stand 20.10.2026 11:00; x)'

// Handzeilen: 20 genau erlaubt, 21 nicht (Schwelle mit 1 Überschuss)
assert.equal(w.waechter(stand(FRISCH, ...hand(20)), JETZT), '', '20 Zeilen')
assert.equal(w.waechter(stand(FRISCH, ...hand(21)), JETZT), '21 Handzeilen (erlaubt 20) — aufräumen', '21 Zeilen')
assert.equal(w.waechter(stand(FRISCH, ...hand(0)), JETZT), '', 'leerer Abschnitt')
// Block zählt nicht, auch nicht mit sehr vielen Zeilen; Handzeilen davor und danach schon
assert.equal(w.waechter(stand(FRISCH, ...hand(20), AUF, ...hand(60, 'PR '), ZU), JETZT), '', 'Block zählt nicht')
assert.equal(w.waechter(stand(FRISCH, ...hand(10), AUF, ...hand(60, 'PR '), ZU, ...hand(11)), JETZT), '21 Handzeilen (erlaubt 20) — aufräumen', 'vor und nach dem Block')
// Eingerückte Zeilen sind Details, andere Abschnitte zählen nicht
assert.equal(w.waechter(stand(FRISCH, ...hand(20), ...Array.from({ length: 9 }, () => '  - Detail')), JETZT), '', 'Details zählen nicht')
assert.equal(w.waechter(stand(FRISCH, ...hand(20), '---', '-kein Listenpunkt'), JETZT), '', 'Zeilen ohne „- “ zählen nicht')
// Abschnitt als letzter der Datei (kein „## “ dahinter)
assert.equal(w.waechter(['## In Arbeit' + FRISCH, ...hand(21)].join('\n'), JETZT), '21 Handzeilen (erlaubt 20) — aufräumen', 'letzter Abschnitt')
assert.equal(w.waechter(['## In Arbeit' + FRISCH, ...hand(20), '## Andere', ...hand(5)].join('\n'), JETZT), '', 'Zeilen nach dem Abschnitt zählen nicht')
// CRLF
assert.equal(w.waechter(stand(FRISCH, ...hand(21)).split('\n').join('\r\n'), JETZT), '21 Handzeilen (erlaubt 20) — aufräumen', 'CRLF')

// Alter der Kopfzeile: genau 24 h ok, 1 ms mehr nicht (Sommerzeit und Winterzeit getrennt)
const SOMMER = ' (Stand 19.10.2026 12:00; x)'
assert.equal(w.waechter(stand(SOMMER), JETZT), '', 'genau 24 h')
assert.equal(w.waechter(stand(SOMMER), JETZT + 1), 'Kopfzeile von 19.10. 12:00 ist älter als 24 h — Stand erneuern', '24 h und 1 ms')
assert.equal(w.waechter(stand(' (Stand 18.10.2026 10:56; x)'), JETZT), 'Kopfzeile von 18.10. 10:56 ist älter als 24 h — Stand erneuern', 'zwei Tage')
const WINTER = ' (Stand 10.01.2027 12:00; x)' // UTC+1
assert.equal(w.waechter(stand(WINTER), Date.parse('2027-01-11T11:00:00Z')), '', 'Winter: genau 24 h')
assert.match(w.waechter(stand(WINTER), Date.parse('2027-01-11T11:00:01Z')), /älter als 24 h/, 'Winter: 1 s mehr')
assert.equal(w.waechter(stand(' (Stand 31.12.2999 00:00)'), JETZT), '', 'Zukunft ist nicht alt')
// Kopfzeile ohne Stand, beides zugleich, kein Abschnitt
assert.equal(w.waechter(stand(' — bereinigt 14.10.'), JETZT), 'Kopfzeile ohne „Stand TT.MM.JJJJ HH:MM“', 'ohne Stand')
assert.equal(w.waechter(stand('', ...hand(21)), JETZT), '21 Handzeilen (erlaubt 20) — aufräumen; Kopfzeile ohne „Stand TT.MM.JJJJ HH:MM“', 'beides')
assert.equal(w.waechter('# Stand\n## Als Nächstes\n- x\n', JETZT), '', 'kein Abschnitt')
assert.equal(w.waechter('', JETZT), '', 'leere Datei')
// Der Stand einer anderen Überschrift zählt nicht
assert.match(w.waechter(['## In Arbeit', '- x', '## Andere (Stand 20.10.2026 11:00)'].join('\n'), JETZT), /ohne „Stand/)

// Verdrahtung: ein echter Lauf von stand-prs.js meldet über ausgabe(), schreibt aber trotzdem
const ordner = mkdtempSync(join(tmpdir(), 'stand-waechter-'))
try {
  const datei = join(ordner, 'stand.md')
  const env = { STAND_PRS_DATEI: datei, STAND_PRS_ZUSTAND: join(ordner, 'state', 'stand-prs.json') }
  const leer = JSON.stringify({ data: { repository: { offen: { pageInfo: { hasNextPage: false }, nodes: [] }, gemergt: { pageInfo: { hasNextPage: false }, nodes: [] } } } })
  const lauf = (text, t) => {
    writeFileSync(datei, text)
    return h.lauf({ jetzt: true }, { env, gh: () => leer, jetzt: t })
  }
  const ruhig = lauf(stand(FRISCH, ...hand(20)), JETZT)
  assert.equal(ruhig.warnung, undefined)
  assert.equal(h.ausgabe(ruhig), '', 'in Ordnung: still')
  const laut = lauf(stand(' (Stand 18.10.2026 10:56; x)', ...hand(21)), JETZT + 10 * 60000)
  assert.equal(laut.warnung, '21 Handzeilen (erlaubt 20) — aufräumen; Kopfzeile von 18.10. 10:56 ist älter als 24 h — Stand erneuern')
  assert.equal(laut.erfolg, true)
  assert.ok(readFileSync(datei, 'utf8').includes(AUF), 'der Block ist trotz Warnung geschrieben')
  assert.deepEqual(JSON.parse(h.ausgabe(laut)), { systemMessage: `stand.md, Abschnitt „In Arbeit“: ${laut.warnung}` })
  const unveraendert = h.lauf({ jetzt: true }, { env, gh: () => leer, jetzt: JETZT + 20 * 60000 })
  assert.equal(unveraendert.ergebnis, 'unverändert')
  assert.equal(unveraendert.warnung, laut.warnung, 'auch ein unveränderter Lauf meldet weiter')
  // Eine Handzeile im Block rückt unter ZU und zählt dann: gemessen wird am geschriebenen Text, nicht am alten
  const imBlock = lauf(stand(FRISCH, ...hand(20), AUF, '- Hand im Block', ZU), JETZT + 30 * 60000)
  assert.equal(imBlock.warnung, '21 Handzeilen (erlaubt 20) — aufräumen')
  // Abruf scheitert länger als 30 min (Block „veraltet“): die Warnung kommt trotzdem
  const kaputt = () => {
    throw new Error('gh: HTTP 502')
  }
  writeFileSync(datei, stand(' (Stand 18.10.2026 10:56; x)', ...hand(3)))
  const veraltet = h.lauf({ jetzt: true }, { env, gh: kaputt, jetzt: JETZT + 80 * 60000 })
  assert.equal(veraltet.ergebnis, 'veraltet: gh: HTTP 502')
  assert.equal(veraltet.warnung, 'Kopfzeile von 18.10. 10:56 ist älter als 24 h — Stand erneuern')
  const beides =h.ausgabe({ ergebnis: 'nicht geschrieben: x', laut: true, warnung: 'w' })
  assert.deepEqual(JSON.parse(beides), { systemMessage: 'stand-prs.js: nicht geschrieben: x (stand.md, Abschnitt „In Arbeit“)\nstand.md, Abschnitt „In Arbeit“: w' })
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
console.log('stand-waechter.test: ok (20/21 Handzeilen, Block zählt nicht, Alter 24 h Sommer/Winter, ohne Stand, Lauf meldet)')
