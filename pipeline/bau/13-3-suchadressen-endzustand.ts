import { schreibeSuchadressen } from './nebendateien.ts'
import { type SlimTitel } from './13-2-auslieferung.ts'

export type OffeneSuche = { id: number; titel: string; plattform: string; url: string }

/** Titelseite im Sinn der Suchadressen-Liste: weder Suche (`/search`, `/s`, `?k=`, `?q=`) noch Startseite ohne Pfad. */
function istTitelseite(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.pathname === '' || u.pathname === '/') return false
    return !(/\/search(\/|$)|^\/s$/.test(u.pathname) || u.searchParams.has('k') || u.searchParams.has('q'))
  } catch {
    return false
  }
}

/**
 * Die Liste nennt nur, was im fertigen Bestand ohne Titelseite bleibt: Setzt eine spätere Phase
 * (Katalog, JustWatch, TMDB/MOTN) beim selben Anbieter eine Titelseite ein, ist die Frage beantwortet
 * (Tank Chair 209499, 05.11.2026). Titel, die nicht ausgeliefert werden, bleiben auf der Liste.
 */
export function suchenOhneTitelseite(offen: OffeneSuche[], slim: SlimTitel[]): OffeneSuche[] {
  const jeId = new Map(slim.map((t) => [t.id, t]))
  return offen.filter((e) => {
    const t = jeId.get(e.id)
    if (!t) return true
    return !(t.streams ?? []).some((s) => s.platform === e.plattform && istTitelseite(s.url))
  })
}

export function schreibeSuchadressenImEndzustand(offen: OffeneSuche[], slim: SlimTitel[]): void {
  schreibeSuchadressen(suchenOhneTitelseite(offen, slim))
}
