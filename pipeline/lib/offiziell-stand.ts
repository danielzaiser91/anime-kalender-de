/**
 * Das Gedächtnis des Sammlers (liegt im Cache, nicht im Repo): wann jeder Host zuletzt gelesen wurde, was seine robots.txt sagt, wie oft er zuletzt scheiterte.
 * Daraus folgt, welche Hosts ein Lauf liest: höchstens `grenze` (kleine Blöcke), die am längsten nicht gelesenen zuerst — so kommt jeder Host spätestens
 * nach `ceil(Hosts / grenze)` Läufen dran, ohne dass ein Lauf alle zugleich belastet.
 */
import { inPause, pauseBis } from './sammelartikel-lauf.ts'
import type { Seite } from './offiziell-seiten.ts'

export interface HostStand {
  /** Tag (UTC) der letzten vollständigen Lesung. */
  zuletztAm?: string
  /** Tag der letzten robots.txt-Lesung; sie wird nach `ROBOTS_TAGE` neu gelesen. */
  robotsAm?: string
  /** Wortlaut der robots.txt; leer = Datei gibt es nicht (404), also keine Regeln. */
  robots?: string
  /** Aufeinanderfolgende Fehlschläge (nicht 200, Zeitüberschreitung). */
  fehler?: number
  pauseBis?: string
  /** HTTP-Status der letzten Antwort, die nicht 200 war (zur Diagnose). */
  status?: number
  /** Wie der letzte Lauf endete: ok, leer (200 ohne lesbare Meldung), robots, gesperrt, fehler. */
  ausgang?: string
}

export interface Stand {
  hosts: Record<string, HostStand>
}

/** Höchstens so alt darf die gelesene robots.txt sein; eine neue Regel gilt spätestens nach dieser Zeit. */
export const ROBOTS_TAGE = 7
/** Nach so vielen Fehlschlägen in Folge pausiert der Host einen Tag (Pause statt Abbruch). */
export const FEHLER_BIS_PAUSE = 3
/** Ein Host wird frühestens nach so vielen Tagen erneut gelesen (Listen ändern sich nicht stündlich, und wir sind zu Gast). */
export const MINDESTABSTAND_TAGE = 1

const tageSeit = (tag: string | undefined, heute: string): number => (tag ? Math.round((Date.parse(heute) - Date.parse(tag)) / 86_400_000) : Infinity)

export const robotsFrisch = (h: HostStand | undefined, heute: string): boolean => h?.robots !== undefined && tageSeit(h.robotsAm, heute) < ROBOTS_TAGE

/** Die Hosts dieses Laufs: nicht in Pause, nicht heute schon gelesen, am längsten unberührt zuerst, höchstens `grenze`. */
export function faelligeSeiten(seiten: Seite[], stand: Stand, jetzt: Date, grenze: number): Seite[] {
  const heute = jetzt.toISOString().slice(0, 10)
  return seiten
    .filter((s) => !inPause(stand.hosts[s.host] ?? {}, jetzt) && tageSeit(stand.hosts[s.host]?.zuletztAm, heute) >= MINDESTABSTAND_TAGE)
    .sort((a, b) => (stand.hosts[a.host]?.zuletztAm ?? '').localeCompare(stand.hosts[b.host]?.zuletztAm ?? '') || a.host.localeCompare(b.host))
    .slice(0, grenze)
}

/** Stand nach einem Lauf dieses Hosts. Gesperrt (403/429): Pause nach `Retry-After`, mindestens eine Stunde; sonst Pause erst nach `FEHLER_BIS_PAUSE` Fehlern. */
export function nachLesung(alt: HostStand | undefined, ausgang: string, jetzt: Date, retryAfter?: number): HostStand {
  const heute = jetzt.toISOString().slice(0, 10)
  const neu: HostStand = { ...alt, ausgang }
  const fehlgeschlagen = ausgang === 'gesperrt' || ausgang === 'fehler' || ausgang === 'robots'
  if (!fehlgeschlagen) {
    delete neu.pauseBis
    return { ...neu, fehler: 0, zuletztAm: heute }
  }
  neu.fehler = (alt?.fehler ?? 0) + 1
  neu.zuletztAm = heute
  if (ausgang !== 'fehler' || neu.fehler >= FEHLER_BIS_PAUSE) neu.pauseBis = pauseBis(jetzt, ausgang === 'gesperrt' ? retryAfter : 86_400)
  return neu
}
