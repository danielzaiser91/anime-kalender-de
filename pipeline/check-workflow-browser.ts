/**
 * Wächter: Ein Workflow-Job, der ein Browser-Skript aufruft (auch über eine wählbare Option), richtet Chromium ein (27.10.2026).
 * Anlass: `daten-auf-abruf.yml` bot `data:cr-dub` an, ohne Browser; der Abruf wäre am ersten `chromium.launch()` gescheitert.
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-workflow-browser.ts`
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ROOT } from './lib/util.ts'
import { BROWSER_SKRIPTE, jobsOhneBrowser } from './lib/workflow-browser.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const MIT_BROWSER = `
jobs:
  a:
    steps:
      - uses: ./.github/actions/einrichten
        with:
          playwright: 'true'
      - run: npx tsx pipeline/messbelege.ts
`
const OHNE_BROWSER = `
jobs:
  a:
    steps:
      - uses: ./.github/actions/einrichten
      - run: npx tsx pipeline/messbelege.ts
`
const INSTALL_PER_RUN = `
jobs:
  a:
    steps:
      - run: npx playwright install --with-deps chromium
      - run: npm run data:cr-dub
`
const OPTION_OHNE_BROWSER = `
on:
  workflow_dispatch:
    inputs:
      lauf:
        type: choice
        options: [data:tmdb, data:cr-dub]
jobs:
  lauf:
    steps:
      - run: npm run "$LAUF"
`
const OPTIONEN = `
on:
  workflow_dispatch:
    inputs:
      lauf:
        type: choice
        options: [data:tmdb, data:cr-dub]
jobs:
  lauf:
    steps:
`
const INSTALL_CR_DUB = `      - name: Browser
        if: \${{ inputs.lauf == 'data:cr-dub' }}
        run: npx playwright install --with-deps chromium
`
const INSTALL_TMDB = INSTALL_CR_DUB.replace('data:cr-dub', 'data:tmdb')
const INSTALL_OHNE_BEDINGUNG = '      - run: npx playwright install --with-deps chromium\n'
const LAUF = '      - run: npm run "$LAUF"\n'
const OPTION_MIT_BROWSER = OPTIONEN + INSTALL_CR_DUB + LAUF
const OPTION_BROWSER_DANACH = OPTIONEN + LAUF + INSTALL_CR_DUB
const OPTION_FALSCHE_BEDINGUNG = OPTIONEN + INSTALL_TMDB + LAUF
const OPTION_UNBEDINGT = OPTIONEN + INSTALL_OHNE_BEDINGUNG + LAUF
const SKRIPT_DANN_INSTALL = `
jobs:
  a:
    steps:
      - run: npx tsx pipeline/messbelege.ts
${INSTALL_OHNE_BEDINGUNG}`
const OHNE_BROWSER_SKRIPT = `
jobs:
  a:
    steps:
      - run: npm run data:tmdb
`
const ZWEI_JOBS = `
jobs:
  a:
    steps:
      - run: npx tsx pipeline/belege-lesen.ts
  b:
    steps:
      - uses: ./.github/actions/einrichten
        with:
          playwright: true
      - run: npx tsx pipeline/belege-lesen.ts
`

export function fuehreAus(): number {
  pruefe('Browser über einrichten eingerichtet: kein Befund', jobsOhneBrowser(MIT_BROWSER).length === 0, jobsOhneBrowser(MIT_BROWSER))
  pruefe('einrichten ohne playwright: Job a fehlt', jobsOhneBrowser(OHNE_BROWSER).join() === 'a', jobsOhneBrowser(OHNE_BROWSER))
  pruefe('playwright install im run zählt', jobsOhneBrowser(INSTALL_PER_RUN).length === 0, jobsOhneBrowser(INSTALL_PER_RUN))
  pruefe('wählbare Option data:cr-dub ohne Browser: Job lauf fehlt', jobsOhneBrowser(OPTION_OHNE_BROWSER).join() === 'lauf', jobsOhneBrowser(OPTION_OHNE_BROWSER))
  pruefe('wählbare Option, Installation mit passender Bedingung davor: kein Befund', jobsOhneBrowser(OPTION_MIT_BROWSER).length === 0, jobsOhneBrowser(OPTION_MIT_BROWSER))
  pruefe('wählbare Option, Installation erst nach dem Lauf: Job lauf fehlt', jobsOhneBrowser(OPTION_BROWSER_DANACH).join() === 'lauf', jobsOhneBrowser(OPTION_BROWSER_DANACH))
  pruefe('wählbare Option, Bedingung nennt data:tmdb statt data:cr-dub: Job lauf fehlt', jobsOhneBrowser(OPTION_FALSCHE_BEDINGUNG).join() === 'lauf', jobsOhneBrowser(OPTION_FALSCHE_BEDINGUNG))
  pruefe('wählbare Option, Installation ohne Bedingung davor: kein Befund', jobsOhneBrowser(OPTION_UNBEDINGT).length === 0, jobsOhneBrowser(OPTION_UNBEDINGT))
  pruefe('Skript startet vor der Installation: Job a fehlt', jobsOhneBrowser(SKRIPT_DANN_INSTALL).join() === 'a', jobsOhneBrowser(SKRIPT_DANN_INSTALL))
  pruefe('Skript ohne Browser: kein Befund', jobsOhneBrowser(OHNE_BROWSER_SKRIPT).length === 0, jobsOhneBrowser(OHNE_BROWSER_SKRIPT))
  pruefe('zwei Jobs, einer mit playwright: true (Boolean): nur Job a', jobsOhneBrowser(ZWEI_JOBS).join() === 'a', jobsOhneBrowser(ZWEI_JOBS))

  const erwartet = ['belege-lesen.ts', 'messbelege.ts', 'scrape-crunchyroll-dub.ts', 'scrape-crunchyroll-woche.ts']
  pruefe('Tabelle der Browser-Skripte (fest)', Object.keys(BROWSER_SKRIPTE).sort().join() === erwartet.join(), Object.keys(BROWSER_SKRIPTE))
  pruefe('data:cr-dub ist dem Dub-Skript zugeordnet', BROWSER_SKRIPTE['scrape-crunchyroll-dub.ts']?.includes('data:cr-dub') === true)

  /* Jedes Skript, das Chromium startet, steht in der Tabelle (Prüf- und Probeskripte ausgenommen). */
  const pipeline = join(ROOT, 'pipeline')
  const startet = readdirSync(pipeline)
    .filter((d) => d.endsWith('.ts') && !d.startsWith('check-') && d !== 'sammelartikel-poc.ts')
    .filter((d) => /^import \{[^}]*\bchromium\b[^}]*\} from 'playwright'/m.test(readFileSync(join(pipeline, d), 'utf8')))
  pruefe('alle Chromium-Starter in pipeline/ stehen in der Tabelle', startet.sort().join() === erwartet.join(), startet)

  const ordner = join(ROOT, '.github', 'workflows')
  const dateien = readdirSync(ordner).filter((d) => d.endsWith('.yml'))
  pruefe('Workflows gefunden', dateien.length > 0, dateien.length)
  for (const d of dateien) {
    const ohne = jobsOhneBrowser(readFileSync(join(ordner, d), 'utf8'))
    pruefe(`${d}: jeder Job mit Browser-Skript richtet Chromium ein`, ohne.length === 0, ohne)
  }
  console.log(verletzt ? `✖ check-workflow-browser: ${verletzt} Verstöße` : `✓ check-workflow-browser: ${dateien.length} Workflows, ${Object.keys(BROWSER_SKRIPTE).length} Browser-Skripte, 12 Fälle`)
  return verletzt ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(fuehreAus())
