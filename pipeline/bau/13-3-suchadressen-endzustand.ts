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

/** Logzeile über die Einträge, die der Endzustand beantwortet hat (Anzahl und bis zu drei Beispiele). */
export function logzeileBeantwortete(offen: OffeneSuche[], uebrig: OffeneSuche[]): string {
  const bleibt = new Set(uebrig)
  const weg = offen.filter((e) => !bleibt.has(e))
  const beispiele = weg.slice(0, 3).map((e) => `${e.id} ${e.titel} (${e.plattform})`).join(', ')
  return `Suchadressen-Liste: ${weg.length} von ${offen.length} Einträgen im Endzustand beantwortet${weg.length ? ` — z. B. ${beispiele}` : ''}`
}

export function schreibeSuchadressenImEndzustand(offen: OffeneSuche[], slim: SlimTitel[]): void {
  const uebrig = suchenOhneTitelseite(offen, slim)
  console.log(logzeileBeantwortete(offen, uebrig))
  schreibeSuchadressen(uebrig)
}
