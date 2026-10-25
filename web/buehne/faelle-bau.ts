import { ergaenzeOptionsFaelle } from './fall-optionen.ts'
import { NUTZER_FAELLE, nutzerAus, type Nutzer } from './nutzer-faelle.ts'

/** Die eingefrorenen Fälle (`faelle.json`, geschrieben von `tools/buehne-faelle.mjs`) und der umgebogene `fetch`. */
export interface Fall {
  name: string
  titleId: number
  synopsen: Record<string, unknown>
  disc: Record<string, unknown>
  sprecher: Record<string, unknown>
  folgen: Record<string, unknown>
  /** Nur bei Nutzer-Fällen (`nutzer-faelle.ts`). */
  nutzer?: Nutzer
  [datei: string]: unknown
}

export interface FaelleDatei {
  heute: string
  meta: unknown
  faelle: Record<string, Fall>
}

/** Kennung des Gesamtbestands: alle Fälle zusammen, für die Ausschnitte `filter`, `kachel` und `ganz`. */
export const ALLE = 'alle'

/** Listen werden aneinandergehängt, Verzeichnisse (nach Kennung) zusammengelegt; der Schneider sorgt dafür, dass sich die Fälle nicht überschneiden. */
function vereine(a: unknown, b: unknown): unknown {
  return Array.isArray(a) && Array.isArray(b) ? [...a, ...b] : { ...(a as object), ...(b as object) }
}

function gesamtbestand(faelle: Fall[]): Fall {
  const summe: Fall = { name: `Alle ${faelle.length} Fälle zusammen`, titleId: faelle[0]!.titleId, synopsen: {}, disc: {}, sprecher: {}, folgen: {} }
  for (const fall of faelle) {
    for (const [datei, inhalt] of Object.entries(fall)) {
      if (datei !== 'name' && datei !== 'titleId') summe[datei] = datei in summe ? vereine(summe[datei], inhalt) : inhalt
    }
  }
  return summe
}

/** Nutzer-Fälle tragen den Gesamtbestand und dazu den Zustand des Besuchers. */
function ergaenzeNutzerFaelle(faelle: Record<string, Fall>): void {
  const alle = faelle[ALLE]!
  const kennungen = (alle['titles.json'] as { id: number }[]).map((t) => t.id)
  for (const [kennung, spec] of Object.entries(NUTZER_FAELLE)) {
    faelle[kennung] = { ...alle, name: spec.name, nutzer: nutzerAus(kennungen, spec) }
  }
}

/** Aus der geladenen Datei: Gesamtbestand und Nutzer-Fälle kommen dazu. */
export function baueFaelle(datei: FaelleDatei): FaelleDatei {
  datei.faelle[ALLE] = gesamtbestand(Object.values(datei.faelle))
  ergaenzeNutzerFaelle(datei.faelle)
  ergaenzeOptionsFaelle(datei.faelle)
  return datei
}

/** Holt die rohe Datei von `adresse` (`abruf` ist im Test eine Attrappe) und baut die Fälle. */
export async function ladeFaelleAus(adresse: URL, abruf: typeof fetch = fetch): Promise<FaelleDatei> {
  const antwort = await abruf(adresse)
  return baueFaelle((await antwort.json()) as FaelleDatei)
}
