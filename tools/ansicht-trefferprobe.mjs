/**
 * Trefferprobe der Hauptansichten am Handy (360 px, beide Themen): Woche, Datenbank-Liste und das offene Filterfenster
 * (Woche und Datenbank). Jedes sichtbare Bedienelement muss anklickbar sein (`trefferprobe-browser.mjs`); Ausnahmen stehen
 * benannt in `trefferprobe-ausnahmen.mjs`.
 */
import { AUSNAHMEN } from './trefferprobe-ausnahmen.mjs'
import { trefferprobe } from './trefferprobe-browser.mjs'

const ZUSTAENDE = [
  { name: 'Woche', route: 'woche', filter: false, wurzel: undefined },
  { name: 'Datenbank-Liste', route: 'datenbank', filter: false, wurzel: undefined },
  { name: 'Woche, Filterfenster offen', route: 'woche', filter: true, wurzel: '#ak-filter' },
  { name: 'Datenbank, Filterfenster offen', route: 'datenbank', filter: true, wurzel: '#ak-filter' },
]

/** Öffnet einen Zustand (Route, optional Filterfenster) im aktuellen Thema. */
async function oeffneZustand(seite, z) {
  await seite.goto('about:blank')
  await seite.goto(`http://ak.test/#/${z.route}`, { waitUntil: 'networkidle' })
  await seite.locator('header').first().waitFor({ state: 'visible', timeout: 20_000 })
  await seite.waitForTimeout(2500)
  if (!z.filter) return
  await seite.locator('button[aria-controls="ak-filter"]').first().click()
  await seite.locator('#ak-filter').waitFor({ state: 'visible' })
  await seite.waitForTimeout(1000)
}

/** Gibt `{ abweichungen, geprueft }` zurück; ändert Viewport und Farbschema der Seite (der Aufrufer setzt sie danach nicht zurück). */
export async function pruefeTrefferprobe(seite) {
  const abweichungen = []
  const geprueft = {}
  await seite.setViewportSize({ width: 360, height: 800 })
  for (const thema of ['hell', 'dunkel']) {
    await seite.emulateMedia({ colorScheme: thema === 'dunkel' ? 'dark' : 'light' })
    for (const z of ZUSTAENDE) {
      await oeffneZustand(seite, z)
      const r = await seite.evaluate(trefferprobe, { wurzel: z.wurzel, ausnahmen: AUSNAHMEN })
      geprueft[`${z.name} ${thema}`] = r.geprueft
      if (r.geprueft === 0) abweichungen.push(`${z.name} ${thema}: kein Bedienelement gefunden (Probe läuft ins Leere)`)
      for (const b of r.befunde) abweichungen.push(`${z.name} ${thema}: ${b}`)
    }
  }
  return { abweichungen, geprueft }
}
