/**
 * Startet den CI-Prüfer neu, sobald die PR-Prüfkette eines Kopfes fertig ist, nachdem er sie unfertig sah und
 * „nicht beurteilt“ kommentiert hat (Marke MARKE_KETTE_OFFEN, gesetzt in pr-pruefer.yml). Aufruf aus
 * .github/workflows/pr-pruefer-nachtrag.yml (Ereignis workflow_run der „PR-Prüfkette“); nur Node-Bordmittel.
 * Umgebung: GITHUB_REPOSITORY, KOPF_SHA (head_sha des Kettenlaufs); kein Kommentartext, keine PR-Ausgabe.
 */
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { CI_BOT } from './pr-nachtraege.mjs'
import { MARKE_KETTE_OFFEN } from './pr-pruefer-kette-offen.mjs'
import { neuesterLauf, neustart } from './pr-pruefer-neustart.mjs'

const PRUEFER_WORKFLOW = 'pr-pruefer.yml'
/** Höchstens so viele „nicht beurteilt“-Kommentare je Kopf lösen einen Neustart aus (Schleifenschutz bei wiederholten Ketten). */
export const MAX_NEUSTARTS = 2
// Der Prüfer-Lauf (Job-Timeout 30 min) liest das Kettenlog nach ~13 min und braucht danach noch bis zu 17 min für Modell und
// Kommentar: das Kettenende fällt meist mitten in seinen Lauf, sein Kommentar mit der Marke entsteht erst am Schluss.
const WARTE_RUNDEN = 56
const WARTE_MS = 30_000

/** Neuester Kommentar des Prüfer-Bots zu diesem Kopf (Liste der API, älteste zuerst) oder null. */
export function letztesUrteil(kommentare, kopf) {
  const kurz = `**Prüfer-Review** für ${kopf.slice(0, 9)} `
  return [...kommentare].reverse().find((k) => k.user?.login === CI_BOT && String(k.body ?? '').startsWith(kurz)) ?? null
}

/** Ja/Nein samt Grund: ist ein Neustart fällig? `pr` = API-Antwort des PR, `lauf` = neuester Prüfer-Lauf des Kopfes. */
export function entscheide({ kommentare, kopf, pr, lauf }) {
  if (!pr) return { los: false, grund: 'kein offener PR zum Kopf' }
  if (pr.state !== 'open' || pr.draft) return { los: false, grund: 'PR nicht offen oder Entwurf' }
  if (pr.head?.sha !== kopf) return { los: false, grund: 'Kopf inzwischen ein anderer' }
  if (!lauf) return { los: false, grund: 'kein Prüfer-Lauf zum Kopf' }
  const letztes = letztesUrteil(kommentare, kopf)
  if (!letztes || !String(letztes.body).includes(MARKE_KETTE_OFFEN)) return { los: false, grund: 'letztes Urteil war nicht „Kette offen“' }
  const kurz = `**Prüfer-Review** für ${kopf.slice(0, 9)} `
  const bisher = kommentare.filter((k) => k.user?.login === CI_BOT && String(k.body ?? '').startsWith(kurz) && String(k.body).includes(MARKE_KETTE_OFFEN)).length
  if (bisher > MAX_NEUSTARTS) return { los: false, grund: `schon ${bisher} Mal „Kette offen“ (Grenze ${MAX_NEUSTARTS})` }
  return { los: true, grund: 'Kette fertig, Prüfer sah sie unfertig' }
}

function ghEcht(args) {
  return execFileSync('gh', args, { encoding: 'utf8', timeout: 60_000, windowsHide: true })
}

/** Wartet (höchstens WARTE_RUNDEN Mal), bis der Prüfer-Lauf des Kopfes fertig ist: sein Kommentar entsteht erst am Ende. */
function fertigerLauf(repo, kopf, { gh, warte }) {
  let lauf = null
  for (let i = 0; i < WARTE_RUNDEN; i++) {
    const liste = gh(['api', `repos/${repo}/actions/workflows/${PRUEFER_WORKFLOW}/runs?head_sha=${kopf}&per_page=10`, '-q', '.workflow_runs'])
    lauf = neuesterLauf(JSON.parse(liste))
    if (!lauf || lauf.status === 'completed') return lauf
    warte(WARTE_MS)
  }
  // Ohne Ende des Prüfer-Laufs gäbe es kein weiteres Kettenende-Ereignis: lieber sichtbar scheitern als still nichts tun.
  throw new Error(`Prüfer-Lauf ${lauf.id} nach ${(WARTE_RUNDEN * WARTE_MS) / 60_000} min nicht fertig`)
}

/** Einstieg; Rückgabe ist der Exit-Code. 1 nur bei Eingabe- oder Abruffehlern („FEHLGESCHLAGEN …“ im Log). */
export function main(env = process.env, { gh = ghEcht, warte = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms) } = {}) {
  const repo = env.GITHUB_REPOSITORY
  const kopf = env.KOPF_SHA
  if (!repo || !/^[0-9a-f]{40}$/.test(kopf ?? '')) return console.log('Prüfer-Nachlauf: Repo oder Kopf fehlt'), 1
  try {
    const pulls = JSON.parse(gh(['api', `repos/${repo}/commits/${kopf}/pulls`]))
    const pr = pulls.find((p) => p.state === 'open' && p.head?.sha === kopf) ?? null
    if (!pr) return console.log('Prüfer-Nachlauf: nein (kein offener PR zum Kopf)'), 0
    const lauf = fertigerLauf(repo, kopf, { gh, warte })
    const kommentare = JSON.parse(gh(['api', '--paginate', '--slurp', `repos/${repo}/issues/${pr.number}/comments`])).flat()
    const urteil = entscheide({ kommentare, kopf, pr, lauf })
    if (!urteil.los) return console.log(`Prüfer-Nachlauf: nein (${urteil.grund})`), 0
    neustart(lauf, repo, { gh, warte })
    console.log(`Prüfer-Nachlauf: ja, Lauf ${lauf.id} für ${kopf.slice(0, 9)} neu gestartet (${urteil.grund})`)
  } catch (e) {
    console.log(`Prüfer-Nachlauf: FEHLGESCHLAGEN Kopf ${kopf.slice(0, 9)}: nicht neu gestartet (${e.message.split('\n')[0]})`)
    return 1
  }
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main())
