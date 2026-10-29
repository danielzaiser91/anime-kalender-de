/**
 * Escape in gestapelten Ebenen (Detail-Panel + Quellen-Fenster, Trailer-Kino, Cover-Schicht): ein Escape schließt genau die oberste
 * Ebene, das Panel darunter bleibt stehen; der zweite Escape schließt das Panel. Regel `stapelAbweichungen` aus den Zählungen
 * nach jedem Escape; `pruefeEscapeStapel` fährt die Fälle im Browser (Rechner, 1366 px).
 */
const adresse = (id) => `http://ak.test/#/datenbank?t=${id}`
const PANEL = '[data-panel]'
const klicke = (muster) => async (s) => {
  const knopf = s.locator(`${PANEL} button`, { hasText: muster }).first()
  if (await knopf.count()) await knopf.click()
}
const FAELLE = [
  { name: 'Quellen-Fenster', titel: 775, oben: '[role="dialog"][aria-label^="Quellen"]', oeffne: klicke(/^(▣ )?(Quelle|Quellen|Beleg|Belege)/) },
  { name: 'Trailer-Kino', titel: 11, oben: '[role="dialog"][aria-label*="Trailer"]:not([data-panel])', oeffne: klicke(/Trailer/) },
  { name: 'Cover-Schicht', titel: 11, oben: '[role="dialog"][aria-label^="Cover"]', oeffne: (s) => s.evaluate(() => window.dispatchEvent(new CustomEvent('cover-maximieren', { detail: 'cover' }))) },
]

/** `vorher`, `nachEins`, `nachZwei`: { oben, panel } = Anzahl offener Ebenen vor, nach dem ersten und nach dem zweiten Escape. */
export function stapelAbweichungen(wo, { vorher, nachEins, nachZwei }) {
  const a = []
  if (!vorher.oben || !vorher.panel) return [`${wo}: Stapel nicht aufgebaut (oben ${vorher.oben}, Panel ${vorher.panel})`]
  if (nachEins.oben !== 0) a.push(`${wo}: erster Escape schließt die oberste Ebene nicht`)
  if (nachEins.panel !== 1) a.push(`${wo}: erster Escape schließt das Panel darunter mit`)
  if (nachZwei.panel !== 0) a.push(`${wo}: zweiter Escape schließt das Panel nicht`)
  return a
}

const zaehle = (seite, oben) => seite.evaluate(([o, p]) => ({ oben: document.querySelectorAll(o).length, panel: document.querySelectorAll(p).length }), [oben, PANEL])

async function fahreFall(browser, antworte, fall) {
  const seite = await browser.newPage({ viewport: { width: 1366, height: 900 } })
  await seite.route('**/*', antworte)
  await seite.goto('about:blank')
  await seite.goto(adresse(fall.titel), { waitUntil: 'networkidle' })
  await seite.locator(PANEL).first().waitFor({ timeout: 15_000 })
  await seite.waitForTimeout(800)
  await fall.oeffne(seite)
  await seite.waitForTimeout(600)
  const vorher = await zaehle(seite, fall.oben)
  await seite.keyboard.press('Escape')
  await seite.waitForTimeout(500)
  const nachEins = await zaehle(seite, fall.oben)
  await seite.keyboard.press('Escape')
  await seite.waitForTimeout(500)
  const nachZwei = await zaehle(seite, fall.oben)
  await seite.close()
  return { vorher, nachEins, nachZwei }
}

/** Alle Stapelfälle; liefert { abweichungen, faelle }. `antworte` ist der `page.route`-Handler der Ansichtsprüfung. */
export async function pruefeEscapeStapel(chromium, antworte) {
  const browser = await chromium.launch()
  const abweichungen = []
  for (const fall of FAELLE) {
    const m = await fahreFall(browser, antworte, fall)
    abweichungen.push(...stapelAbweichungen(`Detail-Panel + ${fall.name}`, m))
  }
  await browser.close()
  return { abweichungen, faelle: FAELLE.length }
}
