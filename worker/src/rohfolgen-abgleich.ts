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
 *
 * **Auch übernommene Zeilen zählen als Vergleich** (12.10.2026): Nach der Übernahme durch den Bau
 * (`uebernommen = 1`) fand der Abgleich nichts mehr und schrieb jeden Durchgang dieselben Folgen
 * erneut (223 von 300 Stichproben-Zeilen hatten Seite und Nummer schon, 165 sogar dieselben
 * Sprachen). Trägt die **jüngste** übernommene Zeile derselben Folge (Asin, gti, Nummer) denselben
 * Hash, gibt es nichts Neues. Eine ältere zählt nicht: Kehrt eine Folge zu einem früheren Stand
 * zurück (A, B, A), muss A wieder als jüngste ankommen, sonst gewänne bei „jüngste gewinnt" B.
 * Altbestand ohne Hash wird einmal neu geschrieben, danach greift der Vergleich.
 */
import { fehlerLog } from './werte.ts'
import { type Env } from './env.ts'
import { istD1Abweisung } from './d1-limit.ts'

export type Rohfolge = {
  id: number
  hash: string | null
  uebernommen: number
  asin: string | null
  gti: string | null
  nummer: number | null
}

/* D1 bindet höchstens 100 Werte je Anfrage; zwei sind Adresse und Plattform. */
const STAPEL = 90

const folgenSchluessel = (r: Rohfolge) => `${r.asin}|${r.gti}|${r.nummer}`

/** Die Hashes, die je Folge in der jüngsten übernommenen Zeile stehen. */
function aktuelleUebernommene(vorhandene: Rohfolge[]): Set<string> {
  const juengste = new Map<string, Rohfolge>()
  for (const r of vorhandene) {
    const da = juengste.get(folgenSchluessel(r))
    if (r.uebernommen && (!da || r.id > da.id)) juengste.set(folgenSchluessel(r), r)
  }
  return new Set([...juengste.values()].flatMap((r) => (r.hash ? [r.hash] : [])))
}

/**
 * Welche Zeilen bleiben, gehen oder kommen: `einfuegen` sind Positionen in `hashes`. Offene Zeilen
 * zählen als Menge; ein Hash, den die jüngste übernommene Zeile der Folge trägt, wird nicht neu geschrieben.
 */
export function rohfolgenAbgleich(
  vorhandene: Rohfolge[],
  hashes: string[],
): { loeschen: number[]; einfuegen: number[] } {
  const offene = vorhandene.filter((r) => !r.uebernommen)
  const uebernommen = aktuelleUebernommene(vorhandene)
  const frei = new Map<string, number[]>()
  for (const o of offene) {
    if (o.hash) frei.set(o.hash, [...(frei.get(o.hash) ?? []), o.id])
  }
  const einfuegen: number[] = []
  hashes.forEach((h, i) => {
    const ids = frei.get(h)
    if (ids?.length) ids.pop()
    else if (!uebernommen.has(h)) einfuegen.push(i)
  })
  const loeschen = [...offene.filter((o) => !o.hash).map((o) => o.id), ...[...frei.values()].flat()]
  return { loeschen, einfuegen }
}

const SPALTEN = 'id, hash, uebernommen, asin, gti, nummer'

/**
 * Die Zeilen der Seite bzw. Kennungen, offene **und** übernommene (vorher nur die offenen, die diese
 * Meldung ersetzt; vorher löschte ein DELETE dieselbe Menge). Die Lesemenge ist dieselbe: Der Index
 * liefert die Zeilen der Seite, `uebernommen` war nur ein Filter dahinter (lokal gemessen, `rows_read`).
 *
 * **Je Adresse UND Plattform** (seit 01.09.2026; Netflix und Disney+ melden ebenfalls hierher).
 * Netflix und Disney+ melden je Folge — dort ersetzt eine Meldung nur ihre eigene Kennung (`gti`),
 * sonst bliebe von 26 Rohfolgen nur die letzte stehen (11.09.2026). Prime schickt alle Folgen einer
 * Seite auf einmal: je Seite, nicht nur je Adresse (Migration 030, 17.09.2026).
 *
 * Mit erzwungenem Index: ohne ihn nahm der Planer `prime_folge_plattform` und las im Mittel 3430
 * Zeilen (26 % des Kontingents, 28.09.2026). Ein Fehler hier reißt die Meldung nicht mit.
 */
export async function ladeRohfolgen(
  env: Env,
  plattform: string,
  url: string,
  seitenKennung: string | null,
  kennungen: string[],
): Promise<Rohfolge[]> {
  try {
    if (plattform === 'primevideo' || !kennungen.length) {
      const { results } = await env.DB.prepare(
        `SELECT ${SPALTEN} FROM prime_folge INDEXED BY prime_folge_seite WHERE url = ?1 AND plattform = ?2 AND seiten_kennung IS ?3`,
      )
        .bind(url, plattform, seitenKennung)
        .all<Rohfolge>()
      return results ?? []
    }
    const vorhandene: Rohfolge[] = []
    for (let i = 0; i < kennungen.length; i += STAPEL) {
      const teil = kennungen.slice(i, i + STAPEL)
      const { results } = await env.DB.prepare(
        `SELECT ${SPALTEN} FROM prime_folge INDEXED BY prime_folge_gti WHERE url = ? AND plattform = ? AND gti IN (${teil.map(() => '?').join(',')})`,
      )
        .bind(url, plattform, ...teil)
        .all<Rohfolge>()
      vorhandene.push(...(results ?? []))
    }
    return vorhandene
  } catch (e) {
    /* Abweisung durch D1 (Export, Tageslimit): ohne die vorhandenen Zeilen entstünden Dubletten, also scheitern. */
    if (istD1Abweisung(e)) throw e
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
    if (istD1Abweisung(e)) throw e
    fehlerLog('prime_folge aufraeumen', e)
  }
}
