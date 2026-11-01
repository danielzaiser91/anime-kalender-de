#!/usr/bin/env node
/**
 * Sperrklinke: `pipeline/check-logic.ts` liest Quelltext (Zusicherungen per `includes`/Regex auf den Text einer .ts/.js/.mjs-Datei).
 * Jede solche Lesung ist ein Kandidat für einen Laufzeittest; ihre Zahl darf nur sinken.
 * Gezählt werden Zeilen mit `readFileSync(… .ts|.js|.mjs'`/`"` (dasselbe Maß wie `grep -cE`). Wer eine Lesung durch einen Laufzeittest ersetzt,
 * senkt `grenze` in `tools/quelltext-lesungen-grenze.json` von Hand auf den neuen Stand; erhöht wird sie nie.
 *
 * Aufruf: node tools/quelltext-lesungen.mjs [--datei <check-logic.ts>] [--grenzen <json>]   (Exit 1: über der Grenze oder Datei unlesbar)
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const WURZEL = resolve(import.meta.dirname, '..')
const LESUNG = /readFileSync\(.*\.(ts|js|mjs)['"]/

/** Zeilennummern der Quelltext-Lesungen im Text. */
export function lesungen(text) {
  return text.split('\n').flatMap((zeile, i) => (LESUNG.test(zeile) ? [i + 1] : []))
}

function argument(name, vorgabe) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? resolve(process.argv[i + 1]) : vorgabe
}

function main() {
  const datei = argument('--datei', join(WURZEL, 'pipeline/check-logic.ts'))
  const grenzDatei = argument('--grenzen', join(WURZEL, 'tools/quelltext-lesungen-grenze.json'))
  let funde
  let grenze
  try {
    funde = lesungen(readFileSync(datei, 'utf8'))
    grenze = JSON.parse(readFileSync(grenzDatei, 'utf8')).grenze
  } catch (e) {
    console.error(`✖ Quelltext-Lesungen nicht prüfbar: ${e.message}`)
    return 1
  }
  if (!Number.isInteger(grenze) || grenze < 0) {
    console.error(`✖ Quelltext-Lesungen: Feld „grenze“ in ${grenzDatei} fehlt oder ist keine ganze Zahl`)
    return 1
  }
  const zeile = `Quelltext-Lesungen in check-logic.ts: ${funde.length} (Grenze ${grenze})`
  if (funde.length > grenze) {
    console.error(
      `✖ ${zeile}\n  Zeilen: ${funde.join(', ')}\n` +
        '  Eine neue Zusicherung läuft als Laufzeittest (eigene Datei in tools/check-logic-liste.txt), nicht als Textprüfung. Die Grenze wird nicht angehoben.',
    )
    return 1
  }
  console.log(`${zeile}${funde.length < grenze ? ' — gesunken: grenze in tools/quelltext-lesungen-grenze.json auf den neuen Stand setzen' : ''}`)
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main())
