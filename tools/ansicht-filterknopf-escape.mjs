/**
 * Escape am Filter-Dock der Datenbank (Rechner), Teil von `ansicht-filterknopf.mjs`:
 *  - Fokus im Eingabefeld des Felds („Filter durchsuchen"): Escape schließt, der Fokus geht zum Knopf;
 *  - Sprecher-Eingabe mit Text: der erste Escape leert nur das Eingabefeld (das Feld bleibt offen), der zweite schließt;
 *  - `aria-controls` des offenen Knopfs zeigt auf ein vorhandenes Element im Feld.
 */

/** Abweichungen aus den Messwerten von `messeEscape`. */
export function escapeAbweichungen(wo, m) {
  const a = []
  if (!m.controlsGefunden) a.push(`${wo}: aria-controls des offenen Knopfs zeigt auf kein Element im Feld`)
  if (!m.feldZu) a.push(`${wo}: Escape im Eingabefeld des Felds schließt es nicht`)
  if (!m.feldFokusKnopf) a.push(`${wo}: Fokus kehrt nach Escape im Eingabefeld nicht zum Knopf zurück`)
  if (!m.sprecherGeleert) a.push(`${wo}: erster Escape leert die Sprecher-Eingabe nicht`)
  if (!m.sprecherFeldOffen) a.push(`${wo}: erster Escape in der Sprecher-Eingabe schließt das ganze Feld mit`)
  if (!m.sprecherZweiterZu) a.push(`${wo}: zweiter Escape (Sprecher-Eingabe leer) schließt das Feld nicht`)
  return a
}

/** Spielt die Fälle durch; `knopf` ist der Selektor des Filter-Knopfs, das Feld ist zu Beginn geschlossen. */
export async function messeEscape(seite, knopf) {
  const taste = seite.locator(knopf)
  const offen = async () => (await taste.getAttribute('aria-expanded')) === 'true'
  await taste.click()
  await seite.waitForTimeout(500)
  const controls = await taste.getAttribute('aria-controls')
  const controlsGefunden = !!controls && (await seite.locator(`[id="${controls}"]`).count()) === 1
  await seite.getByPlaceholder(/durchsuchen/).click()
  await seite.keyboard.press('Escape')
  await seite.waitForTimeout(300)
  const feldZu = !(await offen())
  const feldFokusKnopf = await taste.evaluate((e) => e === document.activeElement)
  await taste.click()
  await seite.waitForTimeout(500)
  const sprecher = seite.getByPlaceholder(/Sprecher suchen/)
  await sprecher.click()
  await sprecher.fill('ab')
  await seite.keyboard.press('Escape')
  await seite.waitForTimeout(300)
  const sprecherGeleert = (await sprecher.inputValue({ timeout: 2000 }).catch(() => null)) === ''
  const sprecherFeldOffen = await offen()
  await seite.keyboard.press('Escape')
  await seite.waitForTimeout(300)
  const sprecherZweiterZu = !(await offen())
  return { controlsGefunden, feldZu, feldFokusKnopf, sprecherGeleert, sprecherFeldOffen, sprecherZweiterZu }
}
