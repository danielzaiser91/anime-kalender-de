/**
 * **Ein altes Nein aus `crunchyroll-offene.json` gilt nicht mehr, wenn der Dub-Bestand es widerlegt.**
 *
 * Anlass (25.10.2026): Vier deutsche Crunchyroll-Folgen fehlten im Kalender (Last Boss S2,
 * Apothekerin S3). `fetch-crunchyroll-offene.ts` hatte die Staffel Wochen vorher mit
 * `dub: false` belegt — damals war noch keine Folge deutsch. Der Bau wendet das Nein ohne
 * Vergleich an und warf den Verweis weg, obwohl `crunchyroll-dub.json` inzwischen jünger war
 * und die Staffel mit deutschen Folgen führte.
 *
 * Überholt ist ein Nein nur, wenn dieselbe Serie im Dub-Bestand ein **neueres** Prüfdatum trägt
 * UND ein Block mit mindestens einer deutschen Folge zum Namen des Neins passt. Ein anderer
 * Block derselben Serie (Fruits Basket: Nein für Staffel 1, deutsch ist Staffel 2) kippt nichts.
 */
import type { Title } from '../../shared/types.ts'
import type { CrSerie } from './crunchyroll-dub.ts'
import { zerlege } from './cr-staffel-nummer.ts'
import { log } from './util.ts'
import { gruppiereJeKennung } from './je-kennung.ts'

export interface OffenerBefund {
  herkunft?: string
  dub?: boolean
  seriesId?: string
  titel?: string
  geprueftAm?: string
}

/**
 * Meinen beide Namen dieselbe Staffel? Mit Nummer: gleiche Nummer, und die Namensreste dürfen
 * sich nur um den Serienname-Präfix unterscheiden (einer leer oder im anderen enthalten).
 * Ohne Nummer: der ganze Name muss gleich sein.
 */
export function gleicherBlock(neinTitel: string, blockName: string): boolean {
  const a = zerlege(neinTitel)
  const b = zerlege(blockName)
  if (a.nr !== b.nr) return false
  if (a.nr === null) return a.kern === b.kern
  return !a.kern || !b.kern || a.kern.includes(b.kern) || b.kern.includes(a.kern)
}

/** Alle Katalogeinträge je Serienkennung — eine Kennung steht oft unter zwei Adressen (verschieden frische Abrufe). */
export function serienNachKennung(serien: CrSerie[]): Map<string, CrSerie[]> {
  return gruppiereJeKennung(serien, (s) => s.seriesId)
}

/** Ein Eintrag mit neuerem Abruf und deutschem Block genügt: der ältere Doppeleintrag darf das Urteil nicht verdecken. */
export function neinUeberholt(b: OffenerBefund | undefined, serien: Map<string, CrSerie[]>): boolean {
  if (b?.dub !== false || !b.seriesId || !b.titel || !b.geprueftAm) return false
  return (serien.get(b.seriesId) ?? []).some(
    (serie) =>
      !!serie.geprueftAm &&
      serie.geprueftAm > b.geprueftAm! &&
      (serie.staffeln ?? []).some((st) => (st.deutsch ?? 0) > 0 && gleicherBlock(b.titel!, st.name)),
  )
}

/** Wie `neinUeberholt`, nennt aber jeden gekippten Fall im Bau-Protokoll (`titel` ist der Titel, dessen Verweis es trifft). */
export function neinUeberholtMitLog(b: OffenerBefund, serien: Map<string, CrSerie[]>, titel: Title): boolean {
  if (!neinUeberholt(b, serien)) return false
  const wer = titel.titleDe ?? titel.titleEn ?? titel.titleRomaji ?? titel.id
  log(`  ${wer}: Crunchyroll-Nein vom ${b.geprueftAm} (${b.titel}) vom Dub-Bestand überholt`)
  return true
}

/** Jüngster Prüftag je Kennung (ohne Datum am Eintrag gilt `rueckfall`): ein älterer Doppeleintrag darf ihn nicht senken. */
export function juengstePruefungJeKennung(serien: Map<string, CrSerie[]>, rueckfall: string): Map<string, string> {
  return new Map(
    [...serien].map(([k, liste]) => [k, liste.map((s) => s.geprueftAm ?? rueckfall).reduce((a, b) => (b > a ? b : a))]),
  )
}
