/**
 * Zusicherungen zu `lib/lauf-fortschritt.ts` gegen eine fetch-Attrappe (kein Netz): ohne Token/Lauf-ID still, höchstens eine Meldung
 * je Sekunde, zu frühe Meldungen werden gestapelt (nur der jüngste Stand geht nach), ein Fehler beim Senden bricht nichts ab.
 * Läuft in `check:logic`.
 */
let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}
const warte = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Gesendet = { url: string; token: string | null; body: Record<string, unknown> }
const gesendet: Gesendet[] = []
let antwortStatus = 200
let werfen = false
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  if (werfen) throw new Error('Attrappe: nicht erreichbar')
  gesendet.push({ url: String(url), token: new Headers(init?.headers).get('X-Lauf-Token'), body: JSON.parse(String(init?.body)) })
  return new Response('', { status: antwortStatus })
}) as typeof fetch

for (const k of ['LAUF_TOKEN', 'GITHUB_RUN_ID', 'GITHUB_REPOSITORY', 'GITHUB_WORKFLOW', 'LAUF_AUFTRAG']) delete process.env[k]
process.env.LAUF_WORKER = 'https://attrappe.invalid'
// Der Worker steht beim Laden des Moduls fest: erst Umgebung, dann Import.
const { fortschrittsMelder } = await import('./lib/lauf-fortschritt.ts')

fortschrittsMelder(10)(1, 'lokal')
await warte(50)
pruefe('ohne Token und Lauf-ID: nichts gesendet', gesendet.length, 0)

process.env.LAUF_TOKEN = 'attrappe-token'
fortschrittsMelder(10)(1)
await warte(50)
pruefe('ohne Lauf-ID: nichts gesendet', gesendet.length, 0)

process.env.GITHUB_RUN_ID = '42'
process.env.GITHUB_REPOSITORY = 'besitzer/repo'
process.env.GITHUB_WORKFLOW = 'Abruf'
const melde = fortschrittsMelder(594)
melde(1, 'erste')
melde(2, 'zweite')
melde(3, 'dritte')
await warte(50)
pruefe('erste Meldung sofort, Adresse und Token', gesendet.map((g) => [g.url, g.token]), [['https://attrappe.invalid/lauf', 'attrappe-token']])
pruefe('Inhalt der ersten Meldung', gesendet[0]?.body, {
  lauf_id: '42',
  repo: 'besitzer/repo',
  workflow: 'Abruf',
  zustand: 'laeuft',
  fortschritt: 1,
  fortschritt_gesamt: 594,
  fortschritt_text: 'erste',
})
await warte(1500)
pruefe('nach einer Sekunde nur der jüngste gestapelte Stand', gesendet.map((g) => g.body.fortschritt), [1, 3])
melde(4)
await warte(50)
pruefe('noch zu früh: wartet', gesendet.length, 2)
await warte(1500)
pruefe('nachgeholt, ohne Text', [gesendet.length, gesendet[2]?.body.fortschritt, 'fortschritt_text' in (gesendet[2]?.body ?? {})], [3, 4, false])

process.env.LAUF_AUFTRAG = 'reparatur'
const ohneGesamt = fortschrittsMelder()
ohneGesamt(7, 'Seite x')
await warte(50)
pruefe('ohne Gesamtzahl, mit Auftrag', [gesendet[3]?.body.fortschritt_gesamt, gesendet[3]?.body.auftrag], [undefined, 'reparatur'])

antwortStatus = 500
const abgelehnt = fortschrittsMelder(5)
abgelehnt(1)
await warte(50)
pruefe('abgelehnte Meldung wirft nicht', gesendet.length, 5)

werfen = true
const kaputt = fortschrittsMelder(5)
kaputt(1)
await warte(1500)
kaputt(2)
await warte(50)
pruefe('unzustellbar: Lauf geht weiter, nichts gesendet', gesendet.length, 5)

if (fehler) process.exit(1)
console.log('check-lauf-fortschritt: ok')
