import { log, readJson, writeJson } from './util.ts'
import { herabgestufteWarnzeile } from './bestand-warnzeile.ts'

/**
 * **Ein TMDB-Film gehört genau einem Titel.**
 *
 * Gemessen am 16.09.2026: Fünf Film-Kennungen waren mehreren AniList-Titeln
 * zugeordnet, alle in Filmreihen — „Code Geass: Akito the Exiled" Teil 1 und 2
 * teilten sich `movie/212161` und damit den deutschen Titel „Der zerrissene
 * Wyvern", die drei Kapitel von „Princess Principal: Crown Handler" hießen alle
 * „Crown Handler 4". Die Zuordnung sucht nach Namensähnlichkeit, und die Teile
 * einer Reihe sind einander ähnlicher als jedem anderen Werk.
 *
 * Welcher der Beteiligten richtig zugeordnet ist, lässt sich aus den Daten nicht
 * entscheiden. Deshalb verlieren **alle** die TMDB-Angaben — Titel, Beschreibung,
 * FSK und Anbieter. Eine falsche Zuordnung ist hier schlimmer als keine: Sie
 * bringt einem Film den Namen und die Kaufadresse eines anderen.
 *
 * **Die Art gehört zum Schlüssel.** TMDB zählt Serien und Filme in getrennten
 * Nummernräumen: `tv/34065` ist „Black Cat", `movie/34065` ein Pokémon-Film. Eine
 * Prüfung über die Zahl allein meldete 139 Doppelungen, davon 134 zu Unrecht.
 *
 * Serien dürfen sich eine Kennung teilen — die Staffeln eines Werks stehen bei
 * TMDB unter einer Serie.
 */
export function mehrdeutigeFilmzuordnungen(
  zuordnung: Record<string, { tmdbId?: number; kind?: 'tv' | 'movie' }>,
): Set<string> {
  const jeFilm = new Map<number, string[]>()
  for (const [titelId, eintrag] of Object.entries(zuordnung)) {
    if (!eintrag?.tmdbId || eintrag.kind !== 'movie') continue
    const liste = jeFilm.get(eintrag.tmdbId) ?? []
    liste.push(titelId)
    jeFilm.set(eintrag.tmdbId, liste)
  }
  const raus = new Set<string>()
  for (const liste of jeFilm.values()) if (liste.length > 1) for (const id of liste) raus.add(id)
  return raus
}

/** Die Titel mit geteiltem Film, einmal je Bau in `ladeQuellen()` gesetzt; Plakat- und Banner-Leser filtern damit. */
let geteilteFilme = new Set<string>()
export const merkeGeteilteFilme = (ids: Set<string>): void => void (geteilteFilme = ids)

/**
 * **Plakat und Banner eines geteilten Films gehören keinem der Titel.** Gibt `daten` ohne deren Einträge zurück und meldet
 * Zahl und Kennungen im Bau-Log (`was` = Name der Quelle); wer ein anderes Cover hat, behält es über den normalen Rückfall.
 */
export function ohneGeteilteFilme<T>(daten: Record<string, T>, was: string): Record<string, T> {
  const weg = Object.keys(daten).filter((id) => geteilteFilme.has(id) && daten[id])
  if (!weg.length) return daten
  const rest = { ...daten }
  for (const id of weg) delete rest[id]
  log(`${weg.length} TMDB-${was} verworfen: derselbe Film steht bei mehreren Titeln (${weg.join(', ')})`)
  return rest
}

/** Die Menge am Ende von `ladeQuellen()` (mit den gesperrten Serien-Treffern der Kurzformen), damit Bestandsprüfungen dieselbe Menge sehen. */
export const GETEILTE_FILME_DATEI = 'data/cache/tmdb-geteilte-filme.json'
export const schreibeGeteilteFilme = (ids: Set<string>): void => writeJson(GETEILTE_FILME_DATEI, [...ids].sort())
/** Die vom Bau geschriebene Menge; fehlt die Datei (kein Bau in diesem Ordner), nur die reine Film-Regel auf `tmdbTitles`. */
export function ladeGeteilteFilme(tmdbTitles: Parameters<typeof mehrdeutigeFilmzuordnungen>[0]): Set<string> {
  const ids = readJson<string[] | null>(GETEILTE_FILME_DATEI, null)
  return ids ? new Set(ids) : mehrdeutigeFilmzuordnungen(tmdbTitles)
}

