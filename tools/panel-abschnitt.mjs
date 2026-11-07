/**
 * Ein Abschnitt (Karte) des Detail-Panels für `panel-bild.mjs --abschnitt=<Überschrift>`, z. B. `--abschnitt=Neuigkeiten`.
 * Die Karten (`PanelKarte`) tragen ihre Überschrift als `aria-label`; gesucht wird ohne Rücksicht auf Groß-/Kleinschreibung nach einem Teilwort.
 */

/** Der Wert von `--abschnitt=…` oder `null`; Anführungszeichen und Backslash scheiden aus (kein Selektor-Bruch). */
export function abschnittAusArgumenten(argv) {
  const arg = argv.find((a) => a.startsWith('--abschnitt='))
  if (!arg) return null
  const name = arg.slice('--abschnitt='.length).trim()
  if (!name || /["\\]/.test(name)) throw new Error('--abschnitt=<Überschrift der Karte> erwartet, ohne Anführungszeichen')
  return name
}

/** Selektor der Karte innerhalb des Panels. */
export const abschnittSelektor = (name) => `section[aria-label*="${name}" i]`

/** Dateiname des Abschnittsbilds: Teilwort ohne Sonderzeichen. */
export const abschnittDatei = (ordner, id, name, thema) => `${ordner}/panel-${id}-${name.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-')}-${thema}.png`

/** Bildet die erste passende Karte ab; `false`, wenn der Titel diese Karte nicht hat. */
export async function bildeAbschnitt(panel, name, datei) {
  const karte = panel.locator(abschnittSelektor(name)).first()
  if (!(await karte.count())) return false
  await karte.screenshot({ path: datei })
  return true
}

/**
 * Der Aufruf aus panel-bild.mjs: ohne `--abschnitt=` passiert nichts (`'aus'`), sonst Bild (`'bild'`) oder Meldung (`'fehlt'`).
 * Nach dem Bild des ganzen Panels, denn das Abbilden scrollt zur Karte und verfälschte sonst die Messung „nicht vorgescrollt“.
 */
export async function abschnittsbild(panel, name, ordner, id, thema) {
  if (!name) return 'aus'
  if (await bildeAbschnitt(panel, name, abschnittDatei(ordner, id, name, thema))) return 'bild'
  console.log(`  – ${id}: keine Karte „${name}"`)
  return 'fehlt'
}
