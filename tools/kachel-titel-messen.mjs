#!/usr/bin/env node
/**
 * Misst und bebildert, wie viele Kachel-Titel in der Wochenansicht gekappt sind.
 *
 * Daniel am 05.09.2026 zur Frage, ob die Kachel eine Zeile mehr bekommen soll:
 * „zeig problem und lösung visuell bevor ich mich entscheide." Genau dafür ist
 * das hier — es rendert dieselbe Ansicht viermal, einmal je Vorschlag, und
 * zählt dabei, was tatsächlich abgeschnitten ist.
 *
 * **Ohne Server**, wie `ansicht-bild.mjs`: `page.route()` beantwortet aus
 * `dist/`. Gemessen wird nicht geschätzt — gekappt heißt `scrollHeight >
 * clientHeight` am Titel-Element, nicht „sieht kurz aus".
 *
 * Die Varianten werden über eingeschleustes CSS gestellt, nicht über einen
 * Umbau: Wer sich entscheidet, bekommt danach die echte Änderung. Ein Bild aus
 * einer Kulisse, die es so nie gab, wäre wertlos — deshalb greift jede Variante
 * genau an der Stelle an, die auch der Umbau anfassen würde.
 *
 * Aufruf: node tools/kachel-titel-messen.mjs
 * Ergebnis: docs/kachel-<variante>.png und eine Tabelle.
 */
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const WURZEL = path.resolve(import.meta.dirname, '..')
const DIST = path.join(WURZEL, 'dist')

const EIN_PUNKT = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

const TYPEN = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
}

/** Der Titel in der Kachel — dieselbe Klassenkombination wie in `EventCard.tsx`. */
const TITEL = '.line-clamp-3.text-\\[13px\\].font-medium'

const VARIANTEN = [
  { name: 'jetzt', beschriftung: 'Stand heute — drei Zeilen', css: '' },
  {
    name: 'vier-zeilen',
    beschriftung: 'Vierte Zeile, Kachel wird höher',
    css: `${TITEL} { -webkit-line-clamp: 4 !important; }`,
  },
  {
    name: 'ohne-grenze',
    beschriftung: 'Titel vollständig, Kachel so hoch wie nötig',
    css: `${TITEL} { -webkit-line-clamp: unset !important; display: block !important; }`,
  },
  {
    name: 'titel-volle-breite',
    beschriftung: 'Titel unter das Cover, volle Kachelbreite — keine zusätzliche Höhe',
    /*
      Der eigentliche Engpass ist nicht die Zeilenzahl, sondern die Breite: Der
      Titel steht rechts neben dem Cover und hat dort rund zehn Zeichen je
      Zeile. Über die volle Kachelbreite sind es etwa doppelt so viele.
    */
    css: `${TITEL} { margin-left: -3.25rem; width: calc(100% + 3.25rem); }`,
  },
  {
    name: 'eine-zeile-icons',
    beschriftung: 'Titel neben die Icon-Zeile — keine zusätzliche Höhe',
    /*
      Die Icon-Zeile (Teilen, Auge, Stern) steht heute über dem Titel und
      belegt eine eigene Zeile. Rückt sie neben ihn, wird eine Zeile frei,
      ohne dass die Kachel wächst — deshalb hier vier Zeilen bei gleicher Höhe.
    */
    css: `${TITEL} { -webkit-line-clamp: 4 !important; }
          ${TITEL} { margin-top: -1.15rem; padding-right: 4.2rem; }`,
  },
]

async function main() {
  if (!existsSync(path.join(DIST, 'index.html'))) {
    console.error('dist/ fehlt — erst `npm run build`.')
    process.exitCode = 1
    return
  }
  const browser = await chromium.launch()
  const seite = await browser.newPage({ viewport: { width: 1280, height: 900 } })

  await seite.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return route.continue()
    if (url.hostname !== 'ak.test') {
      return route.fulfill({ status: 200, contentType: 'image/png', body: EIN_PUNKT })
    }
    const rel = url.pathname === '/' ? '/index.html' : url.pathname
    const datei = path.join(DIST, rel)
    if (!datei.startsWith(DIST) || !existsSync(datei)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({
      status: 200,
      contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream',
      body: await readFile(datei),
    })
  })

  const zeilen = []
  for (const v of VARIANTEN) {
    await seite.emulateMedia({ colorScheme: 'dark' })
    await seite.goto('about:blank')
    await seite.goto('http://ak.test/#/woche', { waitUntil: 'networkidle' })
    await seite.locator('header').first().waitFor({ state: 'visible', timeout: 20_000 })
    await seite.waitForTimeout(2500)
    if (v.css) await seite.addStyleTag({ content: v.css })
    await seite.waitForTimeout(300)

    const mass = await seite.evaluate((sel) => {
      const titel = [...document.querySelectorAll(sel)]
      /* Gekappt heißt gemessen: der Text braucht mehr Platz, als er hat. */
      const gekappt = titel.filter((e) => e.scrollHeight - e.clientHeight > 1)
      const kachel = titel[0]?.closest('article,li,div[class*="rounded"]')
      return {
        sichtbar: titel.length,
        gekappt: gekappt.length,
        kachelHoehe: kachel ? Math.round(kachel.getBoundingClientRect().height) : 0,
        beispiele: gekappt.slice(0, 3).map((e) => e.textContent.trim().slice(0, 34)),
      }
    }, TITEL)

    await seite.screenshot({ path: path.join(WURZEL, 'docs', `kachel-${v.name}.png`) })
    zeilen.push({ ...v, ...mass })
  }

  await browser.close()

  console.log('\nVariante              sichtbar  gekappt  Kachelhöhe')
  for (const z of zeilen) {
    console.log(
      `  ${z.name.padEnd(18)} ${String(z.sichtbar).padStart(6)} ${String(z.gekappt).padStart(8)} ${String(z.kachelHoehe).padStart(9)} px`,
    )
    for (const b of z.beispiele) console.log(`      ${b}…`)
  }
}

await main()
