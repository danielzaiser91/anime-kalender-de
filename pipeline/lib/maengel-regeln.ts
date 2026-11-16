import type { Release, Title } from '../../shared/types.ts'
import { fehlendes } from '../bau/luecken-titel.ts'
import { zaehleErstausgabeOhneWeg } from './erstausgabe-ohne-weg.ts'

/**
 * **Regeltabelle des Mängel-Registers** (Entscheidung 16.11.2026, `docs/wissen/maengel.md`). Jede Mangelart ist eine Zeile: Gruppe, Wirkung, wer sie abbaut,
 * eine reine Zählfunktion je Titel und die Ausnahme mit Grund („zu Recht leer“). Eine neue Art ist eine neue Zeile, sonst nichts.
 */
/** Handliste (Kennung → Grund), von Hand gepflegt, nicht von einem Lauf geschrieben. */
export const COVER_BEKANNT_DATEI = 'data/cover-ohne-bekannt.json'

export type Gruppe = 'fehlend' | 'schwach' | 'falsch'
export type Wer = `auto:${string}` | `hand:${string}` | 'daniel'

type Synopse = { de?: string; en?: string }
type FolgenListe = { f?: [number, string][] }

/** Alles, was eine Regel außer dem Titel selbst braucht; die Eingaben lesen `13-12-maengel.ts` bzw. der Test. */
export interface Kontext {
  heute: string
  /** Kennung → Grund der Handliste (`COVER_BEKANNT_DATEI`): Titel, für die es nachweislich kein Cover gibt. */
  coverBekannt: Record<string, string>
  synopse: (id: number) => Synopse | undefined
  folgen: (id: number) => FolgenListe | undefined
  /** Titel mit mindestens einem Termin ab heute. */
  kuenftig: Set<number>
  releases: Map<number, Release[]>
  /** Titel mit einem Disc-Termin (`discTitelIds`): der Disc-Kasten ist ein Weg. */
  discTitel: ReadonlySet<number>
  /** Titel, deren Stream-Adresse bei einem anderen Titel ohne `sharedWith` wieder vorkommt. */
  adresseMehrfach: Set<number>
}

export interface Regel {
  art: string
  gruppe: Gruppe
  /** 1 = Randfeld, 2 = Panel/Filter, 3 = Besucher steht vor dem Nichts oder dem Falschen. */
  wirkung: 1 | 2 | 3
  wer: Wer
  zaehle: (t: Title, k: Kontext) => boolean
  /** Grund, warum die Lücke zu Recht besteht; sonst `undefined`. */
  ausnahme?: (t: Title, k: Kontext) => string | undefined
}

const SERIE = new Set(['TV', 'ONA', 'OVA', 'TV_SHORT'])
const KEIN_STREAM = new Set(['disc', 'kino', 'tv'])

const hatSynchro = (t: Title): boolean => Boolean(t.streams?.some((s) => s.dub === true) || t.deErstausgabe?.synchro)
const hatEinenWeg = (t: Title): boolean => Boolean(t.streams?.length || t.watchLinks?.length)
const luecke = (kuerzel: string) => (t: Title): boolean => fehlendes(t, undefined, undefined).includes(kuerzel)

/** Läuft seit Jahren ohne Ende: eine Gesamtzahl gibt es nicht (One Piece). */
const langlaeufer = (t: Title, heute: string): boolean => !t.jpEnd && Boolean(t.jpYear) && t.jpYear! <= Number(heute.slice(0, 4)) - 3

function folgentitelFehlen(t: Title, k: Kontext): boolean {
  const n = t.episodes ?? 0
  if (n < 2) return false
  const f = k.folgen(t.id)?.f ?? []
  return f.filter((x) => x[1]).length < n
}

function folgenzahlWiderspruch(t: Title, k: Kontext): boolean {
  const n = t.episodes ?? 0
  if (!n) return false
  const zuViele = (k.releases.get(t.id) ?? []).some((r) => r.releaseType !== 'disc' && (r.schedule?.episodeCount ?? 0) > n)
  return zuViele || (k.folgen(t.id)?.f?.length ?? 0) > n
}

function erschienenOhneWeg(t: Title, k: Kontext): boolean {
  const plattformen = new Set<string>((t.streams ?? []).map((s) => s.platform))
  return (k.releases.get(t.id) ?? []).some((r) => !KEIN_STREAM.has(r.platform) && (r.schedule?.firstEpisodeDate ?? '9') <= k.heute && !plattformen.has(r.platform))
}

function terminFehltLaufend(t: Title, k: Kontext): boolean {
  if (!(t.format === 'TV' || t.format === 'ONA') || !t.streams?.some((s) => s.dub === true)) return false
  return (!t.jpEnd || t.jpEnd >= k.heute) && !k.kuenftig.has(t.id)
}

