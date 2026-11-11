import { providerName } from '../../shared/mappings.ts'

type Angebot = { anbieter: string; url?: string }
type Staffel = { folgen?: number; angebote?: Angebot[] }
export type MitStaffeln = { jwId?: string; staffeln?: Staffel[] }

/** Wie viele Titel mit derselben JustWatch-Serie dieselbe Folgenzahl haben, als `<jwId>|<Folgen>`. */
export function zaehleTitelJeJwFolgen(titles: Iterable<{ id: number; episodes?: number | null }>, jw: Record<string, MitStaffeln>): Map<string, number> {
  const zaehler = new Map<string, number>()
  for (const t of titles) {
    const jwId = jw[String(t.id)]?.jwId
    if (!jwId || !t.episodes) continue
    const schluessel = `${jwId}|${t.episodes}`
    zaehler.set(schluessel, (zaehler.get(schluessel) ?? 0) + 1)
  }
  return zaehler
}

/**
 * Die Staffel bei JustWatch, die genau dieser Titel ist: die einzige mit seiner Folgenzahl, und kein anderer Titel derselben Serie hat
 * dieselbe Zahl (Haganai und Komi hätten sonst die zweite Staffel bekommen, 11.11.2026). Sonst `undefined`: dann gilt „jede Staffel“.
 */
export function staffelDesTitels(e: MitStaffeln, episodes: number | null | undefined, zaehler: ReadonlyMap<string, number>): Staffel | undefined {
  if (!episodes || !e.jwId || (zaehler.get(`${e.jwId}|${episodes}`) ?? 0) > 1) return undefined
  const passende = (e.staffeln ?? []).filter((s) => s.folgen === episodes)
  return passende.length === 1 ? passende[0] : undefined
}

/** Führt die Staffel das Angebot: dieselbe Adresse oder derselbe Anbieter (die Adresse ist bei Crunchyroll je Staffel eine andere)? */
export function staffelFuehrt(staffel: Staffel, angebot: Angebot): boolean {
  const name = providerName(angebot.anbieter)
  return (staffel.angebote ?? []).some((a) => a.url === angebot.url || (!!name && providerName(a.anbieter) === name))
}
