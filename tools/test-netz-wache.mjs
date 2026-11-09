#!/usr/bin/env node
/**
 * Wächter „Tests gehen nicht ins Netz“: Jede Datei, die einen Browser startet (`launch`, `launchPersistentContext`,
 * `newContext`, `newPage`), fängt Fremdanfragen ab — ein Aufruf `route('**\/*', …)`, `route('**', …)`, eine
 * Regex-Route auf `^https?:` bzw. `.*` oder `sperreNetz(…)` aus `tools/netz-sperre.mjs`. Ausnahmen stehen unten mit Grund.
 * Grenze: geprüft wird je Datei, nicht je Seite — wer mehrere Seiten anlegt, sperrt jede selbst.
 *
 * Anlass (07.11.2026, PR 3112): `netflix-kasten-klick.test.mjs` ließ die echten Netflix-Skripte ihre Anfragen an den
 * Newsletter-Worker senden, rund 320 je Kettenlauf (78.189 von 100.000 Tageslimit).
 * Nicht gedeckt: Node-Tests der Erweiterung (`extension/*.test.cjs`) laufen in `vm` mit eigenem `fetch`, kein Browser.
 *
 * Aufruf: `node tools/test-netz-wache.mjs [--wurzel <ordner>] [--ausnahmen <json>]` (Exit 1 bei Verstoß; die Optionen sind für den Test).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

/* Pfad -> Grund: Dateien, die absichtlich online gehen. Eigene Datei mit „ausnahmen“ im Namen, damit die
 * skript-aufrufer-wache die Pfade als Daten liest und nicht als Aufrufer zählt (sonst fällt jede Ausnahme dort durch). */
export const AUSNAHMEN = JSON.parse(readFileSync(join(import.meta.dirname, 'test-netz-ausnahmen.json'), 'utf8'))

const STARTER = new Set(['launch', 'launchPersistentContext', 'newContext', 'newPage'])
const ALLES_STRING = new Set(['**/*', '**'])
// Ganze Regex-Körper, die jede http(s)-Adresse treffen; ein Teilpfad (`^https?:\/\/api\.x\/`) ist keine Sperre.
const ALLES_REGEX = new Set(['.*', '^.*', '.*$', '^.*$', '^https?:', '^https?:\\/\\/', '^https?:\\/\\/.*', '^https?:\\/\\/.*$'])
// Empfänger von `route`: Seite oder Kontext, nicht irgendein Objekt (`app.route`).
const EMPFAENGER = /^(page|seite|s|p|c|ctx|context|kontext|browserContext|seiteOderKontext|[a-z]*(Seite|Page|Kontext|Context)(Obj)?)$/i
const SPERRENDE_AUFRUFE = new Set(['abort', 'fulfill'])
const ENDUNGEN = /\.(mjs|cjs|ts|tsx)$/
const AUSGELASSEN = new Set(['node_modules', 'archiv', '.git', 'dist', 'data'])
const BEREICHE = ['tools', 'pipeline', 'extension', 'web/src']

function aufrufName(knoten) {
  const f = knoten.expression
  return ts.isPropertyAccessExpression(f) ? f.name.text : ts.isIdentifier(f) ? f.text : ''
}

function istAllesMuster(arg) {
  if (!arg) return false
  if (ts.isStringLiteralLike(arg)) return ALLES_STRING.has(arg.text)
  if (!ts.isRegularExpressionLiteral(arg)) return false
  return ALLES_REGEX.has(arg.text.slice(1, arg.text.lastIndexOf('/')))
}

/** Ruft der Teilbaum `abort`/`fulfill` auf, direkt oder über eine Funktion aus `sperrer`? */
function ruftSperre(baum, sperrer) {
  let ja = false
  const besuche = (k) => {
    if (ts.isCallExpression(k)) {
      const n = aufrufName(k)
      if (SPERRENDE_AUFRUFE.has(n) || (ts.isIdentifier(k.expression) && sperrer.get(n) === true)) ja = true
    }
    ts.forEachChild(k, besuche)
  }
  besuche(baum)
  return ja
}

const istFunktion = (k) => ts.isArrowFunction(k) || ts.isFunctionExpression(k)

/** Funktionen dieser Datei: Name -> ruft sie selbst `abort`/`fulfill` auf (eine Stufe, für Handler wie `antworte`)? */
function sperrFunktionen(quelle) {
  const karte = new Map()
  const besuche = (k) => {
    if (ts.isFunctionDeclaration(k) && k.name && k.body) karte.set(k.name.text, ruftSperre(k.body, karte))
    const init = ts.isVariableDeclaration(k) && ts.isIdentifier(k.name) ? k.initializer : undefined
    if (init && istFunktion(init)) karte.set(k.name.text, ruftSperre(init.body, karte))
    ts.forEachChild(k, besuche)
  }
  besuche(quelle)
  return karte
}