export const REGELN: Regel[] = [
  { art: 'cover', gruppe: 'fehlend', wirkung: 3, wer: 'auto:tmdb-poster', zaehle: luecke('c'), ausnahme: (t, k) => (k.coverBekannt[t.id] ? 'ohne-bekanntes-cover' : undefined) },
  { art: 'banner', gruppe: 'fehlend', wirkung: 1, wer: 'auto:tmdb-banner', zaehle: (t) => !t.bannerImage },
  { art: 'titel-de', gruppe: 'fehlend', wirkung: 3, wer: 'hand:synchro-belegen', zaehle: luecke('t'), ausnahme: (t) => (hatEinenWeg(t) || t.deErstausgabe ? undefined : 'ohne-deutsche-fassung') },
  { art: 'handlung-de', gruppe: 'fehlend', wirkung: 2, wer: 'auto:anisearch', zaehle: (t, k) => !k.synopse(t.id)?.de },
  { art: 'folgentitel', gruppe: 'fehlend', wirkung: 2, wer: 'auto:tmdb', zaehle: folgentitelFehlen, ausnahme: (t) => (SERIE.has(t.format ?? '') ? undefined : 'film') },
  { art: 'folgenzahl', gruppe: 'fehlend', wirkung: 3, wer: 'auto:anilist', zaehle: (t) => SERIE.has(t.format ?? '') && !t.episodes, ausnahme: (t, k) => (langlaeufer(t, k.heute) ? 'langlaeufer' : undefined) },
  { art: 'fsk', gruppe: 'fehlend', wirkung: 2, wer: 'auto:justwatch', zaehle: (t) => t.fsk == null },
  { art: 'wertung', gruppe: 'fehlend', wirkung: 1, wer: 'auto:anilist', zaehle: (t) => !t.score },
  { art: 'studio', gruppe: 'fehlend', wirkung: 1, wer: 'auto:anilist', zaehle: (t) => !t.studios?.length },
  { art: 'genre', gruppe: 'fehlend', wirkung: 1, wer: 'auto:anilist', zaehle: (t) => !t.genres?.length },
  { art: 'laufzeit', gruppe: 'fehlend', wirkung: 1, wer: 'auto:anisearch', zaehle: (t) => !t.runtimeMin },
  { art: 'jahr', gruppe: 'fehlend', wirkung: 2, wer: 'auto:anilist', zaehle: luecke('j') },
  { art: 'sprecher', gruppe: 'fehlend', wirkung: 1, wer: 'auto:anisearch', zaehle: (t) => !t.hasVoices, ausnahme: (t) => (hatSynchro(t) ? undefined : 'ohne-synchro') },
  { art: 'kein-weg', gruppe: 'fehlend', wirkung: 3, wer: 'daniel', zaehle: (t) => !hatEinenWeg(t) },
  { art: 'erstausgabe-ohne-weg', gruppe: 'fehlend', wirkung: 3, wer: 'daniel', zaehle: (t, k) => zaehleErstausgabeOhneWeg([t], k.discTitel) === 1 },
  { art: 'termin-fehlt-laufend', gruppe: 'fehlend', wirkung: 3, wer: 'auto:anbieterkalender', zaehle: terminFehltLaufend },
  { art: 'sprachurteil-offen', gruppe: 'schwach', wirkung: 2, wer: 'hand:synchro-belegen', zaehle: (t) => Boolean(t.streams?.length) && t.streams!.every((s) => s.dub === undefined) },
  { art: 'synchro-schwach', gruppe: 'schwach', wirkung: 2, wer: 'hand:synchro-belegen', zaehle: (t) => t.dubConfidence === 'low' },
  { art: 'erschienen-ohne-weg', gruppe: 'falsch', wirkung: 3, wer: 'hand:synchro-belegen', zaehle: erschienenOhneWeg },
  { art: 'folgenzahl-widerspruch', gruppe: 'falsch', wirkung: 2, wer: 'hand:synchro-belegen', zaehle: folgenzahlWiderspruch },
  { art: 'adresse-mehrfach', gruppe: 'falsch', wirkung: 3, wer: 'hand:synchro-belegen', zaehle: (t, k) => k.adresseMehrfach.has(t.id) },
]

/** Titel mit Stream-Adresse, die auch bei einem anderen Titel steht, ohne dass `sharedWith` es erklärt. */
export function adresseMehrfach(titel: Title[]): Set<number> {
  const je = new Map<string, Set<number>>()
  for (const t of titel) for (const s of t.streams ?? []) if (!s.sharedWith) (je.get(s.url) ?? je.set(s.url, new Set()).get(s.url)!).add(t.id)
  return new Set([...je.values()].filter((ids) => ids.size > 1).flatMap((ids) => [...ids]))
}

export interface Treffer { t: number; art: string; wirkung: number; wer: Wer; grund?: string }

/** Jeder Titel mit jeder zutreffenden Regel; `grund` gesetzt = Ausnahme (zu Recht leer), sonst offen. Sortiert nach Art (Tabellenreihenfolge), dann Kennung. */
export function zaehleMaengel(titel: Title[], k: Kontext, regeln: Regel[] = REGELN): Treffer[] {
  const aus: Treffer[] = []
  for (const r of regeln) {
    for (const t of titel) {
      if (!r.zaehle(t, k)) continue
      const grund = r.ausnahme?.(t, k)
      aus.push({ t: t.id, art: r.art, wirkung: r.wirkung, wer: r.wer, ...(grund ? { grund } : {}) })
    }
  }
  const rang = new Map(regeln.map((r, i) => [r.art, i]))
  return aus.sort((a, b) => rang.get(a.art)! - rang.get(b.art)! || a.t - b.t)
}
