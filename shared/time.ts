/**
 * Zeit-Helfer. Alle Termine im Datensatz sind Ortszeit Europe/Berlin.
 * Für ICS und Google Calendar brauchen wir daraus echtes UTC — inklusive
 * korrektem Sommerzeit-Sprung, deshalb wird der Offset pro Termin über
 * Intl bestimmt statt fest verdrahtet.
 */

export const TZ = 'Europe/Berlin'

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

/** Offset der Zone gegenüber UTC in Minuten, für den gegebenen Zeitpunkt. */
function zoneOffsetMinutes(utcDate: Date): number {
  const parts = partsFormatter.formatToParts(utcDate)
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value)
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second'),
  )
  return (asUtc - utcDate.getTime()) / 60000
}

/** "2026-08-13" + "17:30" (Berliner Ortszeit) → echter UTC-Zeitpunkt. */
export function berlinToUtc(date: string, time = '00:00'): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const naive = Date.UTC(y, m - 1, d, hh, mm)
  // Zwei Durchläufe, damit der Offset auch direkt an der Umstellung stimmt.
  let guess = new Date(naive - zoneOffsetMinutes(new Date(naive)) * 60000)
  guess = new Date(naive - zoneOffsetMinutes(guess) * 60000)
  return guess
}

/** ISO-Datum "YYYY-MM-DD" eines Date-Objekts in Berliner Ortszeit. */
export function toIsoDate(d: Date): string {
  const parts = partsFormatter.formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** Heutiges Datum in Berliner Ortszeit als "YYYY-MM-DD". */
export function todayIso(): string {
  return toIsoDate(new Date())
}

/**
 * Aktuelle Uhrzeit in Berliner Ortszeit als "HH:MM".
 *
 * Bewusst im selben Format wie `schedule.time`, damit sich beides mit einem
 * schlichten Zeichenketten-Vergleich ordnen lässt — `"18:30" >= "17:45"` stimmt,
 * solange beide Seiten zweistellig sind.
 */
export function nowHhMm(): string {
  const parts = partsFormatter.formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)!.value
  return `${get('hour') === '24' ? '00' : get('hour')}:${get('minute')}`
}

/** Rechnet mit reinen Datumsstrings, ohne Zeitzonen-Drift. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = Date.UTC(y, m - 1, d) + days * 86400000
  const dt = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`
}

export function diffDays(a: string, b: string): number {
  const p = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((p(b) - p(a)) / 86400000)
}

/** 0 = Montag … 6 = Sonntag. */
export function weekdayIndex(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
}

/** Montag der Woche, in der `iso` liegt. */
export function startOfWeek(iso: string): string {
  return addDays(iso, -weekdayIndex(iso))
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const total = y * 12 + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${ny}-${p(nm)}-${p(Math.min(d, lastDay))}`
}

const NAMES = {
  de: {
    long: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'],
    short: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
    months: [
      'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
    ],
  },
  en: {
    long: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    short: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    months: [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ],
  },
} as const

/**
 * Sprache der Datumsnamen. Pipeline und Worker bleiben bei Deutsch; die
 * Web-App setzt sie beim Sprachwechsel um, damit nicht in jede Komponente
 * ein Locale-Parameter durchgereicht werden muss.
 */
let locale: 'de' | 'en' = 'de'

export function setDateLocale(next: 'de' | 'en'): void {
  locale = next
}

export function weekdayName(iso: string, short = false): string {
  const i = weekdayIndex(iso)
  return short ? NAMES[locale].short[i] : NAMES[locale].long[i]
}

export function monthName(monthIndex0: number): string {
  return NAMES[locale].months[monthIndex0]
}

/** "2026-08-13" → "13.08.2026" */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

/** "2026-08-13" → "13. August 2026" bzw. "13 August 2026" */
export function formatDateLong(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return locale === 'de' ? `${d}. ${monthName(m - 1)} ${y}` : `${d} ${monthName(m - 1)} ${y}`
}

/** Kompakter UTC-Stempel für ICS und Google Calendar: 20260813T153000Z */
export function toIcsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}
