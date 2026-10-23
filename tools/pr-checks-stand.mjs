/**
 * Check-Stand des PR-Kopfes für den CI-Prüfer (.github/workflows/pr-pruefer.yml, 18.10.2026).
 *
 *   node tools/pr-checks-stand.mjs <kopf-sha> <frist-sekunden>     (gibt `stand=<zeile>` aus, Exit immer 0)
 *
 * Der Prüfer läuft parallel zur PR-Prüfkette und urteilt meist nach 1–2 min, die Kette braucht 4–5 min. Darum wartet
 * dieser Schritt nach dem Urteil, bis die Pflicht-Checks des Rulesets von main grün sind, ein Check rot ist oder die Frist
 * abläuft. `<zeile>` ist `gruen`, `Checks rot: …`, `Checks laufen noch: …` oder `Checks-Stand unbekannt: …`; die Freigabe
 * gibt „ok“ ohne Zusatz nur bei `gruen`. Gilt nur für den Prüfer selbst: sein eigener laufender Check zählt nicht.
 */
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const EIGENER = 'Prüfer-Review'
const TAKT_MS = 20_000
// Ohne rot gilt ein Abschluss nur als bestanden; übersprungen/neutral ist beim Prüfer (kein Entwurf, kein daten/-Zweig) ein alter Lauf.
const NICHT_ROT = new Set(['success', 'neutral', 'skipped'])

/** Ein Name als sichere Einzeilen-Angabe: er landet in $GITHUB_OUTPUT und im PR-Kommentar. */
const sauber = (text) => String(text).replace(/[\u0000-\u001f\u007f]+/g, ' ').slice(0, 80)

/** Namen der Pflicht-Checks aus der Antwort von `GET repos/{repo}/rules/branches/main`. */
export function pflichtAusRegeln(regeln) {
  return regeln
    .filter((r) => r.type === 'required_status_checks')
    .flatMap((r) => r.parameters?.required_status_checks ?? [])
    .map((c) => c.context)
}

/** Stand aus den Check-Runs des Kopfes ({ id, name, status, conclusion }) und den Pflicht-Namen. */
export function bewerte(laeufe, pflicht) {
  const jeName = new Map()
  for (const l of laeufe) if (!jeName.has(l.name) || l.id > jeName.get(l.name).id) jeName.set(l.name, l)
  const andere = [...jeName.values()].filter((l) => !(l.name === EIGENER && l.status !== 'completed'))
  const rot = andere.filter((l) => l.status === 'completed' && !NICHT_ROT.has(l.conclusion)).map((l) => l.name)
  if (rot.length) return { zustand: 'rot', namen: rot.sort() }
  if (!pflicht.length) return { zustand: 'unbekannt', namen: ['keine Pflicht-Checks im Ruleset'] }
  const fehlend = pflicht.filter((p) => !jeName.has(p)).map((p) => `${p} (fehlt)`)
  const offenePflicht = pflicht.filter((p) => jeName.has(p) && jeName.get(p).conclusion !== 'success')
  if (!fehlend.length && !offenePflicht.length) return { zustand: 'gruen', namen: [] }
  const laufend = andere.filter((l) => l.status !== 'completed').map((l) => l.name)
  return { zustand: 'laeuft', namen: [...new Set([...fehlend, ...offenePflicht, ...laufend])].sort() }
}

/** Die Zeile für $GITHUB_OUTPUT und die erste Zeile des Prüfer-Kommentars. */
export function zeile(stand) {
  const namen = stand.namen.map(sauber).join(', ')
  if (stand.zustand === 'gruen') return 'gruen'
  if (stand.zustand === 'rot') return `Checks rot: ${namen}`
  if (stand.zustand === 'laeuft') return `Checks laufen noch: ${namen}`
  return `Checks-Stand unbekannt: ${namen}`
}

/** Fragt bis zur Frist im Takt nach; endet sofort bei grün, rot oder ohne Pflicht-Checks. API-Fehler werden wiederholt. */
export async function ermittleStand({ holePflicht, holeLaeufe, warte, jetzt, frist, takt = TAKT_MS }) {
  const ende = jetzt() + frist
  let pflicht = null
  for (;;) {
    let stand
    try {
      pflicht ??= holePflicht()
      stand = bewerte(holeLaeufe(), pflicht)
      if (stand.zustand !== 'laeuft') return stand
    } catch (e) {
      stand = { zustand: 'unbekannt', namen: [`API: ${e.message}`] }
    }
    if (jetzt() + takt > ende) return stand
    await warte(takt)
  }
}

/** `gh` als Funktion: Argumente rein, stdout raus; scheitert der Aufruf, wirft sie. */
export function ghAufruf(args) {
  const r = spawnSync('gh', args, { encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 24 })
  if (r.error) throw r.error
  if (r.status !== 0) throw new Error(`gh ${args.slice(0, 3).join(' ')} Exit ${r.status}`)
  return r.stdout
}

export function holePflicht(repo, gh) {
  return pflichtAusRegeln(JSON.parse(gh(['api', `repos/${repo}/rules/branches/main`])))
}

export function holeLaeufe(repo, sha, gh) {
  const roh = gh(['api', '--paginate', `repos/${repo}/commits/${sha}/check-runs?per_page=100`,
    '-q', '.check_runs[] | [.id, .name, .status, (.conclusion // "")] | @tsv'])
  return roh.split('\n').filter(Boolean).map((z) => {
    const [id, name, status, conclusion] = z.split('\t')
    return { id: Number(id), name, status, conclusion }
  })
}

async function main() {
  const [sha, fristS] = process.argv.slice(2)
  const repo = process.env.GITHUB_REPOSITORY
  const stand = /^[0-9a-f]{40}$/.test(sha ?? '') && repo
    ? await ermittleStand({
      holePflicht: () => holePflicht(repo, ghAufruf),
      holeLaeufe: () => holeLaeufe(repo, sha, ghAufruf),
      warte: (ms) => new Promise((fertig) => setTimeout(fertig, ms)),
      jetzt: Date.now,
      frist: Number(fristS) * 1000 || 0,
    })
    : { zustand: 'unbekannt', namen: ['Kopf oder Repo fehlt'] }
  const text = zeile(stand)
  console.error(`Check-Stand ${String(sha).slice(0, 9)}: ${text}`)
  console.log(`stand=${text}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
