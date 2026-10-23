/**
 * **Anmelde-Schutz von `POST /subscribe`** (B2, 23.10.2026): 5 Anmeldungen je IP und Stunde, 1 Mail je Adresse
 * und 15 Minuten, 30 Bestätigungsmails am Tag. Läuft über `worker.fetch` gegen eine echte SQLite-Datenbank
 * mit allen Migrationen; Mails zählt die Attrappe von `fetch` (Resend).
 *
 * Aufruf: `npx tsx tools/worker-anmelde-schutz.test.ts`
 */
import { DatabaseSync } from 'node:sqlite'
import { readdirSync, readFileSync } from 'node:fs'
import worker from '../worker/src/index.ts'
import type { Env } from '../worker/src/env.ts'
import { festeUhr } from './feste-uhr.ts'

const START = Date.parse('2026-10-12T12:00:00Z')
const zeit = festeUhr(new Date(START).toISOString())
void zeit

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
console.error = () => {}

function neueDatenbank() {
  const db = new DatabaseSync(':memory:')
  db.exec(readFileSync('worker/schema.sql', 'utf8'))
  for (const f of readdirSync('worker/migrations').sort()) {
    try {
      db.exec(readFileSync(`worker/migrations/${f}`, 'utf8'))
    } catch {
      // Migrationen, die schema.sql schon enthält, scheitern an doppelten Spalten
    }
  }
  return db
}

/** D1-Attrappe; `geschrieben` zählt die Zeilen, die Schreibanweisungen ändern. */
function umgebung(db: DatabaseSync) {
  const stand = { geschrieben: 0 }
  const anweisung = (sql: string, werte: unknown[] = []): unknown => ({
    bind: (...w: unknown[]) => anweisung(sql, w),
    run: async () => {
      const r = db.prepare(sql).run(...(werte as never[]))
      stand.geschrieben += Number(r.changes)
      return { meta: { changes: Number(r.changes) } }
    },
    first: async () => db.prepare(sql).get(...(werte as never[])) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...(werte as never[])) }),
  })
  const env = {
    DB: { prepare: (sql: string) => anweisung(sql) },
    ALLOWED_ORIGIN: 'https://anime.example',
    MAIL_PROVIDER: 'resend',
    MAIL_API_KEY: 'k',
    FROM_EMAIL: 'a@b.test',
    FROM_NAME: 'Test',
    SITE_URL: 'https://attrappe.test/',
  } as unknown as Env
  return { env, stand }
}

let mails = 0
globalThis.fetch = (async () => {
  mails++
  return new Response('{}', { status: 200 })
}) as typeof fetch

const anmelden = (env: Env, ip: string, email: string) =>
  worker.fetch(
    new Request('https://worker.test/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip },
      body: JSON.stringify({ email, frequency: 'weekly', platforms: [], favorites: [] }),
    }),
    env,
    { waitUntil() {} } as unknown as ExecutionContext,
  )

async function ipGrenze() {
  const { env, stand } = umgebung(neueDatenbank())
  mails = 0
  for (let i = 1; i <= 5; i++) pruefe((await anmelden(env, '1.1.1.1', `a${i}@x.test`)).status === 200, `IP: Anmeldung ${i} geht durch`)
  const vorher = stand.geschrieben
  const sechste = await anmelden(env, '1.1.1.1', 'a6@x.test')
  pruefe(sechste.status === 429, 'IP: 6. Anmeldung in einer Stunde -> 429')
  pruefe(sechste.headers.get('Retry-After') === '3600', 'IP: Retry-After = Rest des Fensters (3600 s)')
  pruefe(sechste.headers.get('Access-Control-Allow-Origin') === 'https://anime.example', 'IP: 429 mit CORS-Kopf')
  pruefe(stand.geschrieben - vorher === 0, `IP: abgewiesene Anfrage schreibt 0 Zeilen (gezählt: ${stand.geschrieben - vorher})`)
  pruefe(mails === 5, 'IP: 5 Mails, keine sechste')
  pruefe((await anmelden(env, '2.2.2.2', 'b@x.test')).status === 200, 'IP: andere IP unberührt')

  const spaeter = festeUhr(new Date(START + 61 * 60_000).toISOString())
  pruefe((await anmelden(env, '1.1.1.1', 'a7@x.test')).status === 200, 'IP: nach über einer Stunde wieder frei')
  spaeter()
  festeUhr(new Date(START).toISOString())
}

