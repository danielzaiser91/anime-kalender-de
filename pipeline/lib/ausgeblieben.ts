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

import { addDays, toIsoDate } from '../../shared/time.ts'

const STUNDE = 36e5
const TAG = 24 * STUNDE

/*
  Fristen und Fälligkeit stehen seit dem 15.09.2026 in `shared/recherche-plan.ts`:
  Die Seite nennt dieselbe nächste Recherche, die der Lauf ansetzt.
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

/**
 * Welche Folge an einem ausgebliebenen Termin fällig war.
 *
 * Nicht die Nummer des Kalendereintrags: Nach einem Ausfall rechnet der Kalender
 * vom Ersatztermin aus neu und zeigt am nächsten Termin wieder dieselbe Folge.
 * Fällig war die letzte gesehene Folge plus je eine für jeden seither
 * ausgebliebenen Termin (Hana-Kimi Staffel 2: 16./23./30.09. → 10, 11, 12).
 */
export function folgeAmVerpasstenTermin(
  datum: string,
  kalenderFolge: number | undefined,
  gesehen: { date: string; episode?: number }[],
  verpassteTage: string[],
): number | null {
  const letzte = gesehen
    .filter((o) => o.episode != null && o.date < datum)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.episode! - a.episode!))[0]
  if (!letzte) return kalenderFolge ?? null
  const dazwischen = new Set(verpassteTage.filter((t) => t > letzte.date && t < datum)).size
  return Math.max(kalenderFolge ?? 0, letzte.episode! + dazwischen + 1)
}

/**
 * Welche Vermerke noch ein Bild brauchen (`pipeline/messbelege.ts`): das Bemerken eines Ausfalls und
 * das Nachreichen, je mit dem Kalendertag, auf den sich die Meldung bezieht. Nur frische — nach
 * 14 Tagen zeigt die Seite einen anderen Stand als beim Messen.
 */
export function offeneMessbelege<V extends { bemerktAm: string; erwartetAm: string; erschienenAm: string | null; messbeleg?: unknown; nachgereichtBeleg?: unknown }>(
  verpasst: V[],
  heute: string,
  hoechstens: number,
): { v: V; feld: 'messbeleg' | 'nachgereichtBeleg'; tag: string }[] {
  const frisch = (iso: string) => toIsoDate(new Date(iso)) >= addDays(heute, -14)
  const raus: { v: V; feld: 'messbeleg' | 'nachgereichtBeleg'; tag: string }[] = []
  for (const v of verpasst) {
    if (!v.messbeleg && frisch(v.bemerktAm)) raus.push({ v, feld: 'messbeleg', tag: toIsoDate(new Date(v.erwartetAm)) })
    if (v.erschienenAm && !v.nachgereichtBeleg && frisch(v.erschienenAm))
      raus.push({ v, feld: 'nachgereichtBeleg', tag: toIsoDate(new Date(v.erschienenAm)) })
  }
  return raus.slice(0, hoechstens)
}

/** Ablageschlüssel eines Messbelegs — nur Kleinbuchstaben, Ziffern und `/_.-` (Regel des Workers, `SCHLUESSEL`). */
export function messbelegSchluessel(tag: string, amIso: string): string {
  return `www.crunchyroll.com/simulcastcalendar/${tag}/${amIso.slice(0, 16).replace(/[T:]/g, '-')}`
}
