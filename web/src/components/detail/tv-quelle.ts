import type { Release } from '@shared/types.ts'

const HTTP = /^https?:\/\//i

// Eine Adresse, die nur wie http(s) beginnt, aber nicht parsbar ist, würde beim Rendern werfen.
function istLink(url: string): boolean {
  return HTTP.test(url) && URL.canParse(url)
}

function hostVon(url: string): string {
  return new URL(url).hostname.replace(/^www\./, '')
}

/**
 * Wo der Sendetermin steht, wenn es noch kein Programm gibt (Daniel, 21.10.2026, Yaiba): Eine Ankündigung trägt keine
 * Sendung mit Programm-Adresse; dann führt das Fernseh-Zeichen zur Quelle der Ankündigung.
 */
export function tvQuelle(release: Release): { url: string; name: string } | undefined {
  const q = release.quellen?.find((e) => istLink(e.url))
  if (q) return { url: q.url, name: q.name || hostVon(q.url) }
  const url = release.sources.find((s) => istLink(s))
  return url ? { url, name: hostVon(url) } : undefined
}
