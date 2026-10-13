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
