/**
 * Mini-DOM für Komponenten- und Hook-Tests ohne Browser und ohne jsdom: gerade genug, damit `react-dom/client`
 * rendert, Ereignisse am Wurzelknoten ankommen und `window`/`document` nur das tun, was der Test erlaubt.
 * Gebrauch: `installiereMiniDom(fenster)`, dann `createRoot(dom.wurzel)`; Klicks über `klicke(knoten)`.
 */
import { registerHooks } from 'node:module'

type Hoerer = { f: (e: unknown) => void; capture: boolean }

export class MiniKnoten {
  nodeType: number
  nodeName: string
  tagName: string
  localName: string
  namespaceURI = 'http://www.w3.org/1999/xhtml'
  ownerDocument: MiniKnoten | null = null
  parentNode: MiniKnoten | null = null
  childNodes: MiniKnoten[] = []
  attribute = new Map<string, string>()
  hoerer = new Map<string, Hoerer[]>()
  style: Record<string, unknown> & { setProperty: (n: string, w: string) => void; removeProperty: (n: string) => void }
  nodeValue: string | null = null
  constructor(art: number, name: string, dok: MiniKnoten | null) {
    this.nodeType = art
    this.nodeName = name
    this.tagName = name.toUpperCase()
    this.localName = name
    this.ownerDocument = dok
    this.style = { setProperty: () => undefined, removeProperty: () => undefined }
  }
  get firstChild() { return this.childNodes[0] ?? null }
  get lastChild() { return this.childNodes[this.childNodes.length - 1] ?? null }
  get nextSibling(): MiniKnoten | null { return this.parentNode ? (this.parentNode.childNodes[this.parentNode.childNodes.indexOf(this) + 1] ?? null) : null }
  get previousSibling(): MiniKnoten | null { return this.parentNode ? (this.parentNode.childNodes[this.parentNode.childNodes.indexOf(this) - 1] ?? null) : null }
  get data() { return this.nodeValue ?? '' }
  set data(w: string) { this.nodeValue = w }
  get textContent(): string {
    return this.nodeType === 3 ? this.data : this.childNodes.map((k) => k.textContent).join('')
  }
  set textContent(w: string) {
    this.childNodes.forEach((k) => (k.parentNode = null))
    this.childNodes = []
    if (w) this.appendChild(new MiniKnoten(3, '#text', this.ownerDocument).mitText(w))
  }
  mitText(w: string): this {
    this.nodeValue = w
    return this
  }
  insertBefore(k: MiniKnoten, vor: MiniKnoten | null): MiniKnoten {
    k.parentNode?.removeChild(k)
    const i = vor ? this.childNodes.indexOf(vor) : -1
    if (i < 0) this.childNodes.push(k)
    else this.childNodes.splice(i, 0, k)
    k.parentNode = this
    return k
  }
  appendChild(k: MiniKnoten): MiniKnoten { return this.insertBefore(k, null) }
  removeChild(k: MiniKnoten): MiniKnoten {
    const i = this.childNodes.indexOf(k)
    if (i >= 0) this.childNodes.splice(i, 1)
    k.parentNode = null
    return k
  }
  setAttribute(n: string, w: unknown) { this.attribute.set(n, String(w)) }
  setAttributeNS(_ns: string | null, n: string, w: unknown) { this.setAttribute(n, w) }
  getAttribute(n: string) { return this.attribute.get(n) ?? null }
  hasAttribute(n: string) { return this.attribute.has(n) }
  removeAttribute(n: string) { this.attribute.delete(n) }
  addEventListener(art: string, f: (e: unknown) => void, o?: boolean | { capture?: boolean }) {
    const capture = typeof o === 'object' ? !!o.capture : !!o
    this.hoerer.set(art, [...(this.hoerer.get(art) ?? []), { f, capture }])
  }
  removeEventListener(art: string, f: (e: unknown) => void) {
    this.hoerer.set(art, (this.hoerer.get(art) ?? []).filter((h) => h.f !== f))
  }
  contains(k: MiniKnoten | null): boolean {
    for (let x = k; x; x = x.parentNode) if (x === this) return true
    return false
  }
  focus() {}
  blur() {}
  getRootNode(): MiniKnoten { return this.parentNode ? this.parentNode.getRootNode() : this }
  /** Alle Nachfahren in Dokumentreihenfolge, die der Prüfung `passt` genügen. */
  /** Die Optionen eines `select` (React liest sie beim Aufbau). */
  get options(): MiniKnoten[] {
    return this.finde((k) => k.tagName === 'OPTION')
  }

