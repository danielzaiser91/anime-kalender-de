/**
 * Handbeleg-Block (Prime) gegen den Besitzer seiner Seite (02.11.2026, Anlass PR 2701 und 2704: Haganai, Classroom of the
 * Elite 4, K: Return of Kings, Yashahime). Eine Seite des Blocks (Adresse oder „Amazon-Seite X“ in der Notiz) gilt als fremd,
 * wenn im Bestand genau ein anderer Titel sie besitzt. Besitz: nur die Adresse eines Prime-Wegs in `titles.json` (`url`, `seite`)
 * und die Adressen in `prime-zugeordnet.json` — nie ein aus der Meldung gelesener Kennungswert (`asin`), der von der Adresse
 * abweichen kann. Seiten mit `sharedWith` und Seiten mit mehr als einem Besitzer (pendelnde Zuordnung) zählen nicht. Blöcke mit `dub: false` zählen mit (eine fremde Seite ist auch als Nein-Beleg falsch).
 * Hinweis: Das Urteil hängt am Besitz, nicht nur am Block — ein unveränderter Block wird neu rot, wenn eine Seite von zwei auf
 * einen Besitzer fällt oder eine besitzerlose Seite einen bekommt; das ist gewollt (dann Beleg entfernen oder Besitz klären).
 */
export interface BlockSeite {
  anilistId?: number
  platform?: string
  url?: string
  note?: string
  dub?: boolean
}
export interface PrimeWeg {
  platform?: string
  url?: string
  seite?: string
  sharedWith?: number
}
export interface BesitzTitel {
  id: number
  streams?: PrimeWeg[]
}
export interface Besitz {
  besitzer: Map<string, Set<number>>
  geteilt: Set<string>
}

export function asinsAus(text: string | undefined): string[] {
  return (text ?? '').match(/\bB[0-9A-Z]{9}\b/g) ?? []
}

export function blockSeiten(b: BlockSeite): string[] {
  const aus = (b.note ?? '').match(/Amazon-Seite (B[0-9A-Z]{9})\b/)
  return [...new Set([...asinsAus(b.url).slice(0, 1), ...(aus ? [aus[1]!] : [])])]
}

export function baueBesitz(titel: BesitzTitel[], zugeordnet: Record<string, { titleId: number }>): Besitz {
  const besitzer = new Map<string, Set<number>>()
  const geteilt = new Set<string>()
  const trage = (asin: string, id: number): void => void (besitzer.get(asin) ?? besitzer.set(asin, new Set()).get(asin)!).add(id)
  for (const t of titel) {
    for (const s of t.streams ?? []) {
      if (s.platform !== 'primevideo') continue
      for (const a of [...asinsAus(s.url), ...asinsAus(s.seite)]) {
        trage(a, t.id)
        if (s.sharedWith) geteilt.add(a)
      }
    }
  }
  for (const [adresse, z] of Object.entries(zugeordnet)) for (const a of asinsAus(adresse)) trage(a, z.titleId)
  return { besitzer, geteilt }
}

/** Schlüssel `<Kennung>@<Seite>` der Blöcke, deren Seite genau einem anderen Titel gehört. */
export function findeFremdeNotizseiten(belege: BlockSeite[], besitz: Besitz): string[] {
  const treffer = new Set<string>()
  for (const b of belege) {
    if (b.platform !== 'primevideo' || b.anilistId === undefined) continue
    for (const a of blockSeiten(b)) {
      const o = besitz.besitzer.get(a)
      if (!o || besitz.geteilt.has(a) || o.size !== 1 || o.has(b.anilistId)) continue
      treffer.add(`${b.anilistId}@${a}`)
    }
  }
  return [...treffer].sort()
}
