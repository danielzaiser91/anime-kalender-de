#!/usr/bin/env node
/**
 * Roter Bestandsbau durch einen Sammler-Commit: dessen Dateien auf den Stand des letzten grünen Baus zurücksetzen,
 * neu bauen und bei Grün als eigenen Commit ausliefern (Anlass 31.10.2026: Sammler-Commit 1f15f63b machte main
 * 12 Stunden rot; `bau_lauf_zuruecknehmen` in commit-data.sh nimmt nur die Ausgabe des eigenen Laufs zurück, nie einen
 * schon gepushten Commit). Nur Node-Bordmittel: der Workflow ruft das Werkzeug nach `npm ci` auf, aber ohne weitere Pakete.
 *
 * Aufruf: node tools/sammler-zuruecknehmen.mjs --basis <sha des letzten grünen Baus>
 * Umgebung: SZN_BAU (Standard `npm run data:build`), SZN_COMMIT (Standard `bash tools/commit-data.sh "$SZN_NACHRICHT"`).
 * Exit 0 immer, außer bei Aufruffehlern: der Lauf ist durch den früheren Fehlschlag ohnehin rot.
 */
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const SAMMLER = 'anime-kalender-daten[bot]'
// Nur Eingabedaten, die ein Sammler liefert; Cache und Erzeugnisse nie.
const gueltigerPfad = (p) => p.startsWith('data/') && !p.startsWith('data/cache/')

const RUECKNAHME_BETREFF = 'chore(data): Sammler-Stand zurückgenommen'
const BAU_BOT = 'github-actions[bot]'

/** Ein früherer Rücknahme-Commit dieses Werkzeugs: seine Dateien sind kein Zeichen fremder Arbeit. */
export const istRuecknahme = (c) => c.autor === BAU_BOT && typeof c.betreff === 'string' && c.betreff.startsWith(RUECKNAHME_BETREFF)

/**
 * Dateien, die in der Spanne nur von Sammler-Commits geändert wurden (sonst ginge fremde Arbeit verloren).
 * Jede nicht gewählte Datei steht mit ihrem Grund in der Antwort: `fremd` (anderer Autor außer Rücknahme), `keinDatenpfad`.
 */
export function sammlerAuswahl(commits) {
  const sammler = new Set()
  const fremd = new Set()
  let ruecknahmen = 0
  for (const c of commits) {
    if (istRuecknahme(c)) {
      ruecknahmen++
      continue
    }
    for (const d of c.dateien) (c.autor === SAMMLER ? sammler : fremd).add(d)
  }
  return {
    dateien: [...sammler].filter((d) => gueltigerPfad(d) && !fremd.has(d)).sort(),
    fremd: [...sammler].filter((d) => gueltigerPfad(d) && fremd.has(d)).sort(),
    keinDatenpfad: [...sammler].filter((d) => !gueltigerPfad(d)).sort(),
    ruecknahmen,
  }
}

export const sammlerDateien = (commits) => sammlerAuswahl(commits).dateien

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] })

export function commitsSeit(cwd, basis) {
  const kopf = git(cwd, ['log', '--format=%H%x09%an%x09%s', `${basis}..HEAD`]).split('\n').filter(Boolean)
  return kopf.map((zeile) => {
    const [sha, autor, betreff] = zeile.split('\t')
    const dateien = git(cwd, ['show', '--name-only', '--format=', '--no-renames', sha]).split('\n').filter(Boolean)
    return { sha, autor, betreff, dateien }
  })
}

const gibtEs = (cwd, ref, datei) => {
  try { git(cwd, ['cat-file', '-e', `${ref}:${datei}`]); return true } catch { return false }
}

/** Datei auf den Stand von `ref` bringen; fehlt sie dort, wird sie entfernt. */
function stelleHer(cwd, ref, datei) {
  if (gibtEs(cwd, ref, datei)) git(cwd, ['checkout', ref, '--', datei])
  else git(cwd, ['rm', '-f', '-q', '--ignore-unmatch', '--', datei])
}

export function nachricht(commits, dateien) {
  const shas = commits.filter((c) => c.autor === SAMMLER && c.dateien.some((d) => dateien.includes(d))).map((c) => c.sha.slice(0, 8))
  return `${RUECKNAHME_BETREFF} (${shas.join(', ')})`
}

/**
 * @param {{cwd: string, basis: string, bauen: () => boolean, committen: (nachricht: string) => boolean}} o
 * @returns {{art: 'nichts' | 'zurueckgenommen' | 'bleibt-rot', dateien: string[]}}
 */
export function zuruecknehmen({ cwd, basis, bauen, committen }) {
  const commits = commitsSeit(cwd, basis)
  const { dateien, ...ausgelassen } = sammlerAuswahl(commits)
  if (dateien.length === 0) return { art: 'nichts', dateien, ausgelassen }
  // Reste früherer Schritte des roten Laufs (Meldungen, Rohfolgen, halbe Erzeugnisse) kämen sonst mit in den Commit.
  git(cwd, ['reset', '-q', '--hard', 'HEAD'])
  git(cwd, ['clean', '-fdq'])
  for (const d of dateien) stelleHer(cwd, basis, d)
  if (bauen() && committen(nachricht(commits, dateien))) return { art: 'zurueckgenommen', dateien, ausgelassen }
  // Die Ursache liegt woanders (oder der Bestand blieb rot): Sammler-Stand wieder herstellen, nichts verloren.
  for (const d of dateien) stelleHer(cwd, 'HEAD', d)
  return { art: 'bleibt-rot', dateien, ausgelassen }
}

// Der Job hat 45 min und ist schon gelaufen: Bau (gemessen 2–4 min) und Commit mit Prüfketten bekommen je eine Grenze darunter.
const lauf = (befehl, env, minuten) => {
  try {
    execFileSync('bash', ['-c', befehl], { stdio: 'inherit', windowsHide: true, timeout: minuten * 60 * 1000, env })
    return true
  } catch {
    return false
  }
}

/** Jeder Verwerfungspfad mit Zahl und Namen: fremd geänderte Dateien bleiben stehen, `ruecknahmen` zählen nicht als fremd. */
export function ausgelassenZeile({ fremd, keinDatenpfad, ruecknahmen }) {
  const namen = (l) => (l.length ? `: ${l.join(', ')}` : '')
  return `Sammler-Zurücknahme ausgelassen: ${fremd.length} Dateien mit fremder Änderung${namen(fremd)}; ${keinDatenpfad.length} außerhalb von data/ oder in data/cache${namen(keinDatenpfad)}; ${ruecknahmen} frühere Rücknahme-Commits nicht als fremd gezählt`
}

function main(argv, env) {
  const i = argv.indexOf('--basis')
  const basis = i >= 0 ? argv[i + 1] : ''
  if (!basis) {
    console.error('Aufruf: node tools/sammler-zuruecknehmen.mjs --basis <sha>')
    return 2
  }
  const bauBefehl = env.SZN_BAU || 'npm run data:build'
  const commitBefehl = env.SZN_COMMIT || 'bash tools/commit-data.sh "$SZN_NACHRICHT"'
  const erg = zuruecknehmen({
    cwd: process.cwd(),
    basis,
    bauen: () => lauf(bauBefehl, env, 10),
    committen: (text) => lauf(commitBefehl, { ...env, BAU_LAUF: '1', SZN_NACHRICHT: text }, 20),
  })
  console.log(`Sammler-Zurücknahme: ${erg.art} (${erg.dateien.length} Dateien: ${erg.dateien.join(', ') || '-'})`)
  console.log(ausgelassenZeile(erg.ausgelassen))
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2), process.env))
