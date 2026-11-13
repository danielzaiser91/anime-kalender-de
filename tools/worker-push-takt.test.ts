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
import { pushVersand } from '../worker/src/push.ts'
import { istErschienen } from '../shared/logic.ts'
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
/** Inhalt der Meldungsdatei (`data/news.json`) für die „Jetzt auch bei“-Zeile. */
let meldungen: unknown[] = []

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
    if (url.endsWith('data/news.json')) return new Response(JSON.stringify(meldungen), { status: 200 })
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
  await takt({ ...env, GITHUB_WECKER_TOKEN: undefined } as typeof env, FUENF, utc('17:05')) // ohne Wecker-Token: gemessen wird nur der Push-Takt (der Wecker kostet je Aufruf 1 GET, alle 20 min 1 POST)
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

async function jetztAuchBei() {
  zeige('„Jetzt auch bei“ gehört dem Stundenlauf:')
  pushZeiten.length = 0
  meldungen = [{ titelId: 177476, titel: 'YAIBA', am: '2026-11-05T10:00:00Z', meldungen: [{ art: 'neu', weiterer: true, platform: 'netflix' }] }]
  const db = neueDatenbank()
  const env = await umgebung(db, [YAIBA], 'ak:177476')
  const text = () => (db.prepare('SELECT offen FROM push_abo').get() as { offen: string | null }).offen ?? ''
  await takt(env, FUENF, utc('17:25'))
  pruefe(text().startsWith('Jetzt auf Deutsch: YAIBA') && !text().includes('Netflix'), `Fünf-Minuten-Takt meldet nur die Folge (${text()})`)
  await takt(env, STUNDE, utc('18:00'))
  pruefe(text().includes('Netflix') && pushZeiten.length === 2, `Stundenlauf meldet danach „jetzt auch bei Netflix“ (${text()})`)
  meldungen = []
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

/** Katalogstart ohne Uhrzeit: für den Push erst 23:59, nicht 00:00 (Netflix schaltet gegen 9 Uhr frei). */
async function katalogstartOhneUhrzeit() {
  zeige('Katalogstart ohne Uhrzeit (batch):')
  const batch = { ...YAIBA, id: 'k@2026-11-06', titleId: 177478, date: '2026-11-06', time: undefined, releaseType: 'batch', platform: 'netflix', tvPremiere: false } as unknown as ReleaseEvent
  pruefe(!pushFaellig([batch], new Date('2026-11-05T23:05:00.000Z')), 'pushFaellig 00:05 Berlin am Starttag: nicht fällig')
  pruefe(pushFaellig([batch], new Date('2026-11-06T23:05:00.000Z')), 'pushFaellig 00:05 Berlin am Folgetag (23:59 überschritten): fällig')
  const db = neueDatenbank()
  const env = await umgebung(db, [batch], 'ak:177478')
  pushZeiten.length = 0
  await takt(env, STUNDE, new Date('2026-11-05T23:00:00.000Z'))
  await takt(env, FUENF, new Date('2026-11-05T23:05:00.000Z'))
  pruefe(pushZeiten.length === 0, `Stunden- und Fünf-Minuten-Lauf um 00:00/00:05 Berlin am Starttag: kein Push (${pushZeiten.length})`)
  await takt(env, STUNDE, new Date('2026-11-06T23:00:00.000Z'))
  pruefe(pushZeiten.length === 1, `Stundenlauf nach 23:59 Berlin des Starttags: Push (${pushZeiten.length})`)
}

async function tageswechselUndCpu() {
  zeige('Vorfilter über das Datum:')
  const bei = (date: string, time: string) => ({ ...YAIBA, date, time }) as ReleaseEvent
  /* Berlin 00:10 ist UTC 23:10 (Winter) bzw. 22:10 (Sommer) des Vortags: Tag und UTC-Tag fallen auseinander. */
  pruefe(pushFaellig([bei('2026-11-06', '00:10')], new Date('2026-11-05T23:15:00.000Z')), 'Tageswechsel Winterzeit: 00:10 Berlin um 00:15 Berlin fällig')
  pruefe(pushFaellig([bei('2026-10-25', '00:10')], new Date('2026-10-24T22:15:00.000Z')), 'Tageswechsel Sommerzeit: 00:10 Berlin um 00:15 Berlin fällig')
  pruefe(!pushFaellig([bei('2026-11-05', '23:59')], new Date('2026-11-05T22:55:00.000Z')), '23:59-Termin um 23:55 Berlin noch nicht fällig')
  pruefe(pushFaellig([bei('2026-11-05', '23:59')], new Date('2026-11-05T23:05:00.000Z')), '23:59-Termin von gestern ist um 00:05 Berlin fällig')
  /* 4.369 Termine wie in events.json: ohne Vorfilter ~90 ms (Intl je Termin), mit ~1 ms. Das Free-Limit liegt bei 10 ms je Aufruf. */
  const viele = Array.from({ length: 4369 }, (_, i) => bei(new Date(Date.UTC(2021, 5, 1) + (i % 4000) * 86_400_000).toISOString().slice(0, 10), `${String(i % 24).padStart(2, '0')}:${String((i * 5) % 60).padStart(2, '0')}`))
  const t = new Date('2026-11-05T17:30:00.000Z')
  viele.push(YAIBA)
  let best = Infinity
  for (let i = 0; i < 5; i++) {
    const start = performance.now()
    pushFaellig(viele, t)
    best = Math.min(best, performance.now() - start)
  }
  pruefe(pushFaellig(viele, t), 'Yaiba zwischen 4.369 anderen Terminen wird gefunden')
  pruefe(best < 10, `4.370 Termine: ${best.toFixed(1)} ms je Aufruf (Grenze 10 ms wie das Free-Limit; ohne Vorfilter ~90 ms)`)
  /* Der Stundenlauf rechnet über denselben Vorfilter. */
  const db = neueDatenbank()
  const env = await umgebung(db, viele, 'ak:1')
  let stunde = Infinity
  for (let i = 0; i < 5; i++) {
    const start = performance.now()
    await pushVersand(env, new Date('2026-11-05T16:05:00.000Z'), viele, (e, z) => istErschienen(e, z))
    stunde = Math.min(stunde, performance.now() - start)
  }
  pruefe(stunde < 10, `Stundenlauf (pushVersand ohne Neues) mit 4.370 Terminen: ${stunde.toFixed(1)} ms (Grenze 10 ms)`)
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
await jetztAuchBei()
fenster()
await katalogstartOhneUhrzeit()
await tageswechselUndCpu()
wrangler()
zeige(fehler ? `${fehler} Prüfung(en) FEHL` : 'Push-Takt: alle Prüfungen ok (Yaiba 17:25 UTC, volle Stunde, Fenster, Trigger)')
process.exit(fehler ? 1 : 0)
