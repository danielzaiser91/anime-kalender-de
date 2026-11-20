/**
 * Der Browser-Teil von „Push folgt dem Filter“ (20.11.2026), mit dem echten Hook `usePushNachfuehren` und dem echten
 * `push.ts` im Mini-DOM: Fetch-Attrappe, Attrappe-Uhr, Dienst-Adresse gesetzt. Belegt: Filter steht im Körper von `POST /push/abo`,
 * Änderungen gehen gesammelt (2 s) und nur einmal, gleicher Inhalt in neuer Hülle löst nichts aus, ohne Filter fehlt der Schlüssel,
 * das Einschalten schickt den zuletzt gemerkten Filter mit, ohne aktives Abo geht nichts hinaus.
 * Aufruf: `npm run check:logic`.
 */
import { act, createElement as h } from 'react'
import { attrappeUhr, ignoriereCss, installiereMiniDom } from '../tools/mini-dom.ts'
ignoriereCss()
const fensterBasis = { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }
const vorlauf = installiereMiniDom({ setTimeout, clearTimeout, ...fensterBasis } as never, () => ({}))
const { createRoot } = await import('react-dom/client')
vorlauf.entferne()
const { NACHFUEHR_PAUSE_MS, usePushNachfuehren } = await import('../web/src/lib/push-nachfuehren.ts')
const { pushEinschalten, pushWorker } = await import('../web/src/lib/push.ts')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

interface Abruf {
  url: string
  body: { favoriten?: number[]; ak?: number; filter?: unknown; abmelden?: boolean } | null
}
const abrufe: Abruf[] = []
const speicher = new Map<string, string>()
const g = globalThis as Record<string, unknown>
const alt = { fetch: g.fetch, localStorage: g.localStorage, setTimeout: g.setTimeout, clearTimeout: g.clearTimeout, Notification: g.Notification }

