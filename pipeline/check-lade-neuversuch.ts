/**
 * Zusicherung: Eine Datendatei, die kurz nicht antwortet, bringt den Besucher nicht auf die Fehlerseite (Anlass 16.11.2026: `releases.json` mit 503).
 * Fälle: einmal 503 dann 200 lädt; viermal 503 endet im Fehler nach genau vier Anfragen; 429 und Netzfehler wie 503; 404 höchstens ein Neuversuch;
 * 403 keiner; `gemerkt` gibt Gescheitertes frei; abgeschnittene Antwort (kein JSON) wie ein Netzfehler; die Pausen wachsen und kommen aus `pausen`; über `loadJson` gilt dasselbe.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-lade-neuversuch.ts`
 */
import { gemerkt, holeMitNeuversuch, NEUVERSUCH_PAUSEN_MS, DatenLadefehler } from '../web/src/lib/lade-neuversuch.ts'
import { loadJson } from '../web/src/lib/data.ts'

let verletzt = 0
let gesamt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  gesamt++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

type Antwort = number | 'netz' | 'kaputt'
/** Abruf-Attrappe: antwortet der Reihe nach; die letzte Antwort gilt für alle weiteren. Zählt Anfragen und merkt sich gleichzeitig laufende. */
function attrappe(antworten: Antwort[]) {
  const zaehler = { anfragen: 0, gleichzeitig: 0, hoechstens: 0 }
  const abruf = async (): Promise<Response> => {
    const a = antworten[Math.min(zaehler.anfragen, antworten.length - 1)]
    zaehler.anfragen++
    zaehler.gleichzeitig++
    zaehler.hoechstens = Math.max(zaehler.hoechstens, zaehler.gleichzeitig)
    await Promise.resolve()
    zaehler.gleichzeitig--
    if (a === 'netz') throw new TypeError('Failed to fetch')
    if (a === 'kaputt') return new Response('[1,2', { status: 200 })
    return a === 200 ? new Response('[1,2]', { status: 200 }) : new Response('', { status: a })
  }
  return { abruf, zaehler }
}
async function lauf(antworten: Antwort[]) {
  const { abruf, zaehler } = attrappe(antworten)
  const pausen: number[] = []
  const warte = async (ms: number) => void pausen.push(ms)
  let ergebnis: unknown
  let fehler: unknown
  try {
    ergebnis = await holeMitNeuversuch<number[]>('/data/x.json', 'x.json', { abruf, warte, pausen: [10, 20, 30] })
  } catch (e) {
    fehler = e
  }
  return { ergebnis, fehler, pausen, ...zaehler }
}

const eins = await lauf([503, 200])
pruefe('einmal 503, dann 200: lädt', JSON.stringify(eins.ergebnis) === '[1,2]' && eins.fehler === undefined, eins.fehler)
pruefe('einmal 503: zwei Anfragen, eine Pause', eins.anfragen === 2 && eins.pausen.length === 1 && eins.pausen[0] === 10, [eins.anfragen, eins.pausen])

const dreimal = await lauf([503, 503, 503, 200])
pruefe('dreimal 503, dann 200: lädt, Pausen wachsen wie gesetzt', JSON.stringify(dreimal.ergebnis) === '[1,2]' && dreimal.pausen.join() === '10,20,30', [dreimal.ergebnis, dreimal.pausen])

const viermal = await lauf([503])
pruefe('immer 503: Fehler nach genau vier Anfragen', viermal.fehler instanceof DatenLadefehler && viermal.anfragen === 4, [viermal.anfragen, String(viermal.fehler)])
pruefe('immer 503: Fehler trägt Datei und Status', viermal.fehler instanceof DatenLadefehler && viermal.fehler.datei === 'x.json' && viermal.fehler.status === 503 && /x\.json konnte nicht geladen werden \(503\)/.test(viermal.fehler.message), String(viermal.fehler))

const zu = await lauf([429, 200])
pruefe('429, dann 200: lädt', JSON.stringify(zu.ergebnis) === '[1,2]' && zu.anfragen === 2, zu.anfragen)
const zuImmer = await lauf([429])
pruefe('immer 429: vier Anfragen', zuImmer.anfragen === 4, zuImmer.anfragen)

const netz = await lauf(['netz', 200])
pruefe('Netzfehler, dann 200: lädt', JSON.stringify(netz.ergebnis) === '[1,2]' && netz.anfragen === 2, netz.anfragen)
const netzImmer = await lauf(['netz'])
pruefe('immer Netzfehler: vier Anfragen, Status leer', netzImmer.anfragen === 4 && netzImmer.fehler instanceof DatenLadefehler && netzImmer.fehler.status === undefined, netzImmer.anfragen)

const kaputt = await lauf(['kaputt', 200])
pruefe('abgeschnittene Antwort, dann 200: lädt', JSON.stringify(kaputt.ergebnis) === '[1,2]' && kaputt.anfragen === 2, kaputt.anfragen)

const nichtDa = await lauf([404])
pruefe('404: nie ein Neuversuch (eine Anfrage, keine Pause)', nichtDa.anfragen === 1 && nichtDa.pausen.length === 0 && nichtDa.fehler instanceof DatenLadefehler && nichtDa.fehler.status === 404, nichtDa.anfragen)

for (const status of [500, 502, 504]) {
  const l = await lauf([status, 200])
  pruefe(`${status}, dann 200: lädt`, JSON.stringify(l.ergebnis) === '[1,2]' && l.anfragen === 2, l.anfragen)
}

