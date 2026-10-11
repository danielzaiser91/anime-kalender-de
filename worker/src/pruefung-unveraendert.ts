/**
 * **Eine unveränderte Meldung schreibt nichts** (11.10.2026).
 *
 * Der „alle durchgehen"-Lauf meldet Titel erneut, deren Inhalt sich nicht geändert hat; jede
 * dieser Meldungen kostete rund 12 geschriebene D1-Zeilen (löschen + einfügen samt Indexen). Der
 * Hash über den ganzen Rumpf (inklusive Rohfolgen) entscheidet: Trägt die offene Zeile derselben
 * Folge denselben Hash, ist nichts zu tun. Eine abgehakte (`uebernommen = 1`) Zeile zählt nicht —
 * dann entsteht einmal eine neue offene Zeile, danach greift der Hash.
 *
 * Die offenen Hashes aller Adressen eines Aufrufs werden mit **einer** Abfrage geladen: ein Stapel
 * hat höchstens 50 Abfragen (Subrequests), eine Abfrage je Meldung sprengte das Budget.
 */
import { type Env } from './env.ts'

/** Schlüssel (Adresse, Folge, Staffel, Seite) → Hashes der offenen Zeilen; mehrere Zeilen sind Dubletten. */
export type OffeneHashes = Map<string, (string | null)[]>

export type Folge = { url: string; folgeNr: number | null; staffelNr: number | null; seitenKennung: string | null }

const schluessel = (f: Folge) => JSON.stringify([f.url, f.folgeNr, f.staffelNr, f.seitenKennung])

/** JSON mit sortierten Schlüsseln, damit dieselbe Meldung immer denselben Text ergibt. */
function normalisiert(wert: unknown): unknown {
  if (Array.isArray(wert)) return wert.map(normalisiert)
  if (wert && typeof wert === 'object') {
    const geordnet: Record<string, unknown> = {}
    for (const k of Object.keys(wert).sort()) geordnet[k] = normalisiert((wert as Record<string, unknown>)[k])
    return geordnet
  }
  return wert
}

export async function meldungsHash(daten: Record<string, unknown>): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(normalisiert(daten)))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Die offenen Zeilen der Adressen, gelesen über `pruefung_url_zeit`. */
export async function ladeOffeneHashes(env: Env, urls: string[]): Promise<OffeneHashes> {
  const offene: OffeneHashes = new Map()
  const einzigartig = [...new Set(urls)]
  if (!einzigartig.length) return offene
  const { results } = await env.DB.prepare(
    `SELECT url, folge_nr, staffel, seiten_kennung, hash FROM pruefung
      WHERE uebernommen = 0 AND url IN (${einzigartig.map(() => '?').join(',')})`,
  )
    .bind(...einzigartig)
    .all<{ url: string; folge_nr: number | null; staffel: number | null; seiten_kennung: string | null; hash: string | null }>()
  for (const r of results ?? []) {
    const k = schluessel({ url: r.url, folgeNr: r.folge_nr, staffelNr: r.staffel, seitenKennung: r.seiten_kennung })
    offene.set(k, [...(offene.get(k) ?? []), r.hash])
  }
  return offene
}

/** Genau eine offene Zeile mit gleichem Hash; mehrere (Dubletten) werden wie bisher aufgeräumt. */
export function istUnveraendert(offene: OffeneHashes | undefined, f: Folge, hash: string): boolean {
  const treffer = offene?.get(schluessel(f))
  return treffer?.length === 1 && treffer[0] === hash
}
