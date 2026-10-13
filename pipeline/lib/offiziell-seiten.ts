/**
 * Die Seitenliste der offiziellen Websites: welche Hosts wir lesen (`data/offizielle-seiten.yaml`, Handliste mit Pfad und Muster je Host, Saat aus dem
 * Messlauf vom 13.10.2026) und welchem Titel ein Host gehört (aus den `websites` in `data/anisearch.json`, gecachte Daten – nie ein Abruf von aniSearch).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { ROOT } from './util.ts'
import { SEITEN_DATEI } from './offiziell-pfade.ts'
import type { Muster } from './offiziell-lesen.ts'

export interface Seite {
  host: string
  /** Die Adresse der News-Liste (nicht geraten: aus der Startseite des Hosts gelesen). */
  url: string
  muster: Muster
  sprache: string
  /** JSON-Listen ohne eigene Adresse je Meldung: Vorlage mit Feldern der Meldung (`https://…/detail.html?d={uniqueId}`). */
  eintrag?: string
  /** Pause zwischen Abrufen in Sekunden, wenn die robots.txt einen Crawl-delay nennt. */
  pause?: number
}

export const MUSTER_NAMEN: Muster[] = ['feed', 'wp', 'json', 'html']

export function ladeSeiten(datei = SEITEN_DATEI): Seite[] {
  return (yaml.load(readFileSync(resolve(ROOT, datei), 'utf8')) as Seite[] | null) ?? []
}

/** `www.` zählt nicht: aniSearch schreibt `snowballearth.net`, die Seitenliste kann `www.…` führen. */
export const hostSchluessel = (host: string): string => host.toLowerCase().replace(/^www\./, '')

export interface TitelJahre {
  [titelId: string]: number | undefined
}

interface AnisearchEintrag {
  info?: { websites?: { url: string }[] }
}

/**
 * Host → Titel. Eine Seite nennt oft auch frühere Staffeln; es zählt das jüngste Jahr, bei Gleichstand bleiben alle (die Freigabe wählt). Titel, die der
 * Bestand nicht kennt (`jahre` ohne Eintrag), entfallen: eine Meldung braucht eine Kachel.
 */
export function titelJeHost(anisearch: Record<string, AnisearchEintrag>, jahre: TitelJahre): Map<string, number[]> {
  const gefunden = new Map<string, Map<number, number>>()
  for (const [id, eintrag] of Object.entries(anisearch)) {
    const jahr = jahre[id]
    if (jahr === undefined) continue
    for (const w of eintrag.info?.websites ?? []) {
      let host: string
      try {
        host = hostSchluessel(new URL(w.url).host)
      } catch {
        continue
      }
      const je = gefunden.get(host) ?? new Map<number, number>()
      je.set(Number(id), jahr)
      gefunden.set(host, je)
    }
  }
  const ergebnis = new Map<string, number[]>()
  for (const [host, je] of gefunden) {
    const neuestes = Math.max(...je.values())
    ergebnis.set(host, [...je].filter(([, j]) => j === neuestes).map(([id]) => id).sort((a, b) => a - b))
  }
  return ergebnis
}
