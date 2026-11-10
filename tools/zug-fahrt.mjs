/**
 * Fahrt des Sammelzugs (P2b): Ablauf für .github/workflows/zug-fahrt.yml. Entscheidungen stehen als reine Funktionen in tools/zug.mjs, hier nur git und gh.
 *   start     Zug plus main als Schnappschuss `zug-fahrt` bauen, pushen, PR zug-fahrt → main öffnen (die Kette läuft auf dem PR-Kopf)
 *   urteil    Kette auf `zug-fahrt` fertig: grün → Fast-Forward nur `--dry-run`, mit `--schieben` echt (ohne --force, dann bau-deploy); rot → Probe „main allein“ (`zug-probe`) starten.
 *             Kette auf `zug-probe` fertig: Schuldsuche mit Ratschen gegen die Basisgrenzen; Ergebnis steht im Fahrt-Log, zurückgenommen wird nichts.
 *   bau-deploy  Bau und Deploy per workflow_dispatch (für P2c, nach dem echten Schieben; hier nicht verdrahtet)
 * Aufruf: node tools/zug-fahrt.mjs start|urteil|bau-deploy [--trocken] [--zweig zug-fahrt|zug-probe --lauf <Nr>]
 * `--trocken` schreibt nichts (kein Push, kein PR, kein Kommentar, kein Dispatch). main wird nur mit `--schieben` bewegt; zug-fahrt.yml übergibt es noch nicht.
 * Die App (GH_TOKEN) pusht, damit die Kette auf dem Zweig anläuft; Pushes mit dem Workflow-Token lösen keine Läufe aus.
 */
import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { mitLimit } from './kind-mit-limit.mjs'
import { logJobs } from './zug-trocken.mjs'
import { FAHRT_ZWEIG, PROBE_ZWEIG, basisGrenzen, basisRef, bauUndDeployBefehle, fahrtLog, fahrtSchritt, ffEntscheidung, ketteArt, ratschenZustand, revertPlan, schuldsuche, zugEintraege } from './zug.mjs'

const KETTE = 'pr-pruefung.yml'
const KETTE_NAME = 'PR-Prüfkette'
const GIT_LIMIT_MS = 120_000
const PR_TEXT = 'Sammelfahrt des Zugs, wird von zug-fahrt.yml verwaltet, nicht von Hand mergen.\n\nPatch Notes: keine – CI: Fahrt-PR, die Unter-PRs tragen ihre eigenen Patch Notes, 0 Titel/Termine/Meldungen/Wege/Zeilen.'

export const gitIn = (cwd) => (args) => mitLimit('git', args, { encoding: 'utf8', cwd, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }, { limitMs: GIT_LIMIT_MS })
export const ghIn = (cwd) => (args) => mitLimit('gh', args, { encoding: 'utf8', cwd, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }, { limitMs: GIT_LIMIT_MS })

/** Meldung und Exit-Code in einem (`melde` darf etwas zurückgeben, z. B. Array.push). */
const ende = (melde, text, code = 0) => {
  melde(text)
  return code
}

const versuche = (fn) => {
  try {
    return fn()
  } catch {
    return null
  }
}

/** Gibt es den Zweig auf origin? (`ls-remote` liefert bei fehlendem Zweig nichts, aber Exit 0.) */
export const remoteHat = (git, zweig) => git(['ls-remote', '--heads', 'origin', zweig]).trim() !== ''

/** Kopf eines Zweigs auf origin oder null. */
const remoteKopf = (git, zweig) => git(['ls-remote', '--heads', 'origin', zweig]).split('\t')[0].trim() || null

/**
 * Liegt dieser Stand (gleicher Zug-Kopf und gleiches main) schon auf zug-fahrt? Der Merge-Commit trägt die Uhrzeit und ist nie gleich,
 * darum zählen die Eltern; ein erneuter Push desselben Stands löste ohnehin keine Kette aus.
 */
function schonGefahren(git, kopf) {
  const fern = remoteKopf(git, FAHRT_ZWEIG)
  if (fern === null) return false
  if (fern === kopf) return true
  git(['fetch', '--quiet', 'origin', FAHRT_ZWEIG])
  const eltern = (sha) => git(['rev-list', '--parents', '-n', '1', sha]).trim().split(' ').slice(1)
  const [a, b] = [eltern(fern), eltern(kopf)]
  return b.length > 1 && a.length === b.length && a.every((e, i) => e === b[i])
}

const istVorfahr = (git, a, b) => versuche(() => git(['merge-base', '--is-ancestor', a, b]) ?? '') !== null

