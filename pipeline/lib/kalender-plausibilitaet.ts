/**
 * **Kalender-Plausibilität: sechs Widersprüche, die ein Besucher am Kalender sieht** (Prüftisch 16.10.2026: 18 Datenfehler
 * in sieben Tagen, 16 ohne Wächter). Jede Regel ist an den echten Daten gemessen und von Hand gegengeprüft
 * (`daniel-zum-abarbeiten/listen/kalender-plausibilitaet.md`). Rein: liest nichts, die Dateien lädt `check-kalender-plausibilitaet-bestand.ts`.
 */
import type { Release, ReleaseEvent, Title } from '../../shared/types.ts'
import type { NewsEintrag } from '../../shared/news-typen.ts'
import { addDays } from '../../shared/time.ts'
import { stufeTitelEin } from '../../web/src/lib/db-relevanz.ts'
import { istKeineTitelseite } from '../bau/11-7-wege-aus-terminen.ts'
import { kanalSchluessel } from './kanal-titel.ts'
import { alleTermineGekennzeichnet } from './pruefung.ts'
import { urteilDarfBelegen } from './urteil-weg.ts'

export const REGELN = ['erschienenOhneTermin', 'schaetzungNachEnde', 'spracheOffenTrotzMeldung', 'ereignisOhneNews', 'terminOhneBeleg', 'primeOhneTitelseite'] as const
export type Regel = (typeof REGELN)[number]

/** Ein Treffer: der Titel (für den Panel-Link) und ein Satz, der den Widerspruch nennt; `schluessel` bleibt über Läufe gleich. */
export interface Treffer {
  titleId: number
  schluessel: string
  text: string
}

export interface Bestand {
  titles: Title[]
  releases: Release[]
  events: ReleaseEvent[]
  news: NewsEintrag[]
  /** `data/urteile.json`: `<titleId>|<anbieter>|<folge>` → Urteil der Erweiterungs-Meldungen. */
  urteile: Record<string, { urteil?: string; art?: string }>
  /** Prime-Kanal-Adressen ohne Beleg (`kanalAdressenOhneBeleg`): dort ist Amazons Sprachangabe kein Beleg. */
  kanal: ReadonlySet<string>
  heute: string
}

/** Eine Folge braucht bis in die News (Crunchyroll-Neuheiten-Abruf, Bau): zwei Tage Spielraum, sonst meldet jeder Bau die Folge von heute. */
const NEWS_VERZUG_TAGE = 2
/** So weit zurück wird eine Crunchyroll-Folge ohne Meldung gesucht (Folgen-Meldungen gibt es seit 12.09.2026). */
const FOLGEN_FENSTER_TAGE = 28

/** Anbieter mit einem gemessenen „deutsch“ aus der Erweiterung: `<titleId>|<anbieter>`. */
export function gemessenDeutsch(urteile: Bestand['urteile']): Set<string> {
  const ja = new Set<string>()
  for (const [schluessel, u] of Object.entries(urteile)) {
    if (u.urteil !== 'deutsch' || u.art !== 'gemessen') continue
    const [id, anbieter] = schluessel.split('|')
    ja.add(`${id}|${anbieter}`)
  }
  return ja
}

function nachTitel<T extends { titleId: number }>(liste: T[]): Map<number, T[]> {
  const m = new Map<number, T[]>()
  for (const x of liste) m.set(x.titleId, [...(m.get(x.titleId) ?? []), x])
  return m
}

const name = (t: Title | undefined, id: number): string => t?.titleDe ?? t?.titleEn ?? t?.titleRomaji ?? String(id)

/** 1. Die Datenbank führt den Titel unter „Ohne bekannten Termin“, obwohl eine Folge beobachtet, gemessen oder von JustWatch gemeldet ist. */
export function erschienenOhneTermin(b: Bestand): Treffer[] {
  const releases = nachTitel(b.releases)
  const gemessen = gemessenDeutsch(b.urteile)
  const treffer: Treffer[] = []
  for (const t of b.titles) {
    const eigene = releases.get(t.id) ?? []
    if (stufeTitelEin(t, eigene, b.heute).art !== 'unbekannt') continue
    const beobachtet = eigene.some((r) => !r.widerlegt && Object.values(r.schedule.observed ?? {}).some((d) => d && d <= b.heute))
    const wege = t.streams ?? []
    const jw = wege.some((s) => s.dubQuelle === 'justwatch' && s.dubStand)
    const urteil = wege.some((s) => gemessen.has(`${t.id}|${s.platform}`) && !(s.platform === 'primevideo' && b.kanal.has(kanalSchluessel(t.id, s.url))))
    const grund = beobachtet ? 'Folge beobachtet' : jw ? 'Deutsch laut JustWatch' : urteil ? 'Deutsch gemessen (Erweiterung)' : ''
    if (grund) treffer.push({ titleId: t.id, schluessel: String(t.id), text: `${name(t, t.id)}: „Ohne bekannten Termin“, aber ${grund}` })
  }
  return treffer
}

