/**
 * Test für `.claude/hooks/stand-waechter.js` und seine Verdrahtung in stand-prs.js: „## In Arbeit“ in stand.md
 * darf höchstens 20 Handzeilen außerhalb des Auto-Blocks haben, und die Kopfzeile trägt einen Stand von höchstens 24 h.
 * Feste Zeit, Wegwerf-Dateien unter os.tmpdir().
 */
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const w = require(join(import.meta.dirname, '..', '.claude', 'hooks', 'stand-waechter.js'))
const h = require(join(import.meta.dirname, '..', '.claude', 'hooks', 'stand-prs.js'))

const AUF = h.AUF
const ZU = h.ZU
const STUNDE = 3600000
const JETZT = Date.parse('2026-10-20T10:00:00Z') // 12:00 Berlin (Sommerzeit, UTC+2)
const KZ = " {eigen · normal · - · 01.10.}"
const hand = (n, vorsatz = "") => Array.from({ length: n }, (_, i) => `- ${vorsatz}Hand ${i}${KZ}`)
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
assert.equal(w.waechter('', JETZT), w.LEER, 'leere Datei')
assert.equal(w.waechter('\n\n', JETZT), w.LEER, 'nur Leerzeilen')
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
for (const icon of ['🔴', '🟠', '🔵', '📅', '⏳', '🚫']) assert.equal(w.waechter(naechstes(`- ${icon} ${icon === '📅' ? '12:00 ' : ''}x`), JETZT), '', `Icon ${icon}`)
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
assert.equal(w.waechter(stand(FRISCH, ...hand(21)).replace('- 🔵 Hand 0', '- Hand 0'), JETZT), `${OHNE('1 Zeile (- Hand 0 {eigen · normal · - · 01.10.})')}; 21 Handzeilen (erlaubt 20) — aufräumen`, 'beide Abschnitte')

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
  const imBlock = lauf(stand(FRISCH, ...hand(20), AUF, '- Hand im Block {eigen · normal · - · 01.10.}', ZU), JETZT + 30 * 60000)
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
  assert.equal(nachste.warnung, OHNE('1 Zeile (- Hand 0 {eigen · normal · - · 01.10.})'), 'Lauf meldet auch Als Nächstes')
  const beides = h.ausgabe({ ergebnis: 'nicht geschrieben: x', laut: true, warnung: 'w' })
  assert.deepEqual(JSON.parse(beides), { systemMessage: 'stand-prs.js: nicht geschrieben: x (stand.md, Abschnitt „In Arbeit“)\nstand.md: w' })
} finally {
  rmSync(ordner, { recursive: true, force: true })
}

