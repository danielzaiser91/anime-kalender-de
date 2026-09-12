#!/usr/bin/env node
/**
 * **Wie die Anzeige im Netflix-Player wirklich aussieht.**
 *
 * Der Zustand, den bis zum 12.09.2026 niemand abgebildet hat:
 * `netflix-kasten-bild.mjs` zeichnet die **Titelseite**, und was nur im Player
 * erscheint, sah deshalb nie jemand. Gekostet hat das zwei fehlende
 * CSS-Regeln — `.ak-player-knopf` und `.ak-player-bedienbar` standen in keiner
 * Zeile von `melder.css`. Folge: Der Melde-Knopf trug weiße Schrift auf weißem
 * Grund und nahm wegen `pointer-events: none` keinen Klick an. Daniel sah ein
 * leeres Rechteck über einer laufenden Folge und konnte nicht melden.
 *
 * **Das Stylesheet wird echt geladen, der Aufbau aus `melder.js` nachgestellt**
 * — genau die Elemente, die `playerAnzeige(text, art, knopfText)` baut.
 * Gemessen wird, was ein Bild verschweigt: ob der Knopf Klicks annimmt, ob sich
 * seine Farbe vom Grund abhebt, und ob er neben dem Text Platz hat.
 *
 * Aufruf: `node tools/netflix-player-bild.mjs` · `npm run check:netflix-player`
 * Ergebnis: `docs/netflix-player.png`
 */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const css = readFileSync('extension/melder.css', 'utf8')
const melder = readFileSync('extension/melder.js', 'utf8')

/* Die Klassen müssen im Melder vorkommen — sonst bildet das Werkzeug Totes ab. */
const ERWARTET = ['ak-player-anzeige', 'ak-player-knopf', 'ak-player-bedienbar']
const fehlend = ERWARTET.filter((k) => !melder.includes(k))
if (fehlend.length) {
  console.error(`melder.js kennt diese Klassen nicht mehr: ${fehlend.join(', ')}`)
  process.exit(1)
}

const browser = await chromium.launch()
const seite = await browser.newPage({ viewportSize: { width: 900, height: 220 } })
/* Schwarz wie der Player — auf Weiß fiele ein weißer Knopf nicht auf. */
/*
  **Netflix' eigene Regeln gehören in die Kulisse** — sonst misst sie unseren
  Stil, nicht das Ergebnis. Genau daran ist das Amazon-Werkzeug am 02.09.2026
  vorbeigelaufen: Ohne die fremden Regeln sah ein Knopf sauber aus, der auf der
  echten Seite linksbündig klebte.

  Hier ist es `button { color: inherit }`: Damit erbt ein Knopf ohne eigene
  Farbe das fast weiße `#e6edf3` der Anzeige und steht auf Chromes weißem
  Grund — unlesbar. Ohne diese Zeile meldet die Prüfung „hebt sich ab", weil
  sie Chromes `buttontext` misst, das es auf der echten Seite nicht gibt.
*/
await seite.setContent(`<!doctype html><meta charset="utf-8">
<style>
  html, body { margin: 0; background: #000; min-height: 220px; }
  button { color: inherit; font: inherit; background: #fff; border: 0; }
  ${css}
</style>`)

await seite.evaluate(() => {
  const feld = document.createElement('div')
  feld.className = 'ak-player-anzeige ak-player-bedienbar'
  feld.dataset.art = 'laeuft'
  const text = document.createElement('span')
  text.className = 'ak-player-text'
  text.textContent = 'Folge 26: deutsche Tonspur gefunden'
  feld.appendChild(text)
  const knopf = document.createElement('button')
  knopf.type = 'button'
  knopf.className = 'ak-player-knopf'
  knopf.textContent = 'Als deutsch melden'
  feld.appendChild(knopf)
  document.body.appendChild(feld)
})

const mass = await seite.evaluate(() => {
  const feld = document.querySelector('.ak-player-anzeige')
  const knopf = feld.querySelector('.ak-player-knopf')
  const k = getComputedStyle(knopf)
  const f = feld.getBoundingClientRect()
  const b = knopf.getBoundingClientRect()
  /* Nimmt der Knopf wirklich einen Klick an — oder liegt die Anzeige darüber? */
  const mitte = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)
  return {
    klickbar: getComputedStyle(knopf).pointerEvents !== 'none' && knopf.contains(mitte),
    getroffen: mitte?.className ?? '(nichts)',
    farbe: k.color,
    grund: k.backgroundColor,
    breite: Math.round(b.width),
    feldBreite: Math.round(f.width),
    knopfRechts: Math.round(b.right),
    feldRechts: Math.round(f.right),
    /* Eine Anzeige ohne Knopf darf dem Player die Klicks nicht wegnehmen. */
    ohneKnopf: (() => {
      const nur = document.createElement('div')
      nur.className = 'ak-player-anzeige'
      nur.textContent = 'wartet auf die Tonspuren'
      document.body.appendChild(nur)
      const p = getComputedStyle(nur).pointerEvents
      nur.remove()
      return p
    })(),
  }
})

