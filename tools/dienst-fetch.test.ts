/**
 * **Ausfall des Newsletter-Dienstes in der Oberfläche** (14.10.2026): Statt „Failed to fetch“ steht ein
 * Satz, der sagt, was geht. Und: Jeder Aufruf der Seite an den Dienst läuft über `dienstFetch`.
 *
 * Aufruf: `npx tsx tools/dienst-fetch.test.ts`
 */
import { readFileSync } from 'node:fs'
import { DIENST_NICHT_ERREICHBAR, dienstFetch } from '../web/src/lib/dienstFetch.ts'

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
  pruefe((await meldung()) === DIENST_NICHT_ERREICHBAR, 'fetch scheitert (TypeError): zentraler Satz')

  for (const status of [502, 503, 504]) {
    mitAntwort(status)
    pruefe((await meldung()) === DIENST_NICHT_ERREICHBAR, `Status ${status}: zentraler Satz`)
  }
  for (const status of [200, 400, 404, 429, 500]) {
    mitAntwort(status)
    pruefe((await meldung()) === null, `Status ${status}: Antwort kommt beim Aufrufer an (404 löscht dort den Schlüssel, 503 nie)`)
  }
  pruefe(!/failed to fetch|1101|D1/i.test(DIENST_NICHT_ERREICHBAR), 'Satz ohne Technik')
  pruefe(DIENST_NICHT_ERREICHBAR.length < 90, 'Satz kurz')
}

/** Mutation am Aufrufer: Kippt eine Stelle zurück auf rohes `fetch`, steht dort wieder „Failed to fetch“. */
function aufrufer() {
  const dateien = ['web/src/lib/newsletterSync.ts', 'web/src/lib/push.ts']
  for (const datei of dateien) {
    const text = readFileSync(datei, 'utf8')
    const roh = text.split('\n').filter((z) => /(^|[^\w.])fetch\(/.test(z) && !z.trim().startsWith('*') && !z.trim().startsWith('//'))
    pruefe(roh.length === 0, `${datei}: kein rohes fetch (${roh.length})`)
    pruefe(/dienstFetch\(/.test(text), `${datei}: nutzt dienstFetch`)
  }
  const seite = readFileSync('web/src/components/StaticViews.tsx', 'utf8')
  pruefe(!/(^|[^\w.])fetch\(/m.test(seite) && /await subscribe\(/.test(seite), 'StaticViews: Anmeldung über subscribe() statt eigenem fetch')
  const zahl = (readFileSync('web/src/lib/newsletterSync.ts', 'utf8').match(/await dienstFetch\(/g) ?? []).length
  pruefe(zahl === 8, `newsletterSync: alle 8 Aufrufe über dienstFetch (${zahl})`)
}

try {
  await verhalten()
  aufrufer()
} finally {
  globalThis.fetch = echterFetch
}
if (fehler) {
  console.log(`\n${fehler} Prüfung(en) rot`)
  process.exit(1)
}
console.log('\nAlles in Ordnung.')
