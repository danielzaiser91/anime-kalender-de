#!/usr/bin/env node
/**
 * Umfang von „Bühne-Messen“ in der PR-Kette (20.11.2026): Voll-Messung ≈ 16–20 min, darum gilt
 *  - berührt der Diff nur Dateien unter web/buehne/mockups/ (und Text, der die Bühne nicht liest), misst der Lauf nur die Mockups,
 *    deren Datei (oder deren Importeur, auch mittelbar) sich geändert hat;
 *  - jede andere Datei (web/src, Bühnen-Code, Werkzeuge, Workflow, Zweifel) misst alles;
 *  - die Messung ist in Scheiben `k/n` geteilt (Matrix im Workflow): Gruppe i (Mockup × Fall × Zeit, alle Varianten zusammen, damit das Vorher der ersten Variante bei jeder liegt) gehört zu Scheibe i mod n.
 *
 *   node tools/buehne-umfang.mjs <ref-a> <ref-b>   gibt `mockups=<name,name>` (leer = alles) aus, Exit 0; nur Node-Bordmittel (Scope vor `npm ci`)
 */
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const MOCKUPS = 'web/buehne/mockups/'
/** Dateien, die weder Bühne noch App lesen. */
const OHNE_WIRKUNG = /^(docs\/|\.claude\/|daniel-zum-abarbeiten\/|data\/patchnotes\/)|\.md$/

/** Namen, die eine Mockup-Datei anmeldet (`mockup({ name: '…'` auf oberster Ebene, zwei Leerzeichen). */
export function angemeldeteNamen(text) {
  return [...text.matchAll(/^ {2}name: '([^']+)',?$/gm)].map((m) => m[1])
}

/** Dateien (Namen ohne Ordner) der Mockup-Dateien, die `datei` direkt importieren. */
function importeure(datei, texte) {
  const stamm = datei.replace(/\.(tsx?|css)$/, '')
  const muster = new RegExp(`['"]\\./(?:${esc(datei)}|${esc(stamm)})['"]`)
  return Object.keys(texte).filter((d) => d !== datei && muster.test(texte[d]))
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * @param {{status: string, pfad: string}[]} dateien Diff (`git diff --name-status --no-renames`)
 * @param {Record<string, string>} texte alle Dateien unter web/buehne/mockups/ (Name ohne Ordner → Text, Stand des Kopfs)
 * @returns {string[] | null} Mockup-Namen; null = alles messen
 */
export function mockupsDesDiffs(dateien, texte) {
  const namen = new Set()
  let beruehrt = false
  for (const { status, pfad } of dateien) {
    if (OHNE_WIRKUNG.test(pfad)) continue
    if (!pfad.startsWith(MOCKUPS) || pfad.slice(MOCKUPS.length).includes('/') || status === 'D') return null
    const datei = pfad.slice(MOCKUPS.length)
    beruehrt = true
    const gesehen = new Set()
    const stapel = [datei]
    let gefunden = false
    while (stapel.length) {
      const d = stapel.pop()
      if (gesehen.has(d)) continue
      gesehen.add(d)
      const eigene = angemeldeteNamen(texte[d] ?? '')
      for (const n of eigene) namen.add(n)
      if (eigene.length) gefunden = true
      stapel.push(...importeure(d, texte)) // auch ein anmeldendes Mockup kann von einem anderen eingebunden sein
    }
    if (!gefunden) return null
  }
  return beruehrt ? [...namen] : null
}

/** `--mockup`-Wert: kommagetrennte Namensteile; leer = alle. */
export const mockupGewaehlt = (name, filter) => !filter || filter.split(',').some((f) => f && name.includes(f))

/** „2/4“ → { k: 1, n: 4 } (nullbasiert); leer oder ungültig → null (keine Scheibe). */
export function leseScheibe(text) {
  const m = /^(\d+)\/(\d+)$/.exec(text ?? '')
  if (!m) return null
  const [k, n] = [Number(m[1]), Number(m[2])]
  return k >= 1 && k <= n ? { k: k - 1, n } : null
}

/** Vorgaben des Workflows für `buehne-messen`: `BUEHNE_MOCKUPS` (Filter) und `BUEHNE_SCHEIBE` („k/n“). */
export const umgebungsOptionen = (env) => ({ filter: env.BUEHNE_MOCKUPS ?? '', scheibe: leseScheibe(env.BUEHNE_SCHEIBE) })

export const inScheibe = (index, scheibe) => !scheibe || index % scheibe.n === scheibe.k

function main(a, b) {
  const r = spawnSync('git', ['diff', '--name-status', '--no-renames', a, b], { encoding: 'utf8', maxBuffer: 1 << 26, windowsHide: true })
  let namen = null
  if (r.status === 0) {
    const dateien = r.stdout.split('\n').filter(Boolean).map((z) => ({ status: z[0], pfad: z.slice(z.indexOf('\t') + 1) }))
    const ordner = path.resolve(import.meta.dirname, '..', MOCKUPS)
    const texte = Object.fromEntries(readdirSync(ordner, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => [e.name, readFileSync(path.join(ordner, e.name), 'utf8')]))
    namen = mockupsDesDiffs(dateien, texte)
  } else console.error(`buehne-umfang: git diff fehlgeschlagen (${r.stderr}), alles messen`)
  console.log(`mockups=${(namen ?? []).join(',')}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 4) {
    console.error('Aufruf: node tools/buehne-umfang.mjs <ref-a> <ref-b>')
    process.exit(2)
  }
  main(process.argv[2], process.argv[3])
}
