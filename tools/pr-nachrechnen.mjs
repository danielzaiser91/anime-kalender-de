/**
 * Rechnet die PR-Prüfkette eines PR nach, bevor er gemergt wird (19.10.2026, Befund Prüfer 1576; Ansatz 1597 R2).
 * Grund: Die Kette läuft auf `refs/pull/N/merge`, also gegen main zum Zeitpunkt ihres Starts. GitHub baut diesen Merge-Commit
 * nicht neu, wenn main weiterkommt (gemessen 19.10.2026: 1597 blieb über 30 min auf der alten Basis), ein grüner Check kann also
 * gegen einen main gerechnet sein, den es nicht mehr gibt. `gh run rerun` nutzt denselben Merge-Commit; erst `reopened` baut ihn neu,
 * und zwar nach dem Ereignis: dessen Lauf nimmt noch den alten Merge-Commit (gemessen 19.10.2026 an PR 1602), daher `anstossen`.
 *
 * Aufruf (Dirigent, vor jedem Merge): node tools/pr-nachrechnen.mjs <PR>
 *   Exit 3: ein offener PR trägt „ersetzt PR <PR>“ (`pr-ersetzt.mjs`), vor allen anderen Urteilen, auch bei gemergtem <PR>: nicht mergen.
 *   Exit 0: der neueste Kettenlauf zum Kopf rechnete gegen den jetzigen main-HEAD, oder main bewegte sich seit dem Lauf nur unter
 *           `public/data/` und `data/cache/` und der PR berührt diese Pfade nicht (F55, 20.10.2026; `datenpfadAusnahme`), oder alle
 *           Commits seitdem stammen von Daten-Bots und bewegen nur `data/`, und der PR liest keine Daten (Merge-Fluss C; `botSprungAusnahme`); bei einem reinen Bot-Datensprung (`reinerBotSprung`) genügt: der PR berührt keine bewegte Datei.
 *   Exit 1: nicht aktuell; der PR wurde geschlossen und wieder geöffnet, die Kette läuft neu (der Prüfer hört nicht auf `reopened`).
 *   Exit 2: nichts angestoßen (Konflikt, Mergebarkeit oder Test-Merge noch nicht berechnet, kein Lauf, Basis nicht lesbar, Fehler);
 *           die Meldung sagt, warum. Scheitert es erst nach dem Schließen, steht „SCHON ANGESTOSSEN“ in der Meldung.
 * Die Basis steht in der Checkout-Zeile des Jobs JOB: „HEAD is now at … Merge <Kopf> into <Basis>“ (Text des Merge-Commits von GitHub).
 */
import { LIMIT_STAPEL_MS, mitLimit } from './kind-mit-limit.mjs'
import { pathToFileURL } from 'node:url'
import { BOT_DATEIEN_OHNE_LESER, istBotBild, istBotDatei } from './pr-nachrechnen-bot-pfade.mjs'
import { gitAufruf, gitLeser } from './pr-nachrechnen-leser-git.mjs'
import { standardPaare, standardVoll } from './pr-nachrechnen-vergleich-git.mjs'
import { ZUG, istZugPr, leseZugAktiv } from './zug-aktiv.mjs'
import { istClaudeMd } from './pr-nachrechnen-leser.mjs'
import { erzeugteDatei } from './pr-nachrechnen-bot-erzeugt.mjs'
import { ersetzer, ersetztMeldung } from './pr-ersetzt.mjs'
import { grundKommentar, kommentiereGrund } from './nachrechnen-schleife.mjs'

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

/** Neuester Kettenlauf zum Kopf (gleicher Commit), sonst null. Abgebrochene Läufe (Concurrency ersetzt sie, oft ohne jeden Job) zählen nicht. */
export function neuesterLauf(laeufe, kopf) {
  const passend = laeufe.filter((l) => l.headSha === kopf && l.conclusion !== 'cancelled')
  return passend.reduce((neu, l) => (neu === null || Date.parse(l.createdAt) > Date.parse(neu.createdAt) ? l : neu), null)
}

