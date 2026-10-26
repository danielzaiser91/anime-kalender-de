#!/usr/bin/env node
/**
 * Prüft gegen `buehne-dist/`, dass der Zustand einer Zelle der Bühne nicht in eine andere wandert: ein Schnellfilter, in
 * Variante A umgelegt, steht in Variante B und nach einem Neuladen der Zelle nicht mehr (Ursache: gemeinsamer `localStorage`).
 *
 * Aufruf: node tools/buehne-zustand-pruefen.mjs        (nach `npm run buehne:bauen`; Exit 1 bei einem Fehler)
 */
import assert from 'node:assert/strict'
import { starteBuehne } from './buehne-seite.mjs'

const adresse = (variante) => `http://buehne.test/buehne.html#zelle?mockup=relative-uhrzeit&v=${variante}&fall=alle&thema=hell`
const BESTAETIGT = '[aria-label^="bestätigt"]'

async function lade(seite, variante) {
  await seite.goto('about:blank')
  await seite.goto(adresse(variante), { waitUntil: 'load' })
  await seite.getByRole('button', { name: 'Filter', exact: true }).click()
  await seite.locator(BESTAETIGT).first().waitFor()
}

const stellung = (seite) => seite.locator(BESTAETIGT).first().getAttribute('aria-pressed')

async function main() {
  const { browser, seite, fremde } = await starteBuehne()
  try {
    await seite.setViewportSize({ width: 1200, height: 900 })
    await lade(seite, 'A')
    const anfang = await stellung(seite)
    assert.equal(anfang, 'false', 'Ausgangszustand: Filter aus')
    await seite.locator(BESTAETIGT).first().click()
    assert.notEqual(await stellung(seite), anfang, 'in A ist der Filter umgelegt')
    await lade(seite, 'B')
    assert.equal(await stellung(seite), anfang, 'Variante B beginnt mit dem Ausgangszustand')
    await lade(seite, 'A')
    assert.equal(await stellung(seite), anfang, 'auch das Neuladen von A beginnt frisch')
  } finally {
    await browser.close()
  }
  assert.equal(fremde.length, 0, `Anfragen nach draußen: ${fremde[0]}`)
  console.log('buehne-zustand-pruefen: ok')
}

await main()
