/**
 * Rechnet die PR-Prüfkette eines PR nach, bevor er gemergt wird (19.10.2026, Befund Prüfer 1576; Ansatz 1597 R2).
 * Grund: Die Kette läuft auf `refs/pull/N/merge`, also gegen main zum Zeitpunkt ihres Starts. GitHub baut diesen Merge-Commit
 * nicht neu, wenn main weiterkommt (gemessen 19.10.2026: 1597 blieb über 30 min auf der alten Basis), ein grüner Check kann also
 * gegen einen main gerechnet sein, den es nicht mehr gibt. `gh run rerun` nutzt denselben Merge-Commit; erst `reopened` baut ihn neu,
 * und zwar nach dem Ereignis: dessen Lauf nimmt noch den alten Merge-Commit (gemessen 19.10.2026 an PR 1602), daher `anstossen`.
 *
 * Aufruf (Dirigent, vor jedem Merge): node tools/pr-nachrechnen.mjs <PR>
 *   Exit 0: der neueste Kettenlauf zum Kopf rechnete gegen den jetzigen main-HEAD, oder main bewegte sich seit dem Lauf nur unter
 *           `public/data/` und `data/cache/` und der PR berührt diese Pfade nicht (F55, 20.10.2026; `datenpfadAusnahme`), oder alle
 *           Commits seitdem stammen von Daten-Bots und bewegen nur `data/`, und der PR liest keine Daten (Merge-Fluss C; `botSprungAusnahme`).
 *   Exit 1: nicht aktuell; der PR wurde geschlossen und wieder geöffnet, die Kette läuft neu (der Prüfer hört nicht auf `reopened`).
 *   Exit 2: nichts angestoßen (Konflikt, Mergebarkeit oder Test-Merge noch nicht berechnet, kein Lauf, Basis nicht lesbar, Fehler);
 *           die Meldung sagt, warum. Scheitert es erst nach dem Schließen, steht „SCHON ANGESTOSSEN“ in der Meldung.
 * Die Basis steht in der Checkout-Zeile des Jobs JOB: „HEAD is now at … Merge <Kopf> into <Basis>“ (Text des Merge-Commits von GitHub).
 */
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { BOT_DATEIEN_OHNE_LESER, istBotDatei } from './pr-nachrechnen-bot-pfade.mjs'

export const KETTE = 'pr-pruefung.yml'
/** Kleiner Job der Kette mit Checkout ohne eigenes `ref` (prüft `pr-nachrechnen.test.mjs` an der YAML). */
export const JOB = 'Kette – Workflows'
const OEFFNEN_VERSUCHE = 3
/** Warten auf den neu gerechneten Merge-Commit nach dem ersten Wiederöffnen (gemessen 19.10.2026: nach wenigen Sekunden da). */
export const REF_PRUEFUNGEN = 30
export const REF_ABSTAND_MS = 2000

/** Basis (erster Elternteil des Merge-Commits) aus dem Job-Log, nur wenn die Zeile zum Kopf gehört; sonst null. */
export function basisAusLog(log, kopf) {
  if (!/^[0-9a-f]{40}$/.test(kopf)) return null
  const m = new RegExp(`HEAD is now at [0-9a-f]+ Merge ${kopf} into ([0-9a-f]{40})\\s*$`, 'm').exec(log)
  return m ? m[1] : null
}

/** Neuester Kettenlauf zum Kopf (gleicher Commit), sonst null. */
export function neuesterLauf(laeufe, kopf) {
  const passend = laeufe.filter((l) => l.headSha === kopf)
  return passend.reduce((neu, l) => (neu === null || Date.parse(l.createdAt) > Date.parse(neu.createdAt) ? l : neu), null)
}

/** Vor dem Lesen der Läufe: nur ein offener, konfliktfreier PR bekommt durch `reopened` eine neue Kette. */
export function hindernis(pr) {
  if (pr.state !== 'OPEN') return `PR ${pr.number} ist nicht offen (${pr.state})`
  if (pr.mergeable === 'CONFLICTING') return `PR ${pr.number} hat einen Konflikt mit main: erst main hineinmergen, das startet die Kette neu`
  if (pr.mergeable !== 'MERGEABLE') return `PR ${pr.number}: Mergebarkeit noch nicht berechnet (${pr.mergeable}), gleich erneut aufrufen`
  return null
}

