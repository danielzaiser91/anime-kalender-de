/**
 * **Das Foto einer Wochenprogramm-Zeile** (Beleg „angekündigt“, siehe `woche-beleg.ts`).
 *
 * Gemessen im Lauf am 15.10.2026 (Wegwerf-PoC, Zweig `poc/woche-bild`): Bei 900 px Breite zeigt der Artikel die Tage als Raster zu
 * vier Spalten, über jedem Tag ein Streifen mit dem Wochentag, darunter je Eintrag Cover, Titel, Flagge, „Folge N“ und Uhrzeit.
 * Das Bild reicht vom Wochentag-Streifen bis unter die Zeile (höchstens 1500 px), unverändert wie auf der Seite — ein Ausschnitt,
 * kein Nachbau. 1× Auflösung, WebP Qualität 20: gemessen rund 50 KB, Text und Flagge sind lesbar.
 */
import type { Page } from 'playwright'
import { ablegen } from './beleg-ablage.ts'
import { istEinfarbig } from './beleg-bild.ts'
import { meldeAbbruch } from './abbruch.ts'
import { log, readJson, warn, writeJson } from './util.ts'
import { BELEGE_DATEI, bildSchluessel, fortschreiben, zeilenSchluessel, type WocheBelege } from './woche-beleg.ts'
import type { WochenEintrag } from '../scrape-crunchyroll-woche.ts'

const BREITE = 900
const MAX_HOEHE = 1500
/** Mehr fällt je Woche kaum an; die Grenze schützt den Lauf, wenn viele Zeilen auf einmal neu sind (erster Lauf nach dem Einführen). */
const HOECHSTENS = 20

type Markierung = [number, number, number, number]
interface Ausschnitt {
  clip: { x: number; y: number; width: number; height: number }
  markierung: Markierung
}

/** Läuft im Browser: der Ausschnitt vom Wochentag-Streifen bis unter die Zeile und die Zeile als Anteile des Bildes. */
function messeZeile({ marke, breite, maxHoehe }: { marke: string; breite: number; maxHoehe: number }): Ausschnitt | undefined {
  const zeile = document.querySelector(`[data-woche-zeile="${marke}"]`)
  const titel = zeile?.parentElement?.querySelector('h3')
  if (!zeile || !titel) return undefined
  const tage = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
  let kopf: Element | undefined
  for (const e of document.querySelectorAll('body *')) {
    if (e === zeile) break
    if (e.childElementCount === 0 && tage.includes((e.textContent ?? '').trim())) kopf = e
  }
  const z = zeile.getBoundingClientRect()
  const t = titel.getBoundingClientRect()
  const unten = z.bottom + window.scrollY + 16
  const kopfOben = (kopf ? kopf.getBoundingClientRect().top : t.top) + window.scrollY - 40
  const oben = Math.max(0, kopfOben, unten - maxHoehe)
  const hoehe = unten - oben
  const links = Math.max(0, Math.min(t.left, z.left) - 6)
  const rechts = Math.min(breite, Math.max(t.right, z.right) + 6)
  const markeOben = t.top + window.scrollY - 4
  const markeUnten = z.bottom + window.scrollY + 4
  return {
    clip: { x: 0, y: oben, width: breite, height: hoehe },
    markierung: [links / breite, (markeOben - oben) / hoehe, (rechts - links) / breite, (markeUnten - markeOben) / hoehe],
  }
}

export async function zeileFotografieren(seite: Page, marke: string): Promise<{ bild: Buffer; markierung: Markierung } | undefined> {
  const a = await seite.evaluate(messeZeile, { marke, breite: BREITE, maxHoehe: MAX_HOEHE })
  if (!a) return undefined
  const cdp = await seite.context().newCDPSession(seite)
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'webp', quality: 20, captureBeyondViewport: true, clip: { ...a.clip, scale: 1 } })
  await cdp.detach()
  /* Eine Marke auf leerer Fläche zeigt nichts (Seite nicht gezeichnet): dann kein Bild, der nächste Lauf versucht es wieder. */
  if (await istEinfarbig(seite, data, a.markierung)) return undefined
  return { bild: Buffer.from(data, 'base64'), markierung: a.markierung }
}

/**
 * Fotografiert die offenen Zeilen und legt die Bilder in der privaten Ablage ab; trägt Schlüssel, Zeit und Markierung in `belege` ein.
 * Ohne Ablage (kein Token, Worker nicht erreichbar) bleibt die Zeile offen. Gibt die Zahl der neuen Bilder zurück.
 */
export async function bilderAnlegen(seite: Page, belege: WocheBelege, offen: { schluessel: string; marke: string }[], jetzt: string): Promise<number> {
  if (!process.env.LAUF_TOKEN || !offen.length) return 0
  await seite.setViewportSize({ width: BREITE, height: 900 })
  await seite.waitForTimeout(800)
  let neu = 0
  for (const { schluessel, marke } of offen.slice(0, HOECHSTENS)) {
    const foto = await zeileFotografieren(seite, marke)
    const beleg = belege[schluessel]!
    const key = foto && (await ablegen(bildSchluessel(beleg, jetzt), foto.bild, 'image/webp'))
    if (!foto || !key) continue
    belege[schluessel] = { ...beleg, bild: key, bildAm: jetzt, markierung: foto.markierung }
    neu++
  }
  return neu
}

/** Führt die Liste fort (neue deutsche Zeilen vermerken) und fotografiert, was noch kein Bild hat. `marken[k]` gehört zu `eintraege[k]`. */
export async function belegeFuehren(seite: Page, alt: WocheBelege, eintraege: WochenEintrag[], marken: string[], artikel: string, jetzt: string): Promise<{ belege: WocheBelege; neu: number; offen: number }> {
  const { belege, offen } = fortschreiben(alt, eintraege, artikel, jetzt)
  const markeJe = new Map(eintraege.map((e, k) => [zeilenSchluessel(e), marken[k]!]))
  const neu = await bilderAnlegen(seite, belege, offen.map((schluessel) => ({ schluessel, marke: markeJe.get(schluessel)! })), jetzt)
  return { belege, neu, offen: offen.length - neu }
}

/**
 * Der Schritt im Wochenprogramm-Lauf: Liste lesen, fortführen, schreiben. Scheitert er, geht der Lauf weiter (die Zeilen sind da schon
 * geschrieben) und meldet sich als Vorfall — sonst fehlte das Bild still, bis eine Meldung es braucht.
 */
export async function belegeAktualisieren(seite: Page, eintraege: WochenEintrag[], marken: string[], artikel: string, jetzt: string): Promise<void> {
  try {
    const r = await belegeFuehren(seite, readJson<WocheBelege>(BELEGE_DATEI, {}), eintraege, marken, artikel, jetzt)
    writeJson(BELEGE_DATEI, r.belege, true)
    log(`Wochenprogramm-Bilder: ${r.neu} neu, ${r.offen} offen, ${Object.keys(r.belege).length} Zeilen geführt`)
  } catch (err) {
    warn(`Wochenprogramm-Bilder: ${(err as Error).message}`)
    await meldeAbbruch('wochenprogramm-bilder', err)
  }
}
