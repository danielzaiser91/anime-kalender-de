/**
 * Liest die Laufliste des Status-Workers. Ist das D1-Kontingent erschöpft, antwortet der Worker mit 500 oder 1101
 * (Cloudflare-Fehlerseite, Text oder HTML statt JSON); das ergibt eine klare Meldung statt eines JSON-Stacktraces.
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
    return {
      meldung: `Status-Worker antwortet ${antwort.status} (D1-Kontingent vermutlich erschöpft, Reset 02:00) — nichts aufgeräumt`,
    }
  }
  return { liste: Array.isArray(daten) ? daten : (daten.laeufe ?? []) }
}
