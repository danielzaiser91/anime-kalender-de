/**
 * **`?gemeldet=<Adresse>` aus dem Cache der Edge — und genau diese Adresse verwerfen, wenn jemand
 * zu ihr schreibt** (12.10.2026).
 *
 * Anlass: Die Erweiterung fragt die Antwort je Seitenaufruf und je offenem Titel neu (35.091
 * Abrufe am Tag, im Mittel 45 Zeilen = 1,6 Mio. gelesene Zeilen, `wrangler d1 insights`). Dieselbe
 * Adresse wird dabei viele Male gefragt, ihre Antwort ändert sich aber nur, wenn jemand zu ihr
 * meldet oder löscht.
 *
 * Anders als beim Stand (`pruefung.ts`, Kopf): Verworfen wird nur der Eintrag **der geschriebenen
 * Adresse**, nie eine Sammelantwort. Ein Melde-Durchgang rechnet damit je Meldung höchstens eine
 * Adresse neu (45 Zeilen), nicht die ganze Tabelle. `caches.default` gilt je Rechenzentrum; Meldung
 * und Abfrage kommen aus demselben Browser, also aus demselben. Wer von woanders fragt, sieht
 * höchstens `GEMELDET_SEKUNDEN` lang den alten Stand.
 */
export const GEMELDET_SEKUNDEN = 1800

/** Ein Schlüssel je Adresse, unabhängig davon, wie der Aufrufer sie kodiert hat. */
export function gemeldetSchluessel(basis: string, adresse: string): string {
  const u = new URL(basis)
  u.search = ''
  u.searchParams.set('gemeldet', adresse)
  return u.toString()
}

/** Die Adressen einer Meldung oder eines Stapels (`stapel: [{ url }, …]`). */
export function adressenDerMeldung(daten: Record<string, unknown>): unknown[] {
  const stapel = Array.isArray(daten.stapel) ? daten.stapel : []
  return [daten.url, ...stapel.map((m) => (m as { url?: unknown } | null)?.url)]
}

/** Die Einträge dieser Adressen verwerfen, nur im eigenen Rechenzentrum; wirft nie. Ohne Cache (Tests, lokal) tut es nichts. */
export async function verwirfGemeldet(basis: string, adressen: unknown[]): Promise<void> {
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default
  if (!cache) return
  const alle = new Set<string>()
  for (const a of adressen) {
    if (typeof a !== 'string') continue
    alle.add(a)
    alle.add(a.trim())
  }
  try {
    await Promise.all([...alle].map((a) => cache.delete(new Request(gemeldetSchluessel(basis, a), { method: 'GET' }))))
  } catch (e) {
    /* Die Meldung ist gespeichert; ein Cache-Fehler darf sie nicht in eine 500 verwandeln — es bleibt bis zu 30 min der alte Eintrag. */
    console.error('pruefung gemeldet-cache: Verwerfen fehlgeschlagen', e)
  }
}
