import type { WegListe } from './anisearch-archiv-vorrang.ts'
import { nachFehlern } from './anisearch-sperre.ts'
import { sprecherAus } from './anisearch-sprecher.ts'
import { PARSER_STAND, type Eintrag } from './anisearch-sprecher-reihe.ts'
import { log, warn } from './util.ts'

const MAX_FEHLER_IN_FOLGE = 5
/** So viele Seiten ohne eine einzige Besetzungszeile in Folge gelten als Sperrseite, nicht als Auskunft (gemessen: 484 von 5.078 Seiten sind leer, 10.10.2026). */
const LEER_IN_FOLGE = 15
const SICHERN_ALLE = 25

/** `weg` ist die endgültige Auskunft 404/410; alles andere ohne Seite ist eine Nichtauskunft (`fehler`). */
export type Abruf = { art: 'ok'; html: string } | { art: 'weg'; code: number } | { art: 'fehler' }

export interface Lauf {
  /** Holt eine Sprecherseite. */
  hole: (id: number) => Promise<Abruf>
  warte: (ms: number) => Promise<void>
  /** Legt die rohe Seite ab, bevor sie ausgewertet wird. */
  archiviere: (id: number, html: string) => void
  /** Schreibt Bestand und Auskunftsliste. */
  sichern: () => void
  weg: WegListe
  taktMs: number
  /** Spätester Zeitpunkt (ms), zu dem ein weiterer Abruf beginnt; Pausen nach einer Sperre müssen davor enden. */
  ende: number
  minuten: number
}
export interface Zaehler {
  geholt: number
  weg: number
  /** Leere Seiten in einer Folge von {@link LEER_IN_FOLGE}: nicht als Befund gespeichert. */
  verdacht: number
}
interface Strecke {
  fehlerInFolge: number
  leerInFolge: number
}

function nimmAuf(id: number, html: string, bestand: Record<string, Eintrag>, lauf: Lauf, z: Zaehler, s: Strecke): void {
  lauf.archiviere(id, html)
  const sprecher = sprecherAus(html)
  const leer = !sprecher.de.length && !sprecher.ja
  s.leerInFolge = leer ? s.leerInFolge + 1 : 0
  if (leer && s.leerInFolge >= LEER_IN_FOLGE) {
    s.fehlerInFolge++
    z.verdacht++
    return
  }
  s.fehlerInFolge = 0
  bestand[String(id)] = { ...sprecher, fetchedAt: new Date().toISOString(), stand: PARSER_STAND }
  z.geholt++
}

/**
 * Holt die Seiten der Reihe nach. Fehlschläge in Folge (Sperre, Zeitüberschreitung) lösen Pausen aus (`lib/anisearch-sperre.ts`), danach fragt der Lauf einzeln
 * nach; reicht die Frist nicht mehr, endet er. Wer nicht kam, bleibt in der Lücke. Vermerkt wird nur eine endgültige Auskunft (404/410).
 */
export async function arbeiteAb(schlange: number[], bestand: Record<string, Eintrag>, lauf: Lauf): Promise<Zaehler> {
  const z: Zaehler = { geholt: 0, weg: 0, verdacht: 0 }
  const s: Strecke = { fehlerInFolge: 0, leerInFolge: 0 }
  let pausen = 0
  let abrufe = 0
  for (const id of schlange) {
    if (Date.now() >= lauf.ende) {
      log(`Zeitbudget von ${lauf.minuten} Minuten erreicht — der Rest kommt im nächsten Lauf.`)
      break
    }
    const abruf = await lauf.hole(id)
    if (abruf.art === 'ok') nimmAuf(id, abruf.html, bestand, lauf, z, s)
    else if (abruf.art === 'weg') {
      lauf.weg[id] = { code: abruf.code, am: new Date().toISOString() }
      z.weg++
      s.fehlerInFolge = 0
    } else s.fehlerInFolge++
    const folge = nachFehlern(s.fehlerInFolge, MAX_FEHLER_IN_FOLGE, pausen, lauf.ende - Date.now())
    if (folge.art === 'ende') {
      warn(`${MAX_FEHLER_IN_FOLGE} Fehlschläge in Folge — aniSearch macht dicht. Der Rest kommt im nächsten Lauf.`)
      break
    }
    if (folge.art === 'pause') {
      lauf.sichern()
      warn(`${MAX_FEHLER_IN_FOLGE} Fehlschläge in Folge — Pause ${folge.minuten} Minuten, danach eine einzelne Anfrage.`)
      await lauf.warte(folge.minuten * 60_000)
      pausen++
      s.fehlerInFolge = MAX_FEHLER_IN_FOLGE - 1
    }
    if (++abrufe % SICHERN_ALLE === 0) lauf.sichern()
    if (abrufe % 100 === 0) log(`  ${abrufe}/${schlange.length}`)
    await lauf.warte(lauf.taktMs)
  }
  lauf.sichern()
  return z
}