/** Vor dem Lesen der Läufe: nur ein offener, konfliktfreier PR bekommt durch `reopened` eine neue Kette. */
export function hindernis(pr) {
  if (pr.state !== 'OPEN') return `PR ${pr.number} ist nicht offen (${pr.state})`
  if (pr.mergeable === 'CONFLICTING') return `PR ${pr.number} hat einen Konflikt mit main: erst main hineinmergen, das startet die Kette neu`
  if (pr.mergeable !== 'MERGEABLE') return `PR ${pr.number}: Mergebarkeit noch nicht berechnet (${pr.mergeable}), gleich erneut aufrufen`
  return null
}

/** Pfade, deren Bewegung auf main die Kette nicht entwertet (F55, Daniel 20.10.2026). Dazu die Bot-Dateien ohne Leser in der Kette (`pr-nachrechnen-bot-pfade.mjs`). Alles andere (Code, tools/umfang-grenzen.json, extension/, data/dub-confirmed.yaml, public/og/default.*) zählt. */
export const DATENPFADE = ['public/data/', 'data/cache/']
/** Compare liefert höchstens 300 Dateien; bei so vielen ist die Liste evtl. abgeschnitten, also keine Ausnahme. */
export const COMPARE_GRENZE = 300

export const istDatenpfad = (datei) => DATENPFADE.some((p) => datei.startsWith(p)) || istBotDatei(datei) || istBotBild(datei)

/**
 * Doku auf main, an deren Stand kein Kettenschritt hängt (Dirigent 26.10.2026, Anlass PR 2118): `docs/`, Markdown im Wurzelordner und
 * `daniel-zum-abarbeiten/00-wache.md` (nur `tools/wache-schreiben.mjs` schreibt sie). Andere Daniel-Dateien lesen Prüfungen
 * (`stand.md`, `listen/07-neu.md`, `listen/justwatch-widersprueche.md`, Test in `pr-nachrechnen-bot-pfade.test.mjs`), `data/patchnotes/` der Bau.
 * Ausgenommen von `docs/`: `design-regeln.md`, das `tools/design-kontrast.mjs` liest (Prüfer 2123 R1); `dokuLeser` im Bot-Pfade-Test sucht den nächsten Leser.
 */
const LIEST_KETTE = 'docs/wissen/design-regeln.md'
/** `.claude`-Markdown (Skills, Agenten, Regeln) steht nicht hier: nur ein Kettenleser, der den vollen Pfad nennt (`istClaudeMd`, `nennt`), macht es zum Grund; der bloße Name (`SKILL.md`) zählt nicht (Anlass PR 3272, 3117, 3241, 3343; Leser `pr-kettenlog-budget.test.mjs`, Prüfer 3413). */
const ohneKetteLeser = (datei) => (datei.startsWith('docs/') && datei !== LIEST_KETTE) || /^[^/]+\.md$/.test(datei) || datei === 'daniel-zum-abarbeiten/00-wache.md'

/**
 * Dateien auf main, die jeden PR entwerten, auch ohne Zusammenhang: sie legen fest, was die Kette prüft (Kettendefinition, Pakete, Wächter
 * unter tools/check-*, Grenzen, das von `design-kontrast` gelesene Dokument). Alles andere Fremde (Sammler-Workflows, Agenten-Texte,
 * Erweiterung, einzelne Werkzeuge, Ausführungslisten `tools/check-*-liste.txt`, einzelne Prüfungen und Tests unter pipeline/ und tools/) entwertet nur bei Zusammenhang
 * mit dem PR (`bewegtesGelesen`: Berührung, Nennung, Import in beide Richtungen). Anlass: Nacht-Merger, 15 Merges in 59 Läufen,
 * 148 Abweisungen „main bewegte …“ (Auswertung 09.11.2026).
 */
export const kettenweit = (datei) => datei === LIEST_KETTE || /^(\.github\/(workflows\/pr-pruefung\.yml|actions\/.+)|package(-lock)?\.json|tsconfig[^/]*\.json|eslint\.config\.[^/]+|tools\/(check-[^/]*\.(mjs|cjs|js|ts)|umfang-grenzen\.json))$/.test(datei)