/** Pfade, deren Bewegung auf main die Kette nicht entwertet (F55, Daniel 20.10.2026). Dazu die Bot-Dateien ohne Leser in der Kette (`pr-nachrechnen-bot-pfade.mjs`). Alles andere (Code, tools/umfang-grenzen.json, extension/, data/dub-confirmed.yaml, public/og/) zählt. */
export const DATENPFADE = ['public/data/', 'data/cache/']
/** Compare liefert höchstens 300 Dateien; bei so vielen ist die Liste evtl. abgeschnitten, also keine Ausnahme. */
export const COMPARE_GRENZE = 300

export const istDatenpfad = (datei) => DATENPFADE.some((p) => datei.startsWith(p)) || istBotDatei(datei)

/** null = Ausnahme gilt (main bewegte nur Datenpfade, der PR keinen); sonst der Grund, warum nicht. */
export function datenpfadAusnahme(vergleich, prDateien) {
  if (vergleich.status !== 'ahead') return `main ist gegenüber der Kettenbasis ${vergleich.status}, nicht nur vorgerückt`
  if (vergleich.anzahl >= COMPARE_GRENZE) return `Vergleich mit ${vergleich.anzahl} Dateien evtl. abgeschnitten`
  const fremd = vergleich.dateien.find((d) => !istDatenpfad(d))
  if (fremd !== undefined) return `main bewegte ${fremd}`
  const beruehrt = prDateien.find(istDatenpfad)
  if (beruehrt !== undefined) return `der PR berührt ${beruehrt}`
  return null
}

/** Autoren der Datenläufe auf main (gemessen 23.10.2026 an den letzten 40 Commits). */
export const BOT_AUTOREN = ['anime-kalender-daten[bot]', 'github-actions[bot]']
/**
 * PR-Pfade, die die Kette nie gegen Daten laufen lässt. Alles andere gilt als Leser: `web/` und `tools/` lesen `public/data` über
 * `npm run build` und die Prüfskripte, `worker/`, `extension/` und `.github/` über ihre Tests (Prüfer #1860).
 */
export const OHNE_DATENLESER = ['docs/', 'daniel-zum-abarbeiten/', 'data/patchnotes/']
const liestDaten = (datei) => !OHNE_DATENLESER.some((p) => datei.startsWith(p)) && !/^[^/]+\.md$/.test(datei)

/**
 * Merge-Fluss C (23.10.2026): Ein Sprung nur aus Bot-Commits unter `data/` entwertet keinen PR, der keine Daten liest; der Bestandsbau
 * prüft nach dem Merge den ganzen Datensatz. Von 8 Entwertungen am 23.10. waren 2 reine Bot-Sprünge (beide bei 1842, der `tools/` las),
 * 5 enthielten einen Menschen-Merge; die Meldung nennt darum den Autor. null = Ausnahme gilt, sonst der Grund.
 */
export function botSprungAusnahme(vergleich, prDateien) {
  if (vergleich.status !== 'ahead') return `main ist gegenüber der Kettenbasis ${vergleich.status}, nicht nur vorgerückt`
  if (vergleich.anzahl >= COMPARE_GRENZE || vergleich.commitsGesamt !== vergleich.autoren.length) return 'Vergleich evtl. abgeschnitten'
  const mensch = vergleich.autoren.find((a) => !BOT_AUTOREN.includes(a))
  if (mensch !== undefined) return `Commit von ${mensch}`
  const fremd = vergleich.dateien.find((d) => !d.startsWith('data/') && !istDatenpfad(d))
  if (fremd !== undefined) return `Bot bewegte ${fremd}`
  const leser = prDateien.find(liestDaten)
  return leser === undefined ? null : `der PR liest Daten (${leser})`
}

