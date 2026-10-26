/** Ein Eintrag der Reihen (`franchises.json`: `cover`) oder der Datenbank (`titles.json`, `ohne-synchro.json`: `coverImage`). */
type Eintrag = { id: number; cover?: string; coverImage?: string }

export type CoverLuecken = {
  /** Kennungen mit mindestens einem Eintrag ohne Cover, die nicht auf der Lückenliste stehen. */
  fehlt: number[]
  /** Kennungen auf der Lückenliste, bei denen kein Eintrag mehr ohne Cover ist. */
  veraltet: number[]
}

/**
 * Hat jeder Reihen- und Datenbank-Eintrag ein Cover oder steht er auf der Lückenliste (`data/cover-luecken.json`, Kennung → Grund)?
 * Streng je Eintrag: Hat nur die Datenbank das Bild und die Reihe nicht, bleibt die Reihen-Kachel leer und zählt als Lücke.
 */
export function pruefeCoverLuecken(reihen: Record<string, Eintrag[]>, datenbank: Eintrag[], luecken: Record<string, string>): CoverLuecken {
  const ohne = new Set<number>()
  for (const e of [...Object.values(reihen).flat(), ...datenbank]) if (!e.cover && !e.coverImage) ohne.add(e.id)
  const fehlt = [...ohne].filter((id) => !(String(id) in luecken))
  const veraltet = Object.keys(luecken).map(Number).filter((id) => !ohne.has(id))
  return { fehlt: fehlt.sort((a, b) => a - b), veraltet: veraltet.sort((a, b) => a - b) }
}
