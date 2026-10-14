/** Der eine Satz, wenn der Newsletter-Dienst nicht antwortet: Netz weg, Tageslimit (503) oder Cloudflare-Fehlerseite. */
export const DIENST_NICHT_ERREICHBAR = 'Dein Abo ist gerade nicht erreichbar. Versuch es später noch einmal.'

/** Status, mit dem der Dienst oder Cloudflare sagt „gerade nicht“ (kein Hinweis auf ein gelöschtes Abo — das ist nur 404). */
const AUSFALL = [502, 503, 504]

/** `fetch` zum Newsletter-Dienst; Ausfälle werden zu einer Ausnahme mit dem Satz oben statt „Failed to fetch“. */
export async function dienstFetch(url: string, init?: RequestInit): Promise<Response> {
  let antwort: Response
  try {
    antwort = await fetch(url, init)
  } catch {
    throw new Error(DIENST_NICHT_ERREICHBAR)
  }
  if (AUSFALL.includes(antwort.status)) throw new Error(DIENST_NICHT_ERREICHBAR)
  return antwort
}
