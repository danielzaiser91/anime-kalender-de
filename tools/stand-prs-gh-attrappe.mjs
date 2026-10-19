// Attrappe für gh im Prozesstest von tools/stand-prs-hook.test.mjs: antwortet nur auf die GraphQL-Abfrage des Hooks
// für danielzaiser91/anime-kalender-de. Ihr Urteil über den Aufruf steht in STAND_PRS_ATTRAPPE_LOG (eine Zeile je Aufruf):
// ein falscher Aufruf endet sonst still als „Fehler“ im Zustand und bliebe unsichtbar.
import { appendFileSync } from 'node:fs'

const args = process.argv.slice(2)
const richtig =
  args[0] === 'api' &&
  args[1] === 'graphql' &&
  args.includes('owner=danielzaiser91') &&
  args.includes('name=anime-kalender-de') &&
  args.some((a) => a.startsWith('query=') && a.includes('pullRequests(states: OPEN') && a.includes('pullRequests(states: MERGED'))
appendFileSync(process.env.STAND_PRS_ATTRAPPE_LOG, `${richtig ? 'richtig' : 'falsch'}: ${args.slice(0, 2).join(' ')}\n`)
if (!richtig) process.exit(1)

const ci = (sha, wort) => ({ author: { login: 'github-actions' }, body: `**Prüfer-Review** für ${sha} - Urteil: **${wort}**\n\nText` })
const agent = (sha) => ({ author: { login: 'danielzaiser91' }, body: `Prüfer Runde 1: freigeben\n\nKopf ${sha}` })
const pr = (number, title, sha, rollup, kommentare) => ({
  number,
  title,
  url: `https://github.com/danielzaiser91/anime-kalender-de/pull/${number}`,
  isDraft: false,
  mergeable: 'MERGEABLE',
  headRefOid: `${sha}0000000000000000000000000000000`,
  commits: { nodes: [{ commit: { statusCheckRollup: { state: rollup } } }] },
  comments: { nodes: kommentare },
})
const offen = [
  pr(901001, 'fix(bau): Erster offener PR', 'aaaaaaaaa', 'FAILURE', [ci('aaaaaaaaa', 'aendern')]),
  pr(901002, 'feat(web): Zweiter offener PR', 'bbbbbbbbb', 'SUCCESS', [ci('bbbbbbbbb', 'ok'), agent('bbbbbbbbb')]),
  pr(901003, 'test: Dritter offener PR', 'ccccccccc', 'PENDING', []),
]
const gemergt = [{ number: 900999, title: 'fix: Längst gemergt', url: 'https://github.com/danielzaiser91/anime-kalender-de/pull/900999', mergedAt: '2020-01-01T00:00:00Z', updatedAt: '2020-01-01T00:00:00Z' }]
const repository = {
  offen: { pageInfo: { hasNextPage: false }, nodes: offen },
  gemergt: { pageInfo: { hasNextPage: false, endCursor: 'x' }, nodes: gemergt },
}
process.stdout.write(JSON.stringify({ data: { repository } }))
