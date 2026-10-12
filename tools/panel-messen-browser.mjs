/**
 * Messfunktionen für das Detail-Panel, die **im Browser** laufen (`page.evaluate`): Sie müssen ohne Außenwelt auskommen,
 * jede liest das Panel selbst (`[data-panel="titel"]`). Aufrufer ist `tools/panel-messen.mjs`.
 */

/** Alle Schriftgrößen der Textknoten im Panel: `{ "15": ["p „Alle 24 …“", …] }` (je Größe höchstens fünf Beispiele). */
export function schriftgroessen() {
  const wurzel = document.querySelector('[data-panel="titel"]')
  const je = {}
  const knoten = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT)
  for (let t = knoten.nextNode(); t; t = knoten.nextNode()) {
    const text = t.textContent.trim().replace(/\s+/g, ' ')
    const el = t.parentElement
    if (!text || ['SCRIPT', 'STYLE'].includes(el.tagName)) continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') continue
    const px = String(parseFloat(getComputedStyle(el).fontSize))
    const bsp = `${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')} „${text.slice(0, 30)}“`
    if ((je[px] ??= []).length < 5) je[px].push(bsp)
  }
  return je
}

/** Alles Anklickbare im Panel unter `minimum` px (Breite oder Höhe) — auch Textlinks im Fließtext. */
export function tippziele(minimum) {
  const wurzel = document.querySelector('[data-panel="titel"]')
  const ZIELE = 'a[href], button, [role="button"], [role="tab"], [role="switch"], input:not([type="hidden"]), select, textarea, summary'
  const fehler = []
  for (const el of wurzel.querySelectorAll(ZIELE)) {
    const stil = getComputedStyle(el)
    /* Ein unsichtbares Eingabefeld (Schalter) trägt sein Etikett als Tippziel. */
    const r = (el.labels?.[0] ?? el).getBoundingClientRect()
    if (r.width === 0 || r.height === 0 || stil.visibility === 'hidden' || stil.display === 'none' || el.closest('[aria-hidden="true"]')) continue
    if (r.width >= minimum && r.height >= minimum) continue
    const text = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)
    fehler.push({ schluessel: `${el.tagName.toLowerCase()} „${text}“`, w: Math.round(r.width), h: Math.round(r.height) })
  }
  return fehler
}

/**
 * Textkontrast (WCAG AA, 4,5 : 1; ab 24 px oder 18,66 px fett 3 : 1) aller Texte im Panel **außerhalb des Bildes** (`[data-kopf]`).
 * Die Leinwand rechnet jede CSS-Farbe nach sRGB. Verläufe zählen nicht (die Karten tönen nur leicht), Fotos schon: Text darüber
 * wird übersprungen.
 */
export function kontrast() {
  const wurzel = document.querySelector('[data-panel="titel"]')
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
  const grundVon = (el) => {
    const kette = []
    for (let k = el; k; k = k.parentElement) kette.unshift(k)
    stift.clearRect(0, 0, 1, 1)
    stift.fillStyle = document.documentElement.classList.contains('dark') ? '#000' : '#fff'
    stift.fillRect(0, 0, 1, 1)
    for (const k of kette) {
      stift.fillStyle = getComputedStyle(k).backgroundColor
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
    for (let k = el; k && k !== document.body; k = k.parentElement) o *= Number(getComputedStyle(k).opacity)
    return o
  }
  const fotos = [...wurzel.querySelectorAll('*')]
    .filter((b) => b.tagName === 'IMG' || getComputedStyle(b).backgroundImage.includes('url('))
    .map((b) => b.getBoundingClientRect())
  const aufFoto = (r) => fotos.some((b) => r.left + r.width / 2 > b.left && r.left + r.width / 2 < b.right && r.top + r.height / 2 > b.top && r.top + r.height / 2 < b.bottom)
  const befunde = []
  const gesehen = new Set()
  const knoten = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT)
  for (let t = knoten.nextNode(); t; t = knoten.nextNode()) {
    const el = t.parentElement
    const text = t.textContent.trim().replace(/\s+/g, ' ')
    if (!text || gesehen.has(el) || el.closest('[data-kopf]') || el.closest('[aria-hidden="true"]')) continue
    gesehen.add(el)
    const s = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0 || s.visibility === 'hidden' || aufFoto(r)) continue
    const grund = grundVon(el)
    const vorn = farbe(s.color)
    const alpha = (vorn[3] / 255) * deckkraft(el)
    const gemischt = vorn.slice(0, 3).map((v, i) => Math.round(v * alpha + grund[i] * (1 - alpha)))
    const [a, b] = [hell(gemischt), hell(grund)].sort((x, y) => y - x)
    const verhaeltnis = (a + 0.05) / (b + 0.05)
    const px = parseFloat(s.fontSize)
    const soll = px >= 24 || (px >= 18.66 && Number(s.fontWeight) >= 700) ? 3 : 4.5
    if (verhaeltnis < soll - 0.01) befunde.push({ schluessel: `${el.tagName.toLowerCase()} „${text.slice(0, 40)}“`, verhaeltnis: Math.round(verhaeltnis * 100) / 100, soll })
  }
  return befunde
}

/** Maße und Inhalt des Kopfs: Banner, Posterkarte, Knöpfe im Bild, Flaggen, Unschärfe-Elemente im ganzen Panel. */
export function kopfMasse() {
  const wurzel = document.querySelector('[data-panel="titel"]')
  const kopf = wurzel.querySelector('[data-kopf]')
  const box = (el) => {
    const r = el?.getBoundingClientRect()
    return r ? { l: r.left, t: r.top, r: r.right, b: r.bottom, w: Math.round(r.width), h: Math.round(r.height) } : undefined
  }
  const flaggen = wurzel.querySelector('[data-flaggen]')
  const filter = [...wurzel.querySelectorAll('*')].filter((e) => {
    const s = getComputedStyle(e)
    return s.filter !== 'none' || (s.backdropFilter && s.backdropFilter !== 'none')
  })
  const name = wurzel.querySelector('h2')
  return {
    kopf: box(kopf),
    poster: box(wurzel.querySelector('[data-poster]')),
    name: box(name),
    knoepfeImBild: [...(kopf?.querySelectorAll('button') ?? [])].map((b) => ({ label: b.getAttribute('aria-label') ?? b.textContent.trim(), ...box(b) })),
    flaggenBox: box(flaggen),
    flaggen: [...(flaggen?.querySelectorAll('a, span.inline-flex') ?? [])].map((f) => ({ text: f.textContent.trim().replace(/\s+/g, ' '), href: f.getAttribute('href') })),
    filterElemente: filter.length,
    kastenTop: box(wurzel.querySelector('section'))?.t,
  }
}