const verboten = await lauf([403])
pruefe('403: kein Neuversuch', verboten.anfragen === 1 && verboten.pausen.length === 0, verboten.anfragen)

const erfolg = await lauf([200])
pruefe('200: eine Anfrage, keine Pause', erfolg.anfragen === 1 && erfolg.pausen.length === 0, erfolg.anfragen)
pruefe('nie zwei Anfragen derselben Datei gleichzeitig', [eins, viermal, netzImmer].every((l) => l.hoechstens === 1), [eins.hoechstens, viermal.hoechstens])

pruefe('Standardpausen wachsen und bleiben unter 5 s', NEUVERSUCH_PAUSEN_MS.length === 3 && NEUVERSUCH_PAUSEN_MS.join() === '400,1200,3000', NEUVERSUCH_PAUSEN_MS)

/* Über `loadJson` und den globalen Abruf (so läuft es im Browser): erst 503, dann Datei. */
const echt = globalThis.fetch
let anfragen = 0
globalThis.fetch = (async () => (++anfragen === 1 ? new Response('', { status: 503 }) : new Response('{"ok":true}', { status: 200 }))) as typeof fetch
const ueberLoadJson = await loadJson<{ ok: boolean }>('releases.json', { pausen: [0, 0, 0] })
pruefe('loadJson: 503 dann 200 lädt', ueberLoadJson.ok === true && anfragen === 2, anfragen)
anfragen = 0
globalThis.fetch = (async () => (++anfragen, new Response('', { status: 503 }))) as typeof fetch
let loadFehler = ''
await loadJson('releases.json', { pausen: [0, 0, 0] }).catch((e: Error) => (loadFehler = e.message))
pruefe('loadJson: immer 503 endet im Fehler nach vier Anfragen', anfragen === 4 && /releases\.json konnte nicht geladen werden \(503\)/.test(loadFehler), [anfragen, loadFehler])

/* `loadVoices`: Fehlt die Datei (404), hat der Titel keine Stimmen — eine Anfrage, kein Verzug (Standardpausen, kein Warten). */
const { loadVoices, loadNews } = await import('../web/src/lib/data.ts')
anfragen = 0
globalThis.fetch = (async () => (++anfragen, new Response('', { status: 404 }))) as typeof fetch
const stimmen = await Promise.race([loadVoices(900001), new Promise<string>((f) => setTimeout(() => f('zu langsam'), 200))])
pruefe('loadVoices bei 404: eine Anfrage, kein Verzug, keine Rollen', anfragen === 1 && typeof stimmen === 'object' && stimmen.roles.length === 0, [anfragen, stimmen])

/* `gemerkt`: gescheiterte Zusage wird nicht festgehalten; erfolgreiche bleibt (eine Anfrage), auch mit Ersatz. */
let laeufe = 0
const scheitert = () => (++laeufe, Promise.reject(new Error('aus')))
const erster = await gemerkt('probe-a', scheitert).catch((e: Error) => e.message)
const zweiter = await gemerkt('probe-a', () => (++laeufe, Promise.resolve('da')))
pruefe('gemerkt: erster Abruf scheitert endgültig, zweiter Aufruf fragt neu', erster === 'aus' && zweiter === 'da' && laeufe === 2, [erster, zweiter, laeufe])
const dritter = await gemerkt('probe-a', () => (++laeufe, Promise.resolve('anders')))
pruefe('gemerkt: erfolgreiche Zusage bleibt (kein dritter Abruf)', dritter === 'da' && laeufe === 2, [dritter, laeufe])
const mitErsatz = await gemerkt('probe-b', scheitert, () => 'ersatz')
const danach = await gemerkt('probe-b', () => Promise.resolve('echt'))
pruefe('gemerkt mit Ersatz: Ersatz für diesen Aufruf, danach fragt der nächste neu', mitErsatz === 'ersatz' && danach === 'echt', [mitErsatz, danach])
let gleichzeitig = 0
const langsam = () => (++gleichzeitig, new Promise<number>((r) => setTimeout(() => r(gleichzeitig), 5)))
await Promise.all([gemerkt('probe-c', langsam), gemerkt('probe-c', langsam)])
pruefe('gemerkt: zwei gleichzeitige Aufrufer teilen einen Abruf', gleichzeitig === 1, gleichzeitig)

/* Über `loadNews` (eine der umgestellten `??=`-Stellen, Standardpausen ≈ 4,6 s): erst endgültig 503, dann 200 — der zweite Aufruf fragt neu. */
anfragen = 0
globalThis.fetch = (async () => (++anfragen <= 4 ? new Response('', { status: 503 }) : new Response('[{"id":"x"}]', { status: 200 }))) as typeof fetch
const ersteNews = await loadNews().then((l) => l.length, () => -1)
pruefe('loadNews: erster Aufruf scheitert endgültig (vier Anfragen, leere Liste)', ersteNews === 0 && anfragen === 4, [ersteNews, anfragen])
const zweiteNews = await loadNews().then((l) => l.length, () => -1)
pruefe('loadNews: zweiter Aufruf fragt neu (fünfte Anfrage, Antwort 200)', zweiteNews >= 0 && anfragen === 5, [zweiteNews, anfragen])
globalThis.fetch = echt

console.log(`check-lade-neuversuch: ${gesamt - verletzt} von ${gesamt} Zusicherungen ok`)
if (verletzt) process.exit(1)
