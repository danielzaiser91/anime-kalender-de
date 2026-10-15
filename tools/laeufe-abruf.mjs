/**
 * Liest die Laufliste des Status-Workers. Ist das D1-Tageslimit erreicht, antwortet der Worker mit 503, JSON und
 * `Retry-After` (worker/src/auffangnetz.ts); die Cloudflare-Fehlerseite „1101“ (Text oder HTML) deutet auf dasselbe.
 * Das ergibt eine klare Meldung statt eines JSON-Stacktraces; jeder andere Fehler bleibt eine Statuszeile ohne Kontingent-Hinweis.
 */

/** `{ liste }` bei Erfolg, sonst `{ meldung }`. `abruf` ist `fetch` (Tests: Attrappe). */
export async function holeLaeufe(abruf, url) {
  let antwort
  try {
    antwort = await abruf(url)
  } catch (fehler) {
    return { meldung: `Status-Worker nicht erreichbar (${fehler.message}) — nichts aufgeräumt` }
  }
  const text = await antwort.text()
  let daten
  try {
    daten = JSON.parse(text)
  } catch {
    /* Text oder HTML: unten als Fehlerantwort gemeldet */
  }
  if (!antwort.ok || daten === undefined) {
    const kontingent = antwort.status === 503 || text.includes('1101')
    const hinweis = kontingent ? ' (D1-Tageslimit erreicht, Reset 00:00 UTC)' : ''
    return { meldung: `Status-Worker antwortet ${antwort.status}${hinweis} — nichts aufgeräumt` }
  }
  return { liste: Array.isArray(daten) ? daten : (daten.laeufe ?? []) }
}
