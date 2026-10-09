#!/usr/bin/env node
/**
 * Prüft die Kopfleiste auf dem Handy: Der Markenname „anime·kalender" steht bei jeder Breite ganz da.
 *
 * Gemessen wird `dist/` (erst `vite build`), ohne Server: `context.route()` beantwortet jede Anfrage aus `dist/`.
 * Handy-Emulation (`isMobile`, `hasTouch`), je Breite × Thema × Route; `beforeinstallprompt` wird künstlich
 * ausgelöst, damit der Installationsknopf da ist, wo er hingehört (ab 390 px).
 *
 * Aufruf: node tools/kopf-pruefen.mjs [--bilder=<Ordner>]     npm run check:kopf
 */
import { chromium } from 'playwright'
import { readFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const DIST = path.resolve(import.meta.dirname, '..', 'dist')
const BREITEN = [320, 359, 360, 375, 389, 390, 393, 412, 439]
const ROUTEN = ['news', 'woche', 'datenbank', 'saison']
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json' }
const EIN_PUNKT = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const bilderOrdner = process.argv.find((a) => a.startsWith('--bilder='))?.slice(9)

/** Im Browser: misst die Kopfleiste und gibt Rechtecke der Bedienelemente zurück. */
function messen() {
  const kopf = document.querySelector('header')
  const r = (el) => {
    const b = el.getBoundingClientRect()
    return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height }
  }
  const sichtbar = (el) => el && el.getClientRects().length > 0
  const marke = kopf.querySelector('a[aria-label]')
  const name = [...marke.querySelectorAll('span')].find((s) => s.textContent.includes('kalender'))
  const knoepfe = {}
  for (const b of kopf.querySelectorAll('button')) {
    const l = b.getAttribute('aria-label') ?? ''
    if (sichtbar(b) && /Suche|Abo|installieren/i.test(l)) knoepfe[/installieren/i.test(l) ? 'install' : /Abo/i.test(l) ? 'abo' : 'suche'] = r(b)
  }
  return {
    marke: r(marke),
    name: r(name),
    nameVoll: name.scrollWidth <= name.clientWidth,
    nameSchrift: getComputedStyle(name).fontSize,
    knoepfe,
    kopfHoehe: r(kopf).h,
    doc: document.documentElement.scrollWidth,
    fenster: window.innerWidth,
  }
}

function befundeVon(m, breite) {
  const f = []
  if (!m.nameVoll) f.push('Name abgeschnitten (scrollWidth > clientWidth)')
  if (m.name.r > breite - 8 || m.name.l < 8) f.push(`Name nicht im Bild (${m.name.l.toFixed(0)}…${m.name.r.toFixed(0)})`)
  if (m.doc > m.fenster) f.push(`waagerechtes Scrollen (${m.doc} > ${m.fenster})`)
  const teile = { marke: m.marke, ...m.knoepfe }
  const namen = Object.keys(teile)
  for (const [i, a] of namen.entries())
    for (const b of namen.slice(i + 1)) {
      const x = teile[a]
      const y = teile[b]
      if (x.l < y.r - 0.5 && y.l < x.r - 0.5) f.push(`Überlappung ${a}/${b}`)
    }
  for (const [n, k] of Object.entries(m.knoepfe)) if (k.w < 43.5 || k.h < 43.5) f.push(`Tippziel ${n} ${k.w.toFixed(0)}×${k.h.toFixed(0)} < 44`)
  for (const [n, k] of Object.entries(m.knoepfe)) if (k.r > breite - 8 + 0.5) f.push(`${n} ragt über den Rand`)
  if (!m.knoepfe.suche || !m.knoepfe.abo) f.push('Suche oder Abo fehlt')
  const installDa = Boolean(m.knoepfe.install)
  if (installDa !== breite >= 390) f.push(`Installationsknopf ${installDa ? 'da' : 'fehlt'} bei ${breite} px`)
  const erwartet = breite < 360 ? '14px' : '16px'
  if (m.nameSchrift !== erwartet) f.push(`Schrift ${m.nameSchrift} statt ${erwartet}`)
  if (m.kopfHoehe < 66 || m.kopfHoehe > 72) f.push(`Kopfhöhe ${m.kopfHoehe.toFixed(0)} px (erwartet ~69)`)
  return f
}

