/**
 * Zusicherung (Daniel, 17.10.2026): Gold heißt nur noch Favorit, das Staffelfinale ist grün. Jede Favoriten-Kachel (Woche, Monat, Punkt am Handy)
 * trägt Gold außen; trägt sie zugleich Start/Finale/Katalog, liegt deren Farbe als Innenring darin (Doppelrand, gleiches Maß).
 * Aufruf: `npm run check:logic`.
 */
import { readFileSync } from 'node:fs'
import { ART_STIL, randKlassen, type KartenArt } from '../web/src/lib/kachel-folgen.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const lies = (pfad: string) => readFileSync(new URL(`../web/src/${pfad}`, import.meta.url), 'utf8')

console.log('\nRand der Kachel: Favorit = Gold, Finale = Grün, beides = Doppelrand:')
const arten: KartenArt[] = ['start', 'finale', 'katalog', 'katalogVermutlich', 'imAngebot', 'erstausgabe']
const nurGold = (a: KartenArt) => randKlassen(a, true).aussen === 'ring-ak-favorit-rand' && randKlassen(a, true).innen === ''
pruefe('normale Kachel: kein Rand', randKlassen(undefined, false).aussen === '' && randKlassen(undefined, false).innen === '')
pruefe('Favorit: goldener Rand, kein Innenring', randKlassen(undefined, true).aussen === 'ring-ak-favorit-rand' && randKlassen(undefined, true).innen === '')
pruefe('Finale: grüner Ring (ak-finale)', randKlassen('finale', false).aussen === 'ring-ak-finale' && randKlassen('finale', false).innen === '')
pruefe('Start: bleibt orange', randKlassen('start', false).aussen === 'ring-ak-akzent')
pruefe('Finale und Favorit: Gold außen, Grün innen', randKlassen('finale', true).aussen === 'ring-ak-favorit-rand' && randKlassen('finale', true).innen === 'inset-ring-ak-finale', randKlassen('finale', true))
pruefe('Start und Favorit: Gold außen, Orange innen', randKlassen('start', true).aussen === 'ring-ak-favorit-rand' && randKlassen('start', true).innen === 'inset-ring-ak-akzent', randKlassen('start', true))
pruefe('Katalog und Favorit: Gold außen, Violett innen', randKlassen('katalog', true).aussen === 'ring-ak-favorit-rand' && randKlassen('katalog', true).innen === 'inset-ring-ak-katalog')
pruefe('Favorit mit „Neu bei …“ oder Erstausgabe: nur Gold, kein Innenring', nurGold('imAngebot') && nurGold('erstausgabe'))
pruefe('ohne Favorit trägt nie eine Art Gold oder Innenring', arten.every((a) => !randKlassen(a, false).aussen.includes('favorit') && randKlassen(a, false).innen === ''))
pruefe('mit Favorit ist der Außenring bei jeder Art Gold', arten.every((a) => randKlassen(a, true).aussen === 'ring-ak-favorit-rand'))
pruefe('Finale-Fahne grün, nicht Gold', ART_STIL.finale.fahne === 'bg-ak-finale')

console.log('\nFarben: Finale grün, Favorit gold, beide verschieden:')
const css = lies('styles.css')
function wert(token: string, thema: 'dunkel' | 'hell'): string {
  const treffer = [...css.matchAll(new RegExp(`--ak-${token}:\\s*(#[0-9a-f]{6});`, 'g'))].map((m) => m[1]!)
  return treffer[thema === 'dunkel' ? 0 : 1]!
}
function farbton(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return Math.round((h * 60 + 360) % 360)
}
for (const thema of ['dunkel', 'hell'] as const) {
  for (const token of ['finale', 'finale-text']) {
    const h = farbton(wert(token, thema))
    pruefe(`${thema}: ${token} ist grün (Farbton 80–140°)`, h >= 80 && h <= 140, wert(token, thema))
  }
  for (const token of ['favorit', 'favorit-text', 'favorit-rand']) {
    const h = farbton(wert(token, thema))
    pruefe(`${thema}: ${token} ist gold (Farbton 30–60°)`, h >= 30 && h <= 60, wert(token, thema))
  }
}
pruefe('Finale-Grün liegt ≥ 30° neben dem Smaragd von „gut“ (Filter: gewählt/belegt)', Math.abs(farbton(wert('finale', 'dunkel')) - farbton('#34d399')) >= 30)

console.log('\nAnbindung (Quelltext; Woche, Monat, Liste und Punkt rendert check-kachel-favorit-render.ts):')
const poster = lies('components/kalender/PosterKarte.tsx')
pruefe('Woche: Favorit-Stern ist gold', poster.includes('text-base text-ak-favorit '))
pruefe('Monat: KalenderBereich reicht die Favoriten durch', lies('components/kalender/KalenderBereich.tsx').includes('onPickDay={zurWoche} favorites={p.favorites}'))
pruefe('Punkt: Gold-Regel für Favorit und Doppelrand mit 1-px-Fuge im CSS', css.includes('.ak-punkt[data-favorit] {') && css.includes('box-shadow: 0 0 0 1px var(--art), 0 0 0 2px var(--ak-flaeche)'))
pruefe('Punkt: Finale-Ring ist der grüne Text-Ton', /\.ak-punkt\[data-art='finale'\] \{\s*--art: var\(--ak-finale-text\);/.test(css))
pruefe('Punkt: einfacher Favoriten-Ring in Rand-Gold (hell dunkler Ton, 3:1)', /\.ak-punkt\[data-favorit\] \{\s*outline: 1\.5px solid var\(--ak-favorit-rand\);\s*outline-offset: 0;/.test(css))
pruefe('Punkt: Doppelrand mit Gold außen, 2 px Abstand für Auszeichnung und Fuge', /:not\(\[data-art='imAngebot'\]\) \{\s*outline: 2px solid var\(--ak-favorit-rand\);\s*outline-offset: 2px;/.test(css))
pruefe('Rand-Gold ist ein Tailwind-Token (ring-ak-favorit-rand)', css.includes('--color-ak-favorit-rand: var(--ak-favorit-rand);'))

if (verletzt > 0) {
  console.error(`\n${verletzt} Prüfung(en) verletzt.`)
  process.exit(1)
}
