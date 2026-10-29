import type { NewsEintrag, Release, Title } from '../../shared/types.ts'

/** Titel, die Meldungen mit dieser Adresse belegen (Titel der Meldung, sonst der Reihe) — sie haben oft keinen Termin, der die Adresse trägt (Psyren, 27.10.2026). */
function titelJeAdresseAusNews(news: NewsEintrag[]): Map<string, Map<number, string>> {
  const je = new Map<string, Map<number, string>>()
  for (const e of news)
    for (const m of e.meldungen) {
      const urls = new Set([...(m.belege ?? []).map((b) => b.url), ...(typeof m.quelle === 'string' && /^https?:\/\//.test(m.quelle) ? [m.quelle] : [])])
      for (const url of urls) je.set(url, (je.get(url) ?? new Map<number, string>()).set(m.teilId ?? e.titelId, e.titel))
    }
  return je
}

/** Die Namen eines Titels, den nur eine Meldung mit der Adresse verbindet. */
function namenAusNews(name: string, t: Title | undefined): string[] {
  return [name, t?.titleDe, t?.titleEn, t?.titleRomaji].filter((n): n is string => Boolean(n))
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
    const namen = [r.name, t?.titleDe, t?.titleEn, t?.titleRomaji].filter((n): n is string => Boolean(n))
    const urls = new Set([...(r.sources ?? []), ...(r.quellen ?? []).map((q) => q.url)])
    for (const url of urls) {
      const menge = je.get(url) ?? new Set<string>()
      for (const n of namen) {
        menge.add(n)
        const kopf = n.split(':')[0]!.trim()
        if (kopf.length >= 5) menge.add(kopf)
      }
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
      for (const n of [r.name, t?.titleDe, t?.titleEn, t?.titleRomaji]) {
        if (!n) continue
        g.namen.add(n)
        const kopf = n.split(':')[0]!.trim()
        if (kopf.length >= 5) g.namen.add(kopf)
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
  return { suchbegriffe: suchbegriffeJeAdresse(releases, titles, news), gruppen: gruppenJeAdresse(releases, titles, news), tage: tageJeAdresse(releases) }
}
