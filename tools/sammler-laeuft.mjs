// Exit 0 = kein Sammler läuft, Exit 1 = Sammler läuft (Namen auf stdout). Seit 12.11.2026 (PR 3585) nur noch
// für Änderungen an claude-daten-merge.yml nötig: Sammler pushen sonst mit App-Token samt Recht workflows.
// Alles ohne eigenen PR-Zweig ist kein Sammler und steht hier ausdrücklich (exakter Name, kein Teilstring:
// ein künftiger Sammler wie „Prime …“ soll zählen). Ein Test hält jeden Namen gegen die `name:`-Zeilen der Workflows.
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const KEIN_SAMMLER = [
  'PR-Prüfkette', // Kette des PR selbst
  'PR-Prüfer',
  'PR-Prüfer — Neustart bei Nachtrag',
  'Aussehen prüfen',
  'Mutationsprobe',
  'Deploy auf GitHub Pages', // liefert nichts per PR
  // Pusht direkt auf main (tools/commit-data.sh), hat also keinen PR-Zweig, den GitHub ablehnen könnte.
  'Bestand — zusammenführen und bauen',
  // Bewusst NICHT hier: „Claude — Daten-PR zusammenführen“. Er merged origin/main in fremde PR-Zweige und pusht
  // sie; kam inzwischen eine Workflow-Änderung auf main, enthält sein Push sie, und GitHub lehnt ihn ab (Sammler-Fehlerfall).
]

export function laufendeSammler(namen) {
  const treffer = namen.filter((n) => n && !KEIN_SAMMLER.includes(n))
  return [...new Set(treffer)].sort()
}

function main() {
  const out = execFileSync(
    'gh',
    ['run', 'list', '--repo', 'danielzaiser91/anime-kalender-de', '--status', 'in_progress', '--limit', '30', '--json', 'workflowName', '--jq', '.[].workflowName'],
    { encoding: 'utf8', timeout: 60000, windowsHide: true },
  )
  const sammler = laufendeSammler(out.split('\n').map((z) => z.trim()))
  if (sammler.length === 0) {
    console.log('[sammler-laeuft] frei: 0 Sammler laufen')
    return 0
  }
  console.log(`[sammler-laeuft] Sammler läuft: ${sammler.join(', ')}`)
  return 1
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main())
