/**
 * Messlauf der Ladezeiten-Überwachung: Handy (Pixel 7, 4× CPU) gegen einen Build-Ordner, ohne Server und ohne Netz.
 * Liefert je Messgröße die Einzelwerte; Grenzen und Bericht stehen in `ladezeiten-grenzen.mjs` / `ladezeiten-messen.mjs`.
 */
import { chromium, devices } from 'playwright'
import { BASIS, messhaken, ergebnis, aktionen, ausDistLiefern } from './tempo-kern.mjs'

const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64')

/** Läuft in der Seite: hält fest, wann der erste Termin nach dem Zeichnen sichtbar war (ms ab Navigationsbeginn). */
function ladehaken() {
  const m = { sichtbar: 0 }
  window.__lade = m
  const pruefe = () => {
    if (m.sichtbar || !document.querySelector('.ak-oeffnen')) return
    m.sichtbar = -1
    requestAnimationFrame(() => requestAnimationFrame(() => (m.sichtbar = Math.round(performance.now()))))
  }
  new MutationObserver(pruefe).observe(document, { childList: true, subtree: true })
}

/** Fremde Hosts (Cover, Schriften) bekommen ein Pixel bzw. Abbruch: Messung hängt weder am Netz noch am Wetter dort. */
async function fremdesAbfangen(ctx) {
  await ctx.route(/^https?:\/\//, (route) => {
    const url = new URL(route.request().url())
    if (`${url.origin}/` === BASIS) return route.fallback()
    if (route.request().resourceType() === 'image') return route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1X1 })
    return route.abort()
  })
}

/** Neue Seite mit Handy-Profil, CPU-Drosselung und beiden Haken, geliefert aus `dist`. */
async function neueSeite(browser, dist, drossel) {
  const ctx = await browser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' })
  await fremdesAbfangen(ctx)
  await ausDistLiefern(ctx, dist)
  const seite = await ctx.newPage()
  await seite.addInitScript(ladehaken)
  await seite.addInitScript(messhaken)
  const cdp = await ctx.newCDPSession(seite)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: drossel })
  return seite
}

/** Lädt die Wochenansicht und liefert die Zeit bis zum sichtbaren Kalender. */
async function laden(seite) {
  await seite.goto(`${BASIS}#/woche`, { waitUntil: 'load' })
  await seite.waitForFunction(() => window.__lade.sichtbar > 0, null, { timeout: 60000 })
  const sichtbar = await seite.evaluate(() => window.__lade.sichtbar)
  await ergebnis(seite)
  return sichtbar
}

/** Misst `ladungen` kalte Ladevorgänge; die erste Seite bleibt offen und führt danach die Aktionen `wiederholungen`-mal aus. */
export async function messlauf({ dist, drossel, ladungen, wiederholungen }) {
  const browser = await chromium.launch()
  const werte = new Map()
  const merke = (name, wert) => werte.set(name, [...(werte.get(name) ?? []), wert])
  try {
    let erste
    for (let i = 0; i < ladungen; i++) {
      const seite = await neueSeite(browser, dist, drossel)
      merke('Kalender sichtbar', await laden(seite))
      if (i === 0) erste = seite
      else await seite.context().close()
    }
    for (let i = 0; i < wiederholungen; i++) {
      for (const [name, tu] of aktionen(erste)) {
        await tu()
        merke(name, (await ergebnis(erste)).stabil)
      }
    }
  } finally {
    await browser.close()
  }
  return werte
}
