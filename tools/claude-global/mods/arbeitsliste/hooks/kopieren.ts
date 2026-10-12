import type { Verweis } from './zaehlen'

// Text eines Eintrags für die Zwischenablage: Titel, Rest, dann je Verweis „Name: Adresse“.
export function kopierText(z: { titel: string; rest: string; links: Verweis[] }): string {
  return [z.titel, z.rest, ...z.links.map(v => `${v.label}: ${v.href}`)].filter(Boolean).join('\n')
}
