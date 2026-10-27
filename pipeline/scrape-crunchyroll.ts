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
import { chromium, type Browser, type Page, type Response } from 'playwright'
import { pathToFileURL } from 'node:url'
import { addDays, diffDays, startOfWeek, todayIso } from '../shared/time.ts'
import { log, readJson, sleep, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import { kalenderDetails, kalenderDiagnose, meldeLeerenKalender, type KalenderDetails } from './lib/cr-kalender-diagnose.ts'
import {
  crunchyrollSeriesId,
  normalizeTitle,
  type CrunchyrollData,
  type CrunchyrollObservation,
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

/** Lädt die Kalenderwoche mit bis zu drei Versuchen; wirft, wenn alle scheitern. */
async function ladeKalenderSeite(page: Page, weekStart: string): Promise<Aufruf> {
  // `filter=premium` ist kein Login-Zwang, sondern nur die Ansichts-Umschaltung
  // der Seite: ohne den Parameter blendet Crunchyroll die Kacheln aus und
  // wirbt stattdessen fürs Abo. Mit ihm liefert dieselbe öffentliche Seite
  // alle Termine samt Uhrzeit.
  /**
   * Drei Versuche, dann gilt diese Woche als ungelesen.
   *
   * Am 24.08.2026 um 01:59 brach der stuendliche Lauf an einem
   * net::ERR_CONNECTION_CLOSED ab und nahm die beiden anderen Wochen
   * mitsamt Datenbau und Deploy mit. Eine Stunde spaeter lief derselbe
   * Aufruf durch -- es war ein Aussetzer, kein Umbau der Seite.
   *
   * Dasselbe Muster wie beim AniList-Ausfall am 23.08.: Ein Lauf haelt an,
   * obwohl er weitermachen koennte, und nimmt alles Uebrige mit.
   *
   * Die Pause waechst (2 s, 4 s), damit ein kurzer Aussetzer ueberbrueckt
   * wird, ohne bei einer echten Sperre nachzudruecken.
   */
  let letzterFehler: unknown
  let aufruf: Aufruf = { status: undefined, kette: [] }
  for (let versuch = 1; versuch <= 3; versuch++) {
    try {
      const antwort = await page.goto(
        `https://www.crunchyroll.com/de/simulcastcalendar?filter=premium&date=${weekStart}`,
        { waitUntil: 'domcontentloaded', timeout: 45000 },
      )
      aufruf = { status: antwort?.status(), kette: await aufrufKette(antwort) }
      letzterFehler = undefined
      break
    } catch (err) {
      letzterFehler = err
      if (versuch < 3) {
        warn(
          `${weekStart}: Aufruf fehlgeschlagen (Versuch ${versuch}/3) — ${(err as Error).message.split('\n')[0]}`,
        )
        await new Promise((r) => setTimeout(r, versuch * 2000))
      }
    }
  }
  if (letzterFehler) throw letzterFehler
  return aufruf
}

interface Aufruf {
  status: number | undefined
  kette: KalenderDetails['kette']
}

/** Aufrufadresse bis Endadresse mit Status je Schritt (Umleitungen); ohne Antwort leer. */
async function aufrufKette(antwort: Response | null): Promise<Aufruf['kette']> {
  const kette: Aufruf['kette'] = []
  for (let anfrage = antwort?.request() ?? null; anfrage; anfrage = anfrage.redirectedFrom()) {
    kette.unshift({ status: (await anfrage.response())?.status(), url: anfrage.url() })
  }
  return kette
}

/** Verweise und HTML der leeren Seite als Logzeile (Umleitung? Umbau? JSON-Adressen?). */
async function seitenDetails(page: Page, kette: Aufruf['kette']): Promise<string> {
  const [links, html] = await Promise.all([
    page
      .evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') ?? ''))
      .catch(() => [] as string[]),
    page.content().catch(() => ''),
  ])
  return kalenderDetails({ kette, links, html })
}

/** Liest Titel, sichtbaren Text und HTML der geladenen Seite für die Diagnose bei null Kacheln. */
async function seitenDiagnose(page: Page, status: number | undefined): Promise<string> {
  const [titel, text, html] = await Promise.all([
    page.title().catch(() => ''),
    page.evaluate(() => document.body?.innerText ?? '').catch(() => ''),
    page.content().catch(() => ''),
  ])
  return kalenderDiagnose({ status, titel, text, html })
}

export async function scrapeWeek(
  browser: Browser,
  weekStart: string,
  diagnosen: string[],
): Promise<CrunchyrollSlot[]> {
  const page = await browser.newPage({
    userAgent: UA,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    viewport: { width: 1400, height: 900 },
  })

  try {
    const { status, kette } = await ladeKalenderSeite(page, weekStart)
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

    if (!rows.length) {
      diagnosen.push(`${weekStart}: ${await seitenDiagnose(page, status)}`)
      warn(`Details ${weekStart}: ${await seitenDetails(page, kette)}`)
    }

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

/** Liest die Wochen von `today` aus rückwärts; bleibt alles leer, steht die Diagnose in der Quellengesundheit. */
export async function liesWochen(browser: Browser, today: string, weeks: number) {
  const slots: CrunchyrollSlot[] = []
  const diagnosen: string[] = []
  const weekStarts: string[] = []
  // Rückblick statt Vorschau: künftige Wochen stehen oft noch auf
  // „Zeitplan kommt bald", vergangene tragen die tatsächliche Uhrzeit.
  for (let i = weeks - 2; i >= -1; i--) {
    const weekStart = startOfWeek(addDays(today, -7 * i))
    weekStarts.push(weekStart)
    const found = await scrapeWeek(browser, weekStart, diagnosen)
    log(`Crunchyroll ${weekStart}: ${found.length} Einträge, davon ${found.filter((f) => f.german).length} deutsch`)
    slots.push(...found)
    await sleep(1500)
  }
  if (!slots.length) meldeLeerenKalender(diagnosen)
  return { slots, weekStarts }
}

/** Führt die gelesenen Slots mit dem bisherigen Stand zusammen und schreibt `data/crunchyroll.json`. */
function schreibeKalender(slots: CrunchyrollSlot[], weekStarts: string[]): void {
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
    // Jeden gesehenen Termin mit seiner Folgennummer festhalten. Erst die
    // Menge aller Beobachtungen macht einen einzelnen Ausreißer erkennbar.
    entry.observations ??= []
    if (!entry.observations.some((o) => o.date === slot.date)) {
      entry.observations.push({ date: slot.date, episode: slot.episode })
    }
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
    // Beobachtungen beider Läufe vereinen. Ältere Bestände kennen das Feld
    // noch nicht — deren Termine kommen ohne Folgennummer dazu und zählen
    // dann nur bei der Frage mit, welcher Wochentag der Sendeplatz ist.
    const byDate = new Map<string, CrunchyrollObservation>()
    for (const date of old.dates) byDate.set(date, { date })
    for (const o of old.observations ?? []) byDate.set(o.date, o)
    for (const o of value.observations ?? []) byDate.set(o.date, o)
    merged[key] = {
      ...value,
      dates,
      observations: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
      earliest,
      weeklyConfirmed:
        value.weeklyConfirmed ||
        old.weeklyConfirmed ||
        dates.some((d, i) => i > 0 && diffDays(dates[i - 1], d) === 7),
    }
  }

  writeJson(
    'data/crunchyroll.json',
    {
      scrapedAt: new Date().toISOString(),
      // Nur innerhalb dieses Fensters ist ein Fehlen aussagekräftig.
      window: { from: weekStarts[0], to: addDays(weekStarts[weekStarts.length - 1], 6) },
      german: merged,
      slots: slots.filter((s) => s.german),
    },
    true,
  )
  const germanCount = Object.keys(german).length
  recordSource('crunchyroll', germanCount, germanCount ? undefined : 'Kalender geladen, aber kein „(Deutsch)"-Eintrag')
  log(`${Object.keys(merged).length} Titel mit belegter deutscher Sendezeit gespeichert.`)
}

/** `start`, `today` und `weeks` stehen als Parameter, damit der Test den Ablauf ohne Browser und ohne Uhr fährt. */
export async function main(
  start: () => Promise<Browser> = () => chromium.launch({ headless: !HEADED }),
  today: string = todayIso(),
  weeks: number = WEEKS,
): Promise<void> {
  const browser = await start()
  let gelesen: Awaited<ReturnType<typeof liesWochen>>
  try {
    gelesen = await liesWochen(browser, today, weeks)
  } finally {
    await browser.close()
  }
  if (!gelesen.slots.length) return
  schreibeKalender(gelesen.slots, gelesen.weekStarts)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