// Jetzt-Zeilen: Kennung F<n>/E<n>; Form `- <Icon> **<Titel>** — [Text](Link)`, der Grund steht in der Jetzt-Datei (Daniel, 16.11.2026); 📅-Terminzeilen und Einrückungen zählen nicht
const jetzt = (...zeilen) => ['### Jetzt', ...zeilen, '', '### Später', '- 🔵 **Spät** ohne Kennung', '## In Arbeit' + FRISCH].join('\n')
const OK = '- 🔵 **F74 Filterleiste?** — [Anleitung](file:///C:/x/a.md)'
const KENNUNG = 'Jetzt: 1 Zeile (Form?) ohne Kennung F<n>/E<n>'
const FORM = 'Jetzt: 1 Zeile (Form?) mit Text zwischen Titel und „ — “ oder Grund im Titel — Grund gehört in die Jetzt-Datei, Abschnitt ‚Warum ich es nicht selbst tue‘'
assert.equal(w.waechter(jetzt(OK, '- 🟠 **E28 Dai melden** — x {eigen · normal · - · 01.10.}', '- 🟠 **F3 X**', '- 🔴 [groß] **F4 Y** — z'), JETZT, () => true), '', 'korrekte Zeilen')
assert.equal(w.waechter(jetzt('- 🟠 **Dai melden**'), JETZT), 'Jetzt: 1 Zeile (Dai melden) ohne Kennung F<n>/E<n>', 'ohne Kennung')
assert.equal(w.waechter(jetzt('- 🔵 **F75 Form?** — drei Entwürfe'), JETZT), '', 'ohne Grund in der Zeile ist richtig')
assert.equal(w.waechter(jetzt('- 🔵 **Form?** — x'), JETZT), KENNUNG, 'Kennung fehlt')
assert.equal(w.waechter(jetzt(OK, '  - Detail ohne alles', '- 📅 **Do 05.11.** Termin'), JETZT, () => true), '', 'Unterzeile und Terminzeile')
assert.equal(w.waechter(jetzt('- 🔵 **EF1 Form?**'), JETZT), KENNUNG.replace('Form?', 'EF1 Form?'), 'Kennung nur als ganzes Wort mit Ziffern')
assert.equal(w.waechter('### Jetzt\n- 🔵 **Form?**', JETZT), KENNUNG, 'letzter Abschnitt')
assert.equal(w.waechter(jetzt('- 🔵 **Form?**').replace('### Jetzt', '### Heute'), JETZT), '', 'anderer Abschnitt')
assert.equal(w.waechter(jetzt('- 🔵 **Form?** (soll nicht: x) → [Datei](file:///C:/x/F74-x.md)'), JETZT, () => true), `${KENNUNG}; ${FORM}`, 'Kennung nur im Link-Ziel zählt nicht')
// Der Anlass vom 16.11.2026: E90 mit Klammer zwischen Titel und Link
const E90 = '- 🔵 **E90 Netflix: „Bericht laden“ klicken** (soll nicht ich: liegt nur in deiner angemeldeten Sitzung; kein „ja“ nötig, einfach klicken) — [Anleitung](file:///C:/x/e90.md)'
assert.equal(w.waechter(jetzt(E90), JETZT, () => true), FORM.replace('Form?', 'E90 Netflix: „Bericht laden“ klicken'), 'Text zwischen Titel und Gedankenstrich')
const E90_KURZ = '- 🔵 **E90 Netflix: „Bericht laden“ klicken** — [Anleitung](file:///C:/x/e90.md)'
assert.equal(w.waechter(jetzt(E90_KURZ), JETZT, () => true), '', 'E90 gekürzt: kein Grund in der Zeile ist richtig, keine Meldung „ohne Grund“')
assert.equal(w.waechter(jetzt('- 🔵 **F7 Form? (kann nicht: x)** — y'), JETZT), FORM.replace('Form?', 'F7 Form? (kann nicht: x)'), 'Grund im Titel')
for (const grund of ['kann nicht', 'darf nicht', 'soll nicht', 'Kann nicht']) {
  assert.match(w.waechter(jetzt(`- 🔵 **F7 Form ${grund}** — y`), JETZT), /Grund gehört in die Jetzt-Datei/, `Titel mit „${grund}“`)
}
assert.match(w.waechter(jetzt('- 🔵 **F7 Form?** kann nichts tun'), JETZT), /Grund gehört in die Jetzt-Datei/, 'Text ohne Gedankenstrich nach dem Titel')
assert.equal(w.waechter(jetzt('- 🔵 F7 Form ohne Fett'), JETZT), '', 'ohne fetten Titel: keine Formmeldung (Kennung genügt)')
// 📅-Zeilen: Zeit am Titelanfang (Daniel 12.11.2026 zu E57)
for (const gut of ['- 📅 **23:30 E57 Git**', '- 📅 **13.11. 08:50 Steel Ball Run**', '- 📅 16.11. **Fristen**', '- 📅 [klein] **19.11. Probe**', '- 📅 **Do 05.11.** Termin']) {
  assert.equal(w.waechter(jetzt(gut), JETZT), '', gut)
}
assert.equal(w.waechter(jetzt('- 📅 **E57 Git ab 23:30** — x'), JETZT), '📅: 1 Zeile (E57 Git ab 23:30) ohne Zeit am Anfang — „HH:MM“, „TT.MM.“ oder „TT.MM. HH:MM“ vor den Titel', 'Zeit hinten')
console.log('stand-waechter.test: ok (📅 Zeit vorn, Jetzt-Zeilen Kennung/Form (Text vor „ — “, Grund im Titel), 20/21 Handzeilen, Als Nächstes 80/81 Zeilen und 400/401 Zeichen, Icon, Block zählt nicht, Alter 24 h Sommer/Winter, ohne Stand, Lauf meldet)')

