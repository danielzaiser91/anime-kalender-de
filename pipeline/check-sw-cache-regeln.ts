/**
 * Cache-Regeln des Service Workers (23.10.2026): Feste Adressen ohne Hash (/icons/, /og/) dürfen nie
 * cache-first bedient werden, sonst bleibt ein altes Logo für immer. Zwei Teile:
 *  1. Syntaxbaum von `public/sw.js`: `cacheFirst` wird nur unter `/assets/` oder für Cover-Hosts gerufen.
 *  2. Laufzeit: der echte Worker läuft in einer Kulisse; Icons kommen aus dem Cache und werden aufgefrischt.
 * Aufruf: `npx tsx pipeline/check-sw-cache-regeln.ts [pfad/zu/sw.js]`. Läuft in `check:logic`.
 */
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const ERLAUBTE_TEXTE = new Set(['/assets/', 'image'])

function stringsIn(knoten: ts.Node): string[] {
  const treffer: string[] = []
  const gehe = (n: ts.Node): void => {
    if (ts.isStringLiteralLike(n)) treffer.push(n.text)
    ts.forEachChild(n, gehe)
  }
  gehe(knoten)
  return treffer
}

function hatOder(knoten: ts.Node): boolean {
  let gefunden = false
  const gehe = (n: ts.Node): void => {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.BarBarToken) gefunden = true
    ts.forEachChild(n, gehe)
  }
  gehe(knoten)
  return gefunden
}

function aufrufe(n: ts.Node, ziel: string): ts.CallExpression[] {
  const liste: ts.CallExpression[] = []
  const gehe = (k: ts.Node): void => {
    if (ts.isCallExpression(k) && ts.isIdentifier(k.expression) && k.expression.text === ziel) liste.push(k)
    ts.forEachChild(k, gehe)
  }
  gehe(n)
  return liste
}

/** Nächste umschließende `if`-Bedingung eines Aufrufs, in deren `then`-Zweig er steht. */
function bedingung(aufruf: ts.Node): ts.Expression | undefined {
  for (let k: ts.Node | undefined = aufruf.parent; k; k = k.parent) {
    if (ts.isIfStatement(k) && !(k.elseStatement && liegtIn(aufruf, k.elseStatement))) return k.expression
  }
  return undefined
}

function liegtIn(n: ts.Node, vorfahr: ts.Node): boolean {
  return n.pos >= vorfahr.pos && n.end <= vorfahr.end
}

export function pruefeCacheFirst(quelltext: string): string[] {
  const fehler: string[] = []
  const baum = ts.createSourceFile('sw.js', quelltext, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS)
  const alle: ts.Identifier[] = []
  const sammle = (n: ts.Node): void => {
    if (ts.isIdentifier(n) && n.text === 'cacheFirst') alle.push(n)
    ts.forEachChild(n, sammle)
  }
  sammle(baum)
  const aufrufe_ = aufrufe(baum, 'cacheFirst')
  for (const id of alle) {
    const istAufruf = aufrufe_.some((a) => a.expression === id)
    const istDeklaration = ts.isFunctionDeclaration(id.parent) && id.parent.name === id
    if (!istAufruf && !istDeklaration) fehler.push(`cacheFirst wird anders als per Aufruf benutzt (Zeichen ${id.pos})`)
  }
  for (const a of aufrufe_) {
    const b = ts.isIdentifier(a.expression) ? bedingung(a) : undefined
    const texte = b ? stringsIn(b) : []
    const coverHost = b ? aufrufe(b, 'isCoverHost').length > 0 : false
    const assets = texte.includes('/assets/')
    if (!b || hatOder(b) || texte.some((t) => !ERLAUBTE_TEXTE.has(t)) || !(assets || coverHost)) {
      fehler.push(`cacheFirst nur für /assets/ oder Cover-Hosts erlaubt (Zeichen ${a.pos}, Bedingung: ${b?.getText() ?? 'keine'})`)
    }
  }
  if (aufrufe_.length === 0) fehler.push('kein cacheFirst-Aufruf gefunden: Prüfung greift ins Leere')
  return fehler
}

