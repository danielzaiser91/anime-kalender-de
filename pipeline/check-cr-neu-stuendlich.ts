/**
 * Der Stundenlauf findet neue deutsche Crunchyroll-Folgen selbst (Psyren, 27.10.2026: Folge 1 um 14:30 UTC verfügbar, im Bestand erst am Folgetag).
 * Echte Workflow-Dateien geparst, dazu Abwandlungen (je eine Zusicherung verletzt), die der Wächter melden muss.
 */
import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { stundenlaufBefunde, type Workflow } from './lib/cr-neu-stuendlich.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

function lade(name: string): Workflow {
  return yaml.load(readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8')) as Workflow
}
const tief = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T

const stunde = lade('refresh-hourly.yml')
const bau = lade('bestand-bauen.yml')
const echt = stundenlaufBefunde(stunde, bau)
pruefe('echter Stundenlauf: Katalogfund, Zugangspaket und Urteil stehen in Reihenfolge, Bestandsbau folgt', echt.length === 0, echt)

function schritteVon(w: Workflow) {
  return w.jobs!.sendezeiten.steps!
}
function indexVon(w: Workflow, muster: string): number {
  return schritteVon(w).findIndex((s) => s.run?.includes(muster))
}
const NEU = 'npm run data:cr-neu'
const WEICHE = 'node tools/cr-zugang-holen.mjs --github-env'
const URTEIL = 'npm run data:cr-dub -- --nur-neu'

function abweichung(name: string, aendere: (w: Workflow) => void, erwartet: RegExp): void {
  const w = tief(stunde)
  aendere(w)
  const b = stundenlaufBefunde(w, bau)
  pruefe(`Abwandlung „${name}“ wird gemeldet`, b.some((z) => erwartet.test(z)), b)
}

for (const [wer, muster] of [['Katalogfund', NEU], ['Zugangspaket', WEICHE], ['Urteil', URTEIL]] as const) {
  abweichung(`${wer} fehlt`, (w) => schritteVon(w).splice(indexVon(w, muster), 1), /0 Schritte statt 1/)
  abweichung(`${wer} doppelt`, (w) => schritteVon(w).push({ ...schritteVon(w)[indexVon(w, muster)] }), /2 Schritte statt 1/)
  abweichung(`${wer} mit if`, (w) => (schritteVon(w)[indexVon(w, muster)].if = 'false'), /Bedingung/)
  abweichung(`${wer} ohne schritt.sh`, (w) => (schritteVon(w)[indexVon(w, muster)].run = `npm run x # ${muster}`), /schritt\.sh/)
  abweichung(`${wer} mit 30 Minuten`, (w) => {
    const s = schritteVon(w)[indexVon(w, muster)]
    s.run = s.run!.replace(/--zeit \d+m/, '--zeit 30m')
  }, /Zeitgrenze 30 min/)
}
abweichung('Urteil ohne --nur-neu', (w) => (schritteVon(w)[indexVon(w, URTEIL)].run = 'bash tools/schritt.sh --zeit 8m "x" -- npm run data:cr-dub'), /0 Schritte statt 1/)
abweichung('Urteil vor Zugangspaket', (w) => {
  const s = schritteVon(w)
  const [u] = s.splice(indexVon(w, URTEIL), 1)
  s.splice(indexVon(w, WEICHE), 0, u)
}, /Reihenfolge/)
abweichung('Katalogfund nach Verpasste Termine', (w) => {
  const s = schritteVon(w)
  const [n] = s.splice(indexVon(w, NEU), 1)
  s.splice(indexVon(w, 'termine-pruefen.ts') + 1, 0, n)
}, /Reihenfolge/)
abweichung('Urteil nach dem Einreichen', (w) => {
  const s = schritteVon(w)
  const [u] = s.splice(indexVon(w, URTEIL), 1)
  s.push(u)
}, /Reihenfolge/)
abweichung('Urteil mit eigenem fehler-Melder', (w) => (schritteVon(w)[indexVon(w, URTEIL)].run += ' || bash "$MELDER" fehler "x"'), /fehler-Melder/)
abweichung('Weiche ohne Secret', (w) => (schritteVon(w)[indexVon(w, WEICHE)].env = {}), /CR_WEICHE_TOKEN/)
abweichung('Urteil ohne frisches Paket', (w) => (schritteVon(w)[indexVon(w, URTEIL)].env = { CR_ZUGANG: '${{ secrets.CR_ZUGANG }}' }), /CR_ZUGANG/)

const ohneBau = tief(bau)
ohneBau.on!.workflow_run!.workflows = ['Täglich — alle Quellen']
pruefe('Bestandsbau ohne Stundenlauf als Auslöser wird gemeldet', stundenlaufBefunde(stunde, ohneBau).some((z) => /Bestandsbau/.test(z)))

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nCR-Neu stündlich: alle Zusicherungen erfüllt (echter Stundenlauf + 23 Abwandlungen)')
