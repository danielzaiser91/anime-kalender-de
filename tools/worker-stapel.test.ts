/**
 * **Ein Meldungsstapel wirft nie und bestätigt jede Meldung einzeln** (10.10.2026).
 *
 * Der Worker speicherte am 10.10.2026 einen 10er-Stapel vollständig und warf danach eine
 * ungefangene Ausnahme; die Erweiterung sah nur „Failed to fetch". Geprüft wird gegen Attrappen,
 * die beide Kandidaten nachbilden: R2 wirft bei einem zweiten Schreibzugriff auf denselben
 * Schlüssel innerhalb einer Sekunde, und jeder Aufruf darf höchstens 50 Subrequests (D1, R2,
 * Durable Object) machen. Nie gegen den echten Briefkasten.
 *
 * Aufruf: `npx tsx tools/worker-stapel.test.ts`
 */
import { handlePruefung } from '../worker/src/pruefung.ts'
import { verarbeiteStapel, ANFRAGEN_BUDGET } from '../worker/src/pruefung-stapel.ts'
import { kurzeMeldung, fehlerLog } from '../worker/src/werte.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}

const protokoll: string[] = []
console.error = (...a: unknown[]) => void protokoll.push(a.join(' '))
console.warn = console.error

/** R2 mit dem Limit „ein Schreibzugriff je Sekunde und Schlüssel"; `immer` lässt jeden scheitern. */
function r2Attrappe(immer = false) {
  const zuletzt = new Map<string, number>()
  const stand = { puts: 0 }
  return {
    stand,
    r2: {
      async put(schluessel: string) {
        stand.puts++
        const vorher = zuletzt.get(schluessel)
        zuletzt.set(schluessel, Date.now())
        if (immer || (vorher !== undefined && Date.now() - vorher < 1000)) throw new Error('429 Too Many Requests')
      },
    },
  }
}

/** Eine Umgebung je Aufruf: Die Subrequest-Zählung gilt je Aufruf, das R2 teilen sich alle. */
function umgebung(r2: unknown) {
  let anfragen = 0
  const zaehle = () => {
    if (++anfragen > 50) throw new Error('Too many subrequests')
  }
  const statement = (sql: string) => ({
    bind: (...werte: unknown[]) => ({
      all: async () => {
        zaehle()
        return { results: [] }
      },
      run: async () => {
        zaehle()
        if (werte.some((w) => String(w).includes('kaputt'))) throw new Error('D1 defekt https://www.netflix.com/title/1')
        return { meta: { changes: 1 } }
      },
    }),
    sql,
  })
  const env = {
    LAUF_TOKEN: 't',
    DB: {
      prepare: statement,
      batch: async () => {
        zaehle()
        return []
      },
    },
    BELEGE: {
      put: async (...a: unknown[]) => {
        zaehle()
        return (r2 as { put: (...a: unknown[]) => Promise<void> }).put(...a)
      },
    },
    EREIGNISSE: {
      idFromName: () => 'x',
      get: () => ({
        fetch: async () => {
          zaehle()
          return new Response('ok')
        },
      }),
    },
  }
  const warten: Promise<unknown>[] = []
  const ctx = { waitUntil: (p: Promise<unknown>) => void warten.push(p) }
  return { env: env as never, ctx: ctx as never, warten, anfragen: () => anfragen }
}

const meldung = (nr: number, url = `https://www.netflix.com/title/${nr}`) => ({
  plattform: 'netflix',
  url,
  befund: 'dub',
  folge_nr: nr,
  titelId: 1,
  rohfolgen: [{ gti: `g${nr}`, nummer: nr }],
})
const post = (stapel: unknown[]) =>
  new Request('https://worker.test/pruefung', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': 't' },
    body: JSON.stringify({ stapel }),
  })

/* Die Marke wird je Isolate höchstens alle 60 s geschrieben (export-speicher.ts): Jeder Aufruf bekommt seine eigene Minute. */
let uhr = Date.parse('2026-10-12T00:00:00Z')
Date.now = () => uhr