/**
 * Zug-Zweig lokal als `zug-fahrt` anlegen und main hereinholen. Rückgabe { art, ... }:
 *   kein-zug (origin/zug fehlt), leer (Zug hat nichts, was main nicht hat), konflikt { dateien }, bereit { kopf, zugVorher }.
 * Bei einem Konflikt wird der Merge abgebrochen, nichts bleibt halb stehen.
 */
export function bereiteFahrt(git) {
  git(['fetch', '--quiet', 'origin', 'main'])
  if (!remoteHat(git, 'zug')) return { art: 'kein-zug' }
  git(['fetch', '--quiet', 'origin', 'zug'])
  if (git(['rev-list', '--count', 'origin/main..origin/zug']).trim() === '0') return { art: 'leer' }
  const zugVorher = git(['rev-parse', 'origin/zug']).trim()
  git(['checkout', '-q', '-B', FAHRT_ZWEIG, 'origin/zug'])
  // Steckt main schon im Zug, ist der Merge ein Nichts (kein neuer Commit).
  if (versuche(() => git(['merge', '--no-edit', '-m', "Merge branch 'main' into zug", 'origin/main']) ?? '') === null) {
    const dateien = git(['diff', '--name-only', '--diff-filter=U']).split('\n').filter(Boolean)
    git(['merge', '--abort'])
    return { art: 'konflikt', dateien }
  }
  return { art: 'bereit', kopf: git(['rev-parse', 'HEAD']).trim(), zugVorher }
}

/** Offener PR mit diesem Kopfzweig gegen main (Nummer) oder null. */
export const offenerPr = (gh, zweig) => JSON.parse(gh(['pr', 'list', '--head', zweig, '--base', 'main', '--state', 'open', '--json', 'number'])).at(0)?.number ?? null

/** Kettenläufe (pull_request) auf einem Zweig, neueste zuerst: [{ databaseId, headSha, status, conclusion }]. */
export const ketteLaeufe = (gh, zweig) =>
  JSON.parse(gh(['run', 'list', '--workflow', KETTE, '--branch', zweig, '--event', 'pull_request', '--limit', '10', '--json', 'databaseId,headSha,status,conclusion']))

/** Schreibt Zeilen ins Schrittprotokoll (wenn vorhanden) und als Kommentar an den PR (außer trocken). */
export function schreibeLog(zeilen, { gh, pr, trocken, melde, zusammenfassung = process.env.GITHUB_STEP_SUMMARY }) {
  for (const z of zeilen) melde(z)
  if (zusammenfassung) appendFileSync(zusammenfassung, `${zeilen.join('\n')}\n`)
  if (!trocken && pr) gh(['pr', 'comment', String(pr), '--body', zeilen.join('\n')])
}

/** Fahrt starten: Schnappschuss bauen und PR öffnen. Eine laufende Fahrt wird nicht gestört. */
export function start({ gh, git, melde, trocken }) {
  const pr = offenerPr(gh, FAHRT_ZWEIG)
  if (pr !== null && ketteLaeufe(gh, FAHRT_ZWEIG).some((l) => l.status !== 'completed')) {
    melde(`Fahrt läuft (PR #${pr}), keine neue`)
    return 0
  }
  const fahrt = bereiteFahrt(git)
  if (fahrt.art === 'kein-zug') return ende(melde, 'Zweig zug fehlt auf origin: keine Fahrt (P2a legt ihn an)')
  if (fahrt.art === 'leer') return ende(melde, 'Zug ist leer (nichts, was main nicht hat): keine Fahrt')
  if (fahrt.art === 'konflikt') {
    melde(`FEHLER main lässt sich nicht in den Zug holen, Konflikt in: ${fahrt.dateien.join(', ')}`)
    return 1
  }
  melde(`Fahrt ${fahrt.kopf.slice(0, 9)}: Zug ${fahrt.zugVorher.slice(0, 9)} plus main`)
  if (trocken) return ende(melde, 'trocken: kein Push, kein PR')
  if (schonGefahren(git, fahrt.kopf)) return ende(melde, 'Zug und main unverändert seit der letzten Fahrt: keine neue (ein Push desselben Kopfs löste keine Kette aus)')
  pushMitPr({ gh, git }, FAHRT_ZWEIG, fahrt.kopf, 'chore(zug): Fahrt', pr)
  return 0
}

/**
 * Kopf auf den Zweig pushen (der Push der App löst die Kette aus). Gibt es noch keinen PR, geht ein Platzhalter voraus: das Workflow-Token öffnet den PR,
 * aber ein PR, den es öffnet, startet keine Kette; erst der Push danach (synchronize) tut es. Den PR mit dem App-Token anzulegen sperrt app-token-sperre.
 */
