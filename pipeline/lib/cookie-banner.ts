import type { Page } from 'playwright'

/**
 * **Zustimmungsbanner weg, bevor ein Beleg fotografiert wird** (Daniel, 04.10.2026, am Crunchyroll-Kalender-Beleg, über dem ein Sony-Banner
 * halb im Bild stand: „in Zukunft immer den cookie banner entfernen vor screenshots").
 *
 * Zuerst die bekannten Kennungen der Anbieter von Zustimmungswänden, dann alles Feste oder Klebende, dessen Text von Cookies oder einer Einwilligung
 * spricht (Banner haben Text; die Kopfleiste einer Seite trägt ihn nicht). Entfernt, nicht beantwortet — wie bisher bei OneTrust.
 * Gibt zurück, wie viele Elemente weg sind.
 */
const BEKANNT = [
  '#onetrust-consent-sdk',
  '#CybotCookiebotDialog',
  '#usercentrics-root',
  '[id^="sp_message_container"]',
  '.cc-window',
  '#cookie-banner',
  '[id*="cookie-consent"]',
  '[class*="cookie-banner"]',
  '[id*="contentpass" i]',
  '[class*="contentpass" i]',
  '[aria-modal="true"]',
  'dialog[open]',
]

export async function bannerEntfernen(seite: Page): Promise<number> {
  return seite.evaluate((bekannt) => {
    let n = 0
    const weg = (e: Element) => {
      e.remove()
      n++
    }
    for (const s of bekannt) document.querySelectorAll(s).forEach(weg)
    document.querySelectorAll('body *').forEach((e) => {
      const stil = getComputedStyle(e)
      if (stil.position !== 'fixed' && stil.position !== 'sticky') return
      const text = (e as HTMLElement).innerText ?? ''
      if (text.length > 60 && /cookie|einwillig|consent/i.test(text) && !e.querySelector('h1')) weg(e)
    })
    return n
  }, BEKANNT)
}

/**
 * **Qualitätssicherung vor dem Foto** (Daniel, 05.10.2026: „stell sicher, dass keine Cookie-Banner drin bleiben"): Nach dem Entfernen wird das Fenster an einem Raster
 * abgetastet. Liegt dort etwas über dem Artikel, das nicht zu ihm gehört (festes oder klebendes Element mit Ebene, Dialog, Einwilligungstext), wird sein oberstes
 * Element unter `body` entfernt — bis zu dreimal. Bleibt danach noch etwas, ist die Seite eine Wand und `false` kommt zurück: kein Bild.
 * Das Fenster hat 520 px Breite (`beleg-bild.ts`).
 */
export async function sperreEntfernen(seite: Page): Promise<boolean> {
  await bannerEntfernen(seite)
  for (let durchgang = 0; durchgang < 3; durchgang++) {
    const weg = await seite.evaluate(() => {
      const art = document.querySelector('article') ?? document.querySelector('main')
      const h1 = document.querySelector('h1')
      /* Das Element in der Kette von `e` nach oben, das wie eine Sperre über dem Artikel liegt — oder `undefined`. */
      const sperre = (e: Element): Element | undefined => {
        for (let x: Element | null = e; x && x !== document.body; x = x.parentElement) {
          if (x.contains(h1)) return undefined
          const st = getComputedStyle(x)
          if (x.getAttribute('role') === 'dialog' || x.getAttribute('aria-modal') === 'true') return x
          if (['fixed', 'sticky', 'absolute'].includes(st.position) && Number(st.zIndex) >= 10) return x
        }
        const text = (e as HTMLElement).innerText ?? ''
        return !art?.contains(e) && text.length > 60 && /cookie|einwillig|consent|contentpass|mit werbung/i.test(text) ? e : undefined
      }
      let n = 0
      for (const x of [100, 260, 420]) {
        for (const y of [160, 300, 450, 600, 750]) {
          const e = document.elementFromPoint(x, y)
          if (!e || e === document.body || e === document.documentElement || h1?.contains(e)) continue
          const treffer = sperre(e)
          if (!treffer) continue
          /* Außerhalb des Artikels fliegt der oberste Block unter `body` raus (Wand samt Abdunklung), innerhalb nur das Element selbst. */
          let weg: Element = treffer
          if (!art?.contains(treffer)) while (weg.parentElement && weg.parentElement !== document.body) weg = weg.parentElement
          if (weg.contains(h1) || weg === art) continue
          weg.remove()
          n++
        }
      }
      return n
    })
    if (!weg) return true
  }
  return false
}
