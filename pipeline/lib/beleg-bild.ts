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
import { fensterStart, stuetzstelle, verdecktesMarkieren, type Stelle } from './beleg-stelle.ts'
import type { Gruppe } from './beleg-suche.ts'
import type { OhneMarkeGrund } from './beleg-marken.ts'

/** So hoch darf der Ausschnitt ab der Überschrift werden, wenn keine Stützstelle weiter unten liegt. */
const MAX_HOEHE = 1100
/** Liegt die Stützstelle weiter unten, darf der Ausschnitt bis hierher reichen; darüber entfällt der Kopf und das Bild beginnt vor der Stelle. */
const MAX_BIS_STELLE = 3600
/** Bei einem Sammelartikel (ab zwei Titeln) reicht der Ausschnitt weiter: 14 Titel der Crunchyroll-Herbstübersicht brauchen rund 4700 Pixel (Magic Knight Rayearth, 29.10.2026). Über `MAX_BIS_STELLE` wird nur einfach aufgelöst. */
const MAX_SAMMEL = 6000
/** Doppelte Auflösung: lesbar auch auf dem Desktop (Daniel, 07.10.2026). Steigt die Fassung, werden alle Bilder einmal neu aufgenommen. */
export const BILD_SKALA = 2
export { BILD_FASSUNG } from './beleg-lesung.ts'

export interface Beleg {
  bild: Buffer
  text: Buffer
  /** Wo die Aussage im Bild steht: `[links, oben, Breite, Höhe]` als Anteile von 0 bis 1 (Beleg-Dialog, „Zur Fundstelle"). */
  markierung?: [number, number, number, number]
  /** Bei einem Artikel für mehrere Titel: die Fundstelle je Titel-Kennung. */
  markierungen?: Record<string, [number, number, number, number]>
  /** Jeder Titel des Artikels ohne Marke mit dem Grund; zusammen mit `markierungen` deckt es alle Titel ab. */
  ohneMarke?: Record<string, OhneMarkeGrund>
}

interface Messung {
  clip: { x: number; y: number; width: number; height: number; scale: number }
  text: string
  markierung?: [number, number, number, number]
}

/** Läuft im Browser: entfernt Reste, prüft auf Wände und misst den Ausschnitt samt Fundstelle. */
function messeAusschnitt({ maxHoehe, maxBisStelle, skala, suchen, stelle, bisUnten, vonOben }: { maxHoehe: number; skala: number; maxBisStelle: number; suchen: string[]; stelle?: Stelle; bisUnten?: number; vonOben?: number }): Messung | 'wand' | undefined {
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
  const absaetze = [...wurzel.querySelectorAll('p, li, h2, h3')].filter((e) => !e.hasAttribute('data-beleg-verdeckt') && (e as HTMLElement).innerText.trim().length > 20)
  const kopf = (h1 ?? absaetze[0])?.getBoundingClientRect()
  if (!kopf) return undefined
  let oben = kopf.top + window.scrollY - 8
  let unten = Math.max(...absaetze.map((e) => e.getBoundingClientRect().bottom + window.scrollY).filter((y) => y - oben <= maxHoehe), oben + 200)
  if (stelle) {
    if (stelle.unten + 16 - oben > maxBisStelle) {
      oben = Math.max(0, stelle.oben - 500)
      unten = stelle.unten + 16
    } else unten = Math.max(unten, stelle.unten + 16)
    if (vonOben !== undefined) oben = Math.min(oben, vonOben)
    /* Mehrere Titel im Artikel: der Ausschnitt reicht bis zur Fundstelle des tiefsten, sonst fehlt dem unteren die Marke. */
    if (bisUnten) unten = Math.max(unten, bisUnten + 16)
    unten = Math.min(unten, oben + maxBisStelle)
  }
  const clip = { x: 0, y: Math.max(0, oben), width: 520, height: unten - oben + 16, scale: skala }
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

/** Entfernt feste und klebende Leisten — vor dem Messen der Fundstelle, sonst rutscht der Inhalt um die Leistenhöhe und die Marke sitzt daneben (Kinoheld: 64 px, 12.10.2026). */
async function leistenEntfernen(seite: Page): Promise<void> {
  await seite.evaluate(() => {
    document.querySelectorAll('body *').forEach((e) => {
      const p = getComputedStyle(e).position
      if ((p === 'fixed' || p === 'sticky') && !e.contains(document.querySelector('h1'))) e.remove()
    })
  })
}

/** Anwendungsseiten (Joyn, Disney+, Kinoheld) zeigen ihren Titel als Bild, das wir ausblenden — er steht dann als Textzeile über dem Ausschnitt (Daniel, 05.10.2026). */
async function titelzeileSetzen(seite: Page): Promise<void> {
  if (!/\/\/(?:www\.)?(?:joyn\.de|disneyplus\.com|kinoheld\.de)\//.test(seite.url())) return
  await seite.evaluate(() => {
    const roh = document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content || document.title
    const titel = roh.split(/\s[|\u2013\u2014-]\s/)[0]!.trim()
    if (!titel) return
    const zeile = document.createElement('h1')
    zeile.textContent = titel
    zeile.setAttribute('style', 'position:static;margin:0;background:#fff;color:#000;font:700 18px/1.3 sans-serif;padding:8px 16px')
    document.body.prepend(zeile)
  })
}

/** `'wand'`: Eine Zustimmungswand oder ein Banner bleibt trotz Entfernen im Bild — dann gibt es kein Bild. `'leer'`: Die Aufnahme ist einfarbig (Seite nicht gezeichnet). */
export async function belegAusschnitt(seite: Page, suchen: string[] = [], tage: string[] = [], gruppen: Gruppe[] = []): Promise<Beleg | 'wand' | 'leer' | undefined> {
  await seite.setViewportSize({ width: 520, height: 900 })
  await seite.addStyleTag({ content: 'img,picture,video,figure,svg,iframe{display:none!important} *{background-image:none!important} html{filter:grayscale(1)}' })
  /* Zustimmungswände und Banner liegen fest oder klebend über dem Text — entfernt, nicht beantwortet; bleibt eine, gibt es kein Bild. */
  if (!(await sperreEntfernen(seite))) return 'wand'
  await titelzeileSetzen(seite)
  await leistenEntfernen(seite)
  await verdecktesMarkieren(seite)
  const stelle = await stuetzstelle(seite, stuetzbegriffe(seite.url(), suchen), tage)
  const stellen = gruppen.length > 1 ? await Promise.all(gruppen.map(async (g) => [g.id, await stuetzstelle(seite, g.suchen, g.tage)] as const)) : []
  const bisUnten = Math.max(0, ...stellen.map(([, st]) => st?.unten ?? 0)) || undefined
  const hoechstens = gruppen.length > 1 ? MAX_SAMMEL : MAX_BIS_STELLE
  const vonOben = bisUnten ? fensterStart(stellen.flatMap(([, st]) => (st ? [st.oben] : [])), bisUnten, hoechstens) : undefined
  const gemessen = await seite.evaluate(messeAusschnitt, { maxHoehe: MAX_HOEHE, maxBisStelle: hoechstens, skala: BILD_SKALA, suchen, stelle, bisUnten, vonOben })
  if (!gemessen || gemessen === 'wand') return gemessen
  /* Ein Sammelartikel-Ausschnitt über `MAX_BIS_STELLE` (samt 16 Pixel Rand) wird einfach aufgelöst, sonst wächst das Bild auf über 400 KB. */
  if (gruppen.length > 1 && gemessen.clip.height > MAX_BIS_STELLE + 16) gemessen.clip.scale = 1
  const cdp = await seite.context().newCDPSession(seite)
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'webp', quality: 20, captureBeyondViewport: true, clip: gemessen.clip })
  await cdp.detach()
  if (await istEinfarbig(seite, data)) return 'leer'
  const je = markierungenJeTitel(stellen, gemessen.clip)
  /* Die Marke muss auf Text liegen: eine Marke auf leerer Fläche zeigt dem Leser nichts (Kinoheld, 12.10.2026). */
  for (const m of [gemessen.markierung, ...Object.values(je?.markierungen ?? {})]) if (m && (await istEinfarbig(seite, data, m))) return 'leer'
  return { bild: Buffer.from(data, 'base64'), text: gzipSync(Buffer.from(gemessen.text, 'utf8')), ...(gemessen.markierung ? { markierung: gemessen.markierung } : {}), ...(je ?? {}) }
}

