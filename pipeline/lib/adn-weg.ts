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

/** Herkunft einer Worker-Antwort (Colo des Workers, cf-ray des ADN-Abrufs) für die Logzeile bei französischer Sicht; leer beim direkten Weg. */
export function herkunftZeile(kopf: { get(name: string): string | null }): string {
  const colo = kopf.get('X-Gw-Colo')
  const ray = kopf.get('X-Gw-Adn-Ray')
  return colo || ray ? `Worker-Colo ${colo ?? '?'}, ADN-cf-ray ${ray ?? '?'}` : ''
}

/** Eine Logzeile zu Beginn jedes Laufs: zeigt, welcher Weg galt (ein Workflow mit `ref: main` kann eine Variable setzen, die main nicht liest). */
export function wegZeile(weg: AdnWeg): string {
  return weg.base === ADN_DIREKT ? 'ADN direkt (kein AK_ADN_PROXY)' : `ADN über Worker: ${new URL(weg.base).host}`
}

export function adnWeg(umgebung: Record<string, string | undefined>): AdnWeg {
  const proxy = umgebung.AK_ADN_PROXY?.replace(/\/+$/, '')
  if (!proxy) return { base: ADN_DIREKT, auth: {} }
  const token = umgebung.LAUF_TOKEN
  if (!token) throw new Error('AK_ADN_PROXY gesetzt, aber LAUF_TOKEN fehlt')
  return { base: proxy, auth: { Authorization: `Bearer ${token}` } }
}
