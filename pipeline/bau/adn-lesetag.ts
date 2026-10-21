/**
 * **Der Tag, an dem wir ADN gelesen haben** — nicht der Tag, an dem die Quelle zum ersten Mal auftauchte (`gesehenAm`).
 * Ein ADN-Beleg zeigt Folgen und Datum des heutigen Termins; „Unsere Messung vom …“ muss den Abruf nennen, aus dem sie stammen
 * (Prüfer 1598 A1: 106 von 116 Kalender-Quellen trugen den Erstsichtungstag 01.10.2026).
 */
import type { Quelle, Release } from '../../shared/types.ts'
import { toIsoDate } from '../../shared/time.ts'
import type { AdnData, AdnShow } from '../lib/adn.ts'
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
 * Stammt das Datum des Termins aus diesem Abruf? Nur dann darf der Beleg es als Messung zeigen: ein kuratierter Termin mit
 * Kalender-Adresse kann sein Datum aus einem Artikel haben (Prüfer 1598 R3). Die Uhrzeit zählt mit, wenn der Beleg sie zeigt.
 */
function datumImAbruf(show: AdnShow | undefined, release: Release): boolean {
  const s = release.schedule
  const zeit = s?.time && !s.estimated ? s.time : undefined
  return Boolean(show?.episodes.some((e) => e.date === s?.firstEpisodeDate && (!zeit || e.time === zeit)))
}

/**
 * Kalender: der Abruf von `adn.json`, nur für Serien, die darin stehen. Katalog: der jüngere von Serienabruf (`adn-katalog-stand.json`)
 * und Katalogdatei (`--refresh` holt alle Serien neu, ohne den Serienstand zu setzen). Beide nur, wenn das Datum des Termins im Abruf
 * steht (`datumImAbruf`). Sonst kein Tag — dann zeigt der Beleg keine Messung.
 */
export function adnLesetage(kalender: AdnData, katalog: AdnData, stand: Record<string, string>): Lesetag {
  const imKalender = new Map(kalender.shows.map((s) => [s.showId, s]))
  const imKatalog = new Map(katalog.shows.map((s) => [s.showId, s]))
  return (release, url) => {
    if (url === ADN_CALENDAR_URL) {
      const show = showVon(release)
      return show !== undefined && datumImAbruf(imKalender.get(show), release) ? tagVon(kalender.scrapedAt) : undefined
    }
    const show = adnKatalogShow(url)
    if (show === undefined || !datumImAbruf(imKatalog.get(show), release)) return undefined
    const tage = [tagVon(stand[String(show)]), tagVon(katalog.scrapedAt)].filter((t): t is string => Boolean(t))
    return tage.sort().at(-1)
  }
}

/** Liest die drei ADN-Dateien des Laufs. */
export function ladeAdnLesetage(): Lesetag {
  const leer: AdnData = { scrapedAt: '', window: { from: '', to: '' }, shows: [] }
  return adnLesetage(readJson('data/adn.json', leer), readJson('data/adn-catalog.json', leer), readJson('data/adn-katalog-stand.json', {}))
}

/** Hängt jeder Quelle mit Lesetag diesen an, dazu das Datum, das der Abruf bestätigt hat; die anderen bleiben, wie sie sind. */
export function mitLesetag(release: Release, quellen: Quelle[], lesetag: Lesetag): Quelle[] {
  return quellen.map((q) => {
    const am = lesetag(release, q.url)
    return am ? { ...q, gelesenAm: am, bestaetigt: release.schedule.firstEpisodeDate } : q
  })
}

/**
 * Bestätigt der heutige Abruf das Datum nicht mehr (der Kalender reicht 45 Tage zurück, `fetch-adn.ts`; ein Abruf kann scheitern),
 * bleibt der Lesetag des letzten Abrufs, der es bestätigt hat: Der Beleg nennt diesen Tag, seine Aussage bleibt wahr. Nur, wenn jener
 * Abruf dasselbe Datum bestätigte (`bestaetigt`) — sonst verlöre eine ältere Meldung ihren Beleg (Prüfer 1598 R4).
 */
export function behalteLesetag(neu: Quelle[], historie: Quelle[], termin: string | undefined): Quelle[] {
  return neu.map((q) => {
    if (q.gelesenAm) return q
    const alt = historie.find((h) => h.url === q.url)
    return termin && alt?.gelesenAm && alt.bestaetigt === termin ? { ...q, gelesenAm: alt.gelesenAm, bestaetigt: termin } : q
  })
}

/**
 * Die Kalender-Adresse in der Historie einer Katalog-Serie war eine Fehlzuordnung, kein überholter Beleg: vor Prüfer 1598 trug
 * jede Katalog-Serie die Kalender-Adresse, obwohl der Kalender sie nie lieferte (107 Termine, 19.10.2026). Hat der Kalenderabruf sie
 * je bestätigt, steht dort ein `gelesenAm`; ohne ist die Adresse nie gelesen worden und zählt nicht als Termin-Quelle weiter.
 */
export function ohneFehlzuordnung(historie: Quelle[], neu: Quelle[]): Quelle[] {
  const katalogSerie = neu.some((q) => adnKatalogShow(q.url) !== undefined)
  return katalogSerie ? historie.filter((q) => q.url !== ADN_CALENDAR_URL || q.gelesenAm) : historie
}
