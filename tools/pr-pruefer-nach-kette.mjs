/**
 * Startet den CI-Prüfer neu, sobald die PR-Prüfkette eines Kopfes fertig ist und der Kopf noch kein Urteil hat. Seit 19.11.2026
 * kommentiert der Prüfer bei laufender Kette nicht mehr: Kein Prüfer-Kommentar zum Kopf heißt „Kette lief noch“ (davor: Kommentar
 * „nicht beurteilt“ mit Marke MARKE_KETTE_OFFEN, bleibt für „Basis offen“ und Altbestand gültig). Aufruf aus
 * .github/workflows/pr-pruefer-nachtrag.yml (Ereignis workflow_run der „PR-Prüfkette“); nur Node-Bordmittel.
 * Umgebung: GITHUB_REPOSITORY, KOPF_SHA (head_sha des Kettenlaufs); kein Kommentartext, keine PR-Ausgabe.
 */
import { pathToFileURL } from 'node:url'
import { ghMitLimit, ghRoh, neuesKonto, warteSync } from './gh-ratelimit.mjs'
import { CI_BOT } from './pr-nachtraege.mjs'
import { holeLauf } from './pr-kettenlog.mjs'
import { basisNummer } from './pr-pruefer-basis-offen.mjs'
import { MARKE_KETTE_OFFEN } from './pr-pruefer-kette-offen.mjs'
import { MARKE_OHNE_MODELL } from './pruefer-unfertig-wache.mjs'
import { neuesterLauf, neustart } from './pr-pruefer-neustart.mjs'

const PRUEFER_WORKFLOW = 'pr-pruefer.yml'
/** Höchstens so viele Neustarts je Kopf (Schleifenschutz bei wiederholten Ketten): Marken-Kommentare bzw. Versuche des Laufs (`run_attempt`). */
export const MAX_NEUSTARTS = 2
// Der Prüfer-Lauf (Job-Timeout 30 min) liest das Kettenlog nach ~13 min und braucht danach noch bis zu 17 min für Modell und
// Kommentar: das Kettenende fällt meist mitten in seinen Lauf, sein Kommentar mit der Marke entsteht erst am Schluss.
export const WARTE_RUNDEN = 56
export const WARTE_MS = 30_000

/** Neuester Kommentar des Prüfer-Bots zu diesem Kopf (Liste der API, älteste zuerst) oder null. */
export function letztesUrteil(kommentare, kopf) {
  const kurz = `**Prüfer-Review** für ${kopf.slice(0, 9)} `
  return [...kommentare].reverse().find((k) => k.user?.login === CI_BOT && String(k.body ?? '').startsWith(kurz)) ?? null
}

/** Ja/Nein samt Grund: ist ein Neustart fällig? `pr` = API-Antwort des PR, `lauf` = neuester Prüfer-Lauf des Kopfes. */
export function entscheide({ kommentare, kopf, pr, lauf, basisOffen = false, kette = null }) {
  if (!pr) return { los: false, grund: 'kein offener PR zum Kopf' }
  if (pr.state !== 'open' || pr.draft) return { los: false, grund: 'PR nicht offen oder Entwurf' }
  if (pr.head?.sha !== kopf) return { los: false, grund: 'Kopf inzwischen ein anderer' }
  if (!lauf) return { los: false, grund: 'kein Prüfer-Lauf zum Kopf' }
  // Kein Prüfer-Lauf für diesen Kopf vorgesehen (daten/-Zweig, Fork, Probezweige): der Lauf endet „übersprungen“, nie mit Urteil.
  if (lauf.conclusion === 'skipped') return { los: false, grund: 'Prüfer-Lauf übersprungen (Kopf nicht prüfpflichtig)' }
  const letztes = letztesUrteil(kommentare, kopf)
  // Seit 19.11.2026: der Prüfer sah die Kette laufen und schwieg. Auch eine rote Kette zählt (Ende success oder failure); jeder Neustart ist ein Versuch des Laufs.
  if (!letztes) {
    const versuch = lauf.run_attempt ?? 1
    if (versuch > MAX_NEUSTARTS + 1) return { los: false, grund: `schon ${versuch} Versuche ohne Urteil (Grenze ${MAX_NEUSTARTS} Neustarts)` }
    return { los: true, grund: 'Kette fertig, Kopf ohne Urteil (Prüfer sah sie laufen und schwieg)' }
  }
  if (!String(letztes.body).includes(MARKE_KETTE_OFFEN)) return { los: false, grund: 'Kopf hat ein Urteil' }
  const kurz = `**Prüfer-Review** für ${kopf.slice(0, 9)} `
  // Läufe ohne Modell (Kette lief beim Start, 13.11.2026) kosten fast nichts und zählen nicht gegen die Grenze.
  const bisher = kommentare.filter((k) => k.user?.login === CI_BOT && String(k.body ?? '').startsWith(kurz) && String(k.body).includes(MARKE_KETTE_OFFEN) && !String(k.body).includes(MARKE_OHNE_MODELL)).length
  if (bisher > MAX_NEUSTARTS) return { los: false, grund: `schon ${bisher} Mal „Kette offen“ (Grenze ${MAX_NEUSTARTS})` }
  // Stapel-PR, Basis noch offen: eine rote Kette ist erwartet, der Prüfer urteilt erst nach grüner Kette (Marke „Basis offen“).
  if (basisOffen && kette?.conclusion !== 'success') return { los: false, grund: 'Basis noch offen und Kette nicht grün' }
  return { los: true, grund: basisOffen ? 'Basis gemergt oder Kette grün: Prüfer sah sie unfertig' : 'Kette fertig, Prüfer sah sie unfertig' }
}

/** Ist der in der PR-Beschreibung genannte Basis-PR noch offen? Abruffehler zählen als „nein“ (altes Verhalten). */
function basisIstOffen(repo, pr, gh) {
  const nr = basisNummer(pr.body)
  if (!nr) return false
  try {
    return gh(['api', `repos/${repo}/pulls/${nr}`, '-q', '.state']).trim() === 'open'
  } catch {
    return false
  }
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
export function main(env = process.env, { gh: ghBasis = ghRoh, warte = warteSync, jetzt = Date.now, konto = neuesKonto() } = {}) {
  // Bei „rate limit“ wartet ein Aufruf bis zum Reset, alle zusammen höchstens KONTO_MS (Job-Timeout im Workflow daraus abgeleitet).
  const gh = (args) => ghMitLimit(ghBasis, args, { warte, jetzt, konto })
  const repo = env.GITHUB_REPOSITORY
  const kopf = env.KOPF_SHA
  if (!repo || !/^[0-9a-f]{40}$/.test(kopf ?? '')) return console.log('Prüfer-Nachlauf: Repo oder Kopf fehlt'), 1
  try {
    const pulls = JSON.parse(gh(['api', `repos/${repo}/commits/${kopf}/pulls`]))
    const pr = pulls.find((p) => p.state === 'open' && p.head?.sha === kopf) ?? null
    if (!pr) return console.log('Prüfer-Nachlauf: nein (kein offener PR zum Kopf)'), 0
    const lauf = fertigerLauf(repo, kopf, { gh, warte })
    const kommentare = JSON.parse(gh(['api', '--paginate', '--slurp', `repos/${repo}/issues/${pr.number}/comments`])).flat()
    const basisOffen = basisIstOffen(repo, pr, gh)
    const kette = basisOffen ? holeLauf(repo, kopf, gh) : null
    const urteil = entscheide({ kommentare, kopf, pr, lauf, basisOffen, kette })
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
