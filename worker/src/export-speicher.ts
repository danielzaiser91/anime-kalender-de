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

export async function ausSpeicher(env: Env, schluessel: string, bauen: () => Promise<unknown>): Promise<Response> {
  const kopf = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  const treffer = await env.BELEGE?.get(VORSATZ + schluessel)
  if (treffer) {
    const marke = await env.BELEGE?.head(MARKE)
    const alt = treffer.uploaded.getTime()
    if (!marke || marke.uploaded.getTime() <= alt || Date.now() - alt < FRIST_MS) return new Response(await treffer.text(), { headers: kopf })
  }
  const text = JSON.stringify(await bauen())
  await env.BELEGE?.put(VORSATZ + schluessel, text)
  return new Response(text, { headers: kopf })
}

export async function exporteVerwerfen(env: Env): Promise<void> {
  await env.BELEGE?.put(MARKE, new Date().toISOString())
}
