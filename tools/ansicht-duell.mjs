import { duellFehler, messpunkte } from './duell-urteil.mjs'

/**
 * Pixelmessung der Duell-Karte A (`#/entdecken`, erstes Duell, Schritt „bereit“): ohne Wahl, als Sieger (`gewinnt`) und als Verlierer
 * (`verliert`). Die Klasse wird von Hand gesetzt, damit kein Ablauf-Schritt die Karte bewegt. Geprüft werden Ecken, Unterkante und der
 * Ring unter der Karte (Regel: `duell-urteil.mjs`). `lesePixel` ist `lesePixelPng` aus `ansicht-bild.mjs` (läuft im Browser).
 */
const KARTE = '.empf-duell [data-seite="a"].empf-kandidat'

async function messeZustand(seite, klasse, lesePixel) {
  await seite.locator(KARTE).evaluate((e, k) => {
    e.classList.remove('gewinnt', 'verliert')
    if (k) e.classList.add(k)
  }, klasse)
  await seite.mouse.move(1, 1)
  await seite.waitForTimeout(300)
  const r = await seite.locator(KARTE).evaluate((e) => {
    const b = e.getBoundingClientRect()
    return { x: b.x, y: b.y, w: b.width, h: b.height }
  })
  const png = (await seite.screenshot()).toString('base64')
  return { unten: Math.round(r.y + r.h), farben: await seite.evaluate(lesePixel, { png, punkte: messpunkte(r) }) }
}

/** Misst die drei Zustände und liefert die Fehlertexte. */
export async function messeDuell(seite, lesePixel) {
  await seite.locator(KARTE).waitFor({ timeout: 10_000 })
  const ohne = await messeZustand(seite, '', lesePixel)
  const gewinnt = await messeZustand(seite, 'gewinnt', lesePixel)
  const verliert = await messeZustand(seite, 'verliert', lesePixel)
  await seite.locator(KARTE).evaluate((e) => e.classList.remove('gewinnt', 'verliert'))
  return duellFehler({ ohne, gewinnt, verliert })
}
