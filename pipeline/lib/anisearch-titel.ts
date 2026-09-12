/**
 * **Welcher Name auf einer aniSearch-Seite der deutsche ist.**
 *
 * Steht in `lib/`, nicht im Abrufskript: Das ruft auf Modulebene ab, ein Import
 * daraus würde also einen Lauf über tausende fremde Seiten auslösen. Genau
 * dieser Fehlgriff hat am 30.08.2026 eine gepflegte YAML-Datei überschrieben.
 */
import { extractInfo } from '../fetch-anisearch.ts'

export type Titelherkunft = 'sprachblock' | 'synonym' | 'ueberschrift'

/**
 * **Der deutsche Name steht im deutschen Sprachblock — nicht in der Überschrift.**
 *
 * Die `<h1 id="htitle">` ist der *Haupttitel* der Seite und trägt keine
 * Sprachkennzeichnung; aniSearch wählt dort die gebräuchlichste Schreibweise.
 * Bei einem Titel **mit** deutscher Veröffentlichung ist das meistens der
 * deutsche Name — genau deshalb hat der Lauf hier lange funktioniert. Bei einem
 * Titel **ohne** ist es der japanische, und dann behauptet `titleDe` etwas
 * Falsches.
 *
 * Gemeldet von Daniel am 08.09.2026 an „Tensei Kizoku, Kantei Skill de
 * Nariagaru Dai 3 Ki" (aniSearch 19993, AniList 185756): Die Seite zeigt oben
 * die japanische Flagge, unter „Synonyme" aber „As a Reincarnated Aristocrat,
 * I'll Use My Appraisal Skill to Rise in the World: Staffel 3" — und Staffel 2
 * steht bei uns genau so im Bestand.
 *
 * Gefragt wird deshalb in dieser Reihenfolge:
 *
 * 1. **Der deutsche Sprachblock.** Er trägt die Flagge und ist damit belegt
 *    deutsch. Er gewinnt immer, wenn es ihn gibt — gemessen über alle 3.179
 *    archivierten Seiten weicht er in **97 von 98** Fällen vom Synonym ab, und
 *    zwar zu seinen Gunsten: „Die rothaarige Schneeprinzessin: Staffel 2"
 *    gegen „Snow White with the Red Hair (Staffel 2)".
 * 2. **Ein Synonym mit dem Wort „Staffel".** Das ist kein Namensraten, sondern
 *    ein Sprachmerkmal: „Staffel" steht in keinem englischen und in keinem
 *    japanischen Synonym. Es greift genau dort, wo es gebraucht wird — bei
 *    einer angekündigten Staffel, die hier noch nicht erschienen ist und
 *    deshalb keinen Sprachblock hat.
 * 3. **Die Überschrift**, als das, was sie ist: ein Name unbekannter Sprache.
 *    Sie bleibt, weil im Katalog sonst gar nichts stünde — aber sie wird als
 *    `ueberschrift` vermerkt, und `build.ts` macht daraus kein `titleDe`.
 */
export function titelAus(
  html: string,
): { titel: string; quelle: Titelherkunft; englisch?: string; synonyme?: string[] } | null {
  const info = extractInfo(html)

  /**
   * **Der englische Name, wo AniList keinen führt.**
   *
   * 8.683 Katalogtitel haben bei AniList kein `title.english`, 5.690 davon zu
   * chinesischen Originalen — 656 davon stehen in der Reihe eines Titels, den
   * jemand öffnen kann. Dort stand dann „Guimi Zhi Zhu: Wu Mian Ren Pian"
   * (Daniel, 12.09.2026: „why 2 of these titles have chinese titles, instead of
   * english/german"). aniSearch führt den englischen Namen im selben
   * Sprachblock, aus dem der deutsche kommt.
   */
  const englisch = info?.languages?.find((l) => l.language === 'Englisch')?.title?.trim() || undefined

  /*
    **Die Synonyme reisen mit — sie tragen oft den deutschen Namen.**

    Für „Kusuriya no Hitorigoto: Bouhi no Hihou" (aniSearch 20990) gibt es
    **keinen** deutschen Sprachblock, aber unter den Synonymen steht „Die
    Tagebücher der Apothekerin: Der Film" (gemessen 12.09.2026, nachdem Daniel
    es gemeldet hatte). Der Synonym-Zweig unten sucht nur Staffelnamen und
    trifft einen Filmtitel nie.

    Welches Synonym deutsch ist, entscheidet sich hier trotzdem nicht: aniSearch
    kennzeichnet sie nicht nach Sprache, und danebenstehen „Les Carnets de
    l'Apothicaire : Le Film" und „Los diarios de la boticaria: La película".
    Erst der Bau weiß, wie die **Reihe** auf Deutsch heißt — und ein Synonym,
    das mit diesem belegten Namen beginnt, ist die deutsche Fassung.
  */
  const synonyme = info?.synonyms?.map((t) => t.trim()).filter(Boolean)

  const block = info?.languages?.find((l) => l.language === 'Deutsch')?.title?.trim()
  if (block) return { titel: block, quelle: 'sprachblock', englisch, synonyme }

  /*
    Nur als eigenes Wort: „Staffel" darf nicht in „Staffelei" oder in einem
    zusammengesetzten Fremdwort greifen, und eine Zahl muss dabeistehen — ein
    Synonym ohne sie unterscheidet die Staffeln nicht, um die es hier geht.
  */
  const synonym = info?.synonyms?.find((t) => /\bStaffel\b/.test(t) && /\d/.test(t))?.trim()
  if (synonym) return { titel: synonym, quelle: 'synonym', englisch, synonyme }

  const m = /<h1[^>]*id="htitle"[^>]*>([^<]+)</.exec(html)
  const ueberschrift = m?.[1].replace(/\s+/g, ' ').trim()
  return ueberschrift ? { titel: ueberschrift, quelle: 'ueberschrift', englisch, synonyme } : null
}


