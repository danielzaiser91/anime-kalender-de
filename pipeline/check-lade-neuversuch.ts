/**
 * Zusicherung: Eine Datendatei, die kurz nicht antwortet, bringt den Besucher nicht auf die Fehlerseite (Anlass 16.11.2026: `releases.json` mit 503).
 * Fälle: einmal 503 dann 200 lädt; viermal 503 endet im Fehler nach genau vier Anfragen; 429 und Netzfehler wie 503; 404 höchstens ein Neuversuch;
 * 403 keiner; abgeschnittene Antwort (kein JSON) wie ein Netzfehler; die Pausen wachsen und kommen aus `pausen`; über `loadJson` gilt dasselbe.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-lade-neuversuch.ts`
 */
import { holeMitNeuversuch, NEUVERSUCH_PAUSEN_MS, DatenLadefehler } from '../web/src/lib/lade-neuversuch.ts'
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
pruefe('immer 404: höchstens ein Neuversuch (zwei Anfragen)', nichtDa.anfragen === 2 && nichtDa.fehler instanceof DatenLadefehler && nichtDa.fehler.status === 404, nichtDa.anfragen)
const nichtDaDann = await lauf([404, 200])
pruefe('404, dann 200: lädt', JSON.stringify(nichtDaDann.ergebnis) === '[1,2]', nichtDaDann.anfragen)

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
globalThis.fetch = echt

console.log(`check-lade-neuversuch: ${gesamt - verletzt} von ${gesamt} Zusicherungen ok`)
if (verletzt) process.exit(1)
