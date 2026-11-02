/**
 * Beleg „check:workflows war für genau diesen Inhalt grün“ (02.11.2026): Ein Datenfix-Deploy (workflow_run nach dem Bestandsbau) fuhr
 * `npm run check:workflows` (6–7 min, `tests-alle`) jedes Mal neu, obwohl der Quelltext seit dem letzten Deploy derselbe war.
 * Der Beleg ist ein früherer Deploy-Lauf auf main, dessen Job `pruefen` grün war und dessen Abdruck gleich dem des jetzigen Stands ist.
 * Abdruck = Pfad und Blob-Hash jeder Datei im Git-Baum außer den Datenpfaden (`istDatenpfad`); Bäume ohne Blobs reichen (Checkout mit
 * `filter: blob:none`, `git ls-tree`). Bewegt sich irgendetwas außerhalb der Datenpfade (Code, Workflows, `extension/`, `public/og/`),
 * ist der Abdruck ein anderer und die Prüfung läuft wie bisher. Jeder Fehler (gh, Git, Frist) heißt „kein Beleg“, nie „grün“.
 * Voraussetzung ist, dass `head_sha` eines Laufs der ausgecheckte Stand ist (gemessen 02.11.2026 an 10 Läufen, 7 davon `workflow_run`: gleich);
 * der Aufruf prüft sie am eigenen Lauf (API-`head_sha` gegen `git rev-parse HEAD`) und prüft sonst voll.
 * Ein Lauf, der selbst per Beleg übersprang, belegt weiter (gleicher Abdruck, transitiv); ein übersprungener Job `pruefen` zählt nicht.
 *
 * Aufruf im Workflow `deploy.yml` (Job `pruefen`): `node tools/workflows-beleg.mjs gueltig` schreibt bei Beleg `gueltig=1` nach $GITHUB_OUTPUT.
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { abdruckVon } from './logik-beleg.mjs'
import { istDatenpfad } from './pr-nachrechnen.mjs'

const D = 'data'
/**
 * Bot-Dateien, die die Kette sonst liest (Bau, Validierung), `check:workflows` aber nicht: kein Skript davon und kein `tools/*.test.mjs` nennt sie
 * außerhalb einer Wegwerf-Kulisse (Wächter im Test, 02.11.2026). Ordner ohne Endstrich. Zusammen etwa zwei Drittel der Bot-Commits auf main.
 */
export const OHNE_LESER_WORKFLOWS = ['anisearch-raw', 'crunchyroll-raw', 'crunchyroll-neu.json', 'crunchyroll-woche.json', 'tv-programm.json'].map((n) => `${D}/${n}`)
/**
 * Pfade, deren Bewegung den Beleg nicht entwertet: `istDatenpfad` (public/data, Cache, Bot-Dateien ohne Leser in der Kette) und
 * `OHNE_LESER_WORKFLOWS`. Alles andere zählt, auch Handdaten und Register: `check:workflows` liest sie (Prüfer 2687 A1).
 */
export const ZAEHLT = (pfad) => !istDatenpfad(pfad) && !OHNE_LESER_WORKFLOWS.some((p) => pfad === p || pfad.startsWith(`${p}/`))
export const WORKFLOW = 'deploy.yml'
export const JOB = 'pruefen'
/** Läufe, die der Abruf der Deploy-Historie höchstens liest (neueste zuerst); die Checkout-Tiefe (30 Commits) begrenzt ohnehin, was lokal lesbar ist. */
export const LAEUFE_HOECHSTENS = 50
/** Gleicher Abdruck, aber Job nicht grün: so viele solcher Läufe werden höchstens nach ihren Jobs gefragt. */
export const JOBS_HOECHSTENS = 6
const FRIST_MS = 60_000

/** Abdruck aus der Ausgabe von `git ls-tree -r -z <sha>`; wirft bei Zeilen, die nicht zum Format passen oder bei leerem Baum. */
export function abdruckAusBaum(roh) {
  const eintraege = roh.split('\0').filter(Boolean).map((zeile) => {
    const m = /^\d+ \w+ ([0-9a-f]{40,64})\t([^]+)$/.exec(zeile)
    if (!m) throw new Error('ls-tree: unbekanntes Zeilenformat')
    return [m[2], m[1]]
  })
  if (!eintraege.length) throw new Error('ls-tree: leerer Baum')
  const gezaehlt = eintraege.filter(([pfad]) => ZAEHLT(pfad))
  if (gezaehlt.some(([pfad]) => pfad.includes('\n'))) throw new Error('Pfad mit Zeilenumbruch')
  return abdruckVon(gezaehlt)
}

