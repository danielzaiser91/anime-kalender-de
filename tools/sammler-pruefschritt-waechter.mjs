/**
 * Wächter (17.10.2026): Jeder Sammler, der einen Pull Request öffnet, prüft seinen Fund vorher mit `check:logic`.
 * Anlass: Ein Sammler-PR brachte zwei Sammlerdateien in Widerspruch (aniSearch 18892); erst der Bestandsbau merkte es, `main` war über sieben Stunden rot.
 *
 * Die Prüfung sitzt an einer Stelle: `tools/quellen-pr.sh` ruft `quellen_pruefen` (tools/quellen-pruefen.sh) vor `gh pr create`; rot heißt Marke „[Prüfung rot]“ und kein Merge.
 * Gemergt wird ein Daten-PR nur mit dem Token der App anime-kalender-daten (Ruleset `main-pruefweg`, Nachholer verlangt den App-Autor). Deshalb sichert der
 * Wächter strukturell zu, wer dieses Token sieht (`tools/app-token-sperre.mjs`), statt nach Befehlstexten zu suchen; dazu (geparstes YAML):
 *  1. Die Aktion `einreichen` führt `quellen-pr.sh` genau einmal aus.
 *  2. Kein Workflow setzt die Schalter der Prüfung (`QUELLEN_PRUEFBEFEHL`, `QUELLEN_PRUEFFRIST`) oder den App-Autor des Nachholers (`APP_AUTOR`).
 *  3. `quellen-pr.sh`: Prüfung vor dem Anlegen, Rot-Zweig vor dem Merge; die Prüfung fährt `check:logic -- --alle`.
 *  4. Die Marke „[Prüfung rot]“ steht in `quellen-pr.sh`, `daten-pr-mergen.sh` (samt Autorprüfung) und in jeder `gh pr list` von `claude-daten-merge.yml`.
 *  5. Die Fristen der Prüfung passen in jeden Job, der einreicht (`pruefeFristen`).
 * Aufruf: `node tools/sammler-pruefschritt-waechter.mjs` (steht in `check:logic`).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parse } from 'yaml'
import { pruefeAppToken, QUELLEN_PR_AKTION } from './app-token-sperre.mjs'

const MARKE = '[Prüfung rot]'
const EINREICHEN = '.github/actions/einreichen'
/* Was ein einreichender Job nach der Prüfung noch braucht (gemessen 17.10.2026, fund-nachliefern als knappster Job mit 20 min): Checkout, Einrichten und
 * Fund-Download ≤ 2 min, Mergebarkeit abwarten 60 s, Merge-Wiederholungen rund 210 s — zusammen etwa 370 s, mit Puffer 420 s. */
export const REST_SEKUNDEN = 420
/* Ohne `timeout-minutes` bricht GitHub einen Job nach 360 Minuten ab. */
const GITHUB_STANDARD_MINUTEN = 360

/** Alle Zeichenketten in einem geparsten Dokument (Schlüssel und Werte). */
function zeichenketten(wert, sammlung = []) {
  if (typeof wert === 'string') sammlung.push(wert)
  else if (wert && typeof wert === 'object') {
    for (const [k, v] of Object.entries(wert)) {
      sammlung.push(String(k))
      zeichenketten(v, sammlung)
    }
  }
  return sammlung
}

