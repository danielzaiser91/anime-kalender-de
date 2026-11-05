import type { Title } from '../../shared/types.ts'
import { anzeigeName } from '../../shared/titles.ts'
import { zaehleHauptstaffeln } from '../../shared/staffel-zaehlung.ts'

/**
 * **Spin-off-Verdacht**: ein Titel, den AniList an einen anderen Teil der Reihe hängt (`beiwerk`, `PARENT`), der aber als Hauptstaffel mitzählt
 * (Fernsehserie, nicht `eigenesWerk`) und einen eigenen Namen trägt statt einer Staffelnummer. Eine Fortsetzung heißt „… 2", „… Season 3" oder trägt
 * eine belegte Staffelangabe (`eigenerName` ist dann falsch); ein eigener Name an einer `PARENT`-Kante ist meist ein Spin-off (Konosuba: An Explosion),
 * der in `data/spinoff-von-hand.yaml` fehlt. Nur ein Hinweis zum Nachsehen, kein Fehler.
 */
export function spinoffVerdacht(titel: Title[]): Title[] {
  const reihen = new Map<number, Title[]>()
  for (const t of titel) if (t.franchiseId !== undefined) reihen.set(t.franchiseId, [...(reihen.get(t.franchiseId) ?? []), t])
  const verdacht: Title[] = []
  for (const reihe of reihen.values()) {
    if (reihe.length < 2 || !reihe.some((t) => t.beiwerk)) continue
    const { staende } = zaehleHauptstaffeln(reihe.map((t) => ({ ...t, name: anzeigeName(t) })))
    for (const t of reihe) if (t.beiwerk && !t.eigenesWerk && staende.get(t.id)?.eigenerName === true) verdacht.push(t)
  }
  return verdacht
}

/** Die Warnzeile für `check:bestand` (eine Zeile, `⚠ WARNUNG`): Anzahl und die ersten Namen; leer, wenn nichts auffällt. */
export function spinoffVerdachtZeile(verdacht: Title[], zeigeBis = 5): string[] {
  if (!verdacht.length) return []
  const namen = verdacht.slice(0, zeigeBis).map((t) => `${anzeigeName(t)} (${t.id})`).join('; ')
  return [`  ⚠ WARNUNG Spin-off-Verdacht: ${verdacht.length} Titel hängen per PARENT an der Reihe, zählen aber als Staffel mit eigenem Namen — in data/spinoff-von-hand.yaml nachsehen: ${namen}${verdacht.length > zeigeBis ? ' …' : ''}`]
}
