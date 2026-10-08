/**
 * **Aussage → Titel im Bestand**, nach den Projektregeln: der beste Treffer gewinnt, nicht der erste
 * (Wortvergleich wie `bewerteTreffer` in `adn.ts`), ein Namensvergleich allein ist kein Beleg — bei einem
 * Simulcast muss der Japan-Start (`jpStart`) zum genannten Tag passen (±3 Tage), sonst bleibt die Aussage
 * offen. Katalogtitel (alte Serien, „12 (komplett)") haben keinen solchen Anker; dort zählt nur ein
 * eindeutiger Name, und die Zuordnung trägt das als `wie: 'name-genau'` sichtbar.
 */
import type { Aussage } from './aussagen.ts'
import { diffDays } from '../../shared/time.ts'

export interface KatalogTitel {
  id: number
  titleDe?: string
  titleEn?: string
  titleRomaji?: string
  format?: string
  jpYear?: number
  jpStart?: string
  franchiseId?: number
  synonyme?: string[]
}

export interface Zuordnung {
  anilistId: number
  name: string
  wie: 'name+start' | 'name-genau' | 'name-teil'
  /** Tage zwischen genanntem Tag und `jpStart`, wo beides bekannt ist. */
  abstandTage?: number
  /** Was der Bau noch entscheiden muss: „Staffel 4 bis 8" meint Folgen, nicht den Titel. */
  vorbehalt?: string
}

/** Bis zu so vielen Tagen Abstand gilt ein Simulcast-Tag als Anker für den Japan-Start (Netflix zeigt oft eine Woche später). */
export const ANKER_TAGE = 7
/** Titel aus dem aniSearch-Katalog ohne AniList-Kennung tragen Kennungen ab hier — sie doppeln oft einen AniList-Titel. */
const ANISEARCH_AB = 10_000_000

export interface Offen {
  grund: string
  kandidaten: { id: number; name: string; jpStart?: string }[]
}

const ROEMISCH: Record<string, number> = { ii: 2, iii: 3, iv: 4, v: 5, vi: 6 }
const ORDINAL: Record<string, number> = { second: 2, third: 3, fourth: 4, fifth: 5, zweite: 2, dritte: 3, vierte: 4 }
/** Wörter, die beim Wortvergleich nichts unterscheiden („the Movie" gegen „Der Film") — „film"/„movie" zählen stattdessen als Formatwunsch. */
const FUELLWORT = new Set(['the', 'der', 'die', 'das', 'movie', 'film', 'of', 'and', 'und', 'part', 'story'])

/**
 * Welches Format die Frage verlangt: „Film 3", „The Movie" → nur Filme; „Staffel 3", „Season 2" → keine Filme.
 * Ohne diese Regel traf „Ranma 1/2 – Staffel 3" den Film 3 und „Utena: The Movie" die Serie (gemessen 08.10.2026).
 */
function formatWunsch(a: Pick<Aussage, 'titel' | 'zusatz'>): 'film' | 'serie' | undefined {
  const text = `${a.titel} ${a.zusatz ?? ''}`
  if (/\b(film|movie|the movie|der film)\b/i.test(text)) return 'film'
  if (/\b(staffel|season|cour)\b/i.test(text)) return 'serie'
  return undefined
}

function passtFormat(t: KatalogTitel, wunsch: ReturnType<typeof formatWunsch>): boolean {
  if (!wunsch || !t.format) return true
  return wunsch === 'film' ? t.format === 'MOVIE' : t.format !== 'MOVIE'
}

/** Vergleichbar machen: Kleinschrift, ohne Diakritika und Satzzeichen, Staffel-, Teil- und Filmnummern als „s2". */
export function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’'`´]/g, '')
    .replace(/\b(\d+)(?:st|nd|rd|th)\s+season\b/g, 's$1')
    .replace(/\b(second|third|fourth|fifth|zweite|dritte|vierte)\s+(?:season|staffel)\b/g, (_, w) => `s${ORDINAL[w]}`)
    .replace(/\b(?:season|staffel|part|teil|cour|film|movie)\s*(\d+)\b/g, 's$1')
    .replace(/\b(ii|iii|iv|v|vi)\b\s*$/, (_, r) => `s${ROEMISCH[r]}`)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const woerter = (s: string) =>
  new Set(normName(s).split(' ').filter((w) => (w.length >= 3 && !FUELLWORT.has(w)) || /^s\d$/.test(w) || /^\d+$/.test(w)))

