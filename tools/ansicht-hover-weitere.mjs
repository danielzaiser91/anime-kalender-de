/**
 * Cover-Vorschau an Saison-Karte und „Ähnliche Titel“ (23.10.2026), gemessen in der gebauten App:
 * Bei Mausbewegung über die Zeile steht die Karte nicht sofort (Frist `VORSCHAU_FRIST_MS`), aber spätestens nach
 * 600 ms, und sie verschwindet beim Verlassen. Ohne den Zeiger am Button (`useHoverCover`) erscheint nie eine Karte.
 */
import { readFileSync } from 'node:fs'
import { verdeckung, zeileMittig } from './zeile-mittig.mjs'

const FRIST_MIN_MS = 100
const FRIST_MAX_MS = 600
const KARTE = '[data-hover-cover]'
const KANDIDATEN = 12

/** Zeigt auf die Zeile und liefert, ob die Karte nach 40 ms schon stand, nach der Frist stand und nach dem Verlassen noch steht. */
async function zeigeAuf(seite, zeile) {
  await zeileMittig(zeile)
  await seite.mouse.move(2, 2)
  await seite.waitForTimeout(200)
  const box = await zeile.boundingBox()
  const verdeckt = await verdeckung(zeile, box.x + Math.min(box.width / 2, 40), box.y + box.height / 2)
  if (verdeckt) throw new Error(verdeckt)
  await seite.mouse.move(box.x + Math.min(box.width / 2, 40), box.y + box.height / 2)
  await seite.waitForTimeout(40)
  const zuFrueh = await seite.locator(KARTE).count()
  const steht = await seite.locator(KARTE).first().waitFor({ state: 'visible', timeout: FRIST_MAX_MS }).then(() => true, () => false)
  await seite.mouse.move(2, 2)
  await seite.waitForTimeout(200)
  return { zuFrueh, steht, bleibt: await seite.locator(KARTE).count() }
}

/** Probiert die ersten Zeilen mit Zeiger; die erste mit Karte zählt. Befunde leer = in Ordnung. */
async function pruefeZeilen(seite, name, wahl) {
  const zeilen = seite.locator(wahl)
  const anzahl = Math.min(await zeilen.count(), KANDIDATEN)
  if (!anzahl) return [`${name}: keine Zeile mit Zeiger (data-hover-zeile)`]
  for (let i = 0; i < anzahl; i++) {
    const m = await zeigeAuf(seite, zeilen.nth(i))
    if (!m.steht) continue
    const a = []
    if (m.zuFrueh) a.push(`${name}: Karte schon nach 40 ms (Frist ${FRIST_MIN_MS} ms)`)
    if (m.bleibt) a.push(`${name}: Karte bleibt nach dem Verlassen stehen`)
    return a
  }
  return [`${name}: keine der ersten ${anzahl} Zeilen bekam bei Mausbewegung eine Karte`]
}

/** Titel, deren Panel Ähnliche Titel mit Kacheln zeigt, werden der Reihe nach probiert (Stichprobe aus der Woche). */
async function messeAehnliche(seite, woche) {
  const ids = [...new Set(woche.titles.filter((t) => t.coverImage).map((t) => t.id))].slice(0, KANDIDATEN)
  for (const id of ids) {
    await seite.goto('about:blank')
    await seite.goto(`http://ak.test/#/datenbank?t=${id}`, { waitUntil: 'networkidle' })
    await seite.waitForTimeout(800)
    const panel = seite.locator('[data-panel]')
    if (!(await panel.count())) continue
    await panel.getByText(/Ähnliche Titel/).first().scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => {})
    await seite.locator('[data-panel] button[data-hover-zeile]').first().waitFor({ state: 'attached', timeout: 4000 }).catch(() => {})
    if (await panel.locator('button[data-hover-zeile]').count()) return pruefeZeilen(seite, 'Ähnliche Titel', '[data-panel] button[data-hover-zeile]')
  }
  return ['Ähnliche Titel: kein Panel der Stichprobe zeigte Kacheln mit Cover']
}

/** Saison-Karte und Ähnliche Titel; leer = in Ordnung. */
export async function messeWeitere(seite) {
  const woche = JSON.parse(readFileSync(new URL('../dist/data/woche.json', import.meta.url), 'utf8'))
  await seite.goto('about:blank')
  await seite.goto('http://ak.test/#/saison', { waitUntil: 'networkidle' })
  await seite.waitForTimeout(2500)
  const saison = await pruefeZeilen(seite, 'Saison-Karte', 'li > button[data-hover-zeile]')
  return [...saison, ...(await messeAehnliche(seite, woche))]
}