const abo = { endpoint: 'https://fcm.googleapis.com/x', toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/x' }) }
const registrierung = { pushManager: { getSubscription: async () => abo, subscribe: async () => abo } }

function Haken(p: { favs: number[]; filter: Record<string, unknown> | null }) {
  usePushNachfuehren(new Set(p.favs), p.filter)
  return null
}

async function lauf(aktiv: boolean, ablauf: (r: { rendere: (favs: number[], filter: Record<string, unknown> | null) => Promise<void>; uhr: ReturnType<typeof attrappeUhr>; weiter: (ms: number) => Promise<void> }) => Promise<void>): Promise<void> {
  abrufe.length = 0
  speicher.clear()
  if (aktiv) speicher.set('pushAbo', '1')
  const uhr = attrappeUhr()
  const dom = installiereMiniDom({ ...fensterBasis, setTimeout: uhr.setTimeout, clearTimeout: uhr.clearTimeout } as never, () => ({}))
  const win = g.window as Record<string, unknown>
  Object.assign(win, { PushManager: {}, Notification: { requestPermission: async () => 'granted' } })
  g.Notification = win.Notification
  Object.assign(g.navigator as object, { serviceWorker: { ready: Promise.resolve(registrierung) } })
  g.localStorage = { getItem: (k: string) => speicher.get(k) ?? null, setItem: (k: string, v: string) => void speicher.set(k, v), removeItem: (k: string) => void speicher.delete(k) }
  g.fetch = async (url: string, init?: { body?: string }) => {
    abrufe.push({ url, body: init?.body ? (JSON.parse(init.body) as Abruf['body']) : null })
    return new Response(url.endsWith('/push/schluessel') ? JSON.stringify({ schluessel: 'AAAA' }) : '{}', { status: 200 })
  }
  g.setTimeout = uhr.setTimeout
  g.clearTimeout = uhr.clearTimeout
  const wurzel = createRoot(dom.wurzel as unknown as Element)
  const rendere = (favs: number[], filter: Record<string, unknown> | null) => act(async () => void wurzel.render(h(Haken, { favs, filter })))
  const weiter = (ms: number) => uhr.schiebe(ms, (f) => act(async () => void f()))
  try {
    await ablauf({ rendere, uhr, weiter })
  } finally {
    await act(async () => wurzel.unmount())
    Object.assign(g, { fetch: alt.fetch, localStorage: alt.localStorage, setTimeout: alt.setTimeout, clearTimeout: alt.clearTimeout, Notification: alt.Notification })
    dom.entferne()
  }
}

pushWorker.adresse = 'https://dienst.test'
const TV = { tvAus: true }
const TV_DISC = { tvAus: true, xReleaseTypes: ['disc'] }
const posts = () => abrufe.filter((a) => a.url === 'https://dienst.test/push/abo')

console.log('\nFilter geht mit dem Abo hinaus')
await lauf(true, async ({ rendere, weiter }) => {
  await rendere([1, 2], TV)
  await weiter(NACHFUEHR_PAUSE_MS - 1)
  pruefe('vor Ablauf der Pause nichts gesendet', posts().length === 0, posts().length)
  await weiter(1)
  pruefe('nach der Pause genau ein Abruf an /push/abo', posts().length === 1, posts().length)
  pruefe('Körper: Favoriten, ak und Filter', JSON.stringify(posts()[0]?.body) === JSON.stringify({ subscription: { endpoint: 'https://fcm.googleapis.com/x' }, favoriten: [1, 2], ak: 1, filter: TV }), posts()[0]?.body)
  await rendere([1, 2], { ...TV })
  await weiter(NACHFUEHR_PAUSE_MS * 2)
  pruefe('gleicher Inhalt in neuer Hülle sendet nicht noch einmal', posts().length === 1, posts().length)
  await rendere([1, 2], TV_DISC)
  await weiter(NACHFUEHR_PAUSE_MS)
  pruefe('geänderter Filter geht hinaus', posts().length === 2 && JSON.stringify(posts()[1]?.body?.filter) === JSON.stringify(TV_DISC), posts().length)
  await rendere([1, 2], null)
  await weiter(NACHFUEHR_PAUSE_MS)
  pruefe('Filter aufgehoben: Körper ohne Schlüssel `filter`', posts().length === 3 && !('filter' in (posts()[2]!.body ?? {})), posts()[2]?.body)
})

console.log('\nÄnderungen werden gesammelt')
await lauf(true, async ({ rendere, weiter }) => {
  await rendere([1], TV)
  await weiter(NACHFUEHR_PAUSE_MS - 500)
  await rendere([1, 5], TV_DISC)
  await weiter(NACHFUEHR_PAUSE_MS - 1)
  pruefe('die Pause beginnt bei jeder Änderung neu', posts().length === 0, posts().length)
  await weiter(1)
  pruefe('ein Abruf mit dem letzten Stand', posts().length === 1 && JSON.stringify(posts()[0]?.body?.favoriten) === '[1,5]' && JSON.stringify(posts()[0]?.body?.filter) === JSON.stringify(TV_DISC), posts())
})

console.log('\nKein aktives Abo')
await lauf(false, async ({ rendere, weiter }) => {
  await rendere([1], TV)
  await weiter(NACHFUEHR_PAUSE_MS * 2)
  pruefe('nichts gesendet', abrufe.length === 0, abrufe.length)
})

console.log('\nEinschalten schickt den gemerkten Filter mit')
await lauf(false, async ({ rendere }) => {
  await rendere([7], TV_DISC)
  await pushEinschalten([7])
  const post = posts()[0]
  pruefe('ein Abruf, Filter des Kalenders im Körper', posts().length === 1 && JSON.stringify(post?.body?.filter) === JSON.stringify(TV_DISC) && JSON.stringify(post?.body?.favoriten) === '[7]', post?.body)
})
await lauf(false, async ({ rendere }) => {
  await rendere([7], null)
  await pushEinschalten([7])
  pruefe('ohne Filter: kein Schlüssel `filter`', posts().length === 1 && !('filter' in (posts()[0]!.body ?? {})), posts()[0]?.body)
})

console.log(verletzt ? `\nPush-Filter im Browser: ${verletzt} Prüfung(en) fehlgeschlagen.` : '\nPush-Filter im Browser: Körper, Sammeln, Einschalten halten.')
process.exit(verletzt ? 1 : 0)
