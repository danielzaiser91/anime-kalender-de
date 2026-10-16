/**
 * Holt die Nachtrag-Kommentare des PR-Autors für den CI-Prüfer (16.10.2026).
 *
 *   node tools/pr-nachtraege.mjs <PR> <autor> <datei>     (hängt die Nachträge an <datei>; bei Fehler bleibt sie unverändert, Exit 0)
 *
 * Beschreibungen sind unveränderlich; spätere Runden stehen als Kommentar des PR-Autors, dessen Text mit
 * `**Nachtrag`, `## Nachtrag` oder `# Nachtrag` beginnt (führender Leerraum erlaubt). Nur der Autor zählt.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const NACHTRAG = /^\s*(\*\*|#+ *)Nachtrag/
const AUTOR = /^[A-Za-z0-9][A-Za-z0-9-]*(\[bot\])?$/
const KOPF = '\n\n## Nachträge (gelten als Teil der Beschreibung, spätere gehen vor)'

/** Kommentare der GitHub-API -> Texte der Nachträge des Autors, in Reihenfolge. */
export function waehleNachtraege(kommentare, autor) {
  return kommentare.filter((k) => k.user?.login === autor && NACHTRAG.test(k.body ?? '')).map((k) => k.body)
}

/** Beschreibung plus Nachträge; ohne Treffer genau der Eingabetext. */
export function ergaenzeBeschreibung(text, kommentare, autor) {
  const texte = waehleNachtraege(kommentare, autor)
  return texte.length === 0 ? text : text + KOPF + texte.map((t) => '\n\n' + t).join('')
}

/** `--slurp` fasst die Seiten von `--paginate` zu einem Array von Arrays zusammen. */
function holeKommentare(pr) {
  const pfad = `repos/${process.env.GITHUB_REPOSITORY}/issues/${pr}/comments`
  const r = spawnSync('gh', ['api', '--paginate', '--slurp', pfad], { encoding: 'utf8', maxBuffer: 1 << 28 })
  if (r.status !== 0) throw new Error(r.stderr)
  return JSON.parse(r.stdout).flat()
}

function main() {
  const [pr, autor, datei] = process.argv.slice(2)
  if (!/^\d+$/.test(pr ?? '') || !AUTOR.test(autor ?? '') || !datei) return console.error('Aufruf: pr-nachtraege.mjs <PR> <autor> <datei>')
  try {
    const alt = readFileSync(datei, 'utf8')
    const neu = ergaenzeBeschreibung(alt, holeKommentare(pr), autor)
    if (neu !== alt) writeFileSync(datei, neu)
  } catch (e) {
    console.error(`Nachträge nicht lesbar, Beschreibung unverändert: ${e.message}`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
