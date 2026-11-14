import type { NeueFolge } from './cr-neu-wache.ts'
import { staffelDerFolge } from './verpasst-katalog.ts'
import type { WocheBelege } from './woche-beleg.ts'

/**
 * **Eine Ankündigung ist keine Beobachtung** (14.11.2026, The Vermilion Mask Folge 3).
 *
 * Das Wochenprogramm kündigte die deutsche Folge 3 für den 14.11. 10:30 an; der Bau übernimmt solche Zeilen als
 * `observed` (ohne „≈“). Crunchyroll lieferte nicht, und `termine-pruefen.ts` sah den Termin trotzdem als bestätigt:
 * Die Ankündigung stand als Beobachtung im Kalender (`quelle: 'woche'`) und in `schedule.observed`. Dazu urteilte der
 * Lauf seit dem Ende des Simulcast-Kalenders (Fenster bis 21.10.2026) über keinen Termin mehr.
 */

/** Eine angekündigte deutsche Folge: Serienkennung, Folgennummer, Tag (Berlin). */
export interface AngekuendigteFolge {
  seriesId: string | null
  episode: number
  date: string
}

const schluessel = (serie: string, folge: number, tag: string): string => `${serie}|${folge}|${tag}`

/**
 * Alle angekündigten Folgen: die übernommenen Zeilen der laufenden Woche, die Wochenprogramm-Belege der letzten
 * drei Wochen (eine Zeile „Folge 3–5“ gilt für jede Folge darin) und die Kalender-Einträge mit `quelle: 'woche'`.
 */
export function angekuendigteFolgen(
  uebernommen: AngekuendigteFolge[],
  belege: WocheBelege,
  kalenderWoche: AngekuendigteFolge[],
): AngekuendigteFolge[] {
  const ausBelegen: AngekuendigteFolge[] = []
  for (const b of Object.values(belege)) {
    for (let folge = b.von; folge <= b.bis; folge++) ausBelegen.push({ seriesId: b.seriesId, episode: folge, date: b.datum })
  }
  return [...uebernommen, ...ausBelegen, ...kalenderWoche]
}

/**
 * Beobachtungen ohne Ankündigungen: Kalender-Einträge aus dem Wochenprogramm (`quelle: 'woche'`) und Folgentage, die
 * genau eine Ankündigung derselben Serie wiedergeben, belegen nicht, dass die Folge kam. Was bleibt, hat jemand gesehen.
 */
export function ohneAnkuendigung<T extends { date: string; episode?: number; quelle?: string }>(
  beobachtungen: T[],
  seriesId: string | undefined,
  angekuendigt: AngekuendigteFolge[],
): T[] {
  const menge = new Set(angekuendigt.filter((a) => a.seriesId).map((a) => schluessel(a.seriesId!, a.episode, a.date)))
  return beobachtungen.filter(
    (o) => o.quelle !== 'woche' && !(seriesId && o.episode != null && menge.has(schluessel(seriesId, o.episode, o.date))),
  )
}

/**
 * Wie lange nach der Frist der Katalog (`crunchyroll-neu.json`) noch über einen Termin urteilen darf. Er liest nur die
 * jüngsten 600 Folgen aller Sprachen; nach einem Ausfall des Stundenlaufs wäre eine längst erschienene Folge schon
 * herausgefallen und gälte als ausgeblieben. Ein Tag ist knapp bemessen: Der Lauf holt den Katalog stündlich.
 */
export const KATALOG_URTEIL_STUNDEN = 24

/**
 * Führt der Katalog die Serie in genau der Staffel, in der der Lauf sucht? Nur dann ist „nicht gefunden“ eine Auskunft.
 * Ascendance of a Bookworm (allein stehend, also Staffel 1 gerechnet) steht im Katalog als „Staffel 4“: Ohne diese Probe
 * hätten die pünktlichen Folgen 23 und 24 als ausgeblieben gegolten.
 */
export function staffelImKatalog(folgen: NeueFolge[], serieId: string | undefined, staffel: number | undefined): boolean {
  const derSerie = folgen.filter((f) => f.serieId === serieId)
  return derSerie.length > 0 && derSerie.every((f) => staffelDerFolge(f) === staffel)
}

/**
 * Darf der Lauf über diesen Termin urteilen? Im Fenster des Simulcast-Kalenders (bis 21.10.2026) wie bisher. Danach
 * nur über den Katalog: Er muss nach der Frist geholt sein, die Frist darf höchstens `KATALOG_URTEIL_STUNDEN` zurückliegen,
 * und die Staffel des Titels muss im Katalog eindeutig sein — sonst ist „nicht gefunden“ keine Auskunft.
 */
export function darfUrteilen(
  e: { date: string },
  fenster: { von: string; bis: string },
  katalog: { frist: Date; jetzt: Date; geholtAm: string | undefined; staffelEindeutig: boolean },
): boolean {
  if (e.date < fenster.von) return false
  if (e.date <= fenster.bis) return true
  if (!katalog.staffelEindeutig || !katalog.geholtAm) return false
  const geholt = new Date(katalog.geholtAm).getTime()
  if (!(geholt >= katalog.frist.getTime())) return false
  return katalog.jetzt.getTime() - katalog.frist.getTime() <= KATALOG_URTEIL_STUNDEN * 36e5
}