async function adresseGrenze() {
  const { env, stand } = umgebung(neueDatenbank())
  mails = 0
  const erste = await anmelden(env, '3.3.3.3', 'dopp@x.test')
  const vorher = stand.geschrieben
  const zweite = await anmelden(env, '4.4.4.4', 'dopp@x.test')
  pruefe(mails === 1, 'Adresse: zweite Anmeldung in 15 min schickt keine Mail')
  pruefe(zweite.status === erste.status && (await zweite.text()) === (await erste.clone().text()), 'Adresse: gleiche Antwort wie die erste')
  pruefe(stand.geschrieben - vorher === 1, `Adresse: Treffer schreibt nur den IP-Zähler (gezählt: ${stand.geschrieben - vorher})`)
  festeUhr(new Date(START + 16 * 60_000).toISOString())
  await anmelden(env, '5.5.5.5', 'dopp@x.test')
  pruefe(mails === 2, 'Adresse: nach 16 min wieder eine Mail')
  festeUhr(new Date(START).toISOString())
}

async function tageskappe() {
  const { env, stand } = umgebung(neueDatenbank())
  mails = 0
  for (let i = 1; i <= 30; i++) await anmelden(env, `10.0.${i}.1`, `t${i}@x.test`)
  pruefe(mails === 30, 'Tag: 30 Bestätigungsmails gehen raus')
  const vorher = stand.geschrieben
  const r = await anmelden(env, '10.9.9.9', 't31@x.test')
  pruefe(r.status === 429, 'Tag: 31. Bestätigungsmail -> 429')
  const text = ((await r.json()) as { error: string }).error
  pruefe(/Heute sind keine Anmeldungen mehr möglich/.test(text), 'Tag: kurzer Text für Besucher')
  pruefe(r.headers.get('Retry-After') === '86400', 'Tag: Retry-After = Rest des Tagesfensters')
  pruefe(stand.geschrieben - vorher === 0, `Tag: abgewiesene Anfrage schreibt 0 Zeilen (gezählt: ${stand.geschrieben - vorher})`)
  pruefe(mails === 30, 'Tag: keine 31. Mail')
  // Adresse mit Treffer zählt nicht zur Tageskappe: kein Platz nötig, aber auch die Kappe gilt zuerst.
  pruefe((await anmelden(env, '10.9.9.9', 't1@x.test')).status === 429, 'Tag: Kappe gilt vor dem Adress-Treffer')
}

async function nichtAuskunft() {
  const { env, stand } = umgebung(neueDatenbank())
  mails = 0
  globalThis.fetch = (async () => {
    mails++
    return new Response('x', { status: 500 })
  }) as typeof fetch
  const r = await anmelden(env, '7.7.7.7', 'f@x.test')
  pruefe(r.status === 502, 'Versandfehler: weiter 502 wie bisher')
  const ungueltig = await anmelden(env, '7.7.7.7', 'kaputt')
  const vorher = stand.geschrieben
  pruefe(ungueltig.status === 400, 'ungültige Adresse: 400')
  pruefe(stand.geschrieben === vorher, 'ungültige Adresse: 0 Zeilen')
  globalThis.fetch = (async () => {
    mails++
    return new Response('{}', { status: 200 })
  }) as typeof fetch
}

await ipGrenze()
await adresseGrenze()
await tageskappe()
await nichtAuskunft()
console.log(fehler ? `${fehler} Fehler` : 'Anmelde-Schutz: IP 5/h, Adresse 1/15 min, Tag 30 – alle Fälle ok')
process.exit(fehler ? 1 : 0)
