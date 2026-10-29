/**
 * Escape schließt in der Wochenansicht je ein Fenster allein (Datum-Sprung, Abo-Menü als schwebende Karte, Filterfenster): die Ebene ist
 * offen, ein Escape schließt sie, der Fokus kehrt zum Auslöser zurück. Regel `einzelnAbweichungen` aus den Messwerten von `messeEinzeln`.
 * Gehört zu `ansicht-escape-stapel.mjs`; prüft die Verdrahtung von `useEscape` an den Aufrufstellen, die kein Panel darunter haben.
 */
const ADRESSE = 'http://ak.test/#/woche'
const FAELLE = [
  { name: 'Datum-Sprung', ausloeser: 'button[aria-label="Zu einem Datum springen"]', ebene: '[role="dialog"][aria-label="Zu einem Datum springen"]' },
  { name: 'Abo-Menü', ausloeser: 'button[aria-label^="Menü: Kalender-Abo"]', ebene: '[role="dialog"][aria-label^="Menü: Kalender-Abo"]' },
  { name: 'Filterfenster am Handy', ausloeser: 'button[aria-label="Filter"]', ebene: '[role="dialog"][aria-label="Filter"]', handy: true },
  { name: 'Filterfeld', ausloeser: 'button[aria-label="Filter"]', ebene: 'button[aria-label="Filter"][aria-expanded="true"]', ohneFokus: true },
]

/** `m`: { vorher, nachTaste, nachher } = offene Ebenen vor, nach einer anderen Taste und nach Escape; `fokus`: liegt der Fokus am Auslöser. */
export function einzelnAbweichungen(wo, m) {
  if (!m.vorher) return [`${wo}: Fenster nicht aufgegangen`]
  const a = []
  if (m.nachTaste !== m.vorher) a.push(`${wo}: eine andere Taste als Escape schließt das Fenster`)
  if (m.nachher !== 0) a.push(`${wo}: Escape schließt das Fenster nicht`)
  if (!m.fokus) a.push(`${wo}: Fokus kehrt nach Escape nicht zum Auslöser zurück`)
  return a
}

async function messeEinzeln(browser, antworte, fall) {
  const fenster = fall.handy ? { viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true } : { viewport: { width: 1366, height: 900 } }
  const seite = await browser.newPage(fenster)
  await seite.route('**/*', antworte)
  await seite.goto('about:blank')
  await seite.goto(ADRESSE, { waitUntil: 'networkidle' })
  const ausloeser = seite.locator(fall.ausloeser).first()
  await ausloeser.waitFor({ state: 'visible', timeout: 15_000 })
  await seite.waitForTimeout(800)
  await ausloeser.click()
  await seite.waitForTimeout(600)
  const zaehle = () => seite.locator(fall.ebene).count()
  const vorher = await zaehle()
  await seite.keyboard.press('Shift')
  await seite.waitForTimeout(300)
  const nachTaste = await zaehle()
  await seite.keyboard.press('Escape')
  await seite.waitForTimeout(500)
  const nachher = await zaehle()
  const fokus = await ausloeser.evaluate((e) => e === document.activeElement)
  await seite.close()
  return { vorher, nachTaste, nachher, fokus: fokus || Boolean(fall.ohneFokus) }
}

/** Alle Einzelfälle; liefert die Abweichungen. */
export async function pruefeEscapeEinzeln(browser, antworte) {
  const abweichungen = []
  for (const fall of FAELLE) abweichungen.push(...einzelnAbweichungen(`Wochenansicht + ${fall.name}`, await messeEinzeln(browser, antworte, fall)))
  return { abweichungen, faelle: FAELLE.length }
}
