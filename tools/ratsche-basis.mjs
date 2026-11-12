/**
 * Basis der Ratsche tools/mutationen-ohne-tests-bekannt.json: der Stand auf origin/main, nicht die Datei des PR
 * (ein PR hob sonst zehn Listen selbst an, 3140). Die Kette checkt flach aus (nur der Merge-Commit), deshalb holt `basisImOrdner`
 * main bei Bedarf einmal nach; gelingt das nicht, bleibt die Basis null und es gilt der Vergleich mit der eigenen Datei.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { ohneTestsEintrag, ratscheLuecken } from './mutationsanker.mjs'
import { ladeBasis } from './pr-basis.mjs'

export const BEKANNT_PFAD = 'tools/mutationen-ohne-tests-bekannt.json'
const FRIST_MS = 60000

export const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', timeout: FRIST_MS, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] })

/** Die Datei auf main als Objekt; null, wenn sie dort fehlt oder kein JSON-Objekt ist. */
export function leseVonMain(zeigen) {
  try {
    const stand = JSON.parse(zeigen())
    return stand && typeof stand === 'object' && !Array.isArray(stand) ? stand : null
  } catch {
    return null
  }
}

/** Erst lesen, sonst main holen und noch einmal lesen; jeder Fehler beim Holen endet in null. */
export function basisBekannt(lesen, holen) {
  const direkt = lesen()
  if (direkt) return direkt
  try {
    holen()
  } catch {
    return null
  }
  return lesen()
}

/** Basis im PR-Ereignis: die Datei im ersten Elternteil des Merge-Commits (nie das heutige origin/main); null, wenn er nicht lesbar ist. */
function basisImMergeCommit(cwd) {
  const g = (...args) => git(args, cwd)
  try {
    const sha = ladeBasis(g)
    return leseVonMain(() => git(['show', `${sha}:${BEKANNT_PFAD}`], cwd))
  } catch {
    return null
  }
}

/**
 * Basis im Git-Ordner `cwd`: im PR-Ereignis der erste Elternteil des Merge-Commits (läuft die Kette, während main weiterzieht,
 * stammen Grenze und Baum sonst aus zwei Ständen), sonst origin/main, bei flachem Checkout flach nachgeholt.
 */
export const basisImOrdner = (cwd, env = process.env) =>
  env.GITHUB_EVENT_NAME === 'pull_request'
    ? basisImMergeCommit(cwd)
    : basisBekannt(
        () => leseVonMain(() => git(['show', `origin/main:${BEKANNT_PFAD}`], cwd)),
        () => git(['fetch', '--no-tags', '--depth=1', 'origin', 'main:refs/remotes/origin/main'], cwd),
      )

/** Listen, deren Wert in der eigenen Datei über dem Stand von main liegt (Anheben); neue Listen zählen ab 0. */
export const angehobeneListen = (eigen, basis) =>
  Object.entries(eigen).filter(([liste, n]) => n > (basis[liste] ?? 0)).map(([liste, n]) => `${liste}: Datei hebt auf ${n}, main erlaubt ${basis[liste] ?? 0}`)

/** Rote Zeilen der Ratsche: mit Basis gegen main (Ist und Datei dürfen nicht darüber), ohne Basis gegen die eigene Datei. */
export const ratscheRot = (ist, eigen, basis) => (basis ? [...ratscheLuecken(ist, basis), ...angehobeneListen(eigen, basis)] : ratscheLuecken(ist, eigen))

/** Logzeile zur Basis; der Rückfall auf die eigene Datei ist eine Warnung, damit ein gescheitertes Nachholen von main sichtbar bleibt. */
export const basisZeile = (basis) =>
  basis ? 'Ratsche-Basis: main (erster Elternteil des Merge-Commits bzw. origin/main)' : '⚠ WARNUNG Ratsche-Basis: eigene Datei (Basis nicht erreichbar, die Datei im PR gilt als Erlaubnis)'

/** Bestand eines Repo-Ordners: Ist je Liste, eigene Datei, Basis und die roten Zeilen. */
export function bestandPruefen(wurzel, env = process.env) {
  const eigen = JSON.parse(readFileSync(join(wurzel, BEKANNT_PFAD), 'utf8'))
  const ordner = join(wurzel, 'tools', 'mutationen')
  const ist = Object.fromEntries(readdirSync(ordner).filter((n) => n.endsWith('.json')).map((n) => [n, ohneTestsEintrag(readFileSync(join(ordner, n), 'utf8')).length]))
  const basis = basisImOrdner(wurzel, env)
  return { eigen, ist, basis, rot: ratscheRot(ist, eigen, basis) }
}