/** Belegtes Ende: `lastEpisodeDate` oder die beobachtete letzte Folge, jeweils nicht in der Zukunft. */
function belegtesEnde(r: Release, heute: string): string | undefined {
  const s = r.schedule
  // Bei geschätzter Folgenzahl ist „Folge N“ nur die Annahme, kein Finale.
  const finale = s.episodeCount && !s.episodeCountAssumed ? s.observed?.[s.episodeCount] : undefined
  const ende = [s.lastEpisodeDate, finale].filter((d): d is string => !!d && d <= heute).sort()[0]
  return ende
}

/** 2. Das Ende ist belegt, trotzdem trägt die Folgenzahl ein „≈“ oder ein Termin danach ist geschätzt. */
export function schaetzungNachEnde(b: Bestand): Treffer[] {
  const events = new Map<string, ReleaseEvent[]>()
  for (const e of b.events) events.set(e.releaseSlug, [...(events.get(e.releaseSlug) ?? []), e])
  const titel = new Map(b.titles.map((t) => [t.id, t]))
  const treffer: Treffer[] = []
  for (const r of b.releases) {
    const ende = belegtesEnde(r, b.heute)
    if (!ende) continue
    const eigene = events.get(r.slug) ?? []
    const ungefaehr = r.schedule.episodeCountAssumed || eigene.some((e) => e.episodeCountAssumed)
    const geschaetzt = eigene.filter((e) => e.estimated && e.date > ende)
    if (!ungefaehr && !geschaetzt.length) continue
    const was = ungefaehr ? '„≈“ an der Folgenzahl' : `geschätzter Termin ${geschaetzt[0]!.date}`
    treffer.push({ titleId: r.titleId, schluessel: r.slug, text: `${name(titel.get(r.titleId), r.titleId)} (${r.slug}): Ende ${ende} belegt, trotzdem ${was}` })
  }
  return treffer
}

/**
 * 3. Die Pille zeigt „Sprache offen“, obwohl die Erweiterung auf diesem Anbieter Deutsch gemessen hat. Ausgenommen, was der Bau
 * nicht belegen darf (`urteilDarfBelegen`): Prime-Kanal (dort kein Beleg) und ein Anbieter, dessen Termine alle eine Sprachkennzeichnung tragen.
 */
export function spracheOffenTrotzMeldung(b: Bestand): Treffer[] {
  const gemessen = gemessenDeutsch(b.urteile)
  const gekennzeichnet = alleTermineGekennzeichnet(b.releases)
  const treffer: Treffer[] = []
  for (const t of b.titles) {
    for (const s of t.streams ?? []) {
      if (s.dub === true || (s.dubQuelle === 'justwatch' && s.dubStand)) continue
      if (!gemessen.has(`${t.id}|${s.platform}`)) continue
      if (!urteilDarfBelegen(t.id, s, b.kanal, gekennzeichnet)) continue
      treffer.push({ titleId: t.id, schluessel: `${t.id}|${s.platform}`, text: `${name(t, t.id)}: ${s.platform} „Sprache offen“, Erweiterung hat Deutsch gemessen` })
    }
  }
  return treffer
}

/** News-Meldungen je Reihe (`franchiseId`): die News bündeln unter dem Kopf der Reihe, ein Teil trägt `teilId`. */
function meldungenJeReihe(b: Bestand): Map<number, { art: string; am: string }[]> {
  const reihe = new Map(b.titles.map((t) => [t.id, t.franchiseId ?? t.id]))
  const m = new Map<number, { art: string; am: string }[]>()
  for (const n of b.news) {
    for (const x of n.meldungen) {
      const id = x.teilId ?? n.titelId
      const r = reihe.get(id) ?? id
      m.set(r, [...(m.get(r) ?? []), { art: x.art, am: n.am }])
    }
  }
  return m
}