/** Rückgabe { ausnahme } (Kette gilt weiter, Text für die Meldung) oder { grund }. */
function datenpfadGrund(gh, nummer, basis, main) {
  const vergleich = JSON.parse(gh(['api', `repos/{owner}/{repo}/compare/${basis}...${main}`, '--jq', '{status, anzahl: (.files | length), dateien: [.files[] | .filename, (.previous_filename // empty)], commitsGesamt: .total_commits, autoren: [.commits[] | .author.login // .commit.author.name]}']))
  const pr = gh(['api', `repos/{owner}/{repo}/pulls/${nummer}/files`, '--paginate', '--jq', '.[] | .filename, (.previous_filename // empty)']).split(/\r?\n/).filter(Boolean)
  const daten = datenpfadAusnahme(vergleich, pr)
  if (daten === null) return { ausnahme: `nur Daten bewegt (${DATENPFADE.join(', ')}, ${BOT_DATEIEN_OHNE_LESER.length} Bot-Dateien ohne Leser)` }
  const bot = botSprungAusnahme(vergleich, pr)
  if (bot === null) return { ausnahme: 'nur Daten-Bots unter data/, der PR liest keine Daten' }
  return { grund: `${daten}; ${bot}` }
}

const kurz = (sha) => sha.slice(0, 9)

function oeffneMitWiederholung(gh, nummer) {
  for (let versuch = 1; ; versuch++) {
    try {
      return gh(['pr', 'reopen', String(nummer)])
    } catch (e) {
      if (versuch >= OEFFNEN_VERSUCHE) throw new Error(`PR ${nummer} BLEIBT GESCHLOSSEN, von Hand öffnen (${e.message})`)
    }
  }
}

/** `begonnen()` meldet, dass der PR geschlossen wurde: ab da ist etwas angestoßen, auch wenn später etwas scheitert. */
function wiederoeffnen(gh, nummer, begonnen) {
  gh(['pr', 'close', String(nummer)])
  begonnen()
  oeffneMitWiederholung(gh, nummer)
}

/**
 * Erster Elternteil des Merge-Commits, den GitHub gerade für den PR hält (`merge_commit_sha`, derselbe wie `refs/pull/N/merge`);
 * null, solange GitHub ihn neu rechnet (direkt nach dem Wiederöffnen leer, gemessen 19.10.2026 an PR 1602).
 */
function mergeBasis(gh, nummer) {
  const sha = gh(['api', `repos/{owner}/{repo}/pulls/${nummer}`, '--jq', '.merge_commit_sha']).trim()
  if (sha === '') return null
  return gh(['api', `repos/{owner}/{repo}/commits/${sha}`, '--jq', '.parents[0].sha']).trim()
}

/**
 * Startet die Kette gegen den neuen main. Der Lauf zu `reopened` nimmt den Merge-Commit, der beim Öffnen galt; ist der veraltet,
 * öffnet das erste Wiederöffnen nur, damit GitHub ihn neu rechnet, das zweite startet die Kette (den ersten Lauf bricht die Concurrency ab).
 */
export function anstossen(gh, nummer, main, warte) {
  const vorher = mergeBasis(gh, nummer)
  if (vorher === null) throw new Error(`PR ${nummer}: Test-Merge noch nicht berechnet, gleich erneut aufrufen (nichts angestoßen)`)
  let angestossen = false
  try {
    anstossenAb(gh, nummer, main, warte, vorher, () => { angestossen = true })
  } catch (e) {
    if (!angestossen) throw e
    throw new Error(`${e.message} (SCHON ANGESTOSSEN: PR war geschlossen, Zustand und Kettenlauf prüfen, nicht blind wiederholen)`)
  }
}

function anstossenAb(gh, nummer, main, warte, vorher, begonnen) {
  if (vorher === main) return wiederoeffnen(gh, nummer, begonnen)
  wiederoeffnen(gh, nummer, begonnen)
  for (let i = 0; ; i++) {
    const neu = mergeBasis(gh, nummer)
    if (neu !== null && neu !== vorher) break
    if (i >= REF_PRUEFUNGEN) throw new Error(`PR ${nummer}: Merge-Commit nicht neu gerechnet, die Kette läuft noch gegen ${kurz(vorher)}`)
    warte(REF_ABSTAND_MS)
  }
  wiederoeffnen(gh, nummer, begonnen)
}

