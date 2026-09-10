#!/usr/bin/env node
/**
 * **Wie der Netflix-Kasten wirklich aussieht.**
 *
 * Daniel am 10.09.2026: „mach so eine schicke extension box ähnlich wie bei
 * prime … pack dort auch unten ne trennlinie für debug icons rein." Ob eine
 * Trennlinie sitzt und ob fünf Zeilen als ein Kasten wirken, entscheidet ein
 * Bild — die Regel dazu steht seit dem 02.09.2026 in `CLAUDE.md`.
 *
 * **Das Gerüst wird nicht nachgebaut, sondern ausgeführt.** `box.js` läuft im
 * Browser und baut den Kasten; nachgestellt sind nur die Inhalte, die der
 * Melder hineinhängt. Ein handgeschriebenes HTML wäre eine zweite Fassung
 * derselben Struktur — und die läuft weg, sobald jemand `box.js` anfasst
 * (genau das ist der Kulisse für Prime am 10.09.2026 passiert: Sie trug die
 * Klasse `.ak-box` nicht, und die Fußzeile brach um).
 *
 * Aufruf: `node tools/netflix-kasten-bild.mjs`
 * Ergebnis: `docs/netflix-kasten.png`
 */
import { chromium } from 'playwright'
import { readFileSync, mkdirSync } from 'node:fs'

const css = readFileSync('extension/melder.css', 'utf8')
const box = readFileSync('extension/box.js', 'utf8')

const browser = await chromium.launch()
const seite = await browser.newPage({ viewportSize: { width: 520, height: 420 } })

await seite.setContent(`<!doctype html><meta charset="utf-8">
<style>
  html { background: #141414; }
  body { margin: 0; min-height: 420px; font: 13px/1.45 system-ui, sans-serif; }
  ${css}
</style>`)

/* Das echte Gerüst — und darin die Elemente, die der Melder auf Netflix baut. */
await seite.evaluate(
  ([quelle]) => {
    // eslint-disable-next-line no-eval
    ;(0, eval)(quelle)
    const kasten = window.akBox('ak-netflix-kasten', '/title/80090673')

    const titel = kasten.querySelector('.ak-z-titel')
    const text = document.createElement('span')
    text.className = 'ak-z-titel-text'
    text.textContent = 'Haikyu!! · Staffel 1 · Episode 26 offen'
    const weg = document.createElement('button')
    weg.className = 'ak-z-weg'
    weg.textContent = '✕'
    titel.append(text, weg)

    const inhalt = kasten.querySelector('.ak-z-inhalt')
    inhalt.textContent = 'Netflix zählt hier 26 Folgen — die letzte ist unsere OVA „Lev ist hier!".'

    const melden = kasten.querySelector('.ak-z-melden')
    const leiste = document.createElement('div')
    leiste.className = 'ak-durchlauf-leiste'
    const nochmal = document.createElement('button')
    nochmal.className = 'ak-durchlauf ak-grenze'
    nochmal.textContent = '↻ alle'
    const start = document.createElement('button')
    start.className = 'ak-durchlauf'
    start.textContent = '▶ Episode 26 prüfen'
    leiste.append(nochmal, start)
    melden.appendChild(leiste)

    const links = kasten.querySelector('.ak-such-fuss-mitte')
    const uebersicht = document.createElement('button')
    uebersicht.className = 'ak-uebersicht ak-uebersicht-innen'
    uebersicht.textContent = 'Anime-Kalender 6'
    links.appendChild(uebersicht)

    const rechts = kasten.querySelector('.ak-such-fuss-rechts')
    const as = document.createElement('a')
    as.className = 'ak-such-quelle'
    as.href = '#'
    as.textContent = 'aniSearch'
    rechts.appendChild(as)

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
  [box],
)

/* Gemessen wird, was ein Bild nicht zeigt: Zeilenlage und die Trennlinie. */
const mass = await seite.evaluate(() => {
  const kasten = document.querySelector('.ak-netflix-kasten')
  const debug = kasten.querySelector('.ak-z-debug')
  const fuss = kasten.querySelector('.ak-such-fuss')
  const links = kasten.querySelector('.ak-such-fuss-links')
  const rechts = kasten.querySelector('.ak-such-fuss-rechts')
  return {
    zeilen: [...kasten.children].map((k) => k.className),
    /* Die Linie sitzt an der Leiste, nicht an der Zeile — melder.css seit 02.09.2026. */
    trennlinie: getComputedStyle(debug.querySelector('.ak-debugleiste') ?? debug).borderTopWidth,
    debugOben: debug.getBoundingClientRect().top,
    fussUnten: fuss.getBoundingClientRect().bottom,
    linksX: links.getBoundingClientRect().left,
    rechtsX: rechts.getBoundingClientRect().left,
    breite: Math.round(kasten.getBoundingClientRect().width),
    /*
      **Die Gegenprobe gehört zur Regel.** Ohne sie sagt die Prüfung nur, dass
      ein gefüllter Kasten zu sehen ist — und das war er auch vorher.
    */
    ...(() => {
      const leer = document.createElement('div')
      leer.className = 'ak-box ak-netflix-kasten'
      for (const k of ['ak-z-titel', 'ak-z-inhalt', 'ak-z-melden', 'ak-such-fuss', 'ak-z-debug']) {
        const z = document.createElement('div')
        z.className = k
        leer.appendChild(z)
      }
      document.body.appendChild(leer)
      const anzeige = getComputedStyle(leer).display
      leer.remove()
      return { leerVersteckt: anzeige === 'none', leerAnzeige: anzeige }
    })(),
  }
})

const fehler = []
const pruefe = (was, ok, zusatz) => {
  console.log(`  ${ok ? 'ok  ' : 'FEHL'} ${was}${ok || zusatz === undefined ? '' : ` — ${zusatz}`}`)
  if (!ok) fehler.push(was)
}

console.log('Der Netflix-Kasten:\n')
pruefe('fünf Zeilen in der erwarteten Reihenfolge', mass.zeilen.length === 5, mass.zeilen.join(' | '))
pruefe('die Debug-Zeile trägt eine Trennlinie', mass.trennlinie !== '0px', mass.trennlinie)
pruefe('sie steht unter dem Fuß', mass.debugOben >= mass.fussUnten, `${mass.debugOben} vs ${mass.fussUnten}`)
pruefe('Prüfliste links, aniSearch rechts', mass.linksX < mass.rechtsX, `${mass.linksX} / ${mass.rechtsX}`)
/* 300 px Inhalt plus Innenabstand und Rahmen — schmaler als Prime (340). */
pruefe('ein leerer Kasten ist unsichtbar', mass.leerVersteckt, mass.leerAnzeige)
pruefe('der Kasten bleibt schmal', mass.breite <= 332, `${mass.breite} px`)

mkdirSync('docs', { recursive: true })
await seite.locator('.ak-netflix-kasten').screenshot({ path: 'docs/netflix-kasten.png' })
console.log('\n  Bild: docs/netflix-kasten.png')

await browser.close()
process.exit(fehler.length ? 1 : 0)
