/**
 * Zusicherung (13.10.2026): Der Abruf der aniSearch-Titelliste hält den Wochenlauf des ADN-Katalogs nie auf.
 * Das Limit (1 Abruf je Stunde) teilen sich alle Jobs; bei 429 hätte `holen()` bis zu viermal Retry-After gewartet, der Schritt hat 45 Minuten.
 * Jeder Fall läuft gegen einen Ersatz für `fetch`, es geht nichts ins Netz.
 */
import { ABRUF_GRENZEN, holeTitelliste } from './lib/adn-zuordnung-lauf.ts'
import { holen, ladeTitelliste, type Zwischenspeicher } from './fetch-anisearch-katalog-abgleich.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return
  fehler++
  console.error(`FEHLER: ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/* Die Frist (`AbortSignal.timeout`) hält die Ereignisschleife nicht offen, ein echtes fetch tut es über seine Verbindung. */
setInterval(() => undefined, 1_000)
const echtesFetch = globalThis.fetch
let abrufe = 0
const ersetze = (antwort: (signal?: AbortSignal | null) => Promise<Response>): void => {
  abrufe = 0
  globalThis.fetch = ((_url: unknown, init?: RequestInit) => {
    abrufe++
    return antwort(init?.signal)
  }) as typeof fetch
}
const status429 = (): Promise<Response> => Promise.resolve(new Response('', { status: 429, headers: { 'retry-after': '3600' } }))
const haengt = (signal?: AbortSignal | null): Promise<Response> =>
  new Promise((_, nein) => signal?.addEventListener('abort', () => nein(signal.reason)))

/** Läuft `f` nicht innerhalb von `ms`, gilt der Lauf als hängend (ohne den Fix wartete er eine Stunde). */
async function binnen<T>(ms: number, f: () => Promise<T>): Promise<{ wert?: T; haengt: boolean; wirft: boolean }> {
  const zeit = new Promise<'zeit'>((ok) => setTimeout(() => ok('zeit'), ms).unref())
  const ergebnis = await Promise.race([f().then((wert) => ({ wert }), () => 'wirft' as const), zeit])
  if (ergebnis === 'zeit') return { haengt: true, wirft: false }
  return ergebnis === 'wirft' ? { haengt: false, wirft: true } : { haengt: false, wirft: false, wert: ergebnis.wert }
}

pruefe('der Wochenlauf versucht die Titelliste genau einmal', ABRUF_GRENZEN.versuche === 1, ABRUF_GRENZEN)
pruefe('der Wochenlauf wartet höchstens fünf Minuten auf eine Antwort', (ABRUF_GRENZEN.frist ?? Infinity) <= 5 * 60_000, ABRUF_GRENZEN)

// 429 mit Retry-After 3600: ein Versuch, keine Pause, kein Ergebnis.
ersetze(status429)
const a = await binnen(5_000, () => holen('https://api.anisearch.com/v1/anime/titles', 'x', { versuche: 1 }))
pruefe('429: holen() gibt sofort auf, statt Retry-After abzuwarten', !a.haengt && !a.wirft && a.wert === undefined, a)
pruefe('429: genau ein Abruf', abrufe === 1, abrufe)

// Ladefehler: ladeTitelliste wirft (statt zu hängen), holeTitelliste fängt es ab.
const veraltet: Zwischenspeicher = { geholtAm: '2020-01-01T00:00:00.000Z', titel: { 7: { year: 2001, main: 'Alter Name' } } }
ersetze(status429)
const b = await binnen(5_000, () => ladeTitelliste('x', ABRUF_GRENZEN, veraltet))
pruefe('429: ladeTitelliste wirft rasch', b.wirft && !b.haengt, b)

ersetze(status429)
const c = await binnen(5_000, () => holeTitelliste({}, 'x'))
pruefe('429 ohne Zwischenspeicher: keine Titelliste, die Zuordnungen der Vorwoche bleiben', !c.haengt && !c.wirft && c.wert === undefined, c)

ersetze(status429)
const d = await binnen(5_000, () => holeTitelliste(veraltet, 'x'))
pruefe('429 mit veraltetem Zwischenspeicher: die alte Liste gilt', d.wert?.get(7)?.namen[0] === 'Alter Name', d.wert && [...d.wert.keys()])
pruefe('429 mit veraltetem Zwischenspeicher: ein Abruf', abrufe === 1, abrufe)

ersetze(status429)
const e = await binnen(5_000, () => holeTitelliste({ geholtAm: new Date().toISOString(), titel: veraltet.titel }, 'x'))
pruefe('frischer Zwischenspeicher: kein Abruf', abrufe === 0 && e.wert?.size === 1, abrufe)

ersetze(status429)
const f = await binnen(5_000, () => holeTitelliste(veraltet, undefined))
pruefe('ohne Token: kein Abruf', abrufe === 0 && f.wert?.size === 1, abrufe)

// Antwort bleibt aus: die Frist bricht den Abruf ab.
ersetze(haengt)
const g = await binnen(5_000, () => holen('https://api.anisearch.com/v1/anime/titles', 'x', { versuche: 1, frist: 50 }))
pruefe('keine Antwort: die Frist beendet den Abruf', g.wirft && !g.haengt, g)

ersetze(haengt)
const h = await binnen(5_000, () => ladeTitelliste('x', { versuche: 1, frist: 50 }, veraltet))
pruefe('keine Antwort: ladeTitelliste wirft nach der Frist', h.wirft && !h.haengt, h)

// Standardgrenzen für alle anderen Aufrufer (Katalogabgleich, Einzelabrufe) bleiben: bis zu vier Versuche mit Pause bei 429.
ersetze(status429)
const i = await binnen(300, () => holen('https://api.anisearch.com/v1/anime/titles', 'x'))
pruefe('Standard: bei 429 wird weiter gewartet (Verhalten des Katalogabgleichs unverändert)', i.haengt && abrufe === 1, { i, abrufe })

globalThis.fetch = echtesFetch
if (fehler) process.exit(1)
console.log('check-adn-titelliste-abruf: ok')
process.exit(0)
