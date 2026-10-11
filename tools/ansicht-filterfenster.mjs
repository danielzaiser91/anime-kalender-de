/**
 * Zusicherungen für das offene Filterfenster am Handy (Entwurf vom 09.10.2026): volle Breite, ein Rahmen, Klick-Modus klebt
 * oben, Tippziele. Aufgerufen von `ansicht-bild.mjs --handy`; die Seite muss die App aus `dist/` ausliefern.
 */
const BREITEN = [320, 375, 393, 440]
const ROUTEN = ['woche', 'datenbank']

/** Misst im geöffneten Fenster alles, was die Zusicherungen brauchen. Läuft im Browser. */
function messeFenster() {
  const fenster = document.querySelector('#ak-filter')
  const f = fenster.getBoundingClientRect()
  const pille = [...fenster.querySelectorAll('button.rounded-full[aria-pressed]')].at(-1)
  let kasten = 0
  for (let e = pille.parentElement; e && e !== fenster; e = e.parentElement) {
    if (parseFloat(getComputedStyle(e).borderTopWidth) > 0) kasten++
  }
  const klick = fenster.querySelector('[role=group]')
  const knoepfe = [...klick.querySelectorAll('button')].map((b) => b.getBoundingClientRect().height)
  const suche = fenster.querySelector('input[type=search]').getBoundingClientRect().height
  const chips = [...fenster.querySelectorAll('button.h-8.rounded-full[aria-pressed]')]
  const treffer = chips.map((c) => {
    const r = c.getBoundingClientRect()
    const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2 - 20)
    return { text: c.textContent.trim(), h: r.height, ok: e === c || c.contains(e) }
  })
  const mehr = [...fenster.querySelectorAll('.border-dashed button[aria-expanded]')].map((b) => parseFloat(getComputedStyle(b, '::after').height))
  const fertig = [...fenster.querySelectorAll('button')].find((b) => /^Fertig/.test(b.textContent.trim()))
  const fuss = fertig.parentElement.getBoundingClientRect()
  return {
    links: f.left,
    rechts: innerWidth - f.right,
    hoehe: f.height,
    ueberbreite: fenster.scrollWidth - fenster.clientWidth,
    kasten,
    klickPosition: getComputedStyle(klick).position,
    klickHoehe: klick.getBoundingClientRect().height,
    knoepfe,
    suche,
    chipX: chips[0]?.getBoundingClientRect().left,
    chips: treffer,
    mehrHit: mehr,
    fussUnten: f.bottom - fuss.bottom,
  }
}

/** Scrollt das Fenster ans Ende und liefert den Abstand der Klick-Zeile zur Fensterkante. */
function messeKleben() {
  const fenster = document.querySelector('#ak-filter')
  fenster.scrollTop = fenster.scrollHeight
  const abstand = document.querySelector('#ak-filter [role=group]').getBoundingClientRect().top - fenster.getBoundingClientRect().top
  const fertig = [...fenster.querySelectorAll('button')].find((b) => /^Fertig/.test(b.textContent.trim()))
  return { klickOben: abstand, fussUnten: fenster.getBoundingClientRect().bottom - fertig.parentElement.getBoundingClientRect().bottom }
}

/** Die Abweichungen eines Messwerts gegen den Entwurf, als Texte. */
function abweichungen(wo, m, k) {
  const a = []
  if (Math.abs(m.links) > 0.5 || Math.abs(m.rechts) > 0.5) a.push(`${wo}: Fenster nicht bündig (links ${m.links}, rechts ${m.rechts})`)
  if (m.kasten > 0) a.push(`${wo}: ${m.kasten} verschachtelte Rahmen im Fenster`)
  if (m.klickPosition !== 'sticky') a.push(`${wo}: Klick-Modus nicht sticky (${m.klickPosition})`)
  if (Math.abs(k.klickOben) > 1) a.push(`${wo}: Klick-Modus klebt nicht oben (Abstand ${Math.round(k.klickOben)} px nach Scrollen)`)
  if (m.knoepfe.some((h) => h < 44)) a.push(`${wo}: Klick-Modus-Knopf unter 44 px (${m.knoepfe.join('/')})`)
  if (m.suche < 40) a.push(`${wo}: Suchfeld unter 40 px (${m.suche})`)
  if (m.chipX > 13) a.push(`${wo}: erster Schnell-Chip bei x ${Math.round(m.chipX)} (soll ≤ 13)`)
  if (!m.chips.length) a.push(`${wo}: keine Schnell-Chips gefunden`)
  for (const c of m.chips.filter((c) => !c.ok || c.h !== 32)) a.push(`${wo}: Chip „${c.text}" Höhe ${c.h}, Treffer 20 px über der Mitte ${c.ok ? 'ok' : 'verfehlt'}`)
  if (m.mehrHit.some((h) => h < 44)) a.push(`${wo}: „mehr Filter" Trefferfläche unter 44 px (${m.mehrHit.join('/')})`)
  if (k.fussUnten > 1 || m.fussUnten < -1) a.push(`${wo}: Fuß nicht am Fensterrand (${Math.round(k.fussUnten)} / ${Math.round(m.fussUnten)} px)`)
  if (m.ueberbreite > 0) a.push(`${wo}: Fenster scrollt waagerecht (${m.ueberbreite} px)`)
  return a
}

/** Öffnet das Filterfenster je Breite und Route und prüft es; gibt `{ abweichungen, messungen }` zurück. */
export async function pruefeFilterfenster(seite) {
  const alle = []
  const messungen = []
  for (const breite of BREITEN) {
    await seite.setViewportSize({ width: breite, height: 800 })
    for (const route of ROUTEN) {
      await seite.goto('about:blank')
      await seite.goto(`http://ak.test/#/${route}`, { waitUntil: 'networkidle' })
      await seite.locator('button[aria-controls="ak-filter"]').first().click()
      await seite.locator('#ak-filter').waitFor({ state: 'visible' })
      await seite.waitForTimeout(1500)
      const m = await seite.evaluate(messeFenster)
      const k = await seite.evaluate(messeKleben)
      messungen.push({ breite, route, ...m, ...k })
      alle.push(...abweichungen(`${route} ${breite} px`, m, k))
    }
  }
  return { abweichungen: alle, messungen }
}
