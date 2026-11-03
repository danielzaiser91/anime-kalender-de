/**
 * Über welchen Weg die Datenläufe ADN fragen.
 *
 * Direkt vom GitHub-Runner liefert ADN seit 28.10.2026 14:01 UTC nur den französischen Katalog; über den Worker (`worker/src/adn-gw.ts`,
 * Cloudflare-Colo FRA) kommt der deutsche. Der Worker-Weg gilt nur, wenn `AK_ADN_PROXY` gesetzt ist, und braucht dann `LAUF_TOKEN`.
 */
export const ADN_DIREKT = 'https://gw.api.animationdigitalnetwork.com'

export interface AdnWeg {
  base: string
  /** Zusatzkopf für den Worker; leer beim direkten Weg, damit der Token nie zu ADN geht. */
  auth: Record<string, string>
}

export function adnWeg(umgebung: Record<string, string | undefined>): AdnWeg {
  const proxy = umgebung.AK_ADN_PROXY?.replace(/\/+$/, '')
  if (!proxy) return { base: ADN_DIREKT, auth: {} }
  const token = umgebung.LAUF_TOKEN
  if (!token) throw new Error('AK_ADN_PROXY gesetzt, aber LAUF_TOKEN fehlt')
  return { base: proxy, auth: { Authorization: `Bearer ${token}` } }
}
