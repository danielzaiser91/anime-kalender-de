/**
 * Trägt die laufende Crunchyroll-Nummer (`sequence_number`) aus dem Archiv in
 * `data/crunchyroll-dub.json` nach — ohne einen einzigen Abruf.
 *
 * Seit dem 17.09.2026 speichert `staffelAuszaehlen()` sie selbst (Anlass:
 * Captain Tsubasa, siehe `deutscheFolgenNachDemEnde()`). Für den Bestand davor
 * steht sie in `data/crunchyroll-raw/<Kennung>(.de).json.gz`: „Beim Scrapen
 * nichts wegwerfen" (CLAUDE.md) — ein nachträglich gebrauchtes Feld ist eine
 * Änderung am Parser, kein zweiter Lauf.
 *
 * Aufruf: npx tsx tools/cr-laufend-nachtragen.ts [--trocken]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

const DATEI = 'data/crunchyroll-dub.json'
const trocken = process.argv.includes('--trocken')
const daten = JSON.parse(readFileSync(DATEI, 'utf8')) as {
  serien: {
    seriesId?: string
    staffeln?: { deutscheFolgen?: { guid: string; laufend?: number }[] }[]
  }[]
}

const cache = new Map<string, Map<string, number>>()
function laufendAusArchiv(seriesId: string): Map<string, number> {
  const bekannt = cache.get(seriesId)
  if (bekannt) return bekannt
  const m = new Map<string, number>()
  for (const datei of [`data/crunchyroll-raw/${seriesId}.de.json.gz`, `data/crunchyroll-raw/${seriesId}.json.gz`]) {
    if (!existsSync(datei)) continue
    const j = JSON.parse(gunzipSync(readFileSync(datei)).toString('utf8'))
    const walk = (o: unknown): void => {
      if (Array.isArray(o)) return o.forEach(walk)
      if (!o || typeof o !== 'object') return
      const e = o as { sequence_number?: number; versions?: { audio_locale: string; guid: string }[] }
      if (typeof e.sequence_number === 'number' && Array.isArray(e.versions)) {
        for (const v of e.versions) if (v.audio_locale === 'de-DE' && !m.has(v.guid)) m.set(v.guid, e.sequence_number)
      }
      Object.values(o).forEach(walk)
    }
    walk(j)
  }
  cache.set(seriesId, m)
  return m
}

let gesetzt = 0
let ohne = 0
for (const serie of daten.serien) {
  if (!serie.seriesId) continue
  for (const block of serie.staffeln ?? []) {
    for (const f of block.deutscheFolgen ?? []) {
      if (typeof f.laufend === 'number') continue
      const n = laufendAusArchiv(serie.seriesId).get(f.guid)
      if (typeof n === 'number') {
        f.laufend = n
        gesetzt++
      } else ohne++
    }
  }
}
console.log(`laufende Nummer nachgetragen: ${gesetzt}, im Archiv nicht gefunden: ${ohne}`)
if (!trocken && gesetzt) writeFileSync(DATEI, JSON.stringify(daten, null, 2))
