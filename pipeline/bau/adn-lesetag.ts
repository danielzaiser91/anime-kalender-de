/**
 * **Der Tag, an dem wir ADN gelesen haben** — nicht der Tag, an dem die Quelle zum ersten Mal auftauchte (`gesehenAm`).
 * Ein ADN-Beleg zeigt Folgen und Datum des heutigen Termins; „Unsere Messung vom …“ muss den Abruf nennen, aus dem sie stammen
 * (Prüfer 1598 A1: 106 von 116 Kalender-Quellen trugen den Erstsichtungstag 01.10.2026).
 */
import type { Quelle, Release } from '../../shared/types.ts'
import { toIsoDate } from '../../shared/time.ts'
import type { AdnData } from '../lib/adn.ts'
import { readJson } from '../lib/util.ts'
import { ADN_CALENDAR_URL, adnKatalogShow } from './grundlagen.ts'

export type Lesetag = (release: Release, url: string) => string | undefined

/** Die ADN-Serienkennung aus der Folgen-Adresse des Termins („…/de/video/1318-name/29565-folge-1“ → 1318). */
function showVon(release: Release): number | undefined {
  const m = /animationdigitalnetwork\.com\/de\/video\/(\d+)-/.exec(release.platformUrl ?? '')
  return m ? Number(m[1]) : undefined
}

/** Berliner Tag eines Abrufzeitpunkts; ein leerer oder unlesbarer Zeitpunkt ergibt keinen Tag. */
function tagVon(iso: string | undefined): string | undefined {
  return iso && !Number.isNaN(Date.parse(iso)) ? toIsoDate(new Date(iso)) : undefined
}

/**
 * Kalender: der Abruf von `adn.json`, nur für Serien, die darin stehen. Katalog: der jüngere von Serienabruf (`adn-katalog-stand.json`)
 * und Katalogdatei (`--refresh` holt alle Serien neu, ohne den Serienstand zu setzen). Sonst kein Tag — dann zeigt der Beleg keine Messung.
 */
export function adnLesetage(kalender: AdnData, katalog: AdnData, stand: Record<string, string>): Lesetag {
  const imKalender = new Set(kalender.shows.map((s) => s.showId))
  const imKatalog = new Set(katalog.shows.map((s) => s.showId))
  return (release, url) => {
    if (url === ADN_CALENDAR_URL) {
      const show = showVon(release)
      return show !== undefined && imKalender.has(show) ? tagVon(kalender.scrapedAt) : undefined
    }
    const show = adnKatalogShow(url)
    if (show === undefined || !imKatalog.has(show)) return undefined
    const tage = [tagVon(stand[String(show)]), tagVon(katalog.scrapedAt)].filter((t): t is string => Boolean(t))
    return tage.sort().at(-1)
  }
}

/** Liest die drei ADN-Dateien des Laufs. */
export function ladeAdnLesetage(): Lesetag {
  const leer: AdnData = { scrapedAt: '', window: { from: '', to: '' }, shows: [] }
  return adnLesetage(readJson('data/adn.json', leer), readJson('data/adn-catalog.json', leer), readJson('data/adn-katalog-stand.json', {}))
}

/** Hängt jeder Quelle mit Lesetag diesen an; die anderen bleiben, wie sie sind. */
export function mitLesetag(release: Release, quellen: Quelle[], lesetag: Lesetag): Quelle[] {
  return quellen.map((q) => {
    const am = lesetag(release, q.url)
    return am ? { ...q, gelesenAm: am } : q
  })
}
