/**
 * Eigener Diff eines PR-Kopfes (21.11.2026): `git diff $(git merge-base <basis> K)..K`, hier aus GitHub-Compare `<basis>...K` (drei Punkte = ab merge-base).
 * Zwei Köpfe mit gleicher Kennung unterscheiden sich nur durch nachgezogenen main (update-branch ohne Handauflösung); eigener Commit und
 * Konfliktauflösung ändern den Patch. Der Hunk-Kopf verliert seine Zeilennummern wie bei `git patch-id`: main darf Zeilen davor verschieben.
 * Leser: `prueferSperre` (pr-nachrechnen-pruefer.mjs) und die Übernahme im CI-Prüfer (pr-pruefer-uebernahme.mjs).
 */
import { createHash } from 'node:crypto'

/** Compare liefert höchstens 300 Dateien; bei so vielen ist die Liste womöglich gekürzt. */
export const DATEIEN_HOECHSTENS = 300
const HUNK_KOPF = /^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/gm

/** Kennung aus der Dateiliste von Compare (`.files`); null = nicht vergleichbar (leer, gekürzt, Datei ohne Patch wie Binärdatei oder Riesen-Diff). */
export function diffKennung(dateien) {
  if (!Array.isArray(dateien) || dateien.length === 0 || dateien.length >= DATEIEN_HOECHSTENS) return null
  if (dateien.some((d) => typeof d.patch !== 'string')) return null
  const teile = dateien.map((d) => [d.filename, d.status, d.previous_filename ?? '', d.patch.replace(HUNK_KOPF, '@@')].join('\0'))
  return createHash('sha256').update(teile.sort().join('\n')).digest('hex')
}

/** Holt die Kennung eines Kopfes über `gh api`; jeder Abruf- oder Lesefehler heißt null (nichts gilt dann als gleich). */
export function compareKennung(gh, basis) {
  return (sha) => {
    try {
      return diffKennung(JSON.parse(gh(['api', `repos/{owner}/{repo}/compare/${basis}...${sha}`, '--jq', '.files'])))
    } catch (e) {
      console.error(`eigener Diff ${sha.slice(0, 9)} nicht lesbar (${e.message}); Freigabe wird nicht übernommen`)
      return null
    }
  }
}

/**
 * `gleich(kurz)` für `prueferSperre`: hat der im Urteil genannte Kopf denselben eigenen Diff wie `kopf`? Der Kopf muss unter den
 * Commits des PR stehen (volle SHA), sonst nein. `kennung(sha)` wird je SHA höchstens einmal gerufen.
 */
export function diffGleich(kennung, commits, kopf) {
  const gemerkt = new Map()
  const von = (sha) => {
    if (!gemerkt.has(sha)) gemerkt.set(sha, kennung(sha))
    return gemerkt.get(sha)
  }
  return (kurz) => {
    const alt = commits.find((c) => c.oid.startsWith(kurz))?.oid
    if (alt === undefined || kopf === '') return false
    const a = von(alt)
    return a !== null && a === von(kopf)
  }
}
