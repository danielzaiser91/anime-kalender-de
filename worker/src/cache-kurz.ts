/**
 * **Eine erfolgreiche Antwort im Cache der Edge halten** — für Abfragen, die Zeilen aus D1 lesen
 * (das Tageskontingent zählt gelesene Zeilen, nicht Aufrufe).
 *
 * Aus `pruefung.ts` herausgelöst (11.10.2026), damit auch `/lauf` es nutzen kann. Begründung, Fristen
 * und warum nichts verworfen wird: Kopf von `handlePruefung`. `caches.default` gilt je Rechenzentrum.
 */
export async function ausEdgeCache(
  request: Request,
  ctx: ExecutionContext | undefined,
  sekunden: number,
  bauen: () => Promise<Response>,
): Promise<Response> {
  const schluessel = new Request(new URL(request.url).toString(), { method: 'GET' })
  const cache = caches.default
  const getroffen = await cache.match(schluessel)
  if (getroffen) return getroffen
  const frisch = await bauen()
  /* Nur erfolgreiche Antworten werden gehalten — ein Fehler soll sich nicht festsetzen. */
  if (frisch.status === 200) {
    const zumHalten = new Response(frisch.clone().body, frisch)
    zumHalten.headers.set('Cache-Control', `public, max-age=${sekunden}`)
    ctx?.waitUntil(cache.put(schluessel, zumHalten))
  }
  return frisch
}
