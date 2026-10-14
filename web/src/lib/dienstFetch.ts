import { DIENST_PAUSE } from '@shared/dienst-pause.ts'

/** Status, mit dem der Dienst oder Cloudflare sagt „gerade nicht“ (kein Hinweis auf ein gelöschtes Abo — das ist nur 404). */
const AUSFALL = [502, 503, 504]

/** `fetch` zum Newsletter-Dienst; Ausfälle werden zu einer Ausnahme mit dem Satz oben statt „Failed to fetch“. */
export async function dienstFetch(url: string, init?: RequestInit): Promise<Response> {
  let antwort: Response
  try {
    antwort = await fetch(url, init)
  } catch {
    throw new Error(DIENST_PAUSE)
  }
  if (AUSFALL.includes(antwort.status)) throw new Error(DIENST_PAUSE)
  return antwort
}
