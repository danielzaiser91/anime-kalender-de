/**
 * Wächter (17.10.2026): Jeder Sammler, der einen Pull Request öffnet, prüft seinen Fund vorher mit `check:logic`.
 * Anlass: Ein Sammler-PR brachte zwei Sammlerdateien in Widerspruch (aniSearch 18892); erst der Bestandsbau merkte es, `main` war über sieben Stunden rot.
 *
 * Die Prüfung sitzt an einer Stelle: `tools/quellen-pr.sh` ruft `quellen_pruefen` (tools/quellen-pruefen.sh) vor `gh pr create`; rot heißt Marke „[Prüfung rot]“ und kein Merge.
 * Der Wächter sichert zu, dass alle Wege zu einem Pull Request über diese Stelle laufen (geparstes YAML, kein Text-Regex auf Workflows):
 *  1. Jeder Schritt, der PRs öffnet, ist die Aktion `.github/actions/einreichen` oder ruft `tools/quellen-pr.sh`; ein eigener Weg (`gh pr create`) ist nur auf der Liste unten erlaubt.
 *  2. Die Aktion `einreichen` führt `quellen-pr.sh` genau einmal aus und öffnet selbst nichts.
 *  3. Kein Workflow setzt die Test-Schalter der Prüfung (`QUELLEN_PRUEFBEFEHL`, `QUELLEN_PRUEFFRIST`): Sie würde sonst abgeschaltet.
 *  4. `quellen-pr.sh`: Prüfung vor dem Anlegen, Rot-Zweig vor dem Merge; die Prüfung fährt `check:logic -- --alle`.
 *  5. Die Marke „[Prüfung rot]“ steht in `quellen-pr.sh`, `daten-pr-mergen.sh` und in jeder `gh pr list` von `claude-daten-merge.yml`: Ein roter Fund wird nie von einem Nachholer gemergt.
 * Aufruf: `node tools/sammler-pruefschritt-waechter.mjs` (steht in `check:logic`).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'

const MARKE = '[Prüfung rot]'
const EINREICHEN = '.github/actions/einreichen'
/** Eigene Wege zu einem Pull Request: kein Sammler, die normale Prüfkette (pr-pruefung.yml) läuft im PR. */
const EIGENE_WEGE = { workflows: ['claude-auftrag.yml'], skripte: ['quellen-pr.sh', 'pr-einreichen.sh'] }

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
const OEFFNET_PR = /gh pr create|\/pulls['"\s]|pulls\.create/

/** Wege 1: Schritte aller Workflows nach Art sortieren; Fehler für eigene, nicht erlaubte Wege. */
function pruefeWege(workflows) {
  const fehler = []
  let ueberAktion = 0
  let ueberSkript = 0
  for (const [datei, doc] of Object.entries(workflows)) {
    for (const schritt of schritteVon(doc)) {
      if (usesAlsPfad(schritt.uses) === EINREICHEN) ueberAktion++
      else if (typeof schritt.run === 'string' && schritt.run.includes('quellen-pr.sh')) ueberSkript++
      else if (zeichenketten(schritt).some((s) => OEFFNET_PR.test(s)) && !EIGENE_WEGE.workflows.includes(datei))
        fehler.push(`${datei}: öffnet einen Pull Request auf eigenem Weg („${schritt.name ?? '?'}“) — über die Aktion einreichen oder tools/quellen-pr.sh, dort steckt die Datenprüfung`)
    }
  }
  if (ueberAktion === 0) fehler.push('Wächter findet keinen Workflow, der die Aktion einreichen benutzt — Erkennung kaputt?')
  if (ueberSkript === 0) fehler.push('Wächter findet keinen Workflow, der tools/quellen-pr.sh direkt aufruft — Erkennung kaputt?')
  return fehler
}

/** Weg 2: Die Aktion führt quellen-pr.sh genau einmal aus (Befehl exakt) und sonst nichts, was PRs öffnet. */
function pruefeAktion(aktion) {
  const schritte = schritteVon(aktion)
  const erwartet = 'bash tools/quellen-pr.sh "${{ inputs.nachricht }}"'
  const aufrufe = schritte.filter((s) => typeof s.run === 'string' && s.run.trim() === erwartet)
  const fehler = []
  if (aufrufe.length !== 1) fehler.push(`Aktion einreichen: ${aufrufe.length} Aufrufe von \`${erwartet}\`, erwartet genau einer`)
  const fremd = schritte.filter((s) => !aufrufe.includes(s) && zeichenketten(s).some((t) => OEFFNET_PR.test(t) || t.includes('quellen-pr')))
  for (const s of fremd) fehler.push(`Aktion einreichen: Schritt „${s.name ?? '?'}“ öffnet oder ruft PRs auf, nur der Aufruf von quellen-pr.sh darf es`)
  return fehler
}

/** Weg 3: Test-Schalter der Prüfung tauchen in keinem Workflow und keiner Aktion auf. */
function pruefeSchalter(dokumente) {
  const fehler = []
  for (const [datei, doc] of Object.entries(dokumente)) {
    if (zeichenketten(doc).some((s) => /QUELLEN_PRUEF(BEFEHL|FRIST)/.test(s))) fehler.push(`${datei}: setzt oder nennt einen Test-Schalter der Sammler-Prüfung (QUELLEN_PRUEFBEFEHL, QUELLEN_PRUEFFRIST)`)
  }
  return fehler
}

/** Weg 4: Reihenfolge in quellen-pr.sh und Befehl der Prüfung. */
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
  if (!prSh.includes(`MARKE_ROT="${MARKE}"`)) fehler.push(`quellen-pr.sh: MARKE_ROT ist nicht "${MARKE}"`)
  if (!pruefenSh.includes('${QUELLEN_PRUEFBEFEHL:-npm run check:logic -- --alle}')) fehler.push('quellen-pruefen.sh: Standardbefehl ist nicht `npm run check:logic -- --alle`')
  return fehler
}

