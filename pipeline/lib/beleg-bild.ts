/**
 * **Das Beleg-Bild: nur die Aussage, klein.**
 *
 * Eine Vollseite war im Mittel 520 KB (Anime2You) bzw. 420 KB (aniSearch), samt Newsticker,
 * Kommentaren und Empfehlungen. Gemessen am 03.10.2026: Überschrift bis zum Aussage-Absatz bei
 * 520 px Breite, ohne Bilder, in Grau, als WebP mit Qualität 20 — **rund 15 KB** und lesbar. Dazu
 * der Artikeltext als gepackte Textdatei (wenige KB) statt der ganzen HTML-Seite (75 KB).
 */
import { gzipSync } from 'node:zlib'
import type { Page } from 'playwright'
import { bannerEntfernen } from './cookie-banner.ts'

/** So hoch darf der Ausschnitt ab der Überschrift werden — genug für Datum, Kopf und die ersten Absätze. */
const MAX_HOEHE = 1100

export interface Beleg {
  bild: Buffer
  text: Buffer
  /** Wo die Aussage im Bild steht: `[links, oben, Breite, Höhe]` als Anteile von 0 bis 1 (Beleg-Dialog, „Zur Fundstelle"). */
  markierung?: [number, number, number, number]
}

export async function belegAusschnitt(seite: Page, suchen: string[] = []): Promise<Beleg | undefined> {
  await seite.setViewportSize({ width: 520, height: 900 })
  await seite.addStyleTag({ content: 'img,picture,video,figure,svg,iframe{display:none!important} *{background-image:none!important} html{filter:grayscale(1)}' })
  /* Zustimmungswände und Banner liegen fest oder klebend über dem Text — entfernt, nicht beantwortet. */
  await bannerEntfernen(seite)
  const ausschnitt = await seite.evaluate(({ maxHoehe, suchen }) => {
    document.querySelectorAll('body *').forEach((e) => {
      const p = getComputedStyle(e).position
      if ((p === 'fixed' || p === 'sticky') && !e.contains(document.querySelector('h1'))) e.remove()
    })
    /*
      Liegt in der Mitte des Fensters etwas, das nicht zum Artikel gehört, ist es eine Zustimmungswand
      (Anime2You/contentpass, am Rechner sichtbar, auf dem Runner nicht). Ihr Oberelement unter `body`
      wird entfernt; bleibt sie, gibt es kein Bild — eine Wand ist kein Beleg.
    */
    const imWeg = (): boolean => {
      const treffer = document.elementFromPoint(260, 450)
      const art = document.querySelector('article') ?? document.querySelector('main')
      return Boolean(treffer && art && !art.contains(treffer) && treffer !== document.body && treffer !== document.documentElement)
    }
    for (let i = 0; i < 2 && imWeg(); i++) {
      let e = document.elementFromPoint(260, 450) as HTMLElement | null
      while (e?.parentElement && e.parentElement !== document.body) e = e.parentElement
      e?.remove()
    }
    if (imWeg()) return undefined
    const wurzel = (document.querySelector('article') ?? document.querySelector('main') ?? document.body) as HTMLElement
    const h1 = document.querySelector('h1')
    const absaetze = [...wurzel.querySelectorAll('p, li, h2, h3')].filter((e) => (e as HTMLElement).innerText.trim().length > 20)
    const kopf = (h1 ?? absaetze[0])?.getBoundingClientRect()
    if (!kopf) return undefined
    const oben = kopf.top + window.scrollY - 8
    const unten = Math.max(
      ...absaetze.map((e) => e.getBoundingClientRect().bottom + window.scrollY).filter((y) => y - oben <= maxHoehe),
      oben + 200,
    )
    const clip = { x: 0, y: Math.max(0, oben), width: 520, height: unten - oben + 16, scale: 1 }
    /* Die Fundstelle: der erste Absatz im Ausschnitt, der einen der gesuchten Namen nennt — als Anteile des Bildes. */
    const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
    let markierung: [number, number, number, number] | undefined
    for (const name of suchen) {
      const gesucht = norm(name)
      const treffer = [h1, ...absaetze].filter((e): e is HTMLElement => Boolean(e)).find((e) => {
        const r = e.getBoundingClientRect()
        const top = r.top + window.scrollY
        return top >= clip.y && top + r.height <= clip.y + clip.height && norm(e.innerText).includes(gesucht)
      })
      if (!treffer) continue
      const r = treffer.getBoundingClientRect()
      markierung = [Math.max(0, r.left / 520), (r.top + window.scrollY - clip.y) / clip.height, Math.min(1, r.width / 520), r.height / clip.height]
      break
    }
    return { clip, text: wurzel.innerText, markierung }
  }, { maxHoehe: MAX_HOEHE, suchen })
  if (!ausschnitt) return undefined
  const cdp = await seite.context().newCDPSession(seite)
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'webp', quality: 20, captureBeyondViewport: true, clip: ausschnitt.clip })
  await cdp.detach()
  return { bild: Buffer.from(data, 'base64'), text: gzipSync(Buffer.from(ausschnitt.text, 'utf8')), ...(ausschnitt.markierung ? { markierung: ausschnitt.markierung } : {}) }
}
