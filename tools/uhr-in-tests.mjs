#!/usr/bin/env node
/**
 * Wächter: `new Date()` ohne Argument und `Date.now()` in Testdateien (`*.test.ts|mjs|cjs`) dürfen nur weniger werden.
 * Eine Prüfung gegen die echte Uhr wird am UTC-Tageswechsel oder zur Sendestunde rot, ohne dass jemand etwas geändert hat
 * (main war am 19.10.2026 so einen Montag lang rot). Neue Tests nehmen eine feste Zeit (`tools/feste-uhr.ts`).
 * Misst der Test die Uhr bewusst (Wartezeit, Alter einer Datei), steht in derselben Zeile `uhr-echt: <Grund>`; die Zeile zählt nicht.
 * Grenze: tools/uhr-in-tests-grenzen.json (Grundstand 19.10.2026), wird nie von Hand erhöht.
 *
 *   node tools/uhr-in-tests.mjs                              prüfen (Exit 1 bei mehr Vorkommen als erlaubt)
 *   node tools/uhr-in-tests.mjs --liste                      Datei:Zeile
 *   node tools/uhr-in-tests.mjs --festschreiben              Grenze auf den gesunkenen Stand setzen (erhöht nie)
 *   --quelle <ordner> --grenzen <datei>                      andere Wurzel (für den Test)
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const WURZEL = resolve(import.meta.dirname, '..')
const UHR = /new Date\(\)|Date\.now\(\)/g
const AUSNAHME = /uhr-echt:/
const UEBERSPRUNGEN = new Set(['node_modules', '.git', 'dist', 'public', 'data'])
const HINWEIS = 'Nur durch --festschreiben gesenkt, nie von Hand erhöht. Grundstand 19.10.2026.'

function testdateien(ordner) {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((e) => {
    const pfad = join(ordner, e.name)
    if (e.isDirectory()) return UEBERSPRUNGEN.has(e.name) || e.name.startsWith('_wt-') ? [] : testdateien(pfad)
    return /\.test\.(ts|mjs|cjs)$/.test(e.name) ? [pfad] : []
  })
}

/** Fundstellen `pfad:zeile`, eine je Vorkommen; Zeilen mit `uhr-echt:` zählen nicht. */
export function fundstellen(quelle) {
  const funde = []
  for (const datei of testdateien(quelle)) {
    const pfad = relative(quelle, datei).replaceAll('\\', '/')
    readFileSync(datei, 'utf8')
      .split('\n')
      .forEach((zeile, i) => {
        if (AUSNAHME.test(zeile)) return
        for (let n = zeile.match(UHR)?.length ?? 0; n > 0; n--) funde.push(`${pfad}:${i + 1}`)
      })
  }
  return funde
}

function argument(name, vorgabe) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? resolve(process.argv[i + 1]) : vorgabe
}

function zuViel(funde, erlaubt) {
  console.error(
    `✖ Tests mit echter Uhr (new Date() / Date.now()): ${funde.length} statt höchstens ${erlaubt}.\n` +
      'Neue Tests nehmen eine feste Zeit (tools/feste-uhr.ts); misst der Test die Uhr bewusst, steht „uhr-echt: Grund“ in der Zeile.\n' +
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