/** Weg 5: Wer sonst Daten-PRs mergt, überspringt die Marke. */
function pruefeMarke({ mergenSh, daten }) {
  const fehler = []
  if (!mergenSh.includes(`"${MARKE}"*`)) fehler.push('daten-pr-mergen.sh überspringt die Marke nicht')
  const lauf = zeichenketten(daten).filter((s) => s.includes('gh pr list'))
  const ohne = lauf.flatMap((s) => s.split('gh pr list').slice(1)).filter((teil) => !teil.split(/\n\s*gh |\n\s*echo /)[0].includes(`startswith("${MARKE}")`))
  if (lauf.length === 0) fehler.push('claude-daten-merge.yml: keine `gh pr list` gefunden — Erkennung kaputt?')
  for (const teil of ohne) fehler.push(`claude-daten-merge.yml: eine \`gh pr list\` filtert die Marke nicht heraus: ${teil.trim().slice(0, 80)}`)
  return fehler
}

/** Eigene Wege in Skripten unter tools/: nur die Liste darf PRs öffnen. */
function pruefeSkriptWege(skripte) {
  return Object.entries(skripte)
    .filter(([name, text]) => OEFFNET_PR.test(text) && !EIGENE_WEGE.skripte.includes(name))
    .map(([name]) => `tools/${name}: öffnet einen Pull Request auf eigenem Weg — über tools/quellen-pr.sh, dort steckt die Datenprüfung`)
}

/** Eingabe: `workflows`, `aktionen` (Name → geparstes YAML), `skripte` (tools/*.sh: Name → Text). Ausgabe: Fehlertexte, leer = in Ordnung. */
export function pruefeSammler({ workflows, aktionen, skripte }) {
  return [
    ...pruefeWege(workflows),
    ...pruefeAktion(aktionen.einreichen),
    ...pruefeSchalter({ ...workflows, ...aktionen }),
    ...pruefeSkripte({ prSh: skripte['quellen-pr.sh'], pruefenSh: skripte['quellen-pruefen.sh'] }),
    ...pruefeMarke({ mergenSh: skripte['daten-pr-mergen.sh'], daten: workflows['claude-daten-merge.yml'] }),
    ...pruefeSkriptWege(skripte),
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

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/').split('/').pop())) {
  const fehler = pruefeSammler(ladeRepo(process.cwd()))
  for (const f of fehler) console.error(`FEHL ${f}`)
  if (fehler.length) process.exit(1)
  console.log('sammler-pruefschritt-waechter: ok')
}