const schritteVon = (doc) => (doc?.runs?.steps ?? Object.values(doc?.jobs ?? {}).flatMap((j) => j.steps ?? []))
const usesAlsPfad = (u) => String(u ?? '').replace(/@.*$/, '').replace(/^\.\//, '').replace(/\/$/, '')
/* Schreibweisen vereinheitlichen: Zeilenfortsetzung mit Backslash und mehrfache Leerzeichen ändern nichts an der Bedeutung. */
const normal = (text) => String(text).replace(/\\\r?\n\s*/g, ' ').replace(/[ \t]+/g, ' ')
/** Kommentarzeilen (Shell, JS) ausblenden: Dort steht, was nicht ausgeführt wird. */
const ohneKommentare = (text) => normal(text).split('\n').filter((z) => !/^\s*(#|\/\/|\*|\/\*)/.test(z)).join('\n')

/** Weg 1: Die Aktion führt quellen-pr.sh genau einmal aus (Befehl exakt); kein anderer Schritt nennt es. */
function pruefeAktion(aktion) {
  const schritte = schritteVon(aktion)
  const erwartet = QUELLEN_PR_AKTION
  const aufrufe = schritte.filter((s) => typeof s.run === 'string' && s.run.trim() === erwartet)
  const fehler = []
  if (aufrufe.length !== 1) fehler.push(`Aktion einreichen: ${aufrufe.length} Aufrufe von \`${erwartet}\`, erwartet genau einer`)
  const fremd = schritte.filter((s) => !aufrufe.includes(s) && zeichenketten(s).some((t) => t.includes('quellen-pr')))
  for (const s of fremd) fehler.push(`Aktion einreichen: Schritt „${s.name ?? '?'}“ ruft quellen-pr.sh, nur der eine Aufruf darf es`)
  return fehler
}

/** Weg 2: Test-Schalter der Prüfung und der App-Autor des Nachholers tauchen in keinem Workflow und keiner Aktion auf. */
function pruefeSchalter(dokumente) {
  const fehler = []
  for (const [datei, doc] of Object.entries(dokumente)) {
    if (zeichenketten(doc).some((s) => /QUELLEN_PRUEF(BEFEHL|FRIST)|APP_AUTOR/.test(s)))
      fehler.push(`${datei}: setzt oder nennt einen Schalter der Sammler-Prüfung (QUELLEN_PRUEFBEFEHL, QUELLEN_PRUEFFRIST, APP_AUTOR)`)
  }
  return fehler
}

/** Weg 3: Reihenfolge in quellen-pr.sh und Befehl der Prüfung. */
function pruefeSkripte({ prSh, pruefenSh }) {
  const fehler = []
  const quelle = prSh.indexOf('source "$(dirname "${BASH_SOURCE[0]}")/quellen-pruefen.sh"')
  const aufruf = prSh.indexOf('quellen_pruefen)"')
  const anlegen = prSh.indexOf('PR="$(gh pr create')
  const mergen = prSh.indexOf('if gh pr merge')
  const rotZweig = prSh.indexOf('if [ "$PRUEF_ROT" = 1 ]; then\n  # Das Label')
  /* Bei i = 0 ist der Vergleich mit undefined falsch: die erste Stelle hat keinen Vorgänger. */
  const reihe = [quelle, aufruf, anlegen, rotZweig, mergen]
  if (reihe.some((stelle, i) => stelle < 0 || stelle < reihe[i - 1]))
    fehler.push('quellen-pr.sh: Reihenfolge muss sein: Prüfung laden, quellen_pruefen, gh pr create, Rot-Zweig, gh pr merge (jede Stelle vorhanden)')
  const code = ohneKommentare(prSh)
  const zahl = (muster) => (code.match(new RegExp(muster.source, 'g')) ?? []).length
  if (zahl(/\bgh\b[^\n]*?\bpr (create|new)\b/) !== 1) fehler.push('quellen-pr.sh: genau ein gh pr create erwartet (ein zweiter Weg zum PR umginge Prüfung und Marke)')
  if (zahl(/\bgh\b[^\n]*?\bpr merge\b/) !== 1) fehler.push('quellen-pr.sh: genau ein gh pr merge erwartet')
  if (!prSh.includes(`MARKE_ROT="${MARKE}"`)) fehler.push(`quellen-pr.sh: MARKE_ROT ist nicht "${MARKE}"`)
  if (!pruefenSh.includes('${QUELLEN_PRUEFBEFEHL:-npm run check:logic -- --alle}')) fehler.push('quellen-pruefen.sh: Standardbefehl ist nicht `npm run check:logic -- --alle`')
  return fehler
}

/** Weg 4: Wer sonst Daten-PRs mergt, überspringt die Marke und nimmt nur PRs der App. */
function pruefeMarke({ mergenSh, daten }) {
  const fehler = []
  if (!mergenSh.includes(`"${MARKE}"*`)) fehler.push('daten-pr-mergen.sh überspringt die Marke nicht')
  if (!mergenSh.includes('APP_AUTOR="${APP_AUTOR:-app/anime-kalender-daten}"') || !mergenSh.includes('[ "$autor" = "$APP_AUTOR" ] || {'))
    fehler.push('daten-pr-mergen.sh prüft den Autor nicht (nur PRs der App anime-kalender-daten): ohne das mergte der Nachholer auch ungeprüfte PRs')
  const lauf = zeichenketten(daten).filter((s) => s.includes('gh pr list'))
  const ohne = lauf.flatMap((s) => s.split('gh pr list').slice(1)).filter((teil) => !teil.split(/\n\s*gh |\n\s*echo /)[0].includes(`startswith("${MARKE}")`))
  if (lauf.length === 0) fehler.push('claude-daten-merge.yml: keine `gh pr list` gefunden — Erkennung kaputt?')
  for (const teil of ohne) fehler.push(`claude-daten-merge.yml: eine \`gh pr list\` filtert die Marke nicht heraus: ${teil.trim().slice(0, 80)}`)
  return fehler
}

/** Weg 5: Prüffrist und Vergleichsfrist (quellen-pruefen.sh) plus REST_SEKUNDEN passen in den Timeout jedes Jobs, der einreicht. */
export function pruefeFristen(workflows, pruefenSh) {
  const frist = (name) => Number(pruefenSh.match(new RegExp(`^${name}=(\\d+)$`, 'm'))?.[1])
  const pruefung = frist('QUELLEN_PRUEFFRIST_STANDARD') + frist('QUELLEN_BASISFRIST_STANDARD')
  if (!Number.isFinite(pruefung)) return ['quellen-pruefen.sh: QUELLEN_PRUEFFRIST_STANDARD und QUELLEN_BASISFRIST_STANDARD als Zahl erwartet']
  const fehler = []
  let einreicher = 0
  for (const [datei, doc] of Object.entries(workflows)) {
    for (const [id, job] of Object.entries(doc.jobs ?? {})) {
      const reicht = (job.steps ?? []).some((s) => usesAlsPfad(s.uses) === EINREICHEN || String(s.run ?? '').includes('quellen-pr.sh'))
      if (!reicht) continue
      einreicher++
      const sekunden = Number(job['timeout-minutes'] ?? GITHUB_STANDARD_MINUTEN) * 60
      if (!(sekunden - pruefung >= REST_SEKUNDEN))
        fehler.push(`${datei}: Job ${id} (timeout ${sekunden} s) lässt nach Prüfung und Vergleich (${pruefung} s) weniger als ${REST_SEKUNDEN} s für den Rest — Frist in quellen-pruefen.sh senken oder Timeout heben`)
    }
  }
  if (einreicher === 0) fehler.push('Wächter findet keinen Job, der einreicht — Erkennung kaputt?')
  return fehler
}

/** Eingabe: `workflows`, `aktionen` (Name → geparstes YAML), `skripte` (tools/*.sh: Name → Text). Ausgabe: Fehlertexte, leer = in Ordnung. */
export function pruefeSammler({ workflows, aktionen, skripte }) {
  return [
    ...pruefeAppToken({ workflows, aktionen }),
    ...pruefeAktion(aktionen.einreichen),
    ...pruefeSchalter({ ...workflows, ...aktionen }),
    ...pruefeSkripte({ prSh: skripte['quellen-pr.sh'], pruefenSh: skripte['quellen-pruefen.sh'] }),
    ...pruefeMarke({ mergenSh: skripte['daten-pr-mergen.sh'], daten: workflows['claude-daten-merge.yml'] }),
    ...pruefeFristen(workflows, skripte['quellen-pruefen.sh']),
  ]
}

/** Liest Workflows, Aktionen und Skripte aus einem Repo. */
export function ladeRepo(wurzel) {
  const lies = (pfad) => readFileSync(join(wurzel, pfad), 'utf8')
  const yamls = (ordner) => Object.fromEntries(readdirSync(join(wurzel, ordner)).filter((f) => /\.ya?ml$/.test(f)).map((f) => [f, parse(lies(`${ordner}/${f}`))]))
  const aktionen = Object.fromEntries(readdirSync(join(wurzel, '.github/actions')).map((a) => [a, parse(lies(`.github/actions/${a}/action.yml`))]))
  const skripte = Object.fromEntries(readdirSync(join(wurzel, 'tools')).filter((f) => f.endsWith('.sh')).map((f) => [f, lies(`tools/${f}`)]))
  return { workflows: yamls('.github/workflows'), aktionen, skripte }
}

/** Prüft das Repo unter `wurzel`, schreibt eine Ergebniszeile; Rückgabe ist der Exit-Code. */
export function main(wurzel = process.cwd()) {
  const repo = ladeRepo(wurzel)
  const fehler = pruefeSammler(repo)
  for (const f of fehler) console.error(`FEHL ${f}`)
  if (fehler.length) return 1
  console.log(`sammler-pruefschritt-waechter: ok (${Object.keys(repo.workflows).length} Workflows, App-Token nur in den Jobs aus tools/app-token-sperre.mjs)`)
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main())
