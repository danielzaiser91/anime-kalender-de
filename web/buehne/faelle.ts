import faelleAdresse from './faelle.json?url'
import { ladeFaelleAus, type FaelleDatei, type Fall } from './faelle-bau.ts'

export { ALLE, type FaelleDatei, type Fall } from './faelle-bau.ts'

const PLATZHALTER = 'https://platzhalter.invalid/'
/** Dieselbe Gruppengröße wie `SYNOPSIS_GROUPS` in `shared/types.ts`. */
const GRUPPEN = 32

export async function ladeFaelle(): Promise<FaelleDatei> {
  return ladeFaelleAus(new URL(faelleAdresse, document.baseURI))
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
