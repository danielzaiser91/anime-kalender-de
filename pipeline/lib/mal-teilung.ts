/**
 * **Vollständige Teilung** (`docs/wissen/datensatz.md`, „Eine MAL-Kennung, mehrere aniSearch-Seiten"): Trägt genau ein AniList-Titel eine MAL-Kennung, und die aniSearch-Seiten
 * mit dieser MAL ergeben zusammen genau seine Folgen, fasst AniList zusammen, was aniSearch teilt. Die Regel selbst (welcher Titel weicht) steht in
 * `bau/mal-teilung.ts`; hier nur die Bedingung, die auch das Messwerkzeug `tools/anisearch-mal-mehrfach.mjs` benutzt.
 */

/** Folgenzahl einer Seite oder eines Titels; `null`/`undefined`/0 heißt unbekannt. */
type Folgen = number | null | undefined

/**
 * @param seitenFolgen Folgen jeder aniSearch-Seite mit der MAL (mindestens zwei Seiten, jede mit Folgenzahl)
 * @param anilist      Folgen aller AniList-Titel mit dieser MAL — es muss genau einer sein
 */
export function ergebenSichZusammen(seitenFolgen: Folgen[], anilist: Folgen[]): boolean {
  if (seitenFolgen.length < 2 || anilist.length !== 1 || !anilist[0]) return false
  if (!seitenFolgen.every((f) => f)) return false
  return seitenFolgen.reduce<number>((summe, f) => summe + f!, 0) === anilist[0]
}

const ANISEARCH_ID_BASIS = 10_000_000

type AnilistTitel = { id: number; malId?: number | null; episodes?: number | null }
type Seite = { mal?: number; f?: number }

const anreihen = <K, V>(m: Map<K, V[]>, k: K, v: V): void => void m.set(k, [...(m.get(k) ?? []), v])

/**
 * Alle vollständigen Teilungen: AniList-Kennung des Sammeltitels → aniSearch-Kennungen seiner Seiten.
 * Jede Seite muss eine Zeile haben (`hatZeile`, mit der Kennung des Sammeltitels als zweitem Argument): eine Seite, die ein anderer AniList-Titel trägt, ist dessen aniSearch-Eintrag und keine eigene Zeile.
 * Deutsch spielt keine Rolle: unser Konzept ist die einzelne Auflistung wie bei aniSearch, auch im Katalog hinter dem Schalter (Daniel, 14.10.2026).
 *
 * @param anilist  alle AniList-Titel, auch die im Katalog — „genau ein Titel mit der MAL“ gilt gegen alle
 * @param eintraege `data/anisearch-eintraege.json`
 */
export function findeTeilungen(anilist: AnilistTitel[], eintraege: Record<string, Seite>, hatZeile: (zeilenId: number, sammelId: number) => boolean): Map<number, number[]> {
  const jeMal = new Map<number, Map<number, AnilistTitel>>()
  for (const t of anilist) if (t.malId) jeMal.set(t.malId, (jeMal.get(t.malId) ?? new Map()).set(t.id, t))
  const seitenJeMal = new Map<number, number[]>()
  for (const [as, e] of Object.entries(eintraege)) if (e.mal) anreihen(seitenJeMal, e.mal, Number(as))
  const teilungen = new Map<number, number[]>()
  for (const [mal, seiten] of seitenJeMal) {
    const titel = [...(jeMal.get(mal)?.values() ?? [])]
    if (!ergebenSichZusammen(seiten.map((as) => eintraege[String(as)]!.f), titel.map((t) => t.episodes))) continue
    const sammelId = titel[0]!.id
    if (seiten.every((as) => hatZeile(ANISEARCH_ID_BASIS + as, sammelId))) teilungen.set(sammelId, seiten)
  }
  return teilungen
}
