import type { Release, Title } from '../../shared/types.ts'
import { istSichererTermin } from '../bau/11-7-wege-aus-terminen.ts'
import { fehlendes } from '../bau/luecken-titel.ts'
import { zaehleErstausgabeOhneWeg } from './erstausgabe-ohne-weg.ts'
import { folgenzahlAusnahme, type FranchiseTeil } from './folgenzahl-erklaerung.ts'
import { herkunftFremderTitel } from './herkunft-fremder-titel.ts'
import { ohneSprachurteil } from './ohne-sprachurteil.ts'
import { STAFFEL_AUSNAHME, type StaffelBefund } from './maengel-staffel.ts'

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
  /** Titel, deren Stream-Adresse bei einem anderen Titel wieder vorkommt (`adresseMehrfach`). */
  adresseMehrfach: Map<number, 'fremd' | 'franchise'>
  /** Titel, deren Staffel-Zuordnung an einer geteilten Netflix-Adresse nicht zur Staffelliste des Anbieters passt (`staffelZuordnung`). */
  staffelZuordnung: Map<number, StaffelBefund>
  /** Die anderen Titel desselben Franchise (Format, Folgenzahl), ohne den Titel selbst. */
  franchiseTeile: (t: Title) => FranchiseTeil[]
  /** Verneint ein Handbeleg die Plattform für einen Termin ab diesem Tag (`baueNeinGilt`)? */
  neinGilt: (id: number, plattform: string, ab: string) => boolean
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

/**
 * Läuft noch: eine Gesamtzahl der Folgen gibt es nicht (One Piece, Beyblade X). Ohne `jpEnd` zählt nur Belegtes:
 * nicht FINISHED/CANCELLED und RELEASING, Termin ab heute, Jahr dieses Jahres oder gar kein Jahr; eine alte
 * abgeschlossene Serie ohne `jpEnd` bleibt offen (Mängelregister, PR 4046).
 */
function laeuftNoch(t: Title, k: Kontext): boolean {
  if (t.jpEnd) return t.jpEnd >= k.heute
  if (t.jpStatus === 'FINISHED' || t.jpStatus === 'CANCELLED') return false
  if (t.jpStatus === 'RELEASING' || !t.jpYear || t.jpYear >= Number(k.heute.slice(0, 4))) return true
  return k.kuenftig.has(t.id)
}

function folgentitelFehlen(t: Title, k: Kontext): boolean {
  const n = t.episodes ?? 0
  if (n < 2) return false
  const f = k.folgen(t.id)?.f ?? []
  return f.filter((x) => x[1]).length < n
}

const listenLaenge = (t: Title, k: Kontext): number => k.folgen(t.id)?.f?.length ?? 0

function folgenzahlWiderspruch(t: Title, k: Kontext): boolean {
  const n = t.episodes ?? 0
  if (!n) return false
  const zuViele = (k.releases.get(t.id) ?? []).some((r) => r.releaseType !== 'disc' && (r.schedule?.episodeCount ?? 0) > n)
  return zuViele || listenLaenge(t, k) > n
}

/** Streaming-Termine mit Quelle, die begonnen haben, ohne dass der Titel einen Weg zu dieser Plattform führt. */
function begonnenOhneWegAlle(t: Title, k: Kontext): Release[] {
  const plattformen = new Set<string>((t.streams ?? []).map((s) => s.platform))
  return (k.releases.get(t.id) ?? []).filter(
    (r) => !KEIN_STREAM.has(r.platform) && r.releaseType !== 'disc' && (r.sources?.length ?? 0) > 0 && (r.schedule?.firstEpisodeDate ?? '9') <= k.heute && !plattformen.has(r.platform),
  )
}

/** Die sicheren davon (wie `11-7`: belegt, nicht geschätzt): Dort müsste ein Weg stehen. Ein geschätzter Termin baut keinen (`termin-geschaetzt-ohne-weg`). */
const begonnenOhneWeg = (t: Title, k: Kontext): Release[] => begonnenOhneWegAlle(t, k).filter(istSichererTermin)

const erschienenOhneWeg = (t: Title, k: Kontext): boolean => begonnenOhneWeg(t, k).length > 0
/** Handbeleg „kein Deutsch“, aber der Kalendertermin trägt keine Sprachkennzeichnung (`omu`/`offen`): Der Besucher sieht einen Termin ohne Hinweis (103631, 105228, 180829). */
const terminTrotzNein = (t: Title, k: Kontext): boolean =>
  begonnenOhneWeg(t, k).some((r) => !r.sprache && k.neinGilt(t.id, r.platform, r.schedule?.firstEpisodeDate ?? ''))
