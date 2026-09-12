#!/usr/bin/env node
/**
 * **Wie der Disney+-Kasten wirklich aussieht.**
 *
 * Disney+ war der letzte der drei Melder ohne gemeinsames Gerüst: `box.js`
 * stand seit dem 10.09.2026 im Manifest, wurde aber nie gerufen — die beiden
 * Knöpfe schwebten weiter einzeln am Bildschirmrand, jeder mit seiner Lage im
 * Inline-Stil. Seit dem 12.09.2026 sitzen sie im selben Kasten wie bei Netflix
 * und Prime, und ob das trägt, entscheidet ein Bild (CLAUDE.md, 02.09.2026:
 * „Beim Styling der Erweiterung wird hingesehen, nicht gerechnet").
 *
 * **Das Gerüst wird ausgeführt, nicht nachgebaut** — `box.js` läuft im Browser
 * wie auf der echten Seite. Nachgestellt sind nur die Elemente, die
 * `disney.js` hineinhängt. Ein handgeschriebenes HTML wäre eine zweite Fassung
 * derselben Struktur und liefe weg, sobald jemand `box.js` anfasst.
 *
 * Gemessen werden die beiden Dinge, die ein Bild verschweigt: ob der
 * Prüf-Knopf mit einem langen Befund über den Kasten hinausläuft, und ob ein
 * leerer Kasten wirklich verschwindet.
 *
 * Aufruf: `node tools/disney-kasten-bild.mjs` · `npm run check:disney-kasten`
 * Ergebnis: `docs/disney-kasten.png`
 */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const css = readFileSync('extension/melder.css', 'utf8')
const box = readFileSync('extension/box.js', 'utf8')
const melder = readFileSync('extension/disney.js', 'utf8')

/* Die Klassen müssen im Melder wirklich vorkommen — sonst bildet das Werkzeug
   eine Struktur ab, die es nicht mehr gibt (Lehre aus melder-kasten-bild.mjs). */
const ERWARTET = ['ak-disney-kasten', 'ak-melder', 'ak-uebersicht ak-uebersicht-innen', 'ak-such-fuss-mitte']
const fehlend = ERWARTET.filter((k) => !melder.includes(k))
if (fehlend.length) {
  console.error(`disney.js kennt diese Klassen nicht mehr: ${fehlend.join(', ')}`)
  process.exit(1)
}

/* Der längste Befund, den `zeigePruefung()` schreibt — der Fall, der bricht. */
const TEXT = process.env.TEXT ?? 'Folge 7 von 24: kein Deutsch gefunden\nDie übrigen 23 sind deutsch.'

const browser = await chromium.launch()
const seite = await browser.newPage({ viewportSize: { width: 520, height: 420 } })
await seite.setContent(`<!doctype html><meta charset="utf-8">
<style>
  html { background: #0d1117; }
  body { margin: 0; min-height: 420px; font: 13px/1.45 system-ui, sans-serif; }
  ${css}
</style>`)

await seite.evaluate(
  ([quelle, text]) => {
    // eslint-disable-next-line no-eval
    ;(0, eval)(quelle)
    const kasten = window.akBox('ak-disney-kasten', 'entity-ad803e91')

    const titel = kasten.querySelector('.ak-z-titel')
    const name = document.createElement('span')
    name.className = 'ak-z-titel-text'
    name.textContent = 'Bright Sun: Dark Shadows · 24 Folgen'
    titel.appendChild(name)

    const knopf = document.createElement('button')
    knopf.type = 'button'
    knopf.className = 'ak-melder ak-fehler'
    knopf.textContent = text
    kasten.querySelector('.ak-z-melden').appendChild(knopf)

    const uebersicht = document.createElement('button')
    uebersicht.type = 'button'
    uebersicht.className = 'ak-uebersicht ak-uebersicht-innen'
    uebersicht.textContent = 'Anime-Kalender: 3 offen'
    kasten.querySelector('.ak-such-fuss-mitte').appendChild(uebersicht)

    window.akDebugLeiste(kasten, [
      {
        an: '⏸',
        aus: '▶',
        text: 'Ruhemodus',
        titel: 'Hintergrundvideo anhalten',
        aktiv: () => false,
        schalten: () => {},
      },
      window.akBerichtSchalter(() => {}),
    ])
  },
  [box, TEXT],
)

const mass = await seite.evaluate(() => {
  const kasten = document.querySelector('.ak-disney-kasten')
  const knopf = kasten.querySelector('.ak-melder')
  const leer = document.createElement('div')
  leer.className = 'ak-box ak-disney-kasten'
  for (const k of ['ak-z-titel', 'ak-z-inhalt', 'ak-z-melden', 'ak-such-fuss', 'ak-z-debug']) {
    const z = document.createElement('div')
    z.className = k
    leer.appendChild(z)
  }
  document.body.appendChild(leer)
  const leerAnzeige = getComputedStyle(leer).display
  leer.remove()
  return {
    zeilen: [...kasten.children].map((k) => k.className),
    breite: Math.round(kasten.getBoundingClientRect().width),
    knopfRechts: Math.round(knopf.getBoundingClientRect().right),
    kastenRechts: Math.round(kasten.getBoundingClientRect().right),
    knopfSchwebt: getComputedStyle(knopf).position,
    uebersichtSchwebt: getComputedStyle(kasten.querySelector('.ak-uebersicht')).position,
    leerAnzeige,
  }
})

await seite.screenshot({ path: 'docs/disney-kasten.png' })
await browser.close()

const fehler = []
if (mass.zeilen.length !== 5) fehler.push(`${mass.zeilen.length} Zeilen statt fünf`)
if (mass.knopfRechts > mass.kastenRechts) fehler.push('der Prüf-Knopf läuft über den Kasten hinaus')
if (mass.knopfSchwebt !== 'static') fehler.push(`der Prüf-Knopf schwebt noch (${mass.knopfSchwebt})`)
if (mass.uebersichtSchwebt !== 'static') fehler.push(`der Übersichts-Knopf schwebt noch (${mass.uebersichtSchwebt})`)
if (mass.leerAnzeige !== 'none') fehler.push(`ein leerer Kasten bleibt sichtbar (${mass.leerAnzeige})`)

console.log(`  Kasten ${mass.breite} px, ${mass.zeilen.length} Zeilen, Knopf und Übersicht liegen im Fluss`)
console.log('  Bild: docs/disney-kasten.png')
if (fehler.length) {
  for (const f of fehler) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log('\n  ok  der Kasten trägt, und ein leerer verschwindet')