export function pushMitPr({ gh, git }, zweig, kopf, titel, vorhandenerPr) {
  const push = (sha) => git(['push', '--force', 'origin', `${sha}:refs/heads/${zweig}`])
  if (vorhandenerPr === null) {
    push(git(['commit-tree', 'origin/main^{tree}', '-p', 'origin/main', '-m', 'Platzhalter: die Kette startet mit dem nächsten Push']).trim())
    gh(['pr', 'create', '--base', 'main', '--head', zweig, '--title', titel, '--body', PR_TEXT])
  }
  push(kopf)
}

/** Datei am Basisstand lesen oder null (git show). */
const liesAm = (git, ref) => (datei) => versuche(() => git(['show', `${ref}:${datei}`]))

const zugPrsVon = (git) =>
  zugEintraege(git(['log', '-m', '--first-parent', '--name-only', '--format=%x01%H%x09%P%x09%s', `origin/main..origin/${FAHRT_ZWEIG}`])).filter((e) => e.nr !== null)

function grenzenDerFahrt(git) {
  const eltern = git(['rev-list', '--parents', '-n', '1', `origin/${FAHRT_ZWEIG}`]).trim().split(' ').length - 1
  return basisGrenzen(liesAm(git, basisRef(eltern)))
}

/**
 * Fast-Forward von main auf den Zug-Kopf. Ohne `schieben` (und mit `trocken`) nur als Dry-Run; mit `schieben` der echte Push ohne `--force`:
 * ist main nicht mehr Vorfahr, lehnt der Server ab und nichts bewegt sich ('main-holen'). Ändert `schritt` und gibt es zurück.
 */
function schiebeMain({ git, trocken, schieben }, zugKopf, schritt) {
  const echt = schieben === true && !trocken
  const ergebnis = versuche(() => git(['push', ...(echt ? [] : ['--dry-run']), 'origin', `${zugKopf}:refs/heads/main`]))
  if (ergebnis === null) return Object.assign(schritt, { art: 'main-holen', grund: `${echt ? 'Push' : 'Dry-Run'} abgelehnt: main ist weitergelaufen` })
  if (echt) return Object.assign(schritt, { art: 'geschoben', grund: 'main steht jetzt auf dem Zug-Kopf (Fast-Forward), Bau und Deploy werden gestartet' })
  return Object.assign(schritt, { grund: 'Dry-Run ok, geschoben wird nur mit --schieben (der Dry-Run prüft das Ruleset nicht)' })
}

/** Kette der Fahrt grün: Fast-Forward prüfen und, nur mit `--schieben`, main wirklich auf den Zug-Kopf setzen. */
function fahrtGruen(ctx, lauf) {
  const { git } = ctx
  git(['fetch', '--quiet', 'origin', 'main', FAHRT_ZWEIG])
  const zugKopf = git(['rev-parse', `origin/${FAHRT_ZWEIG}`]).trim()
  const ff = ffEntscheidung({ mainImZug: istVorfahr(git, 'origin/main', `origin/${FAHRT_ZWEIG}`), kettenKopf: lauf.headSha, zugKopf })
  const schritt = fahrtSchritt({ kette: 'gruen', ff })
  if (schritt.art === 'ff-pruefen') schiebeMain(ctx, zugKopf, schritt)
  const log = fahrtLog({ kopf: zugKopf, kette: 'grün', schritt, grenzeBasis: grenzenDerFahrt(git) })
  return { log, schritt }
}

/** Probe „main allein“: main-Kopf plus leerer Commit, PR gegen main; die Kette läuft darauf ohne Unter-PRs. */
export function starteProbe({ gh, git, melde, trocken }) {
  if (trocken) return ende(melde, 'trocken: Probe main allein würde starten')
  git(['fetch', '--quiet', 'origin', 'main'])
  const kopf = git(['commit-tree', 'origin/main^{tree}', '-p', 'origin/main', '-m', 'Probe: main allein (Sammelzug)']).trim()
  pushMitPr({ gh, git }, PROBE_ZWEIG, kopf, 'chore(zug): Probe main allein', offenerPr(gh, PROBE_ZWEIG))
  return 0
}

