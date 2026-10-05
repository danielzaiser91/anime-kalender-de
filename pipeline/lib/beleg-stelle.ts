import type { Page } from 'playwright'

/** Wo im Dokument die Aussage steht (Pixel ab Seitenanfang, bei 520 px Breite). */
export interface Stelle {
  oben: number
  unten: number
  links: number
  breite: number
  /** Unterkante der obersten Stützzeile — die Markierung im Bild gilt ihr; `unten` reicht bis zur untersten. */
  markeUnten: number
}

/**
 * **Die Stelle, die die Behauptung wirklich stützt** (Daniel, 05.10.2026: „Beleg und Behauptung müssen zusammenpassen"): der kleinste Absatz, Listenpunkt oder
 * die Tabellenzeile, die den Titel nennt **und** einen der Termine (`8. August 2026`, `04.12.`). Gibt es keinen mit beidem, der erste, der den Titel nennt.
 * Ohne diese Suche zeigte das Bild nur die ersten Absätze — ein Datum weiter unten im Artikel stand nicht darauf.
 */
export async function stuetzstelle(seite: Page, suchen: string[], tage: string[]): Promise<Stelle | undefined> {
  return seite.evaluate(
    ({ suchen, tage }) => {
      const MON = ['januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember']
      const marken = tage.flatMap((iso) => {
        const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
        return [`${d}. ${MON[m - 1]} ${y}`, `${d}. ${MON[m - 1]}`, `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.`, `${d}.${m}.`]
      })
      const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
      const wurzel = document.querySelector('article') ?? document.querySelector('main') ?? document.body
      const kandidaten = [...wurzel.querySelectorAll('p, li, tr, h2, h3')]
        .map((e) => ({ e: e as HTMLElement, text: norm((e as HTMLElement).innerText), roh: (e as HTMLElement).innerText.toLowerCase() }))
        .filter((k) => k.text.length > 12)
        .sort((a, b) => a.text.length - b.text.length)
      const gesucht = suchen.map(norm)
      /* Alle Zeilen, die einen Titel **und** einen Termin nennen — ein Artikel belegt oft mehrere Termine, und das Bild soll sie alle zeigen. Sonst die erste mit einem Titel. */
      const stuetzend = kandidaten.filter((k) => gesucht.some((g) => k.text.includes(g)) && marken.some((m) => k.roh.includes(m)))
      const gewaehlt = stuetzend.length ? stuetzend : gesucht.flatMap((g) => kandidaten.filter((k) => k.text.includes(g)).slice(0, 1)).slice(0, 1)
      if (!gewaehlt.length) return undefined
      const rects = gewaehlt.map((k) => k.e.getBoundingClientRect())
      const erste = rects.reduce((a, b) => (b.top < a.top ? b : a))
      return {
        oben: erste.top + window.scrollY,
        unten: Math.max(...rects.map((r) => r.bottom)) + window.scrollY,
        links: erste.left,
        breite: erste.width,
        /* Die Markierung gilt der obersten Zeile; der Ausschnitt reicht bis zur untersten. */
        markeUnten: erste.bottom + window.scrollY,
      }
    },
    { suchen, tage },
  )
}
