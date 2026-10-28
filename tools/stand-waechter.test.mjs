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

// „Top-Prios“: höchstens 5 Zeilen, kein {live}, kein Stand älter als 72 h (Daniel 27.10.2026: Kasten stand tagelang unverändert)
const prios = (...zeilen) => ['# Stand', '## Top-Prios (x)', ...zeilen, '  - Detail Stand 01.01.2020', '## In Arbeit' + FRISCH, '## Als Nächstes'].join('\n')
const ziel = (n) => Array.from({ length: n }, (_, i) => `- **Ziel ${i}** {arbeit-agent} x`)
assert.equal(w.waechter(prios(...ziel(5)), JETZT), '', '5 Ziele')
assert.equal(w.waechter(prios(...ziel(6)), JETZT), 'Top-Prios: 6 Zeilen (erlaubt 5) — Aufträge gehören nach „In Arbeit“ oder „Als Nächstes“', '6 Ziele')
assert.equal(w.waechter(prios('- **MOTN** {live} Fix live'), JETZT), 'Top-Prios: 1 Zeile (MOTN) live — erledigt, aus dem Kasten nehmen', '{live}')
assert.equal(w.waechter(prios('- **Live-Ansicht** {pipeline} live gemessen'), JETZT), '', '„live“ ohne Klammer')
const ALT = 'Top-Prios: 1 Zeile (Speed) mit Stand älter als 3 Tage — erneuern oder aus dem Kasten nehmen'
// JETZT = 20.10.2026 12:00 Berlin: 17.10. 12:00 genau 72 h, 11:59 eine Minute mehr; ohne Uhrzeit Mitternacht
assert.equal(w.waechter(prios('- **Speed** {pipeline} Stand 17.10. 12:00: x'), JETZT), '', 'genau 72 h')
assert.equal(w.waechter(prios('- **Speed** {pipeline} Stand 17.10. 11:59: x'), JETZT), ALT, '72 h und 1 min')
assert.equal(w.waechter(prios('- **Speed** Stand 17.10.: x'), JETZT), ALT, 'ohne Uhrzeit = 00:00')
assert.equal(w.waechter(prios('- **Speed** Stand 18.10.: x'), JETZT), '', 'ohne Uhrzeit, 60 h')
assert.equal(w.waechter(prios('- **Speed** Stand 17.10.2025 13:00 x'), JETZT), ALT, 'mit Jahr')
assert.equal(w.waechter(prios('- **Speed** ohne Datum'), JETZT), '', 'ohne Stand')
// Ohne Jahr über den Jahreswechsel: 30.12. am 01.01. ist das Vorjahr (2 Tage), nicht die Zukunft
const NEUJAHR = Date.parse('2027-01-01T11:00:00Z') // 12:00 Berlin (Winterzeit)
assert.equal(w.waechter('## Top-Prios\n- **Speed** Stand 30.12. 12:00', NEUJAHR), '', 'Jahreswechsel: Vorjahr, 48 h')
assert.equal(w.waechter('## Top-Prios\n- **Speed** Stand 28.12. 12:00', NEUJAHR), ALT, 'Jahreswechsel: Vorjahr, 96 h')
// Alles zugleich, Reihenfolge vor „Als Nächstes“; Zeilen anderer Abschnitte zählen nicht
assert.equal(
  w.waechter(prios(...ziel(5), '- **MOTN** {live} Stand 01.10.'), JETZT),
  'Top-Prios: 6 Zeilen (erlaubt 5) — Aufträge gehören nach „In Arbeit“ oder „Als Nächstes“; Top-Prios: 1 Zeile (MOTN) live — erledigt, aus dem Kasten nehmen; Top-Prios: 1 Zeile (MOTN) mit Stand älter als 3 Tage — erneuern oder aus dem Kasten nehmen',
  'alles zugleich',
)
assert.equal(w.waechter(['## Top-Prios', '## Andere', ...ziel(9), '- **X** {live}'].join('\n'), JETZT), '', 'andere Abschnitte')
// Jetzt-Zeilen: Kennung F<n>/E<n> und Grund mit Verb (kann/darf/soll nicht); 📅-Terminzeilen und Einrückungen zählen nicht
const jetzt = (...zeilen) => ['## Top-Prios', '### Jetzt', ...zeilen, '', '### Später', '- 🔵 **Spät** ohne Kennung', '## In Arbeit' + FRISCH].join('\n')
const OK = '- 🔵 **F74 Filterleiste?** (soll nicht: Gestaltung) — drei Entwürfe'
const KENNUNG = 'Jetzt: 1 Zeile (Form?) ohne Kennung F<n>/E<n>'
const GRUND = 'Jetzt: 1 Zeile (Form?) ohne Grund „kann/darf/soll nicht“'
assert.equal(w.waechter(jetzt(OK, '- 🟠 **E28 Dai melden** (kann nicht: Prime-Konto) → x', '- 🟠 **F3 X** (darf nicht: Geld)'), JETZT), '', 'korrekte Zeilen')
assert.equal(w.waechter(jetzt('- 🟠 **Dai melden** (kann nicht: Prime-Konto)'), JETZT), 'Jetzt: 1 Zeile (Dai melden) ohne Kennung F<n>/E<n>', 'ohne Kennung')
assert.equal(w.waechter(jetzt('- 🔵 **F75 Form?** — drei Entwürfe'), JETZT), GRUND.replace('Form?', 'F75 Form?'), 'ohne Grund')
assert.equal(w.waechter(jetzt('- 🔵 **Form?** — x'), JETZT), `${KENNUNG}; ${GRUND}`, 'beides fehlt')
assert.equal(w.waechter(jetzt(OK, '  - Detail ohne alles', '- 📅 **Do 05.11.** Termin'), JETZT), '', 'Unterzeile und Terminzeile')
assert.equal(w.waechter(jetzt('- 🔵 **EF1 Form?** (soll nicht: x)'), JETZT), KENNUNG.replace('Form?', 'EF1 Form?'), 'Kennung nur als ganzes Wort mit Ziffern')
assert.equal(w.waechter('### Jetzt\n- 🔵 **Form?**', JETZT), `${KENNUNG}; ${GRUND}`, 'letzter Abschnitt')
assert.equal(w.waechter(jetzt('- 🔵 **Form?**').replace('### Jetzt', '### Heute'), JETZT), '', 'anderer Abschnitt')
console.log('stand-waechter.test: ok (Jetzt-Zeilen Kennung/Grund, 20/21 Handzeilen, Als Nächstes 80/81 Zeilen und 400/401 Zeichen, Icon, Block zählt nicht, Alter 24 h Sommer/Winter, ohne Stand, Lauf meldet, Top-Prios 5/6, {live}, Stand 72 h)')
