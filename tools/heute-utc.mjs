#!/usr/bin/env node
/**
 * Wächter: „heute“ als UTC-Tag (`new Date().toISOString().slice(0, 10)`) darf nur weniger werden.
 * Die Projektregel lässt Zeitzonen nur über shared/time.ts zu (`todayIso()`, Europe/Berlin); zwischen 0 und 2 Uhr
 * Berliner Zeit liefert die UTC-Form den Vortag. Gezählt wird im Syntaxbaum aller getrackten Code-Dateien in
 * pipeline/, tools/, shared/, worker/ und web/ (nicht extension/: eigenes Bündel ohne Import aus shared/).
 * Eine Stelle zählt, wenn `toISOString()` (oder `toJSON()`) auf „jetzt“ folgt und daran `.slice(0, 10)`,
 * `.substring(0, 10)`, `.substr(0, 10)` oder die erste Hälfte von `.split('T')` / `.split(/T/)` (`[0]`, `.shift()`,
 * `.at(0)`, `const [tag] = …`, auch mit `.slice(0)` dazwischen) hängt. „Jetzt“ ist `new Date()`, `new Date(Date.now())`,
 * auch als `globalThis.Date`, in Klammern, mit `as`/`!`, mit `['toISOString']`, und ein Name, der im selben Block (bei
 * Parametern: in der Funktion) mit so einem Wert oder mit dem ISO-Text davon beginnt (`const jetzt = new Date()`).
 * Ein gegebenes Datum zu formatieren (`new Date(x).toISOString().slice(0, 10)`) zählt nicht.
 * Bewusst nicht erfasst: versetzte Formen (`new Date(Date.now() - n)`), ein `Date`-Parameter ohne Vorgabe, dessen Aufrufer
 * „jetzt“ liefert (offiziell-abruf.ts, offiziell-stand.ts), Zuweisungen nach der Deklaration, gleichnamige Namen in
 * inneren Funktionen (zählen mit), Umbenennung von `Date`/`toISOString` und Weitergabe über Funktionsgrenzen.
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

const KOPF_ISO = new Set(['toISOString', 'toJSON'])
const SCHNITT = new Set(['slice', 'substring', 'substr'])
const GLOBAL = new Set(['globalThis', 'window', 'self', 'global'])
const aussen = (n) => ts.skipOuterExpressions(n)

/** `a.name` oder `a['name']`. */
function mitglied(n) {
  if (ts.isPropertyAccessExpression(n)) return { name: n.name.text, objekt: n.expression }
  if (ts.isElementAccessExpression(n) && ts.isStringLiteralLike(n.argumentExpression)) return { name: n.argumentExpression.text, objekt: n.expression }
  return undefined
}

/** `Date` oder `globalThis.Date`. */
function istDateKlasse(roh) {
  const n = aussen(roh)
  if (ts.isIdentifier(n)) return n.text === 'Date'
  const m = mitglied(n)
  const objekt = m === undefined ? undefined : aussen(m.objekt)
  return m?.name === 'Date' && objekt !== undefined && ts.isIdentifier(objekt) && GLOBAL.has(objekt.text)
}

/** Namen, die im Bereich ihrer Deklaration „jetzt“ (`datum`) oder dessen ISO-Text (`iso`) tragen. */
function neueBindungen() {
  const eintraege = []
  return {
    merke: (name, art, bereich) => eintraege.push({ name, art, bereich }),
    hat(id, art) {
      for (let p = id; p; p = p.parent) if (eintraege.some((e) => e.name === id.text && e.art === art && e.bereich === p)) return true
      return false
    },
  }
}

/** `new Date()`, `new Date(Date.now())` oder ein Name, der im Bereich so gebunden wurde. */
function istJetztDatum(roh, bind) {
  const n = aussen(roh)
  if (ts.isIdentifier(n)) return bind.hat(n, 'datum')
  if (!ts.isNewExpression(n) || !istDateKlasse(n.expression)) return false
  const args = n.arguments ?? []
  if (args.length === 0) return true
  const a = aussen(args[0])
  const m = args.length === 1 && ts.isCallExpression(a) ? mitglied(a.expression) : undefined
  return m?.name === 'now' && istDateKlasse(m.objekt)
}