await seite.locator('.ak-player-anzeige').screenshot({ path: 'docs/netflix-player.png' })
await browser.close()

const fehler = []
const pruefe = (was, ok, zusatz) => {
  console.log(`  ${ok ? 'ok  ' : 'FEHL'} ${was}${ok || zusatz === undefined ? '' : ` — ${zusatz}`}`)
  if (!ok) fehler.push(was)
}

console.log('Die Anzeige im Netflix-Player:\n')
pruefe('der Melde-Knopf nimmt Klicks an', mass.klickbar, `getroffen: ${mass.getroffen}`)
pruefe('er hebt sich vom Grund ab', mass.farbe !== mass.grund, `${mass.farbe} auf ${mass.grund}`)
pruefe('er trägt überhaupt eine Farbe', mass.farbe !== 'rgb(230, 237, 243)', mass.farbe)
pruefe('er hat Breite', mass.breite > 40, `${mass.breite} px`)
pruefe('er bleibt in der Anzeige', mass.knopfRechts <= mass.feldRechts, `${mass.knopfRechts} / ${mass.feldRechts}`)
pruefe('ohne Knopf bleibt die Anzeige durchlässig', mass.ohneKnopf === 'none', mass.ohneKnopf)

/*
  **Der Takt darf den Knopf nicht ersetzen.** `playerZeigen()` läuft jede
  Sekunde; baute die Anzeige dabei ihren Inhalt neu, pulsierte der Knopf und ein
  Klick konnte ins Leere gehen (Daniel, 12.09.2026). Geprüft wird am Quelltext,
  weil der Takt selbst in dieser Kulisse nicht läuft.
*/
const quelle = readFileSync('extension/melder.js', 'utf8')
pruefe(
  'die Anzeige baut ihren Inhalt nicht bei jedem Takt neu',
  quelle.includes('if (!playerText?.isConnected)') && quelle.includes('if (!playerKnopf?.isConnected)'),
  'replaceChildren im Takt ersetzt auch den Knopf',
)
pruefe(
  'die Anzeige geht weg, wenn der Player verlassen wird',
  quelle.includes('function playerFeldWeg()') && /if \(!imPlayer\(\) \|\| !playerAuftragOffen\(\)\) return playerFeldWeg\(\)/.test(quelle),
  'ein nacktes return lässt sie über der Titelseite stehen',
)
/*
  **Der Takt hält sich aus einem laufenden Durchlauf heraus** (Daniel,
  12.09.2026). Das Flag liegt im `localStorage`, weil die Antwort eine
  Navigation überleben muss und synchron gebraucht wird — und es verfällt,
  damit ein abgestürzter Tab die Erweiterung nicht dauerhaft stilllegt.
*/
pruefe(
  'ein laufender Durchlauf pausiert den Takt',
  quelle.includes("const DURCHLAUF_FLAG = 'ak-durchlauf-laeuft'") &&
    quelle.includes('if (durchlaufLaeuftHier()) return'),
  'sonst zeichnet der Takt für Zustände, die eine Sekunde später vorbei sind',
)
pruefe(
  'das Flag verfällt von selbst',
  quelle.includes('DURCHLAUF_FLAG_MAX_MS') && /Date\.now\(\) - seit > DURCHLAUF_FLAG_MAX_MS/.test(quelle),
  'ein Flag ohne Verfallsdatum legt die Erweiterung nach einem Absturz still',
)
pruefe(
  'es wird bei Start und Ende gesetzt',
  (quelle.match(/durchlaufFlagSetzen\((true|false)\)/g) ?? []).length >= 2,
  'ein Flag, das nur gesetzt wird, ist eine Falle',
)
pruefe(
  'im Player zeichnet nur playerZeigen()',
  /function knopfZeigen\(\) \{[\s\S]{0,900}if \(imPlayer\(\)\) \{\s*knopfEntfernen\(\)/.test(quelle),
  'sonst steht ein leerer Titelseiten-Knopf über dem Bild',
)

console.log('\n  Bild: docs/netflix-player.png')
process.exit(fehler.length ? 1 : 0)
