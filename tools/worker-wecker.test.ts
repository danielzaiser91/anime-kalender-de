/**
 * **Der Wecker startet nach `scheduledTime`, nicht nach der Uhr des Aufrufs** (19.10.2026): Der Cloudflare-Cron kann Sekunden
 * nach der vollen Stunde ankommen (oder, nach einem Neuversuch, später); `starteFaelligeLaeufe` und der Aufruf in
 * `scheduled` müssen die Stunde aus `event.scheduledTime` lesen. Die echte Uhr steht im Test absichtlich auf einer anderen
 * Stunde und einem anderen Tag, damit ein Aufruf ohne `now` auffällt.
 *
 * Aufruf: `npx tsx tools/worker-wecker.test.ts`
 */
import worker from '../worker/src/index.ts'
import { starteFaelligeLaeufe } from '../worker/src/wecker.ts'
import { faelligeLaeufe } from '../shared/weckplan.ts'
import type { Env } from '../worker/src/env.ts'
import { fetchAttrappe, neueDatenbank, testEnv, zaehlerZurueck } from './worker-unteraufrufe-attrappe.ts'
import { festeUhr } from './feste-uhr.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  stumm(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
const stumm = console.log
console.log = () => {}
console.error = () => {}

/**
 * Eine Zone weit hinter UTC (Sommer -7 h, Winter -8 h), damit auch ein Rechner und ein CI-Lauf mit TZ=UTC lokale Stunde, Wochentag
 * und Monatstag von denen in UTC unterscheiden: `getHours`, `getDay`, `getDate` statt der UTC-Fassung werden rot.
 */
process.env.TZ = 'America/Los_Angeles'

/** Die Echtzeit des Tests: Dienstag 10:30 UTC, in keiner der geprüften Wecker-Stunden. */
festeUhr('2026-10-20T10:30:00Z')

const gestartet: string[] = []
const kopfZeilen: string[] = []
/** Antwort der Attrappe auf "letzte Läufe" (neuester zuerst); leer = nie gelaufen. */
let bisherige: { created_at: string; status: string; conclusion: string }[] = []

/** Hängt sich vor die Attrappe und merkt sich, welche Workflows per `dispatches` gestartet wurden. */
function mitAufzeichnung(): void {
  fetchAttrappe('2026-10-20')
  const weiter = globalThis.fetch
  globalThis.fetch = (async (eingabe: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof eingabe === 'string' ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe.url
    const treffer = /actions\/workflows\/([^/]+)\/dispatches$/.exec(url)
    if (treffer && init?.method === 'POST') {
      gestartet.push(treffer[1])
      kopfZeilen.push(String((init.headers as Record<string, string>).Authorization))
    }
    if (url.includes('/runs?')) return new Response(JSON.stringify({ workflow_runs: bisherige }), { status: 200 })
    return weiter(eingabe, init)
  }) as typeof fetch
}

const nach = async (lauf: () => Promise<void>): Promise<string[]> => {
  gestartet.length = 0
  await lauf()
  return [...gestartet].sort()
}

const env = (token?: string) => ({ GITHUB_WECKER_TOKEN: token }) as unknown as Env
const gleich = (a: string[], b: string[]) => JSON.stringify(a) === JSON.stringify([...b].sort())

mitAufzeichnung()

