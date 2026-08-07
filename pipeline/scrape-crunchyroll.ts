/**
 * Liest den öffentlichen Simulcast-Kalender von Crunchyroll aus.
 *
 * Warum ein echter Browser: Die Seite liefert per HTTP nur ein leeres Gerüst,
 * die Termine baut JavaScript nach. Ein normales `fetch` bekommt deshalb
 * nichts zu sehen — geprüft, das Ergebnis ist eine Mustache-Vorlage.
 *
 * Was die Seite hergibt, ohne Login und ohne Premium:
 *   - exakte Uhrzeit je Folge
 *   - Episodennummer
 *   - die Kennzeichnung "(DEUTSCH)" hinter Titeln mit deutscher Synchro
 *
 * Genau das ist die Information, die sonst nirgends maschinenlesbar existiert.
 *
 * Aufruf: npx tsx pipeline/scrape-crunchyroll.ts [--weeks 6] [--head]
 */
import { chromium, type Browser } from 'playwright'
import { addDays, diffDays, startOfWeek, todayIso } from '../shared/time.ts'
import { log, readJson, sleep, warn, writeJson } from './lib/util.ts'
import {
  crunchyrollSeriesId,
  normalizeTitle,
  type CrunchyrollData,
  type CrunchyrollSlot,
} from './lib/crunchyroll.ts'

const args = process.argv.slice(2)
const WEEKS = Number(args[args.indexOf('--weeks') + 1]) || 6
const HEADED = args.includes('--head')

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'

const berlinFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * Crunchyroll liefert ein vollständiges `datetime`-Attribut mit Zeitzone.
 * Das rechnen wir selbst nach Berlin um, statt auf die Zone zu vertrauen,
 * die der Browserkontext gerade vorgibt.
 */
function toBerlin(datetime: string): { date: string; time: string } | undefined {
  const dt = new Date(datetime)
  if (Number.isNaN(dt.getTime())) return undefined
  const parts = berlinFormatter.formatToParts(dt)
  const get = (t: string) => parts.find((p) => p.type === t)!.value
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour') === '24' ? '00' : get('hour')}:${get('minute')}`,
  }
}

