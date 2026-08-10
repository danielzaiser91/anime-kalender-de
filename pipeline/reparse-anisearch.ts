/**
 * Wertet den archivierten aniSearch-Bestand neu aus — ohne einen einzigen Abruf.
 *
 * Das ist der Grund, warum `data/anisearch-raw/` existiert. Wird der Parser
 * verbessert oder ein Feld ergänzt, das bisher niemand gebraucht hat, holt man
 * die Seiten nicht noch einmal, sondern liest sie aus dem Archiv neu.
 *
 * Beispiel vom 11.08.2026: Die Folgenzahl wurde nur bei 3 % der Titel erkannt,
 * weil eine Regex die Laufzeit statt der Folgenzahl traf. Ohne Archiv wären das
 * 2.612 neue Anfragen an eine fremde Redaktionsseite gewesen — mit Archiv sind
 * es zwei Sekunden Rechenzeit.
 *
 * Aufruf: npm run data:anisearch:reparse
 */
import { gunzipSync } from 'node:zlib'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { log, readJson, warn, writeJson } from './lib/util.ts'
import { extractInfo, type AnisearchEntry } from './fetch-anisearch.ts'

const ARCHIV = 'data/anisearch-raw'

function main(): void {
  if (!existsSync(ARCHIV)) {
    warn(`Kein Archiv unter ${ARCHIV} — nichts zu tun.`)
    return
  }
  const cache = readJson<Record<string, AnisearchEntry>>('data/anisearch.json', {})

  // Der Bestand ist nach unserer Titel-ID abgelegt, das Archiv nach der
  // aniSearch-ID. Die Brücke steht in den Einträgen selbst.
  const nachAnisearchId = new Map<number, string>()
  for (const [titleId, eintrag] of Object.entries(cache)) {
    if (eintrag.anisearchId) nachAnisearchId.set(eintrag.anisearchId, titleId)
  }

  const dateien = readdirSync(ARCHIV).filter((d) => d.endsWith('.html.gz'))
  let geaendert = 0
  let ohneZuordnung = 0
  let mitFolgenzahl = 0

  for (const datei of dateien) {
    const anisearchId = Number(datei.replace('.html.gz', ''))
    const titleId = nachAnisearchId.get(anisearchId)
    if (!titleId) {
      ohneZuordnung++
      continue
    }
    const info = extractInfo(gunzipSync(readFileSync(`${ARCHIV}/${datei}`)).toString('utf8'))
    if (!info) continue
    if (info.episodes) mitFolgenzahl++
    const vorher = JSON.stringify(cache[titleId].info)
    if (vorher !== JSON.stringify(info)) {
      cache[titleId].info = info
      geaendert++
    }
  }

  writeJson('data/anisearch.json', cache, true)
  log(
    `Neu ausgewertet: ${dateien.length} archivierte Seiten, ${geaendert} Einträge geändert, ` +
      `${mitFolgenzahl} mit Folgenzahl` +
      (ohneZuordnung ? `, ${ohneZuordnung} ohne Zuordnung im Bestand` : ''),
  )
}

main()