const lokal = (vergleich) => (vergleich.lokalFehler === undefined ? '' : ` (lokales git: ${vergleich.lokalFehler})`)

/** null = Ausnahme gilt (main bewegte nur Datenpfade, der PR keinen); sonst der Grund, warum nicht. */
export function datenpfadAusnahme(vergleich, prDateien) {
  if (vergleich.status !== 'ahead') return `main ist gegenüber der Kettenbasis ${vergleich.status}, nicht nur vorgerückt`
  if (!vergleich.vollstaendig && vergleich.anzahl >= COMPARE_GRENZE) return `Vergleich mit ${vergleich.anzahl} Dateien evtl. abgeschnitten${lokal(vergleich)}`
  const fremd = vergleich.dateien.find((d) => !istDatenpfad(d) && !ohneKetteLeser(d))
  if (fremd !== undefined) return `main bewegte ${fremd}`
  const beruehrt = prDateien.find((p) => istDatenpfad(p) || vergleich.dateien.includes(p))
  if (beruehrt !== undefined) return `der PR berührt ${beruehrt}`
  return null
}

/**
 * Merge-Fluss C (23.10.2026): Ein Sprung nur unter `data/` entwertet keinen PR, dessen Code die bewegten Dateien nicht
 * liest (Leser-Regel `pr-nachrechnen-leser.mjs`, seit 26.10.2026; vorher galt jede Datei außer Doku als Leser); der Bestandsbau prüft
 * nach dem Merge den ganzen Datensatz. Der Autor zählt seit 27.10.2026 nicht mehr (PR 2165: Squash-Merge des Patchnotes-PR 2146
 * von Daniel entwertete einen Patchnotes-PR); entscheidend sind die bewegten Dateien: kettenweite Dateien (`kettenweit`) entwerten immer, alles andere nur mit Leser (seit 09.11.2026 auch Code und Workflows außerhalb der Kette). `liestBewegtes(bewegt, prDateien)` -> null | Grund. null = Ausnahme gilt, sonst der Grund.
 */
export function botSprungAusnahme(vergleich, prDateien, liestBewegtes) {
  if (vergleich.status !== 'ahead') return `main ist gegenüber der Kettenbasis ${vergleich.status}, nicht nur vorgerückt`
  if (!vergleich.vollstaendig && abgeschnitten(vergleich)) return `Vergleich evtl. abgeschnitten${lokal(vergleich)}`
  const beruehrt = prDateien.find((p) => vergleich.dateien.includes(p))
  if (reinerBotSprung(vergleich, prDateien)) return beruehrt === undefined ? null : `der PR berührt ${beruehrt}`
  const fremd = vergleich.dateien.find((d) => !istDatenpfad(d) && !ohneKetteLeser(d) && kettenweit(d))
  if (fremd !== undefined) return `main bewegte ${fremd}`
  if (beruehrt !== undefined) return `der PR berührt ${beruehrt}`
  return liestBewegtes(vergleich.dateien.filter((d) => !istDatenpfad(d) && !ohneKetteLeser(d)), prDateien)
}

