import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { ALTER_TAGE, NAMEN, main, messeKennzahlen, setzeMarker, veraltet } from './kennzahlen.mjs'

const m = (name, inhalt) => `<!-- kennzahlen:${name} -->${inhalt}<!-- /kennzahlen -->`
const werte = { a: 'neu A', b: 'neu B' }

// Ersetzen, Prosa drumherum bleibt, mehrere Marker je Zeile
const r = setzeMarker(`vor ${m('a', 'alt')} mitte ${m('b', 'alt')} nach\n${m('a', 'alt2')}`, werte)
assert.equal(r.text, `vor ${m('a', 'neu A')} mitte ${m('b', 'neu B')} nach\n${m('a', 'neu A')}`)
assert.deepEqual(r.fehlend, [])

// Idempotent
assert.equal(setzeMarker(r.text, werte).text, r.text)

// Fehlender Marker, unbekannter Marker, unpaarig: Meldung statt stillem Überspringen
assert.equal(setzeMarker(m('a', 'x'), werte).fehlend.length, 1)
assert.match(setzeMarker(m('a', 'x'), werte).fehlend[0], /„b“ fehlt/)
assert.match(setzeMarker(`${m('a', 'x')}${m('b', 'y')}${m('c', 'z')}`, werte).fehlend[0], /„c“ ist unbekannt/)
assert.match(setzeMarker(`${m('a', 'x')}${m('b', 'y')} <!-- kennzahlen:a -->offen`, werte).fehlend.join(), /nicht paarig/)
assert.equal(setzeMarker('ohne Marker', werte).fehlend.length, 2)

// Alter: Grenze genau, eins drüber, kein Datum
const tag = Date.UTC(2026, 10, 12)
assert.deepEqual(veraltet(m('a', 'Stand 13.10.2026'), tag, 30), [])
assert.equal(veraltet(m('a', 'Stand 12.10.2026'), tag, 30).length, 1)
assert.match(veraltet(m('a', 'Stand 12.10.2026'), tag, 30)[0], /31 Tage alt/)
assert.match(veraltet(m('a', 'ohne'), tag)[0], /ohne Stand-Datum/)
assert.equal(ALTER_TAGE, 30)
// Standardwert der Frist: ohne Argument gilt 30 (30 Tage ok, 31 Tage Meldung)
assert.deepEqual(veraltet(m('a', 'Stand 13.10.2026'), tag), [])
assert.equal(veraltet(m('a', 'Stand 12.10.2026'), tag).length, 1)

// Messung gegen Wegwerf-Wurzel: Dateizahl und gzip
const wurzel = mkdtempSync(join(tmpdir(), 'kennzahlen-'))
mkdirSync(join(wurzel, 'public', 'data', 'sub'), { recursive: true })
for (const n of ['meta', 'woche-kacheln', 'titles-core', 'releases', 'events', 'titles']) writeFileSync(join(wurzel, 'public', 'data', `${n}.json`), '{"a":1}')
writeFileSync(join(wurzel, 'public', 'data', 'sub', 'x.json'), '{}')
writeFileSync(join(wurzel, 'public', 'index.html'), '')
const k = messeKennzahlen(wurzel, '01.02.2026')
assert.deepEqual(Object.keys(k).sort(), [...NAMEN].sort())
assert.equal(k['public-dateien'], '8 Dateien in `public/` (Schwelle 15.000), Stand 01.02.2026')
assert.match(k['meta-gzip'], /^0,0 KB gzip, Stand 01\.02\.2026$/)
for (const n of ['woche-kacheln-gzip', 'nachladen-gzip', 'titles-gzip']) assert.match(k[n], /gzip/)
assert.match(k['woche-kacheln-gzip'], /schwankt mit dem Wochenfenster/)