/* Eigene Funktion der Datei: ihr Rumpf zählt. Fremde (importiert, Parameter) und Fabrikaufrufe `ausliefern(daten)`
 * werden vertraut — Grenze des Wächters; ein Inline-Handler ohne abort/fulfill (nur `continue`) gilt nicht. */
function handlerSperrt(h, karte) {
  if (!h) return false
  const name = ts.isIdentifier(h) ? h.text : ts.isCallExpression(h) && ts.isIdentifier(h.expression) ? h.expression.text : ''
  if (name) return karte.has(name) ? karte.get(name) : true
  return istFunktion(h) && ruftSperre(h.body, karte)
}

/** `seite.route(<alles>, <Handler, der abort/fulfill ruft>)` auf einer Seite oder einem Kontext. */
function istSperrRoute(k, sperrer) {
  const f = k.expression
  if (!ts.isPropertyAccessExpression(f) || f.name.text !== 'route') return false
  const e = f.expression
  const empfaenger = ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : ''
  return EMPFAENGER.test(empfaenger) && istAllesMuster(k.arguments[0]) && handlerSperrt(k.arguments[1], sperrer)
}

/** { startet, abgesichert } aus dem Syntaxbaum — Kommentare und Zeichenketten zählen nicht. */
export function untersuche(text, name = 'x.ts') {
  const quelle = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true)
  const sperrer = sperrFunktionen(quelle)
  let startet = false
  let abgesichert = false
  const besuche = (k) => {
    if (ts.isCallExpression(k)) {
      if (STARTER.has(aufrufName(k))) startet = true
      if (istSperrRoute(k, sperrer)) abgesichert = true
      if (ts.isIdentifier(k.expression) && k.expression.text === 'sperreNetz') abgesichert = true
    }
    ts.forEachChild(k, besuche)
  }
  besuche(quelle)
  return { startet, abgesichert }
}

function dateien(ordner, liste = []) {
  for (const e of readdirSync(ordner, { withFileTypes: true })) {
    if (AUSGELASSEN.has(e.name)) continue
    const p = join(ordner, e.name)
    if (e.isDirectory()) dateien(p, liste)
    else if (ENDUNGEN.test(e.name)) liste.push(p)
  }
  return liste
}

/** Verstöße (ohne Absicherung, ohne Ausnahme) und Zähler. */
export function pruefe(wurzel, ausnahmen = AUSNAHMEN) {
  let browser = 0
  let abgesichert = 0
  let ausgenommen = 0
  const verstoesse = []
  const gesehen = new Set()
  for (const b of BEREICHE) {
    let liste = []
    try {
      liste = dateien(join(wurzel, b))
    } catch {
      continue
    }
    for (const datei of liste) {
      const rel = relative(wurzel, datei).split('\\').join('/')
      const u = untersuche(readFileSync(datei, 'utf8'), rel)
      if (!u.startet) continue
      browser++
      if (rel in ausnahmen) {
        gesehen.add(rel)
        ausgenommen++
      } else if (u.abgesichert) abgesichert++
      else verstoesse.push(rel)
    }
  }
  const veraltet = Object.keys(ausnahmen).filter((a) => !gesehen.has(a))
  return { browser, abgesichert, ausgenommen, verstoesse, veraltet }
}

function main() {
  const i = process.argv.indexOf('--wurzel')
  const wurzel = i > 0 ? resolve(process.argv[i + 1]) : resolve(import.meta.dirname, '..')
  const a = process.argv.indexOf('--ausnahmen')
  const e = pruefe(wurzel, a > 0 ? JSON.parse(readFileSync(process.argv[a + 1], 'utf8')) : AUSNAHMEN)
  for (const v of e.verstoesse) console.error(`✖ ${v}: startet einen Browser ohne Catch-all-route`)
  for (const v of e.veraltet) console.error(`✖ ${v}: Ausnahme ohne Browserstart — aus AUSNAHMEN streichen`)
  const ok = e.verstoesse.length === 0 && e.veraltet.length === 0 && e.browser > 0
  console.log(`test-netz-wache: ${e.browser} Dateien mit Browser, ${e.abgesichert} abgesichert, ${e.ausgenommen} Ausnahmen, ${e.verstoesse.length} Verstöße`)
  return ok ? 0 : 1
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main())
