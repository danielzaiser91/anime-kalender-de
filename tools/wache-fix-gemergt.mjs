/**
 * Zusatz zur ALARM-Zeile einer stummen Quelle: liegt nach ihrem letzten Lauf ein Commit auf main, der ihren Schreiber
 * (`recordSource('<name>', …)` in `pipeline/`) oder einen Workflow berührt, der diesen aufruft, ist der Fix schon da
 * und nur der nächste Lauf steht aus. Der Alarm bleibt; es kommt nur die Erklärung dazu.
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const git = (wurzel, ...a) => execFileSync('git', a, { cwd: wurzel, encoding: 'utf8', maxBuffer: 8 << 20, windowsHide: true })
const maskiert = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Dateien unter `pipeline/`, die `recordSource('<name>', …)` aufrufen. */
function schreiberDateien(wurzel, name) {
  const muster = new RegExp(`recordSource\\(\\s*['"\`]${maskiert(name)}['"\`]`)
  const dateien = git(wurzel, 'ls-files', '--', 'pipeline').split('\n').filter((d) => d.endsWith('.ts'))
  return dateien.filter((d) => muster.test(readFileSync(join(wurzel, d), 'utf8')))
}

/** Workflow-Dateien, die einen der Schreiber direkt oder über ein npm-Skript aus `package.json` aufrufen. */
function workflowDateien(wurzel, schreiber) {
  const skripte = JSON.parse(readFileSync(join(wurzel, 'package.json'), 'utf8')).scripts ?? {}
  const aufrufe = [...schreiber]
  for (const [skript, befehl] of Object.entries(skripte)) {
    if (schreiber.some((d) => befehl.includes(d))) aufrufe.push(`npm run ${skript}`)
  }
  const ordner = join(wurzel, '.github', 'workflows')
  const treffer = []
  for (const datei of readdirSync(ordner).filter((d) => d.endsWith('.yml'))) {
    const text = readFileSync(join(ordner, datei), 'utf8')
    const ruft = aufrufe.some((a) => new RegExp(`${maskiert(a)}(?![\\w:-])`).test(text))
    if (ruft) treffer.push(`.github/workflows/${datei}`)
  }
  return treffer
}

/** Pfade, die zur Quelle gehören: ihre Schreiber und die Workflows, die sie starten. */
export function quellenPfade(wurzel, name) {
  const schreiber = schreiberDateien(wurzel, name)
  if (schreiber.length === 0) return []
  return [...schreiber, ...workflowDateien(wurzel, schreiber)]
}

/** Neueste Commits auf HEAD, die einen der Pfade berühren: `[{ sha, iso }]`, neueste zuerst. */
export function commitsZuPfaden(wurzel, pfade) {
  const ausgabe = git(wurzel, 'log', '-n', '200', '--format=%h\t%cI', '--', ...pfade)
  return ausgabe.split('\n').filter(Boolean).map((zeile) => {
    const [sha, iso] = zeile.split('\t')
    return { sha, iso }
  })
}

/** Neuester Commit, der strikt nach `referenzIso` liegt (gleiche Sekunde zählt nicht: der Lauf kannte ihn dann); sonst leer. */
export function fixGemergtText(commits, referenzIso) {
  const referenzMs = Date.parse(referenzIso)
  if (!Number.isFinite(referenzMs)) return ''
  const neu = commits.filter((c) => Date.parse(c.iso) > referenzMs).sort((a, b) => Date.parse(b.iso) - Date.parse(a.iso))[0]
  return neu ? ` — Fix gemergt ${neu.iso.slice(0, 10)} (${neu.sha}), nächster Lauf steht aus` : ''
}

/**
 * Zusatz-Funktion für `eskalationsZeilen`: `(name, eintrag) => Text`. Bezugspunkt ist der letzte Lauf (`lastRun`,
 * auch erfolglose), sonst der letzte Erfolg; ohne beides oder bei Gitfehler kein Zusatz (der Alarm steht trotzdem).
 */
export function fixZusatz(wurzel, commitsVon = commitsZuPfaden, pfadeVon = quellenPfade) {
  return (name, eintrag) => {
    const referenz = eintrag?.lastRun ?? eintrag?.lastOk
    if (!referenz) return ''
    try {
      const pfade = pfadeVon(wurzel, name)
      return pfade.length === 0 ? '' : fixGemergtText(commitsVon(wurzel, pfade), referenz)
    } catch {
      return ''
    }
  }
}