/** Probe fertig: Schuldsuche der roten Fahrt mit dem Urteil „main allein“; zurückgenommen wird nichts, der Revert-Plan steht im Log. */
function probeFertig({ gh, git }, probe) {
  const fahrtLauf = ketteLaeufe(gh, FAHRT_ZWEIG).find((l) => ketteArt(l) === 'rot')
  if (!fahrtLauf) return { log: ['Probe fertig, aber keine rote Fahrt gefunden: nichts zu tun'] }
  git(['fetch', '--quiet', 'origin', 'main', FAHRT_ZWEIG])
  const jobs = logJobs(gh(['run', 'view', String(fahrtLauf.databaseId), '--log-failed']))
  const grenzeBasis = grenzenDerFahrt(git)
  const zugPrs = zugPrsVon(git)
  const mainAllein = ketteArt(probe)
  const urteil = schuldsuche({ zugPrs, fehlschlag: { jobs }, mainAllein, grenzeBasis })
  const log = fahrtLog({ kopf: fahrtLauf.headSha, kette: 'rot', schritt: fahrtSchritt({ kette: 'rot', mainAllein }), ratschen: ratschenZustand(jobs, grenzeBasis), grenzeBasis, urteil })
  log.push(`Probe main allein: ${mainAllein}`)
  if (urteil.art === 'pr') for (const b of revertPlan(zugPrs, [urteil.nr]).befehle) log.push(`Revert-Plan (nicht ausgeführt): ${b.befehl}, spätere Eingriffe in dieselben Dateien: ${b.risiko.join(' ') || 'keine'}`)
  return { log }
}

/** Kette auf einem Fahrt- oder Probe-Zweig ist fertig. `lauf`: Nummer des Kettenlaufs (workflow_run.id). */
export function urteil(ctx, zweig, laufNr) {
  const { gh, melde, trocken } = ctx
  const lauf = JSON.parse(gh(['run', 'view', String(laufNr), '--json', 'databaseId,headSha,status,conclusion,workflowName,headBranch']))
  if (lauf.workflowName !== KETTE_NAME || lauf.headBranch !== zweig) return ende(melde, `Lauf ${laufNr} ist nicht die Kette auf ${zweig} (${lauf.workflowName}/${lauf.headBranch}): kein Urteil, nichts geschoben`, 2)
  const kette = ketteArt(lauf)
  if (kette === 'offen') return ende(melde, `Kette ${laufNr} auf ${zweig}: kein Urteil (${lauf.status}/${lauf.conclusion || '-'})`)
  const pr = offenerPr(gh, FAHRT_ZWEIG)
  if (zweig === PROBE_ZWEIG) {
    const { log } = probeFertig(ctx, lauf)
    schreibeLog(log, { ...ctx, pr })
    const probePr = offenerPr(gh, PROBE_ZWEIG)
    if (!trocken && probePr !== null) gh(['pr', 'close', String(probePr), '--delete-branch'])
    return 0
  }
  if (kette === 'gruen') {
    const { log, schritt } = fahrtGruen(ctx, lauf)
    let kommentarFehler = null
    try {
      schreibeLog(log, { ...ctx, pr })
    } catch (e) {
      kommentarFehler = e
    }
    // Nach dem echten Push startet Bau/Deploy auch, wenn der Kommentar scheitert.
    const exit = schritt.art === 'geschoben' ? bauDeploy(ctx) : 0
    if (kommentarFehler) throw kommentarFehler
    return exit
  }
  schreibeLog(fahrtLog({ kopf: lauf.headSha, kette: 'rot', schritt: fahrtSchritt({ kette: 'rot' }) }), { ...ctx, pr })
  return starteProbe(ctx)
}

/** Bau und Deploy starten (nach dem Schieben, P2c). */
export function bauDeploy({ gh, melde, trocken }) {
  for (const befehl of bauUndDeployBefehle()) {
    melde(`${trocken ? 'trocken: ' : ''}gh ${befehl.join(' ')}`)
    if (!trocken) gh(befehl)
  }
  return 0
}

const wert = (args, name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)

/** Einstieg; Rückgabe ist der Exit-Code (0 ok oder nichts zu tun, 1 Fahrt nicht möglich, 2 Aufruf oder Abruffehler). */
export function main(args, { gh = ghIn(process.cwd()), git = gitIn(process.cwd()), melde = (z) => console.log(z) } = {}) {
  const ctx = { gh, git, melde, trocken: args.includes('--trocken'), schieben: args.includes('--schieben') }
  try {
    if (args[0] === 'start') return start(ctx)
    if (args[0] === 'bau-deploy') return bauDeploy(ctx)
    if (args[0] === 'urteil' && [FAHRT_ZWEIG, PROBE_ZWEIG].includes(wert(args, '--zweig')) && /^\d+$/.test(wert(args, '--lauf') ?? '')) return urteil(ctx, wert(args, '--zweig'), wert(args, '--lauf'))
  } catch (e) {
    melde(`zug-fahrt: FEHLER ${e.message}`)
    return 2
  }
  melde('Aufruf: node tools/zug-fahrt.mjs start|bau-deploy|urteil --zweig zug-fahrt|zug-probe --lauf <Nr> [--trocken] [--schieben]')
  return 2
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(main(process.argv.slice(2)))