/** Die Fundstelle jedes Titels als Anteile des Bildes; liegt sie außerhalb des Ausschnitts oder fehlt sie, gibt es für den Titel keine Marke, aber einen Grund (`beleg-marken.ts`). */
export function markierungenJeTitel(stellen: (readonly [number, Stelle | undefined])[], clip: Messung['clip']): { markierungen: Record<string, [number, number, number, number]>; ohneMarke: Record<string, OhneMarkeGrund> } | undefined {
  const markierungen: Record<string, [number, number, number, number]> = {}
  const ohneMarke: Record<string, OhneMarkeGrund> = {}
  for (const [id, st] of stellen) {
    if (!st) ohneMarke[id] = 'nicht-gefunden'
    else if (st.oben < clip.y || st.markeUnten > clip.y + clip.height) ohneMarke[id] = 'ausserhalb'
    else markierungen[id] = [Math.max(0, st.links / 520), (st.oben - clip.y) / clip.height, Math.min(1, st.breite / 520), (st.markeUnten - st.oben) / clip.height]
  }
  return stellen.length ? { markierungen, ohneMarke } : undefined
}

/** Kinoheld nennt den Erscheinungstag unter „Veröffentlichung“ — der Titel steht nur im Kopf und in der (eingeklappten) Kritik, also wird dort gesucht. */
export function stuetzbegriffe(url: string, suchen: string[]): string[] {
  return /\/\/(?:www\.)?kinoheld\.de\//.test(url) ? ['Veröffentlichung', ...suchen] : suchen
}

/** Ein einfarbiges Bild (Standardabweichung der Helligkeit unter 6) zeigt keine Aussage — die Seite war nicht gezeichnet oder von etwas Schwarzem verdeckt. Mit `bereich` (Anteile des Bildes) gilt es nur dort. */
export async function istEinfarbig(seite: Page, base64: string, bereich: [number, number, number, number] = [0, 0, 1, 1]): Promise<boolean> {
  return seite.evaluate(async ({ b64, bereich }) => {
    const bmp = await createImageBitmap(await (await fetch('data:image/webp;base64,' + b64)).blob())
    const sy = Math.min(bmp.height - 1, Math.max(0, Math.floor(bereich[1] * bmp.height)))
    const sx = Math.min(bmp.width - 1, Math.max(0, Math.floor(bereich[0] * bmp.width)))
    const sw = Math.max(1, Math.min(bmp.width - sx, Math.ceil(bereich[2] * bmp.width)))
    const sh = Math.max(1, Math.min(bmp.height - sy, 4000, Math.ceil(bereich[3] * bmp.height)))
    const c = new OffscreenCanvas(sw, sh)
    const g = c.getContext('2d')!
    g.drawImage(bmp, sx, sy, sw, sh, 0, 0, sw, sh)
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
  }, { b64: base64, bereich })
}
