import { type Env } from './env.ts'

/**
 * **Die Vollexporte des Baus liegen in R2, nicht im Cache der Edge.**
 *
 * `caches.default` gilt je Rechenzentrum; die GitHub-Läufe kommen aus wechselnden und treffen ihn
 * kaum — am 05.10.2026 las der Export 2,8 Mio. Zeilen am Tag (586 Seitenabrufe, Kontingent 5 Mio.).
 * R2 ist für alle Rechenzentren derselbe Ort. Verworfen wird bei jedem Schreibzugriff auf die
 * Meldungen (`pruefung.ts`); neu gerechnet wird erst beim nächsten Abruf, also höchstens einmal je Bau.
 */
const VORSATZ = 'export/'

export async function ausSpeicher(env: Env, schluessel: string, bauen: () => Promise<unknown>): Promise<Response> {
  const kopf = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  const treffer = await env.BELEGE?.get(VORSATZ + schluessel)
  if (treffer) return new Response(await treffer.text(), { headers: kopf })
  const text = JSON.stringify(await bauen())
  await env.BELEGE?.put(VORSATZ + schluessel, text)
  return new Response(text, { headers: kopf })
}

export async function exporteVerwerfen(env: Env): Promise<void> {
  if (!env.BELEGE) return
  const liste = await env.BELEGE.list({ prefix: VORSATZ })
  if (liste.objects.length) await env.BELEGE.delete(liste.objects.map((o) => o.key))
}
