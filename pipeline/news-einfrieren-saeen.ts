/**
 * Einmalig (20.10.2026): hält `weiterer` der bestehenden Meldungen so fest, wie ihr erster Stand in der Historie von
 * `public/data/news.json` lautete, und gleicht `news.json` daran an. Läuft wiederholbar: bereits festgehaltene Schlüssel bleiben.
 *
 * Aufruf: npx tsx pipeline/news-einfrieren-saeen.ts [--ref origin/main] [--trocken]
 */
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { readJson, writeJson, ROOT } from './lib/util.ts'
import { saeeWeiterer, setzeWeitererEin } from './lib/news-einfrieren.ts'
import type { NewsHistorie } from './lib/news.ts'
import type { NewsEintrag } from '../shared/news-typen.ts'

const GIT = process.env.GIT_EXE ?? 'git'
const git = (...a: string[]): string => execFileSync(GIT, a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, windowsHide: true })

/** Alle Stände von `news.json` bis `ref`, von alt nach neu; ein nicht lesbarer Stand fällt weg. */
function staendeBis(ref: string): NewsEintrag[][] {
  const hashes = git('log', ref, '--format=%H', '--', 'public/data/news.json').split('\n').filter(Boolean).reverse()
  const staende: NewsEintrag[][] = []
  for (const h of hashes) {
    try {
      /* Die ersten Stände (bis 12.09.2026) hatten ein flaches Format ohne `meldungen`. */
      const stand = (JSON.parse(git('show', `${h}:public/data/news.json`)) as NewsEintrag[]).filter((e) => Array.isArray(e.meldungen))
      staende.push(stand)
    } catch {
      console.warn(`Stand ${h.slice(0, 9)} nicht lesbar, übersprungen`)
    }
  }
  return staende
}

export function main(argv: string[]): number {
  const ref = argv.includes('--ref') ? argv[argv.indexOf('--ref') + 1]! : 'origin/main'
  const trocken = argv.includes('--trocken')
  const historie = readJson<NewsHistorie>('data/news-historie.json', { zuerst: {} })
  const jetzt = readJson<NewsEintrag[]>('public/data/news.json', [])
  const staende = staendeBis(ref)
  const neu = saeeWeiterer(historie, staende, jetzt)
  const geaendert = setzeWeitererEin(jetzt, historie.weiterer ?? {})
  console.log(`news-einfrieren-saeen: ${staende.length} Stände, ${neu} Schlüssel festgehalten, ${geaendert} Meldungen in news.json angeglichen${trocken ? ' (trocken)' : ''}`)
  if (!trocken) {
    writeJson('data/news-historie.json', historie)
    writeJson('public/data/news.json', jetzt)
  }
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(main(process.argv.slice(2)))
