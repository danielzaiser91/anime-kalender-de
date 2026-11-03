// Attrappe für `fetch-adn.ts` (per `--import`): meldet die erste Anfrage (Adresse und Köpfe) auf stderr und beendet den Lauf.
import { writeSync } from 'node:fs'

globalThis.fetch = async (url, init) => {
  writeSync(2, `ADNWEG ${JSON.stringify({ url: String(url), kopf: init?.headers ?? {} })}\n`)
  process.exit(0)
}