/** Tastatur: Tab erreicht Startseite, Suche und Abo, und der Fokus bleibt im Bild. */
async function tastaturFehler(seite, breite) {
  const gesehen = []
  await seite.evaluate(() => document.activeElement?.blur())
  for (let i = 0; i < 6; i++) {
    await seite.keyboard.press('Tab')
    gesehen.push(await seite.evaluate(() => {
      const e = document.activeElement
      const b = e.getBoundingClientRect()
      return { label: e.getAttribute('aria-label') ?? '', ok: b.left >= 0 && b.right <= window.innerWidth }
    }))
  }
  const f = []
  for (const w of ['Anime-Kalender', 'Suche', 'Abo']) if (!gesehen.some((g) => g.label.includes(w))) f.push(`Tab erreicht „${w}" nicht`)
  if (gesehen.some((g) => !g.ok)) f.push(`Fokus außerhalb des Bildes bei ${breite} px`)
  return f
}

async function main() {
  if (!existsSync(path.join(DIST, 'index.html'))) {
    console.error('dist/ fehlt — erst `vite build`.')
    process.exitCode = 1
    return
  }
  if (bilderOrdner) await mkdir(bilderOrdner, { recursive: true })
  const browser = await chromium.launch()
  let rot = 0
  for (const breite of BREITEN) {
    const ctx = await browser.newContext({ viewport: { width: breite, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, serviceWorkers: 'block' })
    await ctx.addInitScript(() => {
      try { localStorage.setItem('installDialogSeen', '1') } catch { /* ohne Speicher */ }
    })
    await ctx.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return route.continue()
      if (url.hostname !== 'ak.test') return route.fulfill({ status: 200, contentType: 'image/png', body: EIN_PUNKT })
      const datei = path.join(DIST, url.pathname === '/' ? '/index.html' : url.pathname)
      if (!datei.startsWith(DIST) || !existsSync(datei)) return route.fulfill({ status: 404, body: '' })
      return route.fulfill({ status: 200, contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream', body: await readFile(datei) })
    })
    const seite = await ctx.newPage()
    for (const thema of ['hell', 'dunkel']) {
      await seite.emulateMedia({ colorScheme: thema === 'dunkel' ? 'dark' : 'light' })
      for (const route of ROUTEN) {
        await seite.goto('about:blank')
        await seite.goto(`http://ak.test/#/${route}`, { waitUntil: 'networkidle' })
        await seite.locator('header').first().waitFor({ state: 'visible', timeout: 20_000 })
        await seite.evaluate(() => {
          const e = new Event('beforeinstallprompt', { cancelable: true })
          Object.assign(e, { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) })
          window.dispatchEvent(e)
          return document.fonts.ready
        })
        await seite.waitForTimeout(400)
        const m = await seite.evaluate(messen)
        const f = [...befundeVon(m, breite), ...(thema === 'hell' && route === 'news' ? await tastaturFehler(seite, breite) : [])]
        if (bilderOrdner) await seite.screenshot({ path: path.join(bilderOrdner, `kopf-${route}-${breite}-${thema}.png`), clip: { x: 0, y: 0, width: breite, height: 120 } })
        if (f.length) {
          rot++
          console.log(`  ✕ ${breite} px ${thema} #/${route}: ${f.join('; ')}`)
        }
      }
    }
    await ctx.close()
  }
  await browser.close()
  const n = BREITEN.length * 2 * ROUTEN.length
  console.log(rot ? `\n  ✕ ${rot} von ${n} Messungen auffällig` : `  ok  ${n} Messungen (${BREITEN.join(', ')} px, hell/dunkel, ${ROUTEN.length} Routen): Name ganz, keine Überlappung, Tippziele ≥ 44`)
  if (rot) process.exitCode = 1
}

await main()
