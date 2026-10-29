#!/usr/bin/env node
/**
 * Prüft, dass die Bühnen-Seite das Fenster füllt, ohne selbst zu scrollen (Navigator-iframe, 785 px hoch), gegen `buehne-dist/`:
 *
 * - 1280×785 und 1728×785, Gerät 375 und „beide": html und body haben keinen Überlauf (`scrollHeight − clientHeight` = 0), und die
 *   Zellen reichen bis zum unteren Rand (Seite füllt das Fenster, `.seite` = 100dvh).
 * - 1280×500, Gerät 375: keine Zelle unter 240 px (Untergrenze); die Seite scrollt dort bewusst.
 * - Im hohen Werkzeug-Fenster (`starteBuehne`, 12000 px): jede Zelle hat ihre volle Gerätehöhe (375 → 812, Desktop 1200 → 800), die
 *   Zelle samt Beschriftung ist 834,8 px hoch wie vor dem Umbau (Bildhöhen der `buehne:bilder`), und „beide" ist dort nicht verkleinert.
 *
 * Aufruf: node tools/buehne-fenster-pruefen.mjs        (nach `npm run buehne:bauen`; Exit 1 bei einem Fehler)
 */
import assert from 'node:assert/strict'
import { starteBuehne } from './buehne-seite.mjs'

const ADRESSE = 'http://buehne.test/buehne.html#relative-uhrzeit?v=A&fall=alle&thema=beide&teil=beide&geraet='

/** Überlauf der Seite, Höhe der Zellen (ohne Zoom: `clientHeight`) und tiefste Unterkante einer Zelle. */
async function messe(seite, geraet, breite, hoehe) {
  await seite.setViewportSize({ width: breite, height: hoehe })
  await seite.goto('about:blank')
  await seite.goto(`${ADRESSE}${geraet}`, { waitUntil: 'load' })
  await seite.locator('iframe[data-zelle]').first().waitFor()
  return seite.evaluate(() => {
    const ueberlauf = (e) => e.scrollHeight - e.clientHeight
    const zellen = [...document.querySelectorAll('figure.zelle')]
    return {
      html: ueberlauf(document.documentElement),
      body: ueberlauf(document.body),
      rahmen: zellen.map((z) => z.querySelector('iframe').clientHeight),
      figuren: zellen.map((z) => z.getBoundingClientRect().height.toFixed(1)),
      unterkante: Math.max(...zellen.map((z) => z.getBoundingClientRect().bottom)),
    }
  })
}

async function pruefeFensterFuellt(seite) {
  for (const geraet of ['375', 'beide']) {
    for (const breite of [1280, 1728]) {
      const m = await messe(seite, geraet, breite, 785)
      const wo = `Gerät ${geraet}, ${breite}×785`
      assert.equal(m.html, 0, `${wo}: html scrollt (${m.html} px)`)
      assert.equal(m.body, 0, `${wo}: body scrollt (${m.body} px)`)
      assert.ok(m.unterkante >= 785 - 16 - 2, `${wo}: Zellen enden bei ${m.unterkante} px, das Fenster bleibt unten leer`)
    }
  }
}

async function pruefeUntergrenze(seite) {
  const m = await messe(seite, '375', 1280, 500)
  assert.ok(Math.min(...m.rahmen) >= 240, `1280×500: eine Zelle ist nur ${Math.min(...m.rahmen)} px hoch (Untergrenze 240)`)
}

async function pruefeVolleHoehe(seite) {
  const handy = await messe(seite, '375', 1400, 12000)
  assert.deepEqual(handy.rahmen, [812, 812, 812, 812], 'hohes Fenster, Handy: jede Zelle voll 812 px hoch')
  assert.deepEqual(handy.figuren, ['834.8', '834.8', '834.8', '834.8'], 'hohes Fenster, Handy: Zelle samt Beschriftung 834,8 px wie vor dem Umbau')
  const beide = await messe(seite, 'beide', 1400, 12000)
  assert.deepEqual(beide.rahmen, [812, 812, 812, 812, 800, 800, 800, 800], 'hohes Fenster, beide: Handy 812, Desktop 800 px, nicht verkleinert')
}

async function main() {
  const { browser, seite, fremde } = await starteBuehne()
  try {
    await pruefeFensterFuellt(seite)
    await pruefeUntergrenze(seite)
    await pruefeVolleHoehe(seite)
  } finally {
    await browser.close()
  }
  assert.equal(fremde.length, 0, `Anfragen nach draußen: ${fremde[0]}`)
  console.log('buehne-fenster-pruefen: ok (4 Fenster ohne Überlauf, Untergrenze, volle Gerätehöhe im hohen Fenster)')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