const geschaetztOhneWeg = (t: Title, k: Kontext): boolean => begonnenOhneWegAlle(t, k).some((r) => r.schedule?.estimated)

/** Zu Recht ohne Weg: Für jeden dieser Termine belegt ein Handbeleg „nicht verfügbar“ (nicht älter als der Termin) oder „ohne deutschen Ton“. */
const belegtesNein = (t: Title, k: Kontext): string | undefined =>
  begonnenOhneWeg(t, k).every((r) => k.neinGilt(t.id, r.platform, r.schedule?.firstEpisodeDate ?? '')) ? 'belegtes-nein' : undefined

function terminFehltLaufend(t: Title, k: Kontext): boolean {
  if (!(t.format === 'TV' || t.format === 'ONA') || !t.streams?.some((s) => s.dub === true)) return false
  return (!t.jpEnd || t.jpEnd >= k.heute) && !k.kuenftig.has(t.id)
}

/** Nur Sichtungen schreiben nichts fort (`expandEvents`); nur wöchentliche Releases zählen, ein alter Batch (Disney+) erklärt keinen künftigen Termin. */
function nurSichtungen(t: Title, k: Kontext): string | undefined {
  const rs = (k.releases.get(t.id) ?? []).filter((r) => r.releaseType === 'weekly')
  return rs.length > 0 && rs.every((r) => r.tvLetzteSichtung) ? 'nur-sichtung' : undefined
}

/**
 * Zu Recht ohne Weg (17.11.2026): ein belegter Kinostart ab heute ist der Weg (Witch on the Holy Night, 26.01.2027); ohne Erscheinungsdatum und ohne
 * jeden Termin gibt es noch nichts, worauf ein Weg zeigen könnte (Princess Principal: Crown Handler Chapter 5/6).
 */
function keinWegAusnahme(t: Title, k: Kontext): string | undefined {
  const termine = k.releases.get(t.id) ?? []
  if (termine.some((r) => r.platform === 'kino' && (r.sources?.length ?? 0) > 0 && (r.schedule?.firstEpisodeDate ?? '') >= k.heute)) return 'kinostart'
  return !t.jpYear && !t.jpStart && !t.jpEnd && termine.length === 0 ? 'unveroeffentlicht' : undefined
}