/** Konten der Datenläufe und des Bestandsbaus (Sammler, Wache-Skripte); sie gelten nur für ihre erzeugten Dateien (`datenKontoDatei`). */
export const DATEN_KONTEN = ['anime-kalender-daten[bot]', 'github-actions[bot]', 'anime-kalender-bot']
/** Agenten-Konto: schreibt auch Handdaten, Code und Fix-PRs (Prüfer 3384, A1); gilt nur für Wache-Berichte und Doku. */
export const WACHE_KONTO = 'claude[bot]'
const wacheDatei = (datei) => ohneKetteLeser(datei) || istClaudeMd(datei) || datei === 'daniel-zum-abarbeiten/00-wache-auswertung.md'
/** Erzeugte Dateien der Läufe (Positivliste `pr-nachrechnen-bot-erzeugt.mjs`, fail-closed), Listen, Datenpfade der Kette-Ausnahme F55, Wache-Berichte. */
const erzeugt = (datei) => erzeugteDatei(datei) || datei.startsWith('daniel-zum-abarbeiten/listen/') || istDatenpfad(datei) || wacheDatei(datei)
/**
 * Vom Bot erzeugt: Bestandsbau (`extension/offene-*.js`) und Versionszähler (`extension/manifest.json`). Bewusste Grenze (A3): Erweiterungstests
 * lesen diese Dateien; berührt der PR `extension/` oder `tools/extension-*`, zählen sie nicht, und die Leser-Regel entscheidet. Ein Test außerhalb
 * dieser Pfade, der sie liest, fällt nicht auf (Grenze, wie bei der Leser-Regel zur Laufzeit zusammengesetzte Pfade).
 */
const ERZEUGT_ERWEITERUNG = /^extension\/(offene-[^/]+\.js|manifest\.json)$/
const beruehrtErweiterung = (datei) => datei.startsWith('extension/') || datei.startsWith('tools/extension-')
const erlaubt = (autor, datei, erweiterungFrei) => (autor === WACHE_KONTO ? wacheDatei(datei) : DATEN_KONTEN.includes(autor) && (erzeugt(datei) || (erweiterungFrei && ERZEUGT_ERWEITERUNG.test(datei))))

/**
 * Reiner Bot-Datensprung (10.11.2026, Nachrechnen-Deadlock: main bekommt alle ~10 min einen Bot-Commit, die Kette braucht 25-30 min, kein PR
 * wurde je „aktuell“). Die Ausnahme gilt je Konto und Pfadklasse (Prüfer 3384, A1/A2): ein Datenkonto nur für erzeugte Dateien, `claude[bot]`
 * nur für Wache-Berichte und Doku; alles, was nicht auf den Listen steht, gilt als Änderung von Hand. Mit `vergleich.commits` (je Commit Autor
 * und Dateien) wird je Commit geprüft; ohne sie nur, wenn kein `claude[bot]` dabei ist (sonst ließe sich ein Handdatenfix nicht von einem Wache-Bericht
 * trennen). Dann entwertet nur die Berührung derselben Datei, auch ohne Leser-Regel (Entscheidung Dirigent, betrieb.md): der Bestandsbau prüft nach dem Merge
 * den ganzen Datensatz, Sammler-PRs haben seit PR 3282 einen Probebau. Nur auf vollständigem Vergleich aufrufen (Autoren und Dateien lückenlos).
 */
export function reinerBotSprung(vergleich, prDateien) {
  if (vergleich.autoren.length === 0 || vergleich.dateien.length === 0) return false
  if (!vergleich.autoren.every((a) => a === WACHE_KONTO || DATEN_KONTEN.includes(a))) return false
  const frei = !prDateien.some(beruehrtErweiterung)
  if (vergleich.commits !== undefined) return vergleich.commits.every((c) => c.dateien.every((d) => erlaubt(c.autor, d, frei)))
  if (vergleich.autoren.includes(WACHE_KONTO)) return false
  return vergleich.dateien.every((d) => erlaubt(DATEN_KONTEN[0], d, frei))
}

const abgeschnitten = (v) => v.anzahl >= COMPARE_GRENZE || v.commitsGesamt !== v.autoren.length

/** Ersetzt einen abgeschnittenen API-Vergleich durch den lokalen; scheitert git, bleibt er abgeschnitten (mit Grund). */
function vervollstaendige(vergleich, basis, main, voll) {
  if (vergleich.status !== 'ahead' || !abgeschnitten(vergleich)) return vergleich
  const r = voll(basis, main)
  if (r.fehler !== undefined) return { ...vergleich, lokalFehler: r.fehler }
  return { ...vergleich, ...r, vollstaendig: true }
}

