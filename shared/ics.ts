import type { ReleaseEvent } from './types.ts'
import { RELEASE_TYPES, anbieterName } from './types.ts'
import { addDays, berlinToUtc, toIcsStamp } from './time.ts'
import { istAusgeblieben } from './logic.ts'

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
  /**
   * **Erinnerung vor dem Termin** (18.09.2026, Feature-Vergleich: Simkl, LiveChart).
   * Nur für Dateien, die jemand ausdrücklich für einen Titel herunterlädt — in den
   * abonnierten Sammelfeeds wären es hunderte Wecker am Tag.
   */
  erinnerung?: boolean
}

export function eventSummary(ev: ReleaseEvent): string {
  const type = RELEASE_TYPES[ev.releaseType]
  /*
    Wer den Kalender abonniert hat, sieht den verstrichenen Termin sonst als
    gewöhnliche Folge — dieselbe Lücke, die am 13.09.2026 im Detail-Panel
    auffiel. Der Eintrag bleibt stehen (seine UID ändert sich nicht), er sagt
    nur, was aus ihm geworden ist.
  */
  if (ev.releaseType === 'weekly' && ev.episode && !ev.sichtung) {
    const vorn = istAusgeblieben(ev) ? '⚠ nicht erschienen: ' : ''
    return `${vorn}${ev.name} – Folge ${ev.episode}${ev.episodeCount ? `/${ev.episodeCount}` : ''}`
  }
  if (ev.releaseType === 'disc') return `${ev.name} (${type.short})`
  return ev.name
}

export function eventDescription(ev: ReleaseEvent, opts: IcsOptions = {}): string {
  const lines = [
    `Plattform: ${anbieterName(ev.platform, ev.sender)}`,
    `Release-Art: ${RELEASE_TYPES[ev.releaseType].name}`,
  ]
  if (!ev.time) lines.push('Uhrzeit noch nicht bestätigt.')
  if (ev.timeEstimated) lines.push('Uhrzeit voraussichtlich: Netflix veröffentlicht Anime meist um 17:00 japanischer Zeit.')
  if (ev.estimated)
    lines.push('Geschätzter Termin, aus dem bisherigen Wochenrhythmus fortgeschrieben.')
  if (opts.siteUrl) lines.push(`Details: ${opts.siteUrl}#/release/${ev.releaseSlug}`)
  return lines.join('\n')
}

function veventBody(ev: ReleaseEvent, opts: IcsOptions): string[] {
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

  lines.push(`SUMMARY:${esc(eventSummary(ev))}`)
  lines.push(`DESCRIPTION:${esc(eventDescription(ev, opts))}`)
  lines.push(`CATEGORIES:${esc(anbieterName(ev.platform, ev.sender))}`)
  if (opts.erinnerung) {
    /* Mit belegter Uhrzeit 15 Minuten vorher, ohne Uhrzeit um 9 Uhr am Tag selbst. */
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(eventSummary(ev))}`,
      `TRIGGER:${ev.time ? '-PT15M' : 'PT9H'}`,
      'END:VALARM',
    )
  }
  lines.push('END:VEVENT')
  return lines
}

export function buildIcs(events: ReleaseEvent[], opts: IcsOptions = {}): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(opts.calendarName ?? 'Anime-Kalender DE')}`,
    'X-WR-TIMEZONE:Europe/Berlin',
  ]
  for (const ev of events) lines.push(...veventBody(ev, opts))
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

/** Ein-Klick-Link „zu Google Calendar hinzufügen" — braucht weder API noch Login-Flow. */
export function googleCalendarUrl(ev: ReleaseEvent, opts: IcsOptions = {}): string {
  const params = new URLSearchParams({ action: 'TEMPLATE', text: eventSummary(ev) })

  if (ev.time) {
    const start = berlinToUtc(ev.date, ev.time)
    const end = new Date(start.getTime() + 30 * 60000)
    params.set('dates', `${toIcsStamp(start)}/${toIcsStamp(end)}`)
  } else {
    const compact = (d: string) => d.replace(/-/g, '')
    params.set('dates', `${compact(ev.date)}/${compact(addDays(ev.date, 1))}`)
  }

  params.set('details', eventDescription(ev, opts))
  params.set('location', anbieterName(ev.platform, ev.sender))
  params.set('ctz', 'Europe/Berlin')
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
