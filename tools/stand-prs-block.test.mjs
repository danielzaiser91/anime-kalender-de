/**
 * Fallliste für `tools/claude-global/hooks/stand-prs-block.js` (Block zwischen den Marken in stand.md): kaputte und
 * doppelte Marken, fremde Zeilen im Block, zwei Läufe, leere Datei. Unabhängiges Kriterium: jede nicht leere Zeile, die
 * nicht in Hook-Form ist, steht nach dem Lauf noch genau so oft in der Datei wie vorher.
 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const b = require(join(import.meta.dirname, 'claude-global', 'hooks', 'stand-prs-block.js'))
const { AUF, ZU } = b
const ADR = 'https://github.com/danielzaiser91/anime-kalender-de/pull/'
const L = (n) => `[PR ${n}](${ADR}${n})`
const offen = (n, mitte = 'CI ok · Prüfer offen · Checks grün') => `- **PR ${n}** — ${mitte} — ${L(n)}`
const gemergt = (n) => `- [klein] **PR ${n}** — gemergt 19.10. 16:27 — ${L(n)}`
const R = (...n) => n.map((nummer) => ({ nummer, zeile: offen(nummer) }))

// --- hookNummer: nur die eigene Form zählt ---
assert.equal(b.hookNummer(offen(901001)), 901001)
assert.equal(b.hookNummer(offen(901001, 'Prüfung rot · Entwurf · Konflikt · CI aendern (älterer Kopf) · Prüfer R2 ändern')), 901001, 'ohne Checks')
assert.equal(b.hookNummer(offen(901001, 'CI offen · Prüfer R4 freigeben · Checks laufen')), 901001)
assert.equal(b.hookNummer(gemergt(901002)), 901002)
assert.equal(b.hookNummer(`- **x** — ${L(901001)}`), null, 'Handzeile mit Verweis, ohne Zustand')
assert.equal(b.hookNummer(`- **Wichtig** — Daniel muss X — ${L(901001)}`), null, 'Handzeile in Zeilenform, fremde Mitte')
assert.equal(b.hookNummer(`- **x** — CI ok · Prüfer offen · Checks grün — [PR 901001](${ADR}901002)`), null, 'Nummer und Adresse widersprechen sich')
assert.equal(b.hookNummer(`- **x** — CI ok · Prüfer offen · Checks grün — [PR 901001](https://example.org/pull/901001)`), null, 'fremdes Repo')
assert.equal(b.hookNummer(`  ${offen(901001)}`), null, 'eingerückt ist Notiz')
assert.equal(b.hookNummer(`${offen(901001)} ergänzt`), null, 'Text hinter dem Verweis')
assert.equal(b.hookNummer(`- [klein] **x** — gemergt gestern — ${L(901002)}`), null)
assert.equal(b.hookNummer(offen(901001, 'CI ok · Prüfer offen · Checks blau')), null)

const SAMMEL = (n = 3, url = b.GEMERGT_LISTE) => `- [klein] **Gemergt in 24 h: ${n}** — zuletzt 20.10. 00:28 — [alle](${url})`
assert.equal(b.hookNummer(SAMMEL()), 0, 'Sammelzeile ist die Reihe 0')
assert.equal(b.hookNummer(SAMMEL(1)), 0)
assert.equal(b.hookNummer(SAMMEL(3, 'https://example.org/pulls')), null, 'fremde Adresse')
assert.equal(b.hookNummer(SAMMEL().replace('Gemergt in 24 h: 3', 'Gemergt in 24 h: x')), null, 'ohne Zahl')
assert.equal(b.hookNummer(`  ${SAMMEL()}`), null, 'eingerückt ist Notiz')

// --- markerLage ---
const T = (...z) => z
assert.deepEqual(b.markerLage(T('a', 'b')), {})
assert.deepEqual(b.markerLage(T('a', AUF, 'x', ZU, 'b')), { auf: 1, zu: 3 })
assert.deepEqual(b.markerLage(T(AUF, ZU)), { auf: 0, zu: 1 }, 'leerer Block')
const kaputt = {
  'AUF ohne ZU': T(AUF, 'x'),
  'ZU ohne AUF': T('x', ZU),
  'zwei AUF': T(AUF, AUF, ZU),
  'zwei Blöcke': T(AUF, ZU, 'x', AUF, ZU),
  'ZU vor AUF': T(ZU, 'x', AUF),
  'AUF mit Leerzeichen dahinter': T(`${AUF} `, ZU),
  'ZU mit Leerzeichen davor': T(AUF, ` ${ZU}`),
  'AUF mit anderem Text': T('<!-- pr-zeilen -->', ZU),
  'Block überspannt Überschrift': T(AUF, '## In Arbeit', ZU),
  'beide Marken verändert': T(`${AUF} `, ` ${ZU}`),
}
const meldung = {
  'AUF ohne ZU': '1× Anfangs-, 0× Endmarke',
  'ZU ohne AUF': '0× Anfangs-, 1× Endmarke',
  'zwei AUF': '2× Anfangs-, 1× Endmarke',
  'zwei Blöcke': '2× Anfangs-, 2× Endmarke',
  'ZU vor AUF': 'Endmarke vor der Anfangsmarke',
  'AUF mit Leerzeichen dahinter': 'Marke weicht vom Wortlaut ab',
  'ZU mit Leerzeichen davor': 'Marke weicht vom Wortlaut ab',
  'AUF mit anderem Text': 'Marke weicht vom Wortlaut ab',
  'Block überspannt Überschrift': 'Block überspannt eine Überschrift „## “',
  'beide Marken verändert': 'Marke weicht vom Wortlaut ab',
}
for (const [name, zeilen] of Object.entries(kaputt)) assert.deepEqual(b.markerLage(zeilen), { fehler: meldung[name] }, name)
assert.deepEqual(b.markerLage(T(AUF, '### Gruppe', ZU)), { auf: 0, zu: 2 }, 'Unterüberschrift ist kein Abschnitt')

// --- ersetzeBlock: kaputte Marken schreiben nichts (Text bleibt, Fehler kommt zurück) ---
for (const [name, zeilen] of Object.entries(kaputt)) {
  const r = b.ersetzeBlock(['## In Arbeit', ...zeilen, '- **Hand**', '## B'].join('\n'), R(901001))
  assert.equal(r.text, undefined, name)
  assert.match(r.fehler, /^Marken: /, name)
}
assert.deepEqual(b.ersetzeBlock('', R(901001)), { fehler: 'kein Abschnitt „## In Arbeit“' }, 'leere Datei')
assert.deepEqual(b.ersetzeBlock('# ohne\n## Als Nächstes\n', R(901001)), { fehler: 'kein Abschnitt „## In Arbeit“' })

// --- Erstes Einfügen: Ende von „## In Arbeit“, vor Leerzeilen ---
const STAND = ['# Stand', '## Daniel-Todo', '- 🔴 **Frage** — x', '', '## In Arbeit (Stand 19.10.)', '- ▶ **Handzeile** — bleibt', '  - Detail', '', '', '## Als Nächstes', '- **Später**', ''].join('\n')
const erst = b.ersetzeBlock(STAND, R(901002)).text
assert.equal(erst, STAND.replace('  - Detail\n', `  - Detail\n${AUF}\n${offen(901002)}\n${ZU}\n`))
assert.equal(b.ersetzeBlock('## In Arbeit\n- x', R(901002)).text, `## In Arbeit\n- x\n${AUF}\n${offen(901002)}\n${ZU}`, 'letzter Abschnitt')
assert.equal(b.ersetzeBlock('## In Arbeit\n\n## B', R(901002)).text, `## In Arbeit\n${AUF}\n${offen(901002)}\n${ZU}\n\n## B`)
assert.equal(b.ersetzeBlock('## Info\n## In Arbeit\n### G\n- x\n  \n## B', []).text, `## Info\n## In Arbeit\n### G\n- x\n${AUF}\n${ZU}\n  \n## B`, 'Leerraum-Zeile zählt als leer')
assert.equal(b.ersetzeBlock('## In Arbeit\n', [], '- **PR-Liste veraltet** — h').text, `## In Arbeit\n${AUF}\n- **PR-Liste veraltet** — h\n${ZU}\n`, 'erster Lauf scheitert: nur Hinweis')

// --- Ersetzen: genau ein Block an seiner Stelle, Notizen wandern mit ---
const mitNotiz = erst.replace(`${offen(901002)}\n`, `${offen(901002)}\n  - Handnotiz\n\t- Tab-Notiz\n`)
const zweit = b.ersetzeBlock(mitNotiz, [...R(901005), { nummer: 901002, zeile: offen(901002, 'CI ok · Prüfer offen · Checks rot') }]).text
assert.ok(zweit.includes(`${AUF}\n${offen(901005)}\n${offen(901002, 'CI ok · Prüfer offen · Checks rot')}\n  - Handnotiz\n\t- Tab-Notiz\n${ZU}\n\n\n## Als`))
assert.equal(zweit.split(AUF).length, 2)
assert.equal(b.ersetzeBlock(zweit, R(901005, 901002)).text, b.ersetzeBlock(b.ersetzeBlock(zweit, R(901005, 901002)).text, R(901005, 901002)).text, 'zweiter Lauf ändert nichts')

// --- Fallliste: fremde Zeilen, verwaiste Notizen; Kriterium „keine fremde Zeile geht verloren“, über zwei Läufe ---
const fremdeZeilen = (text) => text.split('\n').filter((z) => z.trim() && z !== AUF && z !== ZU && b.hookNummer(z) === null)
const zaehle = (liste) => liste.reduce((m, z) => m.set(z, (m.get(z) ?? 0) + 1), new Map())
function behaeltAlles(name, text, reihen) {
  const eins = b.ersetzeBlock(text, reihen).text
  const zwei = b.ersetzeBlock(eins, reihen).text
  const vorher = zaehle(fremdeZeilen(text))
  const nachher = zaehle(fremdeZeilen(zwei))
  for (const [zeile, n] of vorher) assert.ok((nachher.get(zeile) ?? 0) >= n, `${name}: „${zeile}“ verloren`)
  assert.equal(zwei, eins, `${name}: zweiter Lauf ändert nichts`)
  return eins
}
const block = (...z) => ['## In Arbeit', AUF, ...z, ZU, '', '## Als Nächstes', '- y'].join('\n')
const fall1 = behaeltAlles('Handzeile im Block', block('- **Neue Handzeile ohne PR**', `- **x** — ${L(901001)}`, offen(901001)), R(901001))
assert.ok(fall1.includes(`${AUF}\n${offen(901001)}\n${ZU}\n- **Neue Handzeile ohne PR**\n- **x** — ${L(901001)}\n\n## Als`), 'Fremdes direkt unter ZU, in Reihenfolge')
const fall2 = behaeltAlles('Notiz unter verschwundenem PR', block(offen(901002), '  - Daniel: wichtige Notiz', gemergt(901003), '  - Notiz 3'), R(901001))
assert.ok(fall2.includes(`${ZU}\n- **Notiz zu PR 901002** — aus der PR-Liste gefallen, bitte einordnen\n  - Daniel: wichtige Notiz\n- **Notiz zu PR 901003** — aus der PR-Liste gefallen, bitte einordnen\n  - Notiz 3\n`))
assert.ok(!fall2.includes(gemergt(901003)), 'die eigene Zeile des ausgeschiedenen PRs fällt weg')
const fall3 = behaeltAlles('Gruppe mit Notiz im Block', block('### Gruppe', '  - Notiz unter Gruppe', offen(901001)), R(901001))
assert.ok(fall3.includes(`${ZU}\n### Gruppe\n  - Notiz unter Gruppe\n`))
behaeltAlles('Fortsetzung ohne Einrückung', block(offen(901001), '  - Notiz', 'Fortsetzungsabsatz'), R(901001))
const fall4 = behaeltAlles('Handzeile mit Unterpunkt nach PR-Zeile', block(offen(901001), '- Hand', '  - Unterpunkt von Hand'), R(901001))
assert.ok(fall4.includes(`${AUF}\n${offen(901001)}\n${ZU}\n- Hand\n  - Unterpunkt von Hand\n`), 'Unterpunkt bleibt bei der Handzeile')
const fall5 = behaeltAlles('Leerzeile zwischen PR-Zeile und Notiz', block(offen(901001), '', '  - Notiz'), R(901002, 901001))
assert.ok(fall5.includes(`${offen(901002)}\n${offen(901001)}\n  - Notiz\n${ZU}`), 'Notiz bleibt beim PR, Leerzeile fällt')
behaeltAlles('eingerückt direkt nach AUF', block('  - lose Notiz', offen(901001)), R(901001))
behaeltAlles('Handzeile in Zeilenform', block(`- **Wichtig** — Daniel muss X — ${L(901001)}`), R(901001))
behaeltAlles('doppelte Notizzeile', block(offen(901001), '  - gleich', offen(901001), '  - gleich'), [])
const leerBlock = behaeltAlles('Block leer, PR geht', block(offen(901001)), [])
assert.ok(leerBlock.includes(`${AUF}\n${ZU}\n\n## Als`), 'ohne PRs bleibt ein leerer Block')

// --- Sammelzeile: wird ersetzt (nie doppelt), überlebt einen gescheiterten Abruf, alte Einzelzeilen fallen weg ---
const mitSammel = block(SAMMEL(5), offen(901001))
const sammelNeu = b.ersetzeBlock(mitSammel, [{ nummer: 901001, zeile: offen(901001) }, { nummer: 0, zeile: SAMMEL(6) }]).text
assert.ok(sammelNeu.includes([AUF, offen(901001), SAMMEL(6), ZU].join('\n')), 'neue Zahl ersetzt die alte')
assert.equal(sammelNeu.split('Gemergt in 24 h').length, 2, 'genau eine Sammelzeile')
const gescheitert = b.ersetzeBlock(mitSammel, null).text
assert.ok(gescheitert.includes([AUF, SAMMEL(5), offen(901001), ZU].join('\n')), 'Abruffehler behält die Sammelzeile')
const reihenNeu = [{ nummer: 901001, zeile: offen(901001) }, { nummer: 0, zeile: SAMMEL(2) }]
const migriert = b.ersetzeBlock(block(offen(901001), gemergt(901003), gemergt(901004)), reihenNeu).text
assert.ok(migriert.includes([AUF, offen(901001), SAMMEL(2), ZU, '', '## Als'].join('\n')), 'alte Einzelzeilen werden zur Sammelzeile, nichts bleibt zurück')
assert.equal(b.ersetzeBlock(migriert, reihenNeu).text, migriert, 'zweiter Lauf ändert nichts')

// --- Hinweiszeile: reihen null behält die alten Reihen samt Notizen, die Zeile entsteht neu und verschwindet wieder ---
const H = '- **PR-Liste veraltet** — Stand 19.10. 16:27; Abruf scheitert: gh: HTTP 502'
const altBlock = block(offen(901001), '  - Notiz', '- Hand')
const veraltet = b.ersetzeBlock(altBlock, null, H).text
assert.equal(veraltet, ['## In Arbeit', AUF, H, offen(901001), '  - Notiz', ZU, '- Hand', '', '## Als Nächstes', '- y'].join('\n'))
assert.equal(b.ersetzeBlock(veraltet, null, H).text, veraltet, 'Hinweis nicht doppelt')
assert.equal(b.ersetzeBlock(veraltet, R(901001)).text, ['## In Arbeit', AUF, offen(901001), '  - Notiz', ZU, '- Hand', '', '## Als Nächstes', '- y'].join('\n'), 'Erfolg: Hinweis weg')

console.log('stand-prs-block.test: ok (Zeilenform, Marken: 10 kaputte Lagen, Einfügen, Ersetzen, 10 Fälle ohne Zeilenverlust über zwei Läufe, Hinweiszeile, Sammelzeile)')
