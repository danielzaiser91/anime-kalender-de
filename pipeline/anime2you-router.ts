/**
 * Artikel-Router der Anime2You-Auswertung, ein Schritt in `claude-anime2you-extraktion.yml` vor dem Claude-Schritt: `--verzeichnis <ordner>`.
 * Vorgabe ist der Schattenmodus: er protokolliert nur (`router.json`, Zeile im Log), was er Claude ersparen würde, und lässt `auswahl.json` unberührt.
 * Scharf wird er allein durch die Repository-Variable `ANIME2YOU_ROUTER_SCHARF=ja` (Workflow setzt `ROUTER_SCHARF`); die Bedingung dafür steht im Pull Request, nicht hier.
 * Meldet `claude=<n>` (wie viele Artikel Claude liest) und endet in jedem Fall mit Exit 0: bei einem Ausfall fehlt `claude`, `auswahl.json` ist unverändert,
 * Claude liest alles wie vor dem Router; der Ausfall geht als Vorfall hinaus (ohne `LAUF_TOKEN` nur als Warnung).
 */
import { appendFileSync } from 'node:fs'
import { meldeAbbruch } from './lib/abbruch.ts'
import { routerSchritt } from './lib/anime2you-router-lauf.ts'

const ordner = /--verzeichnis[= ](\S+)/.exec(process.argv.slice(2).join(' '))?.[1]
let text: string
let ausfall: string | undefined
try {
  if (!ordner) throw new Error('Aufruf: anime2you-router.ts --verzeichnis <ordner>')
  const scharf = process.env.ROUTER_SCHARF === 'ja'
  const { zeile, claude } = routerSchritt(ordner, scharf)
  text = `Router (${scharf ? 'scharf' : 'Schatten'}): ${zeile.artikel} Artikel, von der Regel erklärt ${zeile.erspart + zeile.stichprobe} (${scharf ? 'erspart' : 'würde ersparen'} ${zeile.erspart}, Stichprobe ${zeile.stichprobe}), Rest ${zeile.rest}; Claude liest ${claude}`
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `claude=${claude}\n`)
} catch (err) {
  ausfall = (err as Error).message
  text = `Router: Ausfall – ${ausfall}`
}
console.log(text)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`)
if (ausfall) await meldeAbbruch('anime2you-router', ausfall, 'anime2you')
process.exit(0)
