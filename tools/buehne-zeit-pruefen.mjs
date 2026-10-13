#!/usr/bin/env node
/**
 * Prüft die Uhrzeit der Bühne (Leiste „Zeit", Hash-Parameter `zeit`) gegen `buehne-dist/` — ohne Server, wie `buehne-bilder.mjs`.
 *
 * - Ein Link mit `zeit` friert die Uhr der Zellen auf diese Zeit ein (Fernseh-Kasten zeigt „in 25 Min" bei 16:20).
 * - Der Schieber übernimmt erst beim Loslassen (`change`), nicht beim Ziehen (`input`): Jeder Wechsel lädt alle Zellen neu.
 *   Beim Ziehen wandert nur die Anzeige mit; spätestens eine Sekunde nach dem Loslassen steht die neue Zeit im Link.
 * - Eine unbekannte oder fremde Zeit fällt auf die erste Zeit des Mockups zurück; ein `+` im Versatz, der im Link zum Leerzeichen
 *   wurde, gilt weiter.
 *
 * Aufruf: node tools/buehne-zeit-pruefen.mjs        (nach `npm run buehne:bauen`; Exit 1 bei einem Fehler)
 */
import assert from 'node:assert/strict'
import { starteBuehne } from './buehne-seite.mjs'

const ADRESSE = 'http://buehne.test/buehne.html#relative-uhrzeit?v=A&fall=alle&geraet=375&thema=dunkel&teil=nachher'
const ERSTE = '2026-10-16T13:30:00+02:00'
const GLEICH = '2026-10-16T16:20:00+02:00'

async function oeffne(seite, zeit) {
  await seite.goto('about:blank')
  await seite.goto(`${ADRESSE}${zeit === undefined ? '' : `&zeit=${zeit}`}`, { waitUntil: 'load' })
  await seite.locator('.gruppe[data-gruppe="Zeit"]').waitFor()
}

const gedrueckt = (seite) => seite.locator('.gruppe[data-gruppe="Zeit"] button[aria-pressed="true"]').getAttribute('data-wert')
const hashZeit = (seite) => seite.evaluate(() => new URLSearchParams(location.hash.split('?')[1]).get('zeit'))

async function pruefeEinfrieren(seite) {
  await oeffne(seite, encodeURIComponent(GLEICH))
  assert.equal(await gedrueckt(seite), GLEICH, 'der Knopf der gewählten Zeit ist gedrückt')
  const zelle = await seite.locator('iframe[data-zelle]').elementHandle()
  const frame = await zelle.contentFrame()
  await frame.getByText('in 25 Min').first().waitFor({ timeout: 30_000 })
}

async function pruefeFallback(seite) {
  await oeffne(seite, undefined)
  assert.equal(await gedrueckt(seite), ERSTE, 'ohne `zeit` gilt die erste Zeit')
  await oeffne(seite, encodeURIComponent('2026-10-17T16:20:00+02:00'))
  assert.equal(await gedrueckt(seite), ERSTE, 'ein anderer Tag fällt auf die erste Zeit zurück')
  await oeffne(seite, 'quatsch')
  assert.equal(await gedrueckt(seite), ERSTE, 'Unlesbares fällt auf die erste Zeit zurück')
  await oeffne(seite, '2026-10-16T16:20:00+02:00')
  assert.equal(await gedrueckt(seite), GLEICH, 'ein `+` im Link (als Leerzeichen gelesen) gilt weiter')
}

async function pruefeSchieber(seite) {
  await oeffne(seite, encodeURIComponent(ERSTE))
  const schieber = seite.locator('.zeit-regler input[type="range"]')
  await schieber.evaluate((el) => {
    el.value = String(17 * 60 + 40)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  assert.equal(await seite.locator('.zeit-regler output').textContent(), '17:40', 'beim Ziehen wandert die Anzeige mit')
  await seite.waitForTimeout(1000)
  assert.equal(await hashZeit(seite), ERSTE, 'beim Ziehen bleibt der Link, es laden keine Zellen neu')
  await schieber.evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true })))
  await seite.waitForFunction(() => new URLSearchParams(location.hash.split('?')[1]).get('zeit')?.includes('T17:40'), null, { timeout: 1000 })
  assert.equal(await hashZeit(seite), '2026-10-16T17:40:00+02:00', 'nach dem Loslassen steht die neue Zeit im Link')
}

async function main() {
  const { browser, seite, fremde } = await starteBuehne()
  try {
    await pruefeEinfrieren(seite)
    await pruefeFallback(seite)
    await pruefeSchieber(seite)
  } finally {
    await browser.close()
  }
  assert.equal(fremde.length, 0, `Anfragen nach draußen: ${fremde[0]}`)
  console.log('buehne-zeit-pruefen: ok')
}

await main()
