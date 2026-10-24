/**
 * Wächter für den täglichen JustWatch-Lauf (`npm run data:justwatch-frisch`, PR zu Prime-Kauf/Leihe, 23.10.2026): Er ist ein zweiter Schreiber an
 * `data/justwatch-audio.json` neben dem Wochenlauf. Gesichert wird (1) der Skript-Kurs in `package.json`, (2) der Schritt in `refresh-data.yml`
 * (vor dem Einreichen, am Montag übersprungen), (3) jeder Job der Workflows, der `data:justwatch` oder `data:justwatch-frisch` aufruft, trägt die
 * gemeinsame Gruppe `justwatch-datei` ohne Abbruch. Der Lauf auf Abruf (`daten-auf-abruf.yml`, von Hand) ist bewusst ausgenommen: er ruft den Lauf
 * über `$LAUF` auf, nicht namentlich.
 * Aufruf: node tools/justwatch-schreiber.test.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parse } from 'yaml'

export const GRUPPE = 'justwatch-datei'
export const SKRIPT = 'tsx pipeline/fetch-justwatch-audio.ts --alter 100000 --limit 60'
const RUFT_AN = /npm run data:justwatch(?:-frisch)?(?![\w-])/
const EINREICHEN = './.github/actions/einreichen'

const schritte = (job) => job.steps ?? []
const ruftAn = (job) => schritte(job).some((s) => RUFT_AN.test(s.run ?? ''))

/** Fehlertexte; leer = in Ordnung. `workflows`: Dateiname → geparstes YAML, `paket`: geparste package.json. */
export function pruefeJustwatchSchreiber(workflows, paket) {
  const fehler = []
  if (paket.scripts?.['data:justwatch-frisch'] !== SKRIPT) fehler.push(`package.json: data:justwatch-frisch muss „${SKRIPT}“ sein`)
  for (const [datei, wf] of Object.entries(workflows)) {
    for (const [name, job] of Object.entries(wf.jobs ?? {})) {
      if (!ruftAn(job)) continue
      const gruppe = job.concurrency?.group
      if (gruppe !== GRUPPE) fehler.push(`${datei}: Job ${name} ruft JustWatch auf, aber seine Gruppe ist „${gruppe}“ statt „${GRUPPE}“`)
      else if (job.concurrency['cancel-in-progress'] !== false) fehler.push(`${datei}: Job ${name}: cancel-in-progress muss false sein`)
    }
  }
  const tag = workflows['refresh-data.yml']?.jobs?.sammeln
  const liste = schritte(tag ?? {})
  const frisch = liste.findIndex((s) => /npm run data:justwatch-frisch(?![\w-])/.test(s.run ?? ''))
  if (frisch < 0) return [...fehler, 'refresh-data.yml: Job sammeln hat keinen Schritt mit `npm run data:justwatch-frisch`']
  const einreichen = liste.findIndex((s) => s.uses === EINREICHEN)
  if (einreichen < 0 || frisch > einreichen) fehler.push('refresh-data.yml: der JustWatch-Schritt muss vor dem Einreichen stehen')
  if (!/date -u \+%u/.test(liste[frisch].run) || !/= "1"/.test(liste[frisch].run)) fehler.push('refresh-data.yml: der JustWatch-Schritt muss am Montag (date -u +%u = 1) übersprungen werden')
  if (!/else[\s\S]*npm run data:justwatch-frisch/.test(liste[frisch].run)) fehler.push('refresh-data.yml: der Lauf muss im else-Zweig des Montag-Tests stehen')
  return fehler
}

function ladeRepo(wurzel) {
  const ordner = join(wurzel, '.github', 'workflows')
  const workflows = Object.fromEntries(readdirSync(ordner).filter((f) => /\.ya?ml$/.test(f)).map((f) => [f, parse(readFileSync(join(ordner, f), 'utf8'))]))
  return { workflows, paket: JSON.parse(readFileSync(join(wurzel, 'package.json'), 'utf8')) }
}

