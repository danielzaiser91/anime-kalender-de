#!/usr/bin/env node
/**
 * **Die Durchlauf-Leiste als Bild — ohne Netflix, ohne Anmeldung.**
 *
 * Daniel am 07.09.2026 an „Kill Blue" auf Netflix: „ich prüfe also manuell und
 * merke bis 8 ist de, ich gebe in input feld 8 ein, aber es erscheint kein
 * melde button." Der Knopf steht im Code (`durchlaufKnopfZeigen()`), das CSS
 * dazu auch (`.ak-grenzknopf`) — die Frage ist, ob man ihn **sieht**.
 *
 * Genau diese Unterscheidung hat am 06.09.2026 drei Runden Fehlersuche
 * gekostet: „Ist der Knopf da?" beantworteten alle mit ja, und er war
 * `visibility: hidden`. Gemessen wird deshalb der **berechnete Stil** und die
 * Lage im Fenster, nicht das Dasein im Baum.
 *
 * Was hier nachgestellt wird, ist der Zustand nach einer uneinheitlichen
 * Randprobe: `DURCHLAUF.randOffen` gesetzt, `laeuft` false. Die Leiste trägt
 * dann vier Elemente in dieser Reihenfolge — Grenzfeld, Melde-Knopf,
 * Durchlauf-Knopf, Schalter.
 *
 * Aufruf:
 *
 *     npm run check:leiste
 *
 * Läuft headless; es erscheint kein Fenster.
 *
 * **Nicht in `check:extension`, und das ist kein Versehen.** Am 07.09.2026
 * dort eingehängt, machte es drei Deploys hintereinander rot: Der Job
 * „Erweiterung prüfen" installiert kein Chromium, und Playwright bricht mit
 * „Executable doesn't exist" ab. Dieselbe Trennung gilt für `check:kasten`,
 * `check:panel` und `check:ansichten` — alle vier brauchen einen Browser und
 * laufen deshalb von Hand, nicht in der Kette vor dem Commit.
 */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const css = readFileSync(join(wurzel, 'extension/melder.css'), 'utf8')
const quelle = readFileSync(join(wurzel, 'extension/melder.js'), 'utf8')
const ziel = process.argv[2] ?? join(wurzel, 'docs/melder-leiste.png')

const fehler = []
const pruefe = (was, ok) => {
  console.log(`  ${ok ? '✓' : '✗'} ${was}`)
  if (!ok) fehler.push(was)
}

/*
  **Die Klassennamen kommen aus dem Code, nicht aus dem Gedächtnis.**

  Ein Bild von einer Struktur, die es so nicht mehr gibt, ist schlimmer als
  keines: Es sieht richtig aus und misst etwas anderes.
*/
console.log('Struktur gegen melder.js:')
for (const klasse of ['ak-durchlauf-leiste', 'ak-grenzfeld', 'ak-grenzknopf', 'ak-durchlauf']) {
  pruefe(`melder.js nennt .${klasse}`, quelle.includes(`'${klasse}'`) || quelle.includes(`ak-durchlauf ak-grenze`))
}

/*
  Die Reihenfolge stammt aus `durchlaufKnopfZeigen()`: Das Feld wird als
  erstes Kind eingehängt (`insertBefore(…, leiste.firstChild)`), der Knopf
  direkt dahinter (`grenzFeld.after(…)`).
*/
const seite = `
<div class="ak-durchlauf-leiste">
  <input class="ak-grenzfeld" type="number" min="1" max="12" placeholder="dt. bis Flg. ?">
  <button class="ak-grenzknopf">✓ melden</button>
  <button class="ak-durchlauf ak-uneinheitlich">2 Folgen prüfen</button>
  <button class="ak-durchlauf ak-grenze">2</button>
</div>`

const browser = await chromium.launch()
const kontext = await browser.newContext({ viewport: { width: 1280, height: 720 } })
const s = await kontext.newPage()
/* Netflix' eigener dunkler Grund — sonst misst man weiß auf weiß. */
await s.setContent(`<style>body{margin:0;background:#141414;height:720px}${css}</style>${seite}`)

console.log('\nLage und Sichtbarkeit:')
const mass = await s.evaluate(() => {
  const lies = (wahl) => {
    const el = document.querySelector(wahl)
    if (!el) return null
    const r = el.getBoundingClientRect()
    const st = getComputedStyle(el)
    /* Was an dieser Stelle wirklich obenauf liegt — Anwesenheit ist nicht Sichtbarkeit. */
    const oben = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return {
      x: Math.round(r.left),
      y: Math.round(r.top),
      breite: Math.round(r.width),
      hoehe: Math.round(r.height),
      display: st.display,
      visibility: st.visibility,
      opacity: st.opacity,
      obenLiegt: oben ? oben.className || oben.tagName : null,
    }
  }
  return {
    feld: lies('.ak-grenzfeld'),
    knopf: lies('.ak-grenzknopf'),
    durchlauf: lies('.ak-durchlauf:not(.ak-grenze)'),
    fensterBreite: window.innerWidth,
    fensterHoehe: window.innerHeight,
  }
})

for (const [name, m] of [
  ['Grenzfeld', mass.feld],
  ['Melde-Knopf', mass.knopf],
]) {
  pruefe(`${name}: vorhanden`, Boolean(m))
  if (!m) continue
  pruefe(`${name}: nicht versteckt (${m.display}/${m.visibility}/${m.opacity})`, m.display !== 'none' && m.visibility !== 'hidden' && Number(m.opacity) > 0.1)
  pruefe(`${name}: hat Fläche (${m.breite}×${m.hoehe})`, m.breite > 0 && m.hoehe > 0)
  pruefe(
    `${name}: liegt im Fenster (x ${m.x}, y ${m.y})`,
    m.x >= 0 && m.y >= 0 && m.x + m.breite <= mass.fensterBreite && m.y + m.hoehe <= mass.fensterHoehe,
  )
  pruefe(`${name}: nichts liegt darüber (${m.obenLiegt})`, String(m.obenLiegt).includes('ak-'))
}

/* Feld und Knopf gehören nebeneinander — ein Knopf in der zweiten Zeile ist derselbe Fehler wie keiner. */
if (mass.feld && mass.knopf) {
  pruefe(
    `Feld und Knopf stehen in einer Zeile (y ${mass.feld.y} / ${mass.knopf.y})`,
    Math.abs(mass.feld.y - mass.knopf.y) <= 4,
  )
  pruefe(
    `der Knopf steht rechts vom Feld (${mass.feld.x + mass.feld.breite} → ${mass.knopf.x})`,
    mass.knopf.x >= mass.feld.x + mass.feld.breite - 2,
  )
}

await s.screenshot({ path: ziel })
await browser.close()

console.log(`\nBild: ${ziel}`)
if (fehler.length) {
  console.error(`\n${fehler.length} Zusicherung(en) rot.`)
  process.exit(1)
}
console.log('Leiste: alle Zusicherungen erfüllt.')