/** Wie bei `bewerteTreffer`: geteilte Wörter doppelt, fremde und fehlende je einfach dagegen. */
function punkte(frage: Set<string>, name: string): { punkte: number; fehlend: number } {
  const ihre = woerter(name)
  let geteilt = 0, fremd = 0, fehlend = 0
  for (const w of ihre) (frage.has(w) ? geteilt++ : fremd++)
  for (const w of frage) if (!ihre.has(w)) fehlend++
  return { punkte: geteilt * 2 - fremd - fehlend, fehlend }
}

export function anzeige(t: KatalogTitel): string {
  return t.titleDe ?? t.titleEn ?? t.titleRomaji ?? String(t.id)
}

function namenVon(t: KatalogTitel): string[] {
  return [t.titleDe, t.titleEn, t.titleRomaji, ...(t.synonyme ?? [])].filter((n): n is string => Boolean(n))
}

/**
 * Suchnamen aus Titel und Zusatz: „Aoashi" + „Staffel 2" → „aoashi s2" (und „aoashi" bei Staffel 1).
 * Ein Zusatz, der keine einzelne Staffel nennt („Staffel 4 bis 8", „Episode 121 bis 240"), sucht den
 * Titel selbst und kommt als Vorbehalt an die Zuordnung.
 */
function fragen(a: Pick<Aussage, 'titel' | 'zusatz'>): { namen: string[]; vorbehalt?: string } {
  const basis = normName(a.titel)
  if (!a.zusatz) return { namen: [basis] }
  const nr = /^(?:staffel|season|part|teil)\s*(\d+)$/i.exec(a.zusatz)?.[1]
  if (nr) return { namen: nr === '1' ? [`${basis} s1`, basis] : [`${basis} s${nr}`] }
  return { namen: [normName(`${a.titel} ${a.zusatz}`), basis], vorbehalt: `Zusatz „${a.zusatz}" nicht aufgelöst` }
}

/** Ein aniSearch-Doppel desselben Jahres neben einem AniList-Titel ist derselbe Titel — der AniList-Eintrag gilt. */
function ohneAnisearchDoppel(kand: KatalogTitel[]): KatalogTitel[] {
  const anilist = kand.filter((t) => t.id < ANISEARCH_AB)
  if (!anilist.length || anilist.length === kand.length) return kand
  const rest = kand.filter((t) => t.id >= ANISEARCH_AB && !anilist.some((a) => a.jpYear === t.jpYear))
  return [...anilist, ...rest]
}

export class Katalog {
  private genau = new Map<string, Set<number>>()
  private nachId = new Map<number, KatalogTitel>()
  constructor(titel: KatalogTitel[]) {
    for (const t of titel) {
      this.nachId.set(t.id, t)
      for (const n of namenVon(t)) {
        const k = normName(n)
        if (!this.genau.has(k)) this.genau.set(k, new Set())
        this.genau.get(k)!.add(t.id)
      }
    }
  }

  titel(id: number): KatalogTitel | undefined { return this.nachId.get(id) }

  /** Kandidaten nach Namen: erst genau, dann die beste Wortdeckung ohne fehlendes Wort. */
  kandidaten(a: Pick<Aussage, 'titel' | 'zusatz'>): { ids: number[]; wie: Zuordnung['wie']; vorbehalt?: string } {
    const { namen, vorbehalt } = fragen(a)
    const wunsch = formatWunsch(a)
    for (const f of namen) {
      const ids = [...(this.genau.get(f) ?? [])].filter((id) => passtFormat(this.nachId.get(id)!, wunsch))
      if (ids.length) return { ids, wie: 'name-genau', ...(vorbehalt ? { vorbehalt } : {}) }
    }
    const ids = this.teilKandidaten(a)
    return { ids, wie: 'name-teil', ...(vorbehalt ? { vorbehalt } : {}) }
  }

  /**
   * Wortvergleich erst mit der vollen Frage („aoashi s2"), dann ohne Zusatz — aber nie ohne Staffelnummer.
   * Standard: nur die besten Treffer; `alle` liefert jeden Titel, der alle Wörter der Frage trägt („Hotel
   * Inhumans (2026)" neben „HOTEL INHUMANS"), damit der Japan-Start entscheiden kann.
   */
  teilKandidaten(a: Pick<Aussage, 'titel' | 'zusatz'>, alle = false): number[] {
    const { namen } = fragen(a)
    const wunsch = formatWunsch(a)
    for (const f of namen.length > 1 && /\ss\d$/.test(namen[0]!) && !namen[0]!.endsWith(' s1') ? [namen[0]!] : namen) {
      const frage = woerter(f)
      if (!frage.size) continue
      const treffer = new Map<number, number>()
      for (const t of this.nachId.values()) {
        if (!passtFormat(t, wunsch)) continue
        for (const n of namenVon(t)) {
          const p = punkte(frage, n)
          if (!p.fehlend) treffer.set(t.id, Math.max(treffer.get(t.id) ?? -Infinity, p.punkte))
        }
      }
      if (!treffer.size) continue
      const beste = Math.max(...treffer.values())
      return [...treffer].filter(([, p]) => alle || p === beste).map(([id]) => id)
    }
    return []
  }
}

