/**
 * **Ausfall des Newsletter-Dienstes in der Oberfläche** (14.10.2026): Statt „Failed to fetch“ steht ein
 * Satz, der sagt, was geht. Und: Jeder Aufruf der Seite an den Dienst läuft über `dienstFetch`.
 *
 * Aufruf: `npx tsx tools/dienst-fetch.test.ts`
 */
import { readFileSync } from 'node:fs'
import { DIENST_PAUSE } from '../shared/dienst-pause.ts'
import { dienstFetch } from '../web/src/lib/dienstFetch.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}

const echterFetch = globalThis.fetch
const mitAntwort = (status: number) => {
  globalThis.fetch = (async () => new Response('{}', { status })) as typeof fetch
}

async function meldung(): Promise<string | null> {
  try {
    await dienstFetch('https://worker.example/prefs')
    return null
  } catch (e) {
    return (e as Error).message
  }
}

async function verhalten() {
  globalThis.fetch = (async () => {
    throw new TypeError('Failed to fetch')
  }) as typeof fetch
  pruefe((await meldung()) === DIENST_PAUSE, 'fetch scheitert (TypeError): zentraler Satz')

  for (const status of [502, 503, 504]) {
    mitAntwort(status)
    pruefe((await meldung()) === DIENST_PAUSE, `Status ${status}: zentraler Satz`)
  }
  for (const status of [200, 400, 404, 429, 500]) {
    mitAntwort(status)
    pruefe((await meldung()) === null, `Status ${status}: Antwort kommt beim Aufrufer an (404 löscht dort den Schlüssel, 503 nie)`)
  }
  const voll = 'Alle Newsletter-Plätze sind gerade vergeben. Push-Mitteilungen und die Kalender-Dateien (.ics) erinnern dich trotzdem, ganz ohne Anmeldung.'
  const mitKoerper = (status: number, koerper: string) => {
    globalThis.fetch = (async () => new Response(koerper, { status })) as typeof fetch
  }
  mitKoerper(503, '{"error":"x","code":"newsletter_voll"}')
  pruefe((await meldung()) === voll, '503 newsletter_voll: eigener Hinweis statt Pause')
  mitKoerper(503, '{"error":"x","code":"anderes"}')
  pruefe((await meldung()) === DIENST_PAUSE, '503 mit anderem Code: Pause')
  mitKoerper(503, 'kein json')
  pruefe((await meldung()) === DIENST_PAUSE, '503 ohne JSON: Pause')
  pruefe(!/failed to fetch|1101|D1/i.test(DIENST_PAUSE), 'Satz ohne Technik')
  pruefe(DIENST_PAUSE.length < 90, 'Satz kurz')
}

/** Ein rohes `fetch(` in Code (auch `window.fetch(`, `globalThis.fetch(`, `x.fetch(`), nicht `dienstFetch(` und nicht in Kommentaren. */
const ROHES_FETCH = /\bfetch\(/
const istCode = (zeile: string) => !zeile.trim().startsWith('*') && !zeile.trim().startsWith('//')
const rohesFetch = (zeile: string) => ROHES_FETCH.test(zeile) && istCode(zeile)

/** Die Regel selbst: Jede Schreibweise des rohen Aufrufs wird gefangen, der Helfer nicht. */
function regel() {
  for (const roh of ['await fetch(url)', '  const r = window.fetch(url)', 'globalThis.fetch(url, init)', 'x.fetch(url)', '(fetch(url))']) {
    pruefe(rohesFetch(roh), `Regel fängt: ${roh.trim()}`)
  }
  for (const ok of ['await dienstFetch(url)', ' * ruft fetch(url) auf', '// fetch(url)', 'const refetch = 1']) {
    pruefe(!rohesFetch(ok), `Regel lässt durch: ${ok.trim()}`)
  }
}

/** Mutation am Aufrufer: Kippt eine Stelle zurück auf rohes `fetch`, steht dort wieder „Failed to fetch“. */
function aufrufer() {
  const dateien = ['web/src/lib/newsletterSync.ts', 'web/src/lib/push.ts']
  for (const datei of dateien) {
    const text = readFileSync(datei, 'utf8')
    const roh = text.split('\n').filter(rohesFetch)
    pruefe(roh.length === 0, `${datei}: kein rohes fetch (${roh.length})`)
    pruefe(/dienstFetch\(/.test(text), `${datei}: nutzt dienstFetch`)
    const eigenerSatz = text.split('\n').filter((z) => istCode(z) && /Error\('[^']*(erreichbar|Pause)/.test(z))
    pruefe(eigenerSatz.length === 0, `${datei}: kein eigener Satz für den Ausfall, nur DIENST_PAUSE (${eigenerSatz.length})`)
  }
  pruefe(/throw new Error\(DIENST_PAUSE\)/.test(readFileSync('web/src/lib/push.ts', 'utf8')), 'push: Schlüssel fehlt -> DIENST_PAUSE')
  const seite = readFileSync('web/src/components/StaticViews.tsx', 'utf8')
  pruefe(!seite.split('\n').some(rohesFetch) && /await subscribe\(/.test(seite), 'StaticViews: Anmeldung über subscribe() statt eigenem fetch')
  const zahl = (readFileSync('web/src/lib/newsletterSync.ts', 'utf8').match(/await dienstFetch\(/g) ?? []).length
  pruefe(zahl === 8, `newsletterSync: alle 8 Aufrufe über dienstFetch (${zahl})`)
}

try {
  await verhalten()
  regel()
  aufrufer()
} finally {
  globalThis.fetch = echterFetch
}
if (fehler) {
  console.log(`\n${fehler} Prüfung(en) rot`)
  process.exit(1)
}
console.log('\nAlles in Ordnung.')