// Zeitstempel „Aktualisiert:“ in der Zukunft: 12:05 Berlin genau erlaubt (5 min), 12:06 nicht; ohne Zeile nichts
const aktualisiert = (hhmm) => stand(FRISCH).replace('# Stand', `# Stand\nAktualisiert: 2026-10-20 ${hhmm} — x`)
assert.equal(w.waechter(aktualisiert('12:05'), JETZT), '', 'Aktualisiert 5 min voraus')
assert.equal(w.waechter(aktualisiert('11:59'), JETZT), '', 'Aktualisiert in der Vergangenheit')
assert.equal(w.waechter(aktualisiert('12:06'), JETZT), 'Aktualisiert 12:06 liegt in der Zukunft — Uhrzeit mit date lesen', 'Aktualisiert 6 min voraus')
// Winterzeit (UTC+1): 01.11. 17:00Z = 18:00 Berlin; Umstellungstag 29.03.: 01:35 ist noch MEZ (00:35Z)
const winter = (hhmm, tag = '2026-11-01', kopf = ' (Stand 01.11.2026 17:00; x)') => stand(kopf).replace('# Stand', `# Stand\nAktualisiert: ${tag} ${hhmm} — x`)
const WINTER_NOV = Date.parse('2026-11-01T17:00:00Z')
assert.equal(w.waechter(winter('18:05'), WINTER_NOV), '', 'Aktualisiert Winterzeit 5 min voraus')
assert.equal(w.waechter(winter('18:06'), WINTER_NOV), 'Aktualisiert 18:06 liegt in der Zukunft — Uhrzeit mit date lesen', 'Aktualisiert Winterzeit 6 min voraus')
assert.equal(w.waechter(winter('01:35', '2026-03-29', ' (Stand 29.03.2026 01:00; x)'), Date.parse('2026-03-29T00:20:00Z')), 'Aktualisiert 01:35 liegt in der Zukunft — Uhrzeit mit date lesen', 'Umstellungstag vor 02:00 noch MEZ')
// Nur die erste „Aktualisiert“-Zeile zählt (Kopf); eine spätere in einem Zitat nicht
const zwei = aktualisiert('12:00').replace('— x', '— x\nAktualisiert: 2026-10-20 12:30 — y')
assert.equal(w.waechter(zwei, JETZT), '', 'nur erste Aktualisiert-Zeile')
assert.equal(w.waechter(stand(FRISCH, ...hand(20)).replace('## Als Nächstes', '## Titel unterwegs\n- [Live 08.11. 14:38] Black Clover S2E1 — x\n'.repeat(3) + '## Als Nächstes'), JETZT), '', 'Titel unterwegs zählt nicht als Handzeile')

