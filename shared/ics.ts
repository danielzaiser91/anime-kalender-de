import type { ReleaseEvent } from './types.ts'
import { PLATFORMS, RELEASE_TYPES } from './types.ts'
import { addDays, berlinToUtc, toIcsStamp } from './time.ts'

const PRODID = '-//anime-kalender-de//Anime-Kalender DE//DE'

function esc(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Faltet Zeilen auf 75 Oktetts, wie es RFC 5545 verlangt. */
function fold(line: string): string {
  if (line.length <= 75) return line
  const chunks: string[] = [line.slice(0, 75)]
  let rest = line.slice(75)
  while (rest.length > 74) {
    chunks.push(' ' + rest.slice(0, 74))
    rest = rest.slice(74)
  }
  if (rest) chunks.push(' ' + rest)
  return chunks.join('\r\n')
}

export interface IcsOptions {
  /** Basis-URL der Seite, für Links im Termin. */
  siteUrl?: string
  calendarName?: string
}

export function eventSummary(ev: ReleaseEvent): string {
  const type = RELEASE_TYPES[ev.releaseType]
  if (ev.releaseType === 'weekly' && ev.episode) {
    return `${ev.name} – Folge ${ev.episode}${ev.episodeCount ? `/${ev.episodeCount}` : ''}`
  }
  if (ev.releaseType === 'disc') return `${ev.name} (${type.short})`
  return ev.name
}

export function eventDescription(ev: ReleaseEvent, opts: IcsOptions = {}): string {
  const lines = [
    `Plattform: ${PLATFORMS[ev.platform].name}`,
    `Release-Art: ${RELEASE_TYPES[ev.releaseType].name}`,
  ]
  if (!ev.time) lines.push('Uhrzeit noch nicht bestätigt.')
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
  lines.push(`CATEGORIES:${esc(PLATFORMS[ev.platform].name)}`)
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
  params.set('location', PLATFORMS[ev.platform].name)
  params.set('ctz', 'Europe/Berlin')
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
