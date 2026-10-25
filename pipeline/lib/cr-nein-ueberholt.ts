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
import { log } from './util.ts'

export interface OffenerBefund {
  herkunft?: string
  dub?: boolean
  seriesId?: string
  titel?: string
  geprueftAm?: string
}

const STAFFEL = /\b(?:staffel|season)\s*(\d+)\b/i

/** Staffelnummer (`Season 2` ≙ `Staffel 2`) und der Rest des Namens ohne Satzzeichen. */
function zerlege(name: string): { nr: number | null; kern: string } {
  const nr = STAFFEL.exec(name)?.[1]
  const kern = name
    .replace(STAFFEL, ' ')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
  return { nr: nr ? Number(nr) : null, kern }
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

export function serienNachKennung(serien: CrSerie[]): Map<string, CrSerie> {
  const raus = new Map<string, CrSerie>()
  for (const s of serien) if (s.seriesId) raus.set(s.seriesId, s)
  return raus
}

export function neinUeberholt(b: OffenerBefund | undefined, serien: Map<string, CrSerie>): boolean {
  if (b?.dub !== false || !b.seriesId || !b.titel || !b.geprueftAm) return false
  const serie = serien.get(b.seriesId)
  if (!serie?.geprueftAm || serie.geprueftAm <= b.geprueftAm) return false
  return (serie.staffeln ?? []).some((st) => (st.deutsch ?? 0) > 0 && gleicherBlock(b.titel!, st.name))
}

/** Wie `neinUeberholt`, nennt aber jeden gekippten Fall im Bau-Protokoll (`titel` ist der Titel, dessen Verweis es trifft). */
export function neinUeberholtMitLog(b: OffenerBefund, serien: Map<string, CrSerie>, titel: Title): boolean {
  if (!neinUeberholt(b, serien)) return false
  const wer = titel.titleDe ?? titel.titleEn ?? titel.titleRomaji ?? titel.id
  log(`  ${wer}: Crunchyroll-Nein vom ${b.geprueftAm} (${b.titel}) vom Dub-Bestand überholt`)
  return true
}
