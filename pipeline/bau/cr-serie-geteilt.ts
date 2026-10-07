import type { Title } from '../../shared/types.ts'
import { readJson } from '../lib/util.ts'

/**
 * **Eine Crunchyroll-Serie mit einer Staffel gehört einem Titel, nicht jedem, der auf sie zeigt.**
 *
 * „Tokyo Revengers" führt bei Crunchyroll genau eine Staffel mit 24 Folgen, alle deutsch — das ist Staffel 1. Auf dieselbe
 * Kennung zeigen aber auch Staffel 2 (13 Folgen), Tenjiku (13) und „War of the Three Titans" (13). Die Staffeln 2 und 3 liefen
 * auf Deutsch nur bei Disney+; unser Kalender behauptete am 04.10.2026 trotzdem „Neu auf Deutsch bei Crunchyroll" (Daniel).
 *
 * **Eng gefasst, weil die Katalogzahl oft unvollständig ist:** Ein erster Entwurf entfernte jeden Titel, dessen Folgensumme
 * die Katalogzahl übersteigt, und hätte 20 Wege gekappt, darunter Dragon Ball, Hunter x Hunter und Spice and Wolf — dort
 * führt Crunchyroll nur einen Teil der Folgen, die Wege selbst stimmen. Es gibt deshalb nur dann einen Eigentümer, wenn
 * **mindestens zwei** Titel an der Serie hängen, deren Summe die Katalogzahl übersteigt, und **genau einer** davon die
 * Folgenzahl der Serie hat. Alle anderen sind fremd. Ohne eindeutigen Eigentümer bleibt alles, wie es ist.
 */
export type KennungVon = (url: string) => string | undefined

export interface SerienBesitz {
  anzahlTitel: number
  summe: number
  /** Der einzige Titel mit genau der Folgenzahl der Serie, wenn es ihn gibt. */
  besitzer?: number
}

type Katalog = Map<string, { folgen?: number; staffeln?: number }>

export function serienBesitz(titles: Map<number, Title>, kennungVon: KennungVon, katalog: Katalog): Map<string, SerienBesitz> {
  const gruppen = new Map<string, Title[]>()
  for (const t of titles.values()) {
    const s = t.streams.find((x) => x.platform === 'crunchyroll')
    const kennung = s && kennungVon(s.url)
    if (kennung) gruppen.set(kennung, [...(gruppen.get(kennung) ?? []), t])
  }
  const aus = new Map<string, SerienBesitz>()
  for (const [kennung, titel] of gruppen) {
    const folgen = katalog.get(kennung)?.folgen
    const summe = titel.reduce((z, t) => z + (t.episodes ?? 0), 0)
    const passende = folgen === undefined ? [] : titel.filter((t) => t.episodes === folgen)
    aus.set(kennung, { anzahlTitel: titel.length, summe, ...(passende.length === 1 ? { besitzer: passende[0]!.id } : {}) })
  }
  return aus
}

/** Ist der Titel an dieser Serie fremd — hängt sie an mehreren Titeln, deren Summe sie übersteigt, und gehört sie einem anderen? */
export function istFremd(besitz: Map<string, SerienBesitz>, kennung: string, titleId: number, katalogFolgen: number | undefined): boolean {
  const b = besitz.get(kennung)
  return Boolean(b && katalogFolgen !== undefined && b.anzahlTitel >= 2 && b.summe > katalogFolgen && b.besitzer !== undefined && b.besitzer !== titleId)
}

/** Bei den fremden Titeln fällt der Crunchyroll-Weg weg (Daniel, 04.10.2026: Christmas Showdown, Tenjiku Arc und War of the Three Titans liefen nie bei Crunchyroll). */
export function entferneFremdeCrWege(titles: Map<number, Title>, katalog: Katalog, besitz: Map<string, SerienBesitz>, kennungVon: KennungVon): number {
  let weg = 0
  for (const t of titles.values()) {
    const s = t.streams.find((x) => x.platform === 'crunchyroll')
    const kennung = s && kennungVon(s.url)
    const eintrag = kennung ? katalog.get(kennung) : undefined
    if (!kennung || !eintrag || (eintrag.staffeln ?? 0) !== 1 || !istFremd(besitz, kennung, t.id, eintrag.folgen)) continue
    t.streams = t.streams.filter((x) => x !== s)
    weg++
  }
  return weg
}

/**
 * **Beim Anlegen:** Die Katalog-Runde in `09-6-anisearch-wege.ts` legt Crunchyroll-Wege über den **Namen** an (`crAdresseZu`):
 * „Tokyo Revengers Season 2" beginnt mit „Tokyo Revengers" und bekam die Serie von Staffel 1 — nach der Entfernung oben.
 * Hat die einstufige Serie schon einen Eigentümer (ein anderer Titel mit genau ihrer Folgenzahl und einem Weg dorthin),
 * bekommt kein weiterer Titel mit anderer Folgenzahl einen Weg an sie.
 */
export function gehoertAnderem(titles: Map<number, Title>, kennung: string, title: Title, katalog: Katalog, kennungVon: KennungVon): boolean {
  const k = katalog.get(kennung)
  if (!k || (k.staffeln ?? 0) !== 1 || k.folgen === undefined || title.episodes === k.folgen) return false
  for (const t of titles.values()) {
    if (t.id === title.id || t.episodes !== k.folgen) continue
    const s = t.streams.find((x) => x.platform === 'crunchyroll')
    if (s && kennungVon(s.url) === kennung) return true
  }
  return false
}

