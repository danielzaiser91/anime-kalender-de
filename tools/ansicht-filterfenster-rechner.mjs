/**
 * Zusicherungen für das offene Filterfenster am Rechner (Woche: `#ak-filterfeld`, Datenbank: Kasten über der Leiste) und die
 * Abstands-Zusicherungen, die Rechner und Handy teilen (Entwurf 12.10.2026): Fuß fest, der Scroller darüber,
 * seine Scrollbar innerhalb des Rands, der Scrollbereich beginnt am Kopf des Rahmens.
 *
 * **Scrollbars müssen sichtbar sein:** Playwright startet Chromium mit `--hide-scrollbars`, dann misst man 0 px.
 * Darum öffnet dieser Teil einen eigenen Browser ohne dieses Argument (die Bilder in `docs/` bleiben unberührt).
 */
const OEFFNER = { woche: 'button[aria-controls="ak-filterfeld"]', datenbank: 'div.fixed button[aria-expanded]' }

/** Abweichungen bei Kopf-Luft, Scroller zwischen Kopf und Fuß und Scrollbar im Rand; `m` kommt aus `messeRechner` bzw. `messeFenster`. */
export function abstandsAbweichungen(wo, m) {
  const a = []
  if (m.scrollerUeberFuss != null && m.scrollerUeberFuss > 0.5) a.push(`${wo}: Scroller reicht über die Oberkante des Fußes (${Math.round(m.scrollerUeberFuss)} px)`)
  if (m.scrollerUeberRand > 0.5) a.push(`${wo}: Scrollbar liegt ${Math.round(m.scrollerUeberRand)} px außerhalb des Fensters`)
  return a
}

/** Misst im geöffneten Rechner-Fenster; läuft im Browser. */
function messeRechner() {
  const scroller = [...document.querySelectorAll('[data-filter-scroll]')].find((e) => e.offsetParent)
  let rahmen = scroller.parentElement
  while (rahmen && !(getComputedStyle(rahmen).overflowY === 'hidden' && parseFloat(getComputedStyle(rahmen).borderTopLeftRadius) > 0)) rahmen = rahmen.parentElement
  if (!rahmen) return { fehler: 'kein Rahmen mit overflow-hidden und Radius um den Scrollbereich' }
  const fertig = [...rahmen.querySelectorAll('button')].find((b) => /^Fertig/.test(b.textContent.trim()))
  const f = rahmen.getBoundingClientRect()
  const s = scroller.getBoundingClientRect()
  const fuss = fertig?.parentElement.getBoundingClientRect()
  const rechterRand = f.right - parseFloat(getComputedStyle(rahmen).borderRightWidth)
  scroller.scrollTop = scroller.scrollHeight
  return {
    scrollerUeberFuss: fuss ? s.bottom - fuss.top : null,
    scrollerUeberRand: s.right - rechterRand,
    scrollbar: scroller.offsetWidth - scroller.clientWidth,
    scrollt: scroller.scrollHeight > scroller.clientHeight,
    fussUnten: fuss ? f.bottom - fertig.parentElement.getBoundingClientRect().bottom : null,
  }
}

/** Öffnet Woche und Datenbank bei 1280 × 800 und prüft die Abstände; `antworte` ist der `page.route`-Handler der Ansichtsprüfung. */
export async function pruefeFilterfensterRechner(chromium, antworte) {
  const browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] })
  const seite = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await seite.route('**/*', antworte)
  const alle = []
  const messungen = []
  for (const route of Object.keys(OEFFNER)) {
    await seite.goto('about:blank')
    await seite.goto(`http://ak.test/#/${route}`, { waitUntil: 'networkidle' })
    await seite.waitForTimeout(2000)
    await seite.locator(OEFFNER[route]).first().click()
    await seite.locator('[data-filter-scroll]').first().waitFor({ state: 'visible' })
    await seite.waitForTimeout(1200)
    const m = await seite.evaluate(messeRechner)
    messungen.push({ route, ...m })
    alle.push(...rechnerAbweichungen(`${route} 1280 px`, m))
  }
  await browser.close()
  return { abweichungen: alle, messungen }
}

/** Die Abweichungen eines Rechner-Messwerts als Texte. */
function rechnerAbweichungen(wo, m) {
  if (m.fehler) return [`${wo}: ${m.fehler}`]
  const a = abstandsAbweichungen(wo, m)
  if (!m.scrollt) a.push(`${wo}: Mittelteil scrollt nicht (kein Überlauf zum Messen)`)
  if (m.scrollbar < 1) a.push(`${wo}: keine sichtbare Scrollbar gemessen — Messung wertlos`)
  if (m.fussUnten != null && m.fussUnten > 1.5) a.push(`${wo}: Fuß nicht am Fensterrand (${Math.round(m.fussUnten)} px)`)
  return a
}
