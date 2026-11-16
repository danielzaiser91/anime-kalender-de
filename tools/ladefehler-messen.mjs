/**
 * Browserprobe für Datenaussetzer (16.11.2026, `releases.json` mit 503): gegen `dist/`, headless, ohne Netz.
 *  1. Aussetzer: `releases.json` antwortet einmal mit 503 → die Seite lädt normal, der Abruf kam zweimal.
 *  2. Dauerstörung: immer 503 → der Besuchersatz mit Knopf steht da, ohne „npm“, „.json“ oder Statuscode; Bilder je Breite und Thema.
 *  3. Erholung: Störung behoben, Klick auf „Erneut versuchen“ → die Seite lädt.
 * Regeln: `ladefehler-urteil.mjs`. Aufruf: `npm run build`, dann `node tools/ladefehler-messen.mjs` (Bilder nach `<Temp>/ak-ladefehler`, mit `--docs` nach `docs/`).
 */
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { bilderOrdner } from './bilder-ordner.mjs'
import { browserDa } from './browser-weiche.mjs'
import { distPruefen } from './dist-frisch.mjs'
import { aussetzerFehler, dauerFehler, erholungFehler, FEHLER_SATZ, KNOPF_NAME } from './ladefehler-urteil.mjs'

const WURZEL = path.resolve(import.meta.dirname, '..')
const DIST = path.join(WURZEL, 'dist')
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
const EIN_PUNKT = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const ADRESSE = 'http://ak.test/#/monat'
const BREITEN = [
  { name: 'desktop', width: 1600, height: 900, handy: false },
  { name: 'handy', width: 390, height: 844, handy: true },
]

/** Antwortet aus `dist/`; `stoerung.aus(url)` entscheidet je Anfrage, ob stattdessen 503 kommt. */
function antworter(stoerung, zaehler) {
  return async (route) => {
    const url = new URL(route.request().url())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return route.continue()
    if (url.hostname !== 'ak.test') return route.fulfill({ status: 200, contentType: 'image/png', body: EIN_PUNKT })
    if (/\/releases\.json$/.test(url.pathname)) {
      zaehler.releases++
      if (stoerung.aus(zaehler.releases)) return route.fulfill({ status: 503, body: '' })
    }
    const datei = path.join(DIST, url.pathname === '/' ? '/index.html' : url.pathname)
    if (!datei.startsWith(DIST) || !existsSync(datei)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream', body: await readFile(datei) })
  }
}

async function neueSeite(browser, b, thema, stoerung) {
  const kontext = await browser.newContext({ viewport: { width: b.width, height: b.height }, hasTouch: b.handy, isMobile: b.handy, colorScheme: thema === 'dunkel' ? 'dark' : 'light' })
  const seite = await kontext.newPage()
  const zaehler = { releases: 0 }
  await seite.route('**/*', antworter(stoerung, zaehler))
  return { kontext, seite, zaehler }
}

/** Wartet auf einen Zustand; läuft die Frist ab, steht der Grund im Log und das Urteil folgt aus der Messung danach. */
async function warteAuf(stelle, state) {
  try {
    await stelle.waitFor({ state, timeout: 30_000 })
  } catch (e) {
    console.error(`  Frist abgelaufen (${state}): ${String(e).split('\n')[0]}`)
  }
}

const fehlerDa = (seite) => seite.getByText(FEHLER_SATZ).isVisible()
/** Geladen heißt: das Lade-Gerüst ist weg und der Kopf steht. */
async function geladen(seite) {
  await warteAuf(seite.locator('[role=status]').first(), 'detached')
  return (await seite.locator('header').first().isVisible()) && !(await fehlerDa(seite))
}

async function aussetzer(browser, fehler) {
  const { kontext, seite, zaehler } = await neueSeite(browser, BREITEN[0], 'dunkel', { aus: (n) => n === 1 })
  await seite.goto(ADRESSE)
  const ok = await geladen(seite)
  fehler.push(...aussetzerFehler({ anfragen: zaehler.releases, fehlerSichtbar: await fehlerDa(seite), geladen: ok }).map((f) => `Aussetzer: ${f}`))
  await kontext.close()
}

async function messeDauer(seite, zaehler) {
  const knopf = seite.getByRole('button', { name: KNOPF_NAME, exact: true })
  const box = (await knopf.count()) ? await knopf.boundingBox() : null
  const trifft = box ? await knopf.evaluate((e) => { const r = e.getBoundingClientRect(); return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) }) : false
  return { text: await seite.locator('body').innerText(), knopf: box ? { w: box.width, h: box.height, trifft } : undefined, anfragen: zaehler.releases }
}

async function dauerstoerung(browser, bilder, fehler) {
  for (const b of BREITEN) {
    for (const thema of ['dunkel', 'hell']) {
      const stoerung = { aus: () => true }
      const { kontext, seite, zaehler } = await neueSeite(browser, b, thema, stoerung)
      await seite.goto(ADRESSE)
      await warteAuf(seite.getByText(FEHLER_SATZ), 'visible')
      const name = `${b.name}-${thema}`
      fehler.push(...dauerFehler(await messeDauer(seite, zaehler)).map((f) => `Dauerstörung ${name}: ${f}`))
      await seite.screenshot({ path: path.join(bilder, `ladefehler-${name}.png`) })
      if (b === BREITEN[0] && thema === 'dunkel') {
        stoerung.aus = () => false
        await seite.getByRole('button', { name: KNOPF_NAME, exact: true }).click()
        const ok = await geladen(seite)
        fehler.push(...erholungFehler({ fehlerSichtbar: await fehlerDa(seite), geladen: ok }).map((f) => `Erholung: ${f}`))
      }
      await kontext.close()
    }
  }
}

async function main() {
  if (!distPruefen(WURZEL)) return
  if (!browserDa('ladefehler-messen', chromium)) return
  const bilder = bilderOrdner(WURZEL, 'ak-ladefehler')
  const browser = await chromium.launch()
  const fehler = []
  await aussetzer(browser, fehler)
  await dauerstoerung(browser, bilder, fehler)
  await browser.close()
  for (const f of fehler) console.error(`  ✖ ${f}`)
  console.log(fehler.length ? `ladefehler-messen: ${fehler.length} Befund(e)` : 'ladefehler-messen: ok (Aussetzer lädt, Dauerstörung zeigt Besuchersatz mit Knopf in 4 Zellen, Erholung per Klick)')
  if (fehler.length) process.exitCode = 1
}

await main()
