#!/usr/bin/env node
/**
 * Wächter: die echte Uhr (`new Date()`, `Date()`, `Date.now`) in Testdateien darf nur weniger werden.
 * Eine Prüfung gegen die echte Uhr wird am UTC-Tageswechsel oder zur Sendestunde rot, ohne dass jemand etwas geändert hat
 * (main war am 19.10.2026 so einen Montag lang rot). Neue Tests nehmen eine feste Zeit (`tools/feste-uhr.ts`).
 * Auch die Umgehungen zählen: `globalThis['Date']`, ein Alias (`const D = Date`, `const { now } = Date`; die Bindung zählt einmal)
 * und `Reflect.construct(Date, [])` ohne Argumente. Nicht erfasst: Date als Objektwert, Parameter-Vorgabe oder Funktionsargument.
 * Gezählt wird im Syntaxbaum aller getrackten `*.test.*`-Dateien und aller Einträge von tools/check-logic-liste.txt.
 * Misst der Test die Uhr bewusst (Wartezeit, Alter einer Datei), steht in einem Kommentar derselben Zeile
 * `uhr-echt: <Grund>` (ohne Grund oder in einem String gilt es nicht); die Stelle zählt dann nicht.
 * Grenze: tools/uhr-in-tests-grenzen.json (Grundstand 19.10.2026). Sie sinkt nur durch --festschreiben (tools/commit-data.sh auf main).
 *
 *   node tools/uhr-in-tests.mjs                              prüfen (Exit 1 bei mehr Vorkommen als erlaubt)
 *   node tools/uhr-in-tests.mjs --liste                      Datei:Zeile
 *   node tools/uhr-in-tests.mjs --festschreiben              Grenze auf den gesunkenen Stand setzen (erhöht nie)
 *   --quelle <git-ordner> --grenzen <datei>                  andere Wurzel (für den Test)
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const WURZEL = resolve(import.meta.dirname, '..')
const TESTNAME = /\.test\.(ts|mts|cts|tsx|js|mjs|cjs|jsx)$/
const LISTE = 'tools/check-logic-liste.txt'
const GRUND = /uhr-echt:\s*[^\s*/]/
const HINWEIS = 'Nur durch --festschreiben gesenkt, nie von Hand erhöht. Grundstand 19.10.2026.'

/** Getrackte Testdateien plus die Einträge der check:logic-Liste (relative Pfade mit `/`). */
function testdateien(quelle) {
  const getrackt = execFileSync('git', ['-C', quelle, 'ls-files', '-z'], { encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 28 })
    .split('\0')
    .filter(Boolean)
  const liste = existsSync(join(quelle, LISTE)) ? readFileSync(join(quelle, LISTE), 'utf8').split('\n') : []
  const eintraege = liste.map((z) => z.trim()).filter((z) => z && existsSync(join(quelle, z)))
  return [...new Set([...getrackt.filter((p) => TESTNAME.test(p)), ...eintraege])].sort()
}

const istGlobalThis = (n) => ts.isIdentifier(n) && n.text === 'globalThis'

const istDate = (n) =>
  (ts.isIdentifier(n) && n.text === 'Date') ||
  (ts.isPropertyAccessExpression(n) && n.name.text === 'Date' && istGlobalThis(n.expression)) ||
  (ts.isElementAccessExpression(n) && ts.isStringLiteralLike(n.argumentExpression) && n.argumentExpression.text === 'Date' && istGlobalThis(n.expression))

/** `const D = Date` / `const { now } = Date`: der Alias liest die Uhr später unter anderem Namen. */
const istAlias = (n) => ts.isVariableDeclaration(n) && n.initializer !== undefined && istDate(n.initializer)

/** `Reflect.construct(Date, [])` ohne Argumente (oder ohne Argumentliste) liest die Uhr wie `new Date()`. */
function istReflectUhr(n) {
  const f = n.expression
  if (!ts.isPropertyAccessExpression(f) || f.name.text !== 'construct' || !ts.isIdentifier(f.expression) || f.expression.text !== 'Reflect') return false
  const [ziel, liste] = n.arguments
  if (!ziel || !istDate(ziel)) return false
  return liste === undefined || (ts.isArrayLiteralExpression(liste) && liste.elements.length === 0)
}

