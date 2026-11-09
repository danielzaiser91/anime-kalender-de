/**
 * Trockenlauf für tools/zug.mjs: liest gh und git, druckt Plan, Schuldsuche und Revert-Plan, schreibt nichts (kein push, kein revert, kein Kommentar).
 * Aufruf: node tools/zug-trocken.mjs trocken [--basis main|zug] [--max N]   (Exit 0 gelesen, 2 Abruffehler)
 * Gibt es `origin/zug` noch nicht (Stand 06.11.2026), übt der Lauf Schuldsuche und Revert an den letzten Commits von main und an einem echten roten Lauf.
 */
import { pathToFileURL } from 'node:url'
import { gh, git, kopfZeiten, kopfZeitVon, offenePrs } from './liegegut.mjs'
import { MAX_ZUG, ffEntscheidung, revertPlan, schuldsuche, zugEintraege, zugPlan } from './zug.mjs'

// Echter roter Lauf der Kette (Kopf b26fc544, fix/ci-flakes-wiederholung, 06.11.2026 07:00 UTC): Umfang-Ratsche, Grenze von main auf 8964 gesenkt.
export const BEISPIEL_LAUF = '42176593329'

/** `gh run view --log-failed` hat Zeilen `Job<TAB>Schritt<TAB>Zeit Text`; Rückgabe: [{ name, meldung }] je Job. */
export function logJobs(text) {
  const jobs = new Map()
  for (const zeile of text.split('\n')) {
    const teile = zeile.split('\t')
    if (teile.length < 3) continue
    jobs.set(teile[0], `${jobs.get(teile[0]) ?? ''}${teile.slice(2).join('\t')}\n`)
  }
  return [...jobs].map(([name, meldung]) => ({ name, meldung }))
}

function argWert(args, name, standard) {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : standard
}

/** Offene PRs der Basis mit Kopfzeit; `offenePrs` kennt die Basis nicht, darum zuerst die Nummern der Basis holen. */
export function kandidaten(ghFn, basis, hinweis) {
  const nummern = JSON.parse(ghFn(['pr', 'list', '--state', 'open', '--base', basis, '--limit', '100', '--json', 'number'])).map((p) => p.number)
  const karte = kopfZeiten(ghFn)
  return offenePrs(ghFn, hinweis)
    .filter((p) => nummern.includes(p.number))
    .map((p) => ({ ...p, kopfZeit: kopfZeitVon(ghFn, p, karte) }))
}

function planZeilen(plan, melde) {
  melde(`ZUG-PLAN: ${plan.aufnehmen.length} PRs aufnehmen, ${plan.zurueck.length} bleiben draußen`)
  for (const a of plan.aufnehmen) melde(`  + #${a.nr} ${a.titel}`)
  for (const z of plan.zurueck) melde(`  - #${z.nr} ${z.gruende.join(', ')}`)
}

const zugLog = (gitFn) => zugEintraege(gitFn(['log', '-m', '--first-parent', '--name-only', '--format=%x01%H%x09%P%x09%s', 'origin/main..origin/zug']))

function zugVorhanden(gitFn) {
  try {
    gitFn(['rev-parse', '--verify', '-q', 'origin/zug'])
    return true
  } catch {
    return false
  }
}

/** Übung ohne Zug: die letzten sechs Commits von main als Zug, der echte rote Lauf als Fehlschlag. */
function uebung(ghFn, gitFn, melde) {
  const log = gitFn(['log', '-m', '--first-parent', '--name-only', '-80', '--format=%x01%H%x09%P%x09%s', 'origin/main'])
  const eintraege = zugEintraege(log).filter((e) => e.nr !== null).slice(0, 6)
  melde(`UEBUNG: origin/zug fehlt; ${eintraege.length} PR-Commits von main als Zug: ${eintraege.map((e) => `#${e.nr}`).join(' ')}`)
  const zugPrs = eintraege.map((e) => ({ nr: e.nr, dateien: e.dateien }))
  const jobs = logJobs(ghFn(['run', 'view', BEISPIEL_LAUF, '--log-failed']))
  const urteil = schuldsuche({ zugPrs, fehlschlag: { jobs }, mainAllein: 'gruen', grenzeBasis: { umfang: 8986 } })
  melde(`SCHULDSUCHE (Lauf ${BEISPIEL_LAUF}, Basisgrenze 8986): ${JSON.stringify(urteil)}`)
  const rot = schuldsuche({ zugPrs, fehlschlag: { jobs }, mainAllein: 'gruen', grenzeBasis: { umfang: 8900 } })
  melde(`SCHULDSUCHE (Basisgrenze 8900, der Zug riss sie selbst): ${JSON.stringify(rot)}`)
  const plan = revertPlan(eintraege, eintraege.slice(0, 2).map((e) => e.nr))
  for (const b of plan.befehle) melde(`REVERT #${b.nr}: ${b.befehl} (spätere Eingriffe in dieselben Dateien: ${b.risiko.join(' ') || 'keine'})`)
  return 0
}

/** Der Zug existiert: Inhalt, Revert-Möglichkeiten und Fast-Forward-Lage anzeigen. */
function zugZeilen(gitFn, melde) {
  const eintraege = zugLog(gitFn)
  melde(`ZUG: ${eintraege.filter((e) => e.nr !== null).length} PR-Commits, ${eintraege.length} Commits seit main`)
  let mainImZug = true
  try {
    gitFn(['merge-base', '--is-ancestor', 'origin/main', 'origin/zug'])
  } catch {
    mainImZug = false
  }
  const kopf = gitFn(['rev-parse', 'origin/zug']).trim()
  melde(`FF: ${JSON.stringify(ffEntscheidung({ mainImZug, kettenKopf: kopf, zugKopf: kopf }))}`)
}

/** Einstieg: Rückgabe ist der Exit-Code (0 gelesen, 2 Abruffehler). */
export async function trocken(args, melde, { ghFn = gh, gitFn = git } = {}) {
  if (args[0] !== 'trocken') {
    melde('Aufruf: node tools/zug-trocken.mjs trocken [--basis main|zug] [--max N]')
    return 2
  }
  try {
    const basis = argWert(args, '--basis', 'main')
    const max = Number(argWert(args, '--max', MAX_ZUG))
    const vorhanden = zugVorhanden(gitFn)
    const imZug = vorhanden ? zugLog(gitFn).filter((e) => e.nr !== null).map((e) => e.nr) : []
    planZeilen(zugPlan(kandidaten(ghFn, basis, melde), { max, imZug }), melde)
    if (vorhanden) zugZeilen(gitFn, melde)
    else uebung(ghFn, gitFn, melde)
    melde('zug trocken: nichts geschrieben')
    return 0
  } catch (e) {
    melde(`zug trocken: FEHLER ${e.message}`)
    return 2
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exit(await trocken(process.argv.slice(2), (z) => console.log(z)))
}
