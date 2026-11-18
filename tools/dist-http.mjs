/**
 * Liefert einen Build-Ordner kurzzeitig über HTTP aus, gzip-komprimiert wie live (Cloudflare komprimiert jede Textdatei).
 * Nur für Messungen, die einen echten Server brauchen (Lighthouse lädt per Adresse, Playwright-Routen kennt es nicht):
 * Port frei gewählt auf 127.0.0.1, der Aufrufer schließt ihn nach der Messung (`schliessen`).
 */
import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain' }
const TEXT = /^(text\/|application\/(json|manifest|xml)|image\/svg)/

/** Die Datei zu einem Pfad: Ordner liefern ihre `index.html` (vorgerenderte Seiten `/t/<id>/`). */
function dateiFuer(dist, pfad) {
  const roh = path.join(dist, decodeURIComponent(pfad))
  if (!roh.startsWith(path.resolve(dist))) return undefined
  if (existsSync(roh) && statSync(roh).isDirectory()) return path.join(roh, 'index.html')
  return roh
}

/** Startet die Auslieferung; liefert die Basisadresse (mit `/` am Ende) und die Funktion zum Schließen. */
export async function distAusliefern(dist) {
  const wurzel = path.resolve(dist)
  const server = createServer((anfrage, antwort) => {
    const datei = dateiFuer(wurzel, new URL(anfrage.url, 'http://x').pathname)
    if (!datei || !existsSync(datei)) return antwort.writeHead(404).end()
    const typ = TYPEN[path.extname(datei)] ?? 'application/octet-stream'
    const roh = readFileSync(datei)
    const packen = TEXT.test(typ) && /\bgzip\b/.test(anfrage.headers['accept-encoding'] ?? '')
    antwort.writeHead(200, { 'content-type': typ, 'cache-control': 'public, max-age=31536000', ...(packen ? { 'content-encoding': 'gzip' } : {}) })
    antwort.end(packen ? gzipSync(roh) : roh)
  })
  await new Promise((fertig) => server.listen(0, '127.0.0.1', fertig))
  return { basis: `http://127.0.0.1:${server.address().port}/`, schliessen: () => new Promise((fertig) => server.close(fertig)) }
}
