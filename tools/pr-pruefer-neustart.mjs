/**
 * Startet den CI-Prüfer (pr-pruefer.yml) neu, wenn auf einem offenen PR ein Nachtrag-Kommentar erscheint.
 * Aufruf aus .github/workflows/pr-pruefer-nachtrag.yml; nur Node-Bordmittel, der Kommentartext kommt nur über die Umgebung.
 * Der Prüfer liest die Kommentare bei jedem Start neu (tools/pr-nachtraege.mjs); ein Neustart des Laufs auf demselben Kopf genügt.
 */
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { CI_BOT, NACHTRAG, VERTRAUT } from './pr-nachtraege.mjs'

const PRUEFER_WORKFLOW = 'pr-pruefer.yml'
const ABNAHME = /Abnahme Dirigent/i
const WARTE_RUNDEN = 12
const WARTE_MS = 5000

/** Ja/Nein samt Grund: zählt der Kommentar als Prüfauftrag? `pr` = Antwort der API für den PR. */
export function entscheide({ body, kommentarLogin, assoziation, pr }) {
  const erste = String(body ?? '').split('\n')[0]
  if (!pr) return { los: false, grund: 'kein PR' }
  if (kommentarLogin === CI_BOT) return { los: false, grund: 'Kommentar des Prüfers selbst' }
  if (!NACHTRAG.test(body ?? '')) return { los: false, grund: 'kein Nachtrag' }
  if (ABNAHME.test(erste)) return { los: false, grund: 'Abnahme des Dirigenten, kein Prüfauftrag' }
  if (kommentarLogin !== pr.user?.login && !VERTRAUT.has(assoziation)) return { los: false, grund: 'Autor ohne Schreibrecht' }
  if (pr.state !== 'open') return { los: false, grund: 'PR nicht offen' }
  if (pr.draft) return { los: false, grund: 'Entwurf' }
  if (pr.head?.repo?.full_name !== pr.base?.repo?.full_name) return { los: false, grund: 'Fork' }
  if (String(pr.head?.ref ?? '').startsWith('daten/')) return { los: false, grund: 'Datenzweig' }
  return { los: true, grund: 'Nachtrag eines Berechtigten' }
}

/** Neuester Lauf des Prüfer-Workflows für den Kopf (Liste der API, neueste zuerst). */
export function neuesterLauf(laeufe) {
  return (laeufe ?? []).find((l) => l.id) ?? null
}

/** Beendet einen laufenden Lauf (cancel + Warten), dann `rerun`. `gh(args)` und `warte(ms)` sind einspeisbar. */
export function neustart(lauf, repo, { gh, warte }) {
  if (lauf.status !== 'completed') {
    gh(['run', 'cancel', String(lauf.id)])
    for (let i = 0; i < WARTE_RUNDEN; i++) {
      const stand = JSON.parse(gh(['api', `repos/${repo}/actions/runs/${lauf.id}`]))
      if (stand.status === 'completed') break
      warte(WARTE_MS)
    }
  }
  gh(['run', 'rerun', String(lauf.id)])
}

function ghEcht(args) {
  return execFileSync('gh', args, { encoding: 'utf8', timeout: 60_000, windowsHide: true })
}

/** Einstieg; Rückgabe ist der Exit-Code. Nie hart rot: ein ausgebliebener Neustart ist der Zustand von vorher. */
export function main(env = process.env, { gh = ghEcht, warte = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms) } = {}) {
  const repo = env.GITHUB_REPOSITORY
  const nr = env.PR_NUMMER
  if (!/^\d+$/.test(nr ?? '') || !repo) return console.log('Prüfer-Neustart: PR-Nummer oder Repo fehlt'), 1
  let pr = null
  try {
    pr = JSON.parse(gh(['api', `repos/${repo}/pulls/${nr}`]))
  } catch (e) {
    return console.log(`Prüfer-Neustart: PR nicht lesbar (${e.message.split('\n')[0]})`), 1
  }
  const urteil = entscheide({ body: env.KOMMENTAR, kommentarLogin: env.KOMMENTAR_LOGIN, assoziation: env.KOMMENTAR_ASSOZIATION, pr })
  if (!urteil.los) return console.log(`Prüfer-Neustart: nein (${urteil.grund})`), 0
  const liste = gh(['api', `repos/${repo}/actions/workflows/${PRUEFER_WORKFLOW}/runs?head_sha=${pr.head.sha}&per_page=10`, '-q', '.workflow_runs'])
  const lauf = neuesterLauf(JSON.parse(liste))
  if (!lauf) return console.log(`Prüfer-Neustart: kein Lauf für ${pr.head.sha.slice(0, 9)}, nichts zu tun`), 0
  neustart(lauf, repo, { gh, warte })
  console.log(`Prüfer-Neustart: ja, Lauf ${lauf.id} für ${pr.head.sha.slice(0, 9)} neu gestartet (${urteil.grund})`)
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main())
