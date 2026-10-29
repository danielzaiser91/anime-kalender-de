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
 * Oberkante des Ausschnitts, die die Überschrift des obersten Titels noch einschließt: die höchste Fundstelle, von der aus die unterste (`bisUnten`) in `maxBisStelle` Pixel passt.
 * Ohne das beginnt der Ausschnitt an der Fundstelle des Hauptbegriffs, und jeder Titel darüber verliert Überschrift und Marke (Psyren, 27.10.2026).
 */
export function fensterStart(oberkanten: number[], bisUnten: number, maxBisStelle: number): number | undefined {
  const passt = oberkanten.filter((o) => bisUnten + 16 - (o - 16) <= maxBisStelle)
  return passt.length ? Math.max(0, Math.min(...passt) - 16) : undefined
}

/**
 * Kennzeichnet Absätze, die ein Container mit festem Rand abschneidet (eingeklappte Kritik) oder die hinter dem Seitenende liegen, mit `data-beleg-verdeckt`:
 * Im Bild stünden sie auf leerer Fläche, also sind sie weder Stützstelle noch Grund, den Ausschnitt zu verlängern (Kinoheld, 12.10.2026).
 */
export async function verdecktesMarkieren(seite: Page): Promise<void> {
  await seite.evaluate(() => {
    for (const e of document.querySelectorAll('p, li, tr, h2, h3')) {
      const r = e.getBoundingClientRect()
      let weg = !r.width || !r.height || r.top + window.scrollY >= document.documentElement.scrollHeight
      for (let a = e.parentElement; a && a !== document.body && !weg; a = a.parentElement) {
        if (!/hidden|clip/.test(getComputedStyle(a).overflowY)) continue
        const ar = a.getBoundingClientRect()
        weg = r.top >= ar.bottom - 1 || r.bottom <= ar.top + 1
      }
      if (weg) e.setAttribute('data-beleg-verdeckt', '')
    }
  })
}

/**
 * **Die Stelle, die die Behauptung wirklich stützt** (Daniel, 05.10.2026: „Beleg und Behauptung müssen zusammenpassen"): der kleinste Absatz, Listenpunkt oder
 * die Tabellenzeile, die den Titel nennt **und** einen der Termine (`8. August 2026`, `04.12.`). Gibt es keinen mit beidem: mit Terminen keine Stelle, ohne Termine der erste, der den Titel nennt.
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
        .filter((e) => !e.hasAttribute('data-beleg-verdeckt'))
        .map((e) => ({ e: e as HTMLElement, text: norm((e as HTMLElement).innerText), roh: (e as HTMLElement).innerText.toLowerCase() }))
        .filter((k) => k.text.length > 12 || /^H[23]$/.test(k.e.tagName))
        .sort((a, b) => a.text.length - b.text.length)
      const gesucht = suchen.map(norm)
      /* Alle Zeilen, die einen Titel **und** einen Termin nennen — ein Artikel belegt oft mehrere Termine, und das Bild soll sie alle zeigen. Sonst die erste mit einem Titel. */
      const stuetzend = kandidaten.filter((k) => gesucht.some((g) => k.text.includes(g)) && marken.some((m) => k.roh.includes(m)))
      /* Ohne Termin im Text: lieber der Abschnitt mit dem Titel als Überschrift (Anbieter, Folgen, Sprache stehen darunter) als ein Listenpunkt in der Übersicht ganz oben. */
      const alsUeberschrift = gesucht.flatMap((g) => kandidaten.filter((k) => /^H[23]$/.test(k.e.tagName) && k.text.includes(g)).slice(0, 1)).slice(0, 1)
      /* Belegt der Artikel einen Termin (`tage`), sitzt die Marke nur auf einer Zeile, die ihn nennt: Auf einem Absatz „Betroffen sind … Virgin Road …" ohne Datum stünde sie als Beleg da (29.10.2026). Ohne Termin gilt der Titel. */
      const gewaehlt = stuetzend.length ? stuetzend : tage.length ? [] : alsUeberschrift.length ? alsUeberschrift : gesucht.flatMap((g) => kandidaten.filter((k) => k.text.includes(g)).slice(0, 1)).slice(0, 1)
      if (!gewaehlt.length) return undefined
      const rects = gewaehlt.map((k) => k.e.getBoundingClientRect())
      const erste = rects.reduce((a, b) => (b.top < a.top ? b : a))
      /* Bei einer Überschrift reicht die Stelle bis zur nächsten Überschrift oder Trennlinie, höchstens 450 Pixel tiefer. */
      let abschnittUnten = 0
      for (let n = stuetzend.length ? null : (alsUeberschrift[0]?.e.nextElementSibling ?? null); n && !/^(H[1-6]|HR)$/.test(n.tagName) && n.getBoundingClientRect().bottom - erste.top <= 450; n = n.nextElementSibling) abschnittUnten = Math.max(abschnittUnten, n.getBoundingClientRect().bottom)
      return {
        oben: erste.top + window.scrollY,
        unten: Math.max(abschnittUnten, ...rects.map((r) => r.bottom)) + window.scrollY,
        links: erste.left,
        breite: erste.width,
        /* Die Markierung gilt der obersten Zeile; der Ausschnitt reicht bis zur untersten. */
        markeUnten: erste.bottom + window.scrollY,
      }
    },
    { suchen, tage },
  )
}
