#!/usr/bin/env node
/**
 * Wächter: „heute“ als UTC-Tag (`new Date().toISOString().slice(0, 10)`) darf nur weniger werden.
 * Die Projektregel lässt Zeitzonen nur über shared/time.ts zu (`todayIso()`, Europe/Berlin); zwischen 0 und 2 Uhr
 * Berliner Zeit liefert die UTC-Form den Vortag. Gezählt wird im Syntaxbaum aller getrackten Code-Dateien in
 * pipeline/, tools/, shared/, worker/ und web/ (nicht extension/: eigenes Bündel ohne Import aus shared/).
 * Eine Stelle zählt, wenn `toISOString()` auf `new Date()` ohne Argument (oder `new Date(Date.now())`) folgt und
 * daran `.slice(0, 10)`, `.substring(0, 10)` oder `.split('T')[0]` hängt. Ein gegebenes Datum zu formatieren
 * (`new Date(x).toISOString().slice(0, 10)`) zählt nicht.
 * Grenze: tools/heute-utc-grenzen.json (Grundstand 21.10.2026). Sie sinkt nur durch --festschreiben (tools/commit-data.sh auf main).
 *
 *   node tools/heute-utc.mjs                              prüfen (Exit 1 bei mehr Vorkommen als erlaubt)
 *   node tools/heute-utc.mjs --liste                      Datei:Zeile
 *   node tools/heute-utc.mjs --festschreiben              Grenze auf den gesunkenen Stand setzen (erhöht nie)
 *   --quelle <git-ordner> --grenzen <datei>               andere Wurzel (für den Test)
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const WURZEL = resolve(import.meta.dirname, '..')
const ORDNER = /^(pipeline|tools|shared|worker|web)\//
const ENDUNG = /\.(ts|mts|cts|tsx|js|mjs|cjs|jsx)$/
const HINWEIS = 'Nur durch --festschreiben gesenkt, nie von Hand erhöht. Grundstand 21.10.2026.'

function dateien(quelle) {
  return execFileSync('git', ['-C', quelle, 'ls-files', '-z'], { encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 28 })
    .split('\0')
    .filter((p) => ORDNER.test(p) && ENDUNG.test(p))
    .sort()
}

const nameDe = (n, name) => ts.isPropertyAccessExpression(n) && n.name.text === name

/** `Date.now()` als einziges Argument zählt wie kein Argument. */
function istJetztDatum(roh) {
  const n = ts.skipOuterExpressions(roh, ts.OuterExpressionKinds.Parentheses)
  if (!ts.isNewExpression(n) || !ts.isIdentifier(n.expression) || n.expression.text !== 'Date') return false
  const args = n.arguments ?? []
  if (args.length === 0) return true
  const a = args[0]
  return args.length === 1 && ts.isCallExpression(a) && nameDe(a.expression, 'now') && a.expression.expression.getText() === 'Date'
}

const zahl = (n, wert) => n !== undefined && ts.isNumericLiteral(n) && n.text === String(wert)

/** `X.toISOString()` mit X = jetzt. */
const istIsoVonJetzt = (n) => ts.isCallExpression(n) && nameDe(n.expression, 'toISOString') && istJetztDatum(n.expression.expression)

/** Kürzt der Aufruf den ISO-Text auf den Tag? */
function kuerztAufTag(n) {
  if (ts.isCallExpression(n) && (nameDe(n.expression, 'slice') || nameDe(n.expression, 'substring'))) {
    const [von, bis] = n.arguments
    return n.arguments.length === 2 && zahl(von, 0) && zahl(bis, 10) && istIsoVonJetzt(n.expression.expression)
  }
  const el = ts.isElementAccessExpression(n) ? n : undefined
  if (!el || !zahl(el.argumentExpression, 0)) return false
  const teilen = el.expression
  return ts.isCallExpression(teilen) && nameDe(teilen.expression, 'split') &&
    ts.isStringLiteralLike(teilen.arguments[0]) && teilen.arguments[0].text === 'T' && istIsoVonJetzt(teilen.expression.expression)
}

/** Fundstellen `pfad:zeile` einer Quelle, eine je Vorkommen. */
export function stellenInQuelle(pfad, text) {
  const sf = ts.createSourceFile(pfad, text, ts.ScriptTarget.Latest, true)
  const funde = []
  const besuche = (n) => {
    if (kuerztAufTag(n)) funde.push(`${pfad}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`)
    ts.forEachChild(n, besuche)
  }
  besuche(sf)
  return funde
}

export function fundstellen(quelle) {
  return dateien(quelle).flatMap((pfad) => stellenInQuelle(pfad, readFileSync(join(quelle, pfad), 'utf8')))
}

function argument(name, vorgabe) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? resolve(process.argv[i + 1]) : vorgabe
}

function zuViel(funde, erlaubt) {
  console.error(
    `✖ „Heute“ als UTC-Tag (new Date().toISOString().slice(0, 10)): ${funde.length} statt höchstens ${erlaubt}.\n` +
      'Zwischen 0 und 2 Uhr Berliner Zeit ist das der Vortag. „Heute“ kommt aus todayIso() (shared/time.ts, Europe/Berlin).\n' +
      'Fundstellen: node tools/heute-utc.mjs --liste. Die Grenze wird nicht angehoben.',
  )
  return 1
}

export function main() {
  const quelle = argument('--quelle', WURZEL)
  const grenzDatei = argument('--grenzen', join(WURZEL, 'tools/heute-utc-grenzen.json'))
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
  console.log(`Heute-UTC in Ordnung: ${funde.length} Vorkommen, höchstens ${erlaubt} erlaubt.`)
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main())
