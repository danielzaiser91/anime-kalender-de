#!/usr/bin/env node
/**
 * **Der Einstellungsdialog — sichtbar, erreichbar, und er schaltet wirklich.**
 *
 * Daniel am 12.09.2026: „bau eine einstellung seite, zahnrad icon sichtbar
 * platzieren, öffnet dialog, dort als erste option einfügen, ‚westliche anime
 * (Cartoons) ausblenden' - standardmäßig aus".
 *
 * Gemessen wird jede Hälfte dieses Satzes: dass das Zahnrad ohne Suchen da
 * ist, dass der Dialog aufgeht, dass die Option an erster Stelle steht, dass
 * sie **aus** beginnt — und dass ihr Umlegen die Titelzahl wirklich senkt. Der
 * letzte Punkt ist der eigentliche: Ein Schalter, der nichts bewirkt, sieht
 * auf einem Bild genauso aus wie einer, der wirkt.
 *
 * Aufruf: `node tools/einstellungen-bild.mjs` · `npm run check:einstellungen`
 */
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(WURZEL, 'dist')
const TYPEN = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
}

if (!existsSync(DIST)) {
  console.error('Kein dist/ — vorher `npm run build`.')
  process.exit(1)
}

const browser = await chromium.launch()
const seite = await browser.newPage({ viewportSize: { width: 1280, height: 900 } })
await seite.route('**/*', async (route) => {
  const url = new URL(route.request().url())
  if (url.hostname !== 'ak.test') return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.alloc(0) })
  const datei = path.join(DIST, url.pathname === '/' ? 'index.html' : url.pathname)
  if (!existsSync(datei)) {
    return route.fulfill({ status: 200, contentType: 'text/html', body: await readFile(path.join(DIST, 'index.html')) })
  }
  return route.fulfill({
    status: 200,
    contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream',
    body: await readFile(datei),
  })
})

const fehler = []
const pruefe = (was, ok, zusatz) => {
  console.log(`  ${ok ? 'ok  ' : 'FEHL'} ${was}${ok || zusatz === undefined ? '' : ` — ${zusatz}`}`)
  if (!ok) fehler.push(was)
}

/** Die Zahl aus „N Anime mit belegter deutscher Synchro" bzw. der Trefferzeile. */
async function titelzahl() {
  return seite.evaluate(() => {
    const m = document.body.innerText.match(/([\d.]+)\s+(?:Anime|Titel)/)
    return m ? Number(m[1].replace(/\./g, '')) : 0
  })
}

console.log('Die Einstellungen:\n')

for (const thema of ['dunkel', 'hell']) {
  await seite.emulateMedia({ colorScheme: thema === 'dunkel' ? 'dark' : 'light' })
  await seite.goto('about:blank')
  await seite.goto('http://ak.test/#/datenbank', { waitUntil: 'networkidle' })
  /* Die westlichen Titel kommen nachgeladen — ohne sie misst der Schalter nichts. */
  await seite.waitForTimeout(1500)

  const zahnrad = seite.getByRole('button', { name: 'Einstellungen' })
  if (thema === 'dunkel') {
    pruefe('das Zahnrad steht in der Kopfleiste', await zahnrad.isVisible())
  }
  await zahnrad.click()

  const dialog = seite.getByRole('dialog', { name: 'Einstellungen' })
  await dialog.waitFor({ state: 'visible', timeout: 10_000 })
  await seite.screenshot({ path: path.join(WURZEL, 'docs', `einstellungen-${thema}.png`) })

  if (thema === 'dunkel') {
    const ersteOption = await dialog.locator('label').first().innerText()
    pruefe(
      'die erste Option ist der Cartoon-Schalter',
      /Westliche Anime \(Cartoons\) ausblenden/.test(ersteOption),
      ersteOption.split('\n')[0],
    )

    const kasten = dialog.getByRole('checkbox').first()
    pruefe('er ist standardmäßig aus', !(await kasten.isChecked()))

    /* Der eigentliche Beleg: Wirkt er? */
    await seite.keyboard.press('Escape')
    await seite.waitForTimeout(400)
    const mit = await titelzahl()

    await zahnrad.click()
    await dialog.waitFor({ state: 'visible', timeout: 5_000 })
    await dialog.getByRole('checkbox').first().check()
    await seite.keyboard.press('Escape')
    await seite.waitForTimeout(600)
    const ohne = await titelzahl()

    pruefe('der Schalter blendet die westlichen Titel wirklich aus', ohne > 0 && ohne < mit, `${mit} → ${ohne}`)

    /* Und die Wahl überlebt einen Neuaufbau der Seite. */
    await seite.reload({ waitUntil: 'networkidle' })
    await seite.waitForTimeout(1200)
    await seite.getByRole('button', { name: 'Einstellungen' }).click()
    const nachher = await seite.getByRole('dialog', { name: 'Einstellungen' }).getByRole('checkbox').first().isChecked()
    pruefe('die Wahl bleibt nach dem Neuladen bestehen', nachher)
    await seite.keyboard.press('Escape')
  }
}

await browser.close()
console.log('\n  Bilder: docs/einstellungen-dunkel.png · docs/einstellungen-hell.png')
process.exit(fehler.length ? 1 : 0)
