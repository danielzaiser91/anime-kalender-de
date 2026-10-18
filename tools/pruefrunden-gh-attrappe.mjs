// Attrappe für gh im Prozesstest von tools/pruefrunden-hook.test.mjs: antwortet nur auf `pr view 1400 --repo <repo> --json comments`.
const [a, b, nummer, flag, repo, json, feld] = process.argv.slice(2)
if (a !== 'pr' || b !== 'view' || nummer !== '1400' || flag !== '--repo' || repo !== 'danielzaiser91/anime-kalender-de' || json !== '--json' || feld !== 'comments') {
  process.stderr.write('unerwarteter gh-Aufruf\n')
  process.exit(1)
}
const urteil = { body: 'Prüfer: ändern  Kopf: abc' }
process.stdout.write(JSON.stringify({ comments: [urteil, { body: '**Prüfer-Review** ok' }, urteil, urteil] }))
