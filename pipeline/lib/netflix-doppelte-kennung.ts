/**
 * Eine Netflix-Serie, zwei Kennungen: die Umleitung darf nirgends als eigene Reihe stehen (Ranma ½, 24.10.2026).
 * Reine Funktion; `check-netflix-umleitung.ts` (Fälle) und `check-netflix-umleitung-bestand.ts` (echter Bestand) rufen sie.
 */
import { NETFLIX_UMGELEITET } from './netflix-adresse.ts'

export type StaffelListen = Record<string, { staffeln?: { seq: number; folgen: number }[] } | undefined>
export type TitelMitWegen = { id: number; franchiseId?: number | null; streams?: { platform?: string; url?: string }[] }

const kennung = (url: string | undefined): string | undefined => /netflix\.com\/(?:[a-z-]+\/)?title\/(\d+)/i.exec(url ?? '')?.[1]

function folgenzahlen(listen: StaffelListen, id: string): number[] {
  return [...(listen[id]?.staffeln ?? [])].sort((a, b) => a.seq - b.seq).map((s) => s.folgen)
}

/** Die kürzere Liste (mindestens zwei Staffeln) ist der Anfang der längeren: dieselbe Serie, einmal mit weniger Staffeln gemeldet. */
function istAnfang(a: number[], b: number[]): boolean {
  const [kurz, lang] = a.length <= b.length ? [a, b] : [b, a]
  return kurz.length >= 2 && kurz.every((n, i) => n === lang[i])
}

export function findeDoppelteNetflixKennungen(titles: TitelMitWegen[], listen: StaffelListen): string[] {
  const funde: string[] = []
  for (const alt of Object.keys(NETFLIX_UMGELEITET)) {
    if (listen[alt]) funde.push(`Umleitung ${alt} steht als eigene Reihe in anbieter-staffeln.json`)
  }
  const jeFranchise = new Map<number, Set<string>>()
  for (const t of titles) {
    for (const s of t.streams ?? []) {
      const k = s.platform === 'netflix' ? kennung(s.url) : undefined
      if (!k) continue
      if (NETFLIX_UMGELEITET[k]) funde.push(`Titel ${t.id} führt die Umleitung ${k} statt ${NETFLIX_UMGELEITET[k]}`)
      if (t.franchiseId == null) continue
      if (!jeFranchise.has(t.franchiseId)) jeFranchise.set(t.franchiseId, new Set())
      jeFranchise.get(t.franchiseId)!.add(k)
    }
  }
  for (const [franchise, ids] of jeFranchise) {
    const liste = [...ids].sort()
    for (const [i, a] of liste.entries()) {
      for (const b of liste.slice(i + 1)) {
        if (istAnfang(folgenzahlen(listen, a), folgenzahlen(listen, b))) {
          funde.push(`Franchise ${franchise}: ${a} und ${b} führen dieselben Staffeln ohne Folgenzahl-Trennung`)
        }
      }
    }
  }
  return funde
}
