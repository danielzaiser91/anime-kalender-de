import { useSyncExternalStore } from 'react'
import type { PlatformId, ReleaseEvent } from '@shared/types.ts'
import { buildIcs } from '@shared/ics.ts'
import { addDays, startOfWeek } from '@shared/time.ts'

/**
 * **„Meine Woche" (Prototyp, 08.10.2026)**: die Woche nur mit den gemerkten Titeln, eingeschränkt auf
 * die Plattformen, die jemand hat. Beides bleibt im Browser — kein Konto, kein Server, kein Abgleich.
 * Konzept: `docs/wissen/meine-woche.md`.
 */
const PLATTFORMEN = 'meinePlattformen'
const ANSICHT = 'meineWoche'
const EREIGNIS = 'meine-woche-geaendert'

function lesen<T>(schluessel: string, pruefen: (roh: unknown) => T | undefined, sonst: T): T {
  try {
    const roh: unknown = JSON.parse(localStorage.getItem(schluessel) ?? 'null')
    return pruefen(roh) ?? sonst
  } catch {
    return sonst
  }
}

function schreiben(schluessel: string, wert: unknown): void {
  try {
    localStorage.setItem(schluessel, JSON.stringify(wert))
  } catch {
    /* Gesperrter Speicher: die Wahl gilt dann für diesen Besuch. */
  }
  window.dispatchEvent(new Event(EREIGNIS))
}

function abonnieren(f: () => void): () => void {
  window.addEventListener(EREIGNIS, f)
  window.addEventListener('storage', f)
  return () => {
    window.removeEventListener(EREIGNIS, f)
    window.removeEventListener('storage', f)
  }
}

/** Gewählte Plattformen als stabiler String, damit `useSyncExternalStore` nicht bei jedem Lesen ein neues Array sieht. */
function plattformenRoh(): string {
  return lesen(PLATTFORMEN, (r) => (Array.isArray(r) ? r.filter((x): x is string => typeof x === 'string').join(',') : undefined), '')
}

/** Die Plattformen, die jemand hat — leer heißt: alle. */
export function useMeinePlattformen(): [PlatformId[], (p: PlatformId) => void] {
  const roh = useSyncExternalStore(abonnieren, plattformenRoh, () => '')
  const liste = (roh ? roh.split(',') : []) as PlatformId[]
  const umschalten = (p: PlatformId) => schreiben(PLATTFORMEN, liste.includes(p) ? liste.filter((x) => x !== p) : [...liste, p])
  return [liste, umschalten]
}

/** Ob die Woche gerade als „Meine Woche" gezeigt wird — bleibt im Browser, nicht in der Adresse. */
export function useMeineWocheAn(): [boolean, (an: boolean) => void] {
  const an = useSyncExternalStore(abonnieren, () => lesen(ANSICHT, (r) => (typeof r === 'boolean' ? r : undefined), false), () => false)
  return [an, (wert) => schreiben(ANSICHT, wert)]
}

export interface MeineWoche {
  /** Je Wochentag die Termine der gemerkten Titel auf den eigenen Plattformen. */
  tage: { date: string; termine: ReleaseEvent[] }[]
  /** Gemerkte Titel ohne Termin in dieser Woche — mit ihrem nächsten Termin, falls es einen gibt. */
  ruhig: { titleId: number; name: string; naechster?: ReleaseEvent }[]
  /** Gemerkte Titel, die diese Woche nur auf einer abgewählten Plattform laufen. */
  anderswo: { titleId: number; name: string; platform: PlatformId }[]
}

const OHNE_UHRZEIT = '99:99'
const nachZeit = (a: ReleaseEvent, b: ReleaseEvent) => (a.time ?? OHNE_UHRZEIT).localeCompare(b.time ?? OHNE_UHRZEIT) || a.name.localeCompare(b.name, 'de')

/**
 * Rechnet die persönliche Woche aus dem vollen Terminbestand — reine Funktion, damit sie sich messen lässt.
 * TV-Termine zählen mit, wenn „tv" gewählt ist oder niemand eingeschränkt hat.
 */
export function meineWoche(events: ReleaseEvent[], favoriten: Set<number>, plattformen: PlatformId[], anker: string, namen: Map<number, string>): MeineWoche {
  const montag = startOfWeek(anker)
  const sonntag = addDays(montag, 6)
  const passt = (e: ReleaseEvent) => !plattformen.length || plattformen.includes(e.platform)
  const proTag = new Map<string, ReleaseEvent[]>()
  const gesehen = new Set<number>()
  const abgewaehlt = new Map<number, PlatformId>()
  const naechster = new Map<number, ReleaseEvent>()
  for (const e of events) {
    if (!favoriten.has(e.titleId)) continue
    if (e.date > sonntag) {
      if (passt(e) && (!naechster.has(e.titleId) || e.date < naechster.get(e.titleId)!.date)) naechster.set(e.titleId, e)
      continue
    }
    if (e.date < montag) continue
    if (!passt(e)) {
      if (!abgewaehlt.has(e.titleId)) abgewaehlt.set(e.titleId, e.platform)
      continue
    }
    gesehen.add(e.titleId)
    proTag.set(e.date, [...(proTag.get(e.date) ?? []), e])
  }
  const tage = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(montag, i)
    return { date, termine: (proTag.get(date) ?? []).sort(nachZeit) }
  })
  const anderswo = [...abgewaehlt]
    .filter(([id]) => !gesehen.has(id) && namen.has(id))
    .map(([id, platform]) => ({ titleId: id, name: namen.get(id)!, platform }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))
  const ruhig = [...favoriten]
    .filter((id) => !gesehen.has(id) && !abgewaehlt.has(id) && namen.has(id))
    .map((id) => ({ titleId: id, name: namen.get(id)!, naechster: naechster.get(id) }))
    .sort((a, b) => (a.naechster?.date ?? '9').localeCompare(b.naechster?.date ?? '9') || a.name.localeCompare(b.name, 'de'))
  return { tage, ruhig, anderswo }
}

/**
 * Kalenderdatei nur mit den eigenen Terminen — im Browser gebaut, nichts verlässt das Gerät.
 * Acht Wochen voraus mit Wecker; ein Abo, das sich selbst aktualisiert, bleibt dem Favoriten-Feed des Workers (`#/abo`).
 */
export function meineWocheIcs(events: ReleaseEvent[], favoriten: Set<number>, plattformen: PlatformId[], heute: string, siteUrl: string): string {
  const bis = addDays(heute, 56)
  const eigene = events.filter((e) => favoriten.has(e.titleId) && e.date >= heute && e.date <= bis && (!plattformen.length || plattformen.includes(e.platform)))
  return buildIcs(eigene, { siteUrl, calendarName: 'Meine Woche – Anime-Kalender DE', erinnerung: true })
}

/** Reicht die Datei dem Browser als Download. */
export function icsHerunterladen(inhalt: string, dateiname: string): void {
  const url = URL.createObjectURL(new Blob([inhalt], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = dateiname
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
