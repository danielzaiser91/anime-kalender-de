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
const stand = (kopf, ...zeilen) => ['# Stand', `## In Arbeit${kopf}`, ...zeilen, '', '## Als Nächstes', ...hand(40, '🔵 '), ''].join('\n')
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
assert.equal(w.waechter('# Stand\n## Als Nächstes\n- 🔵 x\n', JETZT), '', 'kein Abschnitt')
assert.equal(w.waechter('', JETZT), '', 'leere Datei')
// Der Stand einer anderen Überschrift zählt nicht
assert.match(w.waechter(['## In Arbeit', '- x', '## Andere (Stand 20.10.2026 11:00)'].join('\n'), JETZT), /ohne „Stand/)

// „Als Nächstes“: Zeilenzahl, Länge, Icon
const naechstes = (...zeilen) => ['# Stand', `## In Arbeit${FRISCH}`, '## Als Nächstes (Todo)', ...zeilen, '## Erledigt', ...hand(200)].join('\n')
const icons = (n) => Array.from({ length: n }, (_, i) => `- 🔴 Z${i}`)
const lang = (n, titel = 'Titel') => `- 🟠 **${titel}** ` + 'x'.repeat(n - `- 🟠 **${titel}** `.length)
const ZU_LANG = 'Als Nächstes: 1 Zeile (Titel) länger als 400 Zeichen — kürzen'
const OHNE = (was) => `Als Nächstes: ${was} ohne Dringlichkeits-Icon`
assert.equal(lang(400).length, 400)
assert.equal(w.waechter(naechstes(...icons(80)), JETZT), '', '80 Zeilen')
assert.equal(w.waechter(naechstes(...icons(81)), JETZT), 'Als Nächstes: 81 Zeilen (erlaubt 80) — Sammelzeilen je Thema bilden, Erledigtes streichen', '81 Zeilen')
assert.equal(w.waechter(naechstes(...icons(1)), JETZT), '', 'eine Zeile')
assert.equal(w.waechter(naechstes(lang(400)), JETZT), '', '400 Zeichen')
assert.equal(w.waechter(naechstes(lang(401)), JETZT), ZU_LANG, '401 Zeichen, Fett-Titel')
const ohneFett = '- 🔵 ' + 'y'.repeat(500)
assert.equal(w.waechter(naechstes(ohneFett), JETZT), `Als Nächstes: 1 Zeile (${ohneFett.slice(0, 50)}) länger als 400 Zeichen — kürzen`, 'ohne Fett: Anfang 50 Zeichen')
for (const icon of ['🔴', '🟠', '🔵', '📅', '⏳', '🚫']) assert.equal(w.waechter(naechstes(`- ${icon} x`), JETZT), '', `Icon ${icon}`)
assert.equal(w.waechter(naechstes('- **Ohne** Icon'), JETZT), OHNE('1 Zeile (Ohne)'), 'ohne Icon')
assert.equal(w.waechter(naechstes('- ohne Fett und ohne Icon'), JETZT), OHNE('1 Zeile (- ohne Fett und ohne Icon)'))
assert.equal(w.waechter(naechstes('- x 🔴'), JETZT), OHNE('1 Zeile (- x 🔴)'), 'Icon nicht am Anfang')
assert.equal(w.waechter(naechstes('  - eingerückt', 'Fließtext', '', '---'), JETZT), '', 'Details und Fließtext zählen nicht')
// Aufzählung: zwei Zeilen genannt, vier gekürzt auf drei mit „u. a.“
assert.equal(w.waechter(naechstes('- 🔴 ok', '- a', '- b'), JETZT), OHNE('2 Zeilen (- a, - b)'), 'zwei Zeilen')
assert.equal(w.waechter(naechstes('- a', '- b', '- c'), JETZT), OHNE('3 Zeilen (- a, - b, - c)'), 'drei ohne „u. a.“')
assert.equal(w.waechter(naechstes('- a', '- b', '- c', '- d'), JETZT), OHNE('4 Zeilen (- a, - b, - c u. a.)'), 'vier mit „u. a.“')
assert.equal(
  w.waechter(naechstes(lang(401, 'A'), lang(402, 'B'), lang(403, 'C'), lang(404, 'D')), JETZT),
  'Als Nächstes: 4 Zeilen (A, B, C u. a.) länger als 400 Zeichen — kürzen',
  'lange Zeilen gekürzt',
)
assert.equal(
  w.waechter(naechstes('- **Beides** ' + 'x'.repeat(450)), JETZT),
  `Als Nächstes: 1 Zeile (Beides) länger als 400 Zeichen — kürzen; ${OHNE('1 Zeile (Beides)')}`,
)
// Abschnitt am Dateiende, ohne „In Arbeit“, CRLF, Zusammenspiel mit „In Arbeit“
assert.equal(w.waechter(['## Als Nächstes', ...icons(81)].join('\n'), JETZT).slice(0, 30), 'Als Nächstes: 81 Zeilen (erlau', 'letzter Abschnitt, ohne In Arbeit')
assert.equal(w.waechter(naechstes('- ohne').split('\n').join('\r\n'), JETZT), OHNE('1 Zeile (- ohne)'), 'CRLF')
assert.equal(w.waechter(stand(FRISCH, ...hand(21)).replace('- 🔵 Hand 0', '- Hand 0'), JETZT), `${OHNE('1 Zeile (- Hand 0)')}; 21 Handzeilen (erlaubt 20) — aufräumen`, 'beide Abschnitte')

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
  assert.deepEqual(JSON.parse(h.ausgabe(laut)), { systemMessage: `stand.md: ${laut.warnung}` })
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
  const nachste = lauf(stand(FRISCH, ...hand(3)).replace('- 🔵 Hand 0', '- Hand 0'), JETZT + 90 * 60000)
  assert.equal(nachste.warnung, OHNE('1 Zeile (- Hand 0)'), 'Lauf meldet auch Als Nächstes')
  const beides = h.ausgabe({ ergebnis: 'nicht geschrieben: x', laut: true, warnung: 'w' })
  assert.deepEqual(JSON.parse(beides), { systemMessage: 'stand-prs.js: nicht geschrieben: x (stand.md, Abschnitt „In Arbeit“)\nstand.md: w' })
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
console.log('stand-waechter.test: ok (20/21 Handzeilen, Als Nächstes 80/81 Zeilen und 400/401 Zeichen, Icon, Block zählt nicht, Alter 24 h Sommer/Winter, ohne Stand, Lauf meldet)')
