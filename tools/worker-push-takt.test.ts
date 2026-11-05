/**
 * **Pünktlicher Push** (05.11.2026): Yaiba lief um 18:25 (ProSieben MAXX), die Benachrichtigung kam um ~19:00, weil der Versand
 * nur im stündlichen Trigger lief. Seitdem gibt es den Fünf-Minuten-Trigger, der D1 nur anfasst, wenn in den letzten zehn
 * Minuten ein Termin erschienen ist. Geprüft über den echten `scheduled`-Einstieg des Workers (Verdrahtung), mit der Uhrzeit
 * jedes Takts: Verspätung höchstens ein Takt (5 Minuten), ohne fälligen Termin keine D1-Anweisung, zur vollen Stunde kein
 * doppelter Push, ohne den neuen Trigger (Kontrolle) kommt der Push erst um 19:00.
 *
 * Aufruf: `npx tsx tools/worker-push-takt.test.ts`
 */
import { readFileSync } from 'node:fs'
import type { DatabaseSync } from 'node:sqlite'
import worker from '../worker/src/index.ts'
import { pushFaellig } from '../worker/src/push-takt.ts'
import type { ReleaseEvent } from '../shared/types.ts'
import { fetchAttrappe, neueDatenbank, testEnv, zaehler, zaehlerZurueck } from './worker-unteraufrufe-attrappe.ts'

