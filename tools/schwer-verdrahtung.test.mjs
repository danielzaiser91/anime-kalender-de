// Prüft die Verdrahtung der Sperre für schwere Läufe: welche npm-Skripte über `tools/schwer.mjs` laufen (geparste package.json)
// und dass `bau-vergleich.mjs` nach der eigenen Schlange auf den schweren Lauf wartet, bevor der erste Bau startet (Syntaxbaum).
// Ohne Verdrahtung liefe die Sperre ins Leere, obwohl `schwer.test.mjs` grün ist.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

const WURZEL = resolve(import.meta.dirname, '..')
const skripte = JSON.parse(readFileSync(resolve(WURZEL, 'package.json'), 'utf8')).scripts

const MIT_SPERRE = {
  'data:build': 'node tools/schwer.mjs tsx pipeline/build.ts',
  'check:panel': 'node tools/schwer.mjs npm run check:panel-teile',
  'check:ansichten': 'node tools/schwer.mjs npm run check:ansichten-teile',
  'check:ansichten-desktop': 'node tools/schwer.mjs node tools/ansicht-bild.mjs && node tools/schwer.mjs node tools/kachel-ecken-messen.mjs',
  'check:ansichten-handy': 'node tools/schwer.mjs node tools/ansicht-bild.mjs --handy woche monat datenbank',
}
for (const [name, soll] of Object.entries(MIT_SPERRE)) assert.equal(skripte[name], soll, `${name} läuft nicht über schwer.mjs`)

// Die Teile dahinter tragen den eigentlichen Inhalt und selbst keinen Wrapper (die Marke verhindert Doppelwarten, aber unnötig).
assert.equal(skripte['check:ansichten-teile'], 'npm run check:ansichten-desktop && npm run check:ansichten-handy')
const teile = skripte['check:panel-teile'].split(' && ')
for (const werkzeug of ['panel-bild', 'panel-messen', 'panel-zurueck', 'such-chip-messen', 'aehnlich-kacheln-bild', 'trefferprobe-selbsttest']) {
  assert.ok(teile.includes(`node tools/${werkzeug}.mjs`), `check:panel-teile ruft ${werkzeug} nicht auf`)
}
assert.ok(!teile.some((z) => z.includes('schwer.mjs')))

// bau-vergleich.mjs: Reihenfolge der Top-Level-Anweisungen
const quelle = readFileSync(resolve(WURZEL, 'tools/bau-vergleich.mjs'), 'utf8')
const datei = ts.createSourceFile('bau-vergleich.mjs', quelle, ts.ScriptTarget.Latest, true)
const aufrufName = (n) => (ts.isCallExpression(n) ? n.expression.getText(datei) : '')
const enthaelt = (anweisung, bedingung) => {
  let gefunden = false
  const geh = (n) => {
    if (bedingung(n)) gefunden = true
    else ts.forEachChild(n, geh)
  }
  geh(anweisung)
  return gefunden
}
// Funktionsrümpfe zählen nicht: gesucht ist, wann der Ablauf auf oberster Ebene den Aufruf erreicht.
const stelle = (bedingung) => datei.statements.findIndex((s) => !ts.isFunctionDeclaration(s) && enthaelt(s, bedingung))
const warteSchlange = stelle((n) => aufrufName(n) === 'wartAufSperre' && n.arguments[0]?.getText(datei) === "'bau-vergleich'")
const warteSchwer = stelle((n) => aufrufName(n) === 'wartAufSchwerenLauf')
const ersterBau = stelle((n) => aufrufName(n) === 'baue')
assert.ok(warteSchlange >= 0 && warteSchwer >= 0 && ersterBau >= 0, 'Anweisungen nicht gefunden')
assert.ok(warteSchlange < warteSchwer && warteSchwer < ersterBau, 'Reihenfolge: eigene Schlange, schwerer Lauf, erster Bau')

const anweisung = datei.statements[warteSchwer]
assert.ok(ts.isExpressionStatement(anweisung))
const zuweisung = anweisung.expression
assert.equal(aufrufName(zuweisung), 'Object.assign', 'die Marke muss in process.env landen, damit der Bau-Prozess sie erbt')
assert.equal(zuweisung.arguments[0].getText(datei), 'process.env')
const warten = zuweisung.arguments[1]
assert.ok(ts.isAwaitExpression(warten), 'auf den schweren Lauf wird gewartet')
const beschreibung = warten.expression.arguments[0]
assert.ok(beschreibung && ts.isTemplateExpression(beschreibung), 'der Wartende nennt Basis und Kandidat')
assert.match(beschreibung.getText(datei), /basis.*kandidat/s)
assert.ok(datei.statements.some((s) => ts.isImportDeclaration(s) && s.moduleSpecifier.getText(datei) === "'./schwerer-lauf.mjs'"))

// Wächter: jeder Prozessstart in schwer.mjs und der Sperre (Wartetakt) trägt windowsHide: true (sonst öffnet Windows sichtbare Konsolenfenster)
function pruefeVersteckt(pfad, erwartet) {
  const quelle = ts.createSourceFile(pfad, readFileSync(resolve(WURZEL, pfad), 'utf8'), ts.ScriptTarget.Latest, true)
  const starter = []
  const sammle = (n) => {
    if (ts.isCallExpression(n) && /^(spawn|spawnSync|exec|execSync|execFile|execFileSync|fork)$/.test(n.expression.getText(quelle))) starter.push(n)
    ts.forEachChild(n, sammle)
  }
  sammle(quelle)
  assert.ok(starter.length >= erwartet.length, `${pfad}: ${erwartet.join(', ')} erwartet`)
  for (const aufruf of starter) {
    const optionen = aufruf.arguments.find(ts.isObjectLiteralExpression)
    const hide = optionen?.properties.find((p) => p.name?.getText(quelle) === 'windowsHide')
    assert.equal(hide?.initializer.getText(quelle), 'true', `${aufruf.getText(quelle).slice(0, 40)} ohne windowsHide: true`)
  }
}
pruefeVersteckt('tools/schwer.mjs', ['spawn', 'taskkill'])
pruefeVersteckt('tools/einzel-sperre.mjs', ['tasklist', 'ps', 'cscript'])

console.log(`schwer-verdrahtung.test: grün (${Object.keys(MIT_SPERRE).length} Skripte, bau-vergleich Schritt ${warteSchwer})`)
