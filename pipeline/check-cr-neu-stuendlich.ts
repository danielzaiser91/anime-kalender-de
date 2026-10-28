/**
 * Der Stundenlauf findet neue deutsche Crunchyroll-Folgen selbst (Psyren, 27.10.2026: Folge 1 um 14:30 UTC verfügbar, im Bestand erst am Folgetag),
 * zählt vor dem Zugangspaket, ob etwas zu lesen ist, und hält sein Zeitbudget ein (Summe der Schrittgrenzen + Reserve ≤ timeout-minutes).
 * Echte Workflow-Dateien geparst, dazu Abwandlungen (je eine Zusicherung verletzt), die der Wächter melden muss.
 */
import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { OFFEN_BEDINGUNG, stundenlaufBefunde, type Workflow } from './lib/cr-neu-stuendlich.ts'

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
pruefe('echter Stundenlauf: Katalogfund, Zählung, Zugangspaket und Urteil stehen in Reihenfolge, Zeitbudget passt, Bestandsbau folgt', echt.length === 0, echt)
pruefe('Paket und Urteil laufen nur bei zu lesenden Serien (Bedingung wörtlich, erwartet fest)', OFFEN_BEDINGUNG === "steps.cr_offen.outputs.cr_offen != '0'")

function schritteVon(w: Workflow) {
  return w.jobs!.sendezeiten.steps!
}
function indexVon(w: Workflow, muster: string, ohne?: string): number {
  return schritteVon(w).findIndex((s) => s.run?.includes(muster) && !(ohne && s.run.includes(ohne)))
}
const NEU = 'npm run data:cr-neu'
const ZAEHLEN = 'data:cr-dub -- --nur-neu --limit 60 --offen-pruefen'
const WEICHE = 'node tools/cr-zugang-holen.mjs --github-env'
const URTEIL = 'npm run data:cr-dub -- --nur-neu'
const NICHT_ZAEHLEN = '--offen-pruefen'
let abwandlungen = 0

function abweichung(name: string, aendere: (w: Workflow) => void, erwartet: RegExp): void {
  abwandlungen++
  const w = tief(stunde)
  aendere(w)
  const b = stundenlaufBefunde(w, bau)
  pruefe(`Abwandlung „${name}“ wird gemeldet`, b.some((z) => erwartet.test(z)), b)
}
function ohneBefund(name: string, aendere: (w: Workflow) => void): void {
  const w = tief(stunde)
  aendere(w)
  const b = stundenlaufBefunde(w, bau)
  pruefe(`Grenzfall „${name}“ bleibt ohne Befund`, b.length === 0, b)
}

