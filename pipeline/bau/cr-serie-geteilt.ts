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

export interface CrStaffel {
  name: string
  folgen: number
}

let staffelnGeladen: Map<string, CrStaffel[]> | undefined
/** Die deutschen Staffeln je Serienkennung (Name, Folgenzahl), wie die Inhaltsschnittstelle sie zuletzt führte (`data/crunchyroll-dub.json`). */
export function crStaffeln(): Map<string, CrStaffel[]> {
  if (staffelnGeladen) return staffelnGeladen
  const jung = new Map<string, { geprueftAm: string; staffeln: CrStaffel[] }>()
  for (const e of readJson<{ serien?: { seriesId?: string; geprueftAm?: string; staffeln?: { name?: string; folgen?: number }[] }[] }>('data/crunchyroll-dub.json', {}).serien ?? []) {
    const staffeln = (e.staffeln ?? []).filter((st): st is { name: string; folgen: number } => typeof st.folgen === 'number' && st.folgen > 0 && typeof st.name === 'string')
    if (!e.seriesId || !staffeln.length) continue
    const alt = jung.get(e.seriesId)
    if (!alt || String(e.geprueftAm) > alt.geprueftAm) jung.set(e.seriesId, { geprueftAm: String(e.geprueftAm), staffeln })
  }
  staffelnGeladen = new Map([...jung].map(([k, v]) => [k, v.staffeln]))
  return staffelnGeladen
}

const FUELL = new Set(['the', 'of', 'and', 'season', 'staffel', 'german', 'dub', 'deutsch', 'part', 'cour', 'tv', 'st', 'nd', 'rd', 'th'])
/** Die tragenden Wörter eines Namens: klein, ohne Satzzeichen und Füllwörter. */
function woerterVon(text: string | undefined): string[] {
  return (text ?? '').toLowerCase().normalize('NFKD').split(/[^\p{L}\p{N}]+/u).filter((w) => w && !FUELL.has(w))
}

/** Gehört dieser Staffelname zu diesem Titel? Jedes tragende Wort der Staffel muss in einem Namen des Titels stehen („Public School Arc" in „Black Butler: Public School Arc"). */
export function staffelNameStimmt(staffelName: string, titel: Title): boolean {
  const gesucht = woerterVon(staffelName)
  if (!gesucht.length) return false
  const vorhanden = new Set([titel.titleEn, titel.titleRomaji, titel.titleDe].flatMap((n) => woerterVon(n)))
  return gesucht.every((w) => vorhanden.has(w))
}

/**
 * **Hat jede Staffel der Serie genau einen Titel, der ihr nach Folgenzahl UND Namen entspricht, gehört die Serie diesen Titeln — alle anderen an ihr sind fremd**
 * (Daniel, 07.10.2026, Black Butler: Die Serie führt bei Crunchyroll zwei deutsche Staffeln, „-Public School Arc-" mit 11 und „-Emerald Witch Arc-" mit 13 Folgen.
 * Auf sie zeigten neun Titel, darunter Staffel 1 von 2008 mit 24 Folgen — genau die Summe der beiden — mit „alle 24 Folgen auf Deutsch" und Crunchyroll-Pille,
 * obwohl keine ihrer Folgen dort liegt.)
 *
 * **Eine Folgenzahl allein bestätigt nichts** (Daniel, 07.10.2026: „es muss eindeutig bestätigt werden"): Erst der Staffelname im Namen des Titels macht aus der
 * Zählgleichheit eine Zuordnung. Fehlt er irgendwo (Crunchyroll nennt „Tsubasa Chronicle", wir „Tsubasa RESERVoir CHRoNiCLE"), geht die Rechnung nicht auf und alles
 * bleibt, wie es ist. Ebenso, wo Crunchyroll zusammenfasst, was AniList trennt (Haikyu, Tokyo Ghoul).
 */
export function entferneFremdeNachStaffeln(titles: Map<number, Title>, kennungVon: KennungVon, staffeln: Map<string, CrStaffel[]> = crStaffeln()): number {
  const anSerie = new Map<string, Title[]>()
  for (const t of titles.values()) {
    const s = t.streams.find((x) => x.platform === 'crunchyroll')
    const kennung = s && kennungVon(s.url)
    if (kennung && staffeln.has(kennung)) anSerie.set(kennung, [...(anSerie.get(kennung) ?? []), t])
  }
  let weg = 0
  for (const [kennung, ts] of anSerie) {
    if (ts.length < 2) continue
    const frei = new Set(ts)
    const zugeordnet = new Set<Title>()
    let aufgeht = true
    for (const st of staffeln.get(kennung)!) {
      const kandidaten = [...frei].filter((t) => t.episodes === st.folgen && staffelNameStimmt(st.name, t))
      if (kandidaten.length !== 1) {
        aufgeht = false
        break
      }
      zugeordnet.add(kandidaten[0]!)
      frei.delete(kandidaten[0]!)
    }
    if (!aufgeht) continue
    for (const t of ts) {
      if (zugeordnet.has(t)) continue
      t.streams = t.streams.filter((x) => !(x.platform === 'crunchyroll' && kennungVon(x.url) === kennung))
      weg++
    }
  }
  return weg
}
