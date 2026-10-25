/**
 * Test: Die Pfadliste (`PFADE`) im Job `aussehen` von pr-pruefung.yml nennt jede Datei, die `check:panel` und `check:ansichten`
 * ausführen. Ein PR, der nur die Trefferprobe ändert, muss den Job auslösen (Prüfer, 16.10.2026).
 * Die Menge kommt aus `package.json` (Aufrufe `node tools/…` und `npm run …`, rekursiv) samt den relativen Importen der Werkzeuge
 * (Syntaxbaum; dynamische Importe zählt der Test nicht), keine Handliste.
 * Aufruf: node tools/pr-aussehen-pfade.test.mjs  (läuft in check:workflows)
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import { parse } from 'yaml'

const WURZEL = resolve(import.meta.dirname, '..')
const WURZELN = ['check:panel', 'check:ansichten', 'check:einstellungen']

/** Setzt die `PFADE=…`-Zeilen des Shell-Skripts zu einem regulären Ausdruck zusammen. */
export function pfadAusdruck(text) {
  let wert = ''
  for (const zeile of text.split('\n')) {
    const m = zeile.match(/^\s*PFADE=(['"])(.*)\1\s*$/)
    if (m) wert = m[2].replace('$PFADE', wert)
  }
  return new RegExp(wert)
}

/** Alle Skriptdateien (`tools/….mjs`), die das npm-Skript `name` und seine `npm run`-Aufrufe starten. */
export function skripteVon(scripts, name, gesehen = new Set()) {
  const dateien = new Set()
  if (gesehen.has(name)) return dateien
  gesehen.add(name)
  /* Auch verschachtelt: `node tools/schwer.mjs node tools/x.mjs` und `node tools/schwer.mjs npm run y` starten beide Ziele. */
  for (const schritt of scripts[name].split('&&')) {
    for (const m of schritt.matchAll(/\bnpm run (\S+)/g)) skripteVon(scripts, m[1], gesehen).forEach((d) => dateien.add(d))
    for (const m of schritt.matchAll(/\bnode (tools\/\S+\.mjs)/g)) dateien.add(m[1])
  }
  return dateien
}

/** Relative Importe und Re-Exporte einer Datei als Pfade ab der Wurzel. */
export function importeVon(datei, lies = (p) => readFileSync(join(WURZEL, p), 'utf8')) {
  const baum = ts.createSourceFile(datei, lies(datei), ts.ScriptTarget.Latest)
  const ziele = []
  for (const knoten of baum.statements) {
    const spez = (ts.isImportDeclaration(knoten) || ts.isExportDeclaration(knoten)) && knoten.moduleSpecifier
    if (spez && spez.text.startsWith('.')) ziele.push(join(dirname(datei), spez.text).replaceAll('\\', '/'))
  }
  return ziele
}

/** Skripte samt allem, was sie aus `tools/` importieren (abgeschlossene Hülle; `shared/` ist Anwendungscode, den löst `web/src` aus). */
export function huelle(start, lies) {
  const alle = new Set(start)
  for (const datei of alle) importeVon(datei, lies).filter((z) => z.startsWith('tools/')).forEach((z) => alle.add(z))
  return alle
}

function main() {
  const doc = parse(readFileSync(resolve(WURZEL, '.github/workflows/pr-pruefung.yml'), 'utf8'))
  const ausdruck = pfadAusdruck(doc.jobs.aussehen.steps.find((s) => s.id === 'pfad').run)
  const scripts = JSON.parse(readFileSync(resolve(WURZEL, 'package.json'), 'utf8')).scripts
  const namen = Object.keys(scripts).filter((n) => WURZELN.some((w) => n === w || n.startsWith(`${w}-`)))
  const dateien = huelle(namen.flatMap((n) => [...skripteVon(scripts, n)]))
  const muss = [...dateien, 'package.json', 'web/src/main.tsx', '.github/workflows/pr-pruefung.yml']
  const fehlen = muss.filter((d) => !ausdruck.test(d))
  assert.deepEqual(fehlen, [], `lösen den Job aussehen nicht aus: ${fehlen.join(', ')}`)
  assert.ok(dateien.size >= 15, `zu wenige Werkzeuge erkannt (${dateien.size})`)
  assert.doesNotMatch('tools/andere-datei.mjs', ausdruck, 'Pfadliste ist zu weit')
  console.log(`pr-aussehen-pfade.test: grün (${muss.length} Dateien)`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main()
