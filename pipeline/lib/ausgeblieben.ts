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

/** Unter diesem Verzug wird nicht recherchiert — die meisten Fälle erledigen sich vorher. */
export const RECHERCHE_AB_MS = 6 * STUNDE
/** Täglich in den ersten zwei Wochen … */
export const RECHERCHE_TAKT_FRUEH_MS = 20 * STUNDE
/** … danach wöchentlich: Wer zwei Wochen nichts meldet, meldet selten am dritten Tag. */
export const RECHERCHE_TAKT_SPAET_MS = 6.5 * TAG
export const RECHERCHE_SPAET_AB_MS = 14 * TAG
/** Nach zwei Monaten ohne Folge sucht niemand mehr täglich — der Vermerk bleibt stehen. */
export const RECHERCHE_BIS_MS = 60 * TAG

export interface OffenerVermerk {
  erwartetAm: string
  erschienenAm?: string | null
  rechercheAm?: string | null
}

/**
 * Ist dieser Vermerk heute eine Recherche wert?
 *
 * Die Frist hängt am Alter des Ausfalls, nicht an der Zahl der Versuche:
 * „20 Stunden" statt „24", damit ein täglicher Lauf, der mal zehn Minuten
 * früher startet, keinen Tag überspringt.
 */
export function rechercheFaellig(v: OffenerVermerk, jetzt: Date): boolean {
  if (v.erschienenAm) return false
  const seit = jetzt.getTime() - new Date(v.erwartetAm).getTime()
  if (!Number.isFinite(seit) || seit < RECHERCHE_AB_MS || seit > RECHERCHE_BIS_MS) return false
  if (!v.rechercheAm) return true
  const takt = seit > RECHERCHE_SPAET_AB_MS ? RECHERCHE_TAKT_SPAET_MS : RECHERCHE_TAKT_FRUEH_MS
  return jetzt.getTime() - new Date(v.rechercheAm).getTime() >= takt
}

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
