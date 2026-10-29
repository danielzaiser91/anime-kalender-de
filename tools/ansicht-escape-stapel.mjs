/**
 * Escape in gestapelten Ebenen (Detail-Panel + Quellen-Fenster, Trailer-Kino, Cover-Schicht): ein Escape schließt genau die oberste
 * Ebene, das Panel darunter bleibt stehen; der zweite Escape schließt das Panel. Regel `stapelAbweichungen` aus den Zählungen
 * nach jedem Escape; `pruefeEscapeStapel` fährt die Fälle im Browser (Rechner, 1366 px).
 */
import { pruefeEscapeEinzeln } from './ansicht-escape-einzeln.mjs'

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
  // Das Panel liegt über der News-Ansicht; der Dialog öffnet sich dort (Patchnotes-Knopf) und ist die oberste Ebene.
  { name: 'Patch-Notes-Dialog', adresse: 'http://ak.test/#/news?t=775', titel: 775, oben: '[role="dialog"][aria-labelledby="pn-titel"]', oeffne: (s) => s.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Neu auf der Webseite'))?.click()) },
]

/** `vorher`, `nachTaste` (eine andere Taste), `nachEins`, `nachZwei`: { oben, panel } = Anzahl offener Ebenen vor, nach der Taste, nach dem ersten und nach dem zweiten Escape. */
export function stapelAbweichungen(wo, { vorher, nachTaste, nachEins, nachZwei }) {
  const a = []
  if (!vorher.oben || !vorher.panel) return [`${wo}: Stapel nicht aufgebaut (oben ${vorher.oben}, Panel ${vorher.panel})`]
  if (nachTaste.oben !== vorher.oben || nachTaste.panel !== vorher.panel) a.push(`${wo}: eine andere Taste als Escape schließt eine Ebene`)
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
  await seite.goto(fall.adresse ?? adresse(fall.titel), { waitUntil: 'networkidle' })
  await seite.locator(PANEL).first().waitFor({ timeout: 15_000 })
  await seite.waitForTimeout(800)
  await fall.oeffne(seite)
  await seite.waitForTimeout(600)
  const vorher = await zaehle(seite, fall.oben)
  await seite.keyboard.press('Shift')
  await seite.waitForTimeout(300)
  const nachTaste = await zaehle(seite, fall.oben)
  await seite.keyboard.press('Escape')
  await seite.waitForTimeout(500)
  const nachEins = await zaehle(seite, fall.oben)
  await seite.keyboard.press('Escape')
  await seite.waitForTimeout(500)
  const nachZwei = await zaehle(seite, fall.oben)
  await seite.close()
  return { vorher, nachTaste, nachEins, nachZwei }
}

/** Alle Stapelfälle; liefert { abweichungen, faelle }. `antworte` ist der `page.route`-Handler der Ansichtsprüfung. */
export async function pruefeEscapeStapel(chromium, antworte) {
  const browser = await chromium.launch()
  const abweichungen = []
  for (const fall of FAELLE) {
    const m = await fahreFall(browser, antworte, fall)
    abweichungen.push(...stapelAbweichungen(`Detail-Panel + ${fall.name}`, m))
  }
  const einzeln = await pruefeEscapeEinzeln(browser, antworte)
  abweichungen.push(...einzeln.abweichungen)
  await browser.close()
  return { abweichungen, faelle: FAELLE.length + einzeln.faelle }
}
