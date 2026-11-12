/**
 * Wird ein PR gemergt, den offene PRs als Basis nennen („mergen nach #N“, Erkennung `basisNummer` aus tools/pr-pruefer-basis-offen.mjs),
 * rechnet dieses Werkzeug deren Kette nach: je Stapel-PR `tools/pr-nachrechnen.mjs` (schließt und öffnet nur, wenn die Kette gegen einen
 * älteren main lief, sonst „aktuell“ ohne Neustart, also kein Doppelstart). Aufruf aus .github/workflows/pr-pruefer-nachtrag.yml
 * (Ereignis pull_request_target closed, nur gemergt). Nur Node-Bordmittel.
 * Umgebung: GITHUB_REPOSITORY, GH_TOKEN (nur ein PAT löst Folgeläufe aus), BASIS_PR; TROCKEN=true rechnet nur, schließt nichts.
 *
 * Ausgang je Stapel-PR (Exit von pr-nachrechnen und Grund aus seiner Meldung):
 *   0 aktuell, 1 Kette neu gestartet                  -> grün
 *   3 ersetzt (ein anderer PR trägt „ersetzt PR N“)   -> grün, Zeile „ERSETZT“
 *   2 mit „Konflikt mit main“                         -> grün, Zeile „KONFLIKT“ (main einmergen startet die Kette)
 *   2 „noch nicht berechnet“ (mergeable UNKNOWN direkt nach dem Merge) oder „läuft noch“ (Kette, Job) -> ein Neuversuch nach Pause;
 *     bleibt es dabei: grün, Zeile „NICHT NEU GERECHNET“ mit dem Handgriff (erwarteter Zustand, kein Fehler)
 *   2 sonst (Abruf-, Lese-, Schließfehler, „SCHON ANGESTOSSEN“) -> rot
 * Rot (Exit 1) ist damit nur: PR-Liste nicht lesbar, BASIS_PR fehlt, echter Fehler bei einem Stapel-PR; sonst gäbe es Fehlalarme
 * in laeufe-aufraeumen.
 */
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { basisNummer } from './pr-pruefer-basis-offen.mjs'
import { main as nachrechnenMain, gh as ghNachrechnen, schlafe } from './pr-nachrechnen.mjs'

/**
 * Höchstens so viele Stapel-PRs je Merge; die übrigen bekommen ihre Kette beim nächsten Push oder durch den Nacht-Merger.
 * Frist je PR höchstens PRO_PR_SEK: ein Neustart wartet bis 60 s auf den Merge-Commit, zwei Versuche ohne Neustart enden je am
 * gh-Limit von 30 s, dazu die Pause (80 s). Dazu 60 s Checkout; die Summe steht als Test gegen timeout-minutes (9).
 */
export const MAX_PRS = 4
export const PRO_PR_SEK = 100
/** Versuche je PR bei „noch nicht berechnet“ / „läuft noch“ (ein Neuversuch), dazwischen die Pause. */
export const VERSUCHE = 2
export const PAUSE_MS = 20_000

/** Offene, nicht entworfene PRs (Entwürfe haben keine Kette), die `basis` als Basis nennen, aufsteigend, ohne den Basis-PR selbst. */
export function abhaengige(prs, basis) {
  return prs
    .filter((p) => p.number !== basis && !p.isDraft && basisNummer(p.body) === basis)
    .map((p) => p.number)
    .sort((a, b) => a - b)
}

/** Grund eines Exit 2 von pr-nachrechnen aus seiner Meldung: 'konflikt', 'spaeter' (kommt von selbst) oder 'fehler'. */
export function grundExit2(text) {
  if (/SCHON ANGESTOSSEN|FEHLER/.test(text)) return 'fehler'
  if (/Konflikt mit main/.test(text)) return 'konflikt'
  if (/noch nicht berechnet|läuft noch|noch keine Jobs angelegt|noch nicht angelegt/.test(text)) return 'spaeter'
  return 'fehler'
}

/** Ein Stapel-PR: Versuche mit Pause; Rückgabe true, wenn er rot zählt. `rechne(nr)` liefert { code, text }. */
function bearbeite(nr, { rechne, warte, melde }) {
  for (let versuch = 1; ; versuch++) {
    const { code, text } = rechne(nr)
    if (code === 0 || code === 1) {
      melde(`Basis-Neustart: PR ${nr} Exit ${code} (${code === 0 ? 'aktuell' : 'Kette neu gestartet'})`)
      return false
    }
    if (code === 3) {
      melde(`Basis-Neustart: PR ${nr} ERSETZT (Exit 3), nichts angestoßen: ${text}`)
      return false
    }
    const grund = grundExit2(text)
    if (grund === 'konflikt') {
      melde(`Basis-Neustart: PR ${nr} KONFLIKT mit main, nichts angestoßen: erst main einmergen, das startet die Kette (${text})`)
      return false
    }
    if (grund === 'spaeter' && versuch < VERSUCHE) {
      warte(PAUSE_MS)
      continue
    }
    if (grund === 'spaeter') {
      melde(`Basis-Neustart: PR ${nr} NICHT NEU GERECHNET (${text}); von Hand: node tools/pr-nachrechnen.mjs ${nr}`)
      return false
    }
    melde(`Basis-Neustart: PR ${nr} FEHLER (Exit ${code}): ${text}`)
    return true
  }
}

/**
 * Ablauf; `holePrs()` liefert die offenen PRs, `rechne(nr)` { code, text } von pr-nachrechnen, `warte(ms)` die Pause, `melde` eine Zeile.
 * Rückgabe: Exit-Code.
 */
export function lauf({ basis, holePrs, rechne, warte, melde }) {
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
    if (bearbeite(nr, { rechne, warte, melde })) fehler++
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

/** Eingespeist werden Abruf, `nachrechnen` (Signatur von `main` in pr-nachrechnen.mjs) und Pause, damit ein Test den Einstieg ohne Netz fährt. */
export function main(env = process.env, { holePrs = holeOffene, nachrechnen = nachrechnenMain, warte = schlafe, melde = (t) => console.log(t) } = {}) {
  const trocken = env.TROCKEN === 'true'
  const rechne = (nr) => {
    const zeilen = []
    const code = nachrechnen([...(trocken ? ['--trocken'] : []), String(nr)], ghNachrechnen, (t) => (zeilen.push(t), melde(t)), schlafe)
    return { code, text: zeilen.join(' ') }
  }
  return lauf({ basis: Number(env.BASIS_PR), holePrs, rechne, warte, melde })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main())