stumm('starteFaelligeLaeufe:')
// Montag 04:00 UTC: stündlicher Lauf und Tageslauf (tonspuren-monatlich holt ab dem 2. des Monats nach).
const MONTAG_VIER = new Date('2026-10-19T04:00:00.000Z')
pruefe(
  gleich(await nach(() => starteFaelligeLaeufe(env('t'), MONTAG_VIER)), ['refresh-hourly.yml', 'refresh-data.yml', 'tonspuren-monatlich.yml']),
  'Montag 04:00 UTC: stündlicher Lauf, Tageslauf, Monatslauf',
)
pruefe(kopfZeilen.every((k) => k === 'Bearer t'), 'der Start trägt das Wecker-Token')
pruefe(gleich(await nach(() => starteFaelligeLaeufe(env('t'), new Date('2026-10-19T03:59:59.999Z'))), ['refresh-hourly.yml', 'meldungskopie.yml']), 'eine Millisekunde vor 04:00: noch die Stunde 03 (Meldungskopie, kein Tageslauf)')
pruefe(gleich(await nach(() => starteFaelligeLaeufe(env('t'), new Date('2026-10-19T04:59:59.999Z'))), ['refresh-hourly.yml', 'refresh-data.yml', 'tonspuren-monatlich.yml']), 'eine Millisekunde vor 05:00: noch die Stunde 04')
pruefe(
  gleich(await nach(() => starteFaelligeLaeufe(env('t'), new Date('2026-10-19T05:00:00.000Z'))), ['refresh-hourly.yml', 'refresh-weekly.yml']),
  'Montag 05:00 UTC: Wochenlauf statt Tageslauf',
)
pruefe((await nach(() => starteFaelligeLaeufe(env(undefined), MONTAG_VIER))).length === 0, 'ohne Token startet nichts')
// Monatslauf ab dem 2. (UTC): 2.11. 04:00 UTC ist in Los Angeles noch der 1.11., gezählt wird UTC.
pruefe(
  gleich(await nach(() => starteFaelligeLaeufe(env('t'), new Date('2026-11-02T04:00:00.000Z'))), ['refresh-hourly.yml', 'refresh-data.yml', 'tonspuren-monatlich.yml']),
  '2.11. 04:00 UTC (1.11. in Los Angeles): Monatslauf startet',
)
// Monatstag ohne Nachholen: genau der Tag in UTC (2.11. 04:00 UTC = 1.11. in Los Angeles).
const amZweiten = [{ workflow: 'x.yml', tagImMonat: 2, abstandMin: 30 }]
const amErsten = [{ workflow: 'x.yml', tagImMonat: 1, abstandMin: 30 }]
pruefe(gleich(faelligeLaeufe(new Date('2026-11-02T04:00:00.000Z'), amZweiten), ['x.yml']), 'tagImMonat 2 trifft den 2.11. UTC')
pruefe(faelligeLaeufe(new Date('2026-11-02T04:00:00.000Z'), amErsten).length === 0, 'tagImMonat 1 trifft den 2.11. UTC nicht, auch wenn es lokal der 1.11. ist')
// Jahreswechsel: 00:00 UTC am 1.1. ist die Stunde 0 (in Los Angeles noch der 31.12.); kein Tageslauf, nur der stündliche.
pruefe(gleich(await nach(() => starteFaelligeLaeufe(env('t'), new Date('2027-01-01T00:00:00.000Z'))), ['refresh-hourly.yml']), 'Jahreswechsel 00:00 UTC: nur der stündliche Lauf')
// 00:30 Berlin (Sommerzeit) ist 22:30 UTC des Vortags: gezählt wird UTC.
pruefe(gleich(await nach(() => starteFaelligeLaeufe(env('t'), new Date('2026-10-19T22:30:00.000Z'))), ['refresh-hourly.yml']), '00:30 Berlin = 22:30 UTC: nur der stündliche Lauf')

// Der Mindestabstand (refresh-hourly: 40 min) misst gegen die übergebene Zeit, nicht gegen die Uhr des Aufrufs.
const lauf = (vor: number) => [{ created_at: new Date(MONTAG_VIER.getTime() - vor * 60_000).toISOString(), status: 'completed', conclusion: 'success' }]
bisherige = lauf(10)
pruefe(gleich(await nach(() => starteFaelligeLaeufe(env('t'), MONTAG_VIER)), []), 'letzter Start 10 min vor der Wecker-Zeit: Mindestabstand sperrt alle')
bisherige = lauf(41)
pruefe(gleich(await nach(() => starteFaelligeLaeufe(env('t'), MONTAG_VIER)), ['refresh-hourly.yml']), '41 min vor der Wecker-Zeit: der stündliche Lauf startet, Tages- und Monatslauf (600 min und mehr) bleiben gesperrt')
bisherige = []

stumm('scheduled (Wecker-Aufruf in index.ts):')
/** Ein Cron-Aufruf mit fester `scheduledTime`; wartet auf alles, was an `waitUntil` geht. */
async function cron(zeit: Date, token: string | undefined): Promise<string[]> {
  return nach(async () => {
    const offen: Promise<unknown>[] = []
    const ctx = { waitUntil: (p: Promise<unknown>) => offen.push(p), passThroughOnException: () => {} } as unknown as ExecutionContext
    zaehlerZurueck()
    const e = { ...testEnv(neueDatenbank(), 25), GITHUB_WECKER_TOKEN: token } as Env
    await worker.scheduled({ cron: '0 * * * *', scheduledTime: zeit.getTime(), noRetry: () => {} }, e, ctx)
    await Promise.allSettled(offen)
  })
}
pruefe(gleich(await cron(MONTAG_VIER, 'attrappe'), ['refresh-hourly.yml', 'refresh-data.yml', 'tonspuren-monatlich.yml']), 'Cron Montag 04:00 UTC bei Echtzeit Dienstag 10:30: stündlicher Lauf, Tageslauf, Monatslauf')
pruefe(gleich(await cron(new Date('2026-10-19T05:00:00.000Z'), 'attrappe'), ['refresh-hourly.yml', 'refresh-weekly.yml']), 'Cron Montag 05:00 UTC: Wochenlauf')
pruefe(gleich(await cron(new Date('2026-10-19T04:00:30.000Z'), 'attrappe'), ['refresh-hourly.yml', 'refresh-data.yml', 'tonspuren-monatlich.yml']), 'Cron 30 Sekunden nach der Stunde: dieselbe Stunde')
pruefe(gleich(await cron(new Date('2026-10-19T03:59:59.999Z'), 'attrappe'), ['refresh-hourly.yml', 'meldungskopie.yml']), 'Cron eine Millisekunde vor 04:00: Stunde 03')
pruefe((await cron(MONTAG_VIER, undefined)).length === 0, 'Cron ohne Wecker-Token: nichts gestartet')

if (fehler) {
  stumm(`\n${fehler} Prüfung(en) rot.`)
  process.exit(1)
}
stumm('\nAlle Prüfungen grün.')
