import { sprecherAus } from './anisearch-sprecher.ts'
import { PARSER_STAND, type Eintrag } from './anisearch-sprecher-reihe.ts'
import { log, warn } from './util.ts'

const MAX_FEHLER_IN_FOLGE = 5

/** `fehler` trägt den HTTP-Status, wenn es einen gab. */
export type Abruf = { art: 'ok'; html: string } | { art: 'fehler'; status?: number }

export interface Lauf {
  /** Holt eine Sprecherseite. */
  hole: (id: number) => Promise<Abruf>
  warte: (ms: number) => Promise<void>
  taktMs: number
  /** Spätester Zeitpunkt (ms), zu dem ein weiterer Abruf beginnt. */
  ende: number
  minuten: number
}

/** Holt die Seiten der Reihe nach; `bestand` wächst um die geholten. Gibt die Zahl der geholten Seiten zurück. */
export async function arbeiteAb(schlange: number[], bestand: Record<string, Eintrag>, lauf: Lauf): Promise<number> {
  let geholt = 0
  let fehlerInFolge = 0
  for (const id of schlange) {
    if (Date.now() > lauf.ende) {
      log(`Zeitbudget von ${lauf.minuten} Minuten erreicht — der Rest kommt im nächsten Lauf.`)
      break
    }
    const abruf = await lauf.hole(id)
    if (abruf.art === 'fehler') {
      if (abruf.status === 403 || abruf.status === 423 || abruf.status === 429) {
        warn('Abbruch: aniSearch weist ab. Der Rest kommt im nächsten Lauf.')
        break
      }
      if (++fehlerInFolge >= MAX_FEHLER_IN_FOLGE) {
        warn(`Abbruch: ${MAX_FEHLER_IN_FOLGE} Fehlschläge in Folge.`)
        break
      }
    } else {
      fehlerInFolge = 0
      bestand[String(id)] = { ...sprecherAus(abruf.html), fetchedAt: new Date().toISOString(), stand: PARSER_STAND }
      geholt++
      if (geholt % 100 === 0) log(`  ${geholt}/${schlange.length}`)
    }
    await lauf.warte(lauf.taktMs)
  }
  return geholt
}
