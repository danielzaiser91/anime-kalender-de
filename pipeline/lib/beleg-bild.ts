/**
 * **Das Beleg-Bild: die Aussage, klein.**
 *
 * Eine Vollseite war im Mittel 520 KB (Anime2You) bzw. 420 KB (aniSearch), samt Newsticker,
 * Kommentaren und Empfehlungen. Gemessen am 03.10.2026: Überschrift bis zum Aussage-Absatz bei
 * 520 px Breite, ohne Bilder, in Grau, als WebP mit Qualität 20 — **rund 15 KB** und lesbar. Dazu
 * der Artikeltext als gepackte Textdatei (wenige KB) statt der ganzen HTML-Seite (75 KB).
 * Seit dem 05.10.2026 reicht der Ausschnitt bis zu der Stelle, die die Behauptung stützt (`beleg-stelle.ts`).
 */
import { gzipSync } from 'node:zlib'
import type { Page } from 'playwright'
import { sperreEntfernen } from './cookie-banner.ts'
import { stuetzstelle, type Stelle } from './beleg-stelle.ts'

/** So hoch darf der Ausschnitt ab der Überschrift werden, wenn keine Stützstelle weiter unten liegt. */
const MAX_HOEHE = 1100
/** Liegt die Stützstelle weiter unten, darf der Ausschnitt bis hierher reichen; darüber entfällt der Kopf und das Bild beginnt vor der Stelle. */
const MAX_BIS_STELLE = 3600

export interface Beleg {
  bild: Buffer
  text: Buffer
  /** Wo die Aussage im Bild steht: `[links, oben, Breite, Höhe]` als Anteile von 0 bis 1 (Beleg-Dialog, „Zur Fundstelle"). */
  markierung?: [number, number, number, number]
}

interface Messung {
  clip: { x: number; y: number; width: number; height: number; scale: number }
  text: string
  markierung?: [number, number, number, number]
}

/** Läuft im Browser: entfernt Reste, prüft auf Wände und misst den Ausschnitt samt Fundstelle. */
function messeAusschnitt({ maxHoehe, maxBisStelle, suchen, stelle }: { maxHoehe: number; maxBisStelle: number; suchen: string[]; stelle?: Stelle }): Messung | 'wand' | undefined {
  document.querySelectorAll('body *').forEach((e) => {
    const p = getComputedStyle(e).position
    if ((p === 'fixed' || p === 'sticky') && !e.contains(document.querySelector('h1'))) e.remove()
  })
  /* Liegt in der Mitte des Fensters etwas, das nicht zum Artikel gehört, ist es eine Zustimmungswand — bleibt sie, gibt es kein Bild. */
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
  if (imWeg()) return 'wand'
  const wurzel = (document.querySelector('article') ?? document.querySelector('main') ?? document.body) as HTMLElement
  const h1 = document.querySelector('h1')
  const absaetze = [...wurzel.querySelectorAll('p, li, h2, h3')].filter((e) => (e as HTMLElement).innerText.trim().length > 20)
  const kopf = (h1 ?? absaetze[0])?.getBoundingClientRect()
  if (!kopf) return undefined
  let oben = kopf.top + window.scrollY - 8
  let unten = Math.max(...absaetze.map((e) => e.getBoundingClientRect().bottom + window.scrollY).filter((y) => y - oben <= maxHoehe), oben + 200)
  if (stelle) {
    if (stelle.unten + 16 - oben > maxBisStelle) {
      oben = Math.max(0, stelle.oben - 500)
      unten = stelle.unten + 16
    } else unten = Math.max(unten, stelle.unten + 16)
    unten = Math.min(unten, oben + maxBisStelle)
  }
  const clip = { x: 0, y: Math.max(0, oben), width: 520, height: unten - oben + 16, scale: 1 }
  /* Die Fundstelle als Anteile des Bildes: die Stützstelle, sonst der erste Absatz im Ausschnitt, der einen der gesuchten Namen nennt. */
  const anteile = (r: { top: number; left: number; width: number; height: number }): [number, number, number, number] => [Math.max(0, r.left / 520), (r.top + window.scrollY - clip.y) / clip.height, Math.min(1, r.width / 520), r.height / clip.height]
  let markierung: [number, number, number, number] | undefined
  if (stelle) markierung = anteile({ top: stelle.oben - window.scrollY, left: stelle.links, width: stelle.breite, height: stelle.markeUnten - stelle.oben })
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  for (const name of markierung ? [] : suchen) {
    const gesucht = norm(name)
    const treffer = [h1, ...absaetze].filter((e): e is HTMLElement => Boolean(e)).find((e) => {
      const r = e.getBoundingClientRect()
      const top = r.top + window.scrollY
      return top >= clip.y && top + r.height <= clip.y + clip.height && norm(e.innerText).includes(gesucht)
    })
    if (!treffer) continue
    markierung = anteile(treffer.getBoundingClientRect())
    break
  }
  return { clip, text: wurzel.innerText, ...(markierung ? { markierung } : {}) }
}

/** `'wand'`: Eine Zustimmungswand oder ein Banner bleibt trotz Entfernen im Bild — dann gibt es kein Bild. `'leer'`: Die Aufnahme ist einfarbig (Seite nicht gezeichnet). */
export async function belegAusschnitt(seite: Page, suchen: string[] = [], tage: string[] = []): Promise<Beleg | 'wand' | 'leer' | undefined> {
  await seite.setViewportSize({ width: 520, height: 900 })
  await seite.addStyleTag({ content: 'img,picture,video,figure,svg,iframe{display:none!important} *{background-image:none!important} html{filter:grayscale(1)}' })
  /* Zustimmungswände und Banner liegen fest oder klebend über dem Text — entfernt, nicht beantwortet; bleibt eine, gibt es kein Bild. */
  if (!(await sperreEntfernen(seite))) return 'wand'
  const stelle = await stuetzstelle(seite, suchen, tage)
  const gemessen = await seite.evaluate(messeAusschnitt, { maxHoehe: MAX_HOEHE, maxBisStelle: MAX_BIS_STELLE, suchen, stelle })
  if (!gemessen || gemessen === 'wand') return gemessen
  const cdp = await seite.context().newCDPSession(seite)
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'webp', quality: 20, captureBeyondViewport: true, clip: gemessen.clip })
  await cdp.detach()
  if (await istEinfarbig(seite, data)) return 'leer'
  return { bild: Buffer.from(data, 'base64'), text: gzipSync(Buffer.from(gemessen.text, 'utf8')), ...(gemessen.markierung ? { markierung: gemessen.markierung } : {}) }
}

/** Ein einfarbiges Bild (Standardabweichung der Helligkeit unter 6) zeigt keine Aussage — die Seite war nicht gezeichnet oder von etwas Schwarzem verdeckt. */
async function istEinfarbig(seite: Page, base64: string): Promise<boolean> {
  return seite.evaluate(async (b64) => {
    const bmp = await createImageBitmap(await (await fetch('data:image/webp;base64,' + b64)).blob())
    const c = new OffscreenCanvas(bmp.width, Math.min(bmp.height, 4000))
    const g = c.getContext('2d')!
    g.drawImage(bmp, 0, 0)
    const d = g.getImageData(0, 0, c.width, c.height).data
    let s = 0
    let s2 = 0
    let n = 0
    for (let i = 0; i < d.length; i += 16) {
      const v = (d[i]! + d[i + 1]! + d[i + 2]!) / 3
      s += v
      s2 += v * v
      n++
    }
    const mittel = s / n
    return Math.sqrt(s2 / n - mittel * mittel) < 6
  }, base64)
}
