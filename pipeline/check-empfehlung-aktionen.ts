/**
 * Zusicherung zu den Knöpfen unter den Vorschlägen: „Schon gesehen“ ist als Haken nicht selbsterklärend und behält seinen sichtbaren Text
 * in jeder Lage (auch in der Laptop-Reihe). Das echte Markup von `Vorschlaege.tsx` wird gerendert, `empfehlung.css` in Regeln zerlegt
 * (`pipeline/lib/aktionen-css.ts`); keine verbergende Regel darf die Reihe, ihre Nachfahren oder den Text treffen, und die Regel der
 * Laptop-Reihe liegt im Block für breite, niedrige Fenster. Fixture-CSS belegt beide Regeln an Gut- und Schlechtfällen. Aufruf: `npm run check:logic`.
 */
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import type { Kandidat } from '../shared/empfehlung-pool.ts'
import { laptopReiheImBlock, regeln, versteckerDesGesehenTexts } from './lib/aktionen-css.ts'

const g = globalThis as Record<string, unknown>
g.window = { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), addEventListener() {}, removeEventListener() {} }
g.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
const { ignoriereCss } = await import('../tools/mini-dom.ts')
ignoriereCss()
const { Vorschlaege } = await import('../web/src/components/empfehlung/Vorschlaege.tsx')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const KLASSEN = ['empf-aktion-gesehen']
const LAPTOP = '@media (min-width: 1001px) and (max-height: 800px)'
const MITTE = '.empf-galerie .empf-aktionen button:nth-child(2) { white-space: nowrap; }'

console.log('Fixture-CSS: verbergende Regeln')
const verbergen: Array<[string, string, boolean]> = [
  ['Text-Klasse der anderen Knöpfe', '.empf-galerie .empf-aktion-text { display: none; }', false],
  ['nur Layout, nichts versteckt', '.empf-galerie .empf-aktionen { flex-direction: row; }', false],
  ['Klasse des Gesehen-Texts', '.empf-aktion-gesehen { display: none; }', true],
  ['Klasse des Gesehen-Texts in der Selektorliste', '.x, .empf-galerie .empf-aktion-gesehen { visibility: hidden; }', true],
  ['alle Knöpfe der Reihe', '.empf-galerie .empf-aktionen button { display: none; }', true],
  ['span in der Reihe', '.empf-aktionen span { display: none; }', true],
  ['i in der Reihe', '.empf-aktionen i { display: none !important; }', true],
  ['Kinder der Reihe', '.empf-aktionen > * { display: none; }', true],
  ['Schrift auf null', '.empf-aktionen button { font-size: 0; }', true],
  ['Breite null', '.empf-aktionen button:nth-child(2) { width: 0; }', true],
  ['span der Galerie', '.empf-galerie span { display: none; }', true],
  ['in der Laptop-Lage', `${LAPTOP} { .empf-aktionen span { display: none; } }`, true],
  ['harmlose Regel einer anderen Stelle', '.empf-details { display: none; }', false],
]
for (const [name, css, erwartet] of verbergen) {
  const treffer = versteckerDesGesehenTexts(regeln(css), KLASSEN)
  pruefe(`${name}: ${erwartet ? 'rot' : 'in Ordnung'}`, (treffer.length > 0) === erwartet, treffer)
}

console.log('Fixture-CSS: Regel der Laptop-Reihe im Block')
const laptop: Array<[string, string, boolean]> = [
  ['im Laptop-Block', `${LAPTOP} { ${MITTE} }`, true],
  ['Block mit anderem Leerraum', '@media (min-width:1001px) and (max-height:800px) {\n  .empf-galerie .empf-aktionen button:nth-child(2) { white-space: nowrap; }\n}', true],
  ['neben anderen Regeln im Block', `${LAPTOP} { .a { color: red; } ${MITTE} .b { color: red; } }`, true],
  ['ohne Block', MITTE, false],
  ['anderer Block (nur Breite)', `@media (min-width: 1001px) { ${MITTE} }`, false],
  ['andere Höhengrenze', `@media (min-width: 1001px) and (max-height: 900px) { ${MITTE} }`, false],
  ['Block geschlossen, Regel danach', `${LAPTOP} { .a { color: red; } } ${MITTE}`, false],
]
for (const [name, css, erwartet] of laptop) {
  pruefe(`${name}: ${erwartet ? 'in Ordnung' : 'rot'}`, laptopReiheImBlock(regeln(css)) === erwartet)
}

console.log('Echtes Markup und echte empfehlung.css')
const kandidat: Kandidat = { id: 900901, n: 'Testserie', f: 'TV', y: 2020, e: 12, g: [], k: [], fsk: 12, v: 70, p: [['netflix']], duell: true }
const kontext = { datei: { einstiege: [kandidat] }, index: new Map([[900901, 0]]) } as unknown as Parameters<typeof Vorschlaege>[0]['kontext']
const nichts = () => {}
const html = renderToStaticMarkup(h(Vorschlaege, {
  kontext,
  gezeigt: [900901],
  favoriten: new Set<number>(),
  stand: { gesamt: 10, rest: 5 } as never,
  vonVorn: nichts,
  aktionen: { favorit: nichts, gesehen: nichts, nein: nichts, oeffne: nichts },
  ablage: { gesehen: [], verworfen: [], zurueckholen: nichts, alleZurueck: nichts } as never,
}))

const knopf = html.match(/<button[^>]*aria-label="Schon gesehen"[^>]*>(.*?)<\/button>/)?.[1] ?? ''
const textKlassen = (knopf.match(/<span class="([^"]*)">Schon gesehen<\/span>/)?.[1] ?? '').split(' ').filter(Boolean)
pruefe('der Gesehen-Knopf trägt sichtbaren Text „Schon gesehen“ in einem eigenen span', textKlassen.length > 0, knopf)
pruefe('der Text trägt nicht die Klasse empf-aktion-text (die versteckt ihn in der Symbolreihe)', !textKlassen.includes('empf-aktion-text'), textKlassen)

const echt = regeln(readFileSync(new URL('../web/src/components/empfehlung/empfehlung.css', import.meta.url), 'utf8'))
pruefe('empfehlung.css wird gelesen (mehr als 10 Regeln)', echt.length > 10, echt.length)
pruefe('keine Regel versteckt den Gesehen-Text oder die Knöpfe der Reihe', versteckerDesGesehenTexts(echt, textKlassen).length === 0, versteckerDesGesehenTexts(echt, textKlassen))
pruefe('die Regel des Mittelknopfs liegt im Block min-width 1001 px und max-height 800 px', laptopReiheImBlock(echt))

console.log(`empfehlung-aktionen: ${verletzt === 0 ? 'alle Zusicherungen erfüllt' : `${verletzt} verletzt`}`)
process.exit(verletzt === 0 ? 0 : 1)
