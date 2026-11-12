import type { NewsEintrag, Release, Title } from '../../shared/types.ts'
import { markiereAbgeloeste } from './beleg-abgeloest.ts'

/** Titel, die Meldungen mit dieser Adresse belegen (Titel der Meldung, sonst der Reihe) — sie haben oft keinen Termin, der die Adresse trägt (Psyren, 27.10.2026). */
function titelJeAdresseAusNews(news: NewsEintrag[]): Map<string, Map<number, string>> {
  const je = new Map<string, Map<number, string>>()
  for (const e of news)
    for (const m of e.meldungen) {
      const urls = new Set([...(m.belege ?? []).map((b) => b.url), ...(typeof m.quelle === 'string' && /^https?:\/\//.test(m.quelle) ? [m.quelle] : [])])
      for (const url of urls) je.set(url, (je.get(url) ?? new Map<number, string>()).set(m.teilId ?? e.titelId, m.teil ?? e.titel))
    }
  return je
}

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u
const NATIVE_MIN_ZEICHEN = 2

/**
 * Der japanische Name und sein Kopf vor dem ersten Leerzeichen („東京リベンジャーズ 三天戦争編" → „東京リベンジャーズ"): Offizielle Seiten nennen den Titel nur so (Tokyo Revengers, tokyo-revengers-anime.com/news/archives/4935).
 * Nur Namen mit CJK-Zeichen: ein lateinischer Native-Name („BLACK LAGOON", „K", „pet") wiederholt Englisch oder Romaji und träfe per Teilstring Allerweltswörter („carpet").
 */
function nativeNamen(native: string | undefined): string[] {
  if (!native || !CJK.test(native)) return []
  if (native.replace(/[^\p{L}\p{N}]+/gu, '').length < NATIVE_MIN_ZEICHEN) return []
  const kopf = native.split(/\s+/)[0]!
  return [native, ...(CJK.test(kopf) && kopf.length >= 5 ? [kopf] : [])]
}

const KOPF_MIN_ZEICHEN = 5

/**
 * Die Schreibweisen, in denen ein Artikel einen Titel nennt: der Name, sein Kopf vor dem Doppelpunkt oder vor einem Gedankenstrich („Fate/stay night [Heaven's Feel] – Gesamtausgabe (I. …)",
 * „Gunslinger Girl -Il Teatrino-") und die Zeichen, die der Abgleich nicht gleichsetzt: „×" als „x" („SPY×FAMILY" → „SPY x FAMILY"), „and" als „&" („Love & Lies").
 */
export function namensformen(n: string): string[] {
  const koepfe = [n.split(':')[0]!, n.split(/\s[–—-]\s|\s-(?=\S)/)[0]!].map((k) => k.trim()).filter((k) => k.length >= KOPF_MIN_ZEICHEN)
  const formen = [n, ...koepfe]
  const gleichgesetzt = formen.flatMap((f) => [f.replace(/\s*×\s*/g, ' x '), f.replace(/\band\b/gi, '&')]).filter((f) => !formen.includes(f))
  return [...new Set([...formen, ...gleichgesetzt])]
}

/** Die Namen eines Titels, den nur eine Meldung mit der Adresse verbindet (`name` ist der Teilname der Meldung, sonst der Titel); dazu die Köpfe wie bei Terminen (Girls und Panzer: „… OVA – …"). */
function namenAusNews(name: string, t: Title | undefined): string[] {
  const namen = [name, t?.titleDe, t?.titleEn, t?.titleRomaji].filter((n): n is string => Boolean(n))
  return [...new Set([...namen.flatMap(namensformen), ...nativeNamen(t?.titleNative)])]
}

/**
 * **Wonach im Artikel die Fundstelle gesucht wird** (Daniel, 04.10.2026, „Zur Fundstelle" im Beleg-Dialog): die Namen der Titel, deren Termine
 * der Artikel belegt — der ausführlichste zuerst, dann der Name vor dem Doppelpunkt („Tokyo Revengers" statt „Tokyo Revengers: War of the Three Titans").
 */
export function suchbegriffeJeAdresse(releases: Release[], titles: Title[], news: NewsEintrag[] = []): Map<string, string[]> {
  const nachId = new Map(titles.map((t) => [t.id, t]))
  const je = new Map<string, Set<string>>()
  for (const r of releases) {
    const t = nachId.get(r.titleId)
    const namen = [r.name, t?.titleDe, t?.titleEn, t?.titleRomaji, ...nativeNamen(t?.titleNative)].filter((n): n is string => Boolean(n))
    const urls = new Set([...(r.sources ?? []), ...(r.quellen ?? []).map((q) => q.url)])
    for (const url of urls) {
      const menge = je.get(url) ?? new Set<string>()
      for (const n of namen) for (const f of namensformen(n)) menge.add(f)
      je.set(url, menge)
    }
  }
  for (const [url, titel] of titelJeAdresseAusNews(news)) {
    const menge = je.get(url) ?? new Set<string>()
    for (const [id, name] of titel) for (const n of namenAusNews(name, nachId.get(id))) menge.add(n)
    je.set(url, menge)
  }
  return new Map([...je].map(([url, menge]) => [url, [...menge].sort((a, b) => b.length - a.length)]))
}

const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/

/** Die Starttage, die ein Artikel belegt (`YYYY-MM-DD`) — die Stützstelle im Artikel nennt Titel **und** einen davon (`beleg-stelle.ts`). */
export function tageJeAdresse(releases: Release[]): Map<string, string[]> {
  const je = new Map<string, Set<string>>()
  for (const r of releases) {
    const tag = r.schedule?.firstEpisodeDate
    if (!tag) continue
    for (const url of new Set([...(r.sources ?? []), ...(r.quellen ?? []).map((q) => q.url)])) je.set(url, (je.get(url) ?? new Set<string>()).add(tag))
    /* Eine überholte Quelle nennt ihren alten Tag, nicht den heutigen (Virgin Road: der Artikel vom 18.08. sagt 11.09., angezeigt wird der 06.11.). */
    for (const q of r.quellen ?? []) if (ISO_TAG.test(q.sagt ?? '')) je.get(q.url)?.add(q.sagt!)
  }
  return new Map([...je].map(([url, tage]) => [url, [...tage]]))
}

/** Ein Titel, den ein Artikel belegt: seine Namen und Starttage — jeder bekommt im Bild seine eigene Fundstelle. */
export interface Gruppe {
  id: number
  suchen: string[]
  tage: string[]
  /** Alle Quellen dieser Adresse zum Titel sind überholt und durch heutige abgelöst (`beleg-abgeloest.ts`). */
  abgeloest?: boolean
}

/** Die Titel je Artikel-Adresse, einzeln (Bleach und Madoka im selben Artikel teilen sich sonst eine Marke). */
export function gruppenJeAdresse(releases: Release[], titles: Title[], news: NewsEintrag[] = []): Map<string, Gruppe[]> {
  const nachId = new Map(titles.map((t) => [t.id, t]))
  const je = new Map<string, Map<number, { namen: Set<string>; tage: Set<string> }>>()
  for (const r of releases) {
    const t = nachId.get(r.titleId)
    const urls = new Set([...(r.sources ?? []), ...(r.quellen ?? []).map((q) => q.url)])
    for (const url of urls) {
      const gruppen = je.get(url) ?? new Map()
      const g = gruppen.get(r.titleId) ?? { namen: new Set<string>(), tage: new Set<string>() }
      for (const n of [r.name, t?.titleDe, t?.titleEn, t?.titleRomaji, ...nativeNamen(t?.titleNative)]) {
        if (!n) continue
        for (const f of namensformen(n)) g.namen.add(f)
      }
      if (r.schedule?.firstEpisodeDate) g.tage.add(r.schedule.firstEpisodeDate)
      for (const q of r.quellen ?? []) if (q.url === url && ISO_TAG.test(q.sagt ?? '')) g.tage.add(q.sagt!)
      gruppen.set(r.titleId, g)
      je.set(url, gruppen)
    }
  }
  for (const [url, titel] of titelJeAdresseAusNews(news)) {
    const gruppen = je.get(url) ?? new Map()
    for (const [id, name] of titel) {
      const g = gruppen.get(id) ?? { namen: new Set<string>(), tage: new Set<string>() }
      for (const n of namenAusNews(name, nachId.get(id))) g.namen.add(n)
      gruppen.set(id, g)
    }
    je.set(url, gruppen)
  }
  return new Map([...je].map(([url, gruppen]) => [url, [...gruppen].map(([id, g]) => ({ id, suchen: [...g.namen].sort((a, b) => b.length - a.length), tage: [...g.tage] }))]))
}

/** Liest eine JSON-Datei des Bestands (`readJson` aus `util.ts`, im Test eine Attrappe). */
export type BestandLeser = <T>(pfad: string, vorgabe: T) => T

/** Alles, was die Lesung je Adresse über die Titel wissen muss — aus Terminen **und** Meldungen (ohne sie fehlen Titel wie Psyren). */
export function zuordnungFuerLesen(lese: BestandLeser): { suchbegriffe: Map<string, string[]>; gruppen: Map<string, Gruppe[]>; tage: Map<string, string[]> } {
  const releases = lese<Release[]>('public/data/releases.json', [])
  const titles = lese<Title[]>('public/data/titles.json', [])
  const news = lese<NewsEintrag[]>('public/data/news.json', [])
  return { suchbegriffe: suchbegriffeJeAdresse(releases, titles, news), gruppen: markiereAbgeloeste(gruppenJeAdresse(releases, titles, news), releases), tage: tageJeAdresse(releases) }
}
