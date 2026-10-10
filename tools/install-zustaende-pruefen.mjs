#!/usr/bin/env node
/**
 * Prüft, dass das Install-Angebot an genau einer Stelle steht — oder an keiner (Daniel, 09.10.2026).
 *
 * Zählt je Lage (Browser bietet an / nicht / abgelehnt / iOS / installiert) und Breite (320–439 px,
 * Desktop), wie viele Stellen (Kopf-Knopf, Glocken-Menü, Seitenfuß) sichtbar sind. Soll: Desktop und
 * installiert 0, sonst genau 1. Die Tabelle steht in `web/src/lib/install-stellen.ts`.
 *
 * Ohne Server, wie `ansicht-bild.mjs`: `page.route()` beantwortet jede Anfrage aus `dist/`.
 * Aufruf: node tools/install-zustaende-pruefen.mjs [--dist <ordner>] [--bilder <ordner>]
 *         npm run check:install   (nach `npm run build`)
 */
import { chromium } from 'playwright'
import { readFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const WURZEL = path.resolve(import.meta.dirname, '..')
const arg = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined)
const DIST = path.resolve(arg('--dist') ?? path.join(WURZEL, 'dist'))
const BILDER = arg('--bilder') ? path.resolve(arg('--bilder')) : undefined
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }
const EIN_PUNKT = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
// Erst nach dem Laden feuern: Ein Zeitgeber ab Dokumentbeginn verfehlte unter Last den Hörer in `pwa.ts` (Flackern, 10.10.2026).
const EREIGNIS = `const e = new Event('beforeinstallprompt'); e.prompt = async () => {}; e.userChoice = Promise.resolve({ outcome: 'dismissed' }).then((r) => { window.__entschieden = true; return r }); window.dispatchEvent(e)`
const STANDALONE = `const o = window.matchMedia.bind(window); window.matchMedia = (q) => q.includes('display-mode: standalone') ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : o(q);`

const LAGEN = {
  angebot: { ereignis: true },
  'ohne-angebot': {},
  abgelehnt: { ereignis: true, ablehnen: true },
  ios: { ua: IOS_UA },
  installiert: { init: STANDALONE, ereignis: true, erwartet: 0 },
}
const BREITEN = [320, 389, 390, 439, 'desktop']

const sichtbar = async (loc) => {
  let n = 0
  for (const el of await loc.all()) if (await el.isVisible()) n++
  return n
}

async function fall(browser, name, lage, breite) {
  const desktop = breite === 'desktop'
  const ctx = await browser.newContext({
    viewport: { width: desktop ? 1280 : breite, height: desktop ? 900 : 780 },
    isMobile: !desktop,
    hasTouch: !desktop,
    ...(lage.ua ? { userAgent: lage.ua } : {}),
  })
  // Das einmalige Popup ist keine Dauerstelle und würde die Klicks abfangen.
  await ctx.addInitScript(`try { localStorage.setItem('installDialogSeen', '1') } catch {}`)
  if (lage.init) await ctx.addInitScript(lage.init)
  await ctx.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname !== 'ak.test') return route.fulfill({ status: 200, contentType: 'image/png', body: EIN_PUNKT })
    const datei = path.join(DIST, url.pathname === '/' ? '/index.html' : url.pathname)
    if (!datei.startsWith(DIST) || !existsSync(datei)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream', body: await readFile(datei) })
  })
  const seite = await ctx.newPage()
  await seite.goto('http://ak.test/#/woche', { waitUntil: 'networkidle' })
  await seite.locator('header').first().waitFor({ state: 'visible', timeout: 20_000 })

  const kopfKnopf = seite.locator('header button[aria-label="App installieren"], header button:has-text("App installieren")')
  const glocke = seite.locator('header button[aria-label^="Abonnieren"]').first()
  await glocke.waitFor({ state: 'visible', timeout: 20_000 })
  const karte =seite.locator('body > div[role="dialog"]')
  if (lage.ereignis) {
    await seite.evaluate(EREIGNIS)
    // Bedingung statt Pause: Ab 390 px muss der Kopf-Knopf erscheinen, bevor gezählt wird.
    if (!desktop && breite >= 390 && lage.erwartet !== 0) await kopfKnopf.first().waitFor({ state: 'visible', timeout: 10_000 })
  }
  if (lage.ablehnen && !desktop) {
    // Wer das Angebot ablehnt, verbraucht das Ereignis — danach bietet der Browser nichts mehr an.
    if (await sichtbar(kopfKnopf)) await kopfKnopf.filter({ visible: true }).first().click()
    else {
      await glocke.click()
      await seite.getByText('App installieren', { exact: true }).first().click()
    }
    // Bedingung statt Pause: Das Angebot ist verbraucht, wenn Kopf-Knopf und Menü wieder zu sind.
    await seite.waitForFunction(() => window.__entschieden === true)
    await kopfKnopf.first().waitFor({ state: 'hidden' })
    await karte.waitFor({ state: 'detached' })
  }
  const kopf = await sichtbar(kopfKnopf)
  await glocke.click()
  await karte.waitFor({ state: 'visible' })
  // Der exakte Text kommt nur im Menü vor; die Kopf-Knöpfe tragen Symbol bzw. „⬇ App installieren“.
  const menueText = await sichtbar(seite.getByText('App installieren', { exact: true }))
  const hinweis = await sichtbar(seite.getByText('Im Browser-Menü', { exact: false }))
  const menue = menueText > 0 || hinweis > 0 ? 1 : 0
  if (BILDER) await seite.screenshot({ path: path.join(BILDER, `glocke-${name}-${breite}.png`) })
  await seite.keyboard.press('Escape')
  await seite.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  const fuss = await sichtbar(seite.locator('footer').getByText('App installieren'))
  await ctx.close()

  const soll = desktop || lage.erwartet === 0 ? 0 : 1
  const summe = kopf + menue + fuss
  return { ok: summe === soll, text: `${summe === soll ? 'ok    ' : 'ROT   '}${name.padEnd(13)} ${String(breite).padEnd(8)} Kopf ${kopf} · Menü ${menue}${hinweis ? ' (Hinweis)' : ''} · Fuß ${fuss} = ${summe} Stellen, soll ${soll}` }
}

async function main() {
  if (!existsSync(path.join(DIST, 'index.html'))) {
    console.error(`${DIST} fehlt — erst \`npm run build\`.`)
    process.exitCode = 1
    return
  }
  if (BILDER) await mkdir(BILDER, { recursive: true })
  const browser = await chromium.launch()
  const faelle = []
  for (const [name, lage] of Object.entries(LAGEN)) for (const b of BREITEN) faelle.push([name, lage, b])
  const ergebnisse = []
  for (let i = 0; i < faelle.length; i += 8) {
    ergebnisse.push(...(await Promise.all(faelle.slice(i, i + 8).map(([n, l, b]) => fall(browser, n, l, b)))))
  }
  await browser.close()
  console.log(ergebnisse.map((e) => e.text).join('\n'))
  const rot = ergebnisse.filter((e) => !e.ok).length
  console.log(rot ? `\n${rot} von ${ergebnisse.length} Lagen verletzen „genau eine Stelle oder keine“.` : `\nInstall-Stellen: ${ergebnisse.length} Lagen, jede mit der vorgesehenen Zahl.`)
  process.exitCode = rot ? 1 : 0
}

await main()
