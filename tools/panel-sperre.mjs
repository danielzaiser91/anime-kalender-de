/**
 * Zusicherung für die Seitensperre hinter dem Detail-Panel (`web/src/lib/use-seite-gesperrt.ts`, 12.10.2026).
 * Aufgerufen von `panel-bild.mjs`; die Seite muss die App aus `dist/` ausliefern.
 *
 * Der Fall, der einen gemerkten Vorher-Wert zerbricht: Panel und Beleg-Dialog sind offen, Zurück schließt das Panel,
 * und React räumt es vor dem Dialog ab. Danach muss die Seite wieder scrollen können (Escape schließt erst den Dialog, das ginge auch so gut).
 */
const QUELLEN_KNOPF = /^(▣ )?(Quelle|Beleg|Quellen \d+|Belege \d+)$/

const sperre = (seite) => seite.evaluate(() => document.documentElement.style.overflow)

/** Liefert die Abweichungen als Texte; leer heißt in Ordnung. `null` als Ergebnis: im Panel gab es keinen Quellen-Knopf. */
export async function pruefePanelSperre(seite, id, akVon) {
  await seite.goto('about:blank')
  await seite.goto(`http://ak.test/#/datenbank?t=${akVon(id)}`, { waitUntil: 'networkidle' })
  const panel = seite.locator('[data-panel="titel"]')
  await panel.waitFor({ state: 'visible', timeout: 15_000 })
  const knopf = panel.locator('button').filter({ hasText: QUELLEN_KNOPF }).first()
  if (!(await knopf.count())) return null
  const abweichungen = []
  if ((await sperre(seite)) !== 'hidden') abweichungen.push('Panel offen, Seite nicht gesperrt')
  await knopf.click()
  await seite.locator('[role="dialog"][aria-modal="true"]').waitFor({ state: 'visible', timeout: 5_000 })
  await seite.goBack()
  await panel.waitFor({ state: 'detached', timeout: 5_000 })
  await seite.waitForTimeout(300)
  const rest = await sperre(seite)
  if (rest !== '') abweichungen.push(`Zurück bei offenem Beleg-Dialog im Panel: Seite bleibt gesperrt (overflow „${rest}")`)
  return abweichungen
}

/** Prüft mit dem ersten Titel, der einen Quellen-Knopf hat, meldet auf der Konsole und schließt danach den Browser. */
export async function pruefeSperreUndSchliesse(browser, seite, ids, akVon) {
  let abweichungen = null
  for (const id of ids) {
    abweichungen = await pruefePanelSperre(seite, id, akVon).catch((e) => [`${id}: ${String(e).split('\n')[0]}`])
    if (abweichungen) break
  }
  await browser.close()
  if (!abweichungen) abweichungen = ['kein Titel mit Quellen-Knopf im Panel gefunden — Prüfung der Seitensperre lief nicht']
  console.log(abweichungen.length ? abweichungen.map((a) => `  ✕ Seitensperre: ${a}`).join('\n') : '\n  ok  Seitensperre: nach Zurück bei offenem Beleg-Dialog scrollt die Seite wieder')
  if (abweichungen.length) process.exitCode = 1
}
