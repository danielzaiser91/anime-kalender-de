// Exit 0 = kein Sammler läuft (Workflow-Datei darf gepusht werden), Exit 1 = Sammler läuft (Namen auf stdout).
// Nur Sammler zählen: Prüfkette, Prüfer und Deploy ändern nichts an der Ablehnung ihrer Pull-Request-Zweige.
// Derselbe Filter wie in merge-reihe.sh (grep -viE 'PR|Prüf|^Deploy auf GitHub Pages$'), dort ist Bestandsbau ein Sammler.
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export function laufendeSammler(namen) {
  const treffer = namen.filter((n) => n && !/PR|Prüf/i.test(n) && n !== 'Deploy auf GitHub Pages')
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
