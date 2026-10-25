#!/usr/bin/env node
/**
 * Misst, welche Felder der Wochenstart wirklich liest, und hält sie gegen die Abzugslisten der Kachel-Datei (`shared/wochen-kacheln.ts`).
 *
 * Die App startet in Chromium (`page.route()` liefert aus `dist/`, kein Server) mit einer Wochen-Datei, deren Einträge in Proxys stecken;
 * jeder Lesezugriff auf ein Feld, auch auf ein fehlendes, wird gezählt. Dazu Bedienung (Hover, Stern, Filterfenster, Knöpfe) auf Desktop und
 * Handy, über mehrere Wochen des Bestands (ein Feld, das nur bei Fernsehen, Kino oder Verpasstem gelesen wird, braucht eine Woche mit
 * solchen Terminen). Exit 1, wenn ein gelesenes Feld auf einer Abzugsliste steht.
 *
 * Aufruf: node tools/kachel-felder-messen.mjs [--dist dist] [--tage 2026-10-05,2026-10-19] [--aus lesepfade.json]   (nach `npm run build`)
 * Die vollen Dateien beantwortet die Probe erst nach 40 s, damit der Wochenstart nicht in den vollen Datensatz übergeht.
 */
import { chromium } from 'playwright'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { baueWochenDatei } from '../shared/wochen-datei.ts'
import { RELEASE_OHNE, STREAM_OHNE, TITEL_OHNE, WATCHLINK_OHNE } from '../shared/wochen-kacheln.ts'

const arg = (name, vorgabe) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : vorgabe)
const DIST = path.resolve(arg('--dist', path.join(import.meta.dirname, '..', 'dist')))
const TAGE = arg('--tage', '2026-07-27,2026-09-07,2026-10-05,2026-10-19,2026-11-02,2026-11-30,2027-01-11').split(',')
const AUS = arg('--aus')
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }
const EIN_PUNKT = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const voll = (name) => JSON.parse(readFileSync(path.join(DIST, 'data', name), 'utf8'))

const PROXY = `
window.__gelesen = {}
const merke = (pfad) => { window.__gelesen[pfad] = (window.__gelesen[pfad] || 0) + 1 }
const umhuelle = (objekt, pfad) => {
  if (objekt === null || typeof objekt !== 'object') return objekt
  return new Proxy(objekt, {
    get(ziel, name, empfaenger) {
      const wert = Reflect.get(ziel, name, empfaenger)
      if (typeof name !== 'string') return wert
      if (Array.isArray(ziel)) return typeof wert === 'object' && wert ? umhuelle(wert, pfad) : wert
      merke(pfad + '.' + name)
      return typeof wert === 'object' && wert ? umhuelle(wert, pfad + '.' + name) : wert
    },
    ownKeys(ziel) {
      merke(pfad + '#keys')
      return Reflect.ownKeys(ziel)
    },
  })
}
const echt = Response.prototype.json
Response.prototype.json = async function () {
  const d = await echt.call(this)
  if (!this.url.includes('/data/woche-kacheln')) return d
  return { von: d.von, bis: d.bis, titles: umhuelle(d.titles, 'title'), releases: umhuelle(d.releases, 'release'), events: umhuelle(d.events, 'event') }
}
`

async function bedienen(seite) {
  const karten = seite.locator('article')
  for (let i = 0; i < Math.min(8, await karten.count()); i++) await karten.nth(i).hover().catch(() => {})
  await seite.locator('article button[aria-pressed]').first().click({ timeout: 800 }).catch(() => {})
  await seite.mouse.wheel(0, 3000)
  const knoepfe = seite.locator('main button, nav button, header button')
  for (let i = 0; i < Math.min(await knoepfe.count(), 60); i++) await knoepfe.nth(i).click({ timeout: 400 }).catch(() => {})
  const fenster = seite.locator('[role=dialog] button, [role=dialog] input[type=checkbox], [role=dialog] label')
  for (let i = 0; i < Math.min(await fenster.count(), 120); i++) await fenster.nth(i).click({ timeout: 500 }).catch(() => {})
}