/** Ist die Aussage ein Simulcast mit Tag, bei dem der Tag zum Japan-Start passen muss? (Ein bloßer Monat ankert nicht.) */
function brauchtStartAnker(a: Aussage): boolean {
  return a.datum?.length === 10 && (a.art === 'omu-start' || Boolean(a.woechentlich))
}

export function ordneZu(a: Aussage, katalog: Katalog): { zuordnung?: Zuordnung; offen?: Offen } {
  const { ids, wie, vorbehalt } = katalog.kandidaten(a)
  const kand = ohneAnisearchDoppel(ids.map((id) => katalog.titel(id)!))
  const beschreibe = (t: KatalogTitel) => ({ id: t.id, name: anzeige(t), ...(t.jpStart ? { jpStart: t.jpStart } : {}) })
  const treffer = (t: KatalogTitel, wie: Zuordnung['wie'], abstand?: number): { zuordnung: Zuordnung } => ({
    zuordnung: { anilistId: t.id, name: anzeige(t), wie, ...(abstand !== undefined ? { abstandTage: abstand } : {}), ...(vorbehalt ? { vorbehalt } : {}) },
  })
  if (!kand.length) return { offen: { grund: 'kein Titel mit diesem Namen', kandidaten: [] } }

  if (brauchtStartAnker(a)) {
    const abstandVon = (t: KatalogTitel) => (t.jpStart ? Math.abs(diffDays(t.jpStart, a.datum!)) : undefined)
    const mitAbstand = kand.map((t) => ({ t, abstand: abstandVon(t) }))
    let passend = mitAbstand.filter((x) => x.abstand !== undefined && x.abstand <= ANKER_TAGE)
    /*
      Trifft der genaue Name nur die falsche Staffel („HOTEL INHUMANS" → Staffel 1 von 2025), entscheidet der
      Japan-Start unter den Wortvergleichs-Kandidaten („Hotel Inhumans (2026)") — Name und Start, nie Name allein.
    */
    if (!passend.length && wie === 'name-genau') {
      const weitere = katalog.teilKandidaten(a, true).filter((id) => !ids.includes(id)).map((id) => katalog.titel(id)!)
      passend = weitere.map((t) => ({ t, abstand: abstandVon(t) })).filter((x) => x.abstand !== undefined && x.abstand <= ANKER_TAGE)
    }
    if (passend.length === 1) return treffer(passend[0]!.t, 'name+start', passend[0]!.abstand)
    if (passend.length > 1) return { offen: { grund: 'mehrere Titel mit passendem Japan-Start', kandidaten: passend.map((x) => beschreibe(x.t)) } }
    /* Ein einziger Kandidat ohne bekannten Japan-Start: das Jahr muss passen, mehr lässt sich nicht prüfen — `wie` sagt es. */
    const ohneStart = mitAbstand.filter((x) => x.abstand === undefined)
    if (ohneStart.length === 1 && kand.length === 1) {
      const t = ohneStart[0]!.t
      if (!t.jpYear || Math.abs(t.jpYear - Number(a.datum!.slice(0, 4))) <= 1) return treffer(t, wie)
    }
    return {
      offen: {
        grund: `Japan-Start passt nicht zum genannten Tag ${a.datum} (${mitAbstand.map((x) => `${anzeige(x.t)}: ${x.t.jpStart ?? 'ohne Start'}`).join('; ')})`,
        kandidaten: kand.map(beschreibe),
      },
    }
  }

  if (kand.length === 1) {
    const t = kand[0]!
    return treffer(t, wie, a.datum?.length === 10 && t.jpStart ? Math.abs(diffDays(t.jpStart, a.datum)) : undefined)
  }
  /* Gleichnamige Titel („Magic Knight Rayearth" 1994 und 2026): auch ohne Simulcast-Vermerk entscheidet ein Japan-Start nahe am Tag. */
  if (a.datum?.length === 10) {
    const nah = kand.map((t) => ({ t, abstand: t.jpStart ? Math.abs(diffDays(t.jpStart, a.datum!)) : undefined })).filter((x) => x.abstand !== undefined && x.abstand <= ANKER_TAGE)
    if (nah.length === 1) return treffer(nah[0]!.t, 'name+start', nah[0]!.abstand)
  }
  return { offen: { grund: `${kand.length} Titel mit diesem Namen`, kandidaten: kand.map(beschreibe) } }
}
