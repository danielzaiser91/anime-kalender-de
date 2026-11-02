/**
 * **Lesestelle über ein Neuladen retten** (Daniel, 01.11.2026): Lädt die Seite wegen einer neuen Fassung neu, steht der Besucher danach
 * wieder dort, wo er las — ohne Leere, ohne Bildlauf von oben.
 *
 * Zusagen (je ein Test in `pipeline/check-lesestelle.ts`):
 * - Gemerkt wird nur der Tag, der gerade unter der Kopfleiste liegt, samt Abstand; ohne sichtbaren Tag nichts.
 * - Eine Lesestelle gilt einmal und höchstens `GUELTIG_MS`; abgelaufen oder fremde Ansicht (Adresse) → keine.
 * - Wiederhergestellt wird sofort (`behavior: 'auto'`), sobald der Tag da ist; kommt er nicht innerhalb `FRIST_MS`, wird aufgegeben.
 * - Berührt der Besucher die Seite (Rad, Berührung, Taste) vor dem Tag, wird nichts mehr bewegt.
 * - Solange eine Lesestelle offen ist (bis `NACHLAUF_MS` nach dem Erfolg) und ihr Tag gezeigt wird, unterdrückt `lesestelleOffenFuer` den Sprung zu „heute“.
 */
export const SCHLUESSEL = 'ak-lesestelle'
export const GUELTIG_MS = 5 * 60_000
export const FRIST_MS = 8_000
export const NACHLAUF_MS = 2_000

export type Lesestelle = { datum: string; abstand: number; ort: string; zeit: number }

type Speicher = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type Dok = Pick<Document, 'querySelector' | 'querySelectorAll'>

/** Der erste Tag, dessen Unterkante unter der Kopfleiste liegt; `abstand` = seine Oberkante zur Kopfleiste. */
export function merkeLesestelle(doc: Dok, speicher: Speicher, ort: string, jetzt: number): void {
  try {
    const kopf = doc.querySelector('header')?.getBoundingClientRect().height ?? 0
    for (const tag of Array.from(doc.querySelectorAll<HTMLElement>('section[data-datum]'))) {
      const r = tag.getBoundingClientRect()
      if (r.bottom <= kopf + 1) continue
      const stelle: Lesestelle = { datum: tag.dataset.datum ?? '', abstand: r.top - kopf, ort, zeit: jetzt }
      if (stelle.datum) speicher.setItem(SCHLUESSEL, JSON.stringify(stelle))
      return
    }
  } catch {
    /* Ohne Speicher gibt es keine Lesestelle — dann beginnt die Seite wie immer. */
  }
}

/** Liest und löscht die Lesestelle; abgelaufen oder aus einer anderen Ansicht → undefined. */
export function nimmLesestelle(speicher: Speicher, ort: string, jetzt: number): Lesestelle | undefined {
  try {
    const roh = speicher.getItem(SCHLUESSEL)
    if (roh === null) return undefined
    speicher.removeItem(SCHLUESSEL)
    const s = JSON.parse(roh) as Lesestelle
    if (typeof s.datum !== 'string' || typeof s.abstand !== 'number' || s.ort !== ort) return undefined
    return jetzt - s.zeit < GUELTIG_MS ? s : undefined
  } catch {
    return undefined
  }
}

/** Setzt den Tag an seinen alten Abstand unter der Kopfleiste; false, wenn er (noch) nicht da ist. */
export function stelleWiederHer(doc: Dok, win: Pick<Window, 'scrollTo' | 'scrollY'>, stelle: Lesestelle): boolean {
  const tag = doc.querySelector<HTMLElement>(`section[data-datum="${stelle.datum}"]`)
  if (!tag) return false
  const kopf = doc.querySelector('header')?.getBoundingClientRect().height ?? 0
  win.scrollTo({ top: Math.max(0, tag.getBoundingClientRect().top + win.scrollY - kopf - stelle.abstand), behavior: 'auto' })
  return true
}

/** Offene Lesestelle dieses Starts (Modulzustand, einmal beim Laden gelesen). */
let offen: Lesestelle | undefined

export function lesestelleOffenFuer(daten: string[]): boolean {
  return offen !== undefined && daten.includes(offen.datum)
}

/** Nach eigenem Neuladen führt die Lesestelle, nicht der Sprung zu „heute“: dann gilt die Woche als schon angesprungen. */
export function lesestelleFuehrt(tage: Array<{ date: string }>, gesprungen: { current: string | undefined }, woche: string): boolean {
  if (!lesestelleOffenFuer(tage.map((t) => t.date))) return false
  gesprungen.current = woche
  return true
}

export type Umgebung = {
  doc: Document
  win: Window
  speicher: Speicher
  jetzt: () => number
  beobachte: (rueck: () => void) => () => void
}

const BERUEHRUNG = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const

/** Beim Start: gespeicherte Lesestelle holen und wiederherstellen, sobald ihr Tag gezeichnet ist. Liefert den Abbruch. */
export function starteWiederherstellung(u: Umgebung, ort: string, frist: (rueck: () => void, ms: number) => () => void): () => void {
  const stelle = nimmLesestelle(u.speicher, ort, u.jetzt())
  if (!stelle) return () => {}
  offen = stelle
  const lasse: Array<() => void> = []
  const ende = () => {
    for (const f of lasse) f()
    offen = undefined
  }
  /* Nach dem Erfolg bleibt die Lesestelle noch kurz „offen“: Der Sprung zu „heute“ entscheidet erst im Effekt nach dem Zeichnen. */
  const versuch = () => {
    if (!stelleWiederHer(u.doc, u.win, stelle)) return
    for (const f of lasse) f()
    frist(() => (offen = undefined), NACHLAUF_MS)
  }
  lasse.push(u.beobachte(versuch), frist(ende, FRIST_MS))
  for (const art of BERUEHRUNG) {
    u.win.addEventListener(art, ende, { once: true, passive: true })
    lasse.push(() => u.win.removeEventListener(art, ende))
  }
  versuch()
  return ende
}

/** Echte Umgebung des Browsers; je Fenster einmal (der Sprung-Hook ruft es bei jedem Zeichnen). Liest die Lesestelle, bevor der Sprung zu „heute“ entscheidet. */
export function starteWiederherstellungImBrowser(): void {
  const fenster = window as unknown as { akLesestelleGestartet?: boolean }
  if (fenster.akLesestelleGestartet) return
  fenster.akLesestelleGestartet = true
  starteWiederherstellung(
    {
      doc: document,
      win: window,
      speicher: sessionStorage,
      jetzt: () => Date.now(),
      beobachte: (rueck) => {
        const m = new MutationObserver(rueck)
        m.observe(document.body, { childList: true, subtree: true })
        return () => m.disconnect()
      },
    },
    ortJetzt(),
    (rueck, ms) => {
      const id = window.setTimeout(rueck, ms)
      return () => window.clearTimeout(id)
    },
  )
}

export const ortJetzt = () => location.pathname + location.hash.split('?')[0]
