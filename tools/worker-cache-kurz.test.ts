/**
 * Zusicherungen zu `worker/src/cache-kurz.ts` an einer Attrappe von `caches.default`: Treffer ohne Bauen, nur Status 200 wird gehalten
 * (mit `Cache-Control: public, max-age=<sekunden>`, über `waitUntil`), die frische Antwort bleibt lesbar und ohne den Kopf, Schlüssel ist
 * die Anfrage-Adresse oder der eigene Schlüssel als GET, ohne Kontext wird nichts gehalten; `ausCacheFuer` setzt 1800 s als Vorgabe.
 * Läuft in `check:worker`.
 */
import { ausCacheFuer, ausEdgeCache } from '../worker/src/cache-kurz.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

/** Cache-Attrappe nach Adresse; merkt Abfragen (Methode und Adresse) und gehaltene Antworten. */
const halde = new Map<string, Response>()
const abfragen: string[] = []
const attrappe = {
  default: {
    match: async (r: Request) => {
      abfragen.push(`${r.method} ${r.url}`)
      return halde.get(r.url)?.clone()
    },
    put: async (r: Request, antwort: Response) => void halde.set(r.url, antwort),
  },
}
Object.assign(globalThis, { caches: attrappe })

/** Kontext, dessen `waitUntil` die Zusagen sammelt, damit der Test auf das Halten warten kann. */
function kontext() {
  const zusagen: Promise<unknown>[] = []
  return { ctx: { waitUntil: (p: Promise<unknown>) => void zusagen.push(p), passThroughOnException() {} } as unknown as ExecutionContext, zusagen }
}

const leeren = () => {
  halde.clear()
  abfragen.length = 0
}

async function main() {
  // Fehlschlag, dann Bauen und Halten.
  leeren()
  let gebaut = 0
  const bauen = async () => (gebaut++, new Response('{"n":1}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
  const k = kontext()
  const anfrage = new Request('https://w.example/api/pruefung?stand=1', { method: 'POST' })
  const frisch = await ausEdgeCache(anfrage, k.ctx, 600, bauen)
  await Promise.all(k.zusagen)
  pruefe('frisch: gebaut', gebaut, 1)
  pruefe('frisch: Inhalt lesbar', await frisch.text(), '{"n":1}')
  pruefe('frisch: ohne Cache-Control', frisch.headers.get('Cache-Control'), null)
  pruefe('Schlüssel: Anfrage-Adresse als GET', abfragen, ['GET https://w.example/api/pruefung?stand=1'])
  const gehalten = halde.get('https://w.example/api/pruefung?stand=1')
  pruefe('gehalten mit Frist', gehalten?.headers.get('Cache-Control'), 'public, max-age=600')
  pruefe('gehalten: Kopf der Antwort bleibt', gehalten?.headers.get('Content-Type'), 'application/json')
  pruefe('gehalten: Inhalt', await gehalten?.clone().text(), '{"n":1}')

  // Treffer: kein zweites Bauen.
  const zweit = await ausEdgeCache(anfrage, kontext().ctx, 600, bauen)
  pruefe('Treffer: nicht gebaut', gebaut, 1)
  pruefe('Treffer: Inhalt', await zweit.text(), '{"n":1}')

  // Nur 200 wird gehalten; 203, 404 und 500 gehen ungecacht durch.
  for (const status of [203, 404, 500]) {
    leeren()
    const kk = kontext()
    const r = await ausEdgeCache(new Request('https://w.example/x'), kk.ctx, 60, async () => new Response('nein', { status }))
    await Promise.all(kk.zusagen)
    pruefe(`Status ${status}: durchgereicht`, r.status, status)
    pruefe(`Status ${status}: nicht gehalten`, [halde.size, kk.zusagen.length], [0, 0])
  }

  // Eigener Schlüssel ersetzt die Anfrage-Adresse.
  leeren()
  const ke = kontext()
  await ausEdgeCache(new Request('https://w.example/a?x=1'), ke.ctx, 60, bauen, 'https://w.example/a?wartend=1')
  await Promise.all(ke.zusagen)
  pruefe('eigener Schlüssel', [...halde.keys()], ['https://w.example/a?wartend=1'])

  // Ohne Kontext: Antwort ja, gehalten nicht.
  leeren()
  const ohne = await ausEdgeCache(new Request('https://w.example/b'), undefined, 60, bauen)
  pruefe('ohne Kontext: Antwort', ohne.status, 200)
  pruefe('ohne Kontext: nichts gehalten', halde.size, 0)

  // ausCacheFuer: Vorgabe 1800 s, Frist und Schlüssel werden durchgereicht.
  leeren()
  const kf = kontext()
  const ausCache = ausCacheFuer(new Request('https://w.example/c'), kf.ctx)
  await ausCache(bauen)
  await ausCache(bauen, 90, 'https://w.example/c?teil=1')
  await Promise.all(kf.zusagen)
  pruefe('ausCacheFuer: Vorgabe 1800 s', halde.get('https://w.example/c')?.headers.get('Cache-Control'), 'public, max-age=1800')
  pruefe('ausCacheFuer: eigene Frist und Schlüssel', halde.get('https://w.example/c?teil=1')?.headers.get('Cache-Control'), 'public, max-age=90')

  if (fehler) {
    console.error(`worker-cache-kurz: ${fehler} Fehler`)
    process.exit(1)
  }
  console.log('worker-cache-kurz: ok')
}

void main()
