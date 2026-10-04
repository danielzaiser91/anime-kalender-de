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
