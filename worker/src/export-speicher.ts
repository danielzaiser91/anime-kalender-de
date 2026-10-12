import { type Env } from './env.ts'

/**
 * **Die Vollexporte des Baus liegen in R2, nicht im Cache der Edge.**
 *
 * `caches.default` gilt je Rechenzentrum; die GitHub-Läufe kommen aus wechselnden und treffen ihn
 * kaum — am 05.10.2026 las der Export 2,8 Mio. Zeilen am Tag (586 Seitenabrufe, Kontingent 5 Mio.).
 * R2 ist für alle Rechenzentren derselbe Ort.
 *
 * Ein Schreibzugriff setzt nur eine Marke (`export/_ungueltig`); ein Auszug gilt danach noch `FRIST_MS`,
 * dann wird er beim nächsten Abruf neu gerechnet. Der Bau fragt höchstens alle paar Minuten, die
 * Erweiterung meldet fast im Minutentakt — ohne Frist rechnete jede Meldung den ganzen Auszug neu
 * (gemessen 05.10.2026: rund 100.000 gelesene Zeilen je Stunde).
 */
const VORSATZ = 'export/'
const MARKE = VORSATZ + '_ungueltig'
const FRIST_MS = 10 * 60_000
/** Die Serienamen je Adresse (`namen`) lesen die ganze Tabelle `pruefung` (17.533 Zeilen, 22 Abrufe am 12.10.2026) und ändern sich selten. */
export const FRIST_NAMEN_MS = 6 * 60 * 60_000

export async function ausSpeicher(
  env: Env,
  schluessel: string,
  bauen: () => Promise<unknown>,
  fristMs: number = FRIST_MS,
): Promise<Response> {
  const kopf = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  const treffer = await env.BELEGE?.get(VORSATZ + schluessel)
  if (treffer) {
    const marke = await env.BELEGE?.head(MARKE)
    const alt = treffer.uploaded.getTime()
    if (!marke || marke.uploaded.getTime() <= alt || Date.now() - alt < fristMs) return new Response(await treffer.text(), { headers: kopf })
  }
  const text = JSON.stringify(await bauen())
  await env.BELEGE?.put(VORSATZ + schluessel, text)
  return new Response(text, { headers: kopf })
}

/** Die Marke ist nur ein Hinweis: scheitert sie (R2 erlaubt einen Schreibzugriff je Sekunde und Schlüssel), gilt die Frist. */
export async function exporteVerwerfen(env: Env): Promise<void> {
  try {
    await env.BELEGE?.put(MARKE, new Date().toISOString())
  } catch (e) {
    console.error(`export marke: ${(e as Error)?.name ?? 'Fehler'}`)
  }
}
