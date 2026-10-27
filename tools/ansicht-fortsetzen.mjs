/**
 * Messung des Startbildschirms mit Vorgeschichte (`#/entdecken`, `Fortsetzen.tsx`): zwei Teile im Verhältnis 70 zu 30, am Rechner
 * nebeneinander, am Handy übereinander. Regel (`teilungsFehler`) aus den Rechtecken der Teile `fortfahren` (a) und `neu` (b);
 * `pruefeFortsetzen` führt von den Vorschlägen über „Von vorn“ dorthin und mit „Fortfahren“ wieder zurück.
 */
const ANTEIL = 0.7
const TOLERANZ = 0.01
const BREITE_QUER = 900

/** `a`, `b`: { x, y, w, h }; `breite`: Fensterbreite. Liefert die Fehlertexte. */
export function teilungsFehler({ a, b, breite }) {
  const fehler = []
  const quer = breite >= BREITE_QUER
  const nebeneinander = Math.abs(a.y - b.y) < 2
  if (quer && !nebeneinander) fehler.push('am Rechner stehen die Teile nicht nebeneinander')
  if (!quer && nebeneinander) fehler.push('am Handy stehen die Teile nicht übereinander')
  const anteil = nebeneinander ? a.w / (a.w + b.w) : a.h / (a.h + b.h)
  if (Math.abs(anteil - ANTEIL) > TOLERANZ) fehler.push(`Teilung ${Math.round(anteil * 1000) / 10} zu ${Math.round((1 - anteil) * 1000) / 10} statt 70 zu 30`)
  const davor = nebeneinander ? b.x >= a.x + a.w - 1 : b.y >= a.y + a.h - 1
  if (!davor) fehler.push('die Teile überlappen sich')
  return fehler
}

const rechteck = (seite, teil) =>
  seite.locator(`[data-teil="${teil}"]`).evaluate((e) => {
    const r = e.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  })

/** Von den Vorschlägen über „Von vorn“ zum Start, messen, mit „Fortfahren“ zurück; `cover` ist der Wartepunkt der Vorschläge. */
export async function pruefeFortsetzen(seite, breite, cover) {
  await seite.getByRole('button', { name: 'Von vorn', exact: true }).click()
  await seite.locator('[data-teil="fortfahren"]').waitFor({ timeout: 10_000 })
  await seite.waitForTimeout(600)
  const fehler = teilungsFehler({ a: await rechteck(seite, 'fortfahren'), b: await rechteck(seite, 'neu'), breite })
  await seite.getByRole('button', { name: 'Fortfahren', exact: true }).click()
  await seite.waitForSelector(cover, { timeout: 10_000 })
  return fehler.map((f) => `Startbildschirm mit Vorgeschichte: ${f}`)
}
