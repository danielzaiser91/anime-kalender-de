/**
 * Die Anbieter-Deep-Links aus dem MOTN-Archiv einsammeln.
 *
 * ## Warum es dieses Skript gibt
 *
 * Prime-Video-Verweise stammen bei uns aus dem aniSearch-Bestand, und dort
 * steht meist **eine Suche** statt einer Titelseite: `amazon.de/s?k=<Titel>`.
 * Am 25.08.2026 waren das 203 von 558 Verweisen. Wer darauf klickt, muss den
 * richtigen Treffer selbst heraussuchen — Daniel beim Prüfen: „zu mühselig".
 *
 * Selbst nachsehen können wir nicht: `amazon.de/robots.txt` sperrt ClaudeBot
 * namentlich mit `Disallow: /`, dazu 98 weitere Bots. Ein automatischer Abruf
 * fällt damit aus, ganz gleich welcher Pfad.
 *
 * **Die Adressen liegen aber längst im Haus.** Die Streaming-Availability-API
 * (Movie of the Night) liefert je Anbieter ein `link`-Feld, für Prime Video
 * einen echten Deep-Link (`amazon.de/gp/video/detail/<GTI>`). Der Parser hat
 * es nie gelesen; die Rohantworten unter `data/motn-raw/` tragen es trotzdem,
 * weil dieses Projekt beim Abrufen nichts wegwirft (siehe `CLAUDE.md`).
 *
 * Genau dafür ist das Archiv da: Ein nachträglich gebrauchtes Feld ist eine
 * Änderung am Parser, kein zweiter Lauf über eine fremde Schnittstelle mit
 * hartem Kontingent.
 *
 * ## Was es tut
 *
 * Liest `data/motn-raw/*.json.gz`, sammelt je IMDb-Kennung den ersten
 * gefundenen Deep-Link je Anbieter und schreibt sie nach
 * `data/motn-links.json`. Kein Netzzugriff, beliebig oft wiederholbar.
 *
 * Aufruf: `npm run data:motn-links`
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { log, writeJson } from './lib/util.ts'

const ARCHIV = 'data/motn-raw'
const ZIEL = 'data/motn-links.json'

/**
 * Welche Adressform zu welchem Anbieter gehört.
 *
 * Bewusst eng gefasst: Nur Adressen, die auf **einen Titel** zeigen, sind
 * hier etwas wert. Eine Startseite oder eine Suche wäre kein Fortschritt
 * gegenüber dem, was schon dasteht.
 */
const MUSTER: Array<{ platform: string; regex: RegExp }> = [
  { platform: 'primevideo', regex: /^https:\/\/(?:www\.)?amazon\.[a-z.]+\/gp\/video\/detail\/[A-Z0-9]+/i },
  { platform: 'netflix', regex: /^https:\/\/(?:www\.)?netflix\.com\/title\/\d+/i },
  { platform: 'disneyplus', regex: /^https:\/\/(?:www\.)?disneyplus\.com\/[a-z-]+\/series\/|^https:\/\/(?:www\.)?disneyplus\.com\/[a-z-]+\/movies\//i },
  { platform: 'crunchyroll', regex: /^https:\/\/(?:www\.)?crunchyroll\.com\/(?:de\/)?series\//i },
]

function anbieterZu(link: string): string | null {
  for (const m of MUSTER) if (m.regex.test(link)) return m.platform
  return null
}

/** Jede Form, in der eine MOTN-Antwort ihre Einträge führen kann. */
function eintraegeAus(daten: unknown): unknown[] {
  if (Array.isArray(daten)) return daten
  if (!daten || typeof daten !== 'object') return []
  const o = daten as Record<string, unknown>
  if (Array.isArray(o.shows)) return o.shows
  if (Array.isArray(o.result)) return o.result
  if (o.imdbId) return [o]
  // `changes`-Antworten führen die Serien unter `changes[].show`.
  if (Array.isArray(o.changes)) {
    return (o.changes as Array<Record<string, unknown>>).map((c) => c?.show).filter(Boolean)
  }
  return []
}

function main(): void {
  if (!existsSync(ARCHIV)) {
    log(`${ARCHIV} fehlt — nichts einzusammeln.`)
    writeJson(ZIEL, { erzeugtAus: 0, links: {} })
    return
  }

  const dateien = readdirSync(ARCHIV).filter((f) => f.endsWith('.gz'))
  /** imdbId → { platform: url } */
  const links: Record<string, Record<string, string>> = {}
  let gelesen = 0
  let uebersprungen = 0

  for (const datei of dateien) {
    let daten: unknown
    try {
      daten = JSON.parse(gunzipSync(readFileSync(`${ARCHIV}/${datei}`)).toString('utf8'))
    } catch {
      uebersprungen++
      continue
    }
    gelesen++

    for (const e of eintraegeAus(daten)) {
      const eintrag = e as { imdbId?: string; streamingOptions?: Record<string, unknown> }
      const imdb = eintrag?.imdbId
      if (!imdb) continue
      const optionen = eintrag.streamingOptions?.de
      if (!Array.isArray(optionen)) continue
      for (const o of optionen as Array<{ link?: string }>) {
        const link = o?.link
        if (typeof link !== 'string') continue
        const platform = anbieterZu(link)
        if (!platform) continue
        links[imdb] = links[imdb] ?? {}
        // Der **erste** Fund gewinnt: Die Dateien liegen chronologisch, und
        // ein älterer Deep-Link ist einem neueren nicht unterlegen — sie
        // zeigen auf dieselbe Seite. Zweimal zu schreiben kostet nur Zeit.
        if (!links[imdb][platform]) links[imdb][platform] = link.split('?')[0]
      }
    }
  }

  const zahl = Object.keys(links).length
  const jeAnbieter: Record<string, number> = {}
  for (const eintrag of Object.values(links)) {
    for (const p of Object.keys(eintrag)) jeAnbieter[p] = (jeAnbieter[p] ?? 0) + 1
  }

  writeJson(ZIEL, { erzeugtAus: gelesen, links })
  log(
    `MOTN-Links: ${zahl} Kennungen aus ${gelesen} Archivdateien` +
      (uebersprungen ? ` (${uebersprungen} unlesbar)` : '') +
      ` — ${Object.entries(jeAnbieter)
        .map(([p, n]) => `${p}: ${n}`)
        .join(', ')}`,
  )
}

main()
