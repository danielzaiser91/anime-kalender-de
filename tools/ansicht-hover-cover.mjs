/**
 * Cover-Vorschau beim Zeigen auf eine Listenzeile der Woche (Im Handel, Im Fernsehen; 14.10.2026), gemessen in der gebauten App:
 * - Maus: kein Bild vor dem Zeigen; die Vorschau steht nach der Frist (`VORSCHAU_FRIST_MS` = 150), spätestens nach 600 ms,
 *   und nicht schon nach 100 ms; ihr Bild wird erst dann angefordert; Zeile und Liste bewegen sich nicht (kein Layout-Sprung);
 *   beim Verlassen verschwindet sie.
 * - Rollen (scroll) oder Fensterwechsel (blur) nach dem Zeigen, vor Ablauf der Frist: keine Vorschau, kein Bildabruf.
 * - Touch: eine Zeigerberührung der Art `touch` lässt keine Vorschau entstehen und fordert kein Bild an.
 * Zeilen mit Cover tragen `data-hover-zeile`; die Prüfung probiert die ersten acht und meldet, wenn keine eine Vorschau bekommt.
 */
const FRIST_MIN_MS = 100
const FRIST_MAX_MS = 600
const ZEILEN = '[data-hover-zeile]'

/** Fordert ein Bild an: nur Anfragen an fremde Hosts (Cover), nicht die App selbst. Läuft in Node. */
function bilderZaehler(seite) {
  const urls = []
  seite.on('request', (r) => {
    if (r.resourceType() === 'image' && new URL(r.url()).hostname !== 'ak.test') urls.push(r.url())
  })
  return urls
}

/** Messung im Browser: wartet auf die Vorschau nach dem nächsten `pointerover` und gibt Dauer, Bild und Lage der Zeile zurück. */
function beobachteVorschau() {
  return new Promise((fertig) => {
    const t0 = { v: 0 }
    addEventListener('pointerover', () => (t0.v ||= performance.now()), { capture: true, once: true })
    const ende = setTimeout(() => fertig(null), 1500)
    new MutationObserver((_, o) => {
      const karte = document.querySelector('[data-hover-cover]')
      if (!karte) return
      o.disconnect()
      clearTimeout(ende)
      fertig({ nach: performance.now() - t0.v, bild: karte.querySelector('img')?.currentSrc ?? '' })
    }).observe(document.body, { childList: true, subtree: true })
  })
}

/** Rechteck der Zeile und ihrer Liste; ändert sich beim Zeigen etwas, ist es ein Layout-Sprung. Läuft im Browser. */
function lage(el) {
  const z = el.getBoundingClientRect()
  const l = el.parentElement.getBoundingClientRect()
  return [z.top, z.height, l.top, l.height].map((n) => Math.round(n * 10) / 10).join(',')
}

/** Die ersten Zeilen der Woche; die erste, die mit der Maus eine Vorschau bekommt, wird gemessen. */
async function messeMaus(seite, urls) {
  const zeilen = seite.locator(ZEILEN)
  const anzahl = Math.min(await zeilen.count(), 8)
  for (let i = 0; i < anzahl; i++) {
    const zeile = zeilen.nth(i)
    await zeile.scrollIntoViewIfNeeded()
    await seite.mouse.move(2, 2)
    const vorher = urls.length
    const davor = await zeile.evaluate(lage)
    const messung = seite.evaluate(beobachteVorschau)
    const box = await zeile.boundingBox()
    await seite.mouse.move(box.x + Math.min(box.width / 2, 60), box.y + box.height / 2)
    const m = await messung
    if (!m) continue
    const danach = await zeile.evaluate(lage)
    await seite.waitForTimeout(300)
    const bild = await seite.locator('[data-hover-cover] img').first().evaluate((i) => i.currentSrc)
    const angefordert = urls.slice(vorher)
    m.bild = bild
    await seite.mouse.move(2, 2)
    await seite.waitForTimeout(200)
    const bleibt = await seite.locator('[data-hover-cover]').count()
    return { ...m, sprung: davor !== danach, bildAngefordert: angefordert.some((u) => u === m.bild), bleibt }
  }
  return null
}

