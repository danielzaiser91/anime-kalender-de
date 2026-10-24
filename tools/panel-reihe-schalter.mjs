#!/usr/bin/env node
/**
 * Prüft die Reihen-Box im Detail-Panel nach einer Bedienfolge, nicht nur nach dem Laden (24.10.2026):
 * „Teile ohne Synchro zeigen“ an → Spur ganz nach rechts und zurück zum Anfang scrollen → Schalter aus.
 * Danach darf keine Spur Pfeile (‹ ›) zeigen, die nicht überläuft; bei überlaufender Spur gehören sie dazu.
 * Anlass: Pfeile blieben nach dieser Folge stehen (Daniel, t/12416), weil die Messung die Kartenzahl nicht beobachtete.
 * Aufruf: node tools/panel-reihe-schalter.mjs [--dist <Ordner>]     (Teil von `npm run check:panel`)
 */
import { chromium } from 'playwright'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { distPruefen } from './dist-frisch.mjs'
import { akVon } from './ak-von.mjs'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const WURZEL = path.resolve(import.meta.dirname, '..')
const arg = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined)
const EIN_PUNKT = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' }

/** Antwortet aus `dist` für `ak.test`, alles andere mit einem Bildpunkt (kein Netz, kein Server). */
export function antwortAus(dist) {
  return async (route) => {
    const url = new URL(route.request().url())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return route.continue()
    if (url.hostname !== 'ak.test') return route.fulfill({ status: 200, contentType: 'image/png', body: EIN_PUNKT })
    const datei = path.join(dist, url.pathname === '/' ? '/index.html' : url.pathname)
    if (!datei.startsWith(dist) || !existsSync(datei)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream', body: await readFile(datei) })
  }
}

/** Titel mit Reihe, deren Teile ohne Synchro standardmäßig ausgeblendet sind (Ein Stück Reihe, die Daniel meldete). */
const TITEL = akVon('128400')
const SCHALTER = /Teile ohne Synchro zeigen/

/** Je Spur der Reihen-Box: läuft sie über, und stehen Pfeile in ihrer Gruppe? */
export function messeSpuren(seite) {
  return seite.evaluate(() =>
    [...document.querySelectorAll('[data-reihe-liste] [role=tablist]')].map((spur) => {
      const gruppe = spur.parentElement
      const pfeile = [...gruppe.querySelectorAll('button[aria-controls]')].filter((b) => b.getBoundingClientRect().width > 0).length
      return { karten: spur.querySelectorAll('[role=tab]').length, ueberlaeuft: spur.scrollWidth > spur.clientWidth + 1, pfeile }
    }),
  )
}

/** Texte der Verstöße: Pfeile an einer Spur, die nicht überläuft, oder fehlende Pfeile an einer, die überläuft. */
export function pfeilFehler(spuren, wann) {
  const fehler = []
  spuren.forEach((s, i) => {
    if (!s.ueberlaeuft && s.pfeile > 0) fehler.push(`${wann}: Spur ${i + 1} (${s.karten} Karten) läuft nicht über, zeigt aber ${s.pfeile} Pfeile`)
    if (s.ueberlaeuft && s.pfeile === 0) fehler.push(`${wann}: Spur ${i + 1} (${s.karten} Karten) läuft über, zeigt aber keine Pfeile`)
  })
  return fehler
}

async function main() {
  if (!distPruefen(WURZEL)) return
  const browser = await chromium.launch()
  const seite = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await seite.route('**/*', antwortAus(path.resolve(arg('--dist') ?? path.join(WURZEL, 'dist'))))
  await seite.goto(`http://ak.test/#/datenbank?t=${TITEL}`, { waitUntil: 'networkidle' })
  await seite.locator('[data-reihe-liste] [role=tablist]').first().waitFor({ state: 'visible', timeout: 20_000 })
  await seite.waitForTimeout(400)
  const fehler = []
  const vorher = await messeSpuren(seite)
  fehler.push(...pfeilFehler(vorher, 'nach dem Öffnen'))
  await seite.getByText(SCHALTER).click()
  await seite.waitForTimeout(400)
  const an = await messeSpuren(seite)
  if (!an.some((s) => s.ueberlaeuft)) fehler.push('Vorbedingung: mit eingeblendeten Teilen läuft keine Spur über (Titel passt nicht mehr)')
  fehler.push(...pfeilFehler(an, 'Schalter an'))
  await seite.evaluate(() => document.querySelectorAll('[data-reihe-liste] [role=tablist]').forEach((s) => (s.scrollLeft = s.scrollWidth)))
  await seite.waitForTimeout(400)
  await seite.evaluate(() => document.querySelectorAll('[data-reihe-liste] [role=tablist]').forEach((s) => (s.scrollLeft = 0)))
  await seite.waitForTimeout(400)
  await seite.getByText(SCHALTER).click()
  await seite.waitForTimeout(600)
  const aus = await messeSpuren(seite)
  if (aus.every((s) => s.ueberlaeuft)) fehler.push('Vorbedingung: nach dem Ausschalten läuft jede Spur über (Titel passt nicht mehr)')
  fehler.push(...pfeilFehler(aus, 'Schalter aus'))
  await browser.close()
  console.log(`panel-reihe-schalter: Titel ${TITEL}, Spuren vorher ${JSON.stringify(vorher)}, an ${JSON.stringify(an)}, aus ${JSON.stringify(aus)}`)
  for (const f of fehler) console.error(`  ✕ ${f}`)
  console.log(fehler.length ? `panel-reihe-schalter: ${fehler.length} Verstöße` : 'panel-reihe-schalter: ok (Pfeile folgen dem Überlauf nach Schalter an, Scrollen, Schalter aus)')
  if (fehler.length) process.exitCode = 1
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main()
