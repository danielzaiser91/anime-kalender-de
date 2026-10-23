/**
 * Web-Push: Hinweis „Plätze vergeben“ (B4, 23.10.2026). Der Worker antwortet bei voller Tabelle mit 507 und `code: push_voll`;
 * `pushEinschalten` zeigt dann den eigenen Satz, bei anderen Fehlern den allgemeinen, bei 503 den Ausfallsatz.
 *
 * Aufruf: `npx tsx tools/web-push-voll.test.ts`
 */
import { DIENST_PAUSE } from '../shared/dienst-pause.ts'
import { pushEinschalten } from '../web/src/lib/push.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}

const g = globalThis as Record<string, unknown>
const abo = { toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/x' }) }
g.Notification = { requestPermission: async () => 'granted' }
g.localStorage = { setItem: () => undefined, getItem: () => null, removeItem: () => undefined }
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { serviceWorker: { ready: Promise.resolve({ pushManager: { getSubscription: async () => abo } }) } },
})

/** Beantwortet `/push/schluessel` gültig und `/push/abo` mit dem übergebenen Status und Rumpf. */
function worker(status: number, rumpf: string) {
  g.fetch = async (url: string) =>
    url.endsWith('/push/schluessel')
      ? new Response(JSON.stringify({ schluessel: 'AAAA' }), { status: 200 })
      : new Response(rumpf, { status })
}

async function meldung(status: number, rumpf: string): Promise<string | null> {
  worker(status, rumpf)
  try {
    await pushEinschalten([1])
    return null
  } catch (e) {
    return (e as Error).message
  }
}

const VOLL = JSON.stringify({ error: 'x', code: 'push_voll' })

async function main() {
  const voll = await meldung(507, VOLL)
  pruefe(voll !== null && voll.startsWith('Alle Plätze für Benachrichtigungen sind gerade vergeben'), '507 + push_voll: eigener Hinweis')
  pruefe((await meldung(200, '{"ok":true}')) === null, '200: kein Fehler')
  pruefe((await meldung(507, JSON.stringify({ code: 'anders' }))) === 'Der Dienst hat das Abo nicht angenommen.', '507 mit anderem Code: allgemeiner Satz')
  pruefe((await meldung(507, 'kein json')) === 'Der Dienst hat das Abo nicht angenommen.', '507 ohne JSON: allgemeiner Satz')
  pruefe((await meldung(500, VOLL)) === 'Der Dienst hat das Abo nicht angenommen.', '500 mit push_voll: allgemeiner Satz (Status zählt)')
  pruefe((await meldung(400, VOLL)) === 'Der Dienst hat das Abo nicht angenommen.', '400 mit push_voll: allgemeiner Satz (Status zählt)')
  pruefe((await meldung(503, VOLL)) === DIENST_PAUSE, '503 (Ausfall, auch mit push_voll): Ausfallsatz, nie der Platz-Hinweis')
  if (fehler > 0) {
    console.error(`\n${fehler} Zusicherung(en) verletzt.`)
    process.exit(1)
  }
  console.log('\nWeb-Push voll: alle Zusicherungen halten.')
}

void main()
