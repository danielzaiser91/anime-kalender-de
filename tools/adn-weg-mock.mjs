// Attrappe für `fetch-adn.ts` (per `--import`): meldet die erste Anfrage an das ADN-Gateway (Adresse und Köpfe) auf stderr und beendet den Lauf.
// Die News-Abfrage davor geht nicht über den Weg und bekommt einen leeren Fehler.
import { writeSync } from 'node:fs'

globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://news.animationdigitalnetwork.com/')) return new Response('[]', { status: 500 })
  writeSync(2, `ADNWEG ${JSON.stringify({ url: String(url), kopf: init?.headers ?? {} })}\n`)
  process.exit(0)
}
