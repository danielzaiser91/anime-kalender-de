/**
 * Letzte Prüfung vor dem Merge (19.10.2026, seit 21.11.2026 ohne Nachzug): Ist der PR offen, mergebar und frei?
 * Eine Bewegung auf main erzwingt keinen neuen Kettenlauf mehr (Daniel 21.11.2026; Messung 90 Nachzüge in 14 Tagen, 4 echte Funde,
 * alle Mängel von main selbst; Freigabe bis Merge im Median 33 min mit Nachzug, 3 min ohne). Die Kette am Kopf sichert das Ruleset
 * `main-pruefweg` (Pflicht-Check „PR-Prüfkette“, strict aus); was erst im Zusammenspiel mit dem neuen main bricht, fängt der Nachlauf
 * auf main (`.github/workflows/main-nachlauf.yml`, ALARM in `tools/laeufe-aufraeumen.mjs --trocken`).
 *
 * Aufruf (Dirigent, vor jedem Merge): node tools/pr-nachrechnen.mjs [--trocken] <PR>
 *   Exit 4: der letzte Prüfer-Kommentar verlangt „ändern“, danach kam kein Commit (`pr-nachrechnen-pruefer.mjs`): nicht mergen.
 *   Exit 3: ein offener PR trägt „ersetzt PR <PR>“ (`pr-ersetzt.mjs`), vor allen anderen Urteilen, auch bei gemergtem <PR>: nicht mergen.
 *   Exit 2: nicht offen, Konflikt mit main („erst main hineinmergen“, GitHub `mergeable` CONFLICTING), Mergebarkeit noch nicht
 *           berechnet (UNKNOWN, gleich erneut aufrufen) oder Fehler; die Meldung sagt, warum. Nichts angestoßen.
 *   Exit 0: mergebar; main darf seit dem Kettenlauf weitergekommen sein. `--trocken` ändert nichts (das Werkzeug schreibt nie).
 *   Exit 1: kommt hier nicht mehr vor (früher „nicht aktuell, Kette neu angestoßen“); die Merge-Zeile `… && gh pr merge` bleibt gleich.
 *
 * `nachziehen` (nur `tools/basis-gemergt-neustart.mjs`, Stapel-PRs nach dem Merge ihrer Basis): deren Kette war rot, weil die Basis offen
 * war (`pr-pruefer-basis-offen.mjs`); sie holt main per `update-branch` in den Zweig (Exit 1, neuer Kopf), bei 4xx Schließen/Öffnen.
 */
import { LIMIT_STAPEL_MS, mitLimit } from './kind-mit-limit.mjs'
import { pathToFileURL } from 'node:url'
import { istBotBild, istBotDatei } from './pr-nachrechnen-bot-pfade.mjs'
import { ZUG, istZugPr, leseZugAktiv } from './zug-aktiv.mjs'
import { ersetzer, ersetztMeldung } from './pr-ersetzt.mjs'
import { prueferSperre } from './pr-nachrechnen-pruefer.mjs'
import { aktualisiereZweig } from './pr-nachrechnen-zweig.mjs'

const OEFFNEN_VERSUCHE = 3
/** Warten auf den neu gerechneten Merge-Commit nach dem ersten Wiederöffnen (gemessen 19.10.2026: nach wenigen Sekunden da). */
export const REF_PRUEFUNGEN = 30
export const REF_ABSTAND_MS = 2000

/** Vor jedem Urteil: nur ein offener, konfliktfreier PR mit berechneter Mergebarkeit ist mergebar. */
export function hindernis(pr) {
  if (pr.state !== 'OPEN') return `PR ${pr.number} ist nicht offen (${pr.state})`
  if (pr.mergeable === 'CONFLICTING') return `PR ${pr.number} hat einen Konflikt mit main: erst main hineinmergen, das startet die Kette neu`
  if (pr.mergeable !== 'MERGEABLE') return `PR ${pr.number}: Mergebarkeit noch nicht berechnet (${pr.mergeable}), gleich erneut aufrufen`
  return null
}

/** Erzeugte Datenpfade der Läufe (F55, 20.10.2026) samt Bot-Dateien ohne Leser (`pr-nachrechnen-bot-pfade.mjs`); Leser: logik-beleg, neuversuch-art, workflows-beleg, main-nachlauf. */
export const DATENPFADE = ['public/data/', 'data/cache/']
export const istDatenpfad = (datei) => DATENPFADE.some((p) => datei.startsWith(p)) || istBotDatei(datei) || istBotBild(datei)

const kurz = (sha) => sha.slice(0, 9)

/** Felder von `pr view`; `baseRefName` nur bei gelegtem Zug-Schalter, damit der Aufruf mit Schalter aus byte-gleich bleibt. */
const prFelder = (zugAktiv) => `number,state,mergeable,headRefOid,headRefName,comments,commits${zugAktiv ? ',baseRefName' : ''}`

