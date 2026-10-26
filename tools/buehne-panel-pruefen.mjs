#!/usr/bin/env node
/**
 * Prüft gegen `buehne-dist/`, dass ein Klick auf eine Kachel in jedem Mockup mit Kacheln das echte Detail-Panel öffnet
 * (wie in der App), mit Daten statt „Zu diesem Eintrag liegen keine Metadaten vor“, und dass Escape es schließt.
 *
 * Anlass (26.10.2026, Daniel): „Detail panel öffnet nicht im mockup“. Zwei Löcher: der Ausschnitt `kachel` übergab dem Raster
 * ein leeres `onOpenTitle`; im Mockup `suchhinweis-ohne-synchro` lud der Hinweis einen zweiten Datensatz, und das Panel der App
 * fand die Titel ohne Synchro nicht.
 *
 * Je Mockup: der erste Fall; ein Mockup ohne Kachel im Ausschnitt (Panel, Filter, Design, Entwurf) wird übersprungen und genannt.
 * Dazu feste Zusatzfälle (`ZUSATZ`): Fälle, in denen die Kacheln erst nach einem Knopf erscheinen.
 *
 * Aufruf: node tools/buehne-panel-pruefen.mjs        (nach `npm run buehne:bauen`; Exit 1 bei einem Fehler)
 */
import assert from 'node:assert/strict'
import { listeMockups, oeffneZellen, starteBuehne } from './buehne-seite.mjs'

const KARTE = 'div.group.cursor-pointer, article'
const DIALOG = '[role="dialog"]'
const ZELLE = 'nachher-1200-hell'
/** Mindestzahl geprüfter Fälle: Werden es weniger, hat die Suche nach Kacheln versagt, nicht das Panel. */
const MINDESTENS = 4

const ZUSATZ = [{ mockup: 'suchhinweis-ohne-synchro', fall: 'hajime-no-ippo', knopf: 'Anzeigen' }]

async function pruefe(seite, { mockup, fall, knopf }) {
  const zellen = await oeffneZellen(seite, { mockup, variante: 'A', fall, teil: 'nachher' })
  const f = (zellen.find((z) => z.schluessel === ZELLE) ?? zellen.find((z) => z.schluessel.startsWith('nachher')))?.frame
  assert.ok(f, `${mockup}/${fall}: keine Nachher-Zelle`)
  if (knopf) await f.getByRole('button', { name: knopf }).first().click()
  const karte = f.locator(KARTE).first()
  if (!knopf && (await f.locator(KARTE).count()) === 0) return false
  await karte.waitFor({ timeout: 10_000 })
  await karte.click()
  await f.locator(DIALOG).first().waitFor({ timeout: 10_000 })
  const text = await f.locator(DIALOG).first().innerText()
  assert.doesNotMatch(text, /keine Metadaten/, `${mockup}/${fall}: Panel ohne Daten: ${text.slice(0, 80)}`)
  await f.page().keyboard.press('Escape')
  await f.locator(DIALOG).first().waitFor({ state: 'detached', timeout: 10_000 })
  return true
}

async function main() {
  const { browser, seite, fremde } = await starteBuehne()
  const geprueft = []
  const uebersprungen = []
  try {
    await seite.setViewportSize({ width: 1200, height: 900 })
    const alle = (await listeMockups(seite)).map((m) => ({ mockup: m.name, fall: m.faelle[0] }))
    for (const fall of [...alle, ...ZUSATZ]) {
      const ok = await pruefe(seite, fall)
      const name = `${fall.mockup}/${fall.fall}${fall.knopf ? '+' + fall.knopf : ''}`
      if (ok) geprueft.push(name)
      else uebersprungen.push(name)
    }
  } finally {
    await browser.close()
  }
  assert.ok(geprueft.length >= MINDESTENS, `nur ${geprueft.length} Fälle mit Kachel gefunden (erwartet ≥ ${MINDESTENS}): ${geprueft}`)
  assert.equal(fremde.length, 0, `Anfragen nach draußen: ${fremde[0]}`)
  console.log(`buehne-panel-pruefen: ok (${geprueft.length} Fälle: ${geprueft.join(', ')}; ohne Kachel übersprungen: ${uebersprungen.join(', ')})`)
}

await main()