/** Hängt je Commit Autor und Dateien an, wenn `claude[bot]` im Sprung ist (nur dann entscheidet die Paarung); scheitert git, bleibt es ohne (fail-closed). */
function mitCommits(vergleich, basis, main, paare) {
  if (vergleich.status !== 'ahead' || !vergleich.autoren.includes(WACHE_KONTO)) return vergleich
  const r = paare(basis, main)
  return r.fehler === undefined ? { ...vergleich, commits: r.commits } : vergleich
}

/** Rückgabe { ausnahme } (Kette gilt weiter, Text für die Meldung) oder { grund }. */
export function datenpfadGrund(gh, pr, basis, main, leser, voll, paare) {
  const api = JSON.parse(gh(['api', `repos/{owner}/{repo}/compare/${basis}...${main}`, '--jq', '{status, anzahl: (.files | length), dateien: [.files[] | .filename, (.previous_filename // empty)], commitsGesamt: .total_commits, autoren: [.commits[] | .author.login // .commit.author.name]}']))
  const vergleich = mitCommits(vervollstaendige(api, basis, main, voll), basis, main, paare)
  const prDateien = gh(['api', `repos/{owner}/{repo}/pulls/${pr.number}/files`, '--paginate', '--jq', '.[] | .filename, (.previous_filename // empty)']).split(/\r?\n/).filter(Boolean)
  const daten = datenpfadAusnahme(vergleich, prDateien)
  if (daten === null) return { ausnahme: `nur Daten bewegt (${DATENPFADE.join(', ')}, ${BOT_DATEIEN_OHNE_LESER.length} Bot-Dateien ohne Leser)` }
  const bot = botSprungAusnahme(vergleich, prDateien, (bewegt, dateien) => leser(bewegt, dateien, { nummer: pr.number, kopf: pr.headRefOid, main }))
  if (bot === null && reinerBotSprung(vergleich, prDateien)) return { ausnahme: 'nur Bot-Daten bewegt (erzeugte Dateien der Läufe, Listen, Wache-Berichte), der PR berührt keine davon' }
  if (bot === null) return { ausnahme: 'nur Fremdes ohne Zusammenhang bewegt (Daten, Sammler, Werkzeuge außerhalb der Kette), kein Code des PR liest die bewegten Dateien' }
  return { grund: daten === bot ? daten : `${daten}; ${bot}` }
}

const kurz = (sha) => sha.slice(0, 9)

/** Felder von `pr view`; `baseRefName` nur bei gelegtem Zug-Schalter, damit der Aufruf mit Schalter aus byte-gleich bleibt. */
const prFelder = (zugAktiv) => `number,state,mergeable,headRefOid,headRefName${zugAktiv ? ',baseRefName' : ''}`

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

/** Grund, wenn JOB in der Jobliste fehlt: ein laufender Lauf legt Jobs nach, ein abgeschlossener zeigt Status und vorhandene Jobs. */
export function jobFehlt(nummer, lauf, jobs) {
  if (lauf.status !== 'completed') return `PR ${nummer}: Lauf ${lauf.databaseId} (${lauf.status}) hat den Job „${JOB}“ noch nicht angelegt; später erneut aufrufen`
  const namen = jobs.map((j) => j.name).join(', ')
  return `PR ${nummer}: Lauf ${lauf.databaseId} (abgeschlossen, ${lauf.conclusion || 'ohne Ergebnis'}) hat keinen Job „${JOB}“; vorhanden: ${namen}`
}