let fehler = 0
const zeige = console.log
const pruefe = (bedingung: boolean, text: string) => {
  zeige(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
console.error = () => {}
console.log = () => {}

/** Der Anlass wörtlich aus `events.json` vom 05.11.2026. */
const YAIBA = {
  releaseSlug: 'yaiba-samurai-legend-prosieben-maxx',
  titleId: 177476,
  time: '18:25',
  releaseType: 'weekly',
  platform: 'tv',
  sender: 'ProSieben MAXX',
  name: 'YAIBA: Samurai Legend',
  id: 'yaiba-samurai-legend-prosieben-maxx@2026-11-05',
  date: '2026-11-05',
  episode: 1,
  episodeCount: 24,
  tvPremiere: true,
} as unknown as ReleaseEvent
const STUNDENWECHSEL = { ...YAIBA, id: 'x@2026-11-05', titleId: 177477, time: '19:00', name: 'Voll' } as ReleaseEvent
const MARKE = '2026-11-05T16:00:00.000Z'
const utc = (hhmm: string) => new Date(`2026-11-05T${hhmm}:00.000Z`)

const pushZeiten: Date[] = []
let aktuell = utc('00:00')

async function umgebung(db: DatabaseSync, ereignisse: ReleaseEvent[], favoriten: string) {
  fetchAttrappe('2026-11-05')
  const basis = globalThis.fetch
  globalThis.fetch = (async (e: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof e === 'string' ? e : e instanceof URL ? e.href : e.url
    if (url.startsWith('https://fcm.googleapis.com/')) {
      zaehler.fetch++
      pushZeiten.push(aktuell)
      return new Response('', { status: 201 })
    }
    if (url.endsWith('data/events.json')) {
      zaehler.fetch++
      return new Response(JSON.stringify(ereignisse), { status: 200 })
    }
    return basis(e, init)
  }) as typeof fetch
  const schluessel = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
  const privat = JSON.stringify(await crypto.subtle.exportKey('jwk', schluessel.privateKey))
  db.exec('DELETE FROM push_abo')
  db.prepare('INSERT INTO push_abo (endpoint, favoriten, erstellt, zuletzt, gemeldet) VALUES (?1, ?2, ?3, NULL, ?4)').run(
    'https://fcm.googleapis.com/abo-1',
    favoriten,
    '2026-11-01',
    '',
  )
  db.prepare('INSERT OR REPLACE INTO push_marke (id, zuletzt, gemeldet) VALUES (1, ?1, ?2)').run(MARKE, '')
  return { ...testEnv(db, 7), VAPID_PRIVATE_JWK: privat, VAPID_PUBLIC: 'oeffentlich' }
}

type Umgebung = Awaited<ReturnType<typeof umgebung>>

/** Ein Takt des Cloudflare-Weckers: der echte `scheduled`-Einstieg mit Ausdruck und Uhrzeit. */
async function takt(env: Umgebung, ausdruck: string, zeit: Date) {
  const offen: Promise<unknown>[] = []
  const ctx = { waitUntil: (p: Promise<unknown>) => offen.push(p), passThroughOnException: () => {} } as unknown as ExecutionContext
  aktuell = zeit
  zaehlerZurueck()
  await worker.scheduled({ cron: ausdruck, scheduledTime: zeit.getTime(), noRetry: () => {} }, env, ctx)
  await Promise.allSettled(offen)
}

const STUNDE = '0 * * * *'
const FUENF = '*/5 * * * *'

/** Alle Takte von 17:00 bis 18:10 UTC, so wie Cloudflare sie auslöst: zur vollen Stunde feuern beide Trigger. */
async function simuliere(env: Umgebung, mitFuenfMinuten: boolean) {
  pushZeiten.length = 0
  for (let minute = 0; minute <= 70; minute += 5) {
    const zeit = new Date(utc('17:00').getTime() + minute * 60_000)
    /* Zur vollen Stunde feuern beide Trigger gleichzeitig, wie bei Cloudflare. */
    const gleichzeitig = [minute % 60 === 0 ? takt(env, STUNDE, zeit) : null, mitFuenfMinuten ? takt(env, FUENF, zeit) : null]
    await Promise.all(gleichzeitig)
  }
}

const hhmm = (d: Date) => d.toISOString().slice(11, 16)

async function yaiba() {
  zeige('Yaiba, 18:25 Berlin = 17:25 UTC, Abo mit dieser Sendung:')
  const db = neueDatenbank()
  const env = await umgebung(db, [YAIBA], 'ak:177476')
  await simuliere(env, true)
  pruefe(pushZeiten.length === 1, `genau ein Push (${pushZeiten.length})`)
  pruefe(pushZeiten.length === 1 && pushZeiten[0].getTime() - utc('17:25').getTime() <= 5 * 60_000, `Verspätung höchstens 5 Minuten (Push um ${pushZeiten[0] ? hhmm(pushZeiten[0]) : '-'} UTC)`)
  pruefe(hhmm(pushZeiten[0] ?? new Date(0)) === '17:25', 'der Push kommt im Takt um 17:25 UTC = 18:25 Berlin')

  const alt = neueDatenbank()
  const envAlt = await umgebung(alt, [YAIBA], 'ak:177476')
  await simuliere(envAlt, false)
  pruefe(pushZeiten.length === 1 && hhmm(pushZeiten[0]) === '18:00', `Kontrolle ohne den Fünf-Minuten-Trigger: Push erst um ${hhmm(pushZeiten[0] ?? new Date(0))} UTC = 19:00 Berlin`)
}

async function volleStunde() {
  zeige('Termin zur vollen Stunde, beide Trigger feuern:')
  const db = neueDatenbank()
  const env = await umgebung(db, [STUNDENWECHSEL], 'ak:177477')
  await simuliere(env, true)
  pruefe(pushZeiten.length === 1 && hhmm(pushZeiten[0]) === '18:00', `genau ein Push um 18:00 UTC, kein doppelter (${pushZeiten.map(hhmm).join(',')})`)
}

async function ohneTermin() {
  zeige('Takt ohne fälligen Termin:')
  pushZeiten.length = 0
  const db = neueDatenbank()
  const env = await umgebung(db, [YAIBA], 'ak:177476')
  await takt(env, FUENF, utc('17:05'))
  pruefe(zaehler.d1 === 0 && zaehler.sql.length === 0, `keine D1-Anweisung (${zaehler.d1})`)
  pruefe(zaehler.fetch === 1, `ein Abruf (die Termindatei), keine Meldungen und kein Monitor (${zaehler.fetch})`)
  pruefe(zaehler.objekt === 0 && zaehler.einzelmails === 0, 'Schnellmesser und Mail bleiben aus')
  await takt(env, FUENF, utc('17:25'))
  pruefe(zaehler.d1 > 0 && pushZeiten.length === 1, `im Takt mit Termin wird D1 berührt (${zaehler.d1} Aufrufe) und gepusht`)
  const ohneMarke = neueDatenbank()
  const env2 = await umgebung(ohneMarke, [YAIBA], 'ak:177476')
  ohneMarke.exec('DELETE FROM push_marke')
  pushZeiten.length = 0
  await takt(env2, FUENF, utc('17:25'))
  pruefe(pushZeiten.length === 0 && (ohneMarke.prepare('SELECT COUNT(*) n FROM push_marke').get() as { n: number }).n === 0, 'ohne Marke setzt der Fünf-Minuten-Takt keine und pusht nichts')
}

function fenster() {
  zeige('Fenster von zehn Minuten:')
  const bei = (zeit: string, extra: Record<string, unknown> = {}) => ({ ...YAIBA, date: '2026-11-05', time: zeit, ...extra }) as ReleaseEvent
  const t = new Date('2026-11-05T17:30:00.000Z')
  const faellig = (z: string, extra: Record<string, unknown> = {}) => pushFaellig([bei(z, extra)], t)
  pruefe(faellig('18:30'), 'Termin genau jetzt: fällig')
  pruefe(faellig('18:25'), 'Termin vor fünf Minuten: fällig (verpasster Takt wird nachgeholt)')
  pruefe(faellig('18:21'), 'Termin vor neun Minuten: fällig')
  pruefe(!faellig('18:20'), 'Termin vor genau zehn Minuten: nicht mehr fällig')
  pruefe(!faellig('18:31'), 'Termin in der Zukunft: nicht fällig')
  pruefe(!faellig('18:30', { verpasst: {} }), 'ausgebliebener Termin: nicht fällig')
  pruefe(faellig('18:30', { verpasst: { erschienenAm: '2026-11-05' } }), 'nachgeholter Termin: fällig')
  pruefe(!pushFaellig([], t), 'keine Termine: nicht fällig')
}

function wrangler() {
  zeige('wrangler.toml:')
  const toml = readFileSync('worker/wrangler.toml', 'utf8')
  const crons = JSON.parse(/^crons = (\[.*\])$/m.exec(toml)?.[1] ?? '[]') as string[]
  pruefe(crons.includes('*/5 * * * *') && crons.includes('0 * * * *') && crons.includes('0 5,6 * * *'), 'crons trägt stündlich, Digest und alle fünf Minuten')
  pruefe(crons.length <= 5, `höchstens 5 Trigger je Konto (Free), hier ${crons.length}`)
}

await yaiba()
await volleStunde()
await ohneTermin()
fenster()
wrangler()
zeige(fehler ? `${fehler} Prüfung(en) FEHL` : 'Push-Takt: alle Prüfungen ok (Yaiba 17:25 UTC, volle Stunde, Fenster, Trigger)')
process.exit(fehler ? 1 : 0)
