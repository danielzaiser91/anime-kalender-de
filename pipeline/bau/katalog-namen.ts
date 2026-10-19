import { readJson } from '../lib/util.ts'
import { type KatalogEintrag } from '../lib/anilist.ts'
import { englischAusSynonymen } from '../lib/anisearch-titel.ts'
import { deutschAusSynonymen } from './titel-hilfen.ts'

/** Ein Eintrag aus `data/anisearch-titel.json` (`pipeline/fetch-anisearch-titel.ts`). */
export type AnisearchTitel = { titel?: string; quelle?: string; anisearchId?: number; englisch?: string; synonyme?: string[] }

/**
 * **Deutsche Titel kommen von aniSearch, nicht von AniList.**
 *
 * AniList führt keine. „Ein Landei aus dem Dorf vor dem letzten Dungeon sucht
 * das Abenteuer in der Stadt" stand deshalb nur unter seinem englischen Namen
 * hier, und Daniel fand ihn am 31.08.2026 nicht — obwohl Prime ihn genau so
 * anzeigt. Sein Urteil: „anilist ist müll, die bessere quelle ist anisearch."
 *
 * `pipeline/fetch-anisearch-titel.ts` holt sie über die Kennung aus
 * `data/anime-ids.json`; die Begründung für aniSearch statt TMDB steht dort
 * und in `status.md`.
 */
/*
  **`quelle` entscheidet, ob der Name als deutscher gelten darf.**

  Die `<h1>` einer aniSearch-Seite trägt keine Sprachkennzeichnung. Bei einem
  Titel mit deutscher Veröffentlichung steht dort meistens der deutsche Name
  — deshalb hat das lange getragen. Bei einem ohne steht dort der japanische,
  und dann behauptet `titleDe` etwas Falsches: „Tensei Kizoku, Kantei Skill de
  Nariagaru Dai 3 Ki" stand so im Katalog, während aniSearch unter „Synonyme"
  „…: Staffel 3" führt.

  `ueberschrift` heißt deshalb: Name unbekannter Sprache. Er wird nicht zu
  `titleDe` — `titleRomaji` sagt ohnehin dasselbe, und die Oberfläche fällt
  von selbst darauf zurück.

  **Ein Eintrag ohne `quelle` behält sein `titleDe`.** Er stammt aus einem
  Lauf vor dem 08.09.2026, seine Sprache ist weder belegt noch widerlegt, und
  ein Lauf löscht keine Metadaten. Fällig ist er trotzdem: `faellig()` in
  `fetch-anisearch-titel.ts` holt ihn erneut, und danach entscheidet die
  Herkunft.
*/
export const ladeAnisearchTitel = (): Record<string, AnisearchTitel> => readJson<Record<string, AnisearchTitel>>('data/anisearch-titel.json', {})

/** Die Namen eines Katalogtitels, wie `ohne-synchro.json` sie ausliefert; `reihenName`: der deutsche Name seiner Reihe. */
export function katalogNamen(e: KatalogEintrag, eintrag: AnisearchTitel | undefined, reihenName: string | undefined): { titleRomaji?: string; titleEn?: string; titleDe?: string } {
  const [romaji, englisch] = e.t
  /*
    **Belegt heißt: aus dem Sprachblock oder den Synonymen.** Ein Eintrag
    ohne `quelle` stammt aus einem Lauf vor dem 08.09.2026 und galt bis zum
    12.09.2026 als deutsch — 1.001 Katalogtitel trugen so einen Namen, den
    niemand als deutsch belegt hatte, davon 335 zu chinesischen Originalen.
    Auf der Seite stand deshalb „Guimi Zhi Zhu: Tebie Pian - Liewu", während
    der englische Titel „Lord of Mysteries Specials" danebenlag (Daniel,
    12.09.2026: „why 2 of these titles have chinese titles").

    Sie fallen jetzt auf Englisch zurück, bis `fetch-anisearch-titel.ts` sie
    erneut geholt und ihre Herkunft vermerkt hat.
  */
  const belegt = eintrag?.quelle === 'sprachblock' || eintrag?.quelle === 'synonym'
  /*
    **Und wo aniSearch schweigt, fragt der Bau die Reihe.** Für den
    Apothekerin-Film kennt aniSearch keinen deutschen Namen; AniList führt
    ihn unter `synonyms`, und der belegte Reihenname macht ihn erkennbar.

    **Zwei Synonymlisten, dieselbe Regel.** AniList führt für den
    Apothekerin-Film genau ein Synonym, und das ist englisch („The Apothecary
    Diaries Movie"). aniSearch führt den deutschen Namen — aber nicht im
    Sprachblock, sondern unter den Synonymen, wo er zwischen der französischen
    und der spanischen Fassung steht. Gefragt werden deshalb beide Listen,
    aniSearch zuerst: Sie ist die Quelle, die deutsche Titel überhaupt kennt.
  */
  const deutsch =
    (belegt ? eintrag?.titel : undefined) ??
    deutschAusSynonymen(eintrag?.synonyme, reihenName) ??
    deutschAusSynonymen(e.synonyme, reihenName)
  return {
    titleRomaji: romaji ?? undefined,
    /*
      AniList führt bei chinesischen Produktionen oft keinen englischen
      Namen. Zwei Aushilfen, in dieser Reihenfolge: aniSearchs Sprachblock
      „Englisch", und AniLists eigene Synonymliste (`latein`) — dort steht
      für „Guimi Zhi Zhu: Wu Mian Ren Pian" ein „Lord of the Mysteries 2".
    */
    titleEn: englisch ?? eintrag?.englisch ?? englischAusSynonymen(eintrag?.synonyme) ?? e.latein ?? undefined,
    /* Nur, wenn er wirklich etwas Neues sagt — sonst steht dieselbe Zeichenkette zweimal. */
    titleDe: deutsch && deutsch !== englisch && deutsch !== romaji ? deutsch : undefined,
  }
}
