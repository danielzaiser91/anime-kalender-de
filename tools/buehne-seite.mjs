/**
 * Gemeinsame Grundlage der Bühnen-Werkzeuge (`buehne-bilder.mjs`, `buehne-messen.mjs`): Playwright gegen `buehne-dist/`.
 *
 * **Ohne Server**, wie `panel-bild.mjs`: `page.route()` beantwortet jede Anfrage der erfundenen Adresse `buehne.test` aus
 * dem Ordner, alles Fremde wird mitgezählt und mit einem Bildpunkt beantwortet (die Bühne selbst sperrt das Netz per
 * Content-Security-Policy; ein Treffer hier wäre ein Fehler der Bühne). Nach dem Lauf ist nichts mehr offen.
 */
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const WURZEL = path.resolve(import.meta.dirname, '..')
export const BUEHNE = path.join(WURZEL, 'buehne-dist')
const ADRESSE = 'http://buehne.test/buehne.html'

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
  '.woff2': 'font/woff2',
}

async function antworte(route, fremde) {
  const url = new URL(route.request().url())
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return route.continue()
  if (url.hostname !== 'buehne.test') {
    fremde.push(url.href)
    return route.fulfill({ status: 200, contentType: 'image/png', body: EIN_PUNKT })
  }
  const datei = path.join(BUEHNE, url.pathname)
  if (!datei.startsWith(BUEHNE) || !existsSync(datei) || !path.extname(datei)) return route.fulfill({ status: 404, body: '' })
  return route.fulfill({ status: 200, contentType: TYPEN[path.extname(datei)] ?? 'application/octet-stream', body: await readFile(datei) })
}

/** Startet den Browser mit der Bühne hinter `buehne.test`; `fremde` füllt sich mit jeder Anfrage nach draußen. */
export async function starteBuehne() {
  if (!existsSync(path.join(BUEHNE, 'buehne.html'))) throw new Error('buehne-dist/ fehlt — erst `npm run buehne:bauen`.')
  const browser = await chromium.launch()
  // 12000 px hoch: Die Bühnen-Seite ist so hoch wie das Fenster (`.seite`, 100dvh) und staucht die Zellen darauf; erst ein sehr
  // hohes Fenster gibt jeder Zelle ihre volle Gerätehöhe (Bilder, Messungen) und schaltet den Zoom von „beide" ab.
  const seite = await browser.newPage({ viewport: { width: 1400, height: 12000 } })
  const fremde = []
  await seite.route('**/*', (route) => antworte(route, fremde))
  return { browser, seite, fremde }
}

/** Alle Mockups der Bühne (Namen aus der Übersicht) samt Varianten, Fällen und Zeiten (aus den Knöpfen der Leiste). */
export async function listeMockups(seite) {
  await seite.goto(`${ADRESSE}#`, { waitUntil: 'load' })
  await seite.locator('.uebersicht a[data-mockup]').first().waitFor()
  const namen = await seite.$$eval('.uebersicht a[data-mockup]', (as) => as.map((a) => a.dataset.mockup))
  const liste = []
  for (const name of namen) {
    await seite.goto('about:blank')
    await seite.goto(`${ADRESSE}#${encodeURIComponent(name)}`, { waitUntil: 'load' })
    await seite.locator('.leiste').waitFor()
    const wertDer = (gruppe) => seite.$$eval(`.gruppe[data-gruppe="${gruppe}"] button`, (bs) => bs.map((b) => b.dataset.wert))
    liste.push({ name, varianten: await wertDer('Variante'), faelle: await wertDer('Fall'), zeiten: await wertDer('Zeit') })
  }
  return liste
}

/**
 * Ruhig = Schriften da und 600 ms lang weder DOM-Änderung noch Scrollen (die App rollt zu „heute“ und blendet dabei Knöpfe ein
 * und aus). `networkidle` taugt hier nicht: es hing bei mehreren Rahmen derselben Seite.
 */
function warteBisRuhig() {
  return document.fonts.ready.then(
    () =>
      new Promise((fertig) => {
        let uhr = setTimeout(fertig, 600)
        const neuStarten = () => {
          clearTimeout(uhr)
          uhr = setTimeout(fertig, 600)
        }
        new MutationObserver(neuStarten).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })
        addEventListener('scroll', neuStarten, true)
      }),
  )
}

/** Wartet, bis jeder Zellenrahmen geladen, gerendert und ruhig ist. */
async function warteAufZellen(seite) {
  const rahmen = await seite.locator('iframe[data-zelle]').elementHandles()
  const frames = []
  for (const r of rahmen) {
    const frame = await r.contentFrame()
    await frame.waitForLoadState('load')
    await frame.waitForFunction(() => document.getElementById('root')?.childElementCount > 0, null, { timeout: 30_000 })
    await frame.evaluate(warteBisRuhig)
    frames.push({ schluessel: await r.getAttribute('data-zelle'), frame, figur: await r.evaluateHandle((el) => el.closest('figure')) })
  }
  return frames
}

/** Öffnet eine Ansicht der Bühne (Gerät und Thema `beide`) und gibt die Zellen zurück: `{ schluessel: 'vorher-375-hell', frame, figur }`. */
export async function oeffneZellen(seite, { mockup, variante, fall, teil, zeit }) {
  const w = new URLSearchParams({ v: variante, fall, geraet: 'beide', thema: 'beide', teil })
  if (zeit) w.set('zeit', zeit)
  await seite.goto('about:blank')
  await seite.goto(`${ADRESSE}#${encodeURIComponent(mockup)}?${w}`, { waitUntil: 'load' })
  await seite.locator('iframe[data-zelle]').first().waitFor()
  return warteAufZellen(seite)
}

/**
 * Geht alle Mockups × Fälle × Zeiten × Varianten durch (ohne `zeiten` im Mockup einmal ohne Zeit). Die erste Variante bringt
 * Vorher und Nachher, jede weitere nur Nachher — Vorher ist ja immer dasselbe. `filter` (Namensteil) schränkt die Mockups ein.
 */
export async function durchlaufe(seite, filter, beiZellen) {
  const mockups = (await listeMockups(seite)).filter((m) => !filter || m.name.includes(filter))
  if (!mockups.length) throw new Error(`kein Mockup${filter ? ` mit „${filter}“` : ''} gefunden`)
  for (const m of mockups) {
    for (const fall of m.faelle) {
      for (const zeit of m.zeiten.length ? m.zeiten : [undefined]) {
        for (const [i, variante] of m.varianten.entries()) {
          const zellen = await oeffneZellen(seite, { mockup: m.name, variante, fall, teil: i === 0 ? 'beide' : 'nachher', zeit })
          await beiZellen({ mockup: m.name, fall, variante, zeit, zellen })
        }
      }
    }
  }
}

/** Wert eines Aufrufarguments (`--aus <x>`), sonst `vorgabe`. */
export function argument(name, vorgabe) {
  const i = process.argv.indexOf(name)
  return i > 0 ? process.argv[i + 1] : vorgabe
}
