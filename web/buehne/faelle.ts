import faelleAdresse from './faelle.json?url'
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

const PLATZHALTER = 'https://platzhalter.invalid/'
/** Dieselbe Gruppengröße wie `SYNOPSIS_GROUPS` in `shared/types.ts`. */
const GRUPPEN = 32

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

export async function ladeFaelle(): Promise<FaelleDatei> {
  const antwort = await fetch(new URL(faelleAdresse, document.baseURI))
  const datei = (await antwort.json()) as FaelleDatei
  datei.faelle[ALLE] = gesamtbestand(Object.values(datei.faelle))
  ergaenzeNutzerFaelle(datei.faelle)
  return datei
}

function gruppeVon(quelle: Record<string, unknown>, nummer: number): Record<string, unknown> {
  return Object.fromEntries(Object.entries(quelle).filter(([id]) => Number(id) % GRUPPEN === nummer))
}

/** Die Datei, die die Seite unter `data/<pfad>` abruft — oder `undefined`, wenn der Fall sie nicht trägt. */
export function dateiVon(pfad: string, faelle: FaelleDatei, fall: Fall): unknown {
  if (pfad === 'meta.json') return faelle.meta
  const gruppe = /^(synopses|disc)\/(\d+)\.json$/.exec(pfad)
  if (gruppe) return gruppeVon(gruppe[1] === 'disc' ? fall.disc : fall.synopsen, Number(gruppe[2]))
  const stimme = /^voices\/(\d+)\.json$/.exec(pfad)
  if (stimme) return fall.sprecher[stimme[1]!]
  const liste = /^folgen\/(\d+)\.json$/.exec(pfad)
  if (liste) return fall.folgen[liste[1]!]
  return fall[pfad]
}

/**
 * Biegt `fetch` auf den Fall um: `…/data/<datei>` kommt aus der Datei, alles andere gibt 404 (kein Netz).
 * Die Bildplatzhalter bekommen dabei die Adresse der Bühne selbst.
 */
export function biegeFetchUm(faelle: FaelleDatei, fall: Fall): void {
  const eigene = new URL('./', document.baseURI).href
  window.fetch = async (eingabe) => {
    const adresse = new URL(eingabe instanceof Request ? eingabe.url : String(eingabe), document.baseURI)
    const pfad = /\/data\/(.+\.json)$/.exec(adresse.pathname)?.[1]
    const inhalt = adresse.origin === location.origin && pfad ? dateiVon(pfad, faelle, fall) : undefined
    if (inhalt === undefined) return new Response('', { status: 404 })
    return new Response(JSON.stringify(inhalt).replaceAll(PLATZHALTER, eigene), { headers: { 'Content-Type': 'application/json' } })
  }
}