// Kompressionsstufe: schlecht komprimierbarer Text (Zufallsfolge, feste Saat) ergibt je Stufe andere Größen
let saat = 12345
let text = ''
for (let i = 0; i < 20000; i++) {
  saat = (saat * 1103515245 + 12345) % 2147483648
  text += String.fromCharCode(97 + (saat >> 16) % 26) + (i % 7 === 0 ? ' ' : '')
}
const groesse = (level) => (gzipSync(text, { level }).length / 1024).toFixed(1).replace('.', ',')
assert.notEqual(groesse(1), groesse(9))
writeFileSync(join(wurzel, 'public', 'data', 'titles.json'), text)
assert.match(messeKennzahlen(wurzel, '01.02.2026')['titles-gzip'], new RegExp(`^${groesse(9)} KB gzip`))

// main als Prozessweg: schreibt, zweiter Lauf gleich, --pruefen, fehlender Marker ohne Schreiben
const doku = NAMEN.map((n) => m(n, 'alt')).join('\n')
writeFileSync(join(wurzel, 'ARCHITEKTUR.md'), doku)
const lauf1 = main([], wurzel)
assert.equal(lauf1.code, 0)
const nach1 = readFileSync(join(wurzel, 'ARCHITEKTUR.md'), 'utf8')
assert.match(nach1, /8 Dateien/)
assert.equal(main([], wurzel).code, 0)
assert.equal(readFileSync(join(wurzel, 'ARCHITEKTUR.md'), 'utf8'), nach1)
assert.equal(main(['--pruefen'], wurzel).code, 0)
writeFileSync(join(wurzel, 'ARCHITEKTUR.md'), doku.replace(m('titles-gzip', 'alt'), ''))
const kaputt = main([], wurzel)
assert.equal(kaputt.code, 1)
assert.match(kaputt.zeilen.join(), /titles-gzip/)
assert.equal(readFileSync(join(wurzel, 'ARCHITEKTUR.md'), 'utf8'), doku.replace(m('titles-gzip', 'alt'), ''))
assert.equal(main(['--pruefen'], wurzel).code, 1)
// veralteter Stand: Warnung, Exit 0
writeFileSync(join(wurzel, 'ARCHITEKTUR.md'), NAMEN.map((n) => m(n, 'Stand 01.01.2020')).join('\n'))
const alt = main(['--pruefen'], wurzel)
assert.equal(alt.code, 0)
assert.equal(alt.zeilen.filter((z) => z.startsWith('⚠ WARNUNG')).length, NAMEN.length)
assert.equal(main(['--pruefen'], join(wurzel, 'nirgends')).code, 1)

// Startwächter: echter Prozess auf Wegwerf-Kopie (Pfad mit Leerzeichen), Stand fest 2020
const kopie = mkdtempSync(join(tmpdir(), 'kennzahlen prozess-'))
mkdirSync(join(kopie, 'tools'))
copyFileSync(new URL('./kennzahlen.mjs', import.meta.url), join(kopie, 'tools', 'kennzahlen.mjs'))
const prozess = () => spawnSync(process.execPath, [join(kopie, 'tools', 'kennzahlen.mjs'), '--pruefen'], { encoding: 'utf8', timeout: 30000 })
writeFileSync(join(kopie, 'ARCHITEKTUR.md'), NAMEN.map((n) => m(n, 'Stand 01.01.2020')).join('\n'))
const p1 = prozess()
assert.equal(p1.status, 0, p1.stderr)
assert.match(p1.stdout, /kennzahlen: 0 fehlend, 5 veraltet \(Grenze 30 Tage\)/)
writeFileSync(join(kopie, 'ARCHITEKTUR.md'), 'ohne Marker')
const p2 = prozess()
assert.equal(p2.status, 1)
assert.match(p2.stdout, /5 fehlend/)

console.log('kennzahlen.test: ok (Ersetzen, Idempotenz, fehlender/unbekannter/unpaariger Marker, Alter an der Grenze, Messung, Prozessweg)')