  finde(passt: (k: MiniKnoten) => boolean): MiniKnoten[] {
    return this.childNodes.flatMap((k) => [...(passt(k) ? [k] : []), ...k.finde(passt)])
  }
}

export interface MiniFenster {
  setTimeout: (f: () => void, ms: number) => number
  clearTimeout: (h: number) => void
  matchMedia: (abfrage: string) => { matches: boolean; addEventListener: () => void; removeEventListener: () => void }
}

const SCHLUESSEL = ['window', 'document', 'navigator', 'Image', 'IS_REACT_ACT_ENVIRONMENT'] as const

/** Setzt `window`, `document` und `Image` (Attrappe) als Globals; `entferne()` stellt den Zustand davor her. */
export function installiereMiniDom(fenster: MiniFenster, neuesBild: () => unknown) {
  const g = globalThis as Record<string, unknown>
  const vorher = SCHLUESSEL.map((s) => [s, Object.getOwnPropertyDescriptor(g, s)] as const)
  const dok = new MiniKnoten(9, '#document', null)
  dok.ownerDocument = dok
  const html = dok.appendChild(new MiniKnoten(1, 'html', dok))
  const wurzel = html.appendChild(new MiniKnoten(1, 'div', dok))
  const win = Object.assign(Object.create(null), fenster, { document: dok, HTMLIFrameElement: class {}, addEventListener() {}, removeEventListener() {} })
  Object.assign(dok, { defaultView: win, documentElement: html, body: html, activeElement: null })
  Object.assign(dok, {
    createElement: (n: string) => new MiniKnoten(1, n, dok),
    createElementNS: (_ns: string, n: string) => new MiniKnoten(1, n, dok),
    createTextNode: (w: string) => new MiniKnoten(3, '#text', dok).mitText(w),
  })
  const setze = (s: string, w: unknown) => Object.defineProperty(g, s, { value: w, configurable: true, writable: true })
  setze('window', win)
  setze('document', dok)
  setze('navigator', { userAgent: 'mini-dom' })
  setze('Image', function Bild() { return neuesBild() })
  setze('IS_REACT_ACT_ENVIRONMENT', true)
  return {
    wurzel,
    entferne: () => vorher.forEach(([s, d]) => (d ? Object.defineProperty(g, s, d) : delete g[s])),
  }
}

/** Ein Klick wie vom Browser: erst Erfassungs-, dann Blasenhörer am Wurzelknoten, `target` ist `ziel`. */
export function klicke(wurzel: MiniKnoten, ziel: MiniKnoten): void {
  const e = { type: 'click', target: ziel, bubbles: true, cancelable: true, defaultPrevented: false, timeStamp: 0, preventDefault() {}, stopPropagation() {} }
  const hoerer = wurzel.hoerer.get('click') ?? []
  for (const capture of [true, false]) hoerer.filter((h) => h.capture === capture).forEach((h) => h.f(e))
}

/** Attrappe-Uhr für `MiniFenster`: Zeitgeber laufen nur, wenn `schiebe` die Zeit voranstellt. */
export function attrappeUhr() {
  let jetzt = 0
  let nr = 0
  const timer = new Map<number, { f: () => void; ab: number }>()
  return {
    setTimeout: (f: () => void, ms: number): number => {
      timer.set(++nr, { f, ab: jetzt + ms })
      return nr
    },
    clearTimeout: (h: number): void => void timer.delete(h),
    /** Stellt die Zeit um `ms` vor und feuert fällige Zeitgeber in Reihenfolge; `zwischen` läuft nach jedem (z. B. `act`). */
    async schiebe(ms: number, zwischen: (f: () => void) => Promise<void>): Promise<void> {
      const ziel = jetzt + ms
      for (;;) {
        const faellig = [...timer.entries()].filter(([, t]) => t.ab <= ziel).sort((a, b) => a[1].ab - b[1].ab)[0]
        if (!faellig) break
        jetzt = faellig[1].ab
        timer.delete(faellig[0])
        await zwischen(faellig[1].f)
      }
      jetzt = ziel
    },
    offen: (): number => timer.size,
  }
}

/** Lässt `import './x.css'` wirkungslos zu (der Browser-Bündler lädt Stil, ein Test braucht ihn nicht); vor dem Import der Komponente aufrufen. */
export function ignoriereCss(): void {
  registerHooks({
    load: (url, kontext, weiter) => (url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : weiter(url, kontext)),
  })
}