/** Gemeinsame Vorprüfung: { exit } (fertig, Meldung geschrieben) oder { pr } (mergebar, weiter). */
function vorpruefung(nummer, gh, melde, zugAktiv) {
  const pr = JSON.parse(gh(['pr', 'view', String(nummer), '--json', prFelder(zugAktiv)]))
  const ersatz = ersetzer(nummer, gh)
  if (ersatz !== null) {
    melde(ersetztMeldung(nummer, ersatz))
    return { exit: 3 }
  }
  const halt = hindernis(pr)
  if (halt !== null) {
    melde(halt)
    return { exit: 2 }
  }
  const prueferHalt = prueferSperre(pr.comments, pr.commits)
  if (prueferHalt !== null) {
    melde(`PR ${nummer}: ${prueferHalt}`)
    return { exit: 4 }
  }
  if (istZugPr(pr, zugAktiv)) {
    melde(`PR ${nummer}: Basis ${ZUG}, kein Nachrechnen gegen main (die Fahrt rechnet den ganzen Zug)`)
    return { exit: 0 }
  }
  return { pr }
}

/** Ablauf für einen PR; `gh(args)` ist eingespeist, `melde` schreibt eine Zeile. Rückgabe: Exit-Code (siehe Kopf). Liest nur, schreibt nie. */
export function nachrechnen(nummer, gh, melde, zugAktiv = leseZugAktiv()) {
  const { exit, pr } = vorpruefung(nummer, gh, melde, zugAktiv)
  if (exit !== undefined) return exit
  melde(`PR ${nummer}: mergebar, kein Konflikt mit main (Kopf ${kurz(pr.headRefOid)}); eine Bewegung auf main erzwingt keinen Nachzug, der Nachlauf auf main prüft das Zusammenspiel`)
  return 0
}

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
  try {
    gh(['pr', 'close', String(nummer)])
  } catch (e) {
    // Zeitlimit („FEHLER: …“): GitHub kann das Schließen trotzdem angenommen haben, der PR ist dann zu.
    if (String(e.message).startsWith('FEHLER:')) begonnen()
    throw e
  }
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
 * Startet die Kette gegen den neuen main (Rückfall, wenn update-branch abgewiesen wurde). Der Lauf zu `reopened` nimmt den Merge-Commit,
 * der beim Öffnen galt; ist der veraltet, öffnet das erste Wiederöffnen nur, damit GitHub ihn neu rechnet, das zweite startet die Kette.
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

/** Stapel-PR nach dem Merge seiner Basis: Vorprüfung wie `nachrechnen`, dann main in den Zweig holen (Exit 1); `trocken` schreibt nichts. */
export function nachziehen(nummer, gh, melde, warte, trocken = false, zugAktiv = leseZugAktiv()) {
  const { exit, pr } = vorpruefung(nummer, gh, melde, zugAktiv)
  if (exit !== undefined) return exit
  if (trocken) {
    melde(`PR ${nummer}: Kette würde nachgezogen (main in den Zweig), Trockenlauf: nichts geschlossen, geöffnet oder aktualisiert`)
    return 1
  }
  const neuerKopf = aktualisiereZweig(gh, nummer, pr.headRefOid, warte, melde)
  if (neuerKopf !== null) {
    melde(`PR ${nummer}: main per update-branch in den Zweig geholt; neuer Kopf ${neuerKopf}: Kette abwarten`)
    return 1
  }
  const main = gh(['api', 'repos/{owner}/{repo}/git/ref/heads/main', '--jq', '.object.sha']).trim()
  anstossen(gh, nummer, main, warte)
  melde(`PR ${nummer}: geschlossen und wieder geöffnet; Kette abwarten`)
  return 1
}

export function gh(args) {
  return mitLimit('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }, { limitMs: LIMIT_STAPEL_MS })
}

/** Wartet synchron (das Werkzeug ist durchgehend synchron); Rückgabe von Atomics.wait, nach Ablauf 'timed-out'. */
export function schlafe(ms) {
  return Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/** Argumente `[--trocken] <PR>` und Fehler als Exit 2 (nie still grün); `ablauf(nummer, trocken)` liefert den Exit-Code. */
function mitArgumenten(argv, melde, ablauf) {
  const trocken = argv.includes('--trocken')
  const args = argv.filter((a) => a !== '--trocken')
  if (args.length !== 1 || !/^\d+$/.test(args[0])) {
    melde('Aufruf: node tools/pr-nachrechnen.mjs [--trocken] <PR-Nummer>')
    return 2
  }
  try {
    return ablauf(Number(args[0]), trocken)
  } catch (e) {
    melde(`pr-nachrechnen: FEHLER ${e.message}`)
    return 2
  }
}

/** Startlogik des Werkzeugs (Dirigent, Merge-Riegel, Nacht-Merger). */
export const main = (argv, ausfuehrer, melde) => mitArgumenten(argv, melde, (nummer) => nachrechnen(nummer, ausfuehrer, melde))

/** Startlogik für Stapel-PRs (`basis-gemergt-neustart.mjs`). */
export const nachziehenMain = (argv, ausfuehrer, melde, warte) => mitArgumenten(argv, melde, (nummer, trocken) => nachziehen(nummer, ausfuehrer, melde, warte, trocken))

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2), gh, (t) => console.log(t)))
}
