/**
 * Zusicherung: ein Erfassungsstichtag (viele Titel eines Anbieters mit demselben `seit`-Tag in MOTN) wird nie zum „Im Angebot seit“-Termin
 * (`pipeline/bau/angebot-stichtag.ts`, gemessen 13.10.2026: Crunchyroll 31.03.2026 mit 234 Titeln, 08.01.2026 mit 29).
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-angebot-stichtag.ts`
 */
import { readFileSync } from 'node:fs'
import { STICHTAG_AB, erfassungsStichtage, stichtagSchluessel } from './bau/angebot-stichtag.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const tag = (anbieter: string, seit: string, n: number) => Array.from({ length: n }, () => ({ dienste: { [anbieter]: { seit } } }))

console.log('\nErfassungsstichtag (Schwelle):')
{
  const shows = [...tag('crunchyroll', '2026-03-31', STICHTAG_AB), ...tag('crunchyroll', '2026-04-01', STICHTAG_AB - 1), ...tag('netflix', '2026-03-31', 3)]
  const st = erfassungsStichtage(shows)
  pruefe(`ab ${STICHTAG_AB} Titeln desselben Anbieters an einem Tag ist es ein Stichtag`, st.has(stichtagSchluessel('crunchyroll', '2026-03-31')), [...st])
  pruefe('einer weniger ist keiner', !st.has(stichtagSchluessel('crunchyroll', '2026-04-01')))
  pruefe('gezählt wird je Anbieter: derselbe Tag bei einem anderen Anbieter zählt nicht mit', !st.has(stichtagSchluessel('netflix', '2026-03-31')))
  pruefe('Shows ohne Tag werden nicht mitgezählt', erfassungsStichtage(Array.from({ length: 40 }, () => ({ dienste: { crunchyroll: {} } }))).size === 0)
}

console.log('\nErfassungsstichtag (MOTN-Archiv in data/motn.json):')
{
  const motn = JSON.parse(readFileSync(new URL('../data/motn.json', import.meta.url), 'utf8')) as { shows?: Record<string, { dienste?: Record<string, { seit?: string }> }> }
  const st = erfassungsStichtage(Object.values(motn.shows ?? {}))
  pruefe('Crunchyroll 31.03.2026 (Erfassungswelle, 234 Titel) ist ein Stichtag', st.has(stichtagSchluessel('crunchyroll', '2026-03-31')), [...st].slice(0, 5))
  pruefe('Crunchyroll 08.01.2026 (29 Titel) ist ein Stichtag', st.has(stichtagSchluessel('crunchyroll', '2026-01-08')))
  pruefe('Netflix 05.03.2024 (14 Titel) ist ein Stichtag', st.has(stichtagSchluessel('netflix', '2024-03-05')))
  pruefe('Disney+ 25.09.2024 und Prime Video 29.12.2025 (je 10 Titel) sind keine', !st.has(stichtagSchluessel('disneyplus', '2024-09-25')) && !st.has(stichtagSchluessel('primevideo', '2025-12-29')))
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nErfassungsstichtag: alle Zusicherungen erfüllt.')
