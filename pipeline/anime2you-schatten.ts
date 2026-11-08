/**
 * Schattenlauf der Anime2You-Regel, ein Schritt in `claude-anime2you-extraktion.yml` nach dem Claude-Schritt: `--verzeichnis <ordner>`.
 * Beeinflusst nichts, schreibt nur `data/proposals/anime2you-schatten.json` (Aufbau und Maße: `lib/anime2you-schatten.ts`).
 * Endet in jedem Fall mit Exit 0 – ein Ausfall des Schattens darf den Lauf nicht rot machen. Er steht als Zeile „Schatten: Ausfall …“ im Log,
 * als `schattenFehler` in der Datei und als Vorfall (`meldeAbbruch`, ohne `LAUF_TOKEN` nur als Warnung).
 */
import { appendFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { readJson, writeJson } from './lib/util.ts'
import { todayIso } from '../shared/time.ts'
import { meldeAbbruch } from './lib/abbruch.ts'
import { SCHATTEN_DATEI, schattenSchritt } from './lib/anime2you-schatten-lauf.ts'
import type { SchattenBestand } from './lib/anime2you-schatten.ts'

const ordner = /--verzeichnis[= ](\S+)/.exec(process.argv.slice(2).join(' '))?.[1]
const zeilen: string[] = []
let ausfall: string | undefined
try {
  if (!ordner) throw new Error('Aufruf: anime2you-schatten.ts --verzeichnis <ordner>')
  const ablage = {
    lies: () => readJson<SchattenBestand>(SCHATTEN_DATEI, { laeufe: [] }),
    schreibe: (b: SchattenBestand) => writeJson(SCHATTEN_DATEI, b, true),
  }
  const lauf = schattenSchritt(ordner, ablage, todayIso(), () => performance.now(), (t) => {
    zeilen.push(t)
    console.log(t)
  })
  if (!lauf || lauf.schattenFehler > 0) ausfall = zeilen.find((t) => t.includes('Ausfall')) ?? 'Schattenlauf unvollständig'
} catch (err) {
  ausfall = (err as Error).message
  console.log(`Schatten: Ausfall – ${ausfall}`)
}
if (process.env.GITHUB_STEP_SUMMARY && zeilen.length) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${zeilen.join('\n')}\n`)
if (ausfall) await meldeAbbruch('anime2you-schatten', ausfall, 'anime2you')
process.exit(0)