let katalogGeladen: Katalog | undefined
/** Der deutsche Crunchyroll-Katalog je Serienkennung (Folgen, Staffeln), einmal gelesen. */
export function crKatalog(): Katalog {
  katalogGeladen ??= new Map(
    (readJson<{ eintraege?: { id: string; folgen?: number; staffeln?: number }[] }>('data/cr-katalog-de.json', {}).eintraege ?? []).map((e) => [e.id, e]),
  )
  return katalogGeladen
}

let aufloeser: KennungVon | undefined
/** Serienkennung aus der Adresse, sonst aus dem Kennungsgedächtnis — wie die Katalog-Runde in `09-4-3-katalog.ts`. */
export function kennungAusAdresse(): KennungVon {
  if (aufloeser) return aufloeser
  const kern = (u: string): string => u.replace(/^https?:\/\//, '').replace(/^www\./, '').split('?')[0]!.replace(/\/$/, '').toLowerCase()
  const gedaechtnis = readJson<{ adressen?: Record<string, { seriesId?: string }> }>('data/crunchyroll-series-ids.json', {}).adressen ?? {}
  const je = new Map(Object.entries(gedaechtnis).filter(([, v]) => v.seriesId).map(([u, v]) => [kern(u), v.seriesId as string]))
  aufloeser = (u) => /\/series\/([A-Z0-9]+)/.exec(u)?.[1] ?? je.get(kern(u))
  return aufloeser
}

let staffelzahlenGeladen: Map<string, number[]> | undefined
/** Die Folgenzahlen der deutschen Staffeln je Serienkennung, wie die Inhaltsschnittstelle sie zuletzt führte (`data/crunchyroll-dub.json`). */
export function crStaffelzahlen(): Map<string, number[]> {
  if (staffelzahlenGeladen) return staffelzahlenGeladen
  const jung = new Map<string, { geprueftAm: string; zahlen: number[] }>()
  for (const e of readJson<{ serien?: { seriesId?: string; geprueftAm?: string; staffeln?: { folgen?: number }[] }[] }>('data/crunchyroll-dub.json', {}).serien ?? []) {
    const zahlen = (e.staffeln ?? []).map((st) => st.folgen).filter((n): n is number => typeof n === 'number' && n > 0)
    if (!e.seriesId || !zahlen.length) continue
    const alt = jung.get(e.seriesId)
    if (!alt || String(e.geprueftAm) > alt.geprueftAm) jung.set(e.seriesId, { geprueftAm: String(e.geprueftAm), zahlen })
  }
  staffelzahlenGeladen = new Map([...jung].map(([k, v]) => [k, v.zahlen]))
  return staffelzahlenGeladen
}

/**
 * **Hat jede Staffel der Serie genau einen Titel mit ihrer Folgenzahl, gehört die Serie diesen Titeln — alle anderen an ihr sind fremd**
 * (Daniel, 07.10.2026, Black Butler: Die Serie führt bei Crunchyroll zwei deutsche Staffeln, Public School Arc mit 11 und Emerald Witch Arc mit 13 Folgen.
 * Auf sie zeigten neun Titel, darunter Staffel 1 von 2008 mit 24 Folgen — genau die Summe der beiden — und sie trug „alle 24 Folgen auf Deutsch" samt
 * Crunchyroll-Pille, obwohl keine ihrer Folgen dort liegt.)
 *
 * Eng gefasst: Es zählt nur, wenn **jede** Staffel (Folgenzahl) von genau so vielen Titeln getroffen wird, wie die Serie Staffeln mit dieser Zahl hat.
 * Fasst Crunchyroll zusammen, was AniList trennt (Haikyu, Tokyo Ghoul), geht die Rechnung nicht auf — dann bleibt alles, wie es ist.
 */
export function entferneFremdeNachStaffeln(titles: Map<number, Title>, kennungVon: KennungVon, staffelzahlen: Map<string, number[]> = crStaffelzahlen()): number {
  const anSerie = new Map<string, Title[]>()
  for (const t of titles.values()) {
    const s = t.streams.find((x) => x.platform === 'crunchyroll')
    const kennung = s && kennungVon(s.url)
    if (kennung && staffelzahlen.has(kennung)) anSerie.set(kennung, [...(anSerie.get(kennung) ?? []), t])
  }
  let weg = 0
  for (const [kennung, ts] of anSerie) {
    const zahlen = staffelzahlen.get(kennung)!
    if (ts.length < 2) continue
    const jeZahl = new Map<number, number>()
    for (const z of zahlen) jeZahl.set(z, (jeZahl.get(z) ?? 0) + 1)
    const aufgeht = [...jeZahl].every(([z, anzahl]) => ts.filter((t) => t.episodes === z).length === anzahl)
    if (!aufgeht) continue
    for (const t of ts) {
      if (t.episodes !== undefined && jeZahl.has(t.episodes)) continue
      t.streams = t.streams.filter((x) => !(x.platform === 'crunchyroll' && kennungVon(x.url) === kennung))
      weg++
    }
  }
  return weg
}