type Kulisse = { gerufen: string[]; modi: (string | undefined)[]; speicher: Map<string, Map<string, string>> }

function baueKulisse(quelltext: string, netz: (url: string) => string | null) {
  const speicher = new Map<string, Map<string, string>>()
  const gerufen: string[] = []
  const modi: (string | undefined)[] = []
  const handler = new Map<string, (e: unknown) => void>()
  const schluessel = (x: string | { url: string }) => (typeof x === 'string' ? x : x.url)
  const cacheVon = (name: string) => {
    if (!speicher.has(name)) speicher.set(name, new Map())
    const m = speicher.get(name)!
    return {
      match: async (r: string | { url: string }) => (m.has(schluessel(r)) ? new Response(m.get(schluessel(r))) : undefined),
      put: async (r: string | { url: string }, res: Response) => void m.set(schluessel(r), await res.text()),
      keys: async () => [...m.keys()].map((url) => ({ url })),
      delete: async (r: { url: string }) => m.delete(schluessel(r)),
      add: async () => undefined,
      addAll: async () => undefined,
    }
  }
  const sandbox = {
    self: {
      addEventListener: (typ: string, fn: (e: unknown) => void) => handler.set(typ, fn),
      location: new URL('https://ak.test/'),
      skipWaiting: async () => undefined,
      clients: { claim: async () => undefined },
    },
    caches: {
      open: async (n: string) => cacheVon(n),
      keys: async () => [...speicher.keys()],
      delete: async (n: string) => speicher.delete(n),
    },
    fetch: async (r: string | { url: string }, init?: { cache?: string }) => {
      const url = schluessel(r)
      gerufen.push(url)
      modi.push(init?.cache)
      const text = netz(url)
      if (text === null) throw new Error('offline')
      return new Response(text)
    },
    URL,
    Response,
    Promise,
    setTimeout,
    clearTimeout,
    console,
  }
  vm.runInNewContext(quelltext, sandbox)
  const kulisse: Kulisse = { gerufen, modi, speicher }
  return { handler, kulisse }
}

async function holeAntwort(handler: Map<string, (e: unknown) => void>, url: string, destination = '') {
  let antwort: Promise<Response> | undefined
  const warten: Promise<unknown>[] = []
  const event = {
    request: { method: 'GET', url, mode: 'no-cors', destination },
    respondWith: (p: Promise<Response>) => void (antwort = p),
    waitUntil: (p: Promise<unknown>) => void warten.push(p),
  }
  handler.get('fetch')!(event)
  const text = antwort ? await (await antwort).text() : '(nicht beantwortet)'
  await Promise.all(warten)
  return text
}

