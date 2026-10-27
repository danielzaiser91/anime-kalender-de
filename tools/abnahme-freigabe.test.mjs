/**
 * Test zu tools/abnahme-freigabe.mjs und .github/workflows/abnahme-freigabe.yml.
 * Erwartete Werte stehen fest im Test (nichts aus dem Prüfling importiert außer den Funktionen selbst).
 */
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { entscheide, lauf } from './abnahme-freigabe.mjs'

let fehler = 0
let anzahl = 0
function pruefe(name, ok, info = '') {
  anzahl++
  if (!ok) {
    fehler++
    console.error(`✗ ${name} ${info}`)
  }
}

const KOPF = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'
const ALT = '0badc0de0badc0de0badc0de0badc0de0badc0de'
const PRAE = '## Nachtrag (Abnahme Dirigent, 27.10.2026)'
const basis = { autor: 'danielzaiser91', assoziation: 'OWNER', kopf: KOPF }
const art = (o) => entscheide({ ...basis, ...o }).art

pruefe('gültig: voller Hash', art({ text: `${PRAE}\nKopf ${KOPF}` }) === 'frei')
pruefe('gültig: Präfix mit genau 9 Zeichen', art({ text: `${PRAE}\nKopf a1b2c3d4e` }) === 'frei')
pruefe('gültig: zweiter Hash im Text trifft', art({ text: `${PRAE}\nalt ${ALT} neu a1b2c3d4e5f` }) === 'frei')
pruefe('zu kurzer Hash (8 Zeichen)', art({ text: `${PRAE}\nKopf a1b2c3d4` }) === 'hinweis')
pruefe('alter Hash', art({ text: `${PRAE}\nKopf ${ALT}` }) === 'hinweis')
pruefe('ohne Hash', art({ text: `${PRAE}\nalles gut` }) === 'hinweis')
pruefe('Hash, der kein Präfix ist (Mitte des Kopfs)', art({ text: `${PRAE}\n${KOPF.slice(3, 20)}` }) === 'hinweis')
pruefe('länger als der Kopf', art({ text: `${PRAE}\n${KOPF}ab` }) === 'hinweis')
pruefe('fremder Autor', art({ autor: 'fremder', text: `${PRAE}\n${KOPF}` }) === 'ignorieren')
pruefe('Bot als Autor', art({ autor: 'github-actions[bot]', text: `${PRAE}\n${KOPF}` }) === 'ignorieren')
pruefe('richtiger Autor, aber nicht OWNER', art({ assoziation: 'COLLABORATOR', text: `${PRAE}\n${KOPF}` }) === 'ignorieren')
pruefe('Präfix mitten im Text', art({ text: `Hallo\n${PRAE}\n${KOPF}` }) === 'ignorieren')
pruefe('Präfix mit Leerzeichen davor', art({ text: ` ${PRAE}\n${KOPF}` }) === 'ignorieren')
pruefe('anderes Präfix', art({ text: `## Nachtrag\n${KOPF}` }) === 'ignorieren')
pruefe('Text fehlt', art({ text: undefined }) === 'ignorieren')

// Lauf mit gh-Attrappe: Aufrufe aufzeichnen.
function simuliere(env) {
  const aufrufe = []
  const gh = (args) => {
    aufrufe.push(args)
    return args[0] === 'pr' && args[1] === 'view' ? `${KOPF}\n` : ''
  }
  const e = lauf({ PR: '2186', REPO: 'o/r', COMMENT_URL: 'https://x/c#1', ...env }, gh)
  return { e, aufrufe }
}
const ok = { COMMENT_USER: 'danielzaiser91', COMMENT_ASSOC: 'OWNER' }

const frei = simuliere({ ...ok, COMMENT_BODY: `${PRAE}\n${KOPF.slice(0, 12)}` })
const review = frei.aufrufe.find((a) => a[0] === 'api')
pruefe('Lauf frei: genau eine Review', frei.aufrufe.filter((a) => a[0] === 'api').length === 1)
pruefe('Lauf frei: Endpunkt', review?.[3] === 'repos/o/r/pulls/2186/reviews', review)
pruefe('Lauf frei: APPROVE', review?.includes('event=APPROVE'))
pruefe('Lauf frei: commit_id = Kopf', review?.includes(`commit_id=${KOPF}`))
pruefe('Lauf frei: Text nennt Kommentar-Link und Hash', review?.some((x) => x.includes('https://x/c#1') && x.includes(KOPF.slice(0, 12))))