async function lauf(browser, tag, breite, woche, bedienung) {
  const kontext = await browser.newContext({ viewport: { width: breite, height: 900 }, serviceWorkers: 'block' })
  await kontext.clock.setFixedTime(new Date(`${tag}T12:00:00Z`))
  await kontext.addInitScript(PROXY)
  await kontext.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname !== 'ak.test') return route.fulfill({ status: 200, contentType: 'image/png', body: EIN_PUNKT })
    if (/\/data\/(titles-core|releases|events)\.json$/.test(url.pathname)) await new Promise((fertig) => setTimeout(fertig, 40000))
    if (/\/data\/woche-kacheln\.json$/.test(url.pathname)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(woche) })
    const datei = path.join(DIST, url.pathname === '/' ? '/index.html' : url.pathname)
    if (!datei.startsWith(DIST) || !existsSync(datei)) return route.fulfill({ status: 404, body: '' })
    let inhalt = await readFile(datei)
    if (datei.endsWith('index.html')) inhalt = Buffer.from(inhalt.toString('utf8').replace(/var W = \{[^}]*\};/, () => `var W = ${JSON.stringify({ von: woche.von, bis: woche.bis })};`))
    return route.fulfill({ status: 200, contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream', body: inhalt })
  })
  const seite = await kontext.newPage()
  await seite.goto('http://ak.test/#/woche', { waitUntil: 'load' })
  await seite.locator('article').first().waitFor({ timeout: 20000 }).catch(() => {})
  await seite.waitForTimeout(600)
  const wochenpfad = await seite.evaluate(() => window.__akWoche === true)
  if (bedienung) await bedienung(seite)
  await seite.waitForTimeout(600)
  const gelesen = await seite.evaluate(() => window.__gelesen)
  await kontext.close()
  return { gelesen, wochenpfad }
}

/** Gelesene Pfade, die auf einer Abzugsliste stehen (`title.titleDe`, `title.streams.url`, `release.sources` …). */
export function verlorene(pfade) {
  const regeln = [
    ['title.', TITEL_OHNE],
    ['release.', RELEASE_OHNE],
    ['title.streams.', STREAM_OHNE],
    ['title.watchLinks.', WATCHLINK_OHNE],
  ]
  return pfade.filter((pfad) => regeln.some(([vorsatz, liste]) => pfad.startsWith(vorsatz) && liste.includes(pfad.slice(vorsatz.length).split('.')[0])))
}

async function main() {
  const titles = voll('titles-core.json')
  const releases = voll('releases.json')
  const events = voll('events.json')
  const browser = await chromium.launch()
  const gesamt = {}
  const fehler = []
  for (const tag of TAGE) {
    const woche = baueWochenDatei(tag, titles, releases, events)
    for (const breite of [1280, 390]) {
      const r = await lauf(browser, tag, breite, woche, breite === 1280 ? bedienen : null)
      if (!r.wochenpfad) fehler.push(`${tag} ${breite}: Wochenpfad nicht gewählt, nichts gemessen`)
      for (const [pfad, n] of Object.entries(r.gelesen)) gesamt[pfad] = (gesamt[pfad] ?? 0) + n
    }
  }
  await browser.close()
  const weg = verlorene(Object.keys(gesamt))
  if (AUS) writeFileSync(AUS, JSON.stringify(Object.fromEntries(Object.entries(gesamt).sort()), null, 1))
  if (weg.length) fehler.push(`gelesen, aber nicht in der Kachel-Datei: ${weg.join(', ')}`)
  if (fehler.length) {
    console.error(`✖ Kachel-Felder: ${fehler.join('; ')}`)
    process.exitCode = 1
    return
  }
  console.log(`  ✓ Kachel-Felder: ${Object.keys(gesamt).length} Lesepfade in ${TAGE.length} Wochen, keiner auf einer Abzugsliste`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main()