/** Liest Basis des neuesten Kettenlaufs; Rückgabe { basis } oder { grund } (dann ist nichts zu entscheiden). */
function basisDesLaufs(gh, pr) {
  const laeufe = JSON.parse(gh(['run', 'list', '--workflow', KETTE, '--event', 'pull_request', '--branch', pr.headRefName, '--limit', '20', '--json', 'databaseId,headSha,createdAt,conclusion,status']))
  const lauf = neuesterLauf(laeufe, pr.headRefOid)
  if (lauf === null) return { grund: `PR ${pr.number}: kein Kettenlauf zum Kopf ${kurz(pr.headRefOid)}` }
  const jobs = JSON.parse(gh(['run', 'view', String(lauf.databaseId), '--json', 'jobs'])).jobs
  if (jobs.length === 0) return { grund: `PR ${pr.number}: Lauf ${lauf.databaseId} hat noch keine Jobs angelegt; später erneut aufrufen` }
  const job = jobs.find((j) => j.name === JOB)
  if (job === undefined) return { grund: jobFehlt(pr.number, lauf, jobs) }
  if (job.status !== 'completed') return { grund: `PR ${pr.number}: Job „${JOB}“ läuft noch (Lauf ${lauf.databaseId}), sein Log gibt es erst nach Abschluss; später erneut aufrufen` }
  const basis = basisAusLog(gh(['api', '--allow-escape-sequences', `repos/{owner}/{repo}/actions/jobs/${job.databaseId}/logs`]), pr.headRefOid)
  if (basis === null) return { grund: `PR ${pr.number}: Basis nicht im Log von „${JOB}“ (Lauf ${lauf.databaseId}; läuft er noch, übersprungen?)` }
  return { basis }
}

/** Ablauf für einen PR; `gh(args)` und `warte(ms)` sind eingespeist, `melde` schreibt eine Zeile. Rückgabe: Exit-Code (siehe Kopf). */
export function nachrechnen(nummer, gh, melde, warte, leser = gitLeser(gitAufruf), voll = standardVoll, paare = standardPaare, zugAktiv = leseZugAktiv()) {
  const pr = JSON.parse(gh(['pr', 'view', String(nummer), '--json', prFelder(zugAktiv)]))
  const ersatz = ersetzer(nummer, gh)
  if (ersatz !== null) {
    melde(ersetztMeldung(nummer, ersatz))
    return 3
  }
  const halt = hindernis(pr)
  if (halt !== null) {
    melde(halt)
    return 2
  }
  if (istZugPr(pr, zugAktiv)) {
    melde(`PR ${nummer}: Basis ${ZUG}, kein Nachrechnen gegen main (die Fahrt rechnet den ganzen Zug)`)
    return 0
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
  const urteil = datenpfadGrund(gh, pr, basis, main, leser, voll, paare)
  if (urteil.ausnahme !== undefined) {
    melde(`PR ${nummer}: aktuell, Kette gegen ${kurz(basis)}, main ist ${kurz(main)}, seitdem ${urteil.ausnahme}`)
    return 0
  }
  anstossen(gh, nummer, main, warte)
  kommentiereGrund(gh, melde, nummer, grundKommentar(kurz(basis), kurz(main), urteil.grund))
  melde(`PR ${nummer}: NICHT AKTUELL (Kette gegen ${kurz(basis)}, main ist ${kurz(main)}; ${urteil.grund}), geschlossen und wieder geöffnet; Kette abwarten, dann erneut aufrufen`)
  return 1
}

export function gh(args) {
  // Gemessen 30.10.2026 (3 Läufe): Job-Log 154 kB 1,2-1,4 s, Listen 0,8-0,9 s; Stapel-Limit 30 s deckt lange Logs.
  return mitLimit('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }, { limitMs: LIMIT_STAPEL_MS })
}

/** Wartet synchron (das Werkzeug ist durchgehend synchron); Rückgabe von Atomics.wait, nach Ablauf 'timed-out'. */
export function schlafe(ms) {
  return Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/** Startlogik: Argument prüfen, Fehler als Exit 2 (nie still grün). */
export function main(argv, ausfuehrer, melde, warte, leser, voll, paare) {
  if (argv.length !== 1 || !/^\d+$/.test(argv[0])) {
    melde('Aufruf: node tools/pr-nachrechnen.mjs <PR-Nummer>')
    return 2
  }
  try {
    return nachrechnen(Number(argv[0]), ausfuehrer, melde, warte, leser, voll, paare)
  } catch (e) {
    melde(`pr-nachrechnen: FEHLER ${e.message}`)
    return 2
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2), gh, (t) => console.log(t), schlafe))
}
