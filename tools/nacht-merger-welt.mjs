/**
 * Echte Seiteneffekte des Nacht-Mergers (`gh`, `pr-stufe`, `pr-nachrechnen`); die Regeln stehen in `nacht-merger-wahl.mjs`, der Ablauf in
 * `nacht-merger.mjs`. Nur Node-Bordmittel und Werkzeuge aus tools/: der Workflow läuft ohne `npm ci`.
 */
import { appendFileSync } from 'node:fs'
import { bestandRotAlarm } from './bestand-rot-alarm.mjs'
import { LIMIT_STAPEL_MS, mitLimit } from './kind-mit-limit.mjs'
import { main as nachrechnenMain, schlafe } from './pr-nachrechnen.mjs'

const BAU = 'bestand-bauen.yml'
/** Frist für `pr-stufe` (lädt den Diff über gh): Messung steht beim Eintrag in der PR-Beschreibung. */
const STUFE_LIMIT_MS = 60_000
const zeilen = (text) => text.split(/\r?\n/).filter((z) => z.trim() !== '')

/** Pause vor der einen Wiederholung nach einem GitHub-5xx (z. B. HTTP 504, Lauf vom 13.11.2026 23:55 UTC rot). */
export const GH_5XX_PAUSE_MS = 5000

/** `gh` einmal wiederholen, wenn die Antwort ein GitHub-5xx war; der zweite Fehler (und jeder andere) wird unverändert weitergereicht. */
export function ghMitWiederholung(gh, schlafen = schlafe) {
  const mitWiederholung = (args) => {
    try {
      return gh(args)
    } catch (e) {
      // merge/close/reopen nie wiederholen: nach einem 504 kann die Änderung schon durch sein (sonst falsches „already merged/closed“); `merge` prüft den Zustand selbst
      if (args[0] === 'pr' && ['merge', 'close', 'reopen'].includes(args[1])) throw e
      if (!/HTTP 5\d\d/.test(`${e.message}\n${e.stderr ?? ''}`)) throw e
      schlafen(GH_5XX_PAUSE_MS)
      return gh(args)
    }
  }
  mitWiederholung.wiederholt5xx = true
  return mitWiederholung
}

/** Squash-Merge; bei GitHub-5xx entscheidet der Zustand des PR (`MERGED` = durch, sonst Fehler weiterreichen). */
export function mergeMit5xxPruefung(gh, pr) {
  try {
    return gh(['pr', 'merge', String(pr.nummer), '--squash', '--subject', `${pr.titel} (#${pr.nummer})`, '--match-head-commit', pr.kopf])
  } catch (e) {
    if (!/HTTP 5\d\d/.test(`${e.message}\n${e.stderr ?? ''}`)) throw e
    if (gh(['pr', 'view', String(pr.nummer), '--json', 'state', '--jq', '.state']).trim() === 'MERGED') return ''
    throw e
  }
}

export const ghEcht = ghMitWiederholung((args) => mitLimit('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }, { limitMs: LIMIT_STAPEL_MS }))

/** Läuft der Bestandsbau gerade im Schritt „Änderungen committen“? (`jobs`: Antwort von `gh run view --json jobs`.) Ein Merge dann erzwingt einen zweiten Bau. */
export const bauCommittetGerade = (jobs) => jobs.some((j) => (j.steps ?? []).some((s) => s.status === 'in_progress' && s.name.includes('Änderungen committen')))

/** Ist der Bestandsbau seit dem letzten grünen Lauf rot? Dann kommt ein PR mit der Zeile „Behebt roten Bestandsbau“ zuerst. */
export const bestandIstRot = (laeufe, jetztMs) => bestandRotAlarm(laeufe, jetztMs, 0).alarm

/** Stufe aus der JSON-Ausgabe von `pr-stufe`; alles Unlesbare gilt als 2 (nur von Hand). */
export function stufeVon(nummer, ausfuehren) {
  try {
    const s = JSON.parse(ausfuehren([process.execPath, 'tools/pr-stufe.mjs', String(nummer)])).stufe
    return Number.isInteger(s) ? s : 2
  } catch {
    return 2
  }
}

export function echteWelt({ gh = ghEcht, stufeAus, repo = process.env.GITHUB_REPOSITORY, zeileAus = (t) => console.log(t) } = {}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo ?? '')) throw new Error('GITHUB_REPOSITORY fehlt oder ist ungültig')
  const stufeSkript = stufeAus ?? ((args) => mitLimit(args[0], args.slice(1), { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }, { limitMs: STUFE_LIMIT_MS }))
  const zusammenfassung = process.env.GITHUB_STEP_SUMMARY
  return {
    zeile: (t) => {
      zeileAus(t)
      if (zusammenfassung) appendFileSync(zusammenfassung, `${t}\n`)
    },
    offene: () =>
      JSON.parse(gh(['pr', 'list', '--state', 'open', '--limit', '100', '--json', 'number,title,body,headRefOid,headRefName,isDraft,createdAt,reviewDecision,mergeStateStatus,changedFiles'])).map((p) => ({
        nummer: p.number,
        titel: p.title,
        beschreibung: p.body ?? '',
        kopf: p.headRefOid,
        zweig: p.headRefName,
        entwurf: p.isDraft,
        offen: true,
        erstellt: p.createdAt,
        reviewDecision: p.reviewDecision,
        mergeStateStatus: p.mergeStateStatus,
        geaenderteDateien: p.changedFiles,
      })),
    details: (pr) => ({
      ...pr,
      stufe: stufeVon(pr.nummer, stufeSkript),
      pfade: zeilen(gh(['api', `repos/${repo}/pulls/${pr.nummer}/files`, '--paginate', '--jq', '.[] | .filename, (.previous_filename // empty)'])),
      checks: JSON.parse(gh(['pr', 'view', String(pr.nummer), '--json', 'statusCheckRollup', '--jq', '.statusCheckRollup'])),
      kommentare: zeilen(gh(['api', `repos/${repo}/issues/${pr.nummer}/comments`, '--paginate', '--jq', '.[] | {login: .user.login, assoc: .author_association, at: .created_at, body: .body}'])).map((z) => JSON.parse(z)),
    }),
    warte: schlafe,
    kopfVon: (n) => gh(['pr', 'view', String(n), '--json', 'headRefOid', '--jq', '.headRefOid']).trim(),
    mergeStatus: (n) => gh(['pr', 'view', String(n), '--json', 'mergeStateStatus', '--jq', '.mergeStateStatus']).trim(),
    // nachrechnen liest nur (seit 21.11.2026 kein Nachzug bei bewegtem main), darum auch im Trockenlauf ohne Riegel
    nachrechnen: (n) => {
      const meldungen = []
      const exit = nachrechnenMain([String(n)], gh, (t) => meldungen.push(t))
      return { exit, text: meldungen.join(' | ') }
    },
    bauCommittet: () => {
      const id = gh(['run', 'list', '--workflow', BAU, '--status', 'in_progress', '--limit', '1', '--json', 'databaseId', '--jq', '.[0].databaseId']).trim()
      return id !== '' && id !== 'null' && bauCommittetGerade(JSON.parse(gh(['run', 'view', id, '--json', 'jobs'])).jobs)
    },
    bestandRot: () => bestandIstRot(JSON.parse(gh(['run', 'list', '--workflow', BAU, '--limit', '30', '--json', 'status,conclusion,createdAt'])), Date.now()),
    jetzt: () => Date.now(),
    merge: (pr) => mergeMit5xxPruefung(gh, pr),
  }
}
