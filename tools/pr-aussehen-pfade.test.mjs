/**
 * Test: Die Pfadliste (`PFADE`) im Job `aussehen` von pr-pruefung.yml nennt jede Datei, die `check:panel` und `check:ansichten`
 * ausführen. Ein PR, der nur die Trefferprobe ändert, muss den Job auslösen (Prüfer, 16.10.2026).
 * Aufruf: node tools/pr-aussehen-pfade.test.mjs  (läuft in check:workflows)
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'yaml'

const WURZEL = resolve(import.meta.dirname, '..')
const doc = parse(readFileSync(resolve(WURZEL, '.github/workflows/pr-pruefung.yml'), 'utf8'))
const skript = doc.jobs.aussehen.steps.find((s) => s.id === 'pfad').run

/** Setzt die `PFADE=…`-Zeilen des Shell-Skripts zu einem regulären Ausdruck zusammen. */
function pfadAusdruck(text) {
  let wert = ''
  for (const zeile of text.split('\n')) {
    const m = zeile.match(/^\s*PFADE=(['"])(.*)\1\s*$/)
    if (m) wert = m[2].replace('$PFADE', wert)
  }
  return new RegExp(wert)
}

const ausdruck = pfadAusdruck(skript)
const MUSS = [
  'tools/trefferprobe-browser.mjs',
  'tools/trefferprobe-ausnahmen.mjs',
  'tools/trefferprobe-selbsttest.mjs',
  'tools/ansicht-trefferprobe.mjs',
  'tools/panel-messen.mjs',
  'tools/panel-messen-browser.mjs',
  'tools/ansicht-bild.mjs',
  'tools/panel-bild.mjs',
  'tools/schwer.mjs', // Wrapt check:panel und check:ansichten (package.json)
  'tools/schwerer-lauf.mjs',
  'tools/einzel-sperre.mjs',
  'tools/einzel-sperre-schlange.mjs',
  'tools/bau-vergleich-log.mjs',
  'package.json',
  'web/src/main.tsx',
  '.github/workflows/pr-pruefung.yml',
]
for (const datei of MUSS) assert.match(datei, ausdruck, `${datei} löst den Job aussehen nicht aus`)
assert.doesNotMatch('tools/andere-datei.mjs', ausdruck, 'Pfadliste ist zu weit')
console.log(`pr-aussehen-pfade.test: grün (${MUSS.length} Dateien)`)