const alt = simuliere({ ...ok, COMMENT_BODY: `${PRAE}\n${ALT}` })
pruefe('Lauf alter Hash: keine Review, ein Hinweis-Kommentar', !alt.aufrufe.some((a) => a[0] === 'api') && alt.aufrufe.filter((a) => a[1] === 'comment').length === 1)
pruefe('Lauf alter Hash: Ergebnis hinweis', alt.e.art === 'hinweis')

const fremd = simuliere({ COMMENT_USER: 'fremder', COMMENT_ASSOC: 'OWNER', COMMENT_BODY: `${PRAE}\n${KOPF}` })
pruefe('Lauf fremder Autor: weder Review noch Kommentar', fremd.aufrufe.every((a) => a[1] === 'view'))

for (const [name, env] of [['PR mit Zeichen', { PR: '1; rm' }], ['REPO mit Leerraum', { REPO: 'o r' }]]) {
  let geworfen = false
  try { simuliere({ ...ok, COMMENT_BODY: `${PRAE}\n${KOPF}`, ...env }) } catch { geworfen = true }
  pruefe(`Lauf wirft bei ${name}`, geworfen)
}
let kopfKaputt = false
try { lauf({ ...ok, PR: '1', REPO: 'o/r', COMMENT_BODY: `${PRAE}\n${KOPF}` }, () => 'unsinn') } catch { kopfKaputt = true }
pruefe('Lauf wirft bei unlesbarem Kopf', kopfKaputt)

// Workflow: geparstes YAML.
const wf = parse(readFileSync(new URL('../.github/workflows/abnahme-freigabe.yml', import.meta.url), 'utf8'))
const auslöser = wf.on ?? wf[true]
pruefe('Workflow: nur issue_comment created', Object.keys(auslöser).join() === 'issue_comment' && auslöser.issue_comment.types.join() === 'created', auslöser)
pruefe('Workflow: Rechte genau contents read, pull-requests write', JSON.stringify(wf.permissions) === '{"contents":"read","pull-requests":"write"}', wf.permissions)
const job = wf.jobs.freigeben
const bedingung = job.if.replace(/\s+/g, ' ')
pruefe('Workflow: Bedingung nennt PR, Autor, OWNER, Präfix',
  ['github.event.issue.pull_request', "github.event.comment.user.login == 'danielzaiser91'", "github.event.comment.author_association == 'OWNER'", "startsWith(github.event.comment.body, '## Nachtrag (Abnahme Dirigent')"].every((t) => bedingung.includes(t)), bedingung)
pruefe('Workflow: zwei Schritte, Checkout ohne Zweig und ohne Zugangsdaten', job.steps.length === 2 && job.steps[0].uses === 'actions/checkout@v4' && !job.steps[0].with.ref && job.steps[0].with['persist-credentials'] === false)
const schritt = job.steps[1]
pruefe('Workflow: Skript ohne Ausdruck im Befehl', schritt.run.trim() === 'node tools/abnahme-freigabe.mjs', schritt.run)
pruefe('Workflow: Kommentartext nur über env', schritt.env.COMMENT_BODY === '${{ github.event.comment.body }}' && !JSON.stringify(wf).replace(JSON.stringify(schritt.env), '').includes('comment.body }}'))
pruefe('Workflow: Token GITHUB_TOKEN', schritt.env.GH_TOKEN === '${{ secrets.GITHUB_TOKEN }}')

if (fehler) {
  console.error(`${fehler} von ${anzahl} Fällen rot`)
  process.exit(1)
}
console.log(`✓ abnahme-freigabe: ${anzahl} Fälle (Autor, OWNER, Präfix, Hash kurz/alt/gültig, Lauf mit gh-Attrappe, Workflow-Struktur)`)
