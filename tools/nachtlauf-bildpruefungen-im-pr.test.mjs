/**
 * Test: Jede Bildprüfung des Nachtlaufs (`aussehen-pruefen.yml`) läuft auch im PR (`pr-pruefung.yml`), sonst wird main rot,
 * bevor ein PR es sah (`check:einstellungen`, 25.10.2026). Bewusste Lücken stehen in `AUSNAHMEN` mit Grund.
 * Zweite Regel: Jeder Matrix-`befehl` des Jobs `aussehen` gehört zu einer Wurzel von `pr-aussehen-pfade` (`WURZELN`),
 * sonst löst eine Änderung seiner Werkzeuge den Job nicht aus.
 * Aufruf: node tools/nachtlauf-bildpruefungen-im-pr.test.mjs  (läuft in check:workflows)
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parse } from 'yaml'
import { WURZELN } from './pr-aussehen-pfade.test.mjs'

const WURZEL = resolve(import.meta.dirname, '..')

/** Nachtlauf-Befehle, die der PR bewusst nicht fährt. Stand 25.10.2026: neun offene Lücken (Folgeauftrag: in die Matrix aufnehmen). */
export const AUSNAHMEN = {
  'check:trailer': 'Lücke 25.10.2026: nur nachts, noch nicht in der PR-Matrix',
  'check:tv-schalter': 'Lücke 25.10.2026: nur nachts, noch nicht in der PR-Matrix',
  'check:news': 'Lücke 25.10.2026: nur nachts, noch nicht in der PR-Matrix',
  'check:news --handy': 'Lücke 25.10.2026: nur nachts, noch nicht in der PR-Matrix',
  'check:kasten': 'Lücke 25.10.2026: nur nachts, noch nicht in der PR-Matrix',
  'check:disney-kasten': 'Lücke 25.10.2026: nur nachts, noch nicht in der PR-Matrix',
  'check:netflix-player': 'Lücke 25.10.2026: nur nachts, noch nicht in der PR-Matrix',
  'check:netflix-kasten': 'Lücke 25.10.2026: nur nachts, noch nicht in der PR-Matrix',
  'check:leiste': 'Lücke 25.10.2026: nur nachts, noch nicht in der PR-Matrix',
}

/** Der Nachtlauf schreibt die Bilder nach docs/ (`…:bilder`); der PR fährt die prüfende Fassung desselben Werkzeugs. */
const GLEICHE_PRUEFUNG = {
  'panel:bilder': 'check:panel',
  'ansichten:bilder': 'check:ansichten-desktop',
  'ansichten:bilder --handy': 'check:ansichten-handy',
}

/** `npm run x -- --handy` → `x --handy`; Nachtlauf-Namen auf die PR-Fassung abgebildet. */
export function schluessel(befehl) {
  const m = befehl.trim().match(/^npm run (\S+)(?: -- (.*))?$/)
  if (!m) return null
  const roh = m[2] ? `${m[1]} ${m[2].trim()}` : m[1]
  return GLEICHE_PRUEFUNG[roh] ?? roh
}

/** Alle `npm run`-Schlüssel der Schritte (und optional Matrix-Befehle) eines Workflow-Dokuments. */
export function befehleVon(doc, mitMatrix) {
  const aus = []
  for (const job of Object.values(doc.jobs)) {
    for (const s of job.steps ?? []) if (typeof s.run === 'string') aus.push(schluessel(s.run))
    if (mitMatrix) for (const e of job.strategy?.matrix?.include ?? []) aus.push(schluessel(e.befehl ?? ''))
  }
  return aus.filter(Boolean)
}

/** Nachtlauf-Prüfungen ohne PR-Gegenstück und ohne Ausnahme. */
export function fehlendeImPr(nachts, pr, ausnahmen) {
  return nachts.filter((n) => n.startsWith('check:') || n.endsWith(':bilder')).filter((n) => !pr.includes(n) && !(n in ausnahmen))
}

/** Matrix-Befehle, die zu keiner Wurzel gehören. */
export function ohneWurzel(matrixBefehle, wurzeln) {
  return matrixBefehle.filter((b) => !wurzeln.some((w) => b === w || b.startsWith(`${w}-`)))
}

function lade(datei) {
  return parse(readFileSync(resolve(WURZEL, '.github/workflows', datei), 'utf8'))
}

function main() {
  const nachts = befehleVon(lade('aussehen-pruefen.yml'), false)
  const prDoc = lade('pr-pruefung.yml')
  const pr = befehleVon(prDoc, true)
  assert.ok(nachts.length >= 10, `zu wenige Nachtlauf-Prüfungen erkannt (${nachts.length})`)
  assert.ok(pr.length >= 4, `zu wenige PR-Prüfungen erkannt (${pr.length})`)

  const fehlen = fehlendeImPr(nachts, pr, AUSNAHMEN)
  assert.deepEqual(fehlen, [], `Nachtlauf-Bildprüfung fehlt im PR (Matrix aufnehmen oder in AUSNAHMEN mit Grund): ${fehlen.join(', ')}`)

  const veraltet = Object.keys(AUSNAHMEN).filter((a) => pr.includes(a) || !nachts.includes(a))
  assert.deepEqual(veraltet, [], `AUSNAHMEN veraltet (läuft jetzt im PR oder nicht mehr nachts): ${veraltet.join(', ')}`)

  const matrix = prDoc.jobs.aussehen.strategy.matrix.include.map((e) => schluessel(e.befehl))
  const lose = ohneWurzel(matrix, WURZELN)
  assert.deepEqual(lose, [], `Matrix-Befehl ohne Wurzel in pr-aussehen-pfade: ${lose.join(', ')}`)
  console.log(`nachtlauf-bildpruefungen-im-pr.test: grün (${nachts.length} nachts, ${Object.keys(AUSNAHMEN).length} Ausnahmen, ${matrix.length} Matrix-Befehle)`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main()
