/**
 * PR-Prüfung: Beleg-Adressen, die der PR neu in `data/curated/*.yaml` oder `data/dub-confirmed.yaml` einträgt, werden je einmal abgerufen.
 * 404/410 ist rot; 403, 429, 5xx, Zeitüberschreitung und Netzfehler sind Nichtauskunft (nur Logzeile). Crunchyroll, ADN und aniSearch
 * werden nie abgerufen. Höchstens 20 Abrufe je Lauf. Basis ist der erste Elternteil des Merge-Commits (`HEAD^1`).
 *
 * Aufruf: npx tsx pipeline/neue-quellen-pruefen.ts [--basis HEAD^1]
 */
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { pruefeQuellen, neueQuellen, type Befund, type NeueQuelle } from './lib/neue-quellen.ts'
import { UA } from './lib/offiziell-abruf.ts'

const MAX_ABRUFE = 20
const ABRUF_FRIST_MS = 15_000
const ORDNER = ['data/curated', 'data/dub-confirmed.yaml']

function git(wurzel: string, args: string[]): string {
  return execFileSync('git', args, { cwd: wurzel, encoding: 'utf8', windowsHide: true, timeout: 60_000, maxBuffer: 1 << 28 })
}

/** Text einer Datei im Stand `ref`; `null`, wenn sie dort nicht existiert. */
function textAm(wurzel: string, ref: string, datei: string): string | null {
  try {
    return git(wurzel, ['show', `${ref}:${datei}`])
  } catch {
    return null
  }
}

/** Neue Beleg-Adressen aller geänderten oder neuen YAML-Dateien gegenüber `basis`. */
export function sammleNeue(wurzel: string, basis: string): NeueQuelle[] {
  const dateien = git(wurzel, ['diff', '--name-only', '--no-renames', '--diff-filter=AM', basis, 'HEAD', '--', ...ORDNER])
    .split('\n')
    .filter((d) => d.endsWith('.yaml'))
  return dateien.flatMap((d) => neueQuellen(d, textAm(wurzel, basis, d), textAm(wurzel, 'HEAD', d) ?? ''))
}

/** Statuscode der Adresse (eine GET-Anfrage, Weiterleitungen gefolgt); `null` bei Zeitüberschreitung oder Netzfehler. */
export async function statusVon(adresse: string): Promise<number | null> {
  try {
    const res = await fetch(adresse, { headers: { 'User-Agent': UA, Accept: '*/*' }, signal: AbortSignal.timeout(ABRUF_FRIST_MS) })
    await res.body?.cancel()
    return res.status
  } catch {
    return null
  }
}

function zeile(b: Befund): string {
  const ort = `${b.datei} ${b.schluessel}: ${b.adresse}`
  if (b.urteil === 'tot') return `✖ TOT (${b.status}) ${ort}`
  if (b.urteil === 'nichtauskunft') return `Nichtauskunft (${b.status ?? 'kein Status'}), nicht rot: ${ort}`
  if (b.urteil === 'ausgelassen') return `ausgelassen (Crunchyroll, ADN, aniSearch oder keine http-Adresse): ${ort}`
  if (b.urteil === 'ungeprueft') return `ungeprüft (mehr als ${MAX_ABRUFE} Abrufe): ${ort}`
  return `ok (${b.status}): ${ort}`
}

/** Fährt die Prüfung; Rückgabe 1 bei mindestens einer toten Adresse. */
export async function main(wurzel: string, basis: string, abruf = statusVon): Promise<number> {
  const befunde = await pruefeQuellen(sammleNeue(wurzel, basis), abruf, MAX_ABRUFE)
  for (const b of befunde) console.log(zeile(b))
  const zaehle = (u: Befund['urteil']) => befunde.filter((b) => b.urteil === u).length
  console.log(
    `check-neue-quellen: ${befunde.length} neue Adressen, ok ${zaehle('ok')}, tot ${zaehle('tot')}, Nichtauskunft ${zaehle('nichtauskunft')}, ausgelassen ${zaehle('ausgelassen')}, ungeprüft ${zaehle('ungeprueft')}`,
  )
  return zaehle('tot') > 0 ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf('--basis')
  process.exit(await main(process.env.AK_ROOT ?? resolve(import.meta.dirname, '..'), i >= 0 ? process.argv[i + 1] : 'HEAD^1'))
}
