/**
 * **Der Push folgt dem Filter des Kalenders** (20.11.2026, Daniel: TV ausgeblendet, trotzdem Push zu einer TV-Wiederholung).
 * Je Fall ein Abo, dessen Favoriten-Spalte den Filter trägt (geschrieben über `schreibeFavoriten`, der Weg von `POST /push/abo`),
 * ein Lauf von `pushVersand` mit allen Terminen aus `tools/push-filter-faelle.ts`; der Push-Text nennt die gemeldeten Termine.
 * Dazu: Abo ohne Filter-Teil, unlesbarer Filter-Teil, Bündel mit gemischten Terminen, `POST /push/abo` bis in die Spalte.
 *
 * Aufruf: `npx tsx tools/worker-push-filter.test.ts`
 */
import type { DatabaseSync } from 'node:sqlite'
import { pushVersand } from '../worker/src/push.ts'
import { schreibeFavoriten } from '../worker/src/favoriten-kennung.ts'
import { handlePushAbo } from '../worker/src/push-abo.ts'
import type { PushEreignis } from '../worker/src/push-text.ts'
import { schreibeTerminFilter } from '../shared/push-filter.ts'
import { EREIGNISSE, FAELLE, TAG } from './push-filter-faelle.ts'
import { fetchAttrappe, neueDatenbank, testEnv } from './worker-unteraufrufe-attrappe.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
console.error = () => {}

const FOLGE = new Date(`${TAG}T08:00:00Z`)
const JETZT = new Date(`${TAG}T10:00:00Z`)
const VORHER = `${TAG}T07:30:00.000Z`
const istErschienen = (_e: PushEreignis, zeit: Date) => zeit.getTime() >= FOLGE.getTime()

/** Die Termine, wie der Bau sie liefert: `tvPremiere` bei den Terminen mit Folgennummer (Wiederholung false, Premiere true). */
const TERMINE: PushEreignis[] = EREIGNISSE.map((e) => ({ ...e, ...(e.titleId === 1 && { tvPremiere: false }), ...(e.titleId === 2 && { tvPremiere: true }) }))
const ALLE_FAVORITEN = [1, 2, 3, 4, 5, 6]

const abrufe: string[] = []
async function umgebung(db: DatabaseSync) {
  fetchAttrappe(TAG)
  const basis = globalThis.fetch
  globalThis.fetch = (async (e: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof e === 'string' ? e : e instanceof URL ? e.href : e.url
    if (!url.startsWith('https://fcm.googleapis.com/')) return basis(e, init)
    abrufe.push(url)
    return new Response('', { status: 201 })
  }) as typeof fetch
  const schluessel = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
  const privat = JSON.stringify(await crypto.subtle.exportKey('jwk', schluessel.privateKey))
  return { ...testEnv(db, 7), VAPID_PRIVATE_JWK: privat, VAPID_PUBLIC: 'oeffentlich' }
}

/** Ein Abo mit dem Text der Favoriten-Spalte, Marke vor dem Ereignis. */
function einAbo(db: DatabaseSync, favoriten: string): void {
  db.exec('DELETE FROM push_abo')
  db.prepare('INSERT INTO push_abo (endpoint, favoriten, erstellt, zuletzt, gemeldet) VALUES (?1, ?2, ?3, ?4, ?5)').run('https://fcm.googleapis.com/abo', favoriten, '2026-10-01', VORHER, '')
  db.prepare('INSERT OR REPLACE INTO push_marke (id, zuletzt, gemeldet) VALUES (1, ?1, ?2)').run(VORHER, '')
  abrufe.length = 0
}

/** Welche Titel der Push dieses Abos nennt (aus dem gespeicherten Text) und ob er überhaupt abgerufen wurde. */
async function meldungVon(db: DatabaseSync, env: Awaited<ReturnType<typeof umgebung>>, favoriten: string): Promise<{ gesendet: boolean; anzahl: number; namen: string[] }> {
  einAbo(db, favoriten)
  await pushVersand(env, JETZT, TERMINE, istErschienen)
  const offen = (db.prepare('SELECT offen FROM push_abo').get() as { offen: string | null }).offen
  if (!abrufe.length || !offen) return { gesendet: abrufe.length > 0, anzahl: 0, namen: [] }
  const name = (teil: string) => teil.split(' – ')[0]!
  const einzeln = /^Jetzt auf Deutsch: (.*)$/.exec(offen)
  if (einzeln) return { gesendet: true, anzahl: 1, namen: [name(einzeln[1]!)] }
  const buendel = /^(\d+) neue Folgen: (.*)$/.exec(offen)
  return { gesendet: true, anzahl: Number(buendel?.[1]), namen: (buendel?.[2] ?? '').split(' · ').map(name) }
}

