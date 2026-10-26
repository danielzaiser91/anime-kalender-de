#!/usr/bin/env node
/**
 * Prüft den Quickfix des Mockups „Suchhinweis“ gegen `buehne-dist/` (ohne Server, wie `buehne-zustand-pruefen.mjs`):
 * Der Knopf löst genau die Filter, die den exakten Treffer verstecken — von 0 auf mindestens 1 Ergebnis, ohne mehr zu entfernen.
 *
 * - Hajime no Ippo mit Jahr 2003: Jahr und Synchro-Schalter verstecken den exakten Treffer, der Knopf löst beide.
 * - Tokyo Revengers mit Jahr 2019: der exakte Treffer hat Synchro, nur das Jahr stört; der Synchro-Schalter bleibt aus.
 * - Hajime no Ippo ohne Filter: nur der Synchro-Schalter, Knopf „Anzeigen“.
 *
 * Aufruf: node tools/suchhinweis-quickfix-pruefen.mjs        (nach `npm run buehne:bauen`; Exit 1 bei einem Fehler)
 */
import assert from 'node:assert/strict'
import { starteBuehne } from './buehne-seite.mjs'

const adresse = (variante, fall) => `http://buehne.test/buehne.html#zelle?mockup=suchhinweis-ohne-synchro&v=${variante}&fall=${fall}&thema=hell`
const HINWEIS = '[data-suchhinweis]'
const SYNCHRO = /ohne deutsche Synchro/

async function lade(seite, variante, fall) {
  await seite.goto('about:blank')
  await seite.goto(adresse(variante, fall), { waitUntil: 'load' })
  await seite.locator(HINWEIS).first().waitFor({ timeout: 30_000 })
}

const ergebnisse = async (seite) => Number(((await seite.locator('body').innerText()).match(/([\d.]+) Ergebnisse? für/) ?? [])[1]?.replace('.', ''))
const synchroAn = (seite) => seite.getByRole('checkbox', { name: SYNCHRO }).first().isChecked()

async function pruefeFall(seite, variante, fall, { knopf, text, synchro }) {
  await lade(seite, variante, fall)
  assert.equal(await ergebnisse(seite), 0, `${variante}/${fall}: vorher 0 Ergebnisse`)
  const hinweis = await seite.locator(HINWEIS).first().innerText()
  assert.match(hinweis, text, `${variante}/${fall}: Text des Hinweises: ${hinweis}`)
  assert.match(hinweis, /^·\s/, `${variante}/${fall}: Trenner „·“ vor dem Hinweis: ${hinweis}`)
  assert.doesNotMatch(await seite.locator('body').innerText(), /Auch Anime ohne deutsche Synchro zeigen/, `${variante}/${fall}: alter Knopf entfällt`)
  assert.equal(await seite.locator(HINWEIS).first().getByRole('button').innerText(), knopf, `${variante}/${fall}: Knopf`)
  assert.equal(await synchroAn(seite), false, `${variante}/${fall}: Synchro-Schalter vorher aus`)
  await seite.locator(HINWEIS).first().getByRole('button').click()
  await seite.waitForFunction(() => /[1-9][\d.]* Ergebnisse? für/.test(document.body.innerText), null, { timeout: 30_000 })
  assert.equal(await synchroAn(seite), synchro, `${variante}/${fall}: Synchro-Schalter nach dem Knopf`)
  if (synchro) assert.equal(await seite.locator(HINWEIS).count(), 0, `${variante}/${fall}: bei eingeschaltetem Schalter kein Hinweis mehr`)
  const jahrChips = await seite.locator('button[aria-label*="2003"], button[aria-label*="2019"]').count()
  assert.equal(jahrChips, 0, `${variante}/${fall}: der Jahresfilter ist entfernt`)
}

async function main() {
  const { browser, seite, fremde } = await starteBuehne()
  try {
    await seite.setViewportSize({ width: 1200, height: 900 })
    for (const v of ['A']) {
      await pruefeFall(seite, v, 'hajime-no-ippo-jahr', { knopf: 'Filter entfernen', text: /Jahr 2003, ohne deutsche Synchro/, synchro: true })
      await pruefeFall(seite, v, 'tokyo-revengers-jahr', { knopf: 'Filter entfernen', text: /durch: Jahr 2019 Filter entfernen$/, synchro: false })
      await pruefeFall(seite, v, 'hajime-no-ippo', { knopf: 'Anzeigen', text: /6 Treffer ohne Synchro, davon 1 exakt/, synchro: true })
    }
  } finally {
    await browser.close()
  }
  assert.equal(fremde.length, 0, `Anfragen nach draußen: ${fremde[0]}`)
  console.log('suchhinweis-quickfix-pruefen: ok (3 Fälle, Variante A)')
}

await main()