/** Eine Berührung der Art `touch` auf jeder der ersten Zeilen: keine Vorschau, kein neues Bild. */
async function messeTouch(seite, urls) {
  const vorher = urls.length
  const vorschauen = await seite.evaluate(async (zeilenWahl) => {
    let n = 0
    for (const zeile of [...document.querySelectorAll(zeilenWahl)].slice(0, 8)) {
      zeile.dispatchEvent(new PointerEvent('pointerover', { pointerType: 'touch', bubbles: true, clientX: 50, clientY: 50 }))
      await new Promise((r) => setTimeout(r, 300))
      n += document.querySelectorAll('[data-hover-cover]').length
    }
    return n
  }, ZEILEN)
  return { vorschauen, neueBilder: urls.length - vorher }
}

/** Rollen oder Fensterwechsel während der Frist: weder Karte noch Bildabruf. Zählt Karten und neue Bilder je Auslöser. */
async function messeAbbruch(seite, urls) {
  const zeile = seite.locator(ZEILEN).first()
  await zeile.scrollIntoViewIfNeeded()
  const ergebnis = {}
  const ausloeser = {
    Rollen: () => document.dispatchEvent(new Event('scroll')),
    Fensterwechsel: () => window.dispatchEvent(new Event('blur')),
  }
  for (const [name, aktion] of Object.entries(ausloeser)) {
    await seite.mouse.move(2, 2)
    await seite.waitForTimeout(200)
    const vorher = urls.length
    const box = await zeile.boundingBox()
    await seite.mouse.move(box.x + Math.min(box.width / 2, 60), box.y + box.height / 2)
    await seite.waitForTimeout(40)
    await seite.evaluate(aktion)
    await seite.waitForTimeout(500)
    ergebnis[name] = { karten: await seite.locator('[data-hover-cover]').count(), bilder: urls.length - vorher }
  }
  await seite.mouse.move(2, 2)
  return ergebnis
}

/** Wertet die Messungen aus; leer, wenn alles stimmt. */
export function hoverCoverAbweichungen(maus, touch, abbruch) {
  if (!maus) return ['keine der ersten 8 Zeilen (Im Handel, Im Fernsehen) bekam mit der Maus eine Cover-Vorschau']
  const a = []
  if (maus.nach < FRIST_MIN_MS) a.push(`Vorschau schon nach ${Math.round(maus.nach)} ms (mindestens ${FRIST_MIN_MS} ms Ruhe des Zeigers)`)
  if (maus.nach > FRIST_MAX_MS) a.push(`Vorschau erst nach ${Math.round(maus.nach)} ms (spätestens ${FRIST_MAX_MS} ms)`)
  if (!maus.bildAngefordert) a.push('das Bild der Vorschau wurde nicht erst beim Zeigen angefordert')
  if (maus.sprung) a.push('Zeile oder Liste hat sich beim Zeigen bewegt (Layout-Sprung)')
  if (maus.bleibt) a.push('Vorschau bleibt nach dem Verlassen der Zeile stehen')
  if (touch.vorschauen) a.push(`Berührung (touch) erzeugte ${touch.vorschauen} Vorschau(en)`)
  if (touch.neueBilder) a.push(`Berührung (touch) forderte ${touch.neueBilder} Bild(er) an`)
  for (const [name, m] of Object.entries(abbruch)) {
    if (m.karten) a.push(`${name} während der Frist: Vorschau erschien trotzdem`)
    if (m.bilder) a.push(`${name} während der Frist: ${m.bilder} Bild(er) trotzdem angefordert`)
  }
  return a
}

/** Öffnet die Woche bei 1280 × 900, misst Maus und Touch; `antworte` ist der `page.route`-Handler der Ansichtsprüfung. */
export async function pruefeHoverCover(chromium, antworte) {
  const browser = await chromium.launch()
  const seite = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await seite.route('**/*', antworte)
  const urls = bilderZaehler(seite)
  await seite.goto('http://ak.test/#/woche', { waitUntil: 'networkidle' })
  await seite.waitForTimeout(2500)
  const maus = await messeMaus(seite, urls)
  const touch = await messeTouch(seite, urls)
  const abbruch = await messeAbbruch(seite, urls)
  await browser.close()
  return { maus, touch, abweichungen: hoverCoverAbweichungen(maus, touch, abbruch) }
}
