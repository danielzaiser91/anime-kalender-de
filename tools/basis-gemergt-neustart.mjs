/**
 * Wird ein PR gemergt, den offene PRs als Basis nennen („mergen nach #N“, Erkennung `basisNummer` aus tools/pr-pruefer-basis-offen.mjs),
 * rechnet dieses Werkzeug deren Kette nach: je Stapel-PR `tools/pr-nachrechnen.mjs` (schließt und öffnet nur, wenn die Kette gegen einen
 * älteren main lief, sonst „aktuell“ ohne Neustart, also kein Doppelstart). Aufruf aus .github/workflows/pr-pruefer-nachtrag.yml
 * (Ereignis pull_request_target closed, nur gemergt). Nur Node-Bordmittel.
 * Umgebung: GITHUB_REPOSITORY, GH_TOKEN (nur ein PAT löst Folgeläufe aus), BASIS_PR; TROCKEN=true rechnet nur, schließt nichts.
 * Exit 0: nichts zu tun oder alle Stapel-PRs bearbeitet (auch „noch nicht rechenbar“, die Zeile nennt den Grund); Exit 1: Abruffehler
 * oder Eingabefehler, oder ein Stapel-PR scheiterte (pr-nachrechnen Exit 2).
 */
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { basisNummer } from './pr-pruefer-basis-offen.mjs'
import { main as nachrechnenMain, gh as ghNachrechnen, schlafe } from './pr-nachrechnen.mjs'

/** Höchstens so viele Stapel-PRs je Merge (je PR bis ~1 min, Job-Frist 9 min); die übrigen bekommen ihre Kette beim nächsten Push oder durch den Nacht-Merger. */
export const MAX_PRS = 5

/** Offene, nicht entworfene PRs (Entwürfe haben keine Kette), die `basis` als Basis nennen, aufsteigend, ohne den Basis-PR selbst. */
export function abhaengige(prs, basis) {
  return prs
    .filter((p) => p.number !== basis && !p.isDraft && basisNummer(p.body) === basis)
    .map((p) => p.number)
    .sort((a, b) => a - b)
}

/**
 * Ablauf; `holePrs()` liefert die offenen PRs, `rechne(nr)` den Exit-Code von pr-nachrechnen, `melde` schreibt eine Zeile.
 * Rückgabe: Exit-Code.
 */
export function lauf({ basis, holePrs, rechne, melde }) {
  if (!Number.isInteger(basis) || basis <= 0) {
    melde('Basis-Neustart: BASIS_PR fehlt oder ist keine Zahl')
    return 1
  }
  let alle
  try {
    alle = abhaengige(holePrs(), basis)
  } catch (e) {
    melde(`Basis-Neustart: FEHLGESCHLAGEN PR-Liste nicht lesbar (${String(e.message).split('\n')[0]})`)
    return 1
  }
  if (alle.length === 0) {
    melde(`Basis-Neustart: kein offener PR nennt #${basis} als Basis`)
    return 0
  }
  const dran = alle.slice(0, MAX_PRS)
  const uebrig = alle.slice(MAX_PRS)
  melde(`Basis-Neustart: #${basis} gemergt, Stapel-PRs ${dran.map((n) => `#${n}`).join(', ')}${uebrig.length ? `; nicht bearbeitet (Grenze ${MAX_PRS}): ${uebrig.map((n) => `#${n}`).join(', ')}` : ''}`)
  let fehler = 0
  for (const nr of dran) {
    const code = rechne(nr)
    if (code === 2) fehler++
    melde(`Basis-Neustart: PR ${nr} Exit ${code} (0 aktuell, 1 Kette neu gestartet, 2 nichts angestoßen)`)
  }
  return fehler > 0 ? 1 : 0
}

/** Offene PRs über gh; `--limit 200` deckt den Vorrat mit Luft. */
function holeOffene() {
  const aus = execFileSync('gh', ['pr', 'list', '--state', 'open', '--limit', '200', '--json', 'number,body,isDraft'], {
    encoding: 'utf8',
    timeout: 60_000,
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  })
  return JSON.parse(aus)
}

/** Eingespeist werden Abruf und `nachrechnen` (Signatur von `main` in pr-nachrechnen.mjs), damit ein Test den Einstieg ohne Netz fährt. */
export function main(env = process.env, { holePrs = holeOffene, nachrechnen = nachrechnenMain, melde = (t) => console.log(t) } = {}) {
  const trocken = env.TROCKEN === 'true'
  const rechne = (nr) => nachrechnen([...(trocken ? ['--trocken'] : []), String(nr)], ghNachrechnen, melde, schlafe)
  return lauf({ basis: Number(env.BASIS_PR), holePrs, rechne, melde })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main())