async function scrapeWeek(browser: Browser, weekStart: string): Promise<CrunchyrollSlot[]> {
  const page = await browser.newPage({
    userAgent: UA,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    viewport: { width: 1400, height: 900 },
  })

  try {
    // `filter=premium` ist kein Login-Zwang, sondern nur die Ansichts-Umschaltung
    // der Seite: ohne den Parameter blendet Crunchyroll die Kacheln aus und
    // wirbt stattdessen fürs Abo. Mit ihm liefert dieselbe öffentliche Seite
    // alle Termine samt Uhrzeit.
    await page.goto(`https://www.crunchyroll.com/de/simulcastcalendar?filter=premium&date=${weekStart}`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    })
    // Auf die erste gerenderte Kachel warten; bleibt die Woche leer, ist das
    // kein Fehler, sondern eine Woche ohne veröffentlichten Zeitplan.
    await page
      .waitForSelector('article.release, .release', { timeout: 15000 })
      .catch(() => undefined)

    const rows = await page.evaluate(() =>
      [...document.querySelectorAll('article.release')].map((release) => ({
        datetime: release.querySelector('time.available-time')?.getAttribute('datetime') ?? '',
        rawTitle: release.querySelector('cite[itemprop="name"], .season-name')?.textContent?.trim() ?? '',
        episode: release.getAttribute('data-episode-num') ?? '',
        seriesUrl:
          release.querySelector<HTMLAnchorElement>('.js-season-name-link')?.getAttribute('href') ?? '',
      })),
    )

    return rows
      .map((row): CrunchyrollSlot | undefined => {
        const when = toBerlin(row.datetime)
        if (!when || !row.rawTitle) return undefined
        return {
          key: normalizeTitle(row.rawTitle),
          rawTitle: row.rawTitle,
          seriesId: crunchyrollSeriesId(row.seriesUrl),
          seriesUrl: row.seriesUrl || undefined,
          date: when.date,
          time: when.time,
          episode: row.episode ? Number(row.episode) : undefined,
          german: /\(deutsch\)/i.test(row.rawTitle),
        }
      })
      .filter((r): r is CrunchyrollSlot => r !== undefined)
  } finally {
    await page.close()
  }
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: !HEADED })
  const today = todayIso()
  const slots: CrunchyrollSlot[] = []

  try {
    // Rückblick statt Vorschau: künftige Wochen stehen oft noch auf
    // „Zeitplan kommt bald", vergangene tragen die tatsächliche Uhrzeit.
    for (let i = WEEKS - 2; i >= -1; i--) {
      const weekStart = startOfWeek(addDays(today, -7 * i))
      const found = await scrapeWeek(browser, weekStart)
      log(`Crunchyroll ${weekStart}: ${found.length} Einträge, davon ${found.filter((f) => f.german).length} deutsch`)
      slots.push(...found)
      await sleep(1500)
    }
  } finally {
    await browser.close()
  }

  if (!slots.length) {
    warn('Keine Einträge gefunden — Seitenaufbau geändert? Bestehende Daten bleiben unangetastet.')
    return
  }

  // Pro Titel den zuletzt gesehenen Sendeplatz festhalten.
  const german: CrunchyrollData['german'] = {}
  for (const slot of slots.filter((s) => s.german)) {
    const [y, m, d] = slot.date.split('-').map(Number)
    const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
    const entry = (german[slot.key] ??= {
      time: slot.time,
      weekday,
      dates: [],
      rawTitle: slot.rawTitle,
      seriesId: slot.seriesId,
      seriesUrl: slot.seriesUrl,
    })
    entry.time = slot.time
    entry.weekday = weekday
    entry.seriesId ??= slot.seriesId
    entry.seriesUrl ??= slot.seriesUrl
    if (!entry.dates.includes(slot.date)) entry.dates.push(slot.date)
    // Frühester Termin samt Folgennummer — daraus lässt sich der Staffelstart
    // zurückrechnen, auch wenn er vor dem gescrapten Zeitraum liegt.
    if (!entry.earliest || slot.date < entry.earliest.date) {
      entry.earliest = { date: slot.date, episode: slot.episode }
    }
  }
  for (const entry of Object.values(german)) {
    entry.dates.sort()
    entry.weeklyConfirmed = entry.dates.some((d, i) => i > 0 && diffDays(entry.dates[i - 1], d) === 7)
  }

  const previous = readJson<CrunchyrollData>('data/crunchyroll.json', {
    scrapedAt: '',
    german: {},
    slots: [],
  })
  // Alte Funde behalten: eine Staffel verschwindet aus dem Kalender, sobald
  // sie durch ist — ihre belegte Uhrzeit bleibt trotzdem gültig.
  const merged = { ...previous.german }
  for (const [key, value] of Object.entries(german)) {
    const old = merged[key]
    if (!old) {
      merged[key] = value
      continue
    }
    const dates = [...new Set([...old.dates, ...value.dates])].sort()
    const earliest =
      old.earliest && (!value.earliest || old.earliest.date < value.earliest.date)
        ? old.earliest
        : value.earliest
    merged[key] = {
      ...value,
      dates,
      earliest,
      weeklyConfirmed:
        value.weeklyConfirmed ||
        old.weeklyConfirmed ||
        dates.some((d, i) => i > 0 && diffDays(dates[i - 1], d) === 7),
    }
  }

  writeJson(
    'data/crunchyroll.json',
    { scrapedAt: new Date().toISOString(), german: merged, slots: slots.filter((s) => s.german) },
    true,
  )
  log(`${Object.keys(merged).length} Titel mit belegter deutscher Sendezeit gespeichert.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
