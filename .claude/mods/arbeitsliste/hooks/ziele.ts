// Ziele-Kasten (Daniel, 08.11.2026): Meilensteine aus `daniel-zum-abarbeiten/ziele.md` aus `daniel-zum-abarbeiten/ziele.md`.
// ziele.md: `## <Zielname>`, darunter `- [erreicht|in Arbeit|offen] Meilenstein — [Beleg](…)`; die Reihenfolge ist die Reihenfolge der Meilensteine.
import type { ZielStand } from '../types'
export type { ZielStand }

const BALKEN = 10
const MEILENSTEIN = /^- \[(erreicht|in Arbeit|offen)\]\s+(.+?)(?:\s+—\s+.*)?$/

// Meilenstein ohne Beleg-Knöpfe und Fettdruck; „nächster“ ist der erste nicht erreichte.
export function zaehleZiele(text: string): ZielStand[] {
  const ziele: ZielStand[] = []
  for (const zeile of text.split(/\r?\n/)) {
    if (zeile.startsWith('## ')) ziele.push({ name: zeile.slice(3).trim(), erreicht: 0, gesamt: 0, naechster: null })
    const m = MEILENSTEIN.exec(zeile)
    const z = ziele[ziele.length - 1]
    if (!m || !z) continue
    z.gesamt++
    if (m[1] === 'erreicht') z.erreicht++
    else z.naechster ??= m[2]!.replace(/\*\*/g, '')
  }
  return ziele
}

export const balken = (z: ZielStand): string => {
  const voll = z.gesamt ? Math.round((z.erreicht / z.gesamt) * BALKEN) : 0
  return '█'.repeat(voll) + '░'.repeat(BALKEN - voll)
}

// Eine Zeile unter dem Ziel: Balken, „x von y“, nächster Meilenstein.
export const zielZeile = (z: ZielStand): string => `${balken(z)} ${z.erreicht} von ${z.gesamt}${z.naechster ? ` · ${z.naechster}` : ''}`

// Ziel zu einer Kastenzeile „Ziel 1 · Autonomie“: der Zielname kommt im Titel vor.
export const zielZu = (titel: string, ziele: ZielStand[]): ZielStand | undefined => ziele.find(z => titel.includes(z.name))