const db = neueDatenbank()
const env = await umgebung(db)

console.log('Je Fall: nur sichtbare Termine werden gemeldet')
for (const fall of FAELLE) {
  const wert = fall.filter ? schreibeTerminFilter(fall.filter) : null
  const m = await meldungVon(db, env, schreibeFavoriten(ALLE_FAVORITEN, 1, wert))
  pruefe(m.anzahl === fall.sichtbar.length, `${fall.name}: ${fall.sichtbar.length} gemeldet (${m.anzahl})`)
  if (fall.sichtbar.length <= 3) pruefe(m.namen.map((n) => n.slice(1)).sort().join() === [...fall.sichtbar].sort().join(), `${fall.name}: Titel ${fall.sichtbar.join(',')} (${m.namen.join(',')})`)
}

console.log('Anlass: Wiederholung bei „TV aus“ meldet nichts, derselbe Titel auf Netflix schon')
const tvAus = schreibeTerminFilter({ ...FAELLE[1]!.filter! })
const nurWdh = await meldungVon(db, env, schreibeFavoriten([1], 1, tvAus))
pruefe(!nurWdh.gesendet, 'nur die TV-Wiederholung favorisiert, TV aus: kein Push abgerufen')
const ohneFilter = await meldungVon(db, env, schreibeFavoriten([1], 1, null))
pruefe(ohneFilter.gesendet && ohneFilter.namen[0] === 'T1', 'Kontrolle: dasselbe Abo ohne Filter bekommt den Push')
const premiere = await meldungVon(db, env, schreibeFavoriten([2], 1, tvAus))
pruefe(premiere.gesendet && premiere.namen[0] === 'T2', 'TV aus, aber die Premiere ist favorisiert: Push')

console.log('Alte Zeilen und Müll im Filter-Teil: alles wie bisher melden')
for (const [name, text] of [
  ['Zeile ohne Filter-Teil (vor dem 20.11.2026)', 'ak:1,2,3,4,5,6'],
  ['unlesbarer Filter-Teil', 'ak:1,2,3,4,5,6,~%%%'],
  ['unbekannter Schlüssel', 'ak:1,2,3,4,5,6,~tvaus=1'],
  ['Zeile ohne Vorsatz', '1,2,3,4,5,6,~xPlatforms=Netflix'],
] as const) {
  const m = await meldungVon(db, env, text)
  pruefe(m.anzahl === 6, `${name}: alle 6 (${m.anzahl})`)
}

console.log('POST /push/abo schreibt den Filter in die Spalte')
const antwort = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const buche = async () => true
async function anmelden(filter: unknown): Promise<string> {
  const request = new Request('https://x.test/push/abo', {
    method: 'POST',
    body: JSON.stringify({ subscription: { endpoint: 'https://fcm.googleapis.com/neu' }, favoriten: [1, 2], ak: 1, filter }),
  })
  const res = await handlePushAbo(request, env, buche, antwort)
  pruefe(res.status === 200, `Anmeldung angenommen (${res.status})`)
  return (db.prepare("SELECT favoriten FROM push_abo WHERE endpoint = 'https://fcm.googleapis.com/neu'").get() as { favoriten: string }).favoriten
}
pruefe((await anmelden({ tvAus: true })) === 'ak:1,2,~tvAus=1', 'Filter tvAus landet hinter den Kennungen')
pruefe((await anmelden({ tvAus: true, xReleaseTypes: ['disc'] })) === 'ak:1,2,~tvAus=1&xReleaseTypes=disc', 'zweiter Aufruf ersetzt den Filter (Upsert)')
pruefe((await anmelden(undefined)) === 'ak:1,2', 'ohne Filter: Filter-Teil verschwindet wieder')
pruefe((await anmelden({ xPlatforms: ['Netflix!'] })) === 'ak:1,2', 'ungültiger Filter wird nicht gespeichert')
pruefe((await anmelden('tvAus')) === 'ak:1,2', 'Zeichenkette statt Objekt wird nicht gespeichert')

console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen.` : '\nPush-Filter im Versand: alle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
