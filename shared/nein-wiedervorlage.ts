/**
 * Ein belegtes Nein („dort keine Synchro“, „dort nicht im Angebot“) kommt wieder zur Prüfung.
 *
 * Ein Nein entfernt den Verweis aus dem Datensatz (`pipeline/bau/09-5-weitere-quellen.ts`, `09-6-anisearch-wege.ts`).
 * Alles, was Verweise prüft, geht von den Verweisen aus; ohne Verweis fragt nichts mehr nach, und ein Anbieter,
 * der die Synchro später nachliefert, bleibt dauerhaft „nein“ (gefunden an „Snowball Earth“, 12.10.2026).
 *
 * Wiedervorlage heißt: neu messen, nie löschen. Ein Handbeleg mit Nein bleibt gültig, bis eine Quelle ihn widerlegt.
 * Fällig ist ein Nein
 *  - nach `NEIN_FRIST_TAGE` Tagen seit dem Messdatum (`checkedAt` des jüngsten Belegs in `data/dub-confirmed.yaml`) oder
 *  - sofort, wenn der Kalender oder der Anbieter nach dem Messdatum einen erschienenen, nicht geschätzten Termin
 *    (die „(Deutsch)“-Kachel, vgl. `web/src/lib/anbieter-kachel.ts`) für denselben Titel bei demselben Anbieter meldet.
 */
import { diffDays, toIsoDate } from './time.ts'
import { expandEvents, istAusgeblieben } from './logic.ts'
import type { PlatformId, Release } from './types.ts'

/** Wie lange ein Nein gilt, bevor es neu gemessen wird (wie die Crunchyroll-Wiedervorlage `--alter 28`). */
export const NEIN_FRIST_TAGE = 28

/** Der Teil eines Handbelegs (`DubCheck`), den die Regel liest. */
export interface NeinBeleg {
  anilistId: number
  platform: string
  dub?: boolean
  available?: boolean
  url?: string
  checkedAt?: string
}

export interface NeinFall {
  titleId: number
  platform: PlatformId
  /** Messdatum des Nein. */
  messAm: string
  alterTage: number
  grund: 'frist' | 'kachel'
  /** Bei `grund: 'kachel'`: der erste Tag der Kachel nach dem Messdatum. */
  kachelAm?: string
  /** Adresse aus dem Beleg, falls er eine nennt. */
  url?: string
}

const tag = (b: NeinBeleg): string => String(b.checkedAt ?? '').slice(0, 10)
const hatUrteil = (b: NeinBeleg): boolean => b.dub !== undefined || b.available !== undefined
const istNein = (b: NeinBeleg): boolean => b.dub === false || b.available === false

/** Je Titel und Anbieter der jüngste Beleg mit Urteil, sofern er ein Nein ist; ein jüngeres Ja hebt das Nein auf. */
export function juengsteNein(belege: NeinBeleg[]): NeinBeleg[] {
  const jung = new Map<string, NeinBeleg>()
  for (const b of belege) {
    if (!hatUrteil(b) || !tag(b)) continue
    const schluessel = `${b.anilistId}|${b.platform}`
    const alt = jung.get(schluessel)
    if (!alt || tag(b) >= tag(alt)) jung.set(schluessel, b)
  }
  return [...jung.values()].filter(istNein)
}

/** Erster Tag nach `messAm` bis heute, an dem der Anbieter für den Titel einen belegten, nicht ausgebliebenen Termin hat. */
function ersteKachelNach(termine: Release[], messAm: string, heute: string): string | undefined {
  let erste: string | undefined
  for (const r of termine) {
    for (const e of expandEvents(r)) {
      if (e.estimated || e.date <= messAm || e.date > heute || istAusgeblieben(e)) continue
      if (!erste || e.date < erste) erste = e.date
    }
  }
  return erste
}

/**
 * Alle Nein, die jetzt neu gemessen werden sollen, das älteste zuerst.
 * `releases` sind die Termine aus `public/data/releases.json`.
 */
export function neinWiedervorlage(belege: NeinBeleg[], releases: Release[], jetzt: Date): NeinFall[] {
  const heute = toIsoDate(jetzt)
  const jeWeg = new Map<string, Release[]>()
  for (const r of releases) {
    const schluessel = `${r.titleId}|${r.platform}`
    jeWeg.set(schluessel, [...(jeWeg.get(schluessel) ?? []), r])
  }
  const faelle: NeinFall[] = []
  for (const b of juengsteNein(belege)) {
    const messAm = tag(b)
    const alterTage = diffDays(messAm, heute)
    const kachelAm = ersteKachelNach(jeWeg.get(`${b.anilistId}|${b.platform}`) ?? [], messAm, heute)
    if (!kachelAm && alterTage < NEIN_FRIST_TAGE) continue
    faelle.push({
      titleId: b.anilistId,
      platform: b.platform as PlatformId,
      messAm,
      alterTage,
      grund: kachelAm ? 'kachel' : 'frist',
      ...(kachelAm ? { kachelAm } : {}),
      ...(b.url ? { url: b.url } : {}),
    })
  }
  return faelle.sort((a, b) => b.alterTage - a.alterTage || a.titleId - b.titleId)
}