// Tote Datei-Links: Attrappe statt Dateisystem; nur file:///, %20 dekodiert, Anker abgeschnitten, je Dateiname eine Meldung
const LEBT = new Set(['C:/code/mit Leerzeichen/lebt.md', 'C:/code/ai/ok.md'])
const existiert = (p) => LEBT.has(p)
const mitLinks = (...links) => stand(FRISCH, ...links.map((l) => `- Zeile ${l}`))
const TOT = 'Toter Link: tot.md — umbenannt? Link nachziehen'
assert.equal(w.waechter(mitLinks('[a](file:///C:/code/ai/ok.md)'), JETZT, existiert), '', 'lebender Link')
assert.equal(w.waechter(mitLinks('[a](file:///C:/code/ai/tot.md)'), JETZT, existiert), TOT, 'toter Link')
assert.equal(w.waechter(mitLinks('[a](file:///C:/code/ai/ok.md)', '[b](file:///C:/code/ai/tot.md)'), JETZT, existiert), TOT, 'tot und lebend')
assert.equal(w.waechter(mitLinks('[a](file:///C:/code/mit%20Leerzeichen/lebt.md#abschnitt)'), JETZT, existiert), '', '%20 und Anker')
assert.equal(w.waechter(mitLinks('[a](file:///C:/code/ai/tot.md#x)', '[b](file:///C:/code/ai/tot.md)'), JETZT, existiert), TOT, 'gleicher Name nur einmal')
assert.equal(w.waechter(mitLinks('[a](https://example.org/tot.md)', '[b](tot.md)'), JETZT, existiert), '', 'http und relative Links zählen nicht')
assert.equal(w.waechter(mitLinks('[a](file:///C:/code/ai/%ZZ.md)'), JETZT, existiert), '', 'kaputte Kodierung wird übersprungen')
assert.equal(w.waechter(mitLinks('[a](file:///C:/code/ai/tot.md)', ...hand(21)), JETZT, existiert), '22 Handzeilen (erlaubt 20) — aufräumen; ' + TOT, 'nach den bestehenden Meldungen')
// Echtes Dateisystem plattformunabhängig: Laufwerkspfad C:/… wird auf den Wegwerf-Ordner abgebildet
const dir = mkdtempSync(join(tmpdir(), 'stand-links-'))
const echtFs = (p) => existsSync(join(dir, p.replace(/^[A-Za-z]:\//, '')))
const echtLink = mitLinks('[a](file:///C:/echt.md)')
writeFileSync(join(dir, 'echt.md'), 'x')
assert.equal(w.waechter(echtLink, JETZT, echtFs), '', 'echte Datei lebt')
rmSync(dir, { recursive: true })
assert.equal(w.waechter(echtLink, JETZT, echtFs), 'Toter Link: echt.md — umbenannt? Link nachziehen', 'echte Datei gelöscht')
// Standardprüfung (fs.existsSync) nur dort, wo Laufwerkspfade echt sind
if (process.platform === 'win32') {
  const d2 = mkdtempSync(join(tmpdir(), 'stand-links-'))
  const p2 = join(d2, 'echt.md').replaceAll('\\', '/')
  writeFileSync(p2, 'x')
  assert.equal(w.waechter(mitLinks(`[a](file:///${p2})`), JETZT), '', 'Standard: echte Datei lebt')
  rmSync(d2, { recursive: true })
  assert.equal(w.waechter(mitLinks(`[a](file:///${p2})`), JETZT), 'Toter Link: echt.md — umbenannt? Link nachziehen', 'Standard: Datei gelöscht')
} else {
  console.log('stand-waechter.test: Standard-Dateisystemfall übersprungen (nur win32); Fall mit abgebildetem Pfad lief')
}
// Jetzt-Dateien: fester Aufbau (Kennung in der Überschrift, Abschnittsreihenfolge)
const GUT = '# F7 Titel\n\n## Deine Aufgabe\nx\n## Worum es geht\nx\n## Warum ich es nicht selbst tue\nkann nicht: x\n## Archiv\nx\n'
const jetztStand = (zeile) => ['# Stand', '## Daniel-Todo', '### Jetzt', zeile, '### Später', '', `## In Arbeit${FRISCH}`, '', '## Als Nächstes', ...hand(40, '🔵 '), ''].join('\n')
const ZEILE = '- 🟠 **F7 Frage** — [Datei](file:///C:/code/ai/jetzt-f7.md) {eigen · normal · - · 01.10.}'
const mitDatei = (inhalt) => w.waechter(jetztStand(ZEILE), JETZT, () => true, (p) => (p === 'C:/code/ai/jetzt-f7.md' ? inhalt : null))
assert.equal(mitDatei(GUT), '', 'Jetzt-Datei gut')
const OHNE_GRUND = 'Jetzt-Datei F7: Abschnitt „Warum ich es nicht selbst tue“ nennt kein „kann nicht“, „darf nicht“ oder „soll nicht“'
assert.equal(mitDatei(GUT.replace('kann nicht: x', 'x')), OHNE_GRUND, 'Warum-Abschnitt ohne Grund')
assert.equal(mitDatei(GUT.replace('kann nicht: x\n', '')), OHNE_GRUND, 'Warum-Abschnitt leer')
assert.equal(mitDatei(GUT.replace('kann nicht: x', 'x').replace('## Archiv\nx', '## Archiv\nkann nicht')), OHNE_GRUND, 'Grund im Archiv zählt nicht')
assert.equal(mitDatei(GUT.replace('kann nicht: x', 'Das soll nicht ich entscheiden')), '', 'soll nicht im Fließtext des Abschnitts genügt')
assert.equal(mitDatei(GUT.replace('# F7 Titel', '# Titel')), 'Jetzt-Datei F7: Kennung fehlt in der Überschrift', 'Kennung fehlt')
assert.equal(mitDatei(GUT.replace('# F7 Titel', '# F77 Titel')), 'Jetzt-Datei F7: Kennung fehlt in der Überschrift', 'F77 ist nicht F7')
assert.equal(
  mitDatei('# F7 T\n## Worum es geht\nx\n## Deine Aufgabe\nx\n## Warum ich es nicht selbst tue\nkann nicht: x\n'),
  'Jetzt-Datei F7: Abschnitt „Deine Aufgabe“ nicht zuerst; Jetzt-Datei F7: Abschnitte nicht in der Reihenfolge Aufgabe, Worum, Warum, Archiv',
  'falsche Reihenfolge',
)
assert.equal(
  mitDatei('# F7 T\n## Deine Aufgabe\nx\n## Archiv\nx\n## Worum es geht\nx\n## Warum ich es nicht selbst tue\nkann nicht: x\n'),
  'Jetzt-Datei F7: Abschnitte nicht in der Reihenfolge Aufgabe, Worum, Warum, Archiv',
  'Archiv vor Worum',
)
assert.equal(mitDatei('# F7 T\n## Deine Aufgabe\nx\n## Worum es geht\nx\n## Warum ich es nicht selbst tue\nkann nicht: x\n'), '', 'Archiv darf fehlen')
// Pflichtabschnitte je genau einmal (nur Archiv darf fehlen)
assert.equal(
  mitDatei('# F7 T\n## Deine Aufgabe\nx\n'),
  'Jetzt-Datei F7: Abschnitt „Worum es geht“ fehlt; Jetzt-Datei F7: Abschnitt „Warum ich es nicht selbst tue“ fehlt',
  'nur Aufgabe',
)
assert.equal(
  mitDatei('# F7 T\n## Worum es geht\nx\n## Warum ich es nicht selbst tue\nkann nicht: x\n'),
  'Jetzt-Datei F7: Abschnitt „Deine Aufgabe“ fehlt; Jetzt-Datei F7: Abschnitt „Deine Aufgabe“ nicht zuerst',
  'Aufgabe fehlt',
)
assert.equal(mitDatei(GUT.replace('## Deine Aufgabe\nx\n', '## Deine Aufgabe\nx\n## Deine Aufgabe\nx\n')), 'Jetzt-Datei F7: Abschnitt „Deine Aufgabe“ doppelt', 'Aufgabe doppelt')
assert.equal(mitDatei(`${GUT}## Archiv\nx\n`), 'Jetzt-Datei F7: Abschnitt „Archiv“ doppelt', 'Archiv doppelt')
// Unbekannte erste Überschrift; Kennung nur im Fließtext zählt nicht
assert.equal(mitDatei(GUT.replace('## Deine Aufgabe', '## Aufgabe\nx\n## Deine Aufgabe')), 'Jetzt-Datei F7: Abschnitt „Deine Aufgabe“ nicht zuerst', 'unbekannte erste Überschrift')
assert.equal(mitDatei(GUT.replace('# F7 Titel', '# Titel\nF7 im Text')), 'Jetzt-Datei F7: Kennung fehlt in der Überschrift', 'Kennung nur im Fließtext')
// Kennung nur im Link-Ziel und Zeilen ohne „- “ führen zu keiner Dateiprüfung
const GUT_E8 = GUT.replace('# F7', '# E8')
const lies2 = (p) => (p === 'C:/code/ai/jetzt-e8.md' ? GUT_E8 : 'kaputt')
const E8 = '- 🟠 **E8 Handgriff** — [Datei](file:///C:/code/ai/jetzt-e8.md) {eigen · normal · - · 01.10.}'
assert.doesNotMatch(w.waechter(jetztStand('- 🟠 Frage, kann nicht ([Datei](file:///C:/code/ai/F57-x.md))'), JETZT, () => true, lies2), /Jetzt-Datei/, 'Kennung nur im Link-Ziel')
assert.equal(w.waechter(jetztStand([E8, '  - **F7 Unterpunkt** — [Datei](file:///C:/code/ai/jetzt-f7.md)', E8].join('\n')), JETZT, () => true, lies2), '', 'eingerückte Zeile')
assert.equal(w.waechter(jetztStand([E8, '**F7 lose Zeile** — [Datei](file:///C:/code/ai/jetzt-f7.md)', E8].join('\n')), JETZT, () => true, lies2), '', 'Nicht-Listenzeile')
assert.equal(w.waechter(jetztStand('- 🟠 **F7 Frage**'), JETZT, () => true, () => 'kaputt'), '', 'Zeile ohne Link: keine Meldung')
assert.equal(w.waechter(jetztStand(ZEILE), JETZT, () => true, () => null), '', 'Datei nicht lesbar: keine Meldung')
assert.equal(w.waechter(jetztStand(ZEILE.replace('jetzt-f7.md', 'jetzt-f7.txt')), JETZT, () => true, () => 'kaputt'), '', 'kein .md-Link: keine Meldung')
console.log('stand-waechter.test: ok (tote Datei-Links: tot/lebend, %20, Anker, Dubletten, http, Reihenfolge, echtes Dateisystem; Jetzt-Dateien: Kennung, Reihenfolge, Pflichtabschnitte je einmal, Archiv optional, ohne Link, Link-Ziel, Nicht-Listenzeile)')
