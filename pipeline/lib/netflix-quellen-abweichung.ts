/**
 * Ein Titel (bei AniList immer eine Staffel), zwei Netflix-Kennungen aus verschiedenen Quellen: Datensatz (AniList-Verweis),
 * aniSearch, JustWatch. Welche stimmt, weiß nur ein Mensch (Umleitung oder zweite Seite); der Wächter zählt die Fälle und
 * verlangt, dass jeder auf der Prüfliste (`data/erneut-melden.yaml`) steht oder als Umleitung entschieden ist.
 * Anlass: sieben Titel nach dem Ranma-Fix (25.10.2026).
 */
import { NETFLIX_UMGELEITET } from './netflix-adresse.ts'
import { netflixKennungAusAdresse } from './netflix-doppelte-kennung.ts'

export type QuellenTitel = {
  id: number
  anisearchId?: number
  streams?: { platform?: string; url?: string }[]
}
type Angebote = { angebote?: { url?: string }[] }
export type QuellenDateien = {
  anisearch: Record<string, { anisearchId?: number; streams?: { url?: string }[] } | undefined>
  justwatch: Record<string, Angebote | undefined>
}
export type Abweichung = { id: number; kennungen: Record<string, string[]> }

const kennungen = (urls: (string | undefined)[]): string[] => {
  const alle = urls.map((u) => netflixKennungAusAdresse(u)).filter((k): k is string => !!k)
  return [...new Set(alle.map((k) => NETFLIX_UMGELEITET[k] ?? k))].sort()
}

/** Titel, deren Quellen verschiedene (nach Umleitung) Netflix-Kennungen nennen. */
export function abweichendeNetflixKennungen(titel: QuellenTitel[], dateien: QuellenDateien): Abweichung[] {
  const anisearchNach = new Map<number, string[]>()
  for (const e of Object.values(dateien.anisearch)) {
    if (e?.anisearchId != null) anisearchNach.set(e.anisearchId, kennungen((e.streams ?? []).map((s) => s.url)))
  }
  const funde: Abweichung[] = []
  for (const t of titel) {
    const quellen: Record<string, string[]> = {
      datensatz: kennungen((t.streams ?? []).filter((s) => s.platform === 'netflix').map((s) => s.url)),
      anisearch: t.anisearchId == null ? [] : (anisearchNach.get(t.anisearchId) ?? []),
      justwatch: kennungen((dateien.justwatch[String(t.id)]?.angebote ?? []).map((a) => a.url)),
    }
    if (new Set(Object.values(quellen).flat()).size >= 2) funde.push({ id: t.id, kennungen: quellen })
  }
  return funde
}

/** Kennungen der Titel, deren Netflix-Seite heute auf der offenen Prüfliste steht (`pruefstand.json`, Anbieter netflix: `ziele`). */
export function titelAufPruefliste(titel: QuellenTitel[], zielUrls: string[]): Set<number> {
  const ziele = new Set(kennungen(zielUrls))
  const ids = titel.filter((t) => kennungen((t.streams ?? []).filter((s) => s.platform === 'netflix').map((s) => s.url)).some((k) => ziele.has(k)))
  return new Set(ids.map((t) => t.id))
}

/** Teilt die Funde: auf der Prüfliste (Netflix) oder ohne. */
export function nachPruefliste(funde: Abweichung[], aufListe: ReadonlySet<number>): { aufListe: Abweichung[]; offen: Abweichung[] } {
  return { aufListe: funde.filter((f) => aufListe.has(f.id)), offen: funde.filter((f) => !aufListe.has(f.id)) }
}