export const REGELN: Regel[] = [
  { art: 'cover', gruppe: 'fehlend', wirkung: 3, wer: 'auto:tmdb-poster', zaehle: luecke('c'), ausnahme: (t, k) => (k.coverBekannt[t.id] ? 'ohne-bekanntes-cover' : undefined) },
  { art: 'banner', gruppe: 'fehlend', wirkung: 1, wer: 'auto:tmdb-banner', zaehle: (t) => !t.bannerImage },
  { art: 'titel-de', gruppe: 'fehlend', wirkung: 3, wer: 'hand:synchro-belegen', zaehle: luecke('t'), ausnahme: (t) => (hatEinenWeg(t) || t.deErstausgabe ? undefined : 'ohne-deutsche-fassung') },
  { art: 'handlung-de', gruppe: 'fehlend', wirkung: 2, wer: 'auto:anisearch', zaehle: (t, k) => !k.synopse(t.id)?.de },
  { art: 'folgentitel', gruppe: 'fehlend', wirkung: 2, wer: 'auto:tmdb', zaehle: folgentitelFehlen, ausnahme: (t) => (t.format === 'MOVIE' ? 'film' : undefined) },
  { art: 'folgenzahl', gruppe: 'fehlend', wirkung: 3, wer: 'auto:anilist', zaehle: (t) => SERIE.has(t.format ?? '') && !t.episodes, ausnahme: (t, k) => (laeuftNoch(t, k) ? 'laeuft' : undefined) },
  { art: 'fsk', gruppe: 'fehlend', wirkung: 2, wer: 'auto:justwatch', zaehle: (t) => t.fsk == null },
  { art: 'wertung', gruppe: 'fehlend', wirkung: 1, wer: 'auto:anilist', zaehle: (t) => !t.score },
  { art: 'studio', gruppe: 'fehlend', wirkung: 1, wer: 'auto:anilist', zaehle: (t) => !t.studios?.length },
  { art: 'genre', gruppe: 'fehlend', wirkung: 1, wer: 'auto:anilist', zaehle: (t) => !t.genres?.length },
  { art: 'laufzeit', gruppe: 'fehlend', wirkung: 1, wer: 'auto:anisearch', zaehle: (t) => !t.runtimeMin },
  { art: 'jahr', gruppe: 'fehlend', wirkung: 2, wer: 'auto:anilist', zaehle: luecke('j') },
  { art: 'sprecher', gruppe: 'fehlend', wirkung: 1, wer: 'auto:anisearch', zaehle: (t) => !t.hasVoices, ausnahme: (t) => (hatSynchro(t) ? undefined : 'ohne-synchro') },
  { art: 'kein-weg', gruppe: 'fehlend', wirkung: 3, wer: 'daniel', zaehle: (t, k) => !hatEinenWeg(t) && !k.discTitel.has(t.id), ausnahme: keinWegAusnahme },
  { art: 'erstausgabe-ohne-weg', gruppe: 'fehlend', wirkung: 3, wer: 'daniel', zaehle: (t, k) => zaehleErstausgabeOhneWeg([t], k.discTitel) === 1 },
  { art: 'termin-fehlt-laufend', gruppe: 'fehlend', wirkung: 3, wer: 'auto:anbieterkalender', zaehle: terminFehltLaufend, ausnahme: nurSichtungen },
  { art: 'sprachurteil-offen', gruppe: 'schwach', wirkung: 2, wer: 'hand:synchro-belegen', zaehle: ohneSprachurteil },
  { art: 'synchro-schwach', gruppe: 'schwach', wirkung: 2, wer: 'hand:synchro-belegen', zaehle: (t) => t.dubConfidence === 'low' },
  { art: 'erschienen-ohne-weg', gruppe: 'falsch', wirkung: 3, wer: 'hand:synchro-belegen', zaehle: erschienenOhneWeg, ausnahme: belegtesNein },
  { art: 'termin-trotz-nein', gruppe: 'falsch', wirkung: 3, wer: 'hand:synchro-belegen', zaehle: terminTrotzNein },
  { art: 'termin-geschaetzt-ohne-weg', gruppe: 'schwach', wirkung: 2, wer: 'hand:synchro-belegen', zaehle: geschaetztOhneWeg },
  { art: 'folgenzahl-widerspruch', gruppe: 'falsch', wirkung: 2, wer: 'hand:synchro-belegen', zaehle: folgenzahlWiderspruch, ausnahme: (t, k) => folgenzahlAusnahme(t, k.releases.get(t.id) ?? [], listenLaenge(t, k), k.franchiseTeile(t)) },
  { art: 'adresse-mehrfach', gruppe: 'falsch', wirkung: 3, wer: 'hand:synchro-belegen', zaehle: (t, k) => k.adresseMehrfach.has(t.id), ausnahme: (t, k) => (k.adresseMehrfach.get(t.id) === 'franchise' ? 'gleiches-franchise' : undefined) },
  { art: 'staffel-zuordnung', gruppe: 'falsch', wirkung: 2, wer: 'hand:synchro-belegen', zaehle: (t, k) => k.staffelZuordnung.has(t.id), ausnahme: (t, k) => STAFFEL_AUSNAHME[k.staffelZuordnung.get(t.id)!] ?? (laeuftNoch(t, k) ? 'laeuft' : undefined) },
  { art: 'herkunft-fremder-titel', gruppe: 'falsch', wirkung: 3, wer: 'auto:bau', zaehle: (t, k) => herkunftFremderTitel(t, k.releases.get(t.id) ?? []) },
  { art: 'weg-ohne-adresse', gruppe: 'fehlend', wirkung: 3, wer: 'auto:anbieterkalender', zaehle: (t) => Boolean(t.streams?.some((s) => !s.url)) },
]

/**
 * Titel mit Stream-Adresse, die auch bei einem anderen Titel steht, unabhängig von `sharedWith` (der Bau-Vermerk gilt der Oberfläche und
 * würde jede gleiche Adresse verdecken). `fremd`: ein Partner gehört zu einem anderen Franchise; `franchise`: alle Partner teilen es.
 * Eine leere Adresse ist keine gleiche (Art `weg-ohne-adresse`).
 */
export function adresseMehrfach(titel: Title[]): Map<number, 'fremd' | 'franchise'> {
  const je = new Map<string, Title[]>()
  for (const t of titel) for (const s of t.streams ?? []) if (s.url) (je.get(s.url) ?? je.set(s.url, []).get(s.url)!).push(t)
  const aus = new Map<number, 'fremd' | 'franchise'>()
  for (const gruppe of [...je.values()].filter((g) => new Set(g.map((t) => t.id)).size > 1)) {
    const fremd = new Set(gruppe.map((t) => t.franchiseId ?? t.id)).size > 1
    for (const t of gruppe) if (fremd || !aus.has(t.id)) aus.set(t.id, fremd ? 'fremd' : 'franchise')
  }
  return aus
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