const istJetzt = (n) =>
  (ts.isPropertyAccessExpression(n) && n.name.text === 'now' && istDate(n.expression)) ||
  (ts.isElementAccessExpression(n) && ts.isStringLiteralLike(n.argumentExpression) && n.argumentExpression.text === 'now' && istDate(n.expression))

const wirdZugewiesen = (n) => ts.isBinaryExpression(n.parent) && n.parent.left === n && n.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken

/** Liest die echte Uhr: `new Date()`/`new Date`, `Date()`, `Date.now` (außer als Zuweisungsziel). */
function liestUhr(n) {
  if (ts.isNewExpression(n)) return istDate(n.expression) && !n.arguments?.length
  if (ts.isCallExpression(n)) return istDate(n.expression) || istReflectUhr(n)
  if (istAlias(n)) return true
  return istJetzt(n) && !wirdZugewiesen(n)
}

/** Zeilen (1-basiert) mit einem Kommentar `uhr-echt: <Grund>`: Kommentare hängen als Trivia an einem Token, nie in einem String. */
function ausnahmeZeilen(sf, text) {
  const zeilen = new Set()
  // Hinter dem Ende von Knoten und Token: ein Kommentar derselben Zeile ist immer Trailing-Trivia des Tokens davor.
  const kommentare = (pos) => ts.getTrailingCommentRanges(text, pos) ?? []
  const besuche = (n) => {
    for (const k of [...kommentare(n.pos), ...kommentare(n.end)]) {
      if (!GRUND.test(text.slice(k.pos, k.end))) continue
      const von = sf.getLineAndCharacterOfPosition(k.pos).line + 1
      const bis = sf.getLineAndCharacterOfPosition(k.end).line + 1
      for (let z = von; z <= bis; z++) zeilen.add(z)
    }
    ts.forEachChild(n, besuche)
  }
  besuche(sf)
  return zeilen
}

/** Fundstellen `pfad:zeile` einer Quelle, eine je Vorkommen. */
export function stellenInQuelle(pfad, text) {
  const sf = ts.createSourceFile(pfad, text, ts.ScriptTarget.Latest, true)
  const frei = ausnahmeZeilen(sf, text)
  const funde = []
  const besuche = (n) => {
    const zeile = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
    if (liestUhr(n) && !frei.has(zeile)) funde.push(`${pfad}:${zeile}`)
    ts.forEachChild(n, besuche)
  }
  besuche(sf)
  return funde
}

export function fundstellen(quelle) {
  return testdateien(quelle).flatMap((pfad) => stellenInQuelle(pfad, readFileSync(join(quelle, pfad), 'utf8')))
}

function argument(name, vorgabe) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? resolve(process.argv[i + 1]) : vorgabe
}

function zuViel(funde, erlaubt) {
  console.error(
    `✖ Tests mit echter Uhr (new Date() / Date() / Date.now): ${funde.length} statt höchstens ${erlaubt}.\n` +
      'Neue Tests nehmen eine feste Zeit (tools/feste-uhr.ts); misst der Test die Uhr bewusst, steht „uhr-echt: Grund“ als Kommentar in der Zeile.\n' +
      'Fundstellen: node tools/uhr-in-tests.mjs --liste. Die Grenze wird nicht angehoben.',
  )
  return 1
}

export function main() {
  const quelle = argument('--quelle', WURZEL)
  const grenzDatei = argument('--grenzen', join(WURZEL, 'tools/uhr-in-tests-grenzen.json'))
  const funde = fundstellen(quelle)
  if (process.argv.includes('--liste')) {
    console.log(funde.join('\n'))
    return 0
  }
  const erlaubt = JSON.parse(readFileSync(grenzDatei, 'utf8')).erlaubt
  if (!Number.isInteger(erlaubt)) {
    console.error(`✖ ${grenzDatei}: Feld „erlaubt“ fehlt oder ist keine Zahl.`)
    return 1
  }
  if (funde.length > erlaubt) return zuViel(funde, erlaubt)
  if (process.argv.includes('--festschreiben')) {
    writeFileSync(grenzDatei, JSON.stringify({ _hinweis: HINWEIS, erlaubt: funde.length }, null, 2) + '\n')
    console.log(`Grenze auf ${funde.length} gesetzt.`)
    return 0
  }
  console.log(`Uhr in Tests in Ordnung: ${funde.length} Vorkommen, höchstens ${erlaubt} erlaubt.`)
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main())
