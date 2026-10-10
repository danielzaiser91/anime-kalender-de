#!/usr/bin/env node
/**
 * Prüft, dass geteilte Adressen beim Empfänger gleich aussehen: die Schalter der Datenbank (`ohne=`, `staffeln=`)
 * und der Reiter der Saison-Ansicht (`s=`). Gerendert wird `dist/` ohne Server (`page.route()`), wie in `ansicht-bild.mjs`.
 *
 * Aufruf: node tools/adress-schalter-pruefen.mjs     (erst `npm run build`)
 * Exit 1, wenn eine Prüfung rot ist.
 */
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const DIST = path.resolve(import.meta.dirname, '..', 'dist')
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' }
const EIN_PUNKT = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const OHNE = 'Anime ohne deutsche Synchro'
const STAFFELN = 'Staffeln zusammenfassen'

const roteBefunde = []
const pruefe = (name, ok, ist) => {
  console.log(`${ok ? 'ok ' : '✕  '} ${name}${ok ? '' : ` — ist: ${ist}`}`)
  if (!ok) roteBefunde.push(name)
}

async function antworteAusDist(route) {
  const url = new URL(route.request().url())
  if (url.hostname !== 'ak.test') return route.fulfill({ status: 200, contentType: 'image/png', body: EIN_PUNKT })
  const datei = path.join(DIST, url.pathname === '/' ? '/index.html' : url.pathname)
  if (!datei.startsWith(DIST) || !existsSync(datei)) return route.fulfill({ status: 404, body: '' })
  return route.fulfill({ status: 200, contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream', body: await readFile(datei) })
}

/** Öffnet eine Adresse in einer frischen Seite (leerer Speicher wie beim Empfänger eines geteilten Links). */
async function oeffne(browser, adresse, speicher = {}) {
  const kontext = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await kontext.addInitScript((werte) => {
    for (const [k, v] of Object.entries(werte)) if (!localStorage.getItem('__init')) localStorage.setItem(k, v)
    localStorage.setItem('__init', '1')
  }, speicher)
  const seite = await kontext.newPage()
  await seite.route('**/*', antworteAusDist)
  await seite.goto(adresse, { waitUntil: 'networkidle' })
  await seite.locator('header').first().waitFor({ state: 'visible', timeout: 20_000 })
  await seite.waitForTimeout(2500)
  return seite
}

const an = (seite, name) => seite.getByRole('checkbox', { name }).first().isChecked()
const hash = (seite) => seite.evaluate(() => location.hash)
const verlauf = (seite) => seite.evaluate(() => history.length)

async function pruefeDatenbank(browser) {
  const s = await oeffne(browser, 'http://ak.test/#/datenbank?q=yaiba&g=Fantasy&ohne=1&staffeln=0')
  pruefe('Datenbank: Suche aus der Adresse', (await s.locator('input[type=search],input[type=text]').first().inputValue()) === 'yaiba')
  pruefe('Datenbank: ohne=1 schaltet „ohne Synchro“ ein', await an(s, OHNE))
  pruefe('Datenbank: staffeln=0 schaltet „Staffeln zusammenfassen“ aus', !(await an(s, STAFFELN)))
  pruefe('Datenbank: der Link überschreibt die gespeicherte Einstellung nicht', (await s.evaluate(() => localStorage.getItem('groupSeasons'))) === null)

  const vorher = await verlauf(s)
  await s.getByText(STAFFELN).first().click()
  await s.waitForTimeout(500)
  const h = await hash(s)
  pruefe('Umlegen: staffeln=1 steht in der Adresse, q, g und ohne bleiben', /q=yaiba/.test(h) && /g=Fantasy/.test(h) && /ohne=1/.test(h) && /staffeln=1/.test(h), h)
  pruefe('Umlegen: kein neuer Verlaufseintrag', (await verlauf(s)) === vorher, `${vorher} -> ${await verlauf(s)}`)
  await s.getByText(OHNE).first().click()
  await s.waitForTimeout(500)
  const h2 = await hash(s)
  pruefe('Umlegen: ohne verschwindet aus der Adresse, der Rest bleibt', !/ohne=/.test(h2) && /q=yaiba/.test(h2) && /staffeln=1/.test(h2), h2)
  pruefe('Umlegen: gespeichert wird, was umgelegt wurde', (await s.evaluate(() => localStorage.getItem('groupSeasons'))) === '1')
  await s.context().close()

  const f = await oeffne(browser, 'http://ak.test/#/datenbank?q=yaiba&ohne=x&staffeln=7')
  pruefe('Ungültige Werte: Voreinstellung (ohne aus, Staffeln an)', !(await an(f, OHNE)) && (await an(f, STAFFELN)))
  await f.context().close()

  const g = await oeffne(browser, 'http://ak.test/#/datenbank?q=yaiba', { groupSeasons: '0' })
  pruefe('Ohne Parameter: der gespeicherte Wert gilt (Staffeln aus)', !(await an(g, STAFFELN)))
  await g.context().close()
}

/** Datenbank → Woche → Datenbank: der Stand kommt zurück (Adresse, sonst Sitzung/Speicher), ohne dass ein Link die Einstellung überschreibt. */
async function pruefeWechsel(browser) {
  const zu = async (seite, ziel) => {
    await seite.evaluate((h) => { location.hash = h }, ziel)
    await seite.waitForTimeout(800)
  }
  const s = await oeffne(browser, 'http://ak.test/#/datenbank?q=yaiba')
  await s.getByText(OHNE).first().click()
  await s.waitForTimeout(400)
  await zu(s, '#/woche')
  await zu(s, '#/datenbank')
  pruefe('Wechsel: „ohne Synchro“ bleibt nach Datenbank → Woche → Datenbank an', await an(s, OHNE))
  pruefe('Wechsel: ohne=1 steht wieder in der Adresse', /ohne=1/.test(await hash(s)), await hash(s))
  await s.context().close()

  const l = await oeffne(browser, 'http://ak.test/#/datenbank?q=yaiba&ohne=1&staffeln=0')
  await zu(l, '#/woche')
  await zu(l, '#/datenbank')
  pruefe('Wechsel (Link): beide Schalter kommen zurück', (await an(l, OHNE)) && !(await an(l, STAFFELN)))
  pruefe('Wechsel (Link): der Speicher des Empfängers bleibt unberührt', (await l.evaluate(() => localStorage.getItem('groupSeasons'))) === null)
  await l.context().close()
}

async function pruefeSaison(browser) {
  const reiter = (seite) => seite.evaluate(() => [...document.querySelectorAll('[role=tab]')].findIndex((t) => t.getAttribute('aria-selected') === 'true'))
  const s = await oeffne(browser, 'http://ak.test/#/saison?s=zuletzt')
  pruefe('Saison: s=zuletzt wählt den zweiten Reiter', (await reiter(s)) === 1, await reiter(s))
  const vorher = await verlauf(s)
  await s.locator('[role=tab]').nth(2).click()
  await s.waitForTimeout(300)
  pruefe('Saison: Wechsel schreibt s=ausblick', (await hash(s)) === '#/saison?s=ausblick', await hash(s))
  pruefe('Saison: kein neuer Verlaufseintrag', (await verlauf(s)) === vorher)
  await s.locator('[role=tab]').nth(0).click()
  await s.waitForTimeout(300)
  pruefe('Saison: die Voreinstellung steht nicht in der Adresse', (await hash(s)) === '#/saison', await hash(s))
  await s.context().close()

  const f = await oeffne(browser, 'http://ak.test/#/saison?s=quatsch')
  pruefe('Saison: ungültiger Wert fällt still auf „jetzt“', (await reiter(f)) === 0, await reiter(f))
  await f.context().close()
}

async function main() {
  if (!existsSync(path.join(DIST, 'index.html'))) {
    console.error('dist/ fehlt — erst `npm run build`.')
    process.exitCode = 1
    return
  }
  const browser = await chromium.launch()
  try {
    await pruefeDatenbank(browser)
    await pruefeWechsel(browser)
    await pruefeSaison(browser)
  } finally {
    await browser.close()
  }
  process.exitCode = roteBefunde.length ? 1 : 0
}

await main()
