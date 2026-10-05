/** Messwerte der letzten Tage aus `site_history`, für die Wochenmail des Wächters. */

export interface Messwerte {
  /** Mittelwert der erfolgreichen Messungen in ms. */
  avg: number
  max: number
  /** Anzahl der Läufe im Zeitraum, erfolglose eingerechnet. */
  laeufe: number
}

/** Nur das, was gelesen wird — `D1Database` ist im Haupt-Typcheck (`tsc -b`, über `check-logic`) unbekannt; der echte Typ passt strukturell. */
export interface LesendeDb {
  prepare(sql: string): { bind(...werte: unknown[]): { all<T>(): Promise<{ results?: T[] }> } }
}

export async function ladeMesswerte(db: LesendeDb, nowIso: string, tage = 7): Promise<Map<string, Messwerte>> {
  const seit = new Date(Date.parse(nowIso) - tage * 86_400_000).toISOString()
  try {
    const { results } = await db
      .prepare(
        `SELECT url, ROUND(AVG(CASE WHEN ok = 1 THEN ms END)) AS avg, MAX(ms) AS max, COUNT(*) AS laeufe
           FROM site_history WHERE checked_at >= ?1 GROUP BY url`,
      )
      .bind(seit)
      .all<{ url: string; avg: number | null; max: number; laeufe: number }>()
    return new Map(
      (results ?? []).filter((r) => r.avg !== null).map((r) => [r.url, { avg: r.avg as number, max: r.max, laeufe: r.laeufe }]),
    )
  } catch (err) {
    console.error('Messwerte nicht geladen:', err)
    return new Map()
  }
}

const TD = 'padding:5px 0 5px 10px;border-top:1px solid #232c40;text-align:right;color:#7c879e;font-size:12px;white-space:nowrap;'

/** Tabellenzelle „Ø · max · Läufe"; leer, solange noch kein Verlauf da ist. */
export function messZelle(w: Messwerte | undefined): string {
  return `<td style="${TD}">${w ? `Ø ${w.avg} · max ${w.max} ms · ${w.laeufe}×` : ''}</td>`
}

export function messText(w: Messwerte | undefined): string {
  return w ? `  (Ø ${w.avg} · max ${w.max} ms · ${w.laeufe} Läufe)` : ''
}