const SCHRITTE = [
  ['Katalogfund', NEU, undefined],
  ['Zählung', ZAEHLEN, undefined],
  ['Zugangspaket', WEICHE, undefined],
  ['Urteil', URTEIL, NICHT_ZAEHLEN],
] as const
for (const [wer, muster, ohne] of SCHRITTE) {
  const index = (w: Workflow) => indexVon(w, muster, ohne)
  abweichung(`${wer} fehlt`, (w) => schritteVon(w).splice(index(w), 1), /0 Schritte statt 1/)
  abweichung(`${wer} doppelt`, (w) => schritteVon(w).push({ ...schritteVon(w)[index(w)] }), /2 Schritte statt 1/)
  abweichung(`${wer} mit falscher Bedingung`, (w) => (schritteVon(w)[index(w)].if = 'false'), /Bedingung/)
  abweichung(`${wer} ohne schritt.sh`, (w) => (schritteVon(w)[index(w)].run = `npm run x # ${muster}`), /schritt\.sh/)
  abweichung(`${wer} mit 30 Minuten`, (w) => {
    const s = schritteVon(w)[index(w)]
    s.run = s.run!.replace(/--zeit \d+m/, '--zeit 30m')
  }, /Zeitgrenze 30 min/)
}
for (const [wer, muster, ohne] of [SCHRITTE[2], SCHRITTE[3]] as const) {
  const index = (w: Workflow) => indexVon(w, muster, ohne)
  abweichung(`${wer} ohne Bedingung`, (w) => delete schritteVon(w)[index(w)].if, /nicht die Bedingung/)
  abweichung(`${wer} mit umgekehrter Bedingung`, (w) => (schritteVon(w)[index(w)].if = "steps.cr_offen.outputs.cr_offen == '0'"), /nicht die Bedingung/)
}
for (const [wer, muster] of [['Katalogfund', NEU], ['Zählung', ZAEHLEN]] as const) {
  abweichung(`${wer} mit der Bedingung der Zählung`, (w) => (schritteVon(w)[indexVon(w, muster)].if = OFFEN_BEDINGUNG), /Bedingung/)
}
abweichung('Urteil ohne --nur-neu', (w) => (schritteVon(w)[indexVon(w, URTEIL, NICHT_ZAEHLEN)].run = 'bash tools/schritt.sh --zeit 8m "x" -- npm run data:cr-dub'), /0 Schritte statt 1/)
abweichung('Urteil vor Zugangspaket', (w) => {
  const s = schritteVon(w)
  const [u] = s.splice(indexVon(w, URTEIL, NICHT_ZAEHLEN), 1)
  s.splice(indexVon(w, WEICHE), 0, u)
}, /Reihenfolge/)
abweichung('Zählung nach dem Zugangspaket', (w) => {
  const s = schritteVon(w)
  const [z] = s.splice(indexVon(w, ZAEHLEN), 1)
  s.splice(indexVon(w, WEICHE) + 1, 0, z)
}, /Reihenfolge/)
abweichung('Katalogfund nach Verpasste Termine', (w) => {
  const s = schritteVon(w)
  const [n] = s.splice(indexVon(w, NEU), 1)
  s.splice(indexVon(w, 'termine-pruefen.ts') + 1, 0, n)
}, /Reihenfolge/)
abweichung('Urteil nach dem Einreichen', (w) => {
  const s = schritteVon(w)
  const [u] = s.splice(indexVon(w, URTEIL, NICHT_ZAEHLEN), 1)
  s.push(u)
}, /Reihenfolge/)
abweichung('Urteil mit eigenem fehler-Melder', (w) => (schritteVon(w)[indexVon(w, URTEIL, NICHT_ZAEHLEN)].run += ' || bash "$MELDER" fehler "x"'), /fehler-Melder/)
abweichung('Weiche ohne Secret', (w) => (schritteVon(w)[indexVon(w, WEICHE)].env = {}), /CR_WEICHE_TOKEN/)
abweichung('Urteil ohne frisches Paket', (w) => (schritteVon(w)[indexVon(w, URTEIL, NICHT_ZAEHLEN)].env = { CR_ZUGANG: '${{ secrets.CR_ZUGANG }}' }), /CR_ZUGANG/)
abweichung('Urteil mit anderem Limit als die Zählung', (w) => {
  const s = schritteVon(w)[indexVon(w, URTEIL, NICHT_ZAEHLEN)]
  s.run = s.run!.replace('--limit 60', '--limit 30')
}, /andere Auswahl/)
abweichung('Zählung ohne Schritt-Kennung', (w) => delete schritteVon(w)[indexVon(w, ZAEHLEN)].id, /Kennung/)
abweichung('Zählung mit falscher Schritt-Kennung', (w) => (schritteVon(w)[indexVon(w, ZAEHLEN)].id = 'offen'), /Kennung/)

/* Zeitbudget: 30 min Schrittgrenzen (gemessen am echten Lauf) plus 10 min Reserve. */
const budget = (w: Workflow) => w.jobs!.sendezeiten['timeout-minutes']!
pruefe('Kontrolle: der echte Job trägt 45 Minuten', budget(stunde) === 45, budget(stunde))
ohneBefund('timeout genau 40 (30 + 10)', (w) => (w.jobs!.sendezeiten['timeout-minutes'] = 40))
abweichung('timeout eine Minute zu knapp (39)', (w) => (w.jobs!.sendezeiten['timeout-minutes'] = 39), /Zeitbudget sendezeiten: Zeitgrenzen 30 min \+ 10 min Reserve über timeout-minutes 39/)
abweichung('timeout wie früher 25', (w) => (w.jobs!.sendezeiten['timeout-minutes'] = 25), /Zeitbudget/)
abweichung('timeout fehlt', (w) => delete w.jobs!.sendezeiten['timeout-minutes'], /kein timeout-minutes/)
abweichung('eine Schrittgrenze um 10 Minuten länger', (w) => {
  const s = schritteVon(w)[indexVon(w, 'pipeline/messbelege.ts')]
  s.run = s.run!.replace('--zeit 2m', '--zeit 12m')
}, /40 min/)
abweichung('Schrittgrenze in Stunden zählt 60 Minuten', (w) => {
  const s = schritteVon(w)[indexVon(w, 'pipeline/messbelege.ts')]
  s.run = s.run!.replace('--zeit 2m', '--zeit 1h')
}, /88 min/)
abweichung('Schritt über schritt.sh ohne Zeitgrenze', (w) => {
  const s = schritteVon(w)[indexVon(w, 'pipeline/messbelege.ts')]
  s.run = s.run!.replace('--zeit 2m ', '')
}, /Schritt ohne --zeit/)

const ohneBau = tief(bau)
ohneBau.on!.workflow_run!.workflows = ['Täglich — alle Quellen']
pruefe('Bestandsbau ohne Stundenlauf als Auslöser wird gemeldet', stundenlaufBefunde(stunde, ohneBau).some((z) => /Bestandsbau/.test(z)))

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log(`\nCR-Neu stündlich: alle Zusicherungen erfüllt (echter Stundenlauf + ${abwandlungen} Abwandlungen, Zeitbudget 30 + 10 ≤ 45)`)