const zahl = (n, wert) => n !== undefined && ts.isNumericLiteral(n) && n.text === String(wert)

/** ISO-Text von jetzt: `X.toISOString()` / `X.toJSON()` mit X = jetzt, oder ein Name dafür. */
function istIsoVonJetzt(roh, bind) {
  const n = aussen(roh)
  if (ts.isIdentifier(n)) return bind.hat(n, 'iso')
  const m = ts.isCallExpression(n) ? mitglied(n.expression) : undefined
  return m !== undefined && KOPF_ISO.has(m.name) && istJetztDatum(m.objekt, bind)
}

const istT = (a) => a !== undefined && ((ts.isStringLiteralLike(a) && a.text === 'T') || (ts.isRegularExpressionLiteral(a) && a.text === '/T/'))

/** Der ISO-Text von jetzt, an 'T' geteilt (auch mit `.slice(0)` dahinter). */
function istTeilListe(roh, bind) {
  const n = aussen(roh)
  const m = ts.isCallExpression(n) ? mitglied(n.expression) : undefined
  if (m === undefined) return false
  if (m.name === 'split') return n.arguments.length === 1 && istT(n.arguments[0]) && istIsoVonJetzt(m.objekt, bind)
  return m.name === 'slice' && n.arguments.length === 1 && zahl(n.arguments[0], 0) && istTeilListe(m.objekt, bind)
}

/** Der erste Eintrag einer Teilliste per `[0]`, `.shift()`, `.at(0)` oder `const [tag] = …`. */
function ersterTeil(n, bind) {
  if (ts.isElementAccessExpression(n)) return zahl(n.argumentExpression, 0) && istTeilListe(n.expression, bind)
  if (ts.isVariableDeclaration(n)) {
    const erstes = ts.isArrayBindingPattern(n.name) ? n.name.elements[0] : undefined
    return erstes !== undefined && ts.isBindingElement(erstes) && !erstes.dotDotDotToken && n.initializer !== undefined && istTeilListe(n.initializer, bind)
  }
  const m = ts.isCallExpression(n) ? mitglied(n.expression) : undefined
  if (m?.name === 'shift') return n.arguments.length === 0 && istTeilListe(m.objekt, bind)
  return m?.name === 'at' && n.arguments.length === 1 && zahl(n.arguments[0], 0) && istTeilListe(m.objekt, bind)
}

/** Kürzt der Aufruf den ISO-Text von jetzt auf den Tag? */
function kuerztAufTag(n, bind) {
  const m = ts.isCallExpression(n) ? mitglied(n.expression) : undefined
  if (m !== undefined && SCHNITT.has(m.name)) {
    const [von, bis] = n.arguments
    return n.arguments.length === 2 && zahl(von, 0) && zahl(bis, 10) && istIsoVonJetzt(m.objekt, bind)
  }
  return ersterTeil(n, bind)
}

/** Bindet Namen mit Anfangswert „jetzt“ an den Bereich der Deklaration (Block, Datei, Funktion bei Parametern). */
function merkeBindung(n, bind) {
  const name = ts.isVariableDeclaration(n) || ts.isParameter(n) ? n.name : undefined
  if (name === undefined || !ts.isIdentifier(name) || n.initializer === undefined) return
  const art = istJetztDatum(n.initializer, bind) ? 'datum' : istIsoVonJetzt(n.initializer, bind) ? 'iso' : undefined
  if (art === undefined) return
  const liste = n.parent
  const bereich = ts.isParameter(n) ? liste : ts.isVariableStatement(liste.parent) ? liste.parent.parent : liste.parent
  bind.merke(name.text, art, bereich)
}

/** Fundstellen `pfad:zeile` einer Quelle, eine je Vorkommen. */
export function stellenInQuelle(pfad, text) {
  const sf = ts.createSourceFile(pfad, text, ts.ScriptTarget.Latest, true)
  const bind = neueBindungen()
  const funde = []
  const besuche = (n) => {
    merkeBindung(n, bind)
    if (kuerztAufTag(n, bind)) funde.push(`${pfad}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`)
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
