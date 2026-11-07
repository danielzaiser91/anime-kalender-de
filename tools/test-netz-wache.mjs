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
 * Aufruf: `node tools/test-netz-wache.mjs [--wurzel <ordner>] [--ohne-ausnahmen]` (Exit 1 bei Verstoß; die Optionen sind für den Test).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

/** Greifen absichtlich online zu (Messung/Sammler gegen echte Seiten) und sind keine Tests. */
export const AUSNAHMEN = {
  'tools/handy-tempo.mjs': 'Messung gegen die Live-Seite',
  'tools/leistung-messen.mjs': 'Messung gegen die Live-Seite',
  'tools/panel-stichprobe.mjs': 'Stichprobe gegen die Live-Seite',
  'tools/testlink.mjs': 'ruft Links von Hand ab',
  'tools/messung-crunchyroll-region.mjs': 'Messung gegen Crunchyroll',
  'tools/lauf-status-app-pruefen.mjs': 'Electron-App; ihre beiden einzigen Netzziele sind einzeln geroutet',
  'pipeline/belege-lesen.ts': 'Sammler liest echte Seiten',
  'pipeline/messbelege.ts': 'Sammler liest echte Seiten',
  'pipeline/sammelartikel-poc.ts': 'PoC gegen echte Seiten',
  'pipeline/scrape-crunchyroll-dub.ts': 'Sammler',
  'pipeline/scrape-crunchyroll-woche.ts': 'Sammler',
  'pipeline/lib/crunchyroll-api.ts': 'Sammler',
}

const STARTER = new Set(['launch', 'launchPersistentContext', 'newContext', 'newPage'])
const ALLES_STRING = new Set(['**/*', '**'])
const ENDUNGEN = /\.(mjs|cjs|ts|tsx)$/
const AUSGELASSEN = new Set(['node_modules', 'archiv', '.git', 'dist', 'data'])
const BEREICHE = ['tools', 'pipeline', 'extension', 'web/src']

function aufrufName(knoten) {
  const f = knoten.expression
  return ts.isPropertyAccessExpression(f) ? f.name.text : ts.isIdentifier(f) ? f.text : ''
}

function istAllesRoute(arg) {
  if (!arg) return false
  if (ts.isStringLiteralLike(arg)) return ALLES_STRING.has(arg.text)
  if (ts.isRegularExpressionLiteral(arg)) return /^\/(\^https\?:|\.\*\/)/.test(arg.text)
  return false
}

/** { startet, abgesichert } aus dem Syntaxbaum — Kommentare und Zeichenketten zählen nicht. */
export function untersuche(text, name = 'x.ts') {
  const quelle = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true)
  let startet = false
  let abgesichert = false
  const besuche = (k) => {
    if (ts.isCallExpression(k)) {
      const n = aufrufName(k)
      if (STARTER.has(n)) startet = true
      if (n === 'route' && istAllesRoute(k.arguments[0])) abgesichert = true
      if (n === 'sperreNetz') abgesichert = true
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
  const e = pruefe(wurzel, process.argv.includes('--ohne-ausnahmen') ? {} : AUSNAHMEN)
  for (const v of e.verstoesse) console.error(`✖ ${v}: startet einen Browser ohne Catch-all-route`)
  for (const v of e.veraltet) console.error(`✖ ${v}: Ausnahme ohne Browserstart — aus AUSNAHMEN streichen`)
  const ok = e.verstoesse.length === 0 && e.veraltet.length === 0 && e.browser > 0
  console.log(`test-netz-wache: ${e.browser} Dateien mit Browser, ${e.abgesichert} abgesichert, ${e.ausgenommen} Ausnahmen, ${e.verstoesse.length} Verstöße`)
  return ok ? 0 : 1
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main())