/**
 * **Eine TMDB-Kennung gehört nur einer Reihe.** Staffeln und Teile einer Reihe teilen sich eine Serie oder einen Film bei TMDB (Bestand 12.11.2026: 111 Kennungen);
 * hängt dieselbe `art/kennung` an Titeln verschiedener Reihen, bekommt einer davon Handlung, Anbieter und Folgen eines fremden Werks (Anlass Kitaro, PR 2874).
 * `reiheVon` liefert die Reihe eines Titels (`undefined` = nicht im Bestand, der Eintrag zählt nicht); gibt je Fund `art/kennung` und die Titel samt Reihe zurück.
 */
export function reihenfremdGeteilt(
  zuordnung: Record<string, { tmdbId?: number; kind?: 'tv' | 'movie' }>,
  reiheVon: (titelId: string) => number | string | undefined,
): { schluessel: string; titel: string[] }[] {
  const jeKennung = new Map<string, { id: string; reihe: number | string }[]>()
  for (const [id, e] of Object.entries(zuordnung)) {
    const reihe = reiheVon(id)
    if (!e?.tmdbId || reihe === undefined) continue
    const s = `${e.kind ?? 'tv'}/${e.tmdbId}`
    jeKennung.set(s, [...(jeKennung.get(s) ?? []), { id, reihe }])
  }
  return [...jeKennung]
    .filter(([, titel]) => new Set(titel.map((t) => t.reihe)).size > 1)
    .map(([schluessel, titel]) => ({ schluessel, titel: titel.map((t) => `${t.id}@${t.reihe}`) }))
}

/** `reihenfremdGeteilt` über den Bestand: die Reihe ist `franchiseId`, ohne sie der Titel selbst (Natsume Staffel 1 trägt keine). */
export function reihenfremdImBestand(
  zuordnung: Record<string, { tmdbId?: number; kind?: 'tv' | 'movie' }>,
  bestand: Map<number, { franchiseId?: number }>,
): ReturnType<typeof reihenfremdGeteilt> {
  return reihenfremdGeteilt(zuordnung, (id) => {
    const t = bestand.get(Number(id))
    return t && (t.franchiseId ?? Number(id))
  })
}

/**
 * Film-Kennungen, die mehr als einem Titel des Bestands zugeordnet sind (je Kennung eine Gruppe mit den Titelkennungen).
 * Alle Beteiligten verlieren die TMDB-Angaben (`mehrdeutigeFilmzuordnungen`); die Zahl der Gruppen darf nur sinken (Ratsche in `check-logic-bestand.ts`).
 */
export function geteilteFilmGruppen(
  zuordnung: Record<string, { tmdbId?: number; kind?: 'tv' | 'movie' }>,
  imBestand: (titelId: string) => boolean,
): { schluessel: string; titel: string[] }[] {
  const jeFilm = new Map<number, string[]>()
  for (const [id, e] of Object.entries(zuordnung)) {
    if (!e?.tmdbId || e.kind !== 'movie' || !imBestand(id)) continue
    jeFilm.set(e.tmdbId, [...(jeFilm.get(e.tmdbId) ?? []), id])
  }
  return [...jeFilm].filter(([, titel]) => titel.length > 1).map(([kennung, titel]) => ({ schluessel: `movie/${kennung}`, titel }))
}

/** Geteilte Film-Kennungen im Bestand vom 12.11.2026 (Digimon, Code Geass Akito, Psycho-Pass Sinners, Sailor Moon Eternal, eine weitere); nur neue Fälle warnen. */
export const BEKANNTE_GETEILTE_FILME = ['movie/20455', 'movie/212161', 'movie/510242', 'movie/618851', 'movie/843267']

/** Neue Gruppen (nicht in `bekannt`) als eine `⚠ WARNUNG`-Zeile, sonst `undefined`; ein legitimer neuer Filmteil sperrt den Bau nicht (Kitaro-Kandidat, Freigabe = Kennung in die Liste). */
export function geteilteFilmeWarnzeile(
  gruppen: { schluessel: string; titel: string[] }[],
  bekannt: string[] = BEKANNTE_GETEILTE_FILME,
): string | undefined {
  const neu = gruppen.filter((g) => !bekannt.includes(g.schluessel))
  if (!neu.length) return undefined
  return herabgestufteWarnzeile('TMDB-Film an mehreren Titeln', `neue Kennung(en) ${neu.map((g) => g.schluessel).join(', ')}; die Beteiligten verlieren ihre TMDB-Angaben, Reihe prüfen und Kennung in BEKANNTE_GETEILTE_FILME aufnehmen — Titel`, neu.flatMap((g) => g.titel.map(Number)))
}
