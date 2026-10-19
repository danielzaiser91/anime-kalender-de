// Attrappe für gh im Prozesstest von tools/pruefrunden-hook.test.mjs: antwortet nur auf `pr view 1400 --repo <repo> --json comments`.
// Ihr Urteil über den Aufruf steht in der Protokolldatei PRUEFRUNDEN_ATTRAPPE_LOG (eine Zeile je Aufruf), die der Test liest:
// Fehler im Aufruf würden vom Hook als „gh nicht erreichbar“ abgefangen und blieben sonst unsichtbar.
import { appendFileSync } from 'node:fs'

const args = process.argv.slice(2)
const richtig = args.join(' ') === 'pr view 1400 --repo danielzaiser91/anime-kalender-de --json comments'
appendFileSync(process.env.PRUEFRUNDEN_ATTRAPPE_LOG, `${richtig ? 'richtig' : 'falsch'}: ${args.join(' ')}\n`)
if (!richtig) process.exit(1)

const urteil = { author: { login: 'danielzaiser91' }, body: 'Prüfer: ändern  Kopf: abc' }
const bauer = { author: { login: 'danielzaiser91' }, body: '## Nachtrag' }
const ci = { author: { login: 'github-actions' }, body: '**Prüfer-Review** ok' }
process.stdout.write(JSON.stringify({ comments: [urteil, ci, bauer, urteil, bauer, urteil] }))