/** Liest Basis des neuesten Kettenlaufs; Rückgabe { basis } oder { grund } (dann ist nichts zu entscheiden). */
function basisDesLaufs(gh, pr) {
  const laeufe = JSON.parse(gh(['run', 'list', '--workflow', KETTE, '--event', 'pull_request', '--branch', pr.headRefName, '--limit', '20', '--json', 'databaseId,headSha,createdAt']))
  const lauf = neuesterLauf(laeufe, pr.headRefOid)
  if (lauf === null) return { grund: `PR ${pr.number}: kein Kettenlauf zum Kopf ${kurz(pr.headRefOid)}` }
  const jobs = JSON.parse(gh(['run', 'view', String(lauf.databaseId), '--json', 'jobs'])).jobs
  const job = jobs.find((j) => j.name === JOB)
  if (job === undefined) return { grund: `PR ${pr.number}: Lauf ${lauf.databaseId} hat keinen Job „${JOB}“` }
  const basis = basisAusLog(gh(['api', `repos/{owner}/{repo}/actions/jobs/${job.databaseId}/logs`]), pr.headRefOid)
  if (basis === null) return { grund: `PR ${pr.number}: Basis nicht im Log von „${JOB}“ (Lauf ${lauf.databaseId}; läuft er noch, übersprungen?)` }
  return { basis }
}

/** Ablauf für einen PR; `gh(args)` und `warte(ms)` sind eingespeist, `melde` schreibt eine Zeile. Rückgabe: Exit-Code (siehe Kopf). */
export function nachrechnen(nummer, gh, melde, warte) {
  const pr = JSON.parse(gh(['pr', 'view', String(nummer), '--json', 'number,state,mergeable,headRefOid,headRefName']))
  const halt = hindernis(pr)
  if (halt !== null) {
    melde(halt)
    return 2
  }
  const { basis, grund } = basisDesLaufs(gh, pr)
  if (grund !== undefined) {
    melde(grund)
    return 2
  }
  const main = gh(['api', 'repos/{owner}/{repo}/git/ref/heads/main', '--jq', '.object.sha']).trim()
  if (basis === main) {
    melde(`PR ${nummer}: aktuell, die Kette rechnete gegen main ${kurz(main)}`)
    return 0
  }
  const urteil = datenpfadGrund(gh, nummer, basis, main)
  if (urteil.ausnahme !== undefined) {
    melde(`PR ${nummer}: aktuell, Kette gegen ${kurz(basis)}, main ist ${kurz(main)}, seitdem ${urteil.ausnahme}`)
    return 0
  }
  anstossen(gh, nummer, main, warte)
  melde(`PR ${nummer}: NICHT AKTUELL (Kette gegen ${kurz(basis)}, main ist ${kurz(main)}; ${urteil.grund}), geschlossen und wieder geöffnet; Kette abwarten, dann erneut aufrufen`)
  return 1
}

export function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 })
}

/** Wartet synchron (das Werkzeug ist durchgehend synchron); Rückgabe von Atomics.wait, nach Ablauf 'timed-out'. */
export function schlafe(ms) {
  return Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/** Startlogik: Argument prüfen, Fehler als Exit 2 (nie still grün). */
export function main(argv, ausfuehrer, melde, warte) {
  if (argv.length !== 1 || !/^\d+$/.test(argv[0])) {
    melde('Aufruf: node tools/pr-nachrechnen.mjs <PR-Nummer>')
    return 2
  }
  try {
    return nachrechnen(Number(argv[0]), ausfuehrer, melde, warte)
  } catch (e) {
    melde(`pr-nachrechnen: FEHLER ${e.message}`)
    return 2
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2), gh, (t) => console.log(t), schlafe))
}