async function pruefeLaufzeit(quelltext: string): Promise<string[]> {
  const fehler: string[] = []
  const soll = (name: string, ist: unknown, erwartet: unknown) => {
    if (ist !== erwartet) fehler.push(`${name}: ${String(ist)}, erwartet ${String(erwartet)}`)
  }
  for (const pfad of ['/icons/icon.svg', '/og/start.png']) {
    const url = `https://ak.test${pfad}`
    const mit = baueKulisse(quelltext, () => 'neu')
    mit.kulisse.speicher.set('fest-v4', new Map([[url, 'alt']]))
    mit.kulisse.speicher.set('media-v4', new Map([[url, 'alt']]))
    soll(`${pfad} mit Kopie: Antwort`, await holeAntwort(mit.handler, url), 'alt')
    soll(`${pfad} Abruf am HTTP-Cache vorbei`, mit.kulisse.modi.join(), 'no-cache')
    soll(`${pfad} mit Kopie: aufgefrischt`, mit.kulisse.speicher.get('fest-v4')?.get(url), 'neu')
    const ohne = baueKulisse(quelltext, () => 'neu')
    soll(`${pfad} ohne Kopie: Antwort`, await holeAntwort(ohne.handler, url), 'neu')
    soll(`${pfad} ohne Kopie: abgelegt`, ohne.kulisse.speicher.get('fest-v4')?.get(url), 'neu')
    const offline = baueKulisse(quelltext, () => null)
    offline.kulisse.speicher.set('fest-v4', new Map([[url, 'alt']]))
    soll(`${pfad} offline: Antwort`, await holeAntwort(offline.handler, url), 'alt')
  }
  const fest = baueKulisse(quelltext, () => 'neu')
  fest.kulisse.speicher.set('shell-v4', new Map([['https://ak.test/assets/a-1.js', 'alt']]))
  soll('assets mit Kopie', await holeAntwort(fest.handler, 'https://ak.test/assets/a-1.js'), 'alt')
  soll('assets ohne Netzabruf', fest.kulisse.gerufen.length, 0)
  const cover = baueKulisse(quelltext, () => 'neu')
  const coverUrl = 'https://s4.anilist.co/c.jpg'
  cover.kulisse.speicher.set('media-v4', new Map([[coverUrl, 'alt']]))
  soll('Cover mit Kopie', await holeAntwort(cover.handler, coverUrl, 'image'), 'alt')
  soll('Cover ohne Netzabruf', cover.kulisse.gerufen.length, 0)
  const aktiv = baueKulisse(quelltext, () => 'neu')
  for (const n of ['shell-v4', 'data-v4', 'media-v4', 'fest-v4', 'media-v3']) aktiv.kulisse.speicher.set(n, new Map())
  const warten: Promise<unknown>[] = []
  aktiv.handler.get('activate')!({ waitUntil: (p: Promise<unknown>) => warten.push(p) })
  await Promise.all(warten)
  soll('activate behält', ['shell-v4', 'data-v4', 'media-v4', 'fest-v4'].every((n) => aktiv.kulisse.speicher.has(n)), true)
  soll('activate wirft Altes weg', aktiv.kulisse.speicher.has('media-v3'), false)
  return fehler
}

const SCHLECHT = [
  "if (url.pathname.startsWith('/icons/')) { event.respondWith(cacheFirst(request, MEDIA)) }",
  "if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/og/')) { event.respondWith(cacheFirst(request, SHELL)) }",
  "event.respondWith(cacheFirst(request, MEDIA))",
  "const f = cacheFirst; if (url.pathname.startsWith('/assets/')) { f(request) }",
]
const GUT = [
  "if (url.pathname.startsWith('/assets/')) { event.respondWith(cacheFirst(request, SHELL)) }",
  "if (isCoverHost(url) && request.destination === 'image') { event.respondWith(cacheFirst(request, MEDIA)) }",
]

function pruefeSelbst(): string[] {
  const fehler: string[] = []
  for (const s of SCHLECHT) if (pruefeCacheFirst(s).length === 0) fehler.push(`Prüfung übersieht: ${s}`)
  for (const s of GUT) if (pruefeCacheFirst(s).length > 0) fehler.push(`Prüfung lehnt Gutes ab: ${s}`)
  return fehler
}

async function main(): Promise<number> {
  const pfad = process.argv[2] ?? 'public/sw.js'
  const quelltext = fs.readFileSync(pfad, 'utf8')
  const fehler = [...pruefeSelbst(), ...pruefeCacheFirst(quelltext), ...(await pruefeLaufzeit(quelltext))]
  for (const f of fehler) console.error(`FEHLER: ${f}`)
  if (fehler.length) return 1
  console.log(`check-sw-cache-regeln: ok (${pfad}: cacheFirst nur /assets/ und Cover; Icons/og aus Kopie mit Auffrischung)`)
  return 0
}

process.exit(await main())
