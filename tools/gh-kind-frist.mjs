/**
 * Ratsche: `gh`-Aufrufe in Werkzeugen ohne Frist. Ein hängendes `gh` (Netz, Auth-Abfrage) blockierte die Prüfkette bis zur Jobfrist.
 * Als `gh`-Aufruf zählt ein Aufruf, bei dem (a) das erste Argument die Zeichenkette 'gh' ist und ein zweites folgt, (b) das erste
 * Argument ein Name/Ausdruck mit gh/GH ist (`GH`, `ghBefehl`, `process.env.GH_BIN || 'gh'`) oder (c) ein Kindprozess-Aufruf
 * (`spawnSync`, `execFileSync` … nach Namen) in einer Funktion steht, die irgendwo 'gh' als Zeichenkette trägt (`programm[0]`).
 * Eine Frist hat der Aufruf, wenn ein Optionenobjekt `timeout`/`limitMs` mit Wert ≠ 0/undefined/null setzt oder er über
 * `mitLimit`/`spawnMitLimit` (tools/kind-mit-limit.mjs, ohne `limitMs: 0`) läuft.
 * Geltungsbereich: `tools/*.mjs|cjs` ohne `*.test.*` (Tests deckt `test-kind-frist.mjs`). NICHT erfasst: Aufrufe über Wrapper, die
 * 'gh' nicht als erstes Argument tragen, und `pipeline/`. Stand je Datei in `tools/gh-kind-frist-stand.json`, darf nur sinken.
 * Erzeugen: `node tools/gh-kind-frist.mjs --stand-schreiben`; für Proben `--wurzel <ordner> --stand <datei>`.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { fristWirksam } from './test-kind-frist.mjs'

const KIND_NAMEN = new Set(['spawnSync', 'execFileSync', 'execSync', 'spawn', 'execFile', 'exec', 'fork'])
const HELFER = new Set(['mitLimit', 'spawnMitLimit'])
const GH_AUSDRUCK = /(^|[^A-Za-z])(gh|GH)([^a-z]|$)|ghBefehl/
const FUNKTION = (n) => ts.isFunctionLike(n)

const aufrufName = (c) => (ts.isIdentifier(c.expression) ? c.expression.text : ts.isPropertyAccessExpression(c.expression) ? c.expression.name.text : '')
const istGhLiteral = (a) => !!a && ts.isStringLiteralLike(a) && a.text === 'gh'
/** `limitMs: 0`/`undefined` hebt die Frist der Helfer auf (siehe test-kind-frist.mjs). */
const helferOhneFrist = (c) => c.arguments.some((a) => ts.isObjectLiteralExpression(a) && a.properties.some((p) => ts.isPropertyAssignment(p) && p.name.getText() === 'limitMs' && /^(0|undefined|null)$/.test(p.initializer.getText())))

function umgebendeFunktion(n) {
  for (let p = n.parent; p; p = p.parent) if (FUNKTION(p)) return p
  return null
}

function istGhAufruf(c) {
  const erstes = c.arguments[0]
  if (!erstes) return false
  if (istGhLiteral(erstes)) return c.arguments.length >= 2 && !/^(replace|includes|startsWith|endsWith|indexOf|push|has|add|set)$/.test(aufrufName(c))
  const name = aufrufName(c)
  if (!KIND_NAMEN.has(name) && !HELFER.has(name)) return false
  if (GH_AUSDRUCK.test(erstes.getText())) return true
  const bereich = umgebendeFunktion(c)
  return KIND_NAMEN.has(name) && !ts.isStringLiteralLike(erstes) && !!bereich && /['"]gh['"]/.test(bereich.getText())
}

/** Zeilennummern der `gh`-Aufrufe ohne wirksame Frist. */
export function ghAufrufeOhneFrist(quelltext, dateiname = 'x.mjs') {
  const sf = ts.createSourceFile(dateiname, quelltext, ts.ScriptTarget.Latest, true)
  const zeilen = []
  const geh = (n) => {
    if (ts.isCallExpression(n) && istGhAufruf(n)) {
      const helfer = HELFER.has(aufrufName(n))
      const frist = helfer ? !helferOhneFrist(n) : n.arguments.some(fristWirksam)
      if (!frist) zeilen.push(sf.getLineAndCharacterOfPosition(n.getStart()).line + 1)
    }
    ts.forEachChild(n, geh)
  }
  geh(sf)
  return zeilen
}

const geprueft = (f) => /\.(mjs|cjs)$/.test(f) && !/\.test\./.test(f)

/** Zahl je Datei plus die Zeilen (für die PR-Liste). */
export function zaehle(wurzel) {
  const stand = {}
  const zeilen = {}
  for (const f of readdirSync(join(wurzel, 'tools')).filter(geprueft).sort()) {
    const z = ghAufrufeOhneFrist(readFileSync(join(wurzel, 'tools', f), 'utf8'), f)
    if (z.length > 0) {
      stand[`tools/${f}`] = z.length
      zeilen[`tools/${f}`] = z
    }
  }
  return { stand, zeilen }
}

/** Mehr als im Stand: Fehler; weniger: Stand senken (sonst bleibt Platz für neue). */
export function vergleiche(ist, soll) {
  const probleme = []
  for (const datei of new Set([...Object.keys(ist), ...Object.keys(soll)])) {
    const a = ist[datei] ?? 0
    const s = soll[datei] ?? 0
    if (a > s) probleme.push(`${datei}: ${a} gh-Aufrufe ohne Frist, erlaubt ${s} (timeout setzen oder mitLimit aus tools/kind-mit-limit.mjs nehmen)`)
    if (a < s) probleme.push(`${datei}: nur noch ${a} gh-Aufrufe ohne Frist, Stand in tools/gh-kind-frist-stand.json auf ${a} senken (node tools/gh-kind-frist.mjs --stand-schreiben)`)
  }
  return probleme
}

export const STAND_DATEI = fileURLToPath(new URL('./gh-kind-frist-stand.json', import.meta.url))
export const summe = (stand) => Object.values(stand).reduce((x, y) => x + y, 0)

const argWert = (name, vorgabe) => (process.argv.includes(name) ? resolve(process.argv[process.argv.indexOf(name) + 1]) : vorgabe)

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const wurzel = argWert('--wurzel', fileURLToPath(new URL('..', import.meta.url)))
  const standDatei = argWert('--stand', STAND_DATEI)
  const { stand: ist, zeilen } = zaehle(wurzel)
  if (process.argv.includes('--stand-schreiben')) {
    writeFileSync(standDatei, `${JSON.stringify(ist, null, 2)}\n`)
    console.log(`gh-kind-frist: Stand geschrieben, ${summe(ist)} gh-Aufrufe ohne Frist in ${Object.keys(ist).length} Dateien.`)
  } else if (process.argv.includes('--zeilen')) {
    for (const [d, z] of Object.entries(zeilen)) console.log(`${d}: ${z.join(', ')}`)
  } else {
    const probleme = vergleiche(ist, JSON.parse(readFileSync(standDatei, 'utf8')))
    for (const p of probleme) console.error(`✖ ${p}`)
    console.log(`gh-kind-frist: ${summe(ist)} gh-Aufrufe ohne Frist in ${Object.keys(ist).length} Dateien, ${probleme.length} Verstöße.`)
    process.exit(probleme.length ? 1 : 0)
  }
}