async function sende(stapel: unknown[], r2: unknown) {
  uhr += 61_000
  const u = umgebung(r2)
  const r = await handlePruefung(post(stapel), u.env, u.ctx)
  await Promise.all(u.warten)
  return { r, inhalt: (await r.json()) as { ok?: boolean; error?: string; ergebnisse?: { ok: boolean; status?: number; grund?: string }[] } }
}

console.log('Worker-Stapel')
const nummern = (n: number, ab = 1) => Array.from({ length: n }, (_, i) => meldung(ab + i))

{
  const { r2, stand } = r2Attrappe()
  const { r, inhalt } = await sende(nummern(10), r2)
  pruefe(r.status === 200 && inhalt.ergebnisse?.length === 10, '10er-Stapel: Antwort 200 mit zehn Ergebnissen')
  pruefe(inhalt.ergebnisse?.every((e) => e.ok) === true, '10er-Stapel: jede Meldung bestätigt')
  pruefe(stand.puts === 1, `Marke einmal geschrieben (${stand.puts})`)
}
{
  const { r2 } = r2Attrappe()
  const [a, b] = await Promise.all([sende(nummern(10), r2), sende(nummern(5, 11), r2)])
  pruefe(a.r.status === 200 && b.r.status === 200, '10 + 5 gleichzeitig: beide Antworten 200 trotz R2-Limit auf der Marke')
  pruefe(
    (a.inhalt.ergebnisse ?? []).concat(b.inhalt.ergebnisse ?? []).filter((e) => e.ok).length === 15,
    '10 + 5 gleichzeitig: alle 15 Meldungen bestätigt',
  )
}
{
  const { r2 } = r2Attrappe(true)
  const { r, inhalt } = await sende([meldung(1)], r2)
  pruefe(r.status === 200 && inhalt.ergebnisse?.[0]?.ok === true, 'Marke nicht schreibbar: Meldung trotzdem bestätigt')
}
{
  const { r2 } = r2Attrappe()
  const stapel = [meldung(1), meldung(2, 'https://www.netflix.com/title/80000002?x=kaputt'), meldung(3)]
  protokoll.length = 0
  const { r, inhalt } = await sende(stapel, r2)
  const ok = inhalt.ergebnisse?.map((e) => e.ok)
  pruefe(r.status === 200 && JSON.stringify(ok) === '[true,false,true]', `Eine kaputte Meldung: Antwort 200, nur sie fehlt (${JSON.stringify(ok)})`)
  pruefe(inhalt.ergebnisse?.[1]?.status === 500, 'Die kaputte Meldung trägt Status 500')
  pruefe(inhalt.ergebnisse?.[1]?.grund === 'ausnahme Error', `Die kaputte Meldung nennt ihren Grund (${inhalt.ergebnisse?.[1]?.grund})`)
  const zeile = protokoll.find((z) => z.includes('"meldung_abgelehnt"') && z.includes('80000002'))
  pruefe(!!zeile && zeile.includes('"plattform":"netflix"') && zeile.includes('D1 defekt'), 'Protokoll: Route, Plattform, Kennung und Fehlertext der Ausnahme')
  pruefe(!protokoll.some((z) => z.includes('netflix.com') || z.includes('kaputt') || z.includes('"t"')), 'Protokoll nennt weder Adresse, Suchteil noch Token')
}
{
  const { r2 } = r2Attrappe()
  protokoll.length = 0
  const falsch = { ...meldung(7, 'https://www.netflix.com/title/80057171'), vorhanden: 'ja', ton_de: 'unbekannt' }
  const { r, inhalt } = await sende([falsch, meldung(8)], r2)
  const [a, b] = inhalt.ergebnisse ?? []
  pruefe(r.status === 200 && a?.ok === false && a.status === 400 && /ton_de/.test(a.grund ?? ''), `Ablehnung 400 trägt den Grund (${a?.grund})`)
  pruefe(b?.ok === true, 'Die gültige Nachbarmeldung wird gespeichert')
  pruefe(protokoll.some((z) => z.includes('80057171') && z.includes('"status":400') && z.includes('pruefung/stapel')), 'Protokoll: 400 mit Kennung und Route')
}
{
  const { r2 } = r2Attrappe()
  protokoll.length = 0
  const u = umgebung(r2)
  const einzel = new Request('https://worker.test/pruefung', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': 't' },
    body: JSON.stringify({ plattform: 'netflix', url: 'https://www.netflix.com/title/80057171', vorhanden: 'vielleicht' }),
  })
  const r = await handlePruefung(einzel, u.env, u.ctx)
  const inhalt = (await r.json()) as { error?: string }
  pruefe(r.status === 400 && !!inhalt.error, 'Einzelmeldung abgelehnt: 400 mit Fehlertext')
  pruefe(protokoll.some((z) => z.includes('80057171') && z.includes('vorhanden muss ja oder nein sein')), 'Protokoll: Einzelmeldung mit Kennung und Grund')
  const wirft = new Request('https://worker.test/pruefung', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': 't' },
    body: JSON.stringify({ plattform: 'netflix', url: 'https://www.netflix.com/title/80057171?kaputt', befund: 'dub' }),
  })
  const r500 = await handlePruefung(wirft, u.env, u.ctx)
  const i500 = (await r500.json()) as { grund?: string; error?: string }
  pruefe(r500.status === 500 && i500.grund === 'ausnahme Error' && i500.error === i500.grund && r500.headers.get('Access-Control-Allow-Origin') === '*', 'Ausnahme bei Einzelmeldung: 500 mit Grund und CORS statt Cloudflare-Fehlerseite')
  const falschesToken = new Request('https://worker.test/pruefung', { method: 'POST', headers: { 'X-Lauf-Token': 'x' }, body: '{}' })
  protokoll.length = 0
  const r403 = await handlePruefung(falschesToken, u.env, u.ctx)
  pruefe(r403.status === 403 && protokoll.some((z) => z.includes('"status":403')) && !protokoll.some((z) => z.includes('"x"')), 'Falsches Token: 403, im Protokoll ohne Token')
}
{
  const { r2 } = r2Attrappe()
  const { r, inhalt } = await sende(nummern(15), r2)
  pruefe(r.status === 400 && !!inhalt.error, '15 in einer Anfrage: saubere Antwort 400 statt Ausnahme')
}
{
  const aufgerufen: unknown[] = []
  const stapel = Array.from({ length: 12 }, (_, i) => meldung(i + 1))
  const erg = await verarbeiteStapel(stapel, async (m) => (aufgerufen.push(m), { ok: true, befund: null }))
  const erlaubt = Math.floor(ANFRAGEN_BUDGET / 4)
  pruefe(aufgerufen.length === erlaubt && erg.slice(erlaubt).every((e) => !e.ok), `Über dem Budget: nur ${erlaubt} von 12 angefasst, der Rest nicht bestätigt`)
}

{
  const roh = new Error('Brevo 400: Adresse max.mustermann@example.com ungültig, endpoint https://fcm.googleapis.com/fcm/send/abc, Token ' + 'A'.repeat(40))
  const sauber = kurzeMeldung(roh)
  pruefe(!/@|https?:|AAAA/.test(sauber), `Logtext ohne Mailadresse, Adresse und Token (${sauber})`)
  protokoll.length = 0
  fehlerLog('Versand fehlgeschlagen', roh)
  pruefe(protokoll.length === 1 && protokoll[0].startsWith('Versand fehlgeschlagen: Error') && !protokoll[0].includes('mustermann'), 'fehlerLog schreibt Fehlerklasse statt Fehlerobjekt')
}

process.exit(fehler ? 1 : 0)
