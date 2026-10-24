/**
 * Frische Filme und Discs fragt der JustWatch-Abruf dicht (alle `FRISCH_ALTER_TAGE`), statt erst nach 28 Tagen: Kauf- und Leihangebote bei
 * Prime Video erscheinen mit Kinoende oder Disc-Start, und der Reihum-Lauf (800 von rund 3.000 Titeln je Woche) kommt erst Wochen später vorbei
 * (All You Need Is Kill, 23.10.2026: Befund vom 17.09., Prime-Angebot ab 22.10.).
 */
import { readJson } from './util.ts'

export const FRISCH_ZURUECK_TAGE = 90
export const FRISCH_VORAUS_TAGE = 3
export const FRISCH_ALTER_TAGE = 3

interface TerminKurz {
  titleId: number
  platform: string
  schedule?: { firstEpisodeDate?: string }
}

interface AngebotKurz {
  anbieter: string
  art?: string
}

interface BefundFrisch {
  geprueftAm: string
  angebote?: AngebotKurz[]
}

const TAG = 86_400_000

/** Titel mit einem Kino- oder Disc-Termin von `FRISCH_ZURUECK_TAGE` zurück bis `FRISCH_VORAUS_TAGE` voraus. */
export function frischeTitel(termine: TerminKurz[], heute: string): Set<number> {
  const mit = new Set<number>()
  for (const t of termine) {
    if (t.platform !== 'kino' && t.platform !== 'disc') continue
    const datum = t.schedule?.firstEpisodeDate
    if (!datum) continue
    const tage = (Date.parse(heute) - Date.parse(datum)) / TAG
    if (tage <= FRISCH_ZURUECK_TAGE && tage >= -FRISCH_VORAUS_TAGE) mit.add(t.titleId)
  }
  return mit
}

/** Der digitale Amazon-Shop bei JustWatch; „Amazon DVD / Blu-ray“ und die Kanäle („… Amazon Channel“) sind etwas anderes (auch für den Kaufweg im Bau). */
export const AMAZON_VIDEO_SHOP = /^amazon (prime )?video$/i

/** Schon ein Kauf-/Leihangebot im digitalen Amazon-Shop gefunden: dann gibt es nichts mehr zu erwarten. */
function hatPrimeKauf(e: BefundFrisch): boolean {
  return (e.angebote ?? []).some((a) => AMAZON_VIDEO_SHOP.test(a.anbieter) && (a.art === 'BUY' || a.art === 'RENT'))
}

/** Ein frischer Titel, dessen Befund mindestens `FRISCH_ALTER_TAGE` alt ist und noch kein Prime-Kauf kennt. */
export function frischFaellig(id: number, e: BefundFrisch | undefined, frisch: ReadonlySet<number>, heute: string): boolean {
  if (!frisch.has(id) || !e) return false
  if (hatPrimeKauf(e)) return false
  return (Date.parse(heute) - Date.parse(e.geprueftAm)) / TAG >= FRISCH_ALTER_TAGE
}

/** Die frischen Titel aus der Terminliste `datei` (im Abruf `public/data/releases.json`); fehlt die Datei, ist keiner frisch. */
export function ladeFrische(datei: string, heute: string): Set<number> {
  return frischeTitel(readJson<TerminKurz[]>(datei, []), heute)
}