/** Ist der Job `pruefen` unter diesen Jobs erfolgreich (nicht übersprungen, nicht abgebrochen)? */
export const pruefenGruen = (jobs) => jobs.some((j) => j.name === JOB && j.conclusion === 'success')

/**
 * Neuester Lauf (ohne den eigenen), dessen Stand denselben Abdruck hat und dessen Job `pruefen` grün war, sonst null.
 * `abdruckVon(sha)` wirft bei unlesbarem Stand (außerhalb der Checkout-Tiefe): der Lauf zählt dann nicht.
 */
export function sucheBeleg({ laeufe, eigeneId, abdruck, abdruckVonSha, jobsVon }) {
  const kandidaten = (laeufe ?? []).filter((l) => String(l.id) !== String(eigeneId)).sort((a, b) => b.id - a.id)
  const stand = new Map()
  let gefragt = 0
  for (const lauf of kandidaten) {
    if (!stand.has(lauf.head_sha)) {
      try {
        stand.set(lauf.head_sha, abdruckVonSha(lauf.head_sha))
      } catch {
        stand.set(lauf.head_sha, null)
      }
    }
    if (stand.get(lauf.head_sha) !== abdruck) continue
    if (gefragt >= JOBS_HOECHSTENS) break
    gefragt += 1
    if (pruefenGruen(jobsVon(lauf.id))) return lauf
  }
  return null
}

const ausfuehren = (befehl, args) => execFileSync(befehl, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout: FRIST_MS })

/** Die echten Aufrufe; `laufe` bekommt im Test dieselben drei Funktionen als Kulisse. */
export const ECHT = {
  baum: (sha) => ausfuehren('git', ['ls-tree', '-r', '-z', sha]),
  kopf: () => ausfuehren('git', ['rev-parse', 'HEAD']).trim(),
  api: (pfad) => JSON.parse(ausfuehren('gh', ['api', pfad])),
}

/** Stempel des Aufrufs: `{ gueltig, grund }`. Jeder Fehler heißt „nicht gültig“, mit der ersten Fehlerzeile im Wortlaut. */
export function gueltigkeit(env, w = ECHT) {
  try {
    const repo = env.GITHUB_REPOSITORY
    if (!repo) return { gueltig: false, grund: 'GITHUB_REPOSITORY fehlt' }
    const kopf = w.kopf()
    const eigenerStand = w.api(`repos/${repo}/actions/runs/${env.GITHUB_RUN_ID}`).head_sha
    if (eigenerStand !== kopf) return { gueltig: false, grund: `head_sha dieses Laufs (${eigenerStand}) ist nicht der Checkout (${kopf}): head_sha belegt den geprüften Stand nicht` }
    const abdruck = abdruckAusBaum(w.baum('HEAD'))
    const laeufe = w.api(`repos/${repo}/actions/workflows/${WORKFLOW}/runs?branch=main&per_page=${LAEUFE_HOECHSTENS}`).workflow_runs
    const lauf = sucheBeleg({
      laeufe,
      eigeneId: env.GITHUB_RUN_ID,
      abdruck,
      abdruckVonSha: (sha) => abdruckAusBaum(w.baum(sha)),
      jobsVon: (id) => w.api(`repos/${repo}/actions/runs/${id}/jobs?per_page=100`).jobs,
    })
    if (!lauf) return { gueltig: false, grund: `kein früherer Deploy-Lauf mit Abdruck ${abdruck.slice(0, 12)} und grünem Job ${JOB}` }
    return { gueltig: true, grund: `Beleg: Lauf ${lauf.id} (Abdruck ${abdruck.slice(0, 12)}, Job ${JOB} grün)` }
  } catch (fehler) {
    return { gueltig: false, grund: `kein Beleg lesbar (${String(fehler.message).split('\n')[0]})` }
  }
}

/** Aufruf der Kommandozeile; Rückgabe ist der Exit-Code (immer 0 bei `gueltig`: ein Fehler heißt nur „voll prüfen“). */
export function main([befehl], env = process.env, ausgabe = console.log, w = ECHT, schreibe = appendFileSync) {
  if (befehl !== 'gueltig') {
    ausgabe('Aufruf: node tools/workflows-beleg.mjs gueltig')
    return 2
  }
  const { gueltig, grund } = gueltigkeit(env, w)
  ausgabe(gueltig ? `check:workflows entfällt. ${grund}` : `check:workflows läuft: ${grund}`)
  if (gueltig && env.GITHUB_OUTPUT) schreibe(env.GITHUB_OUTPUT, 'gueltig=1\n')
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)))
}