function selbsttest(wurzel) {
  const { workflows, paket } = ladeRepo(wurzel)
  const mit = (aendere) => {
    const w = structuredClone(workflows)
    const p = structuredClone(paket)
    aendere(w, p)
    return pruefeJustwatchSchreiber(w, p)
  }
  const erwarte = (name, aendere, muster) => {
    const f = mit(aendere)
    assert.ok(f.some((x) => muster.test(x)), `${name}: erwartet ${muster}, gefunden ${JSON.stringify(f)}`)
  }
  assert.deepEqual(pruefeJustwatchSchreiber(workflows, paket), [], 'der Stand des Repos ist in Ordnung')
  const tag = (w) => w['refresh-data.yml'].jobs.sammeln
  const woche = (w) => w['refresh-weekly.yml'].jobs.tmdb
  erwarte('Skript mit anderem Limit', (_, p) => { p.scripts['data:justwatch-frisch'] = SKRIPT.replace('60', '600') }, /package\.json/)
  erwarte('Skript fehlt', (_, p) => { delete p.scripts['data:justwatch-frisch'] }, /package\.json/)
  erwarte('Tageslauf ohne Gruppe', (w) => { delete tag(w).concurrency }, /refresh-data\.yml: Job sammeln/)
  erwarte('Wochenlauf ohne Gruppe', (w) => { delete woche(w).concurrency }, /refresh-weekly\.yml: Job tmdb/)
  erwarte('Wochenlauf mit anderer Gruppe', (w) => { woche(w).concurrency.group = 'woche-datei' }, /refresh-weekly\.yml: Job tmdb/)
  erwarte('Tageslauf bricht ab', (w) => { tag(w).concurrency['cancel-in-progress'] = true }, /cancel-in-progress/)
  erwarte('Wochenlauf bricht ab', (w) => { woche(w).concurrency['cancel-in-progress'] = true }, /cancel-in-progress/)
  erwarte('dritter Job ohne Gruppe', (w) => { w['neu.yml'] = { jobs: { x: { steps: [{ run: 'npm run data:justwatch -- --limit 5' }] } } } }, /neu\.yml: Job x/)
  erwarte('dritter Job mit dem Frisch-Lauf ohne Gruppe', (w) => { w['neu.yml'] = { jobs: { x: { steps: [{ run: 'npm run data:justwatch-frisch' }] } } } }, /neu\.yml: Job x/)
  assert.deepEqual(mit((w) => { w['neu.yml'] = { jobs: { x: { steps: [{ run: 'npm run data:justwatch-cartoons' }] } } } }), [], 'der Cartoon-Lauf ist ein anderer Lauf')
  erwarte('Schritt fehlt', (w) => { tag(w).steps = tag(w).steps.filter((s) => !/data:justwatch-frisch/.test(s.run ?? '')) }, /keinen Schritt/)
  erwarte('Schritt nach dem Einreichen', (w) => {
    const i = tag(w).steps.findIndex((s) => /data:justwatch-frisch/.test(s.run ?? ''))
    const [s] = tag(w).steps.splice(i, 1)
    tag(w).steps.push(s)
  }, /vor dem Einreichen/)
  erwarte('Montag-Test fehlt', (w) => { const s = tag(w).steps.find((x) => /data:justwatch-frisch/.test(x.run ?? '')); s.run = 'npm run data:justwatch-frisch' }, /Montag/)
  erwarte('Lauf nicht im else-Zweig', (w) => {
    const s = tag(w).steps.find((x) => /data:justwatch-frisch/.test(x.run ?? ''))
    s.run = 'if [ "$(date -u +%u)" = "1" ]; then npm run data:justwatch-frisch; else echo nein; fi'
  }, /else-Zweig/)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const wurzel = join(import.meta.dirname, '..')
  selbsttest(wurzel)
  console.log('justwatch-schreiber: ok (Skript-Kurs, Schritt vor dem Einreichen, Montag-Zweig, Gruppe justwatch-datei an 2 Jobs, 15 Fälle)')
}
