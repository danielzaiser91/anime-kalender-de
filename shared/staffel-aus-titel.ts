/**
 * **Welche Staffel meint dieser Titel?**
 *
 * Anbieter und Datenbanken schreiben Staffeln auf ein halbes Dutzend Arten, und
 * jede davon ist im Bestand belegt:
 *
 * - „Dr. Stone – Staffel 3", „Call of the Night: Season 2" — ausgeschrieben
 * - „Mob Psycho 100 II", „Mob Psycho 100 III" — römisch
 * - „Golden Kamuy 2" — nackte Zahl
 * - „Food Wars! The Second Plate" — Zahlwort mit eigenem Substantiv
 * - „Ranking of Kings 2nd Season" — Ordnungszahl
 *
 * Ohne diese Zuordnung meldete die Erweiterung am 27.08.2026 die erste Staffel
 * für Aufträge, die eine spätere meinten. Daniels Vorschlag war, sie schon beim
 * Bau der Prüfliste zu bestimmen: Dort steht der Titel ohnehin, und die Antwort
 * ist dieselbe für jeden, der sie später braucht.
 *
 * Die nackte Zahl bleibt auf 2 bis 9 beschränkt und die römische auf II bis IX:
 * „Fate/Zero" und „Captain Tsubasa (2018)" enden auch auf Ziffern, und ein „I"
 * am Ende ist häufiger ein Buchstabe als eine Eins.
 *
 * Ohne Angabe gilt Staffel 1 — ein Titel ohne Nummer meint die erste.
 */
const ZAHLWORT: Record<string, number> = {
  second: 2,
  zweite: 2,
  third: 3,
  dritte: 3,
  fourth: 4,
  vierte: 4,
  fifth: 5,
  fuenfte: 5,
}

const ROEMISCH: Record<string, number> = { ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 }

export function staffelAusTitel(titel: string | null | undefined): number {
  const t = (titel ?? '').toLowerCase().trim()
  if (!t) return 1

  const geschrieben =
    /\b(?:staffel|season|teil|part|cour|plate)\s*(\d+)\b/.exec(t) ??
    /\b(\d+)(?:st|nd|rd|th)?\s*(?:staffel|season|plate)\b/.exec(t)
  if (geschrieben) return Number(geschrieben[1])

  const wort = /\b(second|zweite|third|dritte|fourth|vierte|fifth|fuenfte)\b/.exec(t)?.[1]
  if (wort) return ZAHLWORT[wort]!

  /* Römisch nur am Ende: „Mob Psycho 100 II", nicht „Vinland Saga" wegen des V. */
  const roemisch = /\s(ii|iii|iv|vi{0,3}|ix)\s*$/.exec(t)?.[1]
  if (roemisch && ROEMISCH[roemisch]) return ROEMISCH[roemisch]!

  const nackt = /\s([2-9])\s*$/.exec(t)?.[1]
  return nackt ? Number(nackt) : 1
}
