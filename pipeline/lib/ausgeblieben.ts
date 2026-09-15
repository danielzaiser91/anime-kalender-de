/**
 * **Was nach einem ausgebliebenen Termin geschieht — und wann.**
 *
 * Daniel am 13.09.2026: Wer „Folge 8 ist nicht erschienen" liest, fragt „und
 * wann dann?". Beantworten lässt sich das in drei Stufen, die verschieden viel
 * kosten und deshalb verschieden oft laufen:
 *
 * | Stufe | wer | wie oft |
 * |---|---|---|
 * | Anbieter-Kalender lesen | `termine-pruefen.ts` | mit jedem Sendezeiten-Lauf (mehrmals täglich) |
 * | Anime2You-Meldungen abgleichen | `termine-pruefen.ts` | dito, gegen den täglich geholten Feed |
 * | im Netz recherchieren | Cloud-Claude (`claude-verpasst-recherche.yml`) | täglich, ab sechs Stunden Verzug |
 *
 * Die ersten beiden kosten nichts und laufen deshalb immer. Die dritte kostet
 * Züge im Abo, und die meisten Ausfälle erledigen sich binnen Stunden: Ein
 * Simulcast-Dub kommt oft nur später am Tag. Erst was dann noch fehlt, ist eine
 * Recherche wert.
 */

const STUNDE = 36e5
const TAG = 24 * STUNDE

/*
  Fristen und Fälligkeit stehen seit dem 15.09.2026 in `shared/recherche-plan.ts`:
  Die Seite nennt dieselbe nächste Recherche, die der Lauf ansetzt (Daniel: „wann
  steht die nächste Prüfung an? Offen kommunizieren").
*/
export {
  RECHERCHE_AB_MS,
  RECHERCHE_TAKT_FRUEH_MS,
  RECHERCHE_TAKT_SPAET_MS,
  RECHERCHE_SPAET_AB_MS,
  RECHERCHE_BIS_MS,
  rechercheFaellig,
  naechsteRecherche,
  type OffenerVermerk,
} from '../../shared/recherche-plan.ts'
void STUNDE
void TAG

const normal = (s: string): string =>
  ` ${s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `

/**
 * Nennt dieser Artikeltitel den Anime?
 *
 * **Eng, weil ein Fehltreffer auf der Seite steht.** Anime2You führt je Tag
 * dutzende Titel, und eine Pausenmeldung zu „Blue Lock" darf nicht unter
 * „Blue Box" erscheinen. Verlangt wird deshalb der **ganze** Name als
 * Wortfolge, und nur Namen ab acht Zeichen zählen: Kürzere („Frieren",
 * „Dandadan") sind als Teil anderer Titel zu häufig, und für sie bleibt der
 * Weg über die Recherche.
 *
 * Staffelangaben werden vorher abgeschnitten: Die Meldung heißt „»Mushoku
 * Tensei« pausiert", nicht „Mushoku Tensei: Jobless Reincarnation – Staffel 3".
 */
export function artikelNenntTitel(artikelTitel: string, namen: (string | undefined)[]): boolean {
  const artikel = normal(artikelTitel)
  return namen.some((n) => {
    if (!n) return false
    const ohneStaffel = n
      .replace(/\s*[–—-]\s*(staffel|season|teil|part|cour)\s*\d+.*$/i, '')
      .replace(/\s+(staffel|season)\s+\d+.*$/i, '')
      .replace(/\s+\d+(st|nd|rd|th) season.*$/i, '')
    const kern = normal(ohneStaffel)
    return kern.trim().length >= 8 && artikel.includes(kern)
  })
}
