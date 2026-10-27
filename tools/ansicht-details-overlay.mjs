import { eckenFehler } from './ecken-urteil.mjs'

/**
 * Pixelmessung des „Details“-Overlays auf dem Vorschlags-Cover (`#/entdecken`, `.empf-details`): Das Overlay wird für die Messung fest
 * eingeblendet (Hover gibt es am Handy nicht) und gegen den Zustand ohne Overlay gehalten. Regel (`overlayFehler`): Ecken rund, Overlay
 * deckt das Cover genau, die Zeilen unter der Unterkante bleiben gleich, die Mitte wird dunkler.
 */
const GLEICH = 12
const LAGE_TOLERANZ = 1

const abstand = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0)
const summe = (f) => f.reduce((s, v) => s + v, 0)

/** `ruhig` und `an`: { r, o, farben (8 Punkte wie `eckenFehler` plus 4 darunter), mitte }; liefert die Fehlertexte. */
export function overlayFehler({ ruhig, an }) {
  const fehler = []
  if (!an.o) return ['Details-Overlay fehlt im Cover']
  for (const f of eckenFehler(an.farben)) fehler.push(`mit Overlay: ${f}`)
  const lage = ['x', 'y', 'w', 'h'].filter((k) => Math.abs(an.o[k] - an.r[k]) > LAGE_TOLERANZ)
  if (lage.length) fehler.push(`Overlay deckt das Cover nicht genau (${lage.join(', ')})`)
  an.farben.slice(4).forEach((f, i) => {
    if (abstand(f, ruhig.farben[4 + i]) >= GLEICH) fehler.push(`Zeile ${i + 1} unter dem Cover ändert sich mit Overlay`)
  })
  if (summe(an.mitte) >= summe(ruhig.mitte)) fehler.push('Overlay dunkelt das Cover nicht ab')
  return fehler
}

const FEST = '.empf-details { opacity: 1 !important; transition: none !important; }'

async function messe(seite, cover, lesePixel) {
  await seite.mouse.move(1, 1)
  await seite.waitForTimeout(400)
  const lage = await seite.locator(cover).evaluate((e) => {
    const b = e.getBoundingClientRect()
    const o = e.querySelector('.empf-details')?.getBoundingClientRect()
    return { r: { x: b.x, y: b.y, w: b.width, h: b.height }, o: o ? { x: o.x, y: o.y, w: o.width, h: o.height } : null }
  })
  const [x, y, w, h] = [lage.r.x, lage.r.y, lage.r.w, lage.r.h].map(Math.round)
  const unten = [1, 2, 3, 4].map((d) => [x + Math.round(w / 2), y + h - 1 + d])
  const punkte = [[x + 1, y + 1], [x + 1, y - 3], [x + w - 2, y + h - 2], [x + w - 2, y + h + 3], ...unten, [x + Math.round(w / 2), y + Math.round(h / 4)]]
  const png = (await seite.screenshot()).toString('base64')
  const farben = await seite.evaluate(lesePixel, { png, punkte })
  return { ...lage, farben: farben.slice(0, 8), mitte: farben[8] }
}

/** Misst das Cover ohne und mit fest eingeblendetem Overlay; `zustand` benennt den Fall („ohne Favorit“ …) für die Fehlertexte. */
export async function messeDetailsOverlay(seite, cover, lesePixel, zustand) {
  const ruhig = await messe(seite, cover, lesePixel)
  const stil = await seite.addStyleTag({ content: FEST })
  const an = await messe(seite, cover, lesePixel)
  await stil.evaluate((e) => e.remove())
  return overlayFehler({ ruhig, an }).map((f) => `Details-Overlay (${zustand}): ${f}`)
}
