/**
 * Messungen im Zellenrahmen der Bühne: Tippziele (≥ 44 px) und Textkontrast (WCAG AA).
 *
 * Die Browser-Funktionen laufen im Rahmen (`frame.evaluate`) und müssen deshalb ohne Außenwelt auskommen. Kontrast ohne
 * axe-core: Es kommt nichts vom CDN (die Bühne hat kein Netz), und die Farben der Seite sind `oklch`/`color-mix` —
 * die Leinwand (`canvas`) rechnet jede CSS-Farbe nach sRGB und legt Hintergrundschichten und Text gleich richtig übereinander.
 */

/** Mindestseite eines Tippziels; 43,5 wie in `kopf-pruefen.mjs` (Rundung der Layoutmaße). */
export const MIN_TIPPZIEL = 43.5

/** Alles Anklickbare, das sichtbar und kein Fließtext-Link ist. Gibt `{ schluessel, w, h }` je zu kleinem Ziel zurück. */
export function tippzieleImRahmen(minimum) {
  const ZIELE = 'a[href], button, [role="button"], [role="tab"], [role="link"], [role="switch"], input:not([type="hidden"]), select, textarea, summary'
  const beschreibung = (el) => {
    const text = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 40)
    return `${el.tagName.toLowerCase()} „${text}“`
  }
  const fehler = []
  for (const el of document.querySelectorAll(ZIELE)) {
    const stil = getComputedStyle(el)
    /* Ein unsichtbar gemachtes Eingabefeld (sr-only) in einem Etikett: das Etikett ist das Tippziel. */
    const r = (el.closest('label') ?? el).getBoundingClientRect()
    const sichtbar = r.width > 0 && r.height > 0 && stil.visibility !== 'hidden' && stil.display !== 'none'
    if (!sichtbar || stil.display === 'inline' || el.closest('[aria-hidden="true"]')) continue
    if (r.width < minimum || r.height < minimum) fehler.push({ schluessel: beschreibung(el), w: Math.round(r.width), h: Math.round(r.height) })
  }
  return fehler
}

/** Textkontrast aller sichtbaren Textknoten gegen den tatsächlichen Hintergrund; gibt die Verstöße als `{ schluessel, verhaeltnis, soll }` zurück. */
export function kontrastImRahmen() {
  const leinwand = document.createElement('canvas')
  leinwand.width = leinwand.height = 1
  const stift = leinwand.getContext('2d', { willReadFrequently: true })
  const farbe = (css) => {
    stift.clearRect(0, 0, 1, 1)
    stift.fillStyle = '#000'
    stift.fillStyle = css
    stift.fillRect(0, 0, 1, 1)
    return [...stift.getImageData(0, 0, 1, 1).data]
  }
  /* Hintergrundschichten von der Wurzel zum Element übereinanderlegen; Bild oder Verlauf = nicht messbar. */
  const hintergrund = (el) => {
    const kette = []
    for (let k = el; k; k = k.parentElement) kette.unshift(k)
    stift.clearRect(0, 0, 1, 1)
    stift.fillStyle = document.documentElement.classList.contains('dark') ? '#000' : '#fff'
    stift.fillRect(0, 0, 1, 1)
    for (const k of kette) {
      const s = getComputedStyle(k)
      if (s.backgroundImage !== 'none') return undefined
      stift.fillStyle = s.backgroundColor
      stift.fillRect(0, 0, 1, 1)
    }
    return [...stift.getImageData(0, 0, 1, 1).data]
  }
  const hell = ([r, g, b]) => {
    const l = [r, g, b].map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]
  }
  const deckkraft = (el) => {
    let o = 1
    for (let k = el; k; k = k.parentElement) o *= Number(getComputedStyle(k).opacity)
    return o
  }
  /* Text auf einem Bild (Cover, Hero) hat keinen messbaren Hintergrund: überspringen statt falsch melden. */
  const bilder = [...document.querySelectorAll('*')]
    .filter((b) => ['IMG', 'VIDEO', 'CANVAS'].includes(b.tagName) || getComputedStyle(b).backgroundImage !== 'none')
    .map((b) => b.getBoundingClientRect())
  const aufBild = (r) => bilder.some((b) => r.left + r.width / 2 > b.left && r.left + r.width / 2 < b.right && r.top + r.height / 2 > b.top && r.top + r.height / 2 < b.bottom)
  const befunde = []
  const gesehen = new Set()
  const knoten = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let t = knoten.nextNode(); t; t = knoten.nextNode()) {
    const el = t.parentElement
    const text = t.textContent.trim().replace(/\s+/g, ' ')
    if (!text || gesehen.has(el) || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) continue
    gesehen.add(el)
    const s = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    /* Deaktivierte Bedienelemente sind von WCAG 1.4.3 ausgenommen (`aus` = Zustand „deaktiviert“ der Design-Tafel). */
    const inaktiv = el.closest(':disabled, [aria-disabled="true"], [data-zustand="aus"]')
    if (inaktiv || r.width === 0 || r.height === 0 || s.visibility === 'hidden' || el.closest('[aria-hidden="true"]') || s.webkitTextFillColor === 'rgba(0, 0, 0, 0)') continue
    const grund = aufBild(r) ? undefined : hintergrund(el)
    const vorn = farbe(s.color)
    const alpha = (vorn[3] / 255) * deckkraft(el)
    if (!grund || alpha === 0) continue
    const text3 = vorn.slice(0, 3).map((v, i) => Math.round(v * alpha + grund[i] * (1 - alpha)))
    const [a, b] = [hell(text3), hell(grund)].sort((x, y) => y - x)
    const verhaeltnis = (a + 0.05) / (b + 0.05)
    const gross = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && Number(s.fontWeight) >= 700)
    const soll = gross ? 3 : 4.5
    if (verhaeltnis < soll - 0.01) befunde.push({ schluessel: `${el.tagName.toLowerCase()} „${text.slice(0, 40)}“`, verhaeltnis: Math.round(verhaeltnis * 100) / 100, soll })
  }
  return befunde
}
