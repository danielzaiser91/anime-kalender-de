import type { ReleaseEvent } from './types.ts'
import { RELEASE_TYPES, anbieterName } from './types.ts'
import { addDays, berlinToUtc, toIcsStamp } from './time.ts'
import { istAusgeblieben } from './logic.ts'
import { premiereHinweis } from './premiere.ts'
import { fasseFolgenZusammen } from './ics-folgen.ts'
import { zeitGeschaetzt } from './zeit-text.ts'

const PRODID = '-//anime-kalender-de//Anime-Kalender DE//DE'

function esc(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/**
 * **RFC 5545 zählt Oktette, nicht Zeichen** (17.09.2026). Die alte Fassung faltete
 * nach 75 Zeichen; „Wöchentlich" oder ein Gedankenstrich machen daraus 76 und 77
 * Oktette — 357 von 2.637 Zeilen in `all.ics` lagen über der Grenze. Gefaltet
 * wird deshalb nach UTF-8-Länge und nur zwischen zwei Zeichen, nie mitten in
 * einem. Eine Fortsetzungszeile beginnt mit einem Leerzeichen, das mitzählt.
 */
const utf8 = new TextEncoder()
export function fold(line: string): string {
  if (utf8.encode(line).length <= 75) return line
  const teile: string[] = []
  let akt = ''
  let oktette = 0
  let grenze = 75
  for (const zeichen of line) {
    const n = utf8.encode(zeichen).length
    if (oktette + n > grenze) {
      teile.push(akt)
      akt = ''
      oktette = 0
      grenze = 74
    }
    akt += zeichen
    oktette += n
  }
  teile.push(akt)
  return teile.map((t, i) => (i ? ' ' + t : t)).join('\r\n')
}

export interface IcsOptions {
  /** Basis-URL der Seite, für Links im Termin. */
  siteUrl?: string
  calendarName?: string
  /** Übersetzt die Titelkennung des Termins in die der Seite (`ak`), wo die Pipeline noch mit AniList-Kennungen arbeitet. */
  titelId?: (id: number) => number
  /**
   * **Erinnerung vor dem Termin** (18.09.2026, Feature-Vergleich: Simkl, LiveChart).
   * Nur für Dateien, die jemand ausdrücklich für einen Titel herunterlädt — in den
   * abonnierten Sammelfeeds wären es hunderte Wecker am Tag.
   */
  erinnerung?: boolean
}

/** Kennzeichnung eines Termins ohne belegte Synchro (10.10.2026, wie `Marken.tsx`); gilt für ICS und Newsletter. */
export const SPRACHE_MARKE = { omu: 'OmU', offen: 'Synchro offen' } as const
export const SPRACHE_HINWEIS = {
  omu: 'OmU: Originalton mit deutschen Untertiteln, keine deutsche Synchro.',
  offen: 'Synchro offen: Der Termin ist belegt, eine deutsche Synchro nicht.',
} as const

/** Ein Katalogdatum sagt, seit wann der Anbieter den Titel führt, nicht wann die deutsche Fassung erschien. */
export const IM_ANGEBOT_HINWEIS = 'Im Angebot seit diesem Tag – nicht der Erscheinungstag der deutschen Fassung.'

/** Der erste Tag der deutschen Fassung (aniSearch), anders als ein Katalogdatum. */
export const ERSTAUSGABE_HINWEIS = 'Erster Tag der deutschen Fassung, laut aniSearch.'

/** `bis`: die letzte Folge, wenn der Eintrag mehrere Folgen desselben Tages trägt („Folge 13–14/14“). */
export function eventSummary(ev: ReleaseEvent, bis?: number): string {
  const text = summaryOhneMarke(ev, bis)
  return ev.sprache ? `${text} (${SPRACHE_MARKE[ev.sprache]})` : text
}

function summaryOhneMarke(ev: ReleaseEvent, bis?: number): string {
  const type = RELEASE_TYPES[ev.releaseType]
  /*
    Wer den Kalender abonniert hat, sieht den verstrichenen Termin sonst als
    gewöhnliche Folge — dieselbe Lücke, die am 13.09.2026 im Detail-Panel
    auffiel. Der Eintrag bleibt stehen (seine UID ändert sich nicht), er sagt
    nur, was aus ihm geworden ist.
  */
  if (ev.releaseType === 'weekly' && ev.episode && !ev.sichtung) {
    const vorn = istAusgeblieben(ev) ? '⚠ nicht erschienen: ' : ''
    return `${vorn}${ev.name} – Folge ${ev.episode}${bis ? `–${bis}` : ''}${ev.episodeCount ? `/${ev.episodeCountAssumed ? '≈' : ''}${ev.episodeCount}` : ''}`
  }
  if (ev.releaseType === 'disc') return `${ev.name} (${type.short})`
  if (ev.imAngebot) return `${ev.name} (neu bei ${anbieterName(ev.platform, ev.sender)})`
  if (ev.erstausgabe) return `${ev.name} (Erstveröffentlichung bei ${anbieterName(ev.platform, ev.sender)})`
  return ev.name
}

export function eventDescription(ev: ReleaseEvent, opts: IcsOptions = {}): string {
  const lines = [
    `Plattform: ${anbieterName(ev.platform, ev.sender)}`,
    // „Simuldub“ im Namen der Art behauptet eine Synchro; bei gesetzter Sprache (omu/offen) gilt die Kurzform.
    `Release-Art: ${ev.sprache ? RELEASE_TYPES[ev.releaseType].short : RELEASE_TYPES[ev.releaseType].name}`,
  ]
  if (ev.imAngebot) lines.push(IM_ANGEBOT_HINWEIS)
  if (ev.erstausgabe) lines.push(ERSTAUSGABE_HINWEIS)
  if (ev.sprache) lines.push(SPRACHE_HINWEIS[ev.sprache])
  if (ev.premiere || ev.tvPremiere) lines.push(premiereHinweis(ev.platform, ev.premiereVorher))
  if (!ev.time) lines.push('Uhrzeit noch nicht bestätigt.')
  if (ev.time && zeitGeschaetzt(ev)) lines.push(ev.timeEstimated && ev.platform === 'netflix' ? 'Uhrzeit voraussichtlich: Netflix veröffentlicht Anime meist um 17:00 japanischer Zeit.' : 'Uhrzeit voraussichtlich, nicht gemessen.')
  if (ev.estimated)
    lines.push('Geschätzter Termin: kein vom Anbieter genannter Tag, sondern aus Rhythmus oder Originalterminen abgeleitet.')
  if (opts.siteUrl) lines.push(`Details: ${opts.siteUrl.replace(/\/$/, '')}/t/${opts.titelId?.(ev.titleId) ?? ev.titleId}/`)
  return lines.join('\n')
}

function veventBody(ev: ReleaseEvent, opts: IcsOptions, bis?: number): string[] {
  const lines: string[] = ['BEGIN:VEVENT', `UID:${ev.id}@anime-kalender-de`]
  lines.push(`DTSTAMP:${toIcsStamp(new Date(Date.UTC(2020, 0, 1)))}`)

  if (ev.time) {
    const start = berlinToUtc(ev.date, ev.time)
    const end = new Date(start.getTime() + 30 * 60000)
    lines.push(`DTSTART:${toIcsStamp(start)}`, `DTEND:${toIcsStamp(end)}`)
  } else {
    const compact = (d: string) => d.replace(/-/g, '')
    lines.push(`DTSTART;VALUE=DATE:${compact(ev.date)}`, `DTEND;VALUE=DATE:${compact(addDays(ev.date, 1))}`)
  }

  lines.push(`SUMMARY:${esc(eventSummary(ev, bis))}`)
  lines.push(`DESCRIPTION:${esc(eventDescription(ev, opts))}`)
  lines.push(`CATEGORIES:${esc(anbieterName(ev.platform, ev.sender))}`)
  if (opts.erinnerung) {
    /* Mit belegter Uhrzeit 15 Minuten vorher, ohne Uhrzeit um 9 Uhr am Tag selbst. */
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(eventSummary(ev, bis))}`,
      `TRIGGER:${ev.time ? '-PT15M' : 'PT9H'}`,
      'END:VALARM',
    )
  }
  lines.push('END:VEVENT')
  return lines
}

/** Kopf der Kalenderdatei bis vor den ersten Termin (jede Zeile mit CRLF). */
export function icsKopf(calendarName = 'Anime-Kalender DE'): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(calendarName)}`,
    'X-WR-TIMEZONE:Europe/Berlin',
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
    'X-PUBLISHED-TTL:PT12H',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}

export const ICS_FUSS = 'END:VCALENDAR\r\n'

export function buildIcs(events: ReleaseEvent[], opts: IcsOptions = {}): string {
  const lines: string[] = []
  for (const { ev, bis } of fasseFolgenZusammen(events)) lines.push(...veventBody(ev, opts, bis))
  return icsKopf(opts.calendarName) + lines.map((l) => fold(l) + '\r\n').join('') + ICS_FUSS
}

/**
 * **Wie viele der nächsten Termine eine Wochenserie bilden** (Daniel, 04.10.2026): sieben Tage Abstand und dieselbe Uhrzeit.
 * Google kennt nur eine feste Uhrzeit je Serie; wechselt sie (Winterzeit bei Tokyo Revengers), endet die Serie dort,
 * der Rest steht in der Kalenderdatei.
 */
export function wochenserie(termine: ReleaseEvent[]): { anzahl: number; rest: number } {
  const erster = termine[0]
  if (!erster || erster.releaseType !== 'weekly') return { anzahl: 1, rest: 0 }
  let n = 1
  while (n < termine.length && termine[n]!.date === addDays(erster.date, 7 * n) && termine[n]!.time === erster.time) n++
  return { anzahl: n, rest: termine.length - n }
}

/**
 * Ein-Klick-Link „zu Google Calendar hinzufügen" — braucht weder API noch Login-Flow.
 * Mit `serie` (mehr als ein Termin) wird ein wöchentlich wiederholter Eintrag daraus (`recur`), ohne Folgennummer im Titel.
 */
export function googleCalendarUrl(ev: ReleaseEvent, opts: IcsOptions = {}, serie?: { anzahl: number; rest: number }): string {
  const wiederholt = Boolean(serie && serie.anzahl > 1)
  const params = new URLSearchParams({ action: 'TEMPLATE', text: wiederholt ? `${ev.name} – neue Folge` : eventSummary(ev) })
  if (serie && wiederholt) params.set('recur', `RRULE:FREQ=WEEKLY;COUNT=${serie.anzahl}`)

  if (ev.time) {
    const start = berlinToUtc(ev.date, ev.time)
    const end = new Date(start.getTime() + 30 * 60000)
    params.set('dates', `${toIcsStamp(start)}/${toIcsStamp(end)}`)
  } else {
    const compact = (d: string) => d.replace(/-/g, '')
    params.set('dates', `${compact(ev.date)}/${compact(addDays(ev.date, 1))}`)
  }

  const zusatz = serie && wiederholt ? [`Wöchentlich, ${serie.anzahl} Termine ab Folge ${ev.episode ?? '?'}.`, ...(serie.rest ? [`Die ${serie.rest} Folgen danach kommen zu einer anderen Uhrzeit; alle Termine stehen in der Kalenderdatei (.ics).`] : [])] : []
  params.set('details', [eventDescription(ev, opts), ...zusatz].join('\n'))
  params.set('location', anbieterName(ev.platform, ev.sender))
  params.set('ctz', 'Europe/Berlin')
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