/** 4. Ein belegtes Ereignis ohne Meldung: Start eines Termins, ausgebliebene Folge, neue Crunchyroll-Folge. */
export function ereignisOhneNews(b: Bestand): Treffer[] {
  const meldungen = meldungenJeReihe(b)
  const reihe = new Map(b.titles.map((t) => [t.id, t.franchiseId ?? t.id]))
  const start = new Map(b.releases.map((r) => [r.slug, r.schedule.firstEpisodeDate]))
  /* Älter als die älteste Meldung der Datei lässt sich nichts beurteilen: die News halten nur ein Fenster. */
  const aeltesteNews = b.news.map((n) => n.am).sort()[0] ?? b.heute
  const bis = addDays(b.heute, -NEWS_VERZUG_TAGE)
  const folgenAb = addDays(b.heute, -FOLGEN_FENSTER_TAGE)
  const treffer: Treffer[] = []
  for (const e of b.events) {
    if (e.estimated || e.date < aeltesteNews || e.date > bis) continue
    const ms = meldungen.get(reihe.get(e.titleId) ?? e.titleId) ?? []
    const nah = (m: { am: string }) => Math.abs(Date.parse(m.am) - Date.parse(e.date)) <= NEWS_VERZUG_TAGE * 864e5
    const fehlt =
      e.staffelstart && e.date === start.get(e.releaseSlug) && !ms.length ? 'Start ohne Meldung'
      : e.verpasst && !ms.some((m) => m.art === 'verspaetet') ? 'ausgebliebene Folge ohne „verspätet“'
      : e.platform === 'crunchyroll' && e.episode && e.date >= folgenAb && !ms.some(nah) ? `Folge ${e.episode} ohne Meldung`
      : ''
    if (fehlt) treffer.push({ titleId: e.titleId, schluessel: e.id, text: `${e.name} (${e.platform}, ${e.date}): ${fehlt}` })
  }
  return treffer
}

/** 5. Ein Termin ohne Quelle — Grundsatz „kein Termin ohne `sources`“, auch für Termine, die nach `pruefeErgebnis` entstehen. */
export function terminOhneBeleg(b: Bestand): Treffer[] {
  const titel = new Map(b.titles.map((t) => [t.id, t]))
  return b.releases
    .filter((r) => !r.sources?.length)
    .map((r) => ({ titleId: r.titleId, schluessel: r.slug, text: `${name(titel.get(r.titleId), r.titleId)} (${r.slug}): Termin ${r.schedule.firstEpisodeDate} ohne Quelle` }))
}

/**
 * 6. Ein Prime-Streaming-Termin verlinkt eine Amazon-Suche statt der Titelseite (Daniel, 18.10.2026: „keine Titelseite ist eine echte Lücke“).
 * Disc-Termine zählen nicht: ihre Produktsuche ist Absicht (`amazonSearchUrl` in `05-releases.ts`).
 */
export function primeOhneTitelseite(b: Bestand): Treffer[] {
  const titel = new Map(b.titles.map((t) => [t.id, t]))
  return b.releases
    .filter((r) => r.platform === 'primevideo' && r.releaseType !== 'disc' && !!r.platformUrl && istKeineTitelseite(r.platformUrl))
    .map((r) => ({ titleId: r.titleId, schluessel: r.slug, text: `${name(titel.get(r.titleId), r.titleId)} (${r.slug}): Prime-Termin verlinkt nur eine Suche` }))
}

const PRUEFUNG: Record<Regel, (b: Bestand) => Treffer[]> = {
  erschienenOhneTermin,
  schaetzungNachEnde,
  spracheOffenTrotzMeldung,
  ereignisOhneNews,
  terminOhneBeleg,
  primeOhneTitelseite,
}

export function plausibilitaet(b: Bestand): Record<Regel, Treffer[]> {
  return Object.fromEntries(REGELN.map((r) => [r, PRUEFUNG[r](b)])) as Record<Regel, Treffer[]>
}

export const panelLink = (titleId: number): string => `https://anime-kalender.de/#/datenbank?t=${titleId}`
