#!/usr/bin/env node
/**
 * **Ladezeiten dauerhaft überwachen** (12.10.2026, Daniel: „Ladezeiten dauerhaft überwachen")
 *
 * Misst am Handy (Pixel 7, 4× CPU) gegen den gebauten Stand `dist/`: Zeit bis der Kalender sichtbar ist, Monat↔Woche,
 * Wochen blättern, Filter öffnen, Detail-Panel öffnen. Je Messgröße gilt eine Zeitgrenze (`ladezeiten-grenzen.mjs`);
 * reißt der Median sie, endet der Lauf mit Exit 1. `dist/` wird ohne Server und ohne Netz ausgeliefert (Playwright-Routen).
 *
 * Aufruf: `npm run check:ladezeiten` bzw. `node tools/ladezeiten-messen.mjs [--bauen] [--nur-messen] [--n 5] [--ladungen 3]`
 *   --bauen        vorher `npm run build:schlank` (sonst Abbruch, wenn `dist/` älter als `web/src` ist)
 *   --nur-messen   Bericht ohne Urteil, Exit 0 (zum Neumessen der Grenzen)
 * Nicht gemessen: Netz (Übertragung, Cover), nur CPU-Kosten von Laden und Umschalten. Netz misst `leistung-messen.mjs` gegen live.
 */
import { execSync } from 'node:child_process'
import path from 'node:path'
import { distPruefen } from './dist-frisch.mjs'
import { median } from './tempo-kern.mjs'
import { messlauf } from './ladezeiten-lauf.mjs'
import { MESSTAG, urteile } from './ladezeiten-grenzen.mjs'

const arg = (name, vorgabe) => (process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : vorgabe)
const hat = (name) => process.argv.includes(`--${name}`)
const WURZEL = path.resolve(import.meta.dirname, '..')
const DIST = path.join(WURZEL, 'dist')

function bericht(werte, urteilsListe) {
  const grenzen = new Map(urteilsListe.map((u) => [u.name, u]))
  console.log('Messgröße'.padEnd(18), 'Median'.padStart(7), 'Grenze'.padStart(7), 'min–max (ms)')
  for (const [name, w] of werte) {
    const u = grenzen.get(name)
    const grenze = u ? `${u.grenze}`.padStart(7) : '      –'
    const marke = u && !u.ok ? '  ZU LANGSAM' : ''
    console.log(name.padEnd(18), String(median(w)).padStart(7), grenze, `${Math.min(...w)}–${Math.max(...w)}${marke}`)
  }
}

async function main() {
  if (hat('bauen')) execSync('npm run build:schlank', { cwd: WURZEL, stdio: 'inherit', shell: true })
  if (!distPruefen(WURZEL)) return
  const start = Date.now()
  const werte = await messlauf({ dist: DIST, drossel: Number(arg('drossel', 4)), ladungen: Number(arg('ladungen', 3)), wiederholungen: Number(arg('n', 5)) })
  const urteilsListe = urteile(werte, median)
  bericht(werte, urteilsListe)
  console.log(`Laufzeit ${Math.round((Date.now() - start) / 1000)} s · Grenzen vom ${MESSTAG} (Median × 1,5)`)
  if (!hat('nur-messen') && urteilsListe.some((u) => !u.ok)) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
