import { istAuskunft, istTot, type LinkBefund } from './link-befund.ts'

/**
 * Netflix-Titelseiten antworten aus der CI mal 200, mal 404 (02.11.2026: 34 von 204 Adressen 200 -> 404,
 * 54 von 96 toten 404 -> 200; 14 Titel verloren so ihren Weg, obwohl alle seit 18.09. durchgehend 200 waren).
 * Ein einzelnes 404 ist deshalb Nichtauskunft. Erst ein zweites 404 im Abstand von mindestens `ABSTAND_TAGE`
 * gilt als Abgang.
 */
export const ABSTAND_TAGE = 2

const istNetflix = (url: string): boolean => {
  try {
    return /(^|\.)netflix\.com$/.test(new URL(url).hostname)
  } catch {
    return false
  }
}

const tage = (von: string, bis: string): number => Math.round((Date.parse(`${bis}T12:00:00Z`) - Date.parse(`${von}T12:00:00Z`)) / 86_400_000)

/** Das vermerkte erste 404, solange der Befund keine Auskunft ist (unklar, 5xx, timeout); an einem 200 oder bestätigten 404 zählt der Vermerk nicht. */
const offenes404 = (b: LinkBefund | undefined): string | undefined => (b && !istAuskunft(b.status) ? b.erstes404 : undefined)

/**
 * Was für ein frisch gemessenes Netflix-404 in den Bestand kommt: `unklar` mit `erstes404` (der Weg bleibt),
 * beim zweiten 404 nach mindestens `ABSTAND_TAGE` Tagen das 404 selbst. Ein schon bestätigtes 404 bleibt 404.
 * Alles andere (anderer Anbieter, anderer Status) kommt unverändert durch.
 */
export function netflixBefund<B extends LinkBefund>(url: string, alt: LinkBefund | undefined, neu: B): B {
  if (neu.status !== 404 || !istNetflix(url) || alt?.status === 404) return neu
  const erstes = offenes404(alt)
  const am = neu.geprueftAm ?? ''
  if (erstes && tage(erstes, am) >= ABSTAND_TAGE) return neu
  return { ...neu, status: 'unklar', erstes404: erstes ?? am }
}

/**
 * Ein Netflix-404 der Linkprüfung entfernt keinen Weg, der belegt deutschen Ton trägt. Die CI sieht je Adresse tagelang
 * dasselbe 404 (34 Adressen: 404 am 02., 03. und 04.11.2026, davor seit 18.09. durchgehend 200; 14 Titel mit `dub: true`
 * verloren so ihren Weg trotz der Zwei-Tage-Regel), ein zweites 404 belegt also nichts über Deutschland.
 */
export const netflix404EntferntNicht = (plattform: string, befund: unknown, warDeutsch: boolean): boolean => plattform === 'netflix' && befund === 404 && warDeutsch

/** Ein 404 liegt vor: bestätigt oder als erstes noch `unklar` (`erstes404`). Der Netflix-Riegel im Bau (09-2) fragt so, sonst wanderte ein Weg von der lebenden zur wackligen Form. */
export const hat404 = (b: LinkBefund | undefined): boolean => b?.status === 404 || offenes404(b) !== undefined

/**
 * Netflix-Adressen mit vermerktem ersten 404: sie kommen im Lauf zuerst dran. Nach ältestem `geprueftAm` stünde das zweite 404
 * bei `--limit 400` und mehreren Tausend älteren fälligen Einträgen bis zu 8 Wochen hinten.
 */
export function zweitesNetflix404(bestand: Record<string, LinkBefund>): string[] {
  return Object.keys(bestand).filter((u) => istNetflix(u) && offenes404(bestand[u]) !== undefined)
}

/** Eine Nichtauskunft (unklar, 5xx, timeout) auf ein vermerktes erstes 404 lässt dessen Frist weiterlaufen, statt sie neu zu beginnen. */
function behalteErstes404<B extends LinkBefund>(alt: LinkBefund | undefined, neu: B): B {
  const vermerk = offenes404(alt)
  if (vermerk === undefined || neu.erstes404 !== undefined || istAuskunft(neu.status)) return neu
  return { ...neu, erstes404: vermerk }
}

export type WechselPaar = { url: string; alt: unknown; neu: unknown }

/**
 * Trägt einen frisch gemessenen Befund in den Bestand ein. Eine Nichtauskunft (`unklar`) löscht keinen früheren Befund;
 * ein einzelnes Netflix-404 geht über `netflixBefund`. Der Vorher/Nachher-Status wandert für den Wächter in `paare`.
 */
export function nimmBefund<B extends LinkBefund>(bestand: Record<string, B>, url: string, neu: B, paare: WechselPaar[]): void {
  const alt = bestand[url]
  const behalten = neu.status === 'unklar' && alt?.status !== undefined && alt.status !== 'unklar'
  if (!behalten) bestand[url] = behalteErstes404(alt, netflixBefund(url, alt, neu))
  paare.push({ url, alt: alt?.status, neu: neu.status })
}

/** Lebt (HTTP unter 400) oder tot (404/Region) ist eine Auskunft über die Adresse; alles andere nicht. */
const klasse = (status: unknown): 'lebt' | 'tot' | undefined => {
  if (istTot(status)) return 'tot'
  return typeof status === 'number' && status < 400 ? 'lebt' : undefined
}

/** Anteil über dem eine Plattform in einem Lauf als verrauscht gilt (Messung 02.11.2026 Netflix: 29 %). */
export const WECHSEL_GRENZE_PROZENT = 10
/** Darunter sagt ein Anteil nichts. */
export const WECHSEL_MINDESTMENGE = 20

export interface Wechsel {
  host: string
  geprueft: number
  wechsel: number
}

/** Je Plattform (Host) zählen, wie viele Adressen mit Vorbefund in diesem Lauf von lebt auf tot oder zurück wechselten. */
export function zaehleWechsel(paare: WechselPaar[]): Wechsel[] {
  const jeHost = new Map<string, Wechsel>()
  for (const p of paare) {
    const vorher = klasse(p.alt)
    const nachher = klasse(p.neu)
    if (!vorher || !nachher) continue
    let host: string
    try {
      host = new URL(p.url).hostname.replace(/^www[.]/, '')
    } catch {
      continue
    }
    const z = jeHost.get(host) ?? { host, geprueft: 0, wechsel: 0 }
    z.geprueft++
    if (vorher !== nachher) z.wechsel++
    jeHost.set(host, z)
  }
  return [...jeHost.values()]
}

/** Warnzeilen für Plattformen, deren Wechselanteil über der Grenze liegt (genau auf der Grenze: keine Warnung). */
export function wechselWarnungen(werte: Wechsel[]): string[] {
  return werte
    .filter((w) => w.geprueft >= WECHSEL_MINDESTMENGE && w.wechsel * 100 > w.geprueft * WECHSEL_GRENZE_PROZENT)
    .map(
      (w) =>
        `⚠ WARNUNG Linkprüfung verrauscht: ${w.host} ${w.wechsel} von ${w.geprueft} Adressen mit Vorbefund wechselten lebt/tot (über ${WECHSEL_GRENZE_PROZENT} %) — einzelne 404 nicht trauen.`,
    )
}
