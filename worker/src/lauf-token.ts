/**
 * Prüf-Token (`LAUF_TOKEN`, `DEBUG_TOKEN`) einer Anfrage lesen und prüfen.
 *
 * Der Token gehört in den Kopf `Authorization: Bearer …`: Eine Adresse mit `?token=` steht im Klartext in
 * `wrangler tail` und in jeder Cloudflare-Anfrageliste.
 */

/** Token aus `Authorization: Bearer …`, sonst aus `X-Lauf-Token`; leer, wenn keiner da ist. */
export function tokenAusKopf(request: Request): string {
  const auth = request.headers.get('Authorization') ?? ''
  const m = /^Bearer (.+)$/i.exec(auth)
  return m ? m[1].trim() : (request.headers.get('X-Lauf-Token') ?? '')
}

/** Zeitkonstanter Vergleich; ein fehlendes Geheimnis (`undefined`/leer) stimmt nie. */
export function tokenGleich(gegeben: string, erwartet: string | undefined): boolean {
  if (!erwartet) return false
  let diff = gegeben.length ^ erwartet.length
  const n = Math.max(gegeben.length, erwartet.length)
  for (let i = 0; i < n; i++) diff |= (gegeben.charCodeAt(i) || 0) ^ (erwartet.charCodeAt(i) || 0)
  return diff === 0
}
