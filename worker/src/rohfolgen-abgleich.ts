/**
 * **Rohfolgen abgleichen statt neu schreiben** (12.10.2026, Migration 050).
 *
 * Jede Meldung löschte die offenen Rohfolgen ihrer Seite und schrieb alle neu, auch unveränderte:
 * je Zeile Tabelle + `sqlite_sequence` + drei Indexe, beim Löschen noch einmal. Am Tag eines
 * Durchgangs (Prime, Netflix, Disney+) waren das 11.106 Einfügungen à 8 Zeilen. Jetzt trägt jede
 * Zeile den Hash ihrer Felder: Gleicher Hash = stehen lassen. Nur Geänderte werden gelöscht und
 * eingefügt, Fehlende gelöscht, Neue eingefügt. Gleiche Hashes mehrfach (Dubletten) zählen als Menge.
 *
 * `gemeldet_am` einer stehengebliebenen Zeile bleibt alt: Kein Leser braucht es frisch. Die Pipeline
 * liest es nur für „jüngste gewinnt" unter Dubletten und als Anzeige `gesehen` in der Zuordnung; die
 * Wiedervorlage rechnet über `pruefung.gemeldet_am` (`pruefung-unveraendert.ts`).
 */
import { fehlerLog } from './werte.ts'
import { type Env } from './env.ts'

export type OffeneRohfolge = { id: number; hash: string | null }

/* D1 bindet höchstens 100 Werte je Anfrage; zwei sind Adresse und Plattform. */
const STAPEL = 90

/** Welche Zeilen bleiben, gehen oder kommen: `einfuegen` sind Positionen in `hashes`. */
export function rohfolgenAbgleich(
  offene: OffeneRohfolge[],
  hashes: string[],
): { loeschen: number[]; einfuegen: number[] } {
  const frei = new Map<string, number[]>()
  for (const o of offene) {
    if (o.hash) frei.set(o.hash, [...(frei.get(o.hash) ?? []), o.id])
  }
  const einfuegen: number[] = []
  hashes.forEach((h, i) => {
    const ids = frei.get(h)
    if (ids?.length) ids.pop()
    else einfuegen.push(i)
  })
  const loeschen = [...offene.filter((o) => !o.hash).map((o) => o.id), ...[...frei.values()].flat()]
  return { loeschen, einfuegen }
}

/**
 * Die offenen Zeilen, die diese Meldung ersetzt (vorher löschte ein DELETE dieselbe Menge).
 *
 * **Je Adresse UND Plattform** (seit 01.09.2026; Netflix und Disney+ melden ebenfalls hierher).
 * Netflix und Disney+ melden je Folge — dort ersetzt eine Meldung nur ihre eigene Kennung (`gti`),
 * sonst bliebe von 26 Rohfolgen nur die letzte stehen (11.09.2026). Prime schickt alle Folgen einer
 * Seite auf einmal: je Seite, nicht nur je Adresse (Migration 030, 17.09.2026).
 *
 * Mit erzwungenem Index: ohne ihn nahm der Planer `prime_folge_plattform` und las im Mittel 3430
 * Zeilen (26 % des Kontingents, 28.09.2026). Ein Fehler hier reißt die Meldung nicht mit.
 */
export async function ladeOffeneRohfolgen(
  env: Env,
  plattform: string,
  url: string,
  seitenKennung: string | null,
  kennungen: string[],
): Promise<OffeneRohfolge[]> {
  try {
    if (plattform === 'primevideo' || !kennungen.length) {
      const { results } = await env.DB.prepare(
        'SELECT id, hash FROM prime_folge INDEXED BY prime_folge_seite WHERE url = ?1 AND plattform = ?2 AND uebernommen = 0 AND seiten_kennung IS ?3',
      )
        .bind(url, plattform, seitenKennung)
        .all<OffeneRohfolge>()
      return results ?? []
    }
    const offene: OffeneRohfolge[] = []
    for (let i = 0; i < kennungen.length; i += STAPEL) {
      const teil = kennungen.slice(i, i + STAPEL)
      const { results } = await env.DB.prepare(
        `SELECT id, hash FROM prime_folge INDEXED BY prime_folge_gti WHERE url = ? AND plattform = ? AND uebernommen = 0 AND gti IN (${teil.map(() => '?').join(',')})`,
      )
        .bind(url, plattform, ...teil)
        .all<OffeneRohfolge>()
      offene.push(...(results ?? []))
    }
    return offene
  } catch (e) {
    fehlerLog('prime_folge laden', e)
    return []
  }
}

/** Löscht die Zeilen über ihre ID (Primärschlüssel, liest keine weiteren Zeilen). */
export async function loescheRohfolgen(env: Env, ids: number[]): Promise<void> {
  if (!ids.length) return
  const stapel: D1PreparedStatement[] = []
  for (let i = 0; i < ids.length; i += STAPEL) {
    const teil = ids.slice(i, i + STAPEL)
    stapel.push(env.DB.prepare(`DELETE FROM prime_folge WHERE id IN (${teil.map(() => '?').join(',')})`).bind(...teil))
  }
  try {
    await env.DB.batch(stapel)
  } catch (e) {
    fehlerLog('prime_folge aufraeumen', e)
  }
}
